import { useCallback, useState } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetInvoice,
  useUpdateInvoice,
  useCreatePayment,
  useGetCompany,
} from "@workspace/api-client-react";
import type { InvoiceDetail as InvoiceDetailType, Company, Payment } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Printer, Plus, CheckCircle, AlertCircle, Clock,
  Loader2, Pencil, Send,
} from "lucide-react";
import { type LineItem, type Template, lineTotal } from "./invoice-types";
import "./invoice-templates.css";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft:   { label: "Draft",   variant: "secondary" },
  sent:    { label: "Sent",    variant: "default" },
  unpaid:  { label: "Unpaid",  variant: "secondary" },
  partial: { label: "Partial", variant: "default" },
  paid:    { label: "Paid",    variant: "outline" },
  overdue: { label: "Overdue", variant: "destructive" },
};

function InvoiceDocView({
  template,
  invoice,
  company,
  lineItems,
}: {
  template: Template;
  invoice: InvoiceDetailType;
  company: Company | undefined;
  lineItems: LineItem[];
}) {
  const logoUrl = company?.logoUrl ?? null;
  const subtotal = lineItems.reduce((s, i) => s + lineTotal(i), 0);

  const headerContent = (
    <>
      <div className="inv-company-block">
        {logoUrl && <img src={logoUrl} alt="logo" className="inv-logo" />}
        <div className="inv-company-name">{company?.name ?? ""}</div>
        {company?.address && <div className="inv-company-meta">{company.address}</div>}
        {(company?.phone || company?.email) && (
          <div className="inv-company-meta">
            {company.phone}{company.phone && company.email ? " · " : ""}{company.email}
          </div>
        )}
      </div>
      <div className="inv-number-block">
        <div className="inv-label">INVOICE</div>
        <div className="inv-num"><span className="inv-num-text">{invoice.invoiceNumber || `INV-${invoice.id}`}</span></div>
        <div className="inv-date-row"><span className="inv-date-label">Date:</span> {invoice.invoiceDate || "—"}</div>
        <div className="inv-date-row"><span className="inv-date-label">Due:</span> {invoice.dueDate || "—"}</div>
      </div>
    </>
  );

  return (
    <div className={`invoice-doc template-${template} print-only`} id="invoice-document">
      <div className={template === "bold" ? "inv-header-bold" : "inv-header-std"}>
        {headerContent}
      </div>

      <div className="inv-bill-row">
        <div className="inv-bill-to">
          <div className="inv-section-label">BILL TO</div>
          <div className="inv-client-name">{invoice.clientName || "—"}</div>
        </div>
        {invoice.jobTitle && (
          <div className="inv-project">
            <div className="inv-section-label">PROJECT</div>
            <div className="inv-project-name">{invoice.jobTitle}</div>
          </div>
        )}
      </div>

      {invoice.servicesDescription && (
        <div className="inv-services">
          <div className="inv-section-label">SERVICES RENDERED</div>
          <div className="inv-services-text">{invoice.servicesDescription}</div>
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
            <tr><td colSpan={5} className="inv-td inv-td-empty">No line items.</td></tr>
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

      {invoice.paymentTerms && (
        <div className="inv-payment-terms">
          <div className="inv-section-label">PAYMENT TERMS</div>
          <div className="inv-payment-text">{invoice.paymentTerms}</div>
        </div>
      )}
      {invoice.notes && (
        <div className="inv-notes">
          <div className="inv-section-label">NOTES</div>
          <div className="inv-notes-text">{invoice.notes}</div>
        </div>
      )}
      <div className="inv-footer"><div className="inv-footer-text">Thank you for your business!</div></div>
    </div>
  );
}

export default function InvoiceDetailPage() {
  const [, params] = useRoute("/invoices/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const { toast } = useToast();

  const { data: invoice, isLoading } = useGetInvoice(id);
  const { data: company } = useGetCompany();
  const updateInvoice = useUpdateInvoice();

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("check");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const createPayment = useCreatePayment();

  const lineItems: LineItem[] = (() => {
    if (!invoice?.lineItemsJson) return [];
    try { return JSON.parse(invoice.lineItemsJson) as LineItem[]; } catch { return []; }
  })();

  const template: Template = (invoice?.template as Template) ?? "clean";
  const statusInfo = STATUS_MAP[invoice?.status ?? "draft"] ?? STATUS_MAP.draft;
  const payments: Payment[] = invoice?.payments ?? [];

  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!invoice) return;
    try {
      await updateInvoice.mutateAsync({ id, data: { status: newStatus, totalAmount: invoice.totalAmount } });
      toast({ title: `Invoice marked as ${newStatus}` });
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  }, [invoice, id, updateInvoice, toast]);

  const handleAddPayment = useCallback(async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) return;
    try {
      await createPayment.mutateAsync({ invoiceId: id, data: { amount, method: paymentMethod, date: paymentDate } });
      setPaymentOpen(false);
      setPaymentAmount("");
      toast({ title: "Payment recorded" });
    } catch {
      toast({ title: "Failed to record payment", variant: "destructive" });
    }
  }, [paymentAmount, paymentMethod, paymentDate, id, createPayment, toast]);

  if (isLoading) return <div className="p-8"><Skeleton className="h-96 w-full max-w-3xl mx-auto" /></div>;
  if (!invoice) return <div className="p-8 text-muted-foreground">Invoice not found.</div>;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex items-center gap-3 px-6 py-4 border-b bg-background print-hide flex-wrap">
        <Link href="/invoices">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Invoices
          </Button>
        </Link>
        <h1 className="text-xl font-bold flex-1 min-w-0 truncate">
          {invoice.invoiceNumber || `INV-${invoice.id}`}
        </h1>
        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>

        <Link href={`/invoices/${id}/edit`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Pencil className="h-4 w-4" /> Edit Invoice
          </Button>
        </Link>

        {invoice.status === "draft" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleStatusChange("sent")}
            disabled={updateInvoice.isPending}
            className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            {updateInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Mark Sent
          </Button>
        )}
        {invoice.status !== "paid" && invoice.status !== "draft" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleStatusChange("paid")}
            disabled={updateInvoice.isPending}
            className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50"
          >
            {updateInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Mark Paid
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={() => setPaymentOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Record Payment
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
          <Printer className="h-4 w-4" /> Print / PDF
        </Button>
      </div>

      <div className="flex flex-1">
        <aside className="w-72 border-r bg-muted/20 p-5 space-y-5 print-hide shrink-0">
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Summary</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold tabular-nums">{formatCurrency(invoice.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span className="font-semibold text-green-700 tabular-nums">{formatCurrency(invoice.amountPaid)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground font-medium">Balance Due</span>
                <span className="font-bold tabular-nums">{formatCurrency(invoice.balanceDue)}</span>
              </div>
            </div>
          </div>

          {(invoice.invoiceDate || invoice.dueDate) && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Dates</div>
              {invoice.invoiceDate && (
                <div className="text-sm flex justify-between">
                  <span className="text-muted-foreground">Invoice Date</span>
                  <span>{formatDate(invoice.invoiceDate)}</span>
                </div>
              )}
              {invoice.dueDate && (
                <div className="text-sm flex justify-between">
                  <span className="text-muted-foreground">Due Date</span>
                  <span>{formatDate(invoice.dueDate)}</span>
                </div>
              )}
            </div>
          )}

          {payments.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Payments</div>
              <div className="space-y-1.5">
                {payments.map((p) => (
                  <div key={p.id} className="text-sm rounded bg-green-50 px-2.5 py-1.5">
                    <div className="font-medium text-green-800">{formatCurrency(p.amount)}</div>
                    <div className="text-[11px] text-green-600">{p.method} · {formatDate(p.date)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="flex-1 overflow-y-auto bg-muted/40 p-6 print-invoice-main">
          <div className="max-w-3xl mx-auto">
            <InvoiceDocView template={template} invoice={invoice} company={company} lineItems={lineItems} />
          </div>
        </main>
      </div>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" min="0" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder={`Balance: ${formatCurrency(invoice.balanceDue)}`} />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button onClick={handleAddPayment} disabled={createPayment.isPending || !paymentAmount}>
              {createPayment.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
