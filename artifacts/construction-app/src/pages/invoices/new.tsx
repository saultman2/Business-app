import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import {
  useCreateInvoice,
  useListJobs,
  useListClients,
  useGetCompany,
  useAiInvoiceDescription,
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
import { Badge } from "@/components/ui/badge";
import {
  Printer,
  Sparkles,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Loader2,
  Check,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Link } from "wouter";
import "./invoice-templates.css";

type Template = "clean" | "classic" | "bold";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

function lineTotal(item: LineItem): number {
  return parseFloat((item.quantity * item.unitPrice).toFixed(2));
}

function newItem(): LineItem {
  return {
    id: crypto.randomUUID(),
    description: "",
    quantity: 1,
    unit: "ea",
    unitPrice: 0,
  };
}

const TEMPLATE_INFO: Record<Template, { label: string; tag: string; bg: string; accent: string }> = {
  clean: {
    label: "Clean / Modern",
    tag: "Minimal",
    bg: "bg-white",
    accent: "bg-blue-600",
  },
  classic: {
    label: "Classic / Formal",
    tag: "Professional",
    bg: "bg-amber-50",
    accent: "bg-amber-800",
  },
  bold: {
    label: "Bold / Contractor",
    tag: "High Impact",
    bg: "bg-slate-800",
    accent: "bg-orange-500",
  },
};

function TemplatePicker({
  value,
  onChange,
}: {
  value: Template;
  onChange: (t: Template) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {(Object.keys(TEMPLATE_INFO) as Template[]).map((t) => {
        const info = TEMPLATE_INFO[t];
        const active = value === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={`relative rounded-lg border-2 overflow-hidden text-left transition-all ${
              active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-muted-foreground"
            }`}
          >
            <div className={`h-16 ${info.bg} flex flex-col p-2 gap-1`}>
              <div className={`h-2 w-12 rounded ${info.accent}`} />
              <div className="h-1.5 w-8 rounded bg-gray-300 mt-0.5" />
              <div className="h-1 w-10 rounded bg-gray-200" />
              <div className="h-1 w-6 rounded bg-gray-200" />
            </div>
            <div className="p-2 bg-background border-t border-border">
              <div className="text-xs font-semibold leading-tight">{info.label}</div>
              <div className="text-[10px] text-muted-foreground">{info.tag}</div>
            </div>
            {active && (
              <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                <Check className="h-2.5 w-2.5" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function InvoiceDocument({
  template,
  invoiceNumber,
  invoiceDate,
  dueDate,
  companyName,
  companyAddress,
  companyPhone,
  companyEmail,
  logoUrl,
  clientName,
  clientAddress,
  jobTitle,
  lineItems,
  servicesDescription,
  paymentTerms,
  notes,
  onEdit,
}: {
  template: Template;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  logoUrl?: string | null;
  clientName: string;
  clientAddress: string;
  jobTitle: string;
  lineItems: LineItem[];
  servicesDescription: string;
  paymentTerms: string;
  notes: string;
  onEdit?: (field: string, value: string) => void;
}) {
  const subtotal = lineItems.reduce((s, i) => s + lineTotal(i), 0);

  const el = (field: string, val: string, cls?: string) =>
    onEdit ? (
      <span
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onEdit(field, e.currentTarget.textContent ?? "")}
        className={`outline-none border-b border-dashed border-transparent hover:border-muted-foreground focus:border-primary ${cls ?? ""}`}
      >
        {val}
      </span>
    ) : (
      <span className={cls}>{val}</span>
    );

  return (
    <div className={`invoice-doc template-${template} print-only`} id="invoice-document">
      {template === "bold" ? (
        <div className="inv-header-bold">
          <div className="inv-company-block">
            {logoUrl && <img src={logoUrl} alt="logo" className="inv-logo" />}
            <div className="inv-company-name">{companyName}</div>
            <div className="inv-company-meta">{companyAddress}</div>
            <div className="inv-company-meta">{companyPhone} • {companyEmail}</div>
          </div>
          <div className="inv-number-block">
            <div className="inv-label">INVOICE</div>
            <div className="inv-num">{el("invoiceNumber", invoiceNumber, "inv-num-text")}</div>
            <div className="inv-date-row"><span className="inv-date-label">Date:</span> {invoiceDate || "—"}</div>
            <div className="inv-date-row"><span className="inv-date-label">Due:</span> {dueDate || "—"}</div>
          </div>
        </div>
      ) : (
        <div className="inv-header-std">
          <div className="inv-company-block">
            {logoUrl && <img src={logoUrl} alt="logo" className="inv-logo" />}
            <div className="inv-company-name">{companyName}</div>
            <div className="inv-company-meta">{companyAddress}</div>
            <div className="inv-company-meta">{companyPhone} • {companyEmail}</div>
          </div>
          <div className="inv-number-block">
            <div className="inv-label">INVOICE</div>
            <div className="inv-num">{el("invoiceNumber", invoiceNumber, "inv-num-text")}</div>
            <div className="inv-date-row"><span className="inv-date-label">Date:</span> {invoiceDate || "—"}</div>
            <div className="inv-date-row"><span className="inv-date-label">Due:</span> {dueDate || "—"}</div>
          </div>
        </div>
      )}

      <div className="inv-bill-row">
        <div className="inv-bill-to">
          <div className="inv-section-label">BILL TO</div>
          <div className="inv-client-name">{clientName || "Client Name"}</div>
          {clientAddress && <div className="inv-client-addr">{clientAddress}</div>}
        </div>
        {jobTitle && (
          <div className="inv-project">
            <div className="inv-section-label">PROJECT</div>
            <div className="inv-project-name">{jobTitle}</div>
          </div>
        )}
      </div>

      {servicesDescription && (
        <div className="inv-services">
          <div className="inv-section-label">SERVICES RENDERED</div>
          <div className="inv-services-text">{servicesDescription}</div>
        </div>
      )}

      <table className="inv-table">
        <thead>
          <tr>
            <th className="inv-th inv-th-desc">Description</th>
            <th className="inv-th inv-th-num">Qty</th>
            <th className="inv-th inv-th-num">Unit</th>
            <th className="inv-th inv-th-num">Unit Price</th>
            <th className="inv-th inv-th-num inv-th-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.length === 0 ? (
            <tr>
              <td colSpan={5} className="inv-td inv-td-empty">No line items added yet.</td>
            </tr>
          ) : (
            lineItems.map((item) => (
              <tr key={item.id}>
                <td className="inv-td">{item.description}</td>
                <td className="inv-td inv-td-num">{item.quantity}</td>
                <td className="inv-td inv-td-num">{item.unit}</td>
                <td className="inv-td inv-td-num">{formatCurrency(item.unitPrice)}</td>
                <td className="inv-td inv-td-num inv-td-right">{formatCurrency(lineTotal(item))}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="inv-tf-label">Total</td>
            <td className="inv-tf-total">{formatCurrency(subtotal)}</td>
          </tr>
        </tfoot>
      </table>

      {paymentTerms && (
        <div className="inv-payment-terms">
          <div className="inv-section-label">PAYMENT TERMS</div>
          <div className="inv-payment-text">{paymentTerms}</div>
        </div>
      )}

      {notes && (
        <div className="inv-notes">
          <div className="inv-section-label">NOTES</div>
          <div className="inv-notes-text">{notes}</div>
        </div>
      )}

      <div className="inv-footer">
        <div className="inv-footer-text">Thank you for your business!</div>
      </div>
    </div>
  );
}

export default function NewInvoicePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: company } = useGetCompany();
  const { data: jobs } = useListJobs({});
  const { data: clients } = useListClients({});

  const createInvoice = useCreateInvoice();
  const aiDescription = useAiInvoiceDescription();

  const [template, setTemplate] = useState<Template>("clean");
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState<string>(
    `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`
  );
  const [invoiceDate, setInvoiceDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([newItem()]);
  const [servicesDescription, setServicesDescription] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [aiNotes, setAiNotes] = useState("");

  const selectedJob = jobs?.find((j) => String(j.id) === selectedJobId);
  const selectedClient = clients?.find((c) =>
    selectedJob ? String(c.id) === String(selectedJob.clientId) : String(c.id) === selectedClientId
  );

  const addLineItem = () => setLineItems((prev) => [...prev, newItem()]);
  const removeLineItem = (id: string) =>
    setLineItems((prev) => prev.filter((i) => i.id !== id));
  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) =>
    setLineItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );

  const subtotal = lineItems.reduce((s, i) => s + lineTotal(i), 0);

  const handleAiGenerate = useCallback(async () => {
    if (!selectedJob && !invoiceNumber) {
      toast({ title: "Please select a job first", variant: "destructive" });
      return;
    }
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
  }, [selectedJob, lineItems, aiNotes, aiDescription, invoiceNumber, toast]);

  const handleSave = useCallback(async () => {
    try {
      const invoice = await createInvoice.mutateAsync({
        data: {
          jobId: selectedJob?.id ?? undefined,
          clientId: selectedClient?.id ?? undefined,
          invoiceNumber,
          invoiceDate,
          dueDate,
          totalAmount: subtotal,
          lineItemsJson: JSON.stringify(lineItems),
          servicesDescription: servicesDescription || undefined,
          paymentTerms: paymentTerms || undefined,
          notes: notes || undefined,
          template,
        },
      });
      toast({ title: "Invoice saved!" });
      setLocation(`/invoices/${invoice.id}`);
    } catch {
      toast({ title: "Failed to save invoice", variant: "destructive" });
    }
  }, [
    selectedJob, selectedClient, invoiceNumber, invoiceDate, dueDate, subtotal,
    lineItems, servicesDescription, paymentTerms, notes, template,
    createInvoice, setLocation, toast,
  ]);

  const handlePrint = () => window.print();

  const logoUrl = company?.logoUrl ?? null;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex items-center gap-3 px-6 py-4 border-b bg-background print-hide">
        <Link href="/invoices">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Invoices
          </Button>
        </Link>
        <h1 className="text-xl font-bold flex-1">New Invoice</h1>
        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
          <Printer className="h-4 w-4" /> Print / PDF
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={createInvoice.isPending}
          className="gap-1.5"
        >
          {createInvoice.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Invoice
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-96 border-r bg-muted/20 overflow-y-auto p-5 space-y-6 print-hide">
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
                  <SelectItem value="">No job</SelectItem>
                  {jobs?.map((j) => (
                    <SelectItem key={j.id} value={String(j.id)}>
                      {j.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!selectedJob && (
              <div className="space-y-2">
                <Label className="text-sm">Client</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No client</SelectItem>
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selectedClient && (
              <div className="text-sm text-muted-foreground rounded-md bg-muted px-3 py-2">
                Client: <span className="font-medium text-foreground">{selectedClient.name}</span>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Invoice Details</Label>
            <div className="space-y-2">
              <Label className="text-sm">Invoice #</Label>
              <Input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-sm">Invoice Date</Label>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Due Date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-background"
                />
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeLineItem(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pl-7">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Qty</Label>
                      <Input
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                        className="h-7 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Unit</Label>
                      <Input
                        value={item.unit}
                        onChange={(e) => updateLineItem(item.id, "unit", e.target.value)}
                        className="h-7 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Unit Price</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                        className="h-7 text-sm"
                      />
                    </div>
                  </div>
                  <div className="pl-7 text-xs text-muted-foreground text-right">
                    = {formatCurrency(lineTotal(item))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end text-sm font-semibold pr-1">
              Total: {formatCurrency(subtotal)}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> AI Description
            </Label>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Notes for AI (optional)</Label>
              <Textarea
                value={aiNotes}
                onChange={(e) => setAiNotes(e.target.value)}
                placeholder="Any special notes to guide the AI..."
                className="bg-background resize-none h-16 text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAiGenerate}
              disabled={aiDescription.isPending}
              className="w-full gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              {aiDescription.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate with AI
            </Button>
            <div className="space-y-2">
              <Label className="text-sm">Services Description</Label>
              <Textarea
                value={servicesDescription}
                onChange={(e) => setServicesDescription(e.target.value)}
                placeholder="Professional description of services rendered..."
                className="bg-background resize-none h-20 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Payment Terms</Label>
              <Textarea
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="e.g. Net 30 — Payment due within 30 days..."
                className="bg-background resize-none h-16 text-sm"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes to include on the invoice..."
              className="bg-background resize-none h-20 text-sm"
            />
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
              onEdit={(field, value) => {
                if (field === "invoiceNumber") setInvoiceNumber(value);
              }}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
