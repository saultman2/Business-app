import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useGetJob, useCreateEstimate, useCreateEstimateItem } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Plus, Trash2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function JobEstimate() {
  const [, params] = useRoute("/jobs/:id/estimate");
  const jobId = params?.id ? parseInt(params.id) : 0;
  
  const { data: job, isLoading } = useGetJob(jobId);
  const createEstimate = useCreateEstimate();
  const createEstimateItem = useCreateEstimateItem();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isSaving, setIsSaving] = useState(false);

  const [title, setTitle] = useState("Standard Estimate");
  const [items, setItems] = useState([
    { id: 1, description: "Labor", quantity: 1, unitPrice: 0, amount: 0 },
    { id: 2, description: "Materials", quantity: 1, unitPrice: 0, amount: 0 }
  ]);

  const updateItem = (id: number, field: string, value: string | number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updated.amount = Number(updated.quantity) * Number(updated.unitPrice);
        }
        return updated;
      }
      return item;
    }));
  };

  const addItem = () => {
    const newId = Math.max(...items.map(i => i.id), 0) + 1;
    setItems([...items, { id: newId, description: "", quantity: 1, unitPrice: 0, amount: 0 }]);
  };

  const removeItem = (id: number) => {
    setItems(items.filter(i => i.id !== id));
  };

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const estimate = await createEstimate.mutateAsync({
        data: { jobId, title, clientId: job?.clientId },
      });

      const lineItems = items.filter(i => i.description.trim());
      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i];
        await createEstimateItem.mutateAsync({
          estimateId: estimate.id,
          data: {
            section: "material",
            description: item.description.trim(),
            quantity: Number(item.quantity) || 0,
            unit: "ea",
            unitPrice: Number(item.unitPrice) || 0,
            sortOrder: i,
          },
        });
      }

      toast({ title: "Estimate saved as draft" });
      navigate(`/jobs/${jobId}`);
    } catch {
      toast({ title: "Error saving estimate", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 pb-24">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Link href={`/jobs/${jobId}`} className="hover:text-foreground flex items-center transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Job
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Create Estimate</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={createEstimate.isPending}>
            <Save className="w-4 h-4 mr-2" /> Save Draft
          </Button>
          <Button onClick={() => toast({ title: "Email & SMS not configured", description: "You cannot send estimates until you configure a provider.", variant: "destructive" })}>
            <Send className="w-4 h-4 mr-2" /> Send to Client
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="bg-muted/20 border-b">
          <div className="space-y-1">
            <Label htmlFor="title" className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Estimate Title</Label>
            <Input 
              id="title" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              className="text-lg font-semibold bg-transparent border-transparent px-0 focus-visible:ring-0 focus-visible:border-border -ml-3" 
            />
          </div>
          {job && (
            <div className="text-sm text-muted-foreground mt-2">
              For: {job.title} • {job.clientName}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider text-left">
                <tr>
                  <th className="px-6 py-3 font-medium">Description</th>
                  <th className="px-6 py-3 font-medium w-32">Qty</th>
                  <th className="px-6 py-3 font-medium w-40">Unit Price</th>
                  <th className="px-6 py-3 font-medium w-40 text-right">Amount</th>
                  <th className="px-6 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.id} className="group hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4">
                      <Input 
                        value={item.description} 
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Item description"
                        className="border-transparent bg-transparent focus-visible:ring-1"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <Input 
                        type="number" 
                        min="1"
                        value={item.quantity || ''} 
                        onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                        className="border-transparent bg-transparent focus-visible:ring-1"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                        <Input 
                          type="number" 
                          min="0"
                          step="0.01"
                          value={item.unitPrice || ''} 
                          onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)}
                          className="pl-7 border-transparent bg-transparent focus-visible:ring-1"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 border-t border-dashed">
            <Button variant="ghost" size="sm" onClick={addItem} className="text-primary hover:text-primary hover:bg-primary/10">
              <Plus className="w-4 h-4 mr-2" /> Add Line Item
            </Button>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/10 border-t flex justify-end py-6">
          <div className="w-64 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax (0%)</span>
              <span className="font-medium">$0.00</span>
            </div>
            <div className="border-t pt-3 flex justify-between">
              <span className="font-semibold text-lg">Total</span>
              <span className="font-bold text-lg">{formatCurrency(subtotal)}</span>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
