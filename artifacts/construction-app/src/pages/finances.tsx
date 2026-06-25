import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useListEstimates, useListInvoices } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { FileText, Receipt, DollarSign, Wallet, Plus, Zap, Banknote } from "lucide-react";

type Tab = "estimates" | "invoices" | "payments" | "expenses";

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: "estimates", label: "Estimates", icon: FileText },
  { id: "invoices", label: "Invoices", icon: Receipt },
  { id: "payments", label: "Payments", icon: Banknote },
  { id: "expenses", label: "Expenses", icon: Wallet },
];

function estimateBadge(status: string) {
  switch (status) {
    case "approved": return <Badge className="bg-green-100 text-green-700 border-green-200">Approved</Badge>;
    case "sent": return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Sent</Badge>;
    case "declined": return <Badge variant="destructive">Declined</Badge>;
    default: return <Badge variant="secondary" className="capitalize">{status}</Badge>;
  }
}

function invoiceBadge(status: string) {
  switch (status) {
    case "paid": return <Badge className="bg-green-100 text-green-700 border-green-200">Paid</Badge>;
    case "partial": return <Badge className="bg-sky-100 text-sky-700 border-sky-200">Partial</Badge>;
    case "overdue": return <Badge variant="destructive">Overdue</Badge>;
    default: return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Unpaid</Badge>;
  }
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1.5 tabular-nums ${accent ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, body, action }: { icon: typeof FileText; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-16 px-6 border border-dashed rounded-xl bg-card">
      <div className="bg-primary/10 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4">
        <Icon className="h-7 w-7 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-1.5">{title}</h3>
      <p className="text-muted-foreground max-w-sm mx-auto mb-5 text-sm">{body}</p>
      {action}
    </div>
  );
}

export default function FinancesPage() {
  const [tab, setTab] = useState<Tab>("estimates");
  const { data: estimates, isLoading: loadingEst } = useListEstimates({});
  const { data: invoices, isLoading: loadingInv } = useListInvoices({});

  const payments = useMemo(
    () => (invoices ?? []).filter((i) => (i.amountPaid ?? 0) > 0),
    [invoices]
  );

  const totals = useMemo(() => {
    const collected = (invoices ?? []).reduce((s, i) => s + (i.amountPaid ?? 0), 0);
    const outstanding = (invoices ?? []).reduce((s, i) => s + (i.balanceDue ?? 0), 0);
    const pipeline = (estimates ?? [])
      .filter((e) => e.status !== "declined")
      .reduce((s, e) => s + (e.total ?? 0), 0);
    return { collected, outstanding, pipeline };
  }, [invoices, estimates]);

  const isLoading = loadingEst || loadingInv;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finances</h1>
          <p className="text-muted-foreground mt-1">Estimates, invoices and payments in one place.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/quotes"><Zap className="w-4 h-4" /> New Estimate</Link>
          </Button>
          <Button asChild>
            <Link href="/invoices/new"><Plus className="w-4 h-4" /> New Invoice</Link>
          </Button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile label="Collected" value={formatCurrency(totals.collected)} accent="text-emerald-600" />
        <StatTile label="Outstanding" value={formatCurrency(totals.outstanding)} accent="text-rose-600" />
        <StatTile label="Estimate Pipeline" value={formatCurrency(totals.pipeline)} accent="text-amber-600" />
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
      ) : (
        <>
          {tab === "estimates" && (
            estimates && estimates.length > 0 ? (
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b">
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Title</th>
                      <th className="px-4 py-2.5 font-medium">Client</th>
                      <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                      <th className="px-4 py-2.5 font-medium">Date</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {estimates.map((e) => (
                      <tr key={e.id} className="hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => e.jobId && (window.location.href = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/jobs/${e.jobId}/estimate`)}>
                        <td className="px-4 py-3 font-medium">{e.title}</td>
                        <td className="px-4 py-3 text-muted-foreground">{e.clientName || "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(e.total)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(e.createdAt)}</td>
                        <td className="px-4 py-3">{estimateBadge(e.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={FileText} title="No estimates yet"
                body="Generate a professional estimate in minutes with Quick Quote."
                action={<Button asChild><Link href="/quotes"><Zap className="w-4 h-4" /> New Estimate</Link></Button>} />
            )
          )}

          {tab === "invoices" && (
            invoices && invoices.length > 0 ? (
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b">
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Invoice</th>
                      <th className="px-4 py-2.5 font-medium">Client</th>
                      <th className="px-4 py-2.5 font-medium text-right">Total</th>
                      <th className="px-4 py-2.5 font-medium text-right">Balance</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoices.map((i) => (
                      <tr key={i.id} className="hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => (window.location.href = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/invoices/${i.id}`)}>
                        <td className="px-4 py-3 font-medium">{i.invoiceNumber || `INV-${i.id}`}</td>
                        <td className="px-4 py-3 text-muted-foreground">{i.clientName || "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(i.totalAmount)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(i.balanceDue)}</td>
                        <td className="px-4 py-3">{invoiceBadge(i.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={Receipt} title="No invoices yet"
                body="Bill your clients and track payments by creating an invoice."
                action={<Button asChild><Link href="/invoices/new"><Plus className="w-4 h-4" /> New Invoice</Link></Button>} />
            )
          )}

          {tab === "payments" && (
            payments.length > 0 ? (
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b">
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Invoice</th>
                      <th className="px-4 py-2.5 font-medium">Client</th>
                      <th className="px-4 py-2.5 font-medium text-right">Paid</th>
                      <th className="px-4 py-2.5 font-medium text-right">Balance</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {payments.map((i) => (
                      <tr key={i.id} className="hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => (window.location.href = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/invoices/${i.id}`)}>
                        <td className="px-4 py-3 font-medium">{i.invoiceNumber || `INV-${i.id}`}</td>
                        <td className="px-4 py-3 text-muted-foreground">{i.clientName || "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-600 font-medium">{formatCurrency(i.amountPaid)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(i.balanceDue)}</td>
                        <td className="px-4 py-3">{invoiceBadge(i.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={DollarSign} title="No payments recorded"
                body="Payments you record against invoices will appear here." />
            )
          )}

          {tab === "expenses" && (
            <EmptyState icon={Wallet} title="Expense tracking coming soon"
              body="Track materials, subcontractors and overhead against each job. This feature isn't available yet." />
          )}
        </>
      )}
    </div>
  );
}
