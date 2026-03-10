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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Edit2,
  Loader2,
  Save,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { OrderStatus } from "../backend.d";
import { useAppConfig } from "../hooks/useAppConfig";
import { useGetAllOrders, useUpsertOrder } from "../hooks/useQueries";

interface MyTasksProps {
  username: string;
}

export function MyTasks({ username }: MyTasksProps) {
  const { data: allOrders, isFetching, isError } = useGetAllOrders();
  const { activeStatusConfigs, getUserPermission } = useAppConfig();
  const upsertOrder = useUpsertOrder();

  // Which order is currently being edited
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  // Draft field values for the order being edited
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  // Get the list of status keys this user can edit
  const editableKeys: string[] | null = useMemo(
    () => getUserPermission(username),
    [getUserPermission, username],
  );

  // Filter to only active configs that this user can edit
  const editableConfigs = useMemo(() => {
    if (editableKeys === null) return activeStatusConfigs;
    return activeStatusConfigs.filter((cfg) => editableKeys.includes(cfg.key));
  }, [activeStatusConfigs, editableKeys]);

  // Find orders where at least one of the user's editable fields is blank
  const pendingOrders = useMemo(() => {
    if (!allOrders || editableConfigs.length === 0) return [];
    return allOrders.filter((order) =>
      editableConfigs.some((cfg) => {
        const val = (order[cfg.key as keyof OrderStatus] as string) ?? "";
        return val.trim() === "";
      }),
    );
  }, [allOrders, editableConfigs]);

  const pendingWithBlanks = useMemo(
    () =>
      pendingOrders.map((order) => ({
        order,
        blankFields: editableConfigs.filter((cfg) => {
          const val = (order[cfg.key as keyof OrderStatus] as string) ?? "";
          return val.trim() === "";
        }),
      })),
    [pendingOrders, editableConfigs],
  );

  const hasNoEditableFields = editableConfigs.length === 0;

  // Open edit mode for an order
  const handleEdit = (order: OrderStatus) => {
    const draft: Record<string, string> = {};
    for (const cfg of editableConfigs) {
      draft[cfg.key] = (order[cfg.key as keyof OrderStatus] as string) ?? "";
    }
    setEditValues(draft);
    setEditingOrderId(order.orderId);
  };

  const handleCancel = () => {
    setEditingOrderId(null);
    setEditValues({});
  };

  const handleSave = async (order: OrderStatus) => {
    const updated: OrderStatus = { ...order };
    for (const cfg of editableConfigs) {
      (updated as unknown as Record<string, string>)[cfg.key] =
        editValues[cfg.key] ?? "";
    }
    try {
      await upsertOrder.mutateAsync(updated);
      toast.success(`Order ${order.orderId} saved successfully`);
      setEditingOrderId(null);
      setEditValues({});
    } catch {
      toast.error("Failed to save. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header info */}
      <Card className="border-accent/30 bg-accent/10 shadow-none">
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-2">
            <ClipboardList className="w-4 h-4 text-accent-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-accent-foreground font-medium">
              These are orders where one or more of your assigned status fields
              are still blank. Click Edit to fill them in.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <ClipboardList className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base font-semibold">
              Pending Tasks
            </CardTitle>
            {!isFetching && !isError && (
              <Badge
                variant={
                  pendingWithBlanks.length === 0 ? "secondary" : "destructive"
                }
                className="text-xs"
              >
                {pendingWithBlanks.length} order
                {pendingWithBlanks.length !== 1 ? "s" : ""} pending
              </Badge>
            )}
          </div>
          {editableConfigs.length > 0 && (
            <CardDescription className="text-xs">
              Your editable fields:{" "}
              {editableConfigs.map((c) => c.label).join(", ")}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="pt-0">
          {/* Loading */}
          {isFetching && (
            <div data-ocid="mytasks.loading_state" className="space-y-2">
              {["sk1", "sk2", "sk3"].map((k) => (
                <Skeleton key={k} className="h-10 rounded-lg" />
              ))}
            </div>
          )}

          {/* Error */}
          {isError && !isFetching && (
            <div
              data-ocid="mytasks.error_state"
              className="flex items-center gap-2 py-6 text-center justify-center text-destructive"
            >
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">Failed to load orders</span>
            </div>
          )}

          {/* No editable fields assigned */}
          {!isFetching && !isError && hasNoEditableFields && (
            <div
              data-ocid="mytasks.empty_state"
              className="flex flex-col items-center gap-3 py-12 text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <ClipboardList className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">
                  No fields assigned
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ask your admin to assign status fields to your group or
                  account.
                </p>
              </div>
            </div>
          )}

          {/* All done */}
          {!isFetching &&
            !isError &&
            !hasNoEditableFields &&
            pendingWithBlanks.length === 0 && (
              <div
                data-ocid="mytasks.empty_state"
                className="flex flex-col items-center gap-3 py-12 text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">
                    All caught up!
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    No orders have blank fields in your editable columns.
                  </p>
                </div>
              </div>
            )}

          {/* Pending orders table */}
          {!isFetching &&
            !isError &&
            !hasNoEditableFields &&
            pendingWithBlanks.length > 0 && (
              <div
                className="overflow-x-auto rounded-lg border border-border"
                data-ocid="mytasks.table"
              >
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">
                        Order ID
                      </TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">
                        Blank Fields
                      </TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingWithBlanks.map(({ order, blankFields }, idx) => (
                      <>
                        {/* Summary row */}
                        <TableRow
                          key={`row-${order.orderId}`}
                          data-ocid={`mytasks.row.${idx + 1}`}
                          className="hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() =>
                            editingOrderId === order.orderId
                              ? handleCancel()
                              : handleEdit(order)
                          }
                        >
                          <TableCell className="font-mono text-sm font-semibold text-foreground">
                            {order.orderId}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {blankFields.map((cfg) => (
                                <Badge
                                  key={cfg.key}
                                  variant="outline"
                                  className="text-xs text-destructive border-destructive/40 bg-destructive/5"
                                >
                                  {cfg.label}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              data-ocid={`mytasks.edit_button.${idx + 1}`}
                              className="h-7 gap-1.5 text-xs font-medium"
                              onClick={(e) => {
                                e.stopPropagation();
                                editingOrderId === order.orderId
                                  ? handleCancel()
                                  : handleEdit(order);
                              }}
                            >
                              {editingOrderId === order.orderId ? (
                                <>
                                  <X className="w-3.5 h-3.5" />
                                  Cancel
                                </>
                              ) : (
                                <>
                                  <Edit2 className="w-3.5 h-3.5" />
                                  Edit
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>

                        {/* Inline edit row */}
                        {editingOrderId === order.orderId && (
                          <TableRow
                            key={`edit-${order.orderId}`}
                            className="bg-muted/20"
                          >
                            <TableCell colSpan={3} className="py-4 px-4">
                              <div className="space-y-4">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  Editing: {order.orderId}
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {editableConfigs.map((cfg) => (
                                    <div key={cfg.key} className="space-y-1.5">
                                      <Label
                                        htmlFor={`edit-${cfg.key}`}
                                        className="text-xs font-medium"
                                      >
                                        {cfg.label}
                                        {blankFields.some(
                                          (b) => b.key === cfg.key,
                                        ) && (
                                          <span className="ml-1 text-destructive">
                                            *
                                          </span>
                                        )}
                                      </Label>
                                      <Input
                                        id={`edit-${cfg.key}`}
                                        data-ocid={`mytasks.${cfg.key}.input`}
                                        value={editValues[cfg.key] ?? ""}
                                        onChange={(e) =>
                                          setEditValues((prev) => ({
                                            ...prev,
                                            [cfg.key]: e.target.value,
                                          }))
                                        }
                                        placeholder={`Enter ${cfg.label}`}
                                        className="h-8 text-sm"
                                      />
                                    </div>
                                  ))}
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancel}
                                    data-ocid="mytasks.cancel_button"
                                    className="h-8 gap-1.5 text-xs"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleSave(order)}
                                    disabled={upsertOrder.isPending}
                                    data-ocid="mytasks.save_button"
                                    className="h-8 gap-1.5 text-xs"
                                  >
                                    {upsertOrder.isPending ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Save className="w-3.5 h-3.5" />
                                    )}
                                    Save
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
