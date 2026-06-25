import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useCreateInvoice,
  useListJobs,
  useListClients,
  useGetCompany,
  useAiInvoiceDescription,
  useListEstimates,
  useGetEstimate,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Printer, Sparkles, Plus, Trash2, Save, ArrowLeft, Loader2, FileText, Download,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Link } from "wouter";
import type { InvoiceStyle } from "@workspace/api-client-react";
import { InvoiceDocument } from "./invoice-document";
import { InvoiceAIChat } from "./invoice-ai-chat";
import {
  type Template,
  type LineItem,
  type StyleOverrides,
  lineTotal,
  newLineItem,
  defaultStyleOverrides,
  clampFontScale,
  serializeLineItems,
} from "./invoice-types";
import { TemplatePicker } from "./template-picker";
import "./invoice-templates.css";

export default function NewInvoicePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: company } = useGetCompany();
  const { data: jobs } = useListJobs({});
  const { data: clients } = useListClients({});

  const createInvoice = useCreateInvoice();
  const aiDescription = useAiInvoiceDescription();

  const [template, setTemplate] = useState<Template>("clean");
  const [selectedJobId, setSelectedJobId] = useState<string>("none");
  const [selectedClientId, setSelectedClientId] = useState<string>("none");
  const [invoiceNumber, setInvoiceNumber] = useState<string>(
    `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`
  );
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10);
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([newLineItem()]);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [servicesDescription, setServicesDescription] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [aiNotes, setAiNotes] = useState("");
  const [importEstimateId, setImportEstimateId] = useState<number | null>(null);
  const [styleOverrides, setStyleOverrides] = useState<StyleOverrides>(defaultStyleOverrides());
  const [autoImportedJobId, setAutoImportedJobId] = useState<number | null>(null);

  const buildCurrentStyle = useCallback((): InvoiceStyle => ({
    accentColor: styleOverrides.accentColor,
    headerBg: styleOverrides.headerBg,
    logoPosition: styleOverrides.logoPosition,
    fontScale: styleOverrides.fontScale,
    showPaymentTerms: styleOverrides.showPaymentTerms,
    paymentTermsText: paymentTerms,
    showNotes: styleOverrides.showNotes,
    notesText: notes,
    footerText: styleOverrides.footerText,
  }), [styleOverrides, paymentTerms, notes]);

  const applyStyle = useCallback((style: InvoiceStyle) => {
    setStyleOverrides({
      accentColor: style.accentColor,
      headerBg: style.headerBg,
      logoPosition: style.logoPosition,
      fontScale: clampFontScale(style.fontScale),
      showPaymentTerms: style.showPaymentTerms,
      showNotes: style.showNotes,
      footerText: style.footerText,
    });
    setPaymentTerms(style.paymentTermsText);
    setNotes(style.notesText);
  }, []);

  const jobIdNum = selectedJobId !== "none" ? parseInt(selectedJobId) : undefined;
  const selectedJob = jobs?.find((j) => j.id === jobIdNum);
  const selectedClient = clients?.find((c) =>
    selectedJob
      ? c.id === selectedJob.clientId
      : selectedClientId !== "none" ? c.id === parseInt(selectedClientId) : false
  );

  const { data: jobEstimates } = useListEstimates(
    jobIdNum ? { jobId: jobIdNum } : {}
  );
  const { data: importedEstimate } = useGetEstimate(importEstimateId ?? 0);

  useEffect(() => {
    if (!importedEstimate) return;
    const items: LineItem[] = importedEstimate.items.map((item) => ({
      id: crypto.randomUUID(),
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
    }));
    if (items.length > 0) {
      setLineItems(items);
      toast({ title: `Imported ${items.length} items from estimate` });
    }
    setImportEstimateId(null);
  }, [importedEstimate, toast]);

  // Auto-populate line items from the job's approved estimate when a job is
  // first selected and no items have been entered yet.
  useEffect(() => {
    if (!jobIdNum || autoImportedJobId === jobIdNum) return;
    const lineItemsEmpty = lineItems.every((i) => !i.description.trim() && i.unitPrice === 0);
    if (!lineItemsEmpty) return;
    const approved = jobEstimates?.find((e) => e.status === "approved");
    if (approved) {
      setImportEstimateId(approved.id);
      setAutoImportedJobId(jobIdNum);
    }
  }, [jobIdNum, jobEstimates, lineItems, autoImportedJobId]);

  const addLineItem = () => setLineItems((prev) => [...prev, newLineItem()]);
  const removeLineItem = (id: string) => setLineItems((prev) => prev.filter((i) => i.id !== id));
  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) =>
    setLineItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));

  const subtotal = lineItems.reduce((s, i) => s + lineTotal(i), 0);
  const taxAmount = parseFloat(((taxRate / 100) * subtotal).toFixed(2));
  const totalAmount = subtotal + taxAmount;

  const handleAiGenerate = useCallback(async () => {
    try {
      const result = await aiDescription.mutateAsync({
        data: {
          jobId: selectedJob?.id,
          jobTitle: selectedJob?.title ?? "Construction Services",
          jobType: selectedJob?.jobType ?? undefined,
          notes: aiNotes || undefined,
          lineItems: lineItems.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unit: i.unit,
            unitPrice: i.unitPrice,
            amount: lineTotal(i),
          })),
        },
      });
      setServicesDescription(result.servicesDescription);
      setPaymentTerms(result.paymentTerms);
      toast({ title: "AI description generated!" });
    } catch {
      toast({ title: "AI generation failed", variant: "destructive" });
    }
  }, [selectedJob, lineItems, aiNotes, aiDescription, toast]);

  const handleSave = useCallback(async () => {
    try {
      const invoice = await createInvoice.mutateAsync({
        data: {
          jobId: selectedJob?.id ?? undefined,
          clientId: selectedClient?.id ?? undefined,
          invoiceNumber,
          invoiceDate,
          dueDate,
          totalAmount,
          taxRate: taxRate > 0 ? taxRate : undefined,
          taxAmount: taxRate > 0 ? taxAmount : undefined,
          lineItemsJson: serializeLineItems(lineItems, styleOverrides),
          servicesDescription: servicesDescription || undefined,
          paymentTerms: paymentTerms || undefined,
          notes: notes || undefined,
          template,
        },
      });
      toast({ title: "Invoice saved!" });
      setLocation(`/invoices/${invoice.id}/edit`);
    } catch {
      toast({ title: "Failed to save invoice", variant: "destructive" });
    }
  }, [selectedJob, selectedClient, invoiceNumber, invoiceDate, dueDate, totalAmount, taxRate, taxAmount, lineItems, servicesDescription, paymentTerms, notes, template, styleOverrides, createInvoice, setLocation, toast]);

  const logoUrl = company?.logoUrl ?? null;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex items-center gap-3 px-6 py-4 border-b bg-background print-hide flex-wrap">
        <Link href="/invoices">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Invoices
          </Button>
        </Link>
        <h1 className="text-xl font-bold flex-1">New Invoice</h1>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
          <Download className="h-4 w-4" /> Download PDF
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
          <Printer className="h-4 w-4" /> Print
        </Button>
        <Button size="sm" onClick={handleSave} disabled={createInvoice.isPending} className="gap-1.5">
          {createInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Invoice
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-96 border-r bg-muted/20 overflow-y-auto p-5 space-y-6 print-hide">
          <InvoiceAIChat current={buildCurrentStyle} onApply={applyStyle} />

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Template</Label>
            <TemplatePicker value={template} onChange={setTemplate} />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Job & Client</Label>
            <div className="space-y-2">
              <Label className="text-sm">Job</Label>
              <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select a job" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No job</SelectItem>
                  {jobs?.map((j) => (
                    <SelectItem key={j.id} value={String(j.id)}>{j.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedJobId === "none" && (
              <div className="space-y-2">
                <Label className="text-sm">Client</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No client</SelectItem>
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selectedClient && (
              <div className="text-sm text-muted-foreground rounded-md bg-muted px-3 py-2">
                Client: <span className="font-medium text-foreground">{selectedClient.name}</span>
                {selectedClient.address && <div className="text-xs mt-0.5">{selectedClient.address}</div>}
              </div>
            )}

            {jobEstimates && jobEstimates.length > 0 && (
              <div className="rounded-md border bg-background p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4 text-primary" />
                  Import from estimate
                </div>
                <Select
                  value="none"
                  onValueChange={(val) => { if (val !== "none") setImportEstimateId(parseInt(val)); }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Choose estimate…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose estimate…</SelectItem>
                    {jobEstimates.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.estimateNumber || `EST-${e.id}`} · {e.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Selecting replaces current line items.</p>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Invoice Details</Label>
            <div className="space-y-2">
              <Label className="text-sm">Invoice #</Label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="bg-background" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-sm">Invoice Date</Label>
                <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Due Date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="bg-background" />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Line Items</Label>
              <Button variant="ghost" size="sm" onClick={addLineItem} className="h-7 gap-1 text-xs">
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {lineItems.map((item, idx) => (
                <div key={item.id} className="rounded-lg border bg-background p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5 shrink-0 font-mono">{idx + 1}.</span>
                    <Input
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                      placeholder="Description"
                      className="flex-1 h-8 text-sm"
                    />
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeLineItem(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pl-7">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Qty</Label>
                      <Input type="number" min="0" value={item.quantity} onChange={(e) => updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)} className="h-7 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Unit</Label>
                      <Input value={item.unit} onChange={(e) => updateLineItem(item.id, "unit", e.target.value)} className="h-7 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Unit Price</Label>
                      <Input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateLineItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)} className="h-7 text-sm" />
                    </div>
                  </div>
                  <div className="pl-7 text-xs text-muted-foreground text-right">= {formatCurrency(lineTotal(item))}</div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Tax Rate (%)</Label>
              <Input
                type="number" min="0" max="100" step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="bg-background h-8"
              />
            </div>
            <div className="rounded-md bg-muted px-3 py-2 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax ({taxRate}%)</span><span className="tabular-nums">{formatCurrency(taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1">
                <span>Total</span><span className="tabular-nums">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> AI Description
            </Label>
            <Textarea value={aiNotes} onChange={(e) => setAiNotes(e.target.value)} placeholder="Notes for AI (optional)..." className="bg-background resize-none h-16 text-sm" />
            <Button variant="outline" size="sm" onClick={handleAiGenerate} disabled={aiDescription.isPending} className="w-full gap-2 border-amber-300 text-amber-700 hover:bg-amber-50">
              {aiDescription.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate with AI
            </Button>
            <div className="space-y-2">
              <Label className="text-sm">Services Description</Label>
              <Textarea value={servicesDescription} onChange={(e) => setServicesDescription(e.target.value)} placeholder="Professional description of services rendered..." className="bg-background resize-none h-20 text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Payment Terms</Label>
              <Textarea value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g. Net 30 — Payment due within 30 days..." className="bg-background resize-none h-16 text-sm" />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes..." className="bg-background resize-none h-20 text-sm" />
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto bg-muted/40 p-6 print-invoice-main">
          <div className="max-w-3xl mx-auto">
            <InvoiceDocument
              template={template}
              invoiceNumber={invoiceNumber}
              invoiceDate={invoiceDate}
              dueDate={dueDate}
              companyName={company?.name ?? "Your Company"}
              companyAddress={company?.address ?? ""}
              companyPhone={company?.phone ?? ""}
              companyEmail={company?.email ?? ""}
              logoUrl={logoUrl}
              clientName={selectedClient?.name ?? ""}
              clientAddress={selectedClient?.address ?? ""}
              jobTitle={selectedJob?.title ?? ""}
              lineItems={lineItems}
              servicesDescription={servicesDescription}
              paymentTerms={paymentTerms}
              notes={notes}
              taxRate={taxRate > 0 ? taxRate : undefined}
              taxAmount={taxRate > 0 ? taxAmount : undefined}
              style={styleOverrides}
              onEditInvoiceNumber={setInvoiceNumber}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
