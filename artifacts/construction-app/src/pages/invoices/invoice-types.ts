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

export type LogoPosition = "left" | "center" | "right";

/** Visual/structural style overrides controlled by the AI design assistant. */
export interface StyleOverrides {
  accentColor: string;   // hex like "#2563eb", or "" to use template default
  headerBg: string;      // hex header band color, or "" for none
  logoPosition: LogoPosition;
  fontScale: number;     // 0.85–1.3, 1 = default
  showPaymentTerms: boolean;
  showNotes: boolean;
  footerText: string;
}

export function defaultStyleOverrides(): StyleOverrides {
  return {
    accentColor: "",
    headerBg: "",
    logoPosition: "left",
    fontScale: 1,
    showPaymentTerms: true,
    showNotes: true,
    footerText: "Thank you for your business!",
  };
}

export function clampFontScale(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(1.3, Math.max(0.85, n));
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const LOGO_POSITIONS: readonly LogoPosition[] = ["left", "center", "right"];

/** Coerce a possibly-malformed style object into safe, renderable values. */
export function sanitizeStyleOverrides(input: Partial<StyleOverrides>): StyleOverrides {
  const d = defaultStyleOverrides();
  const color = (v: unknown): string =>
    typeof v === "string" && (v === "" || HEX_RE.test(v.trim())) ? v.trim() : "";
  return {
    accentColor: color(input.accentColor),
    headerBg: color(input.headerBg),
    logoPosition: LOGO_POSITIONS.includes(input.logoPosition as LogoPosition)
      ? (input.logoPosition as LogoPosition)
      : d.logoPosition,
    fontScale: clampFontScale(typeof input.fontScale === "number" ? input.fontScale : 1),
    showPaymentTerms: typeof input.showPaymentTerms === "boolean" ? input.showPaymentTerms : d.showPaymentTerms,
    showNotes: typeof input.showNotes === "boolean" ? input.showNotes : d.showNotes,
    footerText: typeof input.footerText === "string" ? input.footerText : d.footerText,
  };
}

/**
 * Line items are persisted in the invoice's `lineItemsJson` column. To also
 * persist style overrides without a schema change, the column stores an
 * envelope `{ items, style }`. Older invoices stored a bare array — both are
 * accepted on read.
 */
export interface LineItemsEnvelope {
  items: LineItem[];
  style?: StyleOverrides;
}

export function serializeLineItems(items: LineItem[], style: StyleOverrides): string {
  return JSON.stringify({ items, style } satisfies LineItemsEnvelope);
}

export function parseLineItems(json: string | null | undefined): {
  items: LineItem[];
  style: StyleOverrides;
} {
  const fallback = { items: [] as LineItem[], style: defaultStyleOverrides() };
  if (!json) return fallback;
  try {
    const parsed = JSON.parse(json) as LineItem[] | LineItemsEnvelope;
    if (Array.isArray(parsed)) {
      return { items: parsed, style: defaultStyleOverrides() };
    }
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      style: sanitizeStyleOverrides(parsed.style ?? {}),
    };
  } catch {
    return fallback;
  }
}
