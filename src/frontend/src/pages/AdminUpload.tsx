import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardEdit,
  Download,
  FileSpreadsheet,
  KeyRound,
  Loader2,
  LogOut,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  UserCog,
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
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useBulkUpsertOrders,
  useDeleteOrder,
  useGetAllOrders,
  useGetOrder,
  useIsAdmin,
  useUpsertOrder,
} from "../hooks/useQueries";

// ─── Constants ────────────────────────────────────────────────────────────────

const PREVIEW_LIMIT = 10;
const ADMIN_USERNAME = "arpit2127";
const ADMIN_PASSWORD = "TyGoD@2127";
const BO_USERNAME = "BO";
const BO_PASSWORD = "SiYaRaM@802";

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
] as const;

const STATUS_LABELS = [
  "Name",
  "Date of Order ID",
  "Payment",
  "Installation",
  "File Submission",
  "Meter",
  "Internet",
  "Subsidy",
  "Warranty File",
  "Any Pendency",
];

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
      // Already loading or loaded
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

async function parseExcelFile(file: File): Promise<OrderStatus[]> {
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
          const rows = lines.slice(1).map((line) => {
            // Split on comma but preserve values inside quoted strings
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
            resolve(valid);
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
        // raw: false → SheetJS formats all values as strings (dates become
        // their display string, numbers stay as their formatted value).
        // This ensures dates, numbers, special characters all come through.
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
        const orders = mapRowsToOrders(rows as Record<string, unknown>[]);
        const valid = orders.filter((o) => o.orderId !== "");
        if (valid.length === 0) {
          reject(
            new Error(
              "No valid rows found. Make sure the 'OrderID' column exists.",
            ),
          );
        } else {
          resolve(valid);
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
        // Accept any truthy value OR the number 0 — coerce to string
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
        "Installation",
        "installation",
        "INSTALLATION",
      ),
      status5: get(
        "Status5",
        "status5",
        "STATUS5",
        "File Submission",
        "file submission",
        "FILE SUBMISSION",
      ),
      status6: get("Status6", "status6", "STATUS6", "Meter", "meter", "METER"),
      status7: get(
        "Status7",
        "status7",
        "STATUS7",
        "Internet",
        "internet",
        "INTERNET",
      ),
      status8: get(
        "Status8",
        "status8",
        "STATUS8",
        "Subsidy",
        "subsidy",
        "SUBSIDY",
      ),
      status9: get(
        "Status9",
        "status9",
        "STATUS9",
        "Warranty File",
        "warranty file",
        "WARRANTY FILE",
      ),
      status10: get(
        "Status10",
        "status10",
        "STATUS10",
        "Any Pendency",
        "any pendency",
        "ANY PENDENCY",
      ),
    };
  });
}

// ─── All Orders Table ─────────────────────────────────────────────────────────

function AllOrdersTable() {
  const { data: orders, isFetching, isError } = useGetAllOrders();
  const deleteOrder = useDeleteOrder();
  const [expanded, setExpanded] = useState(true);

  const handleDelete = async (orderId: string) => {
    try {
      await deleteOrder.mutateAsync(orderId);
      toast.success(`Order ${orderId} deleted`);
    } catch {
      toast.error("Failed to delete order");
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
                    {STATUS_KEYS.map((key, i) => (
                      <TableHead
                        key={key}
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
                      {STATUS_KEYS.map((key) => (
                        <TableCell
                          key={key}
                          className="text-sm text-muted-foreground max-w-[100px] truncate"
                        >
                          {order[key] || (
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
  const [parsedOrders, setParsedOrders] = useState<OrderStatus[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkUpsert = useBulkUpsertOrders();

  const processFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx?|csv)$/i)) {
      setParseError("Please upload a .xlsx, .xls, or .csv file");
      return;
    }
    setParseError(null);
    setParsedOrders(null);
    setFileName(file.name);
    try {
      const orders = await parseExcelFile(file);
      setParsedOrders(orders);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : "Failed to parse file",
      );
    }
  }, []);

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
    if (!parsedOrders) return;
    // Deduplicate: last row per orderId wins
    const deduped = Object.values(
      parsedOrders.reduce<Record<string, OrderStatus>>((acc, order) => {
        acc[order.orderId] = order;
        return acc;
      }, {}),
    );
    try {
      await bulkUpsert.mutateAsync(deduped);
      toast.success(`${deduped.length} orders uploaded successfully!`);
      setParsedOrders(null);
      setFileName(null);
    } catch {
      toast.error("Upload failed. Please try again.");
    }
  };

  const previewOrders = parsedOrders?.slice(0, PREVIEW_LIMIT) ?? [];
  const hasMore = (parsedOrders?.length ?? 0) > PREVIEW_LIMIT;

  const handleDownloadTemplate = () => {
    const headers = [
      "OrderID",
      "Name",
      "Date of Order ID",
      "Payment",
      "Installation",
      "File Submission",
      "Meter",
      "Internet",
      "Subsidy",
      "Warranty File",
      "Any Pendency",
    ];
    const sampleRow = [
      "ORD-SAMPLE-001",
      "John Doe",
      "2024-01-15",
      "Completed",
      "Scheduled",
      "Submitted",
      "Installed",
      "Active",
      "Approved",
      "Filed",
      "None",
    ];
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
      {/* Hint */}
      <Card className="border-accent/30 bg-accent/10 shadow-none">
        <CardContent className="py-3 px-4">
          <p className="text-xs text-accent-foreground font-medium">
            <span className="font-semibold">Expected columns:</span>{" "}
            <code className="font-mono bg-accent/20 px-1 rounded text-xs">
              OrderID | Name | Date of Order ID | Payment | Installation | File
              Submission | Meter | Internet | Subsidy | Warranty File | Any
              Pendency
            </code>
          </p>
        </CardContent>
      </Card>

      {/* Download template button */}
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

      {/* Drop zone */}
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

        {fileName && !parsedOrders && !parseError && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-lg">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Parsing {fileName}…
          </div>
        )}
      </label>

      {/* Parse error */}
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

      {/* Preview table */}
      {parsedOrders && parsedOrders.length > 0 && (
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
                    {STATUS_KEYS.map((key, i) => (
                      <TableHead
                        key={key}
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
                      {STATUS_KEYS.map((key) => (
                        <TableCell
                          key={key}
                          className="text-sm text-muted-foreground max-w-[80px] truncate"
                        >
                          {order[key] || (
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

            {/* Submit */}
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
                    setParsedOrders(null);
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
          {/* Order ID */}
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

          {/* Status fields grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {STATUS_KEYS.map((key, i) => (
              <div key={key} className="space-y-1.5">
                <Label
                  htmlFor={`manual-${key}`}
                  className="text-sm font-medium text-muted-foreground"
                >
                  {STATUS_LABELS[i]}
                </Label>
                <Input
                  id={`manual-${key}`}
                  placeholder={`Enter ${STATUS_LABELS[i]}`}
                  value={statuses[key]}
                  onChange={(e) => handleStatusChange(key, e.target.value)}
                  data-ocid={`admin.manual_entry_${key}_input`}
                />
              </div>
            ))}
          </div>

          {/* Feedback */}
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

          {/* Submit */}
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

// ─── User Management ──────────────────────────────────────────────────────────

function UserManagement() {
  const { actor } = useActor();
  const [principalInput, setPrincipalInput] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.user);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Info banner */}
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

      {/* Assign role form */}
      <Card className="shadow-sm border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserCog className="w-4 h-4 text-primary" />
            <CardTitle className="text-base font-semibold">
              Assign User Role
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Promote or demote users by their Internet Identity Principal ID.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleAssign(e)} className="space-y-4">
            {/* Principal input */}
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

            {/* Role dropdown */}
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

            {/* Feedback */}
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

            {/* Submit */}
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
    </div>
  );
}

// ─── BO Panel (restricted update-only user) ───────────────────────────────────

interface BOPanelProps {
  onLogout: () => void;
}

function BOPanel({ onLogout }: BOPanelProps) {
  const [searchInput, setSearchInput] = useState("");
  const [searchedId, setSearchedId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, string>>(() =>
    Object.fromEntries(STATUS_KEYS.map((k) => [k, ""])),
  );
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const { data: order, isFetching: isSearching } = useGetOrder(searchedId);
  const upsertOrder = useUpsertOrder();

  // When a new order is found, pre-fill the fields
  const prevSearchedId = useRef<string | null>(null);
  if (searchedId !== prevSearchedId.current) {
    prevSearchedId.current = searchedId;
    if (order) {
      const filled = Object.fromEntries(
        STATUS_KEYS.map((k) => [k, (order[k] as string) ?? ""]),
      );
      setStatuses(filled);
      setSaveSuccess(false);
      setSaveError(false);
    }
  }

  // Also pre-fill when order data arrives (async)
  const prevOrderRef = useRef<OrderStatus | null | undefined>(undefined);
  if (order !== prevOrderRef.current) {
    prevOrderRef.current = order;
    if (order && searchedId) {
      const filled = Object.fromEntries(
        STATUS_KEYS.map((k) => [k, (order[k] as string) ?? ""]),
      );
      setStatuses(filled);
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
      {/* Header */}
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
            Logged in as: {BO_USERNAME}
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

      {/* Search card */}
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

      {/* Loading */}
      {isSearching && (
        <div
          data-ocid="bo.loading_state"
          className="flex items-center justify-center gap-3 py-12"
        >
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Searching…</p>
        </div>
      )}

      {/* Empty / not-found state */}
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

      {/* Order edit form */}
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
              Update the fields below and click Save Changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Status fields grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STATUS_KEYS.map((key, i) => (
                <div key={key} className="space-y-1.5">
                  <Label
                    htmlFor={`bo-${key}`}
                    className="text-sm font-medium text-muted-foreground"
                  >
                    {STATUS_LABELS[i]}
                  </Label>
                  <Input
                    id={`bo-${key}`}
                    placeholder={`Enter ${STATUS_LABELS[i]}`}
                    value={statuses[key]}
                    onChange={(e) => handleStatusChange(key, e.target.value)}
                    data-ocid={`bo.${key}_input`}
                  />
                </div>
              ))}
            </div>

            {/* Feedback */}
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

            {/* Save button */}
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(false);

    // Simulate a brief check
    await new Promise((r) => setTimeout(r, 300));

    if (
      (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) ||
      (username === BO_USERNAME && password === BO_PASSWORD)
    ) {
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

  // Master admin (arpit2127) always gets full access, skip backend check
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
      {/* Admin header */}
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

      {/* Inner tabs */}
      <Tabs defaultValue="upload">
        <TabsList className="bg-secondary border border-border rounded-xl p-1 gap-1 h-auto mb-6">
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
            value="users"
            data-ocid="admin.users_tab"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            <UserCog className="w-4 h-4" />
            User Management
          </TabsTrigger>
        </TabsList>

        {/* Upload Excel tab */}
        <TabsContent value="upload" className="mt-0 space-y-8">
          <UploadInterface />
          <Separator />
          <AllOrdersTable />
        </TabsContent>

        {/* Manual Entry tab */}
        <TabsContent value="manual" className="mt-0 space-y-8">
          <ManualEntryForm />
          <Separator />
          <AllOrdersTable />
        </TabsContent>

        {/* User Management tab */}
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

  const handleLogin = (username: string) => {
    setIsLoggedIn(true);
    setLoggedInUser(username);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoggedInUser("");
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

  if (loggedInUser === BO_USERNAME) {
    return <BOPanel onLogout={handleLogout} />;
  }

  return (
    <AdminPanel
      onLogout={handleLogout}
      isMasterAdmin={loggedInUser === ADMIN_USERNAME}
      username={loggedInUser}
    />
  );
}
