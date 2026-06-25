import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, FileText, Image as ImageIcon, Tag, ArrowRight } from "lucide-react";

type Tool = {
  href: string | null;
  label: string;
  desc: string;
  cta: string;
  icon: typeof Zap;
  tint: string;
  status: "active" | "soon";
};

const TOOLS: Tool[] = [
  {
    href: "/quotes", label: "AI Estimate",
    desc: "Describe a job or snap a photo and get a priced, itemized estimate in seconds.",
    cta: "Generate estimate",
    icon: Zap, tint: "bg-amber-500/10 text-amber-600", status: "active",
  },
  {
    href: "/invoices/new", label: "AI Invoice Designer",
    desc: "Build a polished, ready-to-send invoice from a project or estimate.",
    cta: "Create invoice",
    icon: FileText, tint: "bg-emerald-500/10 text-emerald-600", status: "active",
  },
  {
    href: null, label: "AI Material Pricing",
    desc: "Live pricing from major suppliers and your own job history.",
    cta: "Coming soon",
    icon: Tag, tint: "bg-sky-500/10 text-sky-600", status: "soon",
  },
  {
    href: null, label: "AI Photo Render",
    desc: "Generate realistic before-and-after renders of a finished project to win the bid.",
    cta: "Coming soon",
    icon: ImageIcon, tint: "bg-violet-500/10 text-violet-600", status: "soon",
  },
];

function ToolCard({ t }: { t: Tool }) {
  return (
    <div
      className={`group bg-card border border-card-border rounded-xl p-6 h-full flex flex-col transition-all ${
        t.status === "active" ? "hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${t.tint}`}>
          <t.icon className="w-6 h-6" strokeWidth={2} />
        </div>
        {t.status === "active" ? (
          <Badge className="bg-green-100 text-green-700 border-green-200">Active</Badge>
        ) : (
          <Badge variant="secondary">Coming soon</Badge>
        )}
      </div>
      <h3 className="font-semibold text-lg mt-4">{t.label}</h3>
      <p className="text-sm text-muted-foreground mt-1.5 flex-1">{t.desc}</p>
      <div className="mt-5">
        {t.status === "active" && t.href ? (
          <Button asChild className="w-full sm:w-auto">
            <Link href={t.href}>{t.cta} <ArrowRight className="w-4 h-4" /></Link>
          </Button>
        ) : (
          <Button variant="outline" disabled className="w-full sm:w-auto">{t.cta}</Button>
        )}
      </div>
    </div>
  );
}

export default function AiToolsPage() {
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Tools</h1>
          <p className="text-muted-foreground mt-1">Smart tools that do the busywork so you can build.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {TOOLS.map((t) => <ToolCard key={t.label} t={t} />)}
      </div>
    </div>
  );
}
