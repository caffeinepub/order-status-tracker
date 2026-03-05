import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, PackageSearch, Search } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";
import { useGetOrder } from "../hooks/useQueries";

const STATUS_LABELS: {
  key: keyof import("../backend.d").OrderStatus;
  label: string;
}[] = [
  { key: "status1", label: "Name" },
  { key: "status2", label: "Date of Order ID" },
  { key: "status3", label: "Payment" },
  { key: "status4", label: "Installation" },
  { key: "status5", label: "File Submission" },
  { key: "status6", label: "Meter" },
  { key: "status7", label: "Internet" },
  { key: "status8", label: "Subsidy" },
  { key: "status9", label: "Warranty File" },
  { key: "status10", label: "Any Pendency" },
];

function StatusBadge({ value }: { value: string }) {
  const isEmpty = !value || value.trim() === "" || value.trim() === "-";
  if (isEmpty) {
    return (
      <span className="inline-flex items-center text-xs text-muted-foreground italic px-2 py-0.5 rounded-md bg-muted">
        Not set
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
      <CheckCircle2 className="w-3.5 h-3.5 text-[oklch(var(--status-done))]" />
      {value}
    </span>
  );
}

function OrderCard({
  orderId,
  statuses,
}: { orderId: string; statuses: import("../backend.d").OrderStatus }) {
  return (
    <div className="animate-scale-in" data-ocid="search.success_state">
      <Card className="overflow-hidden shadow-sm border-border">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary border-b border-border pb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">
                Order ID
              </p>
              <CardTitle className="font-display text-2xl text-foreground">
                {orderId}
              </CardTitle>
            </div>
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold px-3 py-1"
            >
              10 Status Fields
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-5 pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {STATUS_LABELS.map(({ key, label }, idx) => (
              <div
                key={key}
                className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 hover:bg-muted/70 transition-colors"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[72px]">
                  {label}
                </span>
                <div className="text-right flex-1 overflow-hidden">
                  <StatusBadge value={statuses[key] as string} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div data-ocid="search.loading_state" className="animate-fade-in">
      <Card className="overflow-hidden shadow-sm border-border">
        <CardHeader className="bg-muted/30 border-b border-border pb-4">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent className="pt-5 pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"].map(
              (k) => (
                <Skeleton key={k} className="h-12 rounded-lg" />
              ),
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function OrderSearch() {
  const [inputValue, setInputValue] = useState("");
  const [searchedId, setSearchedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    data: order,
    isFetching,
    isError,
    isFetched,
  } = useGetOrder(searchedId);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setSearchedId(trimmed);
  };

  const showNotFound = isFetched && !isFetching && searchedId && order === null;
  const showResult = isFetched && !isFetching && searchedId && order !== null;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Hero section */}
      <div className="text-center mb-10 animate-slide-up">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
          <PackageSearch className="w-7 h-7 text-primary" />
        </div>
        <h1 className="font-display text-4xl font-bold text-foreground mb-2 tracking-tight">
          Track Your Order
        </h1>
        <p className="text-muted-foreground text-lg">
          Enter your order ID to view all 10 status checkpoints
        </p>
      </div>

      {/* Search form */}
      <form
        onSubmit={handleSearch}
        className="animate-slide-up"
        style={{ animationDelay: "80ms" }}
      >
        <div className="flex gap-2 shadow-sm rounded-xl overflow-hidden border border-border bg-card p-1.5">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter Order ID"
            className="flex-1 border-0 shadow-none bg-transparent text-base focus-visible:ring-0 focus-visible:ring-offset-0 h-11 text-foreground placeholder:text-muted-foreground"
            data-ocid="search.search_input"
            autoComplete="off"
            spellCheck={false}
          />
          <Button
            type="submit"
            disabled={!inputValue.trim() || isFetching}
            data-ocid="search.primary_button"
            className="h-11 px-6 rounded-lg font-semibold gap-2"
          >
            <Search className="w-4 h-4" />
            {isFetching ? "Searching…" : "Search"}
          </Button>
        </div>
      </form>

      {/* Results area */}
      <div className="mt-8">
        {isFetching && <LoadingSkeleton />}

        {isError && !isFetching && (
          <div
            data-ocid="search.error_state"
            className="flex flex-col items-center gap-3 py-12 text-center animate-fade-in"
          >
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-base font-semibold text-destructive">
              Failed to fetch order
            </p>
            <p className="text-sm text-muted-foreground">
              Please try again or check your connection.
            </p>
          </div>
        )}

        {showNotFound && (
          <div
            data-ocid="search.empty_state"
            className="flex flex-col items-center gap-4 py-14 text-center animate-fade-in"
          >
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <PackageSearch className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                Order not found
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                No order with ID{" "}
                <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground font-medium">
                  {searchedId}
                </code>{" "}
                exists in the system.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchedId(null);
                setInputValue("");
                inputRef.current?.focus();
              }}
            >
              Try another ID
            </Button>
          </div>
        )}

        {showResult && order && (
          <OrderCard orderId={order.orderId} statuses={order} />
        )}
      </div>
    </div>
  );
}
