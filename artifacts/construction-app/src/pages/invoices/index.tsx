import { useListInvoices } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, FileText } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft:   { label: "Draft",   variant: "secondary" },
  sent:    { label: "Sent",    variant: "default" },
  unpaid:  { label: "Unpaid",  variant: "secondary" },
  partial: { label: "Partial", variant: "default" },
  paid:    { label: "Paid",    variant: "outline" },
  overdue: { label: "Overdue", variant: "destructive" },
};

export default function InvoicesPage() {
  const { data: invoices, isLoading } = useListInvoices({});

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
        <Link href="/invoices/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> New Invoice
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : !invoices?.length ? (
        <div className="text-center py-20 border rounded-xl bg-card space-y-4">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <div>
            <p className="font-semibold text-lg">No invoices yet</p>
            <p className="text-sm text-muted-foreground">Create your first invoice to start billing clients.</p>
          </div>
          <Link href="/invoices/new">
            <Button className="gap-2"><Plus className="h-4 w-4" /> Create Invoice</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => {
            const status = STATUS_MAP[invoice.status] ?? STATUS_MAP.unpaid;
            return (
              <Link key={invoice.id} href={`/invoices/${invoice.id}/edit`}>
                <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{invoice.invoiceNumber || `INV-${invoice.id}`}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {invoice.clientName || "No client"}{invoice.jobTitle ? ` · ${invoice.jobTitle}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="font-bold tabular-nums">{formatCurrency(invoice.totalAmount)}</div>
                        <div className="text-xs text-muted-foreground">
                          {invoice.dueDate ? `Due ${formatDate(invoice.dueDate)}` : "No due date"}
                        </div>
                      </div>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
