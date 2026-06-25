import React, { useMemo } from "react";
import {
  useGetDashboardSummary,
  useListEstimates,
  useListInvoices,
  useListJobs,
  useGetCompany,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Users, Zap, HardHat, Calendar, UsersRound, Wallet,
  Plus, FileText, CalendarClock, Briefcase, DollarSign, Clock,
  ArrowRight, TrendingUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell,
} from "recharts";

const CATEGORIES = [
  { href: "/clients", label: "Clients", desc: "Your book of business", icon: Users, tint: "bg-sky-500/10 text-sky-600" },
  { href: "/quotes/quick", label: "Quick Quote", desc: "AI estimate in minutes", icon: Zap, tint: "bg-amber-500/10 text-amber-600" },
  { href: "/jobs", label: "Projects", desc: "Jobs across every stage", icon: HardHat, tint: "bg-orange-500/10 text-orange-600" },
  { href: "/calendar", label: "Calendar", desc: "Schedule & site visits", icon: Calendar, tint: "bg-violet-500/10 text-violet-600" },
  { href: "/crew", label: "Crew", desc: "Team & assignments", icon: UsersRound, tint: "bg-teal-500/10 text-teal-600" },
  { href: "/finances", label: "Finances", desc: "Estimates, invoices & pay", icon: Wallet, tint: "bg-emerald-500/10 text-emerald-600" },

];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function CategoryCard({ c }: { c: (typeof CATEGORIES)[number] }) {
  return (
    <Link href={c.href}>
      <div className="group bg-card border border-card-border rounded-xl p-5 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40 h-full flex flex-col">
        <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${c.tint}`}>
          <c.icon className="w-5 h-5" strokeWidth={2} />
        </div>
        <div className="mt-4 flex-1">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            {c.label}
            <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">{c.desc}</div>
        </div>
      </div>
    </Link>
  );
}

function Kpi({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: string }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
        <span className={accent}>{icon}</span>
        {label}
      </div>
      <div className="text-2xl font-bold text-foreground mt-2 tabular-nums">{value}</div>
    </div>
  );
}

function todayLabel(iso: string, allDay: boolean) {
  if (allDay) return "All day";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { data: estimates } = useListEstimates({});
  const { data: invoices } = useListInvoices({});
  const { data: jobs } = useListJobs({});
  const { data: company } = useGetCompany();

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysEvents = (summary?.upcomingEvents ?? []).filter(
    (e) => e.startDatetime.slice(0, 10) === todayStr
  );

  const revenueData = useMemo(() => {
    const months: { key: string; label: string; revenue: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString("en-US", { month: "short" }),
        revenue: 0,
      });
    }
    for (const inv of invoices ?? []) {
      const d = new Date(inv.invoiceDate || inv.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const bucket = months.find((m) => m.key === key);
      if (bucket) bucket.revenue += inv.totalAmount || 0;
    }
    return months;
  }, [invoices]);

  const hasRevenue = revenueData.some((m) => m.revenue > 0);

  const activity = useMemo(() => {
    type Item = { id: string; date: string; icon: "estimate" | "invoice" | "job"; text: string; href: string };
    const items: Item[] = [];
    for (const e of estimates ?? []) {
      const verb = e.status === "approved" ? "approved" : e.status === "sent" ? "sent to client" : "created";
      items.push({
        id: `est-${e.id}`, date: e.createdAt, icon: "estimate",
        text: `Estimate ${verb}: ${e.title}`,
        href: e.jobId ? `/jobs/${e.jobId}/estimate` : "/finances",
      });
    }
    for (const inv of invoices ?? []) {
      const verb = inv.status === "paid" ? "paid" : "created";
      items.push({
        id: `inv-${inv.id}`, date: inv.createdAt, icon: "invoice",
        text: `Invoice ${verb}: ${inv.invoiceNumber || `INV-${inv.id}`}`,
        href: `/invoices/${inv.id}`,
      });
    }
    for (const j of jobs ?? []) {
      items.push({
        id: `job-${j.id}`, date: j.createdAt, icon: "job",
        text: `New project: ${j.title}`,
        href: `/jobs/${j.id}`,
      });
    }
    return items.sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 10);
  }, [estimates, invoices, jobs]);

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 space-y-6">
        <Skeleton className="h-10 w-72 rounded-lg" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {greeting()}{company?.name ? `, ${company.name}` : ""}
          </h1>
          <p className="text-muted-foreground mt-1">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/invoices/new"><Plus className="w-4 h-4" /> New Invoice</Link>
          </Button>
          <Button asChild>
            <Link href="/quotes"><Zap className="w-4 h-4" /> New Estimate</Link>
          </Button>
        </div>
      </div>

      {/* Category grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {CATEGORIES.map((c) => <CategoryCard key={c.href} c={c} />)}
      </div>

      {/* KPI chips */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Active Jobs" value={String(summary?.activeJobs ?? 0)}
          icon={<Briefcase className="w-4 h-4" />} accent="text-orange-600" />
        <Kpi label="Pending Estimates" value={String(summary?.estimatesSent ?? 0)}
          icon={<FileText className="w-4 h-4" />} accent="text-amber-600" />
        <Kpi label="Outstanding Invoices" value={formatCurrency(summary?.totalUnpaidAmount ?? 0)}
          icon={<Clock className="w-4 h-4" />} accent="text-rose-600" />
        <Kpi label="Crew on Duty" value="0"
          icon={<UsersRound className="w-4 h-4" />} accent="text-teal-600" />
      </div>

      {/* Command center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's schedule */}
        <div className="bg-card border border-card-border rounded-xl p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-primary" /> Today's Schedule
            </h2>
            <Link href="/calendar" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {todaysEvents.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Nothing scheduled today.
            </div>
          ) : (
            <div className="space-y-2.5">
              {todaysEvents.map((e) => (
                <div key={e.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/40">
                  <div className="text-xs font-semibold text-primary w-16 shrink-0 pt-0.5">
                    {todayLabel(e.startDatetime, e.allDay)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{e.title}</div>
                    {(e.clientName || e.jobTitle) && (
                      <div className="text-xs text-muted-foreground truncate">
                        {e.clientName || e.jobTitle}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Revenue chart */}
        <div className="bg-card border border-card-border rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Revenue — last 6 months
            </h2>
            <Link href="/finances" className="text-xs text-primary hover:underline">Finances</Link>
          </div>
          {!hasRevenue ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No invoices yet — billed revenue will appear here.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <XAxis dataKey="label" axisLine={false} tickLine={false}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  formatter={(v: number) => [formatCurrency(v), "Revenue"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {revenueData.map((_, i) => <Cell key={i} fill="hsl(var(--chart-1))" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent activity — full width */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Recent Activity
          </h2>
          {activity.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Activity from estimates, invoices and projects will show up here.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activity.map((a) => {
                const icon = a.icon === "invoice"
                  ? <DollarSign className="w-4 h-4 text-emerald-600" />
                  : a.icon === "estimate"
                  ? <FileText className="w-4 h-4 text-amber-600" />
                  : <HardHat className="w-4 h-4 text-orange-600" />;
                return (
                  <Link key={a.id} href={a.href}>
                    <div className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-muted/40 -mx-2 px-2 rounded-md transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">{icon}</div>
                      <div className="text-sm flex-1 min-w-0 truncate">{a.text}</div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {new Date(a.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
