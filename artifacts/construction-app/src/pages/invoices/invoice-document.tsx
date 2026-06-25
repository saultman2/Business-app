import { formatCurrency } from "@/lib/format";
import { type LineItem, type Template, lineTotal } from "./invoice-types";

export function InvoiceDocument({
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
  taxRate,
  taxAmount,
  onEditInvoiceNumber,
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
  clientAddress?: string | null;
  jobTitle: string;
  lineItems: LineItem[];
  servicesDescription: string;
  paymentTerms: string;
  notes: string;
  taxRate?: number;
  taxAmount?: number;
  onEditInvoiceNumber?: (v: string) => void;
}) {
  const subtotal = lineItems.reduce((s, i) => s + lineTotal(i), 0);
  const effectiveTax = taxAmount ?? ((taxRate ?? 0) / 100) * subtotal;
  const total = subtotal + effectiveTax;

  const numEl = onEditInvoiceNumber ? (
    <span
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onEditInvoiceNumber(e.currentTarget.textContent ?? "")}
      className="outline-none border-b border-dashed border-transparent hover:border-muted-foreground focus:border-primary cursor-text inv-num-text"
    >
      {invoiceNumber}
    </span>
  ) : (
    <span className="inv-num-text">{invoiceNumber}</span>
  );

  return (
    <div className={`invoice-doc template-${template} print-only`} id="invoice-document">
      <div className={template === "bold" ? "inv-header-bold" : "inv-header-std"}>
        <div className="inv-company-block">
          {logoUrl && <img src={logoUrl} alt="logo" className="inv-logo" />}
          <div className="inv-company-name">{companyName}</div>
          {companyAddress && <div className="inv-company-meta">{companyAddress}</div>}
          {(companyPhone || companyEmail) && (
            <div className="inv-company-meta">
              {companyPhone}{companyPhone && companyEmail ? " · " : ""}{companyEmail}
            </div>
          )}
        </div>
        <div className="inv-number-block">
          <div className="inv-label">INVOICE</div>
          <div className="inv-num">{numEl}</div>
          <div className="inv-date-row"><span className="inv-date-label">Date:</span> {invoiceDate || "—"}</div>
          <div className="inv-date-row"><span className="inv-date-label">Due:</span> {dueDate || "—"}</div>
        </div>
      </div>

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
            <tr><td colSpan={5} className="inv-td inv-td-empty">No line items added yet.</td></tr>
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
          {(taxRate ?? 0) > 0 ? (
            <>
              <tr>
                <td colSpan={4} className="inv-tf-label inv-tf-sub">Subtotal</td>
                <td className="inv-tf-total inv-tf-sub">{formatCurrency(subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={4} className="inv-tf-label inv-tf-sub">Tax ({taxRate}%)</td>
                <td className="inv-tf-total inv-tf-sub">{formatCurrency(effectiveTax)}</td>
              </tr>
              <tr>
                <td colSpan={4} className="inv-tf-label">Total</td>
                <td className="inv-tf-total">{formatCurrency(total)}</td>
              </tr>
            </>
          ) : (
            <tr>
              <td colSpan={4} className="inv-tf-label">Total</td>
              <td className="inv-tf-total">{formatCurrency(subtotal)}</td>
            </tr>
          )}
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
