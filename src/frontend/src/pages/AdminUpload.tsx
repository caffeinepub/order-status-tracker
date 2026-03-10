import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Principal } from "@icp-sdk/core/principal";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardEdit,
  Download,
  FileSpreadsheet,
  KeyRound,
  Layers,
  Loader2,
  LogOut,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type { OrderStatus } from "../backend.d";
import { UserRole } from "../backend.d";
import { useActor } from "../hooks/useActor";
import { useAppConfig } from "../hooks/useAppConfig";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useBulkUpsertOrders,
  useDeleteOrder,
  useGetAllOrders,
  useGetOrder,
  useIsAdmin,
  useUpsertOrder,
} from "../hooks/useQueries";
import type {
  GroupFieldPermission,
  LocalUser,
  StatusFieldConfig,
  UserFieldPermission,
} from "../utils/statusConfig";
import { PREDEFINED_GROUPS } from "../utils/statusConfig";

// ─── Constants ────────────────────────────────────────────────────────────────

const PREVIEW_LIMIT = 10;
const ADMIN_USERNAME = "arpit2127";

const STATUS_KEYS = [
  "status1",
  "status2",
  "status3",
  "status4",
  "status5",
  "status6",
  "status7",
  "status8",
  "status9",
  "status10",
  "status11",
  "status12",
  "status13",
  "status14",
  "status15",
  "status16",
  "status17",
  "status18",
  "status19",
  "status20",
  "status21",
] as const;

// ─── XLSX CDN loader ──────────────────────────────────────────────────────────

type XLSXLib = {
  read: (
    data: ArrayBuffer,
    opts: { type: string; cellDates?: boolean; raw?: boolean },
  ) => {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  utils: {
    sheet_to_json: <T>(
      sheet: unknown,
      opts?: { defval?: unknown; raw?: boolean },
    ) => T[];
    aoa_to_sheet: (data: unknown[][]) => unknown;
    book_new: () => {
      SheetNames: string[];
      Sheets: Record<string, unknown>;
    };
    book_append_sheet: (
      wb: { SheetNames: string[]; Sheets: Record<string, unknown> },
      ws: unknown,
      name?: string,
    ) => void;
  };
  writeFile: (
    wb: { SheetNames: string[]; Sheets: Record<string, unknown> },
    filename: string,
  ) => void;
};

let xlsxLib: XLSXLib | null = null;

async function getXLSX(): Promise<XLSXLib> {
  if (xlsxLib) return xlsxLib;
  return new Promise((resolve, reject) => {
    if (document.getElementById("xlsx-cdn")) {
      const check = setInterval(() => {
        if (xlsxLib) {
          clearInterval(check);
          resolve(xlsxLib);
        }
      }, 50);
      return;
    }
    const script = document.createElement("script");
    script.id = "xlsx-cdn";
    script.src =
      "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    script.onload = () => {
      xlsxLib = (window as unknown as { XLSX: XLSXLib }).XLSX;
      resolve(xlsxLib);
    };
    script.onerror = () => reject(new Error("Failed to load xlsx library"));
    document.head.appendChild(script);
  });
}

// ─── Excel parser ─────────────────────────────────────────────────────────────

function buildColumnAliases(
  configs: StatusFieldConfig[],
): Record<string, (typeof STATUS_KEYS)[number]> {
  const aliases: Record<string, (typeof STATUS_KEYS)[number]> = {};
  for (const config of configs) {
    const key = config.key as (typeof STATUS_KEYS)[number];
    // Always register by raw key (status1, Status1, STATUS1)
    aliases[config.key] = key;
    aliases[config.key.charAt(0).toUpperCase() + config.key.slice(1)] = key;
    aliases[config.key.toUpperCase()] = key;
    // Register by current label (case insensitive variants)
    aliases[config.label] = key;
    aliases[config.label.toLowerCase()] = key;
    aliases[config.label.toUpperCase()] = key;
  }
  // Static fallbacks for known label names
  const staticAliases: Record<string, (typeof STATUS_KEYS)[number]> = {
    Name: "status1",
    name: "status1",
    NAME: "status1",
    "Date of Order ID": "status2",
    "date of order id": "status2",
    "DATE OF ORDER ID": "status2",
    Payment: "status3",
    payment: "status3",
    PAYMENT: "status3",
    "Material Dispatched": "status4",
    "material dispatched": "status4",
    "MATERIAL DISPATCHED": "status4",
    Installation: "status5",
    installation: "status5",
    INSTALLATION: "status5",
    "File Submission": "status6",
    "file submission": "status6",
    "FILE SUBMISSION": "status6",
    Meter: "status7",
    meter: "status7",
    METER: "status7",
    Internet: "status8",
    internet: "status8",
    INTERNET: "status8",
    Subsidy: "status9",
    subsidy: "status9",
    SUBSIDY: "status9",
    "Warranty File": "status10",
    "warranty file": "status10",
    "WARRANTY FILE": "status10",
    "Any Pendency": "status11",
    "any pendency": "status11",
    "ANY PENDENCY": "status11",
  };
  return { ...staticAliases, ...aliases };
}

function detectPresentColumns(
  rawHeaders: string[],
  configs: StatusFieldConfig[],
): Set<(typeof STATUS_KEYS)[number]> {
  const present = new Set<(typeof STATUS_KEYS)[number]>();
  const aliases = buildColumnAliases(configs);
  for (const header of rawHeaders) {
    const key = aliases[header.trim()];
    if (key) present.add(key);
  }
  return present;
}

type ParseResult = {
  orders: OrderStatus[];
  presentColumns: Set<(typeof STATUS_KEYS)[number]>;
};

async function parseExcelFile(
  file: File,
  configs: StatusFieldConfig[],
): Promise<ParseResult> {
  const isCsv = file.name.match(/\.csv$/i);

  if (isCsv) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length < 2) {
            reject(new Error("CSV has no data rows"));
            return;
          }
          const headers = lines[0].split(",").map((h) => h.trim());
          const presentColumns = detectPresentColumns(headers, configs);
          const rows = lines.slice(1).map((line) => {
            const vals = line
              .split(",")
              .map((v) => v.trim().replace(/^"|"$/g, ""));
            const obj: Record<string, unknown> = {};
            headers.forEach((h, i) => {
              obj[h] = vals[i] ?? "";
            });
            return obj;
          });
          const orders = mapRowsToOrders(rows);
          const valid = orders.filter((o) => o.orderId !== "");
          if (valid.length === 0) {
            reject(
              new Error(
                "No valid rows found. Make sure the 'OrderID' column exists.",
              ),
            );
          } else {
            resolve({ orders: valid, presentColumns });
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }

  const XLSX = await getXLSX();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error("Failed to read file data"));
          return;
        }
        const workbook = XLSX.read(data as ArrayBuffer, {
          type: "array",
          raw: false,
          cellDates: false,
        });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
          raw: false,
        });
        const rawHeaders = Object.keys(rows[0] ?? {});
        const presentColumns = detectPresentColumns(rawHeaders, configs);
        const orders = mapRowsToOrders(rows as Record<string, unknown>[]);
        const valid = orders.filter((o) => o.orderId !== "");
        if (valid.length === 0) {
          reject(
            new Error(
              "No valid rows found. Make sure the 'OrderID' column exists.",
            ),
          );
        } else {
          resolve({ orders: valid, presentColumns });
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

function mapRowsToOrders(rows: Record<string, unknown>[]): OrderStatus[] {
  return rows.map((row) => {
    const get = (...keys: string[]) => {
      for (const k of keys) {
        const v = row[k];
        if (v !== undefined && v !== null && v !== "") {
          return String(v).trim();
        }
      }
      return "";
    };
    return {
      orderId: get("OrderID", "orderid", "order_id", "ORDERID"),
      status1: get("Status1", "status1", "STATUS1", "Name", "name", "NAME"),
      status2: get(
        "Status2",
        "status2",
        "STATUS2",
        "Date of Order ID",
        "date of order id",
        "DATE OF ORDER ID",
      ),
      status3: get(
        "Status3",
        "status3",
        "STATUS3",
        "Payment",
        "payment",
        "PAYMENT",
      ),
      status4: get(
        "Status4",
        "status4",
        "STATUS4",
        "Material Dispatched",
        "material dispatched",
        "MATERIAL DISPATCHED",
      ),
      status5: get(
        "Status5",
        "status5",
        "STATUS5",
        "Installation",
        "installation",
        "INSTALLATION",
      ),
      status6: get(
        "Status6",
        "status6",
        "STATUS6",
        "File Submission",
        "file submission",
        "FILE SUBMISSION",
      ),
      status7: get("Status7", "status7", "STATUS7", "Meter", "meter", "METER"),
      status8: get(
        "Status8",
        "status8",
        "STATUS8",
        "Internet",
        "internet",
        "INTERNET",
      ),
      status9: get(
        "Status9",
        "status9",
        "STATUS9",
        "Subsidy",
        "subsidy",
        "SUBSIDY",
      ),
      status10: get(
        "Status10",
        "status10",
        "STATUS10",
        "Warranty File",
        "warranty file",
        "WARRANTY FILE",
      ),
      status11: get(
        "Status11",
        "status11",
        "STATUS11",
        "Any Pendency",
        "any pendency",
        "ANY PENDENCY",
      ),
      status12: get("Status12", "status12", "STATUS12"),
      status13: get("Status13", "status13", "STATUS13"),
      status14: get("Status14", "status14", "STATUS14"),
      status15: get("Status15", "status15", "STATUS15"),
      status16: get("Status16", "status16", "STATUS16"),
      status17: get("Status17", "status17", "STATUS17"),
      status18: get("Status18", "status18", "STATUS18"),
      status19: get("Status19", "status19", "STATUS19"),
      status20: get("Status20", "status20", "STATUS20"),
      status21: get("Status21", "status21", "STATUS21"),
    };
  });
}

// ─── All Orders Table ─────────────────────────────────────────────────────────

function AllOrdersTable() {
  const { data: orders, isFetching, isError } = useGetAllOrders();
  const deleteOrder = useDeleteOrder();
  const [expanded, setExpanded] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  const { activeStatusConfigs: activeConfigs } = useAppConfig();

  const handleDelete = async (orderId: string) => {
    try {
      await deleteOrder.mutateAsync(orderId);
      toast.success(`Order ${orderId} deleted`);
    } catch {
      toast.error("Failed to delete order");
    }
  };

  const handleDownloadAll = async () => {
    if (!orders || orders.length === 0) return;
    setIsDownloading(true);
    try {
      const XLSX = await getXLSX();
      const headers = ["OrderID", ...activeConfigs.map((c) => c.label)];
      const dataRows = orders.map((order) => [
        order.orderId,
        ...activeConfigs.map(
          (c) => (order[c.key as keyof OrderStatus] as string) ?? "",
        ),
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Orders");
      XLSX.writeFile(wb, "all_orders.xlsx");
      toast.success(`Exported ${orders.length} orders to all_orders.xlsx`);
    } catch {
      toast.error("Failed to export data. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base font-semibold">
              All Orders
            </CardTitle>
            {orders && (
              <Badge variant="secondary" className="text-xs">
                {orders.length} total
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {orders && orders.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleDownloadAll()}
                disabled={isDownloading}
                data-ocid="admin.download_all_button"
                className="gap-1.5 text-xs font-medium h-8"
              >
                {isDownloading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {isDownloading ? "Exporting…" : "Download All"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
              className="h-8 w-8 p-0"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {isFetching && (
            <div data-ocid="admin.loading_state" className="space-y-2">
              {["sk1", "sk2", "sk3"].map((k) => (
                <Skeleton key={k} className="h-10 rounded-lg" />
              ))}
            </div>
          )}

          {isError && !isFetching && (
            <div
              data-ocid="admin.error_state"
              className="flex items-center gap-2 py-6 text-center justify-center text-destructive"
            >
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">Failed to load orders</span>
            </div>
          )}

          {!isFetching && !isError && orders && orders.length === 0 && (
            <div
              data-ocid="admin.empty_state"
              className="flex flex-col items-center gap-2 py-10 text-center"
            >
              <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No orders yet. Upload an Excel file or add orders manually.
              </p>
            </div>
          )}

          {!isFetching && !isError && orders && orders.length > 0 && (
            <div
              className="overflow-x-auto rounded-lg border border-border"
              data-ocid="admin.table"
            >
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-semibold text-xs uppercase tracking-wider">
                      Order ID
                    </TableHead>
                    {activeConfigs.map((cfg, i) => (
                      <TableHead
                        key={cfg.key}
                        className="font-semibold text-xs uppercase tracking-wider"
                      >
                        S{i + 1}
                      </TableHead>
                    ))}
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order, idx) => (
                    <TableRow
                      key={order.orderId}
                      data-ocid={`admin.row.${idx + 1}`}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <TableCell className="font-mono text-sm font-semibold text-foreground">
                        {order.orderId}
                      </TableCell>
                      {activeConfigs.map((cfg) => (
                        <TableCell
                          key={cfg.key}
                          className="text-sm text-muted-foreground max-w-[100px] truncate"
                        >
                          {(order[cfg.key as keyof OrderStatus] as string) || (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDelete(order.orderId)}
                          disabled={deleteOrder.isPending}
                          data-ocid={`admin.delete_button.${idx + 1}`}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          {deleteOrder.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Upload Interface ─────────────────────────────────────────────────────────

function UploadInterface() {
  const [isDragging, setIsDragging] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkUpsert = useBulkUpsertOrders();
  const { data: allOrders } = useGetAllOrders();

  const { statusConfigs, activeStatusConfigs: activeConfigs } = useAppConfig();

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.match(/\.(xlsx?|csv)$/i)) {
        setParseError("Please upload a .xlsx, .xls, or .csv file");
        return;
      }
      setParseError(null);
      setParsedResult(null);
      setFileName(file.name);
      try {
        const result = await parseExcelFile(file, statusConfigs);
        setParsedResult(result);
      } catch (err) {
        setParseError(
          err instanceof Error ? err.message : "Failed to parse file",
        );
      }
    },
    [statusConfigs],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void processFile(file);
    },
    [processFile],
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void processFile(file);
      e.target.value = "";
    },
    [processFile],
  );

  const handleSubmit = async () => {
    if (!parsedResult) return;
    const { orders: parsedOrders, presentColumns } = parsedResult;

    const deduped = Object.values(
      parsedOrders.reduce<Record<string, OrderStatus>>((acc, order) => {
        acc[order.orderId] = order;
        return acc;
      }, {}),
    );

    const existingMap: Record<string, OrderStatus> = {};
    for (const o of allOrders ?? []) {
      existingMap[o.orderId] = o;
    }

    const merged = deduped.map((uploadedOrder) => {
      const existing = existingMap[uploadedOrder.orderId];
      if (!existing) {
        return uploadedOrder;
      }
      const statusFields: Record<string, string> = {};
      for (const key of STATUS_KEYS) {
        const uploadedValue = uploadedOrder[key] as string;
        const existingValue = existing[key] as string;
        if (!presentColumns.has(key)) {
          statusFields[key] = existingValue ?? "";
        } else if (!uploadedValue) {
          statusFields[key] = existingValue ?? "";
        } else {
          statusFields[key] = uploadedValue;
        }
      }
      return {
        orderId: uploadedOrder.orderId,
        status1: statusFields.status1 ?? "",
        status2: statusFields.status2 ?? "",
        status3: statusFields.status3 ?? "",
        status4: statusFields.status4 ?? "",
        status5: statusFields.status5 ?? "",
        status6: statusFields.status6 ?? "",
        status7: statusFields.status7 ?? "",
        status8: statusFields.status8 ?? "",
        status9: statusFields.status9 ?? "",
        status10: statusFields.status10 ?? "",
        status11: statusFields.status11 ?? "",
        status12: statusFields.status12 ?? "",
        status13: statusFields.status13 ?? "",
        status14: statusFields.status14 ?? "",
        status15: statusFields.status15 ?? "",
        status16: statusFields.status16 ?? "",
        status17: statusFields.status17 ?? "",
        status18: statusFields.status18 ?? "",
        status19: statusFields.status19 ?? "",
        status20: statusFields.status20 ?? "",
        status21: statusFields.status21 ?? "",
      } satisfies OrderStatus;
    });

    try {
      await bulkUpsert.mutateAsync(merged);
      toast.success(`${merged.length} orders uploaded successfully!`);
      setParsedResult(null);
      setFileName(null);
    } catch {
      toast.error("Upload failed. Please try again.");
    }
  };

  const parsedOrders = parsedResult?.orders ?? [];
  const previewOrders = parsedOrders.slice(0, PREVIEW_LIMIT);
  const hasMore = parsedOrders.length > PREVIEW_LIMIT;

  const handleDownloadTemplate = () => {
    const headers = ["OrderID", ...activeConfigs.map((c) => c.label)];
    const sampleRow = ["ORD-SAMPLE-001", ...activeConfigs.map(() => "")];
    const csvContent = [headers.join(","), sampleRow.join(",")].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "order_status_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card className="border-accent/30 bg-accent/10 shadow-none">
        <CardContent className="py-3 px-4">
          <p className="text-xs text-accent-foreground font-medium">
            <span className="font-semibold">Expected columns:</span>{" "}
            <code className="font-mono bg-accent/20 px-1 rounded text-xs">
              OrderID | {activeConfigs.map((c) => c.label).join(" | ")}
            </code>
            <br />
            <span className="text-accent-foreground/80 mt-1 inline-block">
              Partial uploads supported — include only{" "}
              <span className="font-mono font-semibold">OrderID</span> + the
              columns you want to update. Blank cells and missing columns will
              not overwrite existing values.
            </span>
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadTemplate}
          data-ocid="admin.download_template_button"
          className="gap-2 text-sm font-medium"
        >
          <Download className="w-4 h-4" />
          Download Sample Template
        </Button>
      </div>

      <label
        data-ocid="admin.dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={[
          "relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 cursor-pointer transition-all duration-200",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/40",
        ].join(" ")}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          onChange={handleFileChange}
          data-ocid="admin.upload_button"
        />
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? "bg-primary/20" : "bg-muted"}`}
        >
          <FileSpreadsheet
            className={`w-7 h-7 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`}
          />
        </div>
        <div className="text-center">
          <p className="font-semibold text-foreground text-base">
            {isDragging
              ? "Drop your file here"
              : "Drag & drop your Excel or CSV file"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            or{" "}
            <span className="text-primary font-medium underline underline-offset-2">
              click to browse
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            .xlsx · .xls · .csv
          </p>
        </div>

        {fileName && !parsedResult && !parseError && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-lg">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Parsing {fileName}…
          </div>
        )}
      </label>

      {parseError && (
        <div
          data-ocid="admin.error_state"
          className="flex items-start gap-3 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 animate-fade-in"
        >
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-destructive">
              Parse Error
            </p>
            <p className="text-xs text-destructive/80 mt-0.5">{parseError}</p>
          </div>
        </div>
      )}

      {parsedOrders.length > 0 && (
        <Card className="shadow-sm border-border animate-slide-up">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-primary" />
                  Preview
                  {hasMore ? (
                    <Badge variant="secondary" className="text-xs ml-1">
                      Showing {PREVIEW_LIMIT} of {parsedOrders.length}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs ml-1">
                      {parsedOrders.length} rows
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {fileName} — review before uploading
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto rounded-lg border border-border mb-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-semibold text-xs uppercase tracking-wider">
                      Order ID
                    </TableHead>
                    {activeConfigs.map((cfg, i) => (
                      <TableHead
                        key={cfg.key}
                        className="font-semibold text-xs uppercase tracking-wider"
                      >
                        S{i + 1}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewOrders.map((order) => (
                    <TableRow key={order.orderId} className="hover:bg-muted/20">
                      <TableCell className="font-mono text-sm font-semibold">
                        {order.orderId}
                      </TableCell>
                      {activeConfigs.map((cfg) => (
                        <TableCell
                          key={cfg.key}
                          className="text-sm text-muted-foreground max-w-[80px] truncate"
                        >
                          {(order[cfg.key as keyof OrderStatus] as string) || (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {hasMore && (
              <p className="text-xs text-muted-foreground text-center pb-3">
                + {parsedOrders.length - PREVIEW_LIMIT} more rows not shown
              </p>
            )}

            {bulkUpsert.isSuccess ? (
              <div
                data-ocid="admin.success_state"
                className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 animate-fade-in"
              >
                <CheckCircle className="w-4 h-4 text-green-600" />
                <p className="text-sm font-medium text-green-700">
                  {parsedOrders.length} orders uploaded successfully!
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={bulkUpsert.isPending}
                  data-ocid="admin.submit_button"
                  className="font-semibold gap-2"
                >
                  {bulkUpsert.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload {parsedOrders.length} Order
                      {parsedOrders.length !== 1 ? "s" : ""}
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setParsedResult(null);
                    setFileName(null);
                  }}
                  disabled={bulkUpsert.isPending}
                  className="text-muted-foreground"
                >
                  Cancel
                </Button>
                {bulkUpsert.isPending && (
                  <div
                    data-ocid="admin.loading_state"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Processing…
                  </div>
                )}
              </div>
            )}

            {bulkUpsert.isError && (
              <div
                data-ocid="admin.error_state"
                className="mt-3 flex items-center gap-2 text-sm text-destructive"
              >
                <AlertCircle className="w-4 h-4" />
                Upload failed. Please try again.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Manual Entry Form ────────────────────────────────────────────────────────

function ManualEntryForm() {
  const upsertOrder = useUpsertOrder();
  const [orderId, setOrderId] = useState("");
  const [statuses, setStatuses] = useState<Record<string, string>>(() =>
    Object.fromEntries(STATUS_KEYS.map((k) => [k, ""])),
  );
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);

  const { activeStatusConfigs: activeConfigs } = useAppConfig();

  const handleStatusChange = (key: string, value: string) => {
    setStatuses((prev) => ({ ...prev, [key]: value }));
    setShowSuccess(false);
    setShowError(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim()) {
      toast.error("Order ID is required");
      return;
    }
    setShowSuccess(false);
    setShowError(false);
    try {
      await upsertOrder.mutateAsync({
        orderId: orderId.trim(),
        ...statuses,
      } as OrderStatus);
      toast.success(`Order "${orderId.trim()}" saved successfully!`);
      setShowSuccess(true);
      setShowError(false);
      setOrderId("");
      setStatuses(Object.fromEntries(STATUS_KEYS.map((k) => [k, ""])));
    } catch {
      toast.error("Failed to save order. Please try again.");
      setShowSuccess(false);
      setShowError(true);
    }
  };

  return (
    <Card className="shadow-sm border-border">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardEdit className="w-4 h-4 text-primary" />
          <CardTitle className="text-base font-semibold">
            Manual Order Entry
          </CardTitle>
        </div>
        <CardDescription className="text-xs">
          Enter an Order ID and fill in the status fields, then click Save
          Order.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="manual-order-id" className="text-sm font-medium">
              Order ID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="manual-order-id"
              placeholder="e.g. ORD-2024-001"
              value={orderId}
              onChange={(e) => {
                setOrderId(e.target.value);
                setShowSuccess(false);
                setShowError(false);
              }}
              required
              data-ocid="admin.manual_entry_orderid_input"
              className="font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeConfigs.map((cfg) => (
              <div key={cfg.key} className="space-y-1.5">
                <Label
                  htmlFor={`manual-${cfg.key}`}
                  className="text-sm font-medium text-muted-foreground"
                >
                  {cfg.label}
                </Label>
                <Input
                  id={`manual-${cfg.key}`}
                  placeholder={`Enter ${cfg.label}`}
                  value={statuses[cfg.key] ?? ""}
                  onChange={(e) => handleStatusChange(cfg.key, e.target.value)}
                  data-ocid={`admin.manual_entry_${cfg.key}_input`}
                />
              </div>
            ))}
          </div>

          {showSuccess && (
            <div
              data-ocid="admin.manual_entry_success_state"
              className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 animate-fade-in"
            >
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
              <p className="text-sm font-medium text-green-700">
                Order saved successfully!
              </p>
            </div>
          )}

          {showError && (
            <div
              data-ocid="admin.manual_entry_error_state"
              className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 animate-fade-in"
            >
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-sm font-medium text-destructive">
                Failed to save order. Please try again.
              </p>
            </div>
          )}

          <div className="pt-1">
            <Button
              type="submit"
              disabled={upsertOrder.isPending || !orderId.trim()}
              data-ocid="admin.manual_entry_submit_button"
              className="gap-2 font-semibold"
            >
              {upsertOrder.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Save Order
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Status Fields Management Tab ─────────────────────────────────────────────

function StatusFieldsManager() {
  const { statusConfigs: backendConfigs, saveStatusConfigs } = useAppConfig();
  const [configs, setConfigs] = useState<StatusFieldConfig[]>(backendConfigs);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Keep local state in sync when backend data changes
  const prevBackendConfigsRef = useRef(backendConfigs);
  if (prevBackendConfigsRef.current !== backendConfigs) {
    prevBackendConfigsRef.current = backendConfigs;
    setConfigs(backendConfigs);
  }

  const activeConfigs = configs
    .filter((c) => c.isActive)
    .sort((a, b) => a.sequence - b.sequence);
  const inactiveConfigs = configs.filter((c) => !c.isActive);

  const updateConfig = (key: string, updates: Partial<StatusFieldConfig>) => {
    setConfigs((prev) =>
      prev.map((c) => (c.key === key ? { ...c, ...updates } : c)),
    );
    setSaved(false);
  };

  const moveUp = (key: string) => {
    const sorted = [...activeConfigs];
    const idx = sorted.findIndex((c) => c.key === key);
    if (idx <= 0) return;
    const newConfigs = [...configs];
    // Swap sequences
    const a = newConfigs.find((c) => c.key === sorted[idx].key)!;
    const b = newConfigs.find((c) => c.key === sorted[idx - 1].key)!;
    const tmpSeq = a.sequence;
    a.sequence = b.sequence;
    b.sequence = tmpSeq;
    setConfigs([...newConfigs]);
    setSaved(false);
  };

  const moveDown = (key: string) => {
    const sorted = [...activeConfigs];
    const idx = sorted.findIndex((c) => c.key === key);
    if (idx < 0 || idx >= sorted.length - 1) return;
    const newConfigs = [...configs];
    const a = newConfigs.find((c) => c.key === sorted[idx].key)!;
    const b = newConfigs.find((c) => c.key === sorted[idx + 1].key)!;
    const tmpSeq = a.sequence;
    a.sequence = b.sequence;
    b.sequence = tmpSeq;
    setConfigs([...newConfigs]);
    setSaved(false);
  };

  const reactivate = (key: string, label: string) => {
    // Find next available sequence number
    const maxSeq = Math.max(0, ...activeConfigs.map((c) => c.sequence));
    updateConfig(key, { isActive: true, label, sequence: maxSeq + 1 });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveStatusConfigs(configs);
      setSaved(true);
      toast.success("Status field configuration saved!");
    } catch {
      toast.error("Failed to save configuration. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddField = () => {
    if (activeConfigs.length >= 21) {
      toast.error("All 21 status fields are already active");
      return;
    }
    // Find first STATUS_KEY not already active in configs
    const activeKeys = new Set(activeConfigs.map((c) => c.key));
    const nextKey = STATUS_KEYS.find((k) => !activeKeys.has(k));
    if (!nextKey) {
      toast.error("All 21 status fields are already active");
      return;
    }
    const maxSeq = Math.max(0, ...activeConfigs.map((c) => c.sequence));
    const existingInactive = configs.find((c) => c.key === nextKey);
    if (existingInactive) {
      // Re-activate the existing inactive entry
      setConfigs((prev) =>
        prev.map((c) =>
          c.key === nextKey
            ? {
                ...c,
                label: "New Status",
                sequence: maxSeq + 1,
                isActive: true,
              }
            : c,
        ),
      );
    } else {
      // Add brand-new entry
      setConfigs((prev) => [
        ...prev,
        {
          key: nextKey,
          label: "New Status",
          sequence: maxSeq + 1,
          loginRequired: false,
          isActive: true,
        },
      ]);
    }
    setSaved(false);
  };

  return (
    <div className="space-y-6">
      <Card className="border-accent/30 bg-accent/10 shadow-none">
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-2">
            <Settings className="w-4 h-4 text-accent-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-accent-foreground font-medium">
              Configure which status fields are visible, their display names,
              and whether they require login to view on the public search page.
              Use the arrows to reorder. Changes take effect after saving.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Active Fields */}
      <Card className="shadow-sm border-border">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-primary" />
              Active Status Fields
              <Badge variant="secondary" className="text-xs">
                {activeConfigs.length}
              </Badge>
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddField}
              disabled={activeConfigs.length >= 21}
              data-ocid="admin.add_status_field_button"
              className="gap-1.5 text-xs font-medium h-8 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Status Field
            </Button>
          </div>
          <CardDescription className="text-xs">
            Drag to reorder using the arrows. Toggle &quot;Login Required&quot;
            to hide from public search. Toggle &quot;Active&quot; to deactivate
            a field.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2" data-ocid="admin.status_fields_list">
            {activeConfigs.map((cfg, idx) => (
              <div
                key={cfg.key}
                data-ocid={`admin.status_field.item.${idx + 1}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5 hover:bg-muted/50 transition-colors"
              >
                {/* Sequence buttons */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveUp(cfg.key)}
                    disabled={idx === 0}
                    className="h-5 w-5 p-0 disabled:opacity-30"
                    data-ocid={`admin.status_field.move_up.${idx + 1}`}
                  >
                    <ArrowUp className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveDown(cfg.key)}
                    disabled={idx === activeConfigs.length - 1}
                    className="h-5 w-5 p-0 disabled:opacity-30"
                    data-ocid={`admin.status_field.move_down.${idx + 1}`}
                  >
                    <ArrowDown className="w-3 h-3" />
                  </Button>
                </div>

                {/* Sequence badge */}
                <span className="text-xs font-mono text-muted-foreground w-6 shrink-0 text-center">
                  {idx + 1}
                </span>

                {/* Label input */}
                <Input
                  value={cfg.label}
                  onChange={(e) =>
                    updateConfig(cfg.key, { label: e.target.value })
                  }
                  className="flex-1 h-8 text-sm font-medium"
                  placeholder="Field label"
                  data-ocid={`admin.status_field.label_input.${idx + 1}`}
                />

                {/* Login Required toggle */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Label
                    htmlFor={`login-req-${cfg.key}`}
                    className="text-xs text-muted-foreground whitespace-nowrap"
                  >
                    Login Required
                  </Label>
                  <Switch
                    id={`login-req-${cfg.key}`}
                    checked={cfg.loginRequired}
                    onCheckedChange={(val) =>
                      updateConfig(cfg.key, { loginRequired: val })
                    }
                    data-ocid={`admin.status_field.login_required.${idx + 1}`}
                    className="scale-75"
                  />
                </div>

                {/* Active toggle */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Label
                    htmlFor={`active-${cfg.key}`}
                    className="text-xs text-muted-foreground"
                  >
                    Active
                  </Label>
                  <Switch
                    id={`active-${cfg.key}`}
                    checked={cfg.isActive}
                    onCheckedChange={(val) =>
                      updateConfig(cfg.key, { isActive: val })
                    }
                    data-ocid={`admin.status_field.active.${idx + 1}`}
                    className="scale-75"
                  />
                </div>
              </div>
            ))}

            {activeConfigs.length === 0 && (
              <div
                data-ocid="admin.status_fields_empty_state"
                className="flex flex-col items-center gap-2 py-8 text-center"
              >
                <Settings className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No active status fields. Re-activate fields below.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Inactive Fields */}
      {inactiveConfigs.length > 0 && (
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="w-4 h-4" />
              Inactive Fields
              <Badge variant="outline" className="text-xs">
                {inactiveConfigs.length}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              These fields are hidden everywhere. Re-activate to make them
              visible again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inactiveConfigs.map((cfg, idx) => (
                <InactiveFieldRow
                  key={cfg.key}
                  cfg={cfg}
                  idx={idx}
                  onReactivate={reactivate}
                  onUpdateLabel={(key, label) => updateConfig(key, { label })}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => void handleSave()}
          disabled={isSaving}
          data-ocid="admin.status_fields_save_button"
          className="gap-2 font-semibold"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Save Configuration
            </>
          )}
        </Button>
        {saved && (
          <span
            data-ocid="admin.status_fields_success_state"
            className="text-sm text-green-600 font-medium animate-fade-in"
          >
            ✓ Saved
          </span>
        )}
      </div>
    </div>
  );
}

interface InactiveFieldRowProps {
  cfg: StatusFieldConfig;
  idx: number;
  onReactivate: (key: string, label: string) => void;
  onUpdateLabel: (key: string, label: string) => void;
}

function InactiveFieldRow({
  cfg,
  idx,
  onReactivate,
  onUpdateLabel,
}: InactiveFieldRowProps) {
  const [labelInput, setLabelInput] = useState(cfg.label);

  return (
    <div
      key={cfg.key}
      data-ocid={`admin.inactive_field.item.${idx + 1}`}
      className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/10 px-3 py-2.5 opacity-60"
    >
      <span className="text-xs font-mono text-muted-foreground w-20 shrink-0">
        {cfg.key}
      </span>
      <Input
        value={labelInput}
        onChange={(e) => {
          setLabelInput(e.target.value);
          onUpdateLabel(cfg.key, e.target.value);
        }}
        className="flex-1 h-8 text-sm"
        placeholder="Label"
        data-ocid={`admin.inactive_field.label_input.${idx + 1}`}
      />
      <Button
        size="sm"
        variant="outline"
        onClick={() => onReactivate(cfg.key, labelInput)}
        data-ocid={`admin.inactive_field.reactivate_button.${idx + 1}`}
        className="shrink-0 text-xs h-8"
      >
        Re-activate
      </Button>
    </div>
  );
}

// ─── Group Permissions Manager ────────────────────────────────────────────────

function GroupPermissionsManager() {
  const {
    groupFieldPermissions: backendGroupPerms,
    activeStatusConfigs: activeConfigs,
    saveGroupFieldPermissions,
  } = useAppConfig();

  // Initialize local state ensuring all predefined groups are present
  const initGroups = () => {
    return PREDEFINED_GROUPS.map((name) => {
      const existing = backendGroupPerms.find((g) => g.groupName === name);
      return existing ?? { groupName: name, allowedFields: [] };
    });
  };

  const [groups, setGroups] = useState<GroupFieldPermission[]>(initGroups);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Keep in sync when backend data changes
  const prevBackendRef = useRef(backendGroupPerms);
  if (prevBackendRef.current !== backendGroupPerms) {
    prevBackendRef.current = backendGroupPerms;
    setGroups(initGroups());
  }

  const toggleField = (
    groupName: string,
    fieldKey: string,
    checked: boolean,
  ) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.groupName !== groupName) return g;
        const fields = checked
          ? [...g.allowedFields, fieldKey]
          : g.allowedFields.filter((k) => k !== fieldKey);
        return { ...g, allowedFields: fields };
      }),
    );
    setSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveGroupFieldPermissions(groups);
      setSaved(true);
      toast.success("Group permissions saved!");
    } catch {
      toast.error("Failed to save group permissions. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const GROUP_COLORS: Record<string, string> = {
    BO: "bg-blue-100 text-blue-800 border-blue-200",
    Tech: "bg-purple-100 text-purple-800 border-purple-200",
    HOD: "bg-amber-100 text-amber-800 border-amber-200",
    Installer: "bg-green-100 text-green-800 border-green-200",
  };

  return (
    <div className="space-y-6">
      <Card className="border-accent/30 bg-accent/10 shadow-none">
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-2">
            <Layers className="w-4 h-4 text-accent-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-accent-foreground font-medium">
              Configure which status fields each group can edit. Users assigned
              to a group will be able to edit those fields. A user can be
              assigned to multiple groups — their permissions will be combined.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groups.map((group, groupIdx) => {
          const allowedCount = group.allowedFields.filter((k) =>
            activeConfigs.some((c) => c.key === k),
          ).length;
          const colorClass =
            GROUP_COLORS[group.groupName] ??
            "bg-muted text-foreground border-border";
          return (
            <Card
              key={group.groupName}
              data-ocid={`admin.group.card.${groupIdx + 1}`}
              className="shadow-sm border-border"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold border ${colorClass}`}
                    >
                      {group.groupName}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {allowedCount} field{allowedCount !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </div>
                <CardDescription className="text-xs mt-1">
                  Select which status fields this group can edit.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeConfigs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No active status fields configured yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {activeConfigs.map((cfg, fieldIdx) => (
                      <div
                        key={cfg.key}
                        className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 hover:bg-muted/30 transition-colors"
                      >
                        <Checkbox
                          id={`group-${group.groupName}-${cfg.key}`}
                          checked={group.allowedFields.includes(cfg.key)}
                          onCheckedChange={(checked) =>
                            toggleField(group.groupName, cfg.key, !!checked)
                          }
                          data-ocid={`admin.group.${groupIdx + 1}.checkbox.${fieldIdx + 1}`}
                        />
                        <Label
                          htmlFor={`group-${group.groupName}-${cfg.key}`}
                          className="text-sm font-medium cursor-pointer flex-1"
                        >
                          {cfg.label}
                        </Label>
                        <span className="text-xs font-mono text-muted-foreground">
                          {cfg.key}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={() => void handleSave()}
          disabled={isSaving}
          data-ocid="admin.group_permissions_save_button"
          className="gap-2 font-semibold"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Save Group Permissions
            </>
          )}
        </Button>
        {saved && (
          <span
            data-ocid="admin.group_permissions_success_state"
            className="text-sm text-green-600 font-medium animate-fade-in"
          >
            ✓ Saved
          </span>
        )}
      </div>
    </div>
  );
}

// ─── User Management ──────────────────────────────────────────────────────────

function UserManagement() {
  const { actor } = useActor();
  const {
    localUsers,
    userFieldPermissions,
    activeStatusConfigs: activeConfigs,
    saveLocalUsers,
    saveUserFieldPermissions,
    getUserPermission,
  } = useAppConfig();
  const [principalInput, setPrincipalInput] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.user);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // New user form state
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [addUserError, setAddUserError] = useState<string | null>(null);

  // Permissions dialog
  const [permDialogUser, setPermDialogUser] = useState<LocalUser | null>(null);
  const [tempPermissions, setTempPermissions] = useState<string[]>([]);

  // Group assignment saving state
  const [savingGroupsFor, setSavingGroupsFor] = useState<string | null>(null);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor) {
      toast.error("Not connected to backend");
      return;
    }
    if (!principalInput.trim()) {
      toast.error("Principal ID is required");
      return;
    }

    setIsAssigning(true);
    setAssignSuccess(false);
    setAssignError(null);

    try {
      const principal = Principal.fromText(principalInput.trim());
      await actor.assignCallerUserRole(principal, selectedRole);
      toast.success(
        `Role "${selectedRole}" assigned to ${principalInput.trim()}`,
      );
      setAssignSuccess(true);
      setPrincipalInput("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to assign role";
      toast.error(message);
      setAssignError(message);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAddUser = async () => {
    setAddUserError(null);
    if (!newUsername.trim()) {
      setAddUserError("Username is required");
      return;
    }
    if (!newPassword.trim()) {
      setAddUserError("Password is required");
      return;
    }
    const existing = localUsers.find(
      (u) => u.username.toLowerCase() === newUsername.trim().toLowerCase(),
    );
    if (existing) {
      setAddUserError("A user with this username already exists");
      return;
    }
    const updated = [
      ...localUsers,
      {
        username: newUsername.trim(),
        password: newPassword.trim(),
        role: newRole,
      },
    ];
    try {
      await saveLocalUsers(updated);
      setNewUsername("");
      setNewPassword("");
      setNewRole("user");
      toast.success(`User "${newUsername.trim()}" added`);
    } catch {
      toast.error("Failed to save user. Please try again.");
    }
  };

  const handleDeleteUser = async (username: string) => {
    // Protect default admin
    if (username === ADMIN_USERNAME) {
      toast.error("Cannot delete the master admin account");
      return;
    }
    const updated = localUsers.filter((u) => u.username !== username);
    try {
      await saveLocalUsers(updated);
      toast.success(`User "${username}" removed`);
    } catch {
      toast.error("Failed to delete user. Please try again.");
    }
  };

  const openPermissions = (user: LocalUser) => {
    const perms = getUserPermission(user.username);
    // null = allow all; default to all active fields
    setTempPermissions(perms ?? activeConfigs.map((c) => c.key));
    setPermDialogUser(user);
  };

  const togglePermField = (key: string, checked: boolean) => {
    setTempPermissions((prev) =>
      checked ? [...prev, key] : prev.filter((k) => k !== key),
    );
  };

  const savePermissions = async () => {
    if (!permDialogUser) return;
    const allPerms: UserFieldPermission[] = [...userFieldPermissions];
    const idx = allPerms.findIndex(
      (p) => p.username === permDialogUser.username,
    );
    if (idx >= 0) {
      allPerms[idx] = { ...allPerms[idx], allowedFields: tempPermissions };
    } else {
      allPerms.push({
        username: permDialogUser.username,
        allowedFields: tempPermissions,
      });
    }
    try {
      await saveUserFieldPermissions(allPerms);
      toast.success(`Permissions updated for "${permDialogUser.username}"`);
      setPermDialogUser(null);
    } catch {
      toast.error("Failed to save permissions. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Local Users List ── */}
      <Card className="shadow-sm border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <CardTitle className="text-base font-semibold">
              Local Users
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {localUsers.length}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Manage local panel users and their field-level editing permissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="overflow-x-auto rounded-lg border border-border"
            data-ocid="admin.users_table"
          >
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Username
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Role
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">
                    Groups
                  </TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {localUsers.map((user, idx) => (
                  <TableRow
                    key={user.username}
                    data-ocid={`admin.users_table.row.${idx + 1}`}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="font-mono text-sm font-semibold">
                      {user.username}
                      {user.username === ADMIN_USERNAME && (
                        <Badge className="ml-2 text-xs" variant="secondary">
                          master
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.role === "admin" ? "default" : "outline"}
                        className="text-xs capitalize"
                      >
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.role === "admin" ||
                      user.username === ADMIN_USERNAME ? (
                        <span className="text-xs text-muted-foreground italic">
                          Admin (All Access)
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {PREDEFINED_GROUPS.map((groupName) => {
                            const isInGroup = (user.groups ?? []).includes(
                              groupName,
                            );
                            const isSaving = savingGroupsFor === user.username;
                            return (
                              <button
                                key={groupName}
                                type="button"
                                disabled={isSaving}
                                onClick={async () => {
                                  setSavingGroupsFor(user.username);
                                  const currentGroups = user.groups ?? [];
                                  const updatedGroups = isInGroup
                                    ? currentGroups.filter(
                                        (g) => g !== groupName,
                                      )
                                    : [...currentGroups, groupName];
                                  const updatedUsers = localUsers.map((u) =>
                                    u.username === user.username
                                      ? { ...u, groups: updatedGroups }
                                      : u,
                                  );
                                  try {
                                    await saveLocalUsers(updatedUsers);
                                    toast.success(
                                      isInGroup
                                        ? `Removed ${user.username} from ${groupName}`
                                        : `Added ${user.username} to ${groupName}`,
                                    );
                                  } catch {
                                    toast.error(
                                      "Failed to update group assignment",
                                    );
                                  } finally {
                                    setSavingGroupsFor(null);
                                  }
                                }}
                                data-ocid={`admin.users_table.group_toggle.${idx + 1}`}
                                className={[
                                  "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border transition-all",
                                  isInGroup
                                    ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                                    : "bg-muted text-muted-foreground border-border hover:bg-muted/80",
                                  isSaving
                                    ? "opacity-50 cursor-not-allowed"
                                    : "cursor-pointer",
                                ].join(" ")}
                              >
                                {isSaving ? (
                                  <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" />
                                ) : null}
                                {groupName}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {user.role !== "admin" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPermissions(user)}
                            data-ocid={`admin.users_table.permissions_button.${idx + 1}`}
                            className="h-7 text-xs gap-1"
                          >
                            <KeyRound className="w-3 h-3" />
                            Permissions
                          </Button>
                        )}
                        {user.username !== ADMIN_USERNAME && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDeleteUser(user.username)}
                            data-ocid={`admin.users_table.delete_button.${idx + 1}`}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Add New User ── */}
      <Card className="shadow-sm border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            <CardTitle className="text-base font-semibold">
              Add New User
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Create a new local login account for panel access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="new-username" className="text-sm font-medium">
                Username
              </Label>
              <Input
                id="new-username"
                placeholder="e.g. user01"
                value={newUsername}
                onChange={(e) => {
                  setNewUsername(e.target.value);
                  setAddUserError(null);
                }}
                data-ocid="admin.add_user_username_input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setAddUserError(null);
                }}
                data-ocid="admin.add_user_password_input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-role" className="text-sm font-medium">
                Role
              </Label>
              <Select
                value={newRole}
                onValueChange={(v) => setNewRole(v as "admin" | "user")}
              >
                <SelectTrigger
                  id="new-role"
                  data-ocid="admin.add_user_role_select"
                  className="w-full"
                >
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                      Admin
                    </div>
                  </SelectItem>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      User
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {addUserError && (
            <div
              data-ocid="admin.add_user_error_state"
              className="mt-3 flex items-center gap-2 text-sm text-destructive"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {addUserError}
            </div>
          )}

          <div className="mt-4">
            <Button
              onClick={() => void handleAddUser()}
              data-ocid="admin.add_user_submit_button"
              className="gap-2 font-semibold"
            >
              <UserPlus className="w-4 h-4" />
              Add User
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* ── Assign Internet Identity Role ── */}
      <Card className="border-accent/30 bg-accent/10 shadow-none">
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-accent-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-accent-foreground font-medium">
              Enter a user&apos;s Principal ID to grant or revoke admin access.
              Users promoted to <strong>admin</strong> will have full access to
              the admin panel. Demote to <strong>user</strong> to remove admin
              privileges.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserCog className="w-4 h-4 text-primary" />
            <CardTitle className="text-base font-semibold">
              Assign Internet Identity Role
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Promote or demote users by their Internet Identity Principal ID.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleAssign(e)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="user-principal" className="text-sm font-medium">
                Principal ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="user-principal"
                placeholder="aaaaa-aa or xxxxx-xxxxx-xxxxx-xxxxx-xxx"
                value={principalInput}
                onChange={(e) => {
                  setPrincipalInput(e.target.value);
                  setAssignSuccess(false);
                  setAssignError(null);
                }}
                required
                data-ocid="admin.user_mgmt_principal_input"
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="user-role" className="text-sm font-medium">
                Role
              </Label>
              <Select
                value={selectedRole}
                onValueChange={(v) => {
                  setSelectedRole(v as UserRole);
                  setAssignSuccess(false);
                  setAssignError(null);
                }}
              >
                <SelectTrigger
                  id="user-role"
                  data-ocid="admin.user_mgmt_role_select"
                  className="w-full"
                >
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UserRole.admin}>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                      Admin
                    </div>
                  </SelectItem>
                  <SelectItem value={UserRole.user}>
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      User
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {assignSuccess && (
              <div
                data-ocid="admin.user_mgmt_success_state"
                className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 animate-fade-in"
              >
                <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                <p className="text-sm font-medium text-green-700">
                  Role assigned successfully!
                </p>
              </div>
            )}

            {assignError && (
              <div
                data-ocid="admin.user_mgmt_error_state"
                className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 animate-fade-in"
              >
                <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm font-medium text-destructive">
                  {assignError}
                </p>
              </div>
            )}

            <div className="pt-1">
              <Button
                type="submit"
                disabled={isAssigning || !principalInput.trim()}
                data-ocid="admin.user_mgmt_assign_button"
                className="gap-2 font-semibold"
              >
                {isAssigning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Assigning…
                  </>
                ) : (
                  <>
                    <UserCog className="w-4 h-4" />
                    Assign Role
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Permissions Dialog ── */}
      <Dialog
        open={!!permDialogUser}
        onOpenChange={(open) => {
          if (!open) setPermDialogUser(null);
        }}
      >
        <DialogContent
          className="max-w-md"
          data-ocid="admin.permissions_dialog"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              Edit Permissions for{" "}
              <span className="font-mono text-primary">
                {permDialogUser?.username}
              </span>
            </DialogTitle>
            <DialogDescription>
              Select which status fields this user is allowed to edit. Unchecked
              fields will be read-only for this user.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-64 overflow-y-auto py-2">
            {activeConfigs.map((cfg, idx) => (
              <div
                key={cfg.key}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-muted/30 transition-colors"
              >
                <Checkbox
                  id={`perm-${cfg.key}`}
                  checked={tempPermissions.includes(cfg.key)}
                  onCheckedChange={(v) => togglePermField(cfg.key, !!v)}
                  data-ocid={`admin.permissions_dialog.checkbox.${idx + 1}`}
                />
                <Label
                  htmlFor={`perm-${cfg.key}`}
                  className="text-sm font-medium cursor-pointer flex-1"
                >
                  {cfg.label}
                </Label>
                <span className="text-xs font-mono text-muted-foreground">
                  {cfg.key}
                </span>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPermDialogUser(null)}
              data-ocid="admin.permissions_dialog.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void savePermissions()}
              data-ocid="admin.permissions_dialog.confirm_button"
              className="gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── BO Panel helpers ─────────────────────────────────────────────────────────

const getTodayDate = () => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

// ─── BO Panel (restricted update-only user) ───────────────────────────────────

interface BOPanelProps {
  onLogout: () => void;
  username: string;
}

function BOPanel({ onLogout, username }: BOPanelProps) {
  const [searchInput, setSearchInput] = useState("");
  const [searchedId, setSearchedId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, string>>(() =>
    Object.fromEntries(STATUS_KEYS.map((k) => [k, ""])),
  );
  const [checkedKeys, setCheckedKeys] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(STATUS_KEYS.map((k) => [k, false])),
  );
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const { data: order, isFetching: isSearching } = useGetOrder(searchedId);
  const upsertOrder = useUpsertOrder();

  // Resolve permissions for this user
  const { activeStatusConfigs: activeConfigs, getUserPermission } =
    useAppConfig();
  const userAllowedFields = getUserPermission(username);
  // null = allow all; otherwise filter by allowedFields
  const isFieldEditable = (key: string) =>
    userAllowedFields === null || userAllowedFields.includes(key);

  const prevSearchedId = useRef<string | null>(null);
  if (searchedId !== prevSearchedId.current) {
    prevSearchedId.current = searchedId;
    if (order) {
      const filled = Object.fromEntries(
        STATUS_KEYS.map((k) => [k, (order[k] as string) ?? ""]),
      );
      setStatuses(filled);
      setCheckedKeys(
        Object.fromEntries(STATUS_KEYS.map((k) => [k, !!filled[k]])),
      );
      setSaveSuccess(false);
      setSaveError(false);
    }
  }

  const prevOrderRef = useRef<OrderStatus | null | undefined>(undefined);
  if (order !== prevOrderRef.current) {
    prevOrderRef.current = order;
    if (order && searchedId) {
      const filled = Object.fromEntries(
        STATUS_KEYS.map((k) => [k, (order[k] as string) ?? ""]),
      );
      setStatuses(filled);
      setCheckedKeys(
        Object.fromEntries(STATUS_KEYS.map((k) => [k, !!filled[k]])),
      );
      setSaveSuccess(false);
      setSaveError(false);
    }
  }

  const handleSearch = () => {
    const trimmed = searchInput.trim();
    if (!trimmed) return;
    setSaveSuccess(false);
    setSaveError(false);
    setSearchedId(trimmed);
  };

  const handleStatusChange = (key: string, value: string) => {
    setStatuses((prev) => ({ ...prev, [key]: value }));
    setSaveSuccess(false);
    setSaveError(false);
  };

  const handleCheckboxChange = (key: string, checked: boolean) => {
    if (checked) {
      setStatuses((prev) => ({ ...prev, [key]: getTodayDate() }));
      setCheckedKeys((prev) => ({ ...prev, [key]: true }));
    } else {
      setStatuses((prev) => ({ ...prev, [key]: "" }));
      setCheckedKeys((prev) => ({ ...prev, [key]: false }));
    }
    setSaveSuccess(false);
    setSaveError(false);
  };

  const handleSave = async () => {
    if (!order || !searchedId) return;
    setSaveSuccess(false);
    setSaveError(false);
    try {
      await upsertOrder.mutateAsync({
        orderId: searchedId,
        ...statuses,
      } as OrderStatus);
      toast.success(`Order "${searchedId}" updated successfully!`);
      setSaveSuccess(true);
      setSaveError(false);
    } catch {
      toast.error("Failed to save order. Please try again.");
      setSaveSuccess(false);
      setSaveError(true);
    }
  };

  const orderNotFound = searchedId && !isSearching && !order;
  const orderFound = searchedId && !isSearching && order;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between animate-slide-up">
        <div>
          <h2 className="font-display text-3xl font-bold text-foreground tracking-tight">
            Update Order Status
          </h2>
          <p className="text-muted-foreground mt-1">
            Search for an existing order to update its status fields.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-xs font-medium px-3 py-1">
            Logged in as: {username}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            data-ocid="admin.secondary_button"
            className="gap-2 text-muted-foreground"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </Button>
        </div>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" />
            <CardTitle className="text-base font-semibold">
              Find Order
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Enter the Order ID to look up an existing order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="e.g. ORD-2024-001"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              data-ocid="bo.search_input"
              className="font-mono flex-1"
            />
            <Button
              onClick={handleSearch}
              disabled={!searchInput.trim() || isSearching}
              data-ocid="bo.primary_button"
              className="gap-2 font-semibold shrink-0"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching…
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Find Order
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isSearching && (
        <div
          data-ocid="bo.loading_state"
          className="flex items-center justify-center gap-3 py-12"
        >
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Searching…</p>
        </div>
      )}

      {!isSearching && (!searchedId || orderNotFound) && (
        <div
          data-ocid="bo.empty_state"
          className="flex flex-col items-center gap-3 py-14 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Search className="w-7 h-7 text-muted-foreground" />
          </div>
          {orderNotFound ? (
            <>
              <p className="font-semibold text-foreground">Order not found</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                No order with ID{" "}
                <span className="font-mono font-semibold">{searchedId}</span>{" "}
                exists. Only existing orders can be updated.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-foreground">
                Search for an order
              </p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Only existing orders can be updated. Search for an Order ID to
                begin.
              </p>
            </>
          )}
        </div>
      )}

      {orderFound && (
        <Card className="shadow-sm border-border animate-slide-up">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ClipboardEdit className="w-4 h-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                Editing Order:{" "}
                <span className="font-mono text-primary">{searchedId}</span>
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Check the checkbox to record today&apos;s date for a status, or
              type a value manually. Grayed-out fields are read-only for your
              account. Click Save Changes when done.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeConfigs.map((cfg, i) => {
                const editable = isFieldEditable(cfg.key);
                return (
                  <div
                    key={cfg.key}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                      editable
                        ? "border-border bg-muted/30 hover:bg-muted/50"
                        : "border-border/50 bg-muted/10 opacity-60"
                    }`}
                  >
                    {editable ? (
                      <Checkbox
                        id={`bo-checkbox-${cfg.key}`}
                        checked={checkedKeys[cfg.key] ?? false}
                        onCheckedChange={(checked) =>
                          handleCheckboxChange(cfg.key, !!checked)
                        }
                        data-ocid={`bo.checkbox.${i + 1}`}
                        className="shrink-0"
                      />
                    ) : (
                      <div className="w-4 h-4 shrink-0" />
                    )}
                    <Label
                      htmlFor={`bo-checkbox-${cfg.key}`}
                      className={`text-xs font-semibold uppercase tracking-wide min-w-[90px] shrink-0 ${
                        editable
                          ? "text-muted-foreground cursor-pointer"
                          : "text-muted-foreground/60"
                      }`}
                    >
                      {cfg.label}
                      {!editable && (
                        <span className="ml-1 text-[10px] normal-case tracking-normal">
                          (read-only)
                        </span>
                      )}
                    </Label>
                    <Input
                      id={`bo-${cfg.key}`}
                      placeholder={
                        checkedKeys[cfg.key] ? "" : `Enter ${cfg.label}`
                      }
                      value={statuses[cfg.key] ?? ""}
                      onChange={(e) =>
                        handleStatusChange(cfg.key, e.target.value)
                      }
                      disabled={checkedKeys[cfg.key] || !editable}
                      data-ocid={`bo.${cfg.key}_input`}
                      className="flex-1 h-8 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                    />
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Tip:</span> Checking a box
              automatically sets today&apos;s date (
              <span className="font-mono">{getTodayDate()}</span>) for that
              status. Uncheck to clear and type manually.
            </p>

            {saveSuccess && (
              <div
                data-ocid="bo.success_state"
                className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 animate-fade-in"
              >
                <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                <p className="text-sm font-medium text-green-700">
                  Order updated successfully!
                </p>
              </div>
            )}

            {saveError && (
              <div
                data-ocid="bo.error_state"
                className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 animate-fade-in"
              >
                <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                <p className="text-sm font-medium text-destructive">
                  Failed to save order. Please try again.
                </p>
              </div>
            )}

            <div className="pt-1">
              <Button
                onClick={() => void handleSave()}
                disabled={upsertOrder.isPending}
                data-ocid="bo.save_button"
                className="gap-2 font-semibold"
              >
                {upsertOrder.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Login Form ───────────────────────────────────────────────────────────────

interface LoginFormProps {
  onLogin: (username: string) => void;
}

function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { validateLogin } = useAppConfig();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(false);

    await new Promise((r) => setTimeout(r, 300));

    const user = validateLogin(username, password);
    if (user) {
      onLogin(username);
    } else {
      setError(true);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="max-w-md mx-auto">
      <Card className="shadow-sm border-border animate-slide-up">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="font-display text-2xl font-bold">
            Admin Panel
          </CardTitle>
          <CardDescription>
            Sign in with your admin credentials to manage orders and users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-username" className="text-sm font-medium">
                Admin ID
              </Label>
              <Input
                id="admin-username"
                type="text"
                placeholder="Enter admin ID"
                value={username}
                autoComplete="username"
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError(false);
                }}
                required
                data-ocid="admin.login_input"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="Enter password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(false);
                }}
                required
                data-ocid="admin.password_input"
              />
            </div>

            {error && (
              <div
                data-ocid="admin.login_error_state"
                className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 animate-fade-in"
              >
                <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                <p className="text-sm font-medium text-destructive">
                  Invalid credentials. Please try again.
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              data-ocid="admin.login_button"
              className="w-full gap-2 font-semibold"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Admin Panel (after login) ────────────────────────────────────────────────

interface AdminPanelProps {
  onLogout: () => void;
  isMasterAdmin?: boolean;
  username?: string;
}

function AdminPanel({
  onLogout,
  isMasterAdmin = false,
  username,
}: AdminPanelProps) {
  const { data: isAdmin, isFetching: isCheckingAdmin } = useIsAdmin();
  const { isInitializing } = useInternetIdentity();

  const hasAccess = isMasterAdmin || isAdmin === true;

  if (!isMasterAdmin && (isInitializing || isCheckingAdmin)) {
    return (
      <div
        data-ocid="admin.loading_state"
        className="flex flex-col items-center gap-4 py-20"
      >
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verifying admin access…</p>
      </div>
    );
  }

  if (!hasAccess && isAdmin === false) {
    return (
      <div className="max-w-md mx-auto">
        <Card className="shadow-sm border-border">
          <CardContent className="flex flex-col items-center gap-5 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-1">
                Access Restricted
              </h2>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                Your account does not have admin privileges on the backend.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={onLogout}
              data-ocid="admin.secondary_button"
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between animate-slide-up">
        <div>
          <h2 className="font-display text-3xl font-bold text-foreground tracking-tight">
            Admin Panel
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage orders, upload Excel files, and control user access
          </p>
        </div>
        <div className="flex items-center gap-3">
          {username && (
            <Badge
              variant="secondary"
              className="text-xs font-medium px-3 py-1"
            >
              Logged in as: {username}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            data-ocid="admin.secondary_button"
            className="gap-2 text-muted-foreground"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </Button>
        </div>
      </div>

      <Tabs defaultValue="upload">
        <TabsList className="bg-secondary border border-border rounded-xl p-1 gap-1 h-auto mb-6 flex-wrap">
          <TabsTrigger
            value="upload"
            data-ocid="admin.upload_tab"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Upload Excel
          </TabsTrigger>
          <TabsTrigger
            value="manual"
            data-ocid="admin.manual_entry_tab"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            <ClipboardEdit className="w-4 h-4" />
            Manual Entry
          </TabsTrigger>
          <TabsTrigger
            value="status-fields"
            data-ocid="admin.status_fields_tab"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            <Settings className="w-4 h-4" />
            Status Fields
          </TabsTrigger>
          <TabsTrigger
            value="groups"
            data-ocid="admin.groups_tab"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            <Layers className="w-4 h-4" />
            Groups
          </TabsTrigger>
          <TabsTrigger
            value="users"
            data-ocid="admin.users_tab"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            <UserCog className="w-4 h-4" />
            User Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-0 space-y-8">
          <UploadInterface />
          <Separator />
          <AllOrdersTable />
        </TabsContent>

        <TabsContent value="manual" className="mt-0 space-y-8">
          <ManualEntryForm />
          <Separator />
          <AllOrdersTable />
        </TabsContent>

        <TabsContent value="status-fields" className="mt-0">
          <StatusFieldsManager />
        </TabsContent>

        <TabsContent value="groups" className="mt-0">
          <GroupPermissionsManager />
        </TabsContent>

        <TabsContent value="users" className="mt-0">
          <UserManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function AdminUpload() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<string>("");
  const { isInitializing } = useInternetIdentity();
  const { localUsers } = useAppConfig();

  const handleLogin = (username: string) => {
    setIsLoggedIn(true);
    setLoggedInUser(username);
    sessionStorage.setItem("loggedInUser", username);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoggedInUser("");
    sessionStorage.removeItem("loggedInUser");
  };

  if (isInitializing && !isLoggedIn) {
    return (
      <div className="max-w-md mx-auto">
        <div
          data-ocid="admin.loading_state"
          className="flex flex-col items-center gap-4 py-20"
        >
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Initializing…</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginForm onLogin={handleLogin} />;
  }

  // Any non-admin user (role === "user") gets the restricted BOPanel
  const currentUser = localUsers.find((u) => u.username === loggedInUser);
  const isAdmin =
    loggedInUser === ADMIN_USERNAME || currentUser?.role === "admin";

  if (!isAdmin) {
    return <BOPanel onLogout={handleLogout} username={loggedInUser} />;
  }

  return (
    <AdminPanel
      onLogout={handleLogout}
      isMasterAdmin={loggedInUser === ADMIN_USERNAME}
      username={loggedInUser}
    />
  );
}
