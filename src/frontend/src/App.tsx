import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Search, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { AdminUpload } from "./pages/AdminUpload";
import { OrderSearch } from "./pages/OrderSearch";

export default function App() {
  const [activeTab, setActiveTab] = useState<"search" | "admin">("search");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Package className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold text-foreground tracking-tight">
              OrderTrack
            </span>
          </div>
          <div className="ml-auto" />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "search" | "admin")}
          >
            <TabsList className="mb-8 bg-secondary border border-border rounded-xl p-1 gap-1 h-auto">
              <TabsTrigger
                value="search"
                data-ocid="search.tab"
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Search className="w-4 h-4" />
                Order Search
              </TabsTrigger>
              <TabsTrigger
                value="admin"
                data-ocid="admin.tab"
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <ShieldCheck className="w-4 h-4" />
                Admin Panel
              </TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="animate-fade-in mt-0">
              <OrderSearch onNavigateToAdmin={() => setActiveTab("admin")} />
            </TabsContent>

            <TabsContent value="admin" className="animate-fade-in mt-0">
              <AdminUpload />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 py-5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()}. Built with ♥ using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium"
          >
            caffeine.ai
          </a>
        </div>
      </footer>

      <Toaster richColors position="top-right" />
    </div>
  );
}
