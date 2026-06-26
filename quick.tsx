import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useListClients,
  useListJobs,
  useGetCompany,
  useCreateClient,
  useCreateJob,
  useCreateEstimate,
  useCreateEstimateItem,
  useUpdateEstimate,
  useAiQuickQuote,
  useAiMaterialPrice,
} from "@workspace/api-client-react";
import type { AiMaterialPriceResult } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  Plus,
  X,
  Printer,
  Save,
  Loader2,
  Tag,
  AlertTriangle,
  ChevronRight,
  UserRound,
  ArrowRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";

type Section = "material" | "labor";

interface LineItem {
  id: string;
  section: Section;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
}

const JOB_TYPES = [
  "General Construction",
  "Remodeling",
  "Roofing",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Painting",
  "Flooring",
  "Concrete / Masonry",
  "Landscaping",
  "Carpentry",
  "Drywall",
  "Fencing",
  "Gutters",
  "Other",
];

const DESCRIPTION_TEMPLATE = `Tell me what job you are quoting. Include the type of work, measurements, materials wanted, location details, condition of the existing area, timeline, and anything special the customer asked for.

Example:
Customer wants 120 feet of 6-inch seamless gutters installed on a single-story house. Existing gutters need to be removed. Include downspouts, hangers, end caps, corners, labor, disposal, and cleanup.`;

let idCounter = 0;
const nextId = () => `li-${idCounter++}`;

function emptyItem(section: Section): LineItem {
  return {
    id: nextId(),
    section,
    description: "",
    qty: 1,
    unit: section === "labor" ? "hr" : "ea",
    unitPrice: 0,
  };
}

export default function QuickQuotePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: clients } = useListClients({});
  const { data: jobs } = useListJobs({});
  const { data: company } = useGetCompany();

  const createClient = useCreateClient();
  const createJob = useCreateJob();
  const createEstimate = useCreateEstimate();
  const createItem = useCreateEstimateItem();
  const updateEstimate = useUpdateEstimate();
  const aiQuickQuote = useAiQuickQuote();
  const materialPrice = useAiMaterialPrice();

  // Client
  const [clientNameInput, setClientNameInput] = useState("");
  const [clientId, setClientId] = useState<number | null>(null);
  const [clientConfirmed, setClientConfirmed] = useState(false);

  // Job
  const [jobType, setJobType] = useState("General Construction");
  const [description, setDescription] = useState("");
  const [showTemplate, setShowTemplate] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState("");

  // Line items
  const [items, setItems] = useState<LineItem[]>([]);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [taxRate, setTaxRate] = useState<number>(0);

  // Price hints
  const [hints, setHints] = useState<Record<string, AiMaterialPriceResult | null>>({});
  const [hintLoading, setHintLoading] = useState<Record<string, boolean>>({});

  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (company?.defaultTaxRate != null) setTaxRate(company.defaultTaxRate);
  }, [company?.defaultTaxRate]);

  const selectedClient = clients?.find((c) => c.id === clientId) || null;

  const matchingClients = useMemo(() => {
    const q = clientNameInput.trim().toLowerCase();
    if (!q || !clients || clientConfirmed) return [];
    return clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 4);
  }, [clientNameInput, clients, clientConfirmed]);

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.qty * i.unitPrice, 0),
    [items],
  );
  const taxAmount = subtotal * (taxRate / 100);
  const grandTotal = subtotal + taxAmount;

  const materialItems = items.filter((i) => i.section === "material");
  const laborItems = items.filter((i) => i.section === "labor");

  function selectClient(id: number) {
    const c = clients?.find((x) => x.id === id);
    if (c) {
      setClientId(id);
      setClientNameInput(c.name);
      setClientConfirmed(true);
    }
  }

  function confirmNewClient() {
    setClientId(null);
    setClientConfirmed(true);
  }

  function updateItem(id: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setHints((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function handleGenerate() {
    if (!description.trim()) {
      toast({ title: "Please describe the job first", variant: "destructive" });
      return;
    }
    try {
      const res = await aiQuickQuote.mutateAsync({
        data: {
          jobDescription: description.trim(),
          jobType: jobType || undefined,
          zipCode: company?.zipCode || undefined,
        },
      });
      const mats: LineItem[] = (res.materials || []).map((m) => ({
        id: nextId(),
        section: "material",
        description: m.name,
        qty: m.qty ?? 1,
        unit: m.unit ?? "ea",
        unitPrice: m.unitPrice ?? 0,
      }));
      const labor: LineItem[] = (res.labor || []).map((l) => ({
        id: nextId(),
        section: "labor",
        description: l.description,
        qty: l.qty ?? 1,
        unit: "hr",
        unitPrice: l.unitPrice ?? 0,
      }));
      setItems([...mats, ...labor]);
      setAiGenerated(true);
      toast({ title: "Quote generated!", description: "Review and adjust the items below." });
    } catch (err: unknown) {
      toast({
        title: "AI error",
        description: err instanceof Error ? err.message : "Failed to generate quote",
        variant: "destructive",
      });
    }
  }

  async function handleCheckPrice(item: LineItem) {
    if (!item.description.trim()) return;
    setHintLoading((p) => ({ ...p, [item.id]: true }));
    try {
      const res = await materialPrice.mutateAsync({
        data: { itemName: item.description.trim(), unit: item.unit || undefined },
      });
      setHints((p) => ({ ...p, [item.id]: res }));
    } catch {
      toast({ title: "Price lookup failed", variant: "destructive" });
    } finally {
      setHintLoading((p) => ({ ...p, [item.id]: false }));
    }
  }

  async function handleSave() {
    const validItems = items.filter((i) => i.description.trim());
    if (validItems.length === 0) {
      toast({ title: "Add at least one line item", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      let finalClientId = clientId;
      if (finalClientId == null && clientNameInput.trim()) {
        const c = await createClient.mutateAsync({ data: { name: clientNameInput.trim() } });
        finalClientId = c.id;
      }
      const clientName = selectedClient?.name || clientNameInput.trim();

      const title = newJobTitle.trim() || (clientName ? `${jobType} — ${clientName}` : jobType);
      const job = await createJob.mutateAsync({
        data: { title, jobType, clientId: finalClientId ?? undefined, description: description || undefined },
      });

      const est = await createEstimate.mutateAsync({
        data: { title, jobId: job.id, clientId: finalClientId ?? undefined },
      });

      let sortOrder = 0;
      for (const item of validItems) {
        await createItem.mutateAsync({
          estimateId: est.id,
          data: {
            section: item.section,
            description: item.description,
            quantity: item.section === "material" ? item.qty : undefined,
            unit: item.section === "material" ? item.unit : undefined,
            unitPrice: item.section === "material" ? item.unitPrice : undefined,
            hours: item.section === "labor" ? item.qty : undefined,
            hourlyRate: item.section === "labor" ? item.unitPrice : undefined,
            sortOrder: sortOrder++,
          },
        });
      }

      await updateEstimate.mutateAsync({
        id: est.id,
        data: {
          scopeOfWork: description || undefined,
          taxRate,
          includeTax: taxRate > 0,
          includeLabor: laborItems.length > 0,
          includeMaterials: materialItems.length > 0,
        },
      });

      toast({ title: "Quote saved!", description: "Opening your project." });
      setLocation(`/jobs/${job.id}`);
    } catch (err: unknown) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  const confidenceLabel = (c: string) =>
    c === "high" ? "High" : c === "estimate" ? "Estimate" : "Approximate";

  // ── PREVIEW ──────────────────────────────────────────
  if (showPreview) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-5 print:p-0">
        <div className="flex items-center gap-3 flex-wrap print:hidden">
          <button
            onClick={() => setShowPreview(false)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to edit
          </button>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1.5" /> Print / PDF
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              Save & Create Project
            </Button>
          </div>
        </div>

        <Card className="print:shadow-none print:border-0">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-6 pb-6 border-b">
              <div>
                {company?.logoUrl && (
                  <img src={company.logoUrl} alt="logo" className="h-12 w-auto object-contain mb-3" />
                )}
                <h2 className="text-xl font-bold">{company?.name || "Your Company"}</h2>
                {company?.address && <div className="text-sm text-muted-foreground">{company.address}</div>}
                {company?.city && (
                  <div className="text-sm text-muted-foreground">
                    {company.city}{company.state ? `, ${company.state}` : ""} {company.zipCode || ""}
                  </div>
                )}
                {company?.phone && <div className="text-sm text-muted-foreground">{company.phone}</div>}
                {company?.email && <div className="text-sm text-muted-foreground">{company.email}</div>}
              </div>
              <div className="text-sm sm:text-right space-y-1">
                <div className="font-semibold text-base">ESTIMATE</div>
                <div className="text-muted-foreground">Date: {new Date().toLocaleDateString()}</div>
                {(selectedClient || clientNameInput.trim()) && (
                  <div className="mt-2">
                    <div className="font-medium">Bill To:</div>
                    <div>{selectedClient?.name || clientNameInput.trim()}</div>
                    {selectedClient?.address && <div className="text-muted-foreground">{selectedClient.address}</div>}
                    {selectedClient?.email && <div className="text-muted-foreground">{selectedClient.email}</div>}
                  </div>
                )}
                <div className="mt-2">
                  <div className="font-medium">Job Type:</div>
                  <div>{jobType}</div>
                </div>
              </div>
            </div>

            {description && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Scope of Work
                </div>
                <p className="text-sm text-foreground/90">{description}</p>
              </div>
            )}

            <PreviewSection title="Materials" items={materialItems} qtyLabel="Qty" rateLabel="Unit Price" />
            <PreviewSection title="Labor" items={laborItems} qtyLabel="Hrs" rateLabel="Rate/hr" />

            <div className="border-t pt-4">
              <div className="flex flex-col items-end gap-1.5 text-sm">
                <div className="flex gap-8 text-muted-foreground w-64 justify-between">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                {taxRate > 0 && (
                  <div className="flex gap-8 text-muted-foreground w-64 justify-between">
                    <span>Tax ({taxRate}%)</span>
                    <span className="tabular-nums">{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                <div className="flex gap-8 font-bold text-lg pt-1.5 border-t w-64 justify-between">
                  <span>TOTAL</span>
                  <span className="tabular-nums">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1.5" /> Print / PDF
          </Button>
          <Button onClick={handleSave} disabled={isSaving} size="lg">
            {isSaving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Save & Create Project
          </Button>
        </div>
      </div>
    );
  }

  // ── MAIN FORM ────────────────────────────────────────
  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quick Quote</h1>
        <p className="text-muted-foreground mt-1 text-sm">Fill in the client and job details — AI will build the estimate for you.</p>
      </div>

      {/* ── SECTION 1: CLIENT ── */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">
          <span className="inline-flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</span>
            Customer Name
          </span>
        </Label>

        {clientConfirmed ? (
          <div className="flex items-center justify-between p-3 rounded-xl border bg-card">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {clientNameInput.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-medium">{clientNameInput}</div>
                <div className="text-xs text-muted-foreground">{clientId ? "Existing client" : "New client"}</div>
              </div>
            </div>
            <button
              onClick={() => { setClientConfirmed(false); setClientId(null); }}
              className="text-xs text-primary hover:underline"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                autoFocus
                placeholder="Enter customer name…"
                value={clientNameInput}
                onChange={(e) => { setClientNameInput(e.target.value); setClientId(null); }}
                className="h-11 text-base"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && clientNameInput.trim()) confirmNewClient();
                }}
              />
              <Button
                onClick={confirmNewClient}
                disabled={!clientNameInput.trim()}
                className="h-11 px-5 shrink-0"
              >
                OK
              </Button>
            </div>

            {/* Matching existing clients */}
            {matchingClients.length > 0 && (
              <div className="space-y-1.5">
                {matchingClients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectClient(c.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <UserRound className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">{c.name}</span>
                      {c.email && <span className="text-xs text-muted-foreground hidden sm:inline">{c.email}</span>}
                    </div>
                    <span className="text-xs text-primary flex items-center gap-0.5 shrink-0">
                      Select <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SECTION 2: JOB DESCRIPTION ── */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">
          <span className="inline-flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</span>
            Job Description
          </span>
        </Label>

        <div className="space-y-1.5">
          <Select value={jobType} onValueChange={setJobType}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select job type…" />
            </SelectTrigger>
            <SelectContent>
              {JOB_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Describe the job in detail</span>
            <button
              onClick={() => setShowTemplate(!showTemplate)}
              className="text-xs text-primary hover:underline"
            >
              {showTemplate ? "Hide example" : "Show example"}
            </button>
          </div>

          {showTemplate && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <p className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">
                  {DESCRIPTION_TEMPLATE}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setDescription(
                      "Customer wants 120 feet of 6-inch seamless gutters installed on a single-story house. Existing gutters need to be removed. Include downspouts, hangers, end caps, corners, labor, disposal, and cleanup."
                    );
                    setShowTemplate(false);
                  }}
                >
                  Use this example
                </Button>
              </CardContent>
            </Card>
          )}

          <Textarea
            placeholder={`Describe what needs to be done...\n\nInclude: type of work, measurements, materials, location, condition of existing area, timeline, and anything special the customer asked for.`}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (aiGenerated) { setAiGenerated(false); setItems([]); }
            }}
            rows={5}
            className="resize-none"
          />
        </div>

        <Button
          className="w-full h-11 text-sm font-semibold"
          onClick={handleGenerate}
          disabled={aiQuickQuote.isPending || !description.trim()}
        >
          {aiQuickQuote.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Building your estimate…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              {aiGenerated ? "Regenerate Estimate" : "Generate Estimate with AI"}
            </>
          )}
        </Button>
      </div>

      {/* ── SECTION 3: AI GENERATED ITEMS ── */}
      {aiGenerated && items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">
              <span className="inline-flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">3</span>
                Review & Edit Quote
              </span>
            </Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setItems((p) => [...p, emptyItem("material")])}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Material
              </Button>
              <Button variant="outline" size="sm" onClick={() => setItems((p) => [...p, emptyItem("labor")])}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Labor
              </Button>
            </div>
          </div>

          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">
                AI estimates are approximate — review every line and adjust prices before sending to your customer.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {items.map((item) => {
                  const hint = hints[item.id];
                  return (
                    <div key={item.id} className="p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <Badge
                          variant={item.section === "labor" ? "secondary" : "outline"}
                          className="mt-1.5 shrink-0 text-xs"
                        >
                          {item.section === "labor" ? "Labor" : "Material"}
                        </Badge>
                        <div className="flex-1 grid grid-cols-12 gap-2">
                          <Input
                            className="col-span-12 sm:col-span-5"
                            placeholder={item.section === "labor" ? "Task description" : "Item name"}
                            value={item.description}
                            onChange={(e) => updateItem(item.id, { description: e.target.value })}
                          />
                          <Input
                            className="col-span-3 sm:col-span-2"
                            type="number"
                            placeholder={item.section === "labor" ? "Hrs" : "Qty"}
                            value={item.qty}
                            onChange={(e) => updateItem(item.id, { qty: parseFloat(e.target.value) || 0 })}
                          />
                          <Input
                            className="col-span-3 sm:col-span-2"
                            placeholder="Unit"
                            value={item.unit}
                            disabled={item.section === "labor"}
                            onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                          />
                          <Input
                            className="col-span-4 sm:col-span-2"
                            type="number"
                            placeholder={item.section === "labor" ? "Rate/hr" : "Unit price"}
                            value={item.unitPrice}
                            onChange={(e) => updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                          />
                          <div className="col-span-2 sm:col-span-1 flex items-center justify-end text-sm font-medium tabular-nums">
                            {formatCurrency(item.qty * item.unitPrice)}
                          </div>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="mt-1.5 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {item.section === "material" && (
                        <div className="flex flex-wrap items-center gap-2 pl-1">
                          <button
                            onClick={() => handleCheckPrice(item)}
                            disabled={hintLoading[item.id]}
                            className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                          >
                            {hintLoading[item.id] ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Tag className="w-3 h-3" />
                            )}
                            Check price
                          </button>
                          {hint && (
                            <>
                              {hint.historical.latest != null && (
                                <button
                                  onClick={() => updateItem(item.id, { unitPrice: hint.historical.latest! })}
                                  className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                                >
                                  <Badge variant="secondary" className="text-[10px]">Your records</Badge>
                                  <span className="font-medium">{formatCurrency(hint.historical.latest)}</span>
                                  <span className="text-primary">· Use</span>
                                </button>
                              )}
                              {hint.retailEstimates
                                .filter((e) => e.price != null)
                                .map((e, i) => (
                                  <button
                                    key={i}
                                    onClick={() => updateItem(item.id, { unitPrice: e.price! })}
                                    className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                                  >
                                    <Badge variant="outline" className="text-[10px]">AI estimate</Badge>
                                    <span className="font-medium">{formatCurrency(e.price!)}</span>
                                    <span className="text-muted-foreground">{e.store}</span>
                                    <span className="text-primary">· Use</span>
                                  </button>
                                ))}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Totals */}
          <div className="flex flex-col items-end gap-1.5 text-sm pt-1">
            <div className="flex gap-8 text-muted-foreground w-64 justify-between">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center gap-2 w-64 justify-between text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span>Tax</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-16 h-7 text-xs px-1.5"
                />
                <span className="text-xs">%</span>
              </div>
              <span className="tabular-nums">{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex gap-8 font-bold text-lg pt-1.5 border-t w-64 justify-between">
              <span>TOTAL</span>
              <span className="tabular-nums">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          {/* Send / Preview */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-12"
              onClick={() => setShowPreview(true)}
            >
              <Printer className="w-4 h-4 mr-2" />
              Preview Quote
            </Button>
            <Button
              className="flex-1 h-12 text-base font-semibold"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
              Save & Send Quote
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewSection({
  title,
  items,
  qtyLabel,
  rateLabel,
}: {
  title: string;
  items: LineItem[];
  qtyLabel: string;
  rateLabel: string;
}) {
  if (items.length === 0) return null;
  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        <div className="flex-1 h-px bg-border" />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground text-xs">
            <th className="text-left pb-1.5">Description</th>
            <th className="text-right pb-1.5 w-16">{qtyLabel}</th>
            <th className="text-right pb-1.5 w-24">{rateLabel}</th>
            <th className="text-right pb-1.5 w-24">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="py-1.5 pr-2">{item.description || "—"}</td>
              <td className="py-1.5 text-right tabular-nums">
                {item.qty}{item.section === "material" && item.unit ? ` ${item.unit}` : ""}
              </td>
              <td className="py-1.5 text-right tabular-nums">{formatCurrency(item.unitPrice)}</td>
              <td className="py-1.5 text-right font-medium tabular-nums">
                {formatCurrency(item.qty * item.unitPrice)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-end mt-1">
        <span className="text-sm text-muted-foreground">
          {title} subtotal: <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span>
        </span>
      </div>
    </div>
  );
}
