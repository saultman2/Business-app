import { useState, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  useListEstimates,
  useCreateEstimate,
  useUpdateEstimate,
  useCreateEstimateItem,
  useDeleteEstimate,
  useGetCompany,
  useListJobs,
  useListClients,
  useCreateJob,
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
import { Sparkles, Plus, Search, AlertTriangle, Loader2, Image as ImageIcon, X, Printer, Save, ChevronRight, ArrowLeft, Pencil, Trash2 } from "lucide-react";
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

function NewQuotePanel({ onClose, onSaved, initialJobId }: { onClose: () => void; onSaved: () => void; initialJobId?: number | null }) {
  const { data: jobs } = useListJobs({});
  const { data: clients } = useListClients({});
  const { data: company } = useGetCompany();
  const createEstimate = useCreateEstimate();
  const updateEstimate = useUpdateEstimate();
  const createItem = useCreateEstimateItem();
  const createJob = useCreateJob();
  const { toast } = useToast();

  const [step, setStep] = useState<"form" | "result">("form");
  const [jobId, setJobId] = useState<number | null>(initialJobId ?? null);
  const [clientId, setClientId] = useState<number | null>(null);
  const [mode, setMode] = useState<EstimateMode>("labor_and_materials");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<{ file: File; b64: string }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiItems, setAiItems] = useState<AiLineItem[]>([]);
  const [disclaimer, setDisclaimer] = useState("");
  const [estimateTitle, setEstimateTitle] = useState("AI Quote");
  const [taxRate, setTaxRate] = useState<number>(company?.defaultTaxRate ?? 0);
  const [newJobTitle, setNewJobTitle] = useState("");
  const [showNewJob, setShowNewJob] = useState(false);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedJob = jobs?.find(j => j.id === jobId);
  const selectedClient = clients?.find(c => c.id === clientId);
  const zipCode = company?.zipCode || undefined;

  const handleCreateJob = async () => {
    if (!newJobTitle.trim()) return;
    setIsCreatingJob(true);
    try {
      const job = await createJob.mutateAsync({ data: { title: newJobTitle.trim(), clientId: clientId || undefined } });
      setJobId(job.id);
      setEstimateTitle(`Quote — ${job.title}`);
      setShowNewJob(false);
      setNewJobTitle("");
    } catch {
      toast({ title: "Failed to create job", variant: "destructive" });
    } finally {
      setIsCreatingJob(false);
    }
  };

  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 800;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("canvas unavailable")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = reject;
      img.src = url;
    });

  const handlePhotoAdd = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.slice(0, 3 - photos.length).forEach(file => {
      compressImage(file).then(b64 => {
        setPhotos(prev => [...prev.slice(0, 2), { file, b64 }]);
      }).catch(() => {
        const reader = new FileReader();
        reader.onload = () => {
          setPhotos(prev => [...prev.slice(0, 2), { file, b64: reader.result as string }]);
        };
        reader.readAsDataURL(file);
      });
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

  const laborItems = aiItems.filter(i => i.section === "labor");
  const materialItems = aiItems.filter(i => i.section === "material");
  const otherItems = aiItems.filter(i => !["labor", "material"].includes(i.section));
  const laborTotal = laborItems.reduce((s, i) => s + (i.hours || 0) * (i.hourlyRate || 0), 0);
  const materialTotal = materialItems.reduce((s, i) => s + (i.qty || 0) * (i.unitPrice || 0), 0);
  const otherTotal = otherItems.reduce((s, i) => s + lineTotal(i), 0);
  const visibleTotal = mode === "labor_only" ? laborTotal : total;
  const taxAmount = visibleTotal * (taxRate / 100);
  const grandTotal = visibleTotal + taxAmount;

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

      const itemsToSave = mode === "labor_only" ? aiItems.filter(i => i.section === "labor") : aiItems;
      for (const item of itemsToSave) {
        await createItem.mutateAsync({
          estimateId: est.id,
          data: {
            section: item.section,
            description: item.description,
            quantity: item.section !== "labor" ? (item.qty ?? 1) : undefined,
            unit: item.unit ?? undefined,
            unitPrice: item.section !== "labor" ? (item.unitPrice ?? 0) : undefined,
            hours: item.section === "labor" ? (item.hours ?? 0) : undefined,
            hourlyRate: item.section === "labor" ? (item.hourlyRate ?? 0) : undefined,
          },
        });
      }

      await updateEstimate.mutateAsync({
        id: est.id,
        data: {
          jobId: jobId || undefined,
          clientId: clientId || undefined,
          notes: `[AI-generated quote] ${disclaimer}`,
          scopeOfWork: description,
          taxRate: taxRate,
          includeTax: taxRate > 0,
          includeLabor: laborItems.length > 0,
          includeMaterials: materialItems.length > 0 && mode !== "labor_only",
        },
      });

      toast({ title: "Estimate saved", description: "AI-generated quote saved. Review before sending to client." });
      onSaved();
    } catch (err: unknown) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (step === "result") {
    const sections = [
      { label: "Labor", items: laborItems, subtotal: laborTotal, qtyLabel: "Hrs", rateLabel: "Rate/hr" },
      { label: "Materials", items: materialItems, subtotal: materialTotal, qtyLabel: "Qty", rateLabel: "Unit Price" },
      { label: "Other", items: otherItems, subtotal: otherTotal, qtyLabel: "Qty/Hrs", rateLabel: "Rate" },
    ].filter(s => s.items.length > 0);

    return (
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setStep("form")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Input
            value={estimateTitle}
            onChange={e => setEstimateTitle(e.target.value)}
            className="flex-1 text-lg font-semibold h-9 py-1 px-2 max-w-xs"
          />
          <Select
            value={jobId ? String(jobId) : "none"}
            onValueChange={v => setJobId(v === "none" ? null : Number(v))}
          >
            <SelectTrigger className="h-9 w-36 text-sm">
              <SelectValue placeholder="Job (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No job</SelectItem>
              {jobs?.map(j => (
                <SelectItem key={j.id} value={String(j.id)}>{j.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={clientId ? String(clientId) : "none"}
            onValueChange={v => setClientId(v === "none" ? null : Number(v))}
          >
            <SelectTrigger className="h-9 w-36 text-sm">
              <SelectValue placeholder="Client (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No client</SelectItem>
              {clients?.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1.5" /> Print / PDF
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              Save as Estimate
            </Button>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2.5 text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium mb-0.5">AI Draft — Verify before sending</p>
            <p>{disclaimer}</p>
            <p className="mt-1 text-xs text-amber-700">Pricing is based on current Home Depot / Lowe's retail rates for your region. Always confirm final prices with your supplier before submitting to the client.</p>
          </div>
        </div>

        {/* Professional Quote Document */}
        <Card className="print:shadow-none print:border-0">
          <CardContent className="p-6 sm:p-8 space-y-6">
            {/* Header: company + client info */}
            <div className="flex flex-col sm:flex-row sm:justify-between gap-6 pb-6 border-b">
              <div>
                {company?.logoUrl && (
                  <img src={company.logoUrl} alt="Company logo" className="h-12 w-auto object-contain mb-3 print:mb-2" />
                )}
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-foreground">{company?.name || "Your Company"}</h2>
                  <Badge variant="outline" className="text-xs text-purple-600 border-purple-300 bg-purple-50 print:hidden">
                    <Sparkles className="w-2.5 h-2.5 mr-1" /> AI Draft
                  </Badge>
                </div>
                {company?.address && <div className="text-sm text-muted-foreground">{company.address}</div>}
                {company?.city && <div className="text-sm text-muted-foreground">{company.city}{company.state ? `, ${company.state}` : ""} {company.zipCode || ""}</div>}
                {company?.phone && <div className="text-sm text-muted-foreground">{company.phone}</div>}
                {company?.email && <div className="text-sm text-muted-foreground">{company.email}</div>}
              </div>
              <div className="text-sm sm:text-right space-y-1">
                <div className="font-semibold text-base">ESTIMATE</div>
                <div className="text-muted-foreground">Date: {new Date().toLocaleDateString()}</div>
                {selectedClient && (
                  <div className="mt-2 pt-2 border-t sm:border-t-0 sm:mt-0 sm:pt-0">
                    <div className="font-medium">Bill To:</div>
                    <div>{selectedClient.name}</div>
                    {selectedClient.address && <div className="text-muted-foreground">{selectedClient.address}</div>}
                    {selectedClient.email && <div className="text-muted-foreground">{selectedClient.email}</div>}
                    {selectedClient.phone && <div className="text-muted-foreground">{selectedClient.phone}</div>}
                  </div>
                )}
                {selectedJob && (
                  <div className="mt-2">
                    <div className="font-medium">Project:</div>
                    <div>{selectedJob.title}</div>
                    {selectedJob.address && <div className="text-muted-foreground">{selectedJob.address}</div>}
                  </div>
                )}
              </div>
            </div>

            {/* Mode toggle for post-generation section visibility */}
            <div className="flex gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground self-center mr-1">Showing:</span>
              <button
                onClick={() => setMode("labor_and_materials")}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${mode === "labor_and_materials" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-foreground/30"}`}
              >
                Labor + Materials
              </button>
              <button
                onClick={() => setMode("labor_only")}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${mode === "labor_only" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-foreground/30"}`}
              >
                Labor Only
              </button>
            </div>

            {/* Line items by section */}
            {sections
              .filter(s => mode === "labor_only" ? s.label === "Labor" : true)
              .map(section => (
              <div key={section.label}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{section.label}</h3>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="overflow-x-auto no-scrollbar">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="text-muted-foreground text-xs">
                      <th className="text-left pb-1.5 w-1/2">Description</th>
                      <th className="text-right pb-1.5 w-16">{section.qtyLabel}</th>
                      <th className="text-right pb-1.5 w-24">{section.rateLabel}</th>
                      <th className="text-right pb-1.5 w-24">Amount</th>
                      <th className="pb-1.5 w-6" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {section.items.map((item, _) => {
                      const globalIdx = aiItems.indexOf(item);
                      return (
                        <tr key={globalIdx} className="group">
                          <td className="py-1.5 pr-2">
                            <Textarea
                              value={item.description}
                              onChange={e => updateItem(globalIdx, "description", e.target.value)}
                              rows={2}
                              className="text-sm border-transparent hover:border-input focus:border-input bg-transparent p-1 resize-none"
                            />
                          </td>
                          <td className="py-1.5 pr-2 text-right">
                            <Input
                              type="number"
                              value={item.section === "labor" ? (item.hours ?? "") : (item.qty ?? "")}
                              onChange={e => updateItem(globalIdx, item.section === "labor" ? "hours" : "qty", parseFloat(e.target.value) || 0)}
                              className="h-7 text-sm text-right border-transparent hover:border-input focus:border-input bg-transparent w-16 ml-auto p-1"
                            />
                          </td>
                          <td className="py-1.5 pr-2 text-right">
                            <Input
                              type="number"
                              value={item.section === "labor" ? (item.hourlyRate ?? "") : (item.unitPrice ?? "")}
                              onChange={e => updateItem(globalIdx, item.section === "labor" ? "hourlyRate" : "unitPrice", parseFloat(e.target.value) || 0)}
                              className="h-7 text-sm text-right border-transparent hover:border-input focus:border-input bg-transparent w-24 ml-auto p-1"
                            />
                          </td>
                          <td className="py-1.5 text-right font-medium tabular-nums">{formatCurrency(lineTotal(item))}</td>
                          <td className="py-1.5 pl-1">
                            <button onClick={() => removeItem(globalIdx)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                <div className="flex justify-end mt-1">
                  <span className="text-sm text-muted-foreground">{section.label} subtotal: <span className="font-medium text-foreground">{formatCurrency(section.subtotal)}</span></span>
                </div>
              </div>
            ))}

            <button
              onClick={() => setAiItems(prev => [...prev, { description: "New item", qty: 1, unit: "ea", unitPrice: 0, section: mode === "labor_only" ? "labor" : "material" }])}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add line item
            </button>

            {/* Total summary */}
            <div className="border-t pt-4">
              <div className="flex flex-col items-end gap-1.5 text-sm">
                {laborTotal > 0 && (
                  <div className="flex gap-8 text-muted-foreground">
                    <span>Labor</span>
                    <span className="tabular-nums w-28 text-right">{formatCurrency(laborTotal)}</span>
                  </div>
                )}
                {materialTotal > 0 && mode !== "labor_only" && (
                  <div className="flex gap-8 text-muted-foreground">
                    <span>Materials</span>
                    <span className="tabular-nums w-28 text-right">{formatCurrency(materialTotal)}</span>
                  </div>
                )}
                {otherTotal > 0 && mode !== "labor_only" && (
                  <div className="flex gap-8 text-muted-foreground">
                    <span>Other</span>
                    <span className="tabular-nums w-28 text-right">{formatCurrency(otherTotal)}</span>
                  </div>
                )}
                <div className="flex items-center gap-8 text-muted-foreground border-t pt-1.5 w-64 justify-between">
                  <div className="flex items-center gap-1.5">
                    <span>Tax</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={taxRate}
                      onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                      className="w-16 h-6 text-xs px-1.5 print:hidden"
                    />
                    <span className="text-xs print:hidden">%</span>
                    <span className="hidden print:inline text-xs">({taxRate}%)</span>
                  </div>
                  <span className="tabular-nums">{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex gap-8 font-bold text-lg pt-1.5 border-t w-64 justify-between">
                  <span>TOTAL</span>
                  <span className="tabular-nums text-right">{formatCurrency(grandTotal)}</span>
                </div>
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
          {showNewJob ? (
            <div className="flex gap-2">
              <Input
                autoFocus
                placeholder="New project name..."
                value={newJobTitle}
                onChange={e => setNewJobTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreateJob(); if (e.key === "Escape") setShowNewJob(false); }}
                className="flex-1"
              />
              <Button size="sm" onClick={handleCreateJob} disabled={isCreatingJob || !newJobTitle.trim()}>
                {isCreatingJob ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNewJob(false)}>✕</Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Select value={jobId?.toString() ?? "none"} onValueChange={v => setJobId(v === "none" ? null : parseInt(v))}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {jobs?.map(j => (
                    <SelectItem key={j.id} value={j.id.toString()}>{j.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => setShowNewJob(true)} title="Create new project">
                +
              </Button>
            </div>
          )}
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
            className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-all ${mode === "labor_only" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"}`}
          >
            Labor Only
          </button>
          <button
            onClick={() => setMode("labor_and_materials")}
            className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-all ${mode === "labor_and_materials" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"}`}
          >
            Labor + Materials
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Job Description <span className="text-muted-foreground font-normal text-xs">— more detail = more accurate quote</span></Label>
        <Textarea
          placeholder={"Describe the job in detail: scope of work, room sizes, materials preference, any special conditions, access issues, etc. The more you include, the more accurate the AI estimate will be.\n\nExample: Replace 200 sq ft of tile in master bathroom. Remove existing tile and adhesive, install cement board, 12×24 porcelain tile with 1/8\" grout lines. Include new schluter strip at doorway."}
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={6}
          className="resize-y"
        />
        <p className="text-xs text-muted-foreground">Tip: Include measurements, material brands, access constraints, and anything else the estimator would need to know on-site.</p>
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

      <Button onClick={handleGenerate} disabled={isGenerating || !description.trim()} className="w-full">
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
  const deleteEstimate = useDeleteEstimate();
  const { toast } = useToast();
  const preselectedJobId = new URLSearchParams(window.location.search).get("jobId");
  const [showNew, setShowNew] = useState(() => !!preselectedJobId);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filtered = estimates?.filter(e =>
    !search || e.title.toLowerCase().includes(search.toLowerCase()) ||
    (e.clientName || "").toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const handleSaved = () => {
    setShowNew(false);
    queryClient.invalidateQueries({ queryKey: getListEstimatesQueryKey({}) });
  };

  const handleDelete = (id: number, title: string) => {
    if (!window.confirm(`Delete estimate "${title}"? This cannot be undone.`)) return;
    setDeletingId(id);
    deleteEstimate.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEstimatesQueryKey({}) });
        toast({ title: "Estimate deleted" });
      },
      onError: () => toast({ title: "Failed to delete estimate", variant: "destructive" }),
      onSettled: () => setDeletingId(null),
    });
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium">Estimates Overview</span>
        </div>
        <Button onClick={() => setShowNew(true)}>
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
              <Sparkles className="w-5 h-5 text-primary" /> AI Estimate Generator
            </h2>
          </div>
          <NewQuotePanel onClose={() => setShowNew(false)} onSaved={handleSaved} initialJobId={preselectedJobId ? parseInt(preselectedJobId) : null} />
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
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map(est => (
                      <tr key={est.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{est.title}</td>
                        <td className="px-4 py-3 text-muted-foreground">{est.clientName || "Not Assigned"}</td>
                        <td className="px-4 py-3">{formatCurrency(est.total)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(est.createdAt)}</td>
                        <td className="px-4 py-3">{estimateStatusBadge(est.status)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9"
                              title="Edit estimate"
                              onClick={() => (window.location.href = `/jobs/${est.jobId ?? 0}/estimate?estimateId=${est.id}`)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 text-destructive hover:text-destructive"
                              title="Delete estimate"
                              disabled={deletingId === est.id}
                              onClick={() => handleDelete(est.id, est.title)}
                            >
                              {deletingId === est.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </td>
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
