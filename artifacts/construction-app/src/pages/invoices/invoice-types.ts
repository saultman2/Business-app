export type Template = "clean" | "classic" | "bold";

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export function lineTotal(item: LineItem): number {
  return parseFloat((item.quantity * item.unitPrice).toFixed(2));
}

export function newLineItem(): LineItem {
  return { id: crypto.randomUUID(), description: "", quantity: 1, unit: "ea", unitPrice: 0 };
}

export const TEMPLATE_INFO: Record<Template, { label: string; tag: string; bg: string; accent: string }> = {
  clean:   { label: "Clean / Modern",    tag: "Minimal",      bg: "bg-white",      accent: "bg-blue-600" },
  classic: { label: "Classic / Formal",  tag: "Professional", bg: "bg-amber-50",   accent: "bg-amber-800" },
  bold:    { label: "Bold / Contractor", tag: "High Impact",  bg: "bg-slate-800",  accent: "bg-orange-500" },
};
