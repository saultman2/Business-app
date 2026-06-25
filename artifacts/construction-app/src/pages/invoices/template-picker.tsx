import { Check } from "lucide-react";
import { type Template, TEMPLATE_INFO } from "./invoice-types";

export function TemplatePicker({ value, onChange }: { value: Template; onChange: (t: Template) => void }) {
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
            className={`relative rounded-lg border-2 overflow-hidden text-left transition-all ${active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-muted-foreground"}`}
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
