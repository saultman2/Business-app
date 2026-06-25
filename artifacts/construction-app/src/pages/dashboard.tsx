import React from "react";
import { useGetDashboardSummary, useListEstimates, useListInvoices } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Search, Plus, FileText, CheckCircle2, Clock, AlertCircle, List } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

function StatCard({ label, count, amount, color, icon }: { label: string; count: number; amount: number; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 cursor-pointer hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-2 mb-2 text-muted-foreground text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-3xl font-bold text-foreground">{count}</div>
      <div className="text-sm text-muted-foreground mt-0.5">{formatCurrency(amount)}</div>
    </div>
  );
}

type TableTab = "estimates" | "invoices";

function estimateStatusBadge(status: string) {
  switch (status) {
    case "draft": return <Badge variant="secondary" className="text-xs">Draft</Badge>;
    case "sent": return <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">Est. Sent</Badge>;
    case "approved": return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Approved</Badge>;
    case "declined": return <Badge variant="destructive" className="text-xs">Declined</Badge>;
    default: return <Badge variant="outline" className="text-xs capitalize">{status}</Badge>;
  }
}

function invoiceStatusBadge(status: string) {
  switch (status) {
    case "paid": return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Paid</Badge>;
    case "unpaid": return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs">Pending</Badge>;
    case "overdue": return <Badge variant="destructive" className="text-xs">Overdue</Badge>;
    default: return <Badge variant="outline" className="text-xs capitalize">{status}</Badge>;
  }
}

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: estimates } = useListEstimates({});
  const { data: invoices } = useListInvoices({});
  const [tab, setTab] = useState<TableTab>("estimates");
  const [search, setSearch] = useState("");

  const draftEstimates = estimates?.filter(e => e.status === "draft") ?? [];
  const sentEstimates = estimates?.filter(e => e.status === "sent") ?? [];
  const approvedEstimates = estimates?.filter(e => e.status === "approved") ?? [];
  const allEstimates = estimates ?? [];

  const pendingInvoices = invoices?.filter(i => i.status === "unpaid") ?? [];
  const paidInvoices = invoices?.filter(i => i.status === "paid") ?? [];
  const overdueInvoices = invoices?.filter(i => i.status === "overdue") ?? [];
  const allInvoices = invoices ?? [];

  const sumAmount = (items: { total?: number; totalAmount?: number }[]) =>
    items.reduce((s, i) => s + (("total" in i ? i.total as number : 0) || ("totalAmount" in i ? i.totalAmount as number : 0) || 0), 0);

  const filteredEstimates = allEstimates.filter(e =>
    !search || e.title.toLowerCase().includes(search.toLowerCase()) ||
    (e.clientName || "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredInvoices = allInvoices.filter(i =>
    !search || (i.invoiceNumber || "").toLowerCase().includes(search.toLowerCase()) ||
    (i.clientName || "").toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search estimates and invoices"
            className="pl-9 bg-white"
          />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/invoices">New Invoice</Link>
          </Button>
          <Button asChild className="bg-[#2563eb] hover:bg-[#1d4ed8]">
            <Link href="/quotes">New Estimate</Link>
          </Button>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Estimates</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Draft" count={draftEstimates.length} amount={sumAmount(draftEstimates)}
            icon={<FileText className="w-4 h-4" />} />
          <StatCard label="Sent" count={sentEstimates.length} amount={sumAmount(sentEstimates)}
            color="orange" icon={<Clock className="w-4 h-4" />} />
          <StatCard label="Approved" count={approvedEstimates.length} amount={sumAmount(approvedEstimates)}
            color="green" icon={<CheckCircle2 className="w-4 h-4" />} />
          <StatCard label="All" count={allEstimates.length} amount={sumAmount(allEstimates)}
            icon={<List className="w-4 h-4" />} />
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-3">Invoices</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Pending" count={pendingInvoices.length} amount={sumAmount(pendingInvoices)}
            icon={<Clock className="w-4 h-4" />} />
          <StatCard label="Paid" count={paidInvoices.length} amount={sumAmount(paidInvoices)}
            color="green" icon={<CheckCircle2 className="w-4 h-4" />} />
          <StatCard label="Overdue" count={overdueInvoices.length} amount={sumAmount(overdueInvoices)}
            color="red" icon={<AlertCircle className="w-4 h-4" />} />
          <StatCard label="All" count={allInvoices.length} amount={sumAmount(allInvoices)}
            icon={<List className="w-4 h-4" />} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="flex border-b">
          <button
            onClick={() => setTab("estimates")}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${tab === "estimates" ? "border-[#2563eb] text-[#2563eb]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            ESTIMATES
          </button>
          <button
            onClick={() => setTab("invoices")}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${tab === "invoices" ? "border-[#2563eb] text-[#2563eb]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            INVOICES
          </button>
        </div>

        {tab === "estimates" && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Name</th>
                <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Client</th>
                <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Amount</th>
                <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Modified</th>
                <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredEstimates.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground text-sm">No estimates yet</td></tr>
              ) : filteredEstimates.map(est => (
                <tr key={est.id} className="hover:bg-muted/10 cursor-pointer" onClick={() => est.jobId && (window.location.href = `/jobs/${est.jobId}/estimate`)}>
                  <td className="px-4 py-3 font-medium">{est.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{est.clientName || "Not Assigned"}</td>
                  <td className="px-4 py-3">{formatCurrency(est.total)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(est.createdAt)}</td>
                  <td className="px-4 py-3">{estimateStatusBadge(est.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "invoices" && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Invoice</th>
                <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Client</th>
                <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Amount</th>
                <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Due Date</th>
                <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredInvoices.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground text-sm">No invoices yet</td></tr>
              ) : filteredInvoices.map(inv => (
                <tr key={inv.id} className="hover:bg-muted/10 cursor-pointer" onClick={() => window.location.href = `/invoices/${inv.id}`}>
                  <td className="px-4 py-3 font-medium">{inv.invoiceNumber || `INV-${inv.id}`}</td>
                  <td className="px-4 py-3 text-muted-foreground">{inv.clientName || "Not Assigned"}</td>
                  <td className="px-4 py-3">{formatCurrency(inv.totalAmount)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-3">{invoiceStatusBadge(inv.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
