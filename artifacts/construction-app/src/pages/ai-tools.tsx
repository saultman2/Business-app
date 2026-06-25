import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap, FileText, Image as ImageIcon, Tag, ArrowRight } from "lucide-react";

type Tool = {
  href: string | null;
  label: string;
  desc: string;
  icon: typeof Zap;
  tint: string;
  status: "active" | "soon";
};

const TOOLS: Tool[] = [
  {
    href: "/quotes", label: "AI Quote Estimator",
    desc: "Describe a job or snap a photo and get a priced, itemized estimate in seconds.",
    icon: Zap, tint: "bg-amber-500/10 text-amber-600", status: "active",
  },
  {
    href: null, label: "AI Invoice Builder",
    desc: "Turn a short description into a polished, ready-to-send invoice.",
    icon: FileText, tint: "bg-emerald-500/10 text-emerald-600", status: "soon",
  },
  {
    href: null, label: "Before & After Renderer",
    desc: "Generate realistic renders of a finished project to win the bid.",
    icon: ImageIcon, tint: "bg-violet-500/10 text-violet-600", status: "soon",
  },
  {
    href: null, label: "Smart Material Pricing",
    desc: "Live pricing from Home Depot, Lowe's and your own job history.",
    icon: Tag, tint: "bg-sky-500/10 text-sky-600", status: "soon",
  },
];

function ToolCard({ t }: { t: Tool }) {
  const inner = (
    <div
      className={`group bg-card border border-card-border rounded-xl p-6 h-full flex flex-col transition-all ${
        t.status === "active"
          ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40"
          : "opacity-80"
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
      <h3 className="font-semibold text-lg mt-4 flex items-center gap-1.5">
        {t.label}
        {t.status === "active" && (
          <ArrowRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
        )}
      </h3>
      <p className="text-sm text-muted-foreground mt-1.5 flex-1">{t.desc}</p>
    </div>
  );

  if (t.href && t.status === "active") {
    return <Link href={t.href}>{inner}</Link>;
  }
  return inner;
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
