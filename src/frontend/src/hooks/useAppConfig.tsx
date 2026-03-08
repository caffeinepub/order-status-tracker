import { Loader2 } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_STATUS_CONFIGS,
  type LocalUser,
  type StatusFieldConfig,
  type UserFieldPermission,
} from "../utils/statusConfig";
import { useActor } from "./useActor";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppConfigContextValue {
  // Data
  statusConfigs: StatusFieldConfig[];
  activeStatusConfigs: StatusFieldConfig[];
  localUsers: LocalUser[];
  userFieldPermissions: UserFieldPermission[];
  isLoading: boolean;

  // Save functions (async, persist to backend)
  saveStatusConfigs: (configs: StatusFieldConfig[]) => Promise<void>;
  saveLocalUsers: (users: LocalUser[]) => Promise<void>;
  saveUserFieldPermissions: (
    permissions: UserFieldPermission[],
  ) => Promise<void>;

  // Helpers
  validateLogin: (username: string, password: string) => LocalUser | null;
  getUserPermission: (username: string) => string[] | null;
}

// ─── Default context (never reached if provider is used correctly) ─────────────

const AppConfigContext = createContext<AppConfigContextValue | null>(null);

// ─── Default local users ──────────────────────────────────────────────────────

const DEFAULT_LOCAL_USERS: LocalUser[] = [
  { username: "arpit2127", role: "admin", password: "TyGoD@2127" },
  { username: "BO", role: "user", password: "SiYaRaM@802" },
];

// ─── Merge helpers ────────────────────────────────────────────────────────────

function mergeStatusConfigs(stored: StatusFieldConfig[]): StatusFieldConfig[] {
  if (!Array.isArray(stored) || stored.length === 0)
    return DEFAULT_STATUS_CONFIGS;
  const storedKeys = new Set(stored.map((c) => c.key));
  const missingDefaults = DEFAULT_STATUS_CONFIGS.filter(
    (c) => !storedKeys.has(c.key),
  );
  return [...stored, ...missingDefaults];
}

function mergeLocalUsers(stored: LocalUser[]): LocalUser[] {
  const merged = [...DEFAULT_LOCAL_USERS];
  for (const user of stored) {
    const existingIdx = merged.findIndex((u) => u.username === user.username);
    if (existingIdx >= 0) {
      merged[existingIdx] = user;
    } else {
      merged.push(user);
    }
  }
  return merged;
}

// ─── Provider ────────────────────────────────────────────────────────────────

const ACTOR_WAIT_TIMEOUT = 10_000;

async function waitForActor<T>(
  ref: React.MutableRefObject<T | null>,
  timeoutMs = ACTOR_WAIT_TIMEOUT,
): Promise<T> {
  if (ref.current) return ref.current;
  return new Promise<T>((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const poll = setInterval(() => {
      if (ref.current) {
        clearInterval(poll);
        resolve(ref.current);
      } else if (Date.now() > deadline) {
        clearInterval(poll);
        reject(new Error("Backend not ready. Please try again."));
      }
    }, 200);
  });
}

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const { actor, isFetching } = useActor();
  const actorRef = useRef(actor);
  actorRef.current = actor;

  const [statusConfigs, setStatusConfigs] = useState<StatusFieldConfig[]>(
    DEFAULT_STATUS_CONFIGS,
  );
  const [localUsers, setLocalUsers] =
    useState<LocalUser[]>(DEFAULT_LOCAL_USERS);
  const [userFieldPermissions, setUserFieldPermissions] = useState<
    UserFieldPermission[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  // Track whether we've already fetched (to avoid double-fetch on actor re-render)
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!actor || isFetching || hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const [configsRaw, usersRaw, permsRaw] = await Promise.all([
          actor.getAppConfig("statusFieldConfigs"),
          actor.getAppConfig("localUsers"),
          actor.getAppConfig("userFieldPermissions"),
        ]);

        // Parse and merge statusFieldConfigs
        if (configsRaw) {
          try {
            const parsed = JSON.parse(configsRaw) as StatusFieldConfig[];
            setStatusConfigs(mergeStatusConfigs(parsed));
          } catch {
            setStatusConfigs(DEFAULT_STATUS_CONFIGS);
          }
        } else {
          setStatusConfigs(DEFAULT_STATUS_CONFIGS);
        }

        // Parse and merge localUsers
        if (usersRaw) {
          try {
            const parsed = JSON.parse(usersRaw) as LocalUser[];
            setLocalUsers(mergeLocalUsers(Array.isArray(parsed) ? parsed : []));
          } catch {
            setLocalUsers(DEFAULT_LOCAL_USERS);
          }
        } else {
          setLocalUsers(DEFAULT_LOCAL_USERS);
        }

        // Parse userFieldPermissions
        if (permsRaw) {
          try {
            const parsed = JSON.parse(permsRaw) as UserFieldPermission[];
            setUserFieldPermissions(Array.isArray(parsed) ? parsed : []);
          } catch {
            setUserFieldPermissions([]);
          }
        } else {
          setUserFieldPermissions([]);
        }
      } catch (err) {
        console.error("[AppConfig] Failed to load config from backend:", err);
        // Fall back to defaults on error
        setStatusConfigs(DEFAULT_STATUS_CONFIGS);
        setLocalUsers(DEFAULT_LOCAL_USERS);
        setUserFieldPermissions([]);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchAll();
  }, [actor, isFetching]);

  const saveStatusConfigs = useCallback(
    async (configs: StatusFieldConfig[]) => {
      // Optimistic update
      setStatusConfigs(configs);
      const resolvedActor = await waitForActor(actorRef);
      await resolvedActor.setAppConfig(
        "statusFieldConfigs",
        JSON.stringify(configs),
      );
    },
    [],
  );

  const saveLocalUsers = useCallback(async (users: LocalUser[]) => {
    // Optimistic update
    setLocalUsers(users);
    const resolvedActor = await waitForActor(actorRef);
    await resolvedActor.setAppConfig("localUsers", JSON.stringify(users));
  }, []);

  const saveUserFieldPermissions = useCallback(
    async (permissions: UserFieldPermission[]) => {
      // Optimistic update
      setUserFieldPermissions(permissions);
      const resolvedActor = await waitForActor(actorRef);
      await resolvedActor.setAppConfig(
        "userFieldPermissions",
        JSON.stringify(permissions),
      );
    },
    [],
  );

  const activeStatusConfigs = statusConfigs
    .filter((c) => c.isActive)
    .sort((a, b) => a.sequence - b.sequence);

  const validateLogin = useCallback(
    (username: string, password: string): LocalUser | null => {
      return (
        localUsers.find(
          (u) => u.username === username && u.password === password,
        ) ?? null
      );
    },
    [localUsers],
  );

  const getUserPermission = useCallback(
    (username: string): string[] | null => {
      const entry = userFieldPermissions.find((p) => p.username === username);
      return entry ? entry.allowedFields : null;
    },
    [userFieldPermissions],
  );

  // Show a full-screen spinner while loading config on app startup
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading configuration…</p>
      </div>
    );
  }

  return (
    <AppConfigContext.Provider
      value={{
        statusConfigs,
        activeStatusConfigs,
        localUsers,
        userFieldPermissions,
        isLoading,
        saveStatusConfigs,
        saveLocalUsers,
        saveUserFieldPermissions,
        validateLogin,
        getUserPermission,
      }}
    >
      {children}
    </AppConfigContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAppConfig(): AppConfigContextValue {
  const ctx = useContext(AppConfigContext);
  if (!ctx) {
    throw new Error("useAppConfig must be used within an AppConfigProvider");
  }
  return ctx;
}
