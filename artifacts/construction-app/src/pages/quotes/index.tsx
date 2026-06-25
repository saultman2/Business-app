import { useState, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  useListEstimates,
  useCreateEstimate,
  useCreateEstimateItem,
  useGetCompany,
  useListJobs,
  useListClients,
  getListEstimatesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Plus, Search, AlertTriangle, Loader2, Image as ImageIcon, X, Printer, Save, ChevronRight, ArrowLeft } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";

type EstimateMode = "labor_only" | "labor_and_materials";

interface AiLineItem {
  description: string;
  qty?: number;
  unit?: string;
  unitPrice?: number;
  hours?: number;
  hourlyRate?: number;
  section: "labor" | "material" | "equipment" | "other";
}

function estimateStatusBadge(status: string) {
  switch (status) {
    case "draft": return <Badge variant="secondary">Draft</Badge>;
    case "sent": return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Est. Sent</Badge>;
    case "approved": return <Badge className="bg-green-100 text-green-700 border-green-200">Approved</Badge>;
    case "declined": return <Badge variant="destructive">Declined</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

function NewQuotePanel({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: jobs } = useListJobs({});
  const { data: clients } = useListClients({});
  const { data: company } = useGetCompany();
  const createEstimate = useCreateEstimate();
  const createItem = useCreateEstimateItem();
  const { toast } = useToast();

  const [step, setStep] = useState<"form" | "result">("form");
  const [jobId, setJobId] = useState<number | null>(null);
  const [clientId, setClientId] = useState<number | null>(null);
  const [mode, setMode] = useState<EstimateMode>("labor_and_materials");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<{ file: File; b64: string }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiItems, setAiItems] = useState<AiLineItem[]>([]);
  const [disclaimer, setDisclaimer] = useState("");
  const [estimateTitle, setEstimateTitle] = useState("AI Quote");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedJob = jobs?.find(j => j.id === jobId);
  const zipCode = company?.zipCode || undefined;

  const handlePhotoAdd = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.slice(0, 3 - photos.length).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setPhotos(prev => [...prev.slice(0, 2), { file, b64: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }, [photos.length]);

  const handleGenerate = async () => {
    if (!description.trim()) {
      toast({ title: "Please enter a job description", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch("/api/ai/quote-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: jobId || undefined,
          jobDescription: description,
          photos: photos.map(p => p.b64),
          zipCode,
          mode,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "AI request failed");
      }
      const data = await res.json();
      setAiItems(data.items || []);
      setDisclaimer(data.disclaimer || "");
      if (selectedJob) setEstimateTitle(`Quote — ${selectedJob.title}`);
      setStep("result");
    } catch (err: unknown) {
      toast({ title: "AI error", description: err instanceof Error ? err.message : "Failed to generate estimate", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const updateItem = (idx: number, field: keyof AiLineItem, value: string | number) => {
    setAiItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeItem = (idx: number) => {
    setAiItems(prev => prev.filter((_, i) => i !== idx));
  };

  const lineTotal = (item: AiLineItem) => {
    if (item.section === "labor") return (item.hours || 0) * (item.hourlyRate || 0);
    return (item.qty || 0) * (item.unitPrice || 0);
  };

  const total = aiItems.reduce((s, item) => s + lineTotal(item), 0);

  const handleSave = async () => {
    if (!clientId && !jobId) {
      toast({ title: "Please select a job or client", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const est = await createEstimate.mutateAsync({
        data: {
          title: estimateTitle,
          jobId: jobId || undefined,
          clientId: clientId || undefined,
        },
      });

      for (const item of aiItems) {
        await createItem.mutateAsync({
          estimateId: est.id,
          data: {
            section: item.section,
            description: item.description,
            quantity: item.section !== "labor" ? (item.qty ?? 1) : undefined,
            unit: item.unit,
            unitPrice: item.section !== "labor" ? (item.unitPrice ?? 0) : undefined,
            hours: item.section === "labor" ? (item.hours ?? 0) : undefined,
            hourlyRate: item.section === "labor" ? (item.hourlyRate ?? 0) : undefined,
          },
        });
      }

      toast({ title: "Quote saved as estimate" });
      onSaved();
    } catch (err: unknown) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (step === "result") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setStep("form")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Input
            value={estimateTitle}
            onChange={e => setEstimateTitle(e.target.value)}
            className="text-lg font-semibold h-auto py-1 px-2 border-none shadow-none focus-visible:ring-0 bg-transparent"
          />
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1.5" /> Print / PDF
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              Save Quote
            </Button>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2.5 text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-sm">{disclaimer}</p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                {selectedJob && <div className="text-sm text-muted-foreground">Project: {selectedJob.title}</div>}
                {company?.name && <div className="text-sm font-medium">{company.name}</div>}
              </div>
              <Badge variant="outline" className="text-xs">AI Generated</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="text-left pb-2 w-1/2">Description</th>
                    <th className="text-left pb-2">Section</th>
                    <th className="text-right pb-2">Qty/Hrs</th>
                    <th className="text-right pb-2">Rate</th>
                    <th className="text-right pb-2">Total</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {aiItems.map((item, idx) => (
                    <tr key={idx} className="group">
                      <td className="py-2 pr-2">
                        <Input
                          value={item.description}
                          onChange={e => updateItem(idx, "description", e.target.value)}
                          className="h-7 text-sm border-transparent hover:border-input focus:border-input bg-transparent"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Select value={item.section} onValueChange={v => updateItem(idx, "section", v)}>
                          <SelectTrigger className="h-7 text-xs w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="labor">Labor</SelectItem>
                            <SelectItem value="material">Material</SelectItem>
                            <SelectItem value="equipment">Equipment</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <Input
                          type="number"
                          value={item.section === "labor" ? (item.hours ?? "") : (item.qty ?? "")}
                          onChange={e => updateItem(idx, item.section === "labor" ? "hours" : "qty", parseFloat(e.target.value) || 0)}
                          className="h-7 text-sm text-right border-transparent hover:border-input focus:border-input bg-transparent w-16"
                        />
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <Input
                          type="number"
                          value={item.section === "labor" ? (item.hourlyRate ?? "") : (item.unitPrice ?? "")}
                          onChange={e => updateItem(idx, item.section === "labor" ? "hourlyRate" : "unitPrice", parseFloat(e.target.value) || 0)}
                          className="h-7 text-sm text-right border-transparent hover:border-input focus:border-input bg-transparent w-20"
                        />
                      </td>
                      <td className="py-2 text-right font-medium">{formatCurrency(lineTotal(item))}</td>
                      <td className="py-2 pl-1">
                        <button onClick={() => removeItem(idx)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={() => setAiItems(prev => [...prev, { description: "New item", qty: 1, unit: "ea", unitPrice: 0, section: "material" }])}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add item
            </button>

            <div className="border-t pt-3 flex justify-end">
              <div className="text-right">
                <div className="text-muted-foreground text-sm">Total</div>
                <div className="text-2xl font-bold">{formatCurrency(total)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Project (optional)</Label>
          <Select value={jobId?.toString() ?? "none"} onValueChange={v => setJobId(v === "none" ? null : parseInt(v))}>
            <SelectTrigger>
              <SelectValue placeholder="Select a project..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No project</SelectItem>
              {jobs?.map(j => (
                <SelectItem key={j.id} value={j.id.toString()}>{j.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Client (optional)</Label>
          <Select value={clientId?.toString() ?? "none"} onValueChange={v => setClientId(v === "none" ? null : parseInt(v))}>
            <SelectTrigger>
              <SelectValue placeholder="Select a client..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No client</SelectItem>
              {clients?.map(c => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>What do you need estimated?</Label>
        <div className="flex gap-2">
          <button
            onClick={() => setMode("labor_only")}
            className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-all ${mode === "labor_only" ? "border-[#2563eb] bg-[#2563eb]/10 text-[#2563eb]" : "border-border text-muted-foreground hover:border-foreground/30"}`}
          >
            Labor Only
          </button>
          <button
            onClick={() => setMode("labor_and_materials")}
            className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-all ${mode === "labor_and_materials" ? "border-[#2563eb] bg-[#2563eb]/10 text-[#2563eb]" : "border-border text-muted-foreground hover:border-foreground/30"}`}
          >
            Labor + Materials
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Job Description</Label>
        <Textarea
          placeholder="e.g. Replace electrical panel in a 3-bedroom house, upgrade from 100A to 200A service..."
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          className="resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Site Photos (optional, up to 3)</Label>
        <div className="flex flex-wrap gap-2">
          {photos.map((p, idx) => (
            <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border group">
              <img src={p.b64} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          ))}
          {photos.length < 3 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
            >
              <ImageIcon className="w-5 h-5" />
              <span className="text-xs">Add</span>
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoAdd} />
        </div>
      </div>

      <Button onClick={handleGenerate} disabled={isGenerating || !description.trim()} className="w-full bg-[#2563eb] hover:bg-[#1d4ed8]">
        {isGenerating ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating estimate...</>
        ) : (
          <><Sparkles className="w-4 h-4 mr-2" /> Get AI Estimate</>
        )}
      </Button>
    </div>
  );
}

export default function QuotesPage() {
  const { data: estimates, isLoading } = useListEstimates({});
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = estimates?.filter(e =>
    !search || e.title.toLowerCase().includes(search.toLowerCase()) ||
    (e.clientName || "").toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const handleSaved = () => {
    setShowNew(false);
    queryClient.invalidateQueries({ queryKey: getListEstimatesQueryKey({}) });
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium">Estimates Overview</span>
        </div>
        <Button onClick={() => setShowNew(true)} className="bg-[#2563eb] hover:bg-[#1d4ed8]">
          <Plus className="w-4 h-4 mr-1.5" /> New Estimate
        </Button>
      </div>

      {showNew ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowNew(false)} className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to estimates
            </button>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#2563eb]" /> AI Estimate Generator
            </h2>
          </div>
          <NewQuotePanel onClose={() => setShowNew(false)} onSaved={handleSaved} />
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="pl-9 bg-white"
            />
          </div>

          <Card className="shadow-sm">
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No estimates yet</p>
                  <p className="text-sm mt-1">Click "New Estimate" to generate your first AI quote.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Name</th>
                      <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Client</th>
                      <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Amount</th>
                      <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Modified</th>
                      <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map(est => (
                      <tr key={est.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => window.location.href = `/jobs/${est.jobId}/estimate`}>
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
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function FileText(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
      <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
      <path d="M10 9H8"/>
      <path d="M16 13H8"/>
      <path d="M16 17H8"/>
    </svg>
  );
}
