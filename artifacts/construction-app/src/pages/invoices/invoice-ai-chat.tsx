import { useState, useRef, useEffect, useCallback } from "react";
import { useAiInvoiceDesign } from "@workspace/api-client-react";
import type { InvoiceStyle } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Loader2, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  role: "assistant" | "user";
  text: string;
}

const SUGGESTIONS = [
  "Make it blue",
  "Center the logo",
  "Add a dark header",
  "Bigger text",
];

const WELCOME =
  "Your invoice is ready. Tell me what you'd like to change — try \"make it blue\", \"center the logo\", \"add a thank-you note\", or \"hide payment terms\".";

export function InvoiceAIChat({
  current,
  onApply,
}: {
  /** Builds the full current style snapshot to send to the AI. */
  current: () => InvoiceStyle;
  /** Applies the AI's returned style to the page state. */
  onApply: (style: InvoiceStyle) => void;
}) {
  const { toast } = useToast();
  const design = useAiInvoiceDesign();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: WELCOME },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, design.isPending]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || design.isPending) return;
      setMessages((prev) => [...prev, { role: "user", text: message }]);
      setInput("");
      try {
        const result = await design.mutateAsync({
          data: { message, current: current() },
        });
        onApply(result.style);
        setMessages((prev) => [...prev, { role: "assistant", text: result.reply }]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "Sorry, I couldn't update the design just now. Please try again.",
          },
        ]);
        toast({ title: "AI design update failed", variant: "destructive" });
      }
    },
    [current, onApply, design, toast],
  );

  return (
    <div className="flex flex-col rounded-lg border bg-background overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-gradient-to-r from-violet-50 to-blue-50">
        <Wand2 className="h-4 w-4 text-violet-600" />
        <span className="text-sm font-semibold">AI Design Assistant</span>
      </div>

      <div ref={scrollRef} className="max-h-72 overflow-y-auto p-3 space-y-2.5">
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                m.role === "user"
                  ? "rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3 py-2 text-sm max-w-[85%]"
                  : "rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm max-w-[90%]"
              }
            >
              {m.text}
            </div>
          </div>
        ))}
        {design.isPending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating design…
            </div>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              disabled={design.isPending}
              className="text-xs rounded-full border border-violet-200 bg-violet-50 text-violet-700 px-2.5 py-1 hover:bg-violet-100 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t p-2"
      >
        <Sparkles className="h-4 w-4 text-violet-500 shrink-0 ml-1" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe a change…"
          disabled={design.isPending}
          className="h-9 text-sm border-0 shadow-none focus-visible:ring-0 px-1"
        />
        <Button type="submit" size="sm" disabled={design.isPending || !input.trim()} className="h-8 w-8 p-0 shrink-0">
          {design.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
