import type {
  Company,
  Client,
  Job,
  MaterialItem,
  Estimate,
  EstimateItem,
  Invoice,
  Payment,
  JobPhoto,
  Receipt,
  CalendarEvent,
} from "@workspace/db";

export const n = (v: string | number | null | undefined): number =>
  v === null || v === undefined ? 0 : typeof v === "number" ? v : parseFloat(v);

export const nn = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined ? null : typeof v === "number" ? v : parseFloat(v);

export const iso = (d: Date | null | undefined): string | null =>
  d ? d.toISOString() : null;

export function serializeCompany(c: Company) {
  return {
    ...c,
    defaultTaxRate: n(c.defaultTaxRate),
    defaultLaborRate: n(c.defaultLaborRate),
    defaultMarkupPct: n(c.defaultMarkupPct),
    createdAt: c.createdAt.toISOString(),
  };
}

export function serializeClient(c: Client) {
  return { ...c, createdAt: c.createdAt.toISOString() };
}

export function serializeJob(j: Job, clientName: string | null = null) {
  return {
    ...j,
    clientName,
    estimatedValue: nn(j.estimatedValue),
    actualCost: nn(j.actualCost),
    createdAt: j.createdAt.toISOString(),
  };
}

export function serializeMaterialItem(m: MaterialItem) {
  return {
    ...m,
    quantity: n(m.quantity),
    unitPrice: n(m.unitPrice),
    lineTotal: n(m.lineTotal),
  };
}

export function serializeEstimate(
  e: Estimate,
  extra: {
    clientName?: string | null;
    jobTitle?: string | null;
    jobStatus?: string | null;
  } = {},
) {
  return {
    ...e,
    clientName: extra.clientName ?? null,
    jobTitle: extra.jobTitle ?? null,
    jobStatus: extra.jobStatus ?? null,
    laborFlatCost: n(e.laborFlatCost),
    materialSubtotal: n(e.materialSubtotal),
    laborSubtotal: n(e.laborSubtotal),
    equipmentSubtotal: n(e.equipmentSubtotal),
    permitsAmount: n(e.permitsAmount),
    disposalAmount: n(e.disposalAmount),
    deliveryAmount: n(e.deliveryAmount),
    subcontractorAmount: n(e.subcontractorAmount),
    overheadAmount: n(e.overheadAmount),
    otherChargesSubtotal: n(e.otherChargesSubtotal),
    taxRate: n(e.taxRate),
    taxAmount: n(e.taxAmount),
    markupPct: n(e.markupPct),
    markupAmount: n(e.markupAmount),
    discountAmount: n(e.discountAmount),
    depositRequired: n(e.depositRequired),
    total: n(e.total),
    sentAt: iso(e.sentAt),
    approvedAt: iso(e.approvedAt),
    createdAt: e.createdAt.toISOString(),
  };
}

export function serializeEstimateItem(i: EstimateItem) {
  return {
    ...i,
    quantity: n(i.quantity),
    unitPrice: n(i.unitPrice),
    hours: n(i.hours),
    hourlyRate: n(i.hourlyRate),
    lineTotal: n(i.lineTotal),
  };
}

export function serializeInvoice(
  inv: Invoice,
  extra: { clientName?: string | null; jobTitle?: string | null; clientAddress?: string | null } = {},
) {
  return {
    ...inv,
    clientName: extra.clientName ?? null,
    jobTitle: extra.jobTitle ?? null,
    clientAddress: extra.clientAddress ?? null,
    totalAmount: n(inv.totalAmount),
    amountPaid: n(inv.amountPaid),
    balanceDue: n(inv.balanceDue),
    taxRate: inv.taxRate != null ? n(inv.taxRate) : null,
    taxAmount: inv.taxAmount != null ? n(inv.taxAmount) : null,
    createdAt: inv.createdAt.toISOString(),
  };
}

export function serializePayment(p: Payment) {
  return { ...p, amount: n(p.amount), createdAt: p.createdAt.toISOString() };
}

export function serializeJobPhoto(p: JobPhoto) {
  return { ...p, createdAt: p.createdAt.toISOString() };
}

export function serializeReceipt(r: Receipt, jobTitle: string | null = null) {
  return {
    ...r,
    jobTitle,
    amount: n(r.amount),
    createdAt: r.createdAt.toISOString(),
  };
}

export function serializeEvent(
  e: CalendarEvent,
  extra: { jobTitle?: string | null; clientName?: string | null } = {},
) {
  return {
    ...e,
    jobTitle: extra.jobTitle ?? null,
    clientName: extra.clientName ?? null,
    createdAt: e.createdAt.toISOString(),
  };
}

export const toNumStr = (
  v: number | string | null | undefined,
): string | undefined =>
  v === null || v === undefined ? undefined : String(v);
