// ─── Types ────────────────────────────────────────────────────────────────────

export type StatusFieldConfig = {
  key: string; // "status1".."status21" (maps to backend field)
  label: string; // display name
  sequence: number; // 1-based ordering
  loginRequired: boolean; // if true, hide value in public search unless logged in
  isActive: boolean; // if false, hide this field everywhere
};

export type UserFieldPermission = {
  username: string;
  allowedFields: string[]; // list of status keys this user can edit
};

export type LocalUser = {
  username: string;
  role: "admin" | "user";
  password: string;
};

// ─── Default values ───────────────────────────────────────────────────────────

export const DEFAULT_STATUS_CONFIGS: StatusFieldConfig[] = [
  {
    key: "status1",
    label: "Name",
    sequence: 1,
    loginRequired: false,
    isActive: true,
  },
  {
    key: "status2",
    label: "Date of Order ID",
    sequence: 2,
    loginRequired: false,
    isActive: true,
  },
  {
    key: "status3",
    label: "Payment",
    sequence: 3,
    loginRequired: false,
    isActive: true,
  },
  {
    key: "status4",
    label: "Material Dispatched",
    sequence: 4,
    loginRequired: false,
    isActive: true,
  },
  {
    key: "status5",
    label: "Installation",
    sequence: 5,
    loginRequired: false,
    isActive: true,
  },
  {
    key: "status6",
    label: "File Submission",
    sequence: 6,
    loginRequired: false,
    isActive: true,
  },
  {
    key: "status7",
    label: "Meter",
    sequence: 7,
    loginRequired: false,
    isActive: true,
  },
  {
    key: "status8",
    label: "Internet",
    sequence: 8,
    loginRequired: false,
    isActive: true,
  },
  {
    key: "status9",
    label: "Subsidy",
    sequence: 9,
    loginRequired: false,
    isActive: true,
  },
  {
    key: "status10",
    label: "Warranty File",
    sequence: 10,
    loginRequired: false,
    isActive: true,
  },
  {
    key: "status11",
    label: "Any Pendency",
    sequence: 11,
    loginRequired: false,
    isActive: true,
  },
  {
    key: "status12",
    label: "Status 12",
    sequence: 12,
    loginRequired: false,
    isActive: false,
  },
  {
    key: "status13",
    label: "Status 13",
    sequence: 13,
    loginRequired: false,
    isActive: false,
  },
  {
    key: "status14",
    label: "Status 14",
    sequence: 14,
    loginRequired: false,
    isActive: false,
  },
  {
    key: "status15",
    label: "Status 15",
    sequence: 15,
    loginRequired: false,
    isActive: false,
  },
  {
    key: "status16",
    label: "Status 16",
    sequence: 16,
    loginRequired: false,
    isActive: false,
  },
  {
    key: "status17",
    label: "Status 17",
    sequence: 17,
    loginRequired: false,
    isActive: false,
  },
  {
    key: "status18",
    label: "Status 18",
    sequence: 18,
    loginRequired: false,
    isActive: false,
  },
  {
    key: "status19",
    label: "Status 19",
    sequence: 19,
    loginRequired: false,
    isActive: false,
  },
  {
    key: "status20",
    label: "Status 20",
    sequence: 20,
    loginRequired: false,
    isActive: false,
  },
  {
    key: "status21",
    label: "Status 21",
    sequence: 21,
    loginRequired: false,
    isActive: false,
  },
];

const DEFAULT_LOCAL_USERS: LocalUser[] = [
  { username: "arpit2127", role: "admin", password: "TyGoD@2127" },
  { username: "BO", role: "user", password: "SiYaRaM@802" },
];

// ─── localStorage keys ────────────────────────────────────────────────────────

const CONFIGS_KEY = "statusFieldConfigs";
const PERMISSIONS_KEY = "userFieldPermissions";
const USERS_KEY = "localUsers";

// ─── Status Field Configs ─────────────────────────────────────────────────────

export function getStatusFieldConfigs(): StatusFieldConfig[] {
  try {
    const raw = localStorage.getItem(CONFIGS_KEY);
    if (!raw) return DEFAULT_STATUS_CONFIGS;
    const parsed = JSON.parse(raw) as StatusFieldConfig[];
    if (!Array.isArray(parsed) || parsed.length === 0)
      return DEFAULT_STATUS_CONFIGS;
    // Merge in any new default keys missing from stored config (e.g. after adding more status fields)
    const storedKeys = new Set(parsed.map((c) => c.key));
    const missingDefaults = DEFAULT_STATUS_CONFIGS.filter(
      (c) => !storedKeys.has(c.key),
    );
    return [...parsed, ...missingDefaults];
  } catch {
    return DEFAULT_STATUS_CONFIGS;
  }
}

export function saveStatusFieldConfigs(configs: StatusFieldConfig[]): void {
  localStorage.setItem(CONFIGS_KEY, JSON.stringify(configs));
}

/** Returns active configs sorted by sequence */
export function getActiveStatusConfigs(): StatusFieldConfig[] {
  return getStatusFieldConfigs()
    .filter((c) => c.isActive)
    .sort((a, b) => a.sequence - b.sequence);
}

// ─── User Field Permissions ───────────────────────────────────────────────────

export function getUserFieldPermissions(): UserFieldPermission[] {
  try {
    const raw = localStorage.getItem(PERMISSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UserFieldPermission[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUserFieldPermissions(
  permissions: UserFieldPermission[],
): void {
  localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions));
}

/**
 * Returns the list of allowed field keys for a user.
 * Returns null if the user has no specific permissions entry (= allow all active fields).
 */
export function getUserPermission(username: string): string[] | null {
  const all = getUserFieldPermissions();
  const entry = all.find((p) => p.username === username);
  return entry ? entry.allowedFields : null;
}

// ─── Local Users ──────────────────────────────────────────────────────────────

export function getLocalUsers(): LocalUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    let stored: LocalUser[] = [];
    if (raw) {
      const parsed = JSON.parse(raw) as LocalUser[];
      stored = Array.isArray(parsed) ? parsed : [];
    }
    // Always ensure the default seed users are present
    const merged = [...DEFAULT_LOCAL_USERS];
    for (const user of stored) {
      const existingIdx = merged.findIndex((u) => u.username === user.username);
      if (existingIdx >= 0) {
        // Allow overriding default users' data from storage (e.g. password changes)
        merged[existingIdx] = user;
      } else {
        merged.push(user);
      }
    }
    return merged;
  } catch {
    return DEFAULT_LOCAL_USERS;
  }
}

export function saveLocalUsers(users: LocalUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/** Validate login credentials against local users list */
export function validateLogin(
  username: string,
  password: string,
): LocalUser | null {
  const users = getLocalUsers();
  return (
    users.find((u) => u.username === username && u.password === password) ??
    null
  );
}
