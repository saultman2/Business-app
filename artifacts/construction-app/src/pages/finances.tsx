import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  useListEstimates,
  useListInvoices,
  useGetJobsFinanceSummary,
  useUpdateJob,
  getGetJobsFinanceSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import { FileText, Receipt, DollarSign, Wallet, Plus, Zap, Banknote, HardHat } from "lucide-react";

type Tab = "jobs" | "estimates" | "invoices" | "payments" | "expenses";

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: "jobs", label: "Jobs", icon: HardHat },
  { id: "estimates", label: "Estimates", icon: FileText },
  { id: "invoices", label: "Invoices", icon: Receipt },
  { id: "payments", label: "Payments", icon: Banknote },
  { id: "expenses", label: "Expenses", icon: Wallet },
];

const BILLING_STATUSES = [
  { value: "none", label: "Not Billed" },
  { value: "billed", label: "Billed" },
  { value: "partial", label: "Partial Payment" },
  { value: "paid", label: "Paid in Full" },
];

const DONE_STAGES = new Set(["finished", "invoiced", "paid"]);

function billingStatusBadge(status: string) {
  switch (status) {
    case "paid": return <Badge className="bg-green-100 text-green-700 border-green-200">Paid in Full</Badge>;
    case "partial": return <Badge className="bg-sky-100 text-sky-700 border-sky-200">Partial</Badge>;
    case "billed": return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Billed</Badge>;
    default: return <Badge variant="secondary">Not Billed</Badge>;
  }
}

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
  const [tab, setTab] = useState<Tab>("jobs");
  const { data: estimates, isLoading: loadingEst } = useListEstimates({});
  const { data: invoices, isLoading: loadingInv } = useListInvoices({});
  const { data: jobSummaries, isLoading: loadingJobs } = useGetJobsFinanceSummary();
  const updateJob = useUpdateJob();
  const qc = useQueryClient();

  const payments = useMemo(
    () => (invoices ?? []).filter((i) => (i.amountPaid ?? 0) > 0),
    [invoices]
  );

  const totals = useMemo(() => {
    const collected = (invoices ?? []).reduce((s, i) => s + (i.amountPaid ?? 0), 0);
    const outstanding = (invoices ?? []).reduce((s, i) => s + (i.balanceDue ?? 0), 0);
    const jobsBilled = (jobSummaries ?? [])
      .filter((j) => j.billingStatus === "billed" || j.billingStatus === "partial" || j.billingStatus === "paid")
      .reduce((s, j) => s + j.expectedPay, 0);
    return { collected, outstanding, jobsBilled };
  }, [invoices, jobSummaries]);

  const isLoading = loadingEst || loadingInv || loadingJobs;

  const handleBillingStatusChange = (jobId: number, billingStatus: string) => {
    updateJob.mutate(
      { id: jobId, data: { billingStatus } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetJobsFinanceSummaryQueryKey() }) },
    );
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finances</h1>
          <p className="text-muted-foreground mt-1">Jobs, estimates, invoices and payments in one place.</p>
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
        <StatTile label="Jobs Billed" value={formatCurrency(totals.jobsBilled)} accent="text-amber-600" />
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
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
          {tab === "jobs" && (
            jobSummaries && jobSummaries.length > 0 ? (
              <div className="rounded-xl border overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-muted/40 border-b">
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Job</th>
                      <th className="px-4 py-2.5 font-medium">Client</th>
                      <th className="px-4 py-2.5 font-medium text-right">Materials</th>
                      <th className="px-4 py-2.5 font-medium text-right">Labor</th>
                      <th className="px-4 py-2.5 font-medium text-right">Expected Pay</th>
                      <th className="px-4 py-2.5 font-medium">Billing Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {jobSummaries.map((j) => {
                      const isDone = DONE_STAGES.has(j.status) || j.billingStatus === "paid";
                      return (
                        <tr
                          key={j.id}
                          className={`transition-colors ${isDone ? "bg-green-500/10 hover:bg-green-500/15" : "hover:bg-muted/30"}`}
                        >
                          <td className="px-4 py-3">
                            <Link href={`/jobs/${j.id}`} className="font-medium hover:underline">{j.title}</Link>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{j.clientName || "—"}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(j.materialsTotal)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(j.laborTotal)}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(j.expectedPay)}</td>
                          <td className="px-4 py-3">
                            <Select
                              value={j.billingStatus || "none"}
                              onValueChange={(v) => handleBillingStatusChange(j.id, v)}
                            >
                              <SelectTrigger className="h-7 text-xs w-36 border-transparent bg-transparent hover:bg-muted/50 focus:ring-1">
                                <SelectValue>
                                  {billingStatusBadge(j.billingStatus || "none")}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {BILLING_STATUSES.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={HardHat} title="No jobs yet"
                body="Create your first job and track financials per project here."
                action={<Button asChild><Link href="/jobs"><HardHat className="w-4 h-4" /> View Jobs</Link></Button>} />
            )
          )}

          {tab === "estimates" && (
            estimates && estimates.length > 0 ? (
              <div className="rounded-xl border overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
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
              <div className="rounded-xl border overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
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
              <div className="rounded-xl border overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
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
