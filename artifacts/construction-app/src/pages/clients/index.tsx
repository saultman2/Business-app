import { useState, useMemo } from "react";
import { useListClients, useCreateClient, getListClientsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, User, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SortKey = "name" | "jobCount";
type SortDir = "asc" | "desc";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  material_list: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  estimate: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  estimate_sent: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  approved: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  finished: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  invoiced: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className={cn("inline-block px-2 py-0.5 rounded text-xs font-medium capitalize", STATUS_COLORS[status] ?? STATUS_COLORS.new)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
  return sortDir === "asc"
    ? <ChevronUp className="h-3.5 w-3.5 text-primary" />
    : <ChevronDown className="h-3.5 w-3.5 text-primary" />;
}

const defaultForm = {
  name: "", email: "", phone: "", address: "", city: "", state: "", zipCode: "", notes: "",
};

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState(defaultForm);

  const { data: clients, isLoading } = useListClients({});
  const createClient = useCreateClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createClient.mutate({ data: formData }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
        toast({ title: "Client created successfully" });
        setIsCreateOpen(false);
        setFormData(defaultForm);
      },
      onError: () => {
        toast({ title: "Error creating client", variant: "destructive" });
      },
    });
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    if (!clients) return [];
    const q = search.toLowerCase();
    return clients.filter(c =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q) ||
      (c.address ?? "").toLowerCase().includes(q) ||
      (c.city ?? "").toLowerCase().includes(q)
    );
  }, [clients, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "jobCount") cmp = (a.jobCount ?? 0) - (b.jobCount ?? 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">Your full book of business.</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name or Company *</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" value={formData.address} onChange={handleChange} />
              </div>
              <div className="grid grid-cols-6 gap-4">
                <div className="col-span-3 space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" name="city" value={formData.city} onChange={handleChange} />
                </div>
                <div className="col-span-1 space-y-2">
                  <Label htmlFor="state">ST</Label>
                  <Input id="state" name="state" value={formData.state} onChange={handleChange} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="zipCode">ZIP</Label>
                  <Input id="zipCode" name="zipCode" value={formData.zipCode} onChange={handleChange} />
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={createClient.isPending}>
                  {createClient.isPending ? "Creating…" : "Create Client"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, city…"
            className="pl-9 bg-background"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {sorted.length} result{sorted.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Table / states */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : !clients || clients.length === 0 ? (
        <div className="text-center py-16 px-6 border border-dashed rounded-xl bg-card">
          <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No clients yet</h2>
          <p className="text-muted-foreground max-w-sm mx-auto mb-6">
            Add your first client to start tracking jobs and revenue.
          </p>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Client
          </Button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No clients match <span className="font-medium">"{search}"</span>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                    <button
                      type="button"
                      className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                      onClick={() => toggleSort("name")}
                    >
                      Name
                      <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground hidden sm:table-cell">
                    Phone
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground hidden md:table-cell">
                    Location
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground hidden lg:table-cell">
                    Latest Status
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-muted-foreground">
                    <button
                      type="button"
                      className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                      onClick={() => toggleSort("jobCount")}
                    >
                      Jobs
                      <SortIcon col="jobCount" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  {/* Arrow column */}
                  <th className="w-8 py-3 px-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map(client => (
                  <Link key={client.id} href={`/clients/${client.id}`} asChild>
                    <tr
                      className="hover:bg-muted/30 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{client.name}</div>
                        {client.email && (
                          <div className="text-xs text-muted-foreground mt-0.5 hidden sm:block">{client.email}</div>
                        )}
                        {/* Show phone + location inline on mobile */}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 sm:hidden">
                          {client.phone && <span className="text-xs text-muted-foreground">{client.phone}</span>}
                          {(client.city || client.state) && (
                            <span className="text-xs text-muted-foreground">
                              {[client.city, client.state].filter(Boolean).join(", ")}
                            </span>
                          )}
                          {client.latestJobStatus && (
                            <StatusBadge status={client.latestJobStatus} />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell">
                        {client.phone || <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">
                        {[client.city, client.state].filter(Boolean).join(", ") || (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <StatusBadge status={client.latestJobStatus} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={cn(
                          "font-semibold tabular-nums",
                          (client.jobCount ?? 0) > 0 ? "text-foreground" : "text-muted-foreground/50"
                        )}>
                          {client.jobCount ?? 0}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors text-center">
                        ›
                      </td>
                    </tr>
                  </Link>
                ))}
              </tbody>
            </table>
          </div>
          {sorted.length > 0 && (
            <div className="px-4 py-2 bg-muted/20 border-t text-xs text-muted-foreground">
              {sorted.length} client{sorted.length !== 1 ? "s" : ""}
              {search && ` matching "${search}"`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
