import { useState, useRef } from "react";
import { useRoute, Link } from "wouter";
import { 
  useGetJob, 
  useUpdateJob, 
  useGetJobSummary, 
  useGetJobMaterialList, 
  useListEstimates,
  useUpdateEstimate,
  useGetEstimate,
  useListReceipts,
  useCreateReceipt,
  useListClients,
  useCreateJobPhoto,
  useCreateMaterialItem,
  useUpdateMaterialItem,
  useDeleteMaterialItem,
  getGetJobQueryKey,
  getGetJobSummaryQueryKey,
  getListJobPhotosQueryKey,
  getGetJobMaterialListQueryKey,
  getListEstimatesQueryKey,
  getListReceiptsQueryKey,
  getGetEstimateQueryKey,
  useListCrew,
  useListJobPhotos,
  type Job,
  type JobSummary,
  type CrewMember,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@workspace/object-storage-web";
import { HardHat, FileText, Image as ImageIcon, Receipt, ListTodo, MapPin, Plus, ArrowLeft, Sparkles, Trash2, Loader2, Check, X, Pencil, Download, Calendar as CalendarIcon, Send, Copy, MessageSquare, Mail, Phone } from "lucide-react";

interface AiMaterialSuggestion {
  name: string;
  description?: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  category?: string | null;
}

interface NewItemRow {
  name: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  category: string;
}

const EMPTY_NEW_ITEM: NewItemRow = { name: "", quantity: "1", unit: "ea", unitPrice: "", category: "" };

function JobEstimatesCard({ jobId }: { jobId: number }) {
  const { data: estimates } = useListEstimates({ jobId });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateEstimate = useUpdateEstimate();
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const handleApprove = (estimateId: number) => {
    setApprovingId(estimateId);
    updateEstimate.mutate(
      { id: estimateId, data: { status: "approved" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
          queryClient.invalidateQueries({ queryKey: getGetJobSummaryQueryKey(jobId) });
          queryClient.invalidateQueries({ queryKey: getListEstimatesQueryKey({ jobId }) });
          queryClient.invalidateQueries({ queryKey: getGetJobMaterialListQueryKey(jobId) });
          toast({ title: "Estimate approved", description: "Job moved to Approved stage." });
        },
        onError: () => toast({ title: "Failed to approve estimate", variant: "destructive" }),
        onSettled: () => setApprovingId(null),
      }
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Estimates</CardTitle>
          <CardDescription>Estimates sent to client</CardDescription>
        </div>
        <Link href={`/quotes?jobId=${jobId}`}>
          <Button size="sm"><Plus className="w-4 h-4 mr-2" /> New Estimate</Button>
        </Link>
      </CardHeader>
      <CardContent>
        {!estimates || estimates.length === 0 ? (
          <div className="text-center py-8 border border-dashed rounded-lg bg-muted/10">
            <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-20" />
            <p className="text-muted-foreground text-sm mb-3">No estimates created yet.</p>
            <Link href={`/quotes?jobId=${jobId}`}>
              <Button size="sm" variant="outline"><Plus className="w-3.5 h-3.5 mr-1.5" /> Create AI Quote</Button>
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs uppercase">
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {estimates.map(est => (
                <tr key={est.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5 font-medium">{est.title}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(est.total)}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={est.status === "approved" ? "default" : "outline"} className="text-xs capitalize">
                      {est.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{formatDate(est.createdAt)}</td>
                  <td className="px-3 py-2.5 text-right">
                    {est.status !== "approved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApprove(est.id)}
                        disabled={approvingId === est.id}
                      >
                        {approvingId === est.id ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5 mr-1.5 text-green-600" />
                        )}
                        Approve
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function MaterialsTab({ jobId, jobTitle, jobDescription, approvedEstimateId }: { jobId: number; jobTitle: string; jobDescription?: string | null; approvedEstimateId?: number | null }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: matList, isLoading } = useGetJobMaterialList(jobId);
  const createItem = useCreateMaterialItem();
  const updateItem = useUpdateMaterialItem();
  const deleteItem = useDeleteMaterialItem();
  const [isImporting, setIsImporting] = useState(false);

  const { data: approvedEstimate } = useGetEstimate(approvedEstimateId ?? 0, {
    query: {
      enabled: !!approvedEstimateId,
      queryKey: getGetEstimateQueryKey(approvedEstimateId ?? 0),
    },
  });

  const [newRow, setNewRow] = useState<NewItemRow>(EMPTY_NEW_ITEM);
  const [addingRow, setAddingRow] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<NewItemRow>(EMPTY_NEW_ITEM);
  const [isSuggestingAi, setIsSuggestingAi] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiMaterialSuggestion[]>([]);
  const [aiDisclaimer, setAiDisclaimer] = useState("");
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [isAddingSuggestions, setIsAddingSuggestions] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetJobMaterialListQueryKey(jobId) });

  const handleAddItem = () => {
    if (!newRow.name.trim()) return;
    createItem.mutate(
      {
        jobId,
        data: {
          name: newRow.name.trim(),
          quantity: parseFloat(newRow.quantity) || 1,
          unit: newRow.unit || "ea",
          unitPrice: parseFloat(newRow.unitPrice) || 0,
          category: newRow.category || null,
        },
      },
      {
        onSuccess: () => { invalidate(); setNewRow(EMPTY_NEW_ITEM); setAddingRow(false); },
        onError: () => toast({ title: "Failed to add item", variant: "destructive" }),
      }
    );
  };

  const handleSaveEdit = (id: number) => {
    updateItem.mutate(
      {
        id,
        data: {
          name: editRow.name.trim() || undefined,
          quantity: parseFloat(editRow.quantity) || 1,
          unit: editRow.unit || "ea",
          unitPrice: parseFloat(editRow.unitPrice) || 0,
          category: editRow.category || null,
        },
      },
      {
        onSuccess: () => { invalidate(); setEditingId(null); },
        onError: () => toast({ title: "Failed to update item", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteItem.mutate({ id }, {
      onSuccess: () => invalidate(),
      onError: () => toast({ title: "Failed to delete item", variant: "destructive" }),
    });
  };

  const handleAiSuggest = async () => {
    setIsSuggestingAi(true);
    setAiSuggestions([]);
    setSelectedSuggestions(new Set());
    try {
      const res = await fetch("/api/ai/suggest-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, jobDescription: jobDescription || jobTitle }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAiSuggestions(data.items || []);
      setAiDisclaimer(data.disclaimer || "");
      setSelectedSuggestions(new Set((data.items || []).map((_: AiMaterialSuggestion, i: number) => i)));
    } catch {
      toast({ title: "AI suggestion failed", description: "Could not generate suggestions. Try again.", variant: "destructive" });
    } finally {
      setIsSuggestingAi(false);
    }
  };

  const handleAddSelectedSuggestions = async () => {
    setIsAddingSuggestions(true);
    const toAdd = aiSuggestions.filter((_, i) => selectedSuggestions.has(i));
    try {
      for (const item of toAdd) {
        await new Promise<void>((resolve, reject) => {
          createItem.mutate(
            { jobId, data: { name: item.name, description: item.description, quantity: item.quantity, unit: item.unit, unitPrice: item.unitPrice, category: item.category } },
            { onSuccess: () => resolve(), onError: () => reject() }
          );
        });
      }
      invalidate();
      toast({ title: `Added ${toAdd.length} items to material list` });
      setAiSuggestions([]);
      setSelectedSuggestions(new Set());
    } catch {
      toast({ title: "Some items failed to add", variant: "destructive" });
    } finally {
      setIsAddingSuggestions(false);
    }
  };

  const handleImportFromEstimate = async () => {
    const estimateItems = (approvedEstimate?.items ?? []).filter(
      (it) => it.section === "material",
    );
    if (estimateItems.length === 0) {
      toast({ title: "No material items on the approved estimate", variant: "destructive" });
      return;
    }
    setIsImporting(true);
    try {
      for (const it of estimateItems) {
        await new Promise<void>((resolve, reject) => {
          createItem.mutate(
            {
              jobId,
              data: {
                name: it.description,
                quantity: Number(it.quantity) || 1,
                unit: it.unit || "ea",
                unitPrice: Number(it.unitPrice) || 0,
                category: null,
              },
            },
            { onSuccess: () => resolve(), onError: () => reject() }
          );
        });
      }
      invalidate();
      toast({ title: `Imported ${estimateItems.length} items from estimate` });
    } catch {
      toast({ title: "Some items failed to import", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const items = matList?.items ?? [];
  const total = matList?.subtotal ?? 0;
  const canImport = !!approvedEstimateId;

  if (isLoading) return <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle>Material List</CardTitle>
            <CardDescription>Track materials needed for this job</CardDescription>
          </div>
          <div className="flex gap-2">
            {canImport && (
              <Button size="sm" variant="outline" onClick={handleImportFromEstimate} disabled={isImporting}>
                {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Import from Estimate
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleAiSuggest} disabled={isSuggestingAi}>
              {isSuggestingAi ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2 text-purple-500" />}
              AI Suggest
            </Button>
            <Button size="sm" onClick={() => setAddingRow(true)} disabled={addingRow}>
              <Plus className="w-4 h-4 mr-2" /> Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 && !addingRow && aiSuggestions.length === 0 ? (
            <div className="text-center py-12 border-t border-dashed bg-muted/10 rounded-b-lg">
              <ListTodo className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-20" />
              <h3 className="text-base font-medium mb-1">No materials yet</h3>
              <p className="text-muted-foreground text-sm mb-4">Add items manually or let AI suggest a list.</p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" size="sm" onClick={() => setAddingRow(true)}><Plus className="w-4 h-4 mr-1" /> Add Item</Button>
                <Button size="sm" variant="secondary" onClick={handleAiSuggest} disabled={isSuggestingAi}>
                  <Sparkles className="w-4 h-4 mr-1 text-purple-500" /> AI Suggest
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <table className="w-full text-sm">
                <thead className="border-t">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Item</th>
                    <th className="px-4 py-2 font-medium text-right w-20">Qty</th>
                    <th className="px-4 py-2 font-medium w-20">Unit</th>
                    <th className="px-4 py-2 font-medium text-right w-28">Unit Price</th>
                    <th className="px-4 py-2 font-medium text-right w-28">Total</th>
                    <th className="px-4 py-2 w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) =>
                    editingId === item.id ? (
                      <tr key={item.id} className="bg-muted/30">
                        <td className="px-2 py-1"><Input value={editRow.name} onChange={e => setEditRow(r => ({ ...r, name: e.target.value }))} className="h-7 text-sm" /></td>
                        <td className="px-2 py-1"><Input value={editRow.quantity} onChange={e => setEditRow(r => ({ ...r, quantity: e.target.value }))} className="h-7 text-sm text-right w-16" /></td>
                        <td className="px-2 py-1"><Input value={editRow.unit} onChange={e => setEditRow(r => ({ ...r, unit: e.target.value }))} className="h-7 text-sm w-16" /></td>
                        <td className="px-2 py-1"><Input value={editRow.unitPrice} onChange={e => setEditRow(r => ({ ...r, unitPrice: e.target.value }))} className="h-7 text-sm text-right w-24" /></td>
                        <td className="px-4 py-1 text-right text-muted-foreground">{formatCurrency((parseFloat(editRow.quantity) || 0) * (parseFloat(editRow.unitPrice) || 0))}</td>
                        <td className="px-2 py-1">
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveEdit(item.id)}><Check className="w-3.5 h-3.5 text-green-600" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="w-3.5 h-3.5" /></Button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={item.id} className="hover:bg-muted/20 cursor-pointer group" onClick={() => { setEditingId(item.id); setEditRow({ name: item.name, quantity: String(item.quantity ?? 1), unit: item.unit ?? "ea", unitPrice: String(item.unitPrice ?? 0), category: item.category ?? "" }); }}>
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{item.name}</div>
                          {item.category && <div className="text-xs text-muted-foreground">{item.category}</div>}
                        </td>
                        <td className="px-4 py-2.5 text-right">{item.quantity}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{item.unit}</td>
                        <td className="px-4 py-2.5 text-right">{formatCurrency(Number(item.unitPrice ?? 0))}</td>
                        <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0))}</td>
                        <td className="px-2 py-2.5">
                          <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={e => { e.stopPropagation(); handleDelete(item.id); }}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    )
                  )}
                  {addingRow && (
                    <tr className="bg-blue-50/50 dark:bg-blue-950/20">
                      <td className="px-2 py-1"><Input autoFocus placeholder="Item name" value={newRow.name} onChange={e => setNewRow(r => ({ ...r, name: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") handleAddItem(); if (e.key === "Escape") setAddingRow(false); }} className="h-7 text-sm" /></td>
                      <td className="px-2 py-1"><Input value={newRow.quantity} onChange={e => setNewRow(r => ({ ...r, quantity: e.target.value }))} className="h-7 text-sm text-right w-16" /></td>
                      <td className="px-2 py-1"><Input value={newRow.unit} onChange={e => setNewRow(r => ({ ...r, unit: e.target.value }))} className="h-7 text-sm w-16" /></td>
                      <td className="px-2 py-1"><Input placeholder="0.00" value={newRow.unitPrice} onChange={e => setNewRow(r => ({ ...r, unitPrice: e.target.value }))} className="h-7 text-sm text-right w-24" /></td>
                      <td className="px-4 py-1 text-right text-muted-foreground">{formatCurrency((parseFloat(newRow.quantity) || 0) * (parseFloat(newRow.unitPrice) || 0))}</td>
                      <td className="px-2 py-1">
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleAddItem} disabled={!newRow.name.trim()}><Check className="w-3.5 h-3.5 text-green-600" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setAddingRow(false); setNewRow(EMPTY_NEW_ITEM); }}><X className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
                {(items.length > 0 || addingRow) && (
                  <tfoot className="border-t bg-muted/20">
                    <tr>
                      <td colSpan={4} className="px-4 py-2.5 text-sm font-semibold text-right text-muted-foreground">Total</td>
                      <td className="px-4 py-2.5 text-right font-bold">{formatCurrency(Number(total))}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {aiSuggestions.length > 0 && (
        <Card className="border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <CardTitle className="text-base">AI Suggested Materials</CardTitle>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedSuggestions(new Set(aiSuggestions.map((_, i) => i)))}>Select All</Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedSuggestions(new Set())}>None</Button>
                <Button size="sm" onClick={handleAddSelectedSuggestions} disabled={selectedSuggestions.size === 0 || isAddingSuggestions}>
                  {isAddingSuggestions ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                  Add {selectedSuggestions.size > 0 ? selectedSuggestions.size : ""} Selected
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setAiSuggestions([])}><X className="w-4 h-4" /></Button>
              </div>
            </div>
            {aiDisclaimer && <p className="text-xs text-muted-foreground mt-1">{aiDisclaimer}</p>}
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-t">
                <tr className="text-left text-muted-foreground">
                  <th className="px-4 py-2 w-8" />
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-4 py-2 font-medium text-right w-20">Qty</th>
                  <th className="px-4 py-2 font-medium w-20">Unit</th>
                  <th className="px-4 py-2 font-medium text-right w-28">Unit Price</th>
                  <th className="px-4 py-2 font-medium text-right w-28">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {aiSuggestions.map((item, i) => (
                  <tr key={i} className={`cursor-pointer transition-colors ${selectedSuggestions.has(i) ? "bg-purple-50/50 dark:bg-purple-950/20" : "opacity-50"}`} onClick={() => setSelectedSuggestions(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })}>
                    <td className="px-4 py-2.5">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selectedSuggestions.has(i) ? "bg-purple-500 border-purple-500" : "border-muted-foreground"}`}>
                        {selectedSuggestions.has(i) && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{item.name}</div>
                      {item.category && <div className="text-xs text-muted-foreground">{item.category}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-right">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{item.unit}</td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(item.quantity * item.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/20">
                <tr>
                  <td colSpan={5} className="px-4 py-2.5 text-sm font-semibold text-right text-muted-foreground">Suggested Total</td>
                  <td className="px-4 py-2.5 text-right font-bold">{formatCurrency(aiSuggestions.filter((_, i) => selectedSuggestions.has(i)).reduce((s, item) => s + item.quantity * item.unitPrice, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const JOB_STAGES = [
  { value: "new", label: "New" },
  { value: "estimate", label: "Estimate" },
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In Progress" },
  { value: "finished", label: "Finished" },
  { value: "invoiced", label: "Invoiced" },
  { value: "paid", label: "Paid" },
];

const JOB_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

type JobLike = Job;
type SummaryLike = JobSummary | undefined;

interface OverviewForm {
  title: string;
  status: string;
  jobType: string;
  priority: string;
  estimatedValue: string;
  description: string;
  startDate: string;
  clientId: string;
}

function priorityVariant(priority?: string | null) {
  if (priority === "urgent" || priority === "high") return "destructive" as const;
  if (priority === "normal") return "default" as const;
  return "secondary" as const;
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function OverviewTab({ job, summary }: { job: JobLike; summary: SummaryLike }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateJob = useUpdateJob();
  const { data: clients } = useListClients();
  const { data: matList } = useGetJobMaterialList(job.id);
  const { data: estimates } = useListEstimates({ jobId: job.id });

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<OverviewForm>(() => emptyForm(job));

  function emptyForm(j: JobLike): OverviewForm {
    return {
      title: j.title ?? "",
      status: j.status ?? "new",
      jobType: j.jobType ?? "",
      priority: j.priority ?? "normal",
      estimatedValue: j.estimatedValue != null ? String(j.estimatedValue) : "",
      description: j.description ?? "",
      startDate: toDateInput(j.startDate),
      clientId: j.clientId != null ? String(j.clientId) : "none",
    };
  }

  const startEditing = () => {
    setForm(emptyForm(job));
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    updateJob.mutate(
      {
        id: job.id,
        data: {
          title: form.title.trim(),
          status: form.status,
          jobType: form.jobType.trim() || null,
          priority: form.priority,
          estimatedValue: form.estimatedValue.trim() === "" ? null : form.estimatedValue.trim(),
          description: form.description.trim() || null,
          startDate: form.startDate || null,
          clientId: form.clientId === "none" ? null : parseInt(form.clientId),
        },
      },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetJobQueryKey(job.id), updated);
          queryClient.invalidateQueries({ queryKey: getGetJobSummaryQueryKey(job.id) });
          setIsEditing(false);
          toast({ title: "Job updated" });
        },
        onError: () => toast({ title: "Failed to update job", variant: "destructive" }),
      }
    );
  };

  const approvedEstimate = (estimates ?? []).find((e) => e.status === "approved");
  const materialCost = matList?.subtotal ?? 0;
  const jobValue = approvedEstimate ? approvedEstimate.total : Number(job.estimatedValue ?? 0);
  const stageLabel = JOB_STAGES.find((s) => s.value === job.status)?.label ?? job.status;

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="md:col-span-2 shadow-sm border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Job Details</CardTitle>
          {isEditing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} disabled={updateJob.isPending}>
                <X className="w-4 h-4 mr-1.5" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateJob.isPending}>
                {updateJob.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
                Save
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={startEditing}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="text-muted-foreground block mb-1 text-sm">Title</label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Job title" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-muted-foreground block mb-1 text-sm">Client</label>
                  <Select value={form.clientId} onValueChange={(v) => setForm((f) => ({ ...f, clientId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {(clients ?? []).map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1 text-sm">Stage</label>
                  <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {JOB_STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1 text-sm">Type</label>
                  <Input value={form.jobType} onChange={(e) => setForm((f) => ({ ...f, jobType: e.target.value }))} placeholder="e.g. Remodel" />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1 text-sm">Priority</label>
                  <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {JOB_PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1 text-sm">Estimated Value</label>
                  <Input type="number" value={form.estimatedValue} onChange={(e) => setForm((f) => ({ ...f, estimatedValue: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1 text-sm">Scheduled Date</label>
                  <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-muted-foreground block mb-1 text-sm">Description</label>
                <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={4} placeholder="Job description" />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-y-4 text-sm">
                <div>
                  <span className="text-muted-foreground block mb-1">Type</span>
                  <span className="font-medium">{job.jobType || "Unspecified"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Priority</span>
                  <Badge variant={priorityVariant(job.priority)} className="capitalize">
                    {job.priority}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Scheduled Date</span>
                  <span className="font-medium flex items-center">
                    <CalendarIcon className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                    {formatDate(job.startDate) || "TBD"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Target End Date</span>
                  <span className="font-medium flex items-center">
                    <CalendarIcon className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                    {formatDate(job.endDate) || "TBD"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Estimated Value</span>
                  <span className="font-medium text-lg">{formatCurrency(job.estimatedValue)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Actual Cost</span>
                  <span className="font-medium">{formatCurrency(job.actualCost)}</span>
                </div>
              </div>
              {job.description && (
                <div className="pt-4 border-t mt-4">
                  <span className="text-muted-foreground block mb-2 text-sm">Description</span>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{job.description}</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle>Project Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 p-2 rounded-md">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="font-medium">Job Value</span>
              </div>
              <span className="font-bold">{formatCurrency(jobValue)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 p-2 rounded-md">
                  <ListTodo className="w-4 h-4" />
                </div>
                <span className="font-medium">Material Cost</span>
              </div>
              <span className="font-bold">{formatCurrency(materialCost)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 p-2 rounded-md">
                  <HardHat className="w-4 h-4" />
                </div>
                <span className="font-medium">Stage</span>
              </div>
              <Badge variant="outline" className="capitalize">{stageLabel}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 p-2 rounded-md">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="font-medium">Estimates</span>
              </div>
              <span className="font-bold">{summary?.estimateCount || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 dark:bg-green-900/30 text-green-600 p-2 rounded-md">
                  <Receipt className="w-4 h-4" />
                </div>
                <span className="font-medium">Receipts</span>
              </div>
              <span className="font-bold">{formatCurrency(summary?.receiptTotal || 0)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 p-2 rounded-md">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <span className="font-medium">Photos</span>
              </div>
              <span className="font-bold">{summary?.photoCount || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface ReceiptForm {
  vendor: string;
  amount: string;
  date: string;
  category: string;
  description: string;
}

const EMPTY_RECEIPT: ReceiptForm = { vendor: "", amount: "", date: "", category: "", description: "" };

function ReceiptsTab({ jobId }: { jobId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: receipts, isLoading } = useListReceipts({ jobId });
  const createReceipt = useCreateReceipt();
  const lastObjectPathRef = useRef<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<ReceiptForm>(EMPTY_RECEIPT);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListReceiptsQueryKey({ jobId }) });

  const resetForm = () => { setForm(EMPTY_RECEIPT); setImageUrl(null); setAdding(false); };

  const handleSave = () => {
    if (!form.vendor.trim()) {
      toast({ title: "Vendor is required", variant: "destructive" });
      return;
    }
    createReceipt.mutate(
      {
        data: {
          jobId,
          vendor: form.vendor.trim(),
          amount: form.amount.trim() === "" ? 0 : form.amount.trim(),
          date: form.date || null,
          category: form.category.trim() || "general",
          description: form.description.trim() || null,
          imageUrl: imageUrl,
        },
      },
      {
        onSuccess: () => {
          invalidate();
          queryClient.invalidateQueries({ queryKey: getGetJobSummaryQueryKey(jobId) });
          resetForm();
          toast({ title: "Receipt added" });
        },
        onError: () => toast({ title: "Failed to add receipt", variant: "destructive" }),
      }
    );
  };

  const list = receipts ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Receipts</CardTitle>
          <CardDescription>Track material and expense receipts for this job</CardDescription>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}><Plus className="w-4 h-4 mr-2" /> Add Receipt</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {adding && (
          <div className="border rounded-lg p-4 bg-muted/20 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-muted-foreground block mb-1 text-sm">Vendor</label>
                <Input autoFocus value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} placeholder="Vendor name" />
              </div>
              <div>
                <label className="text-muted-foreground block mb-1 text-sm">Amount</label>
                <Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <label className="text-muted-foreground block mb-1 text-sm">Date</label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-muted-foreground block mb-1 text-sm">Category</label>
                <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. materials" />
              </div>
            </div>
            <div>
              <label className="text-muted-foreground block mb-1 text-sm">Description</label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="Optional notes" />
            </div>
            <div className="flex items-center gap-3">
              <ObjectUploader
                onGetUploadParameters={async (file) => {
                  const res = await fetch("/api/storage/uploads/request-url", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
                  });
                  const { uploadURL, objectPath } = await res.json();
                  lastObjectPathRef.current = objectPath;
                  return { method: "PUT", url: uploadURL, headers: { "Content-Type": file.type } };
                }}
                onComplete={(result) => {
                  if (result.successful && result.successful.length > 0 && lastObjectPathRef.current) {
                    setImageUrl(`/api/storage${lastObjectPathRef.current}`);
                    toast({ title: "Receipt image attached" });
                  }
                }}
                buttonClassName="border border-input bg-background hover:bg-accent h-9 px-4 py-2 rounded-md text-sm font-medium inline-flex items-center justify-center"
              >
                <ImageIcon className="w-4 h-4 mr-2" /> {imageUrl ? "Replace Image" : "Attach Image"}
              </ObjectUploader>
              {imageUrl && <span className="text-xs text-muted-foreground flex items-center"><Check className="w-3.5 h-3.5 mr-1 text-green-600" /> Image attached</span>}
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={resetForm} disabled={createReceipt.isPending}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={createReceipt.isPending || !form.vendor.trim()}>
                {createReceipt.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
                Save Receipt
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : list.length === 0 && !adding ? (
          <div className="text-center py-12 border border-dashed rounded-lg bg-muted/10">
            <Receipt className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-20" />
            <h3 className="text-base font-medium mb-1">No receipts yet</h3>
            <p className="text-muted-foreground text-sm">Add receipts to track job expenses.</p>
          </div>
        ) : list.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs uppercase">
                <th className="px-3 py-2 text-left">Vendor</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">Image</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((r) => (
                <tr key={r.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{r.vendor}</div>
                    {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                  </td>
                  <td className="px-3 py-2.5 capitalize text-muted-foreground">{r.category}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{formatDate(r.date) || "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium">{formatCurrency(r.amount)}</td>
                  <td className="px-3 py-2.5 text-right">
                    {r.imageUrl ? (
                      <a href={r.imageUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center justify-end">
                        <ImageIcon className="w-4 h-4" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </CardContent>
    </Card>
  );
}

function buildJobBrief(opts: {
  job: Job;
  items: { name: string; quantity?: number | null; unit?: string | null; unitPrice?: number | null }[];
  photoCount: number;
}): string {
  const { job, items, photoCount } = opts;
  const lines: string[] = [];
  lines.push(`JOB BRIEF — ${job.title}`);
  if (job.clientName) lines.push(`Client: ${job.clientName}`);
  if (job.address) lines.push(`Address: ${job.address}`);
  lines.push("");
  if (job.description) {
    lines.push("Description:");
    lines.push(job.description);
    lines.push("");
  }
  if (items.length > 0) {
    lines.push("Materials Needed:");
    for (const it of items) {
      const qty = it.quantity ?? 1;
      const unit = it.unit ?? "ea";
      lines.push(`- ${it.name} (${qty} ${unit})`);
    }
    lines.push("");
  }
  if (photoCount > 0) {
    lines.push(`Photos: ${photoCount} attached on the job page.`);
  }
  lines.push("");
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  lines.push(`${window.location.origin}${base}/jobs/${job.id}`);
  return lines.join("\n");
}

function SendToCrewDialog({
  job,
  jobId,
  open,
  onOpenChange,
}: {
  job: Job;
  jobId: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: crew, isLoading } = useListCrew({});
  const { data: matList } = useGetJobMaterialList(jobId);
  const { data: photos } = useListJobPhotos(jobId);
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const items = matList?.items ?? [];
  const photoCount = photos?.length ?? 0;
  const selected = (crew ?? []).find((c) => c.id === selectedId) ?? null;
  const brief = buildJobBrief({ job, items, photoCount });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(brief);
      toast({ title: "Job brief copied to clipboard" });
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  const handleSms = () => {
    const phone = selected?.phone ?? "";
    window.location.href = `sms:${phone}?body=${encodeURIComponent(brief)}`;
  };

  const handleEmail = () => {
    const email = selected?.email ?? "";
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(
      `Job Brief — ${job.title}`,
    )}&body=${encodeURIComponent(brief)}`;
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) setSelectedId(null);
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Job Brief</DialogTitle>
          <DialogDescription>
            Pick a crew member or subcontractor, then send via their messaging app or copy
            the brief.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-2">Recipient</div>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : !crew || crew.length === 0 ? (
              <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                No crew yet.{" "}
                <Link href="/crew" className="text-primary underline">
                  Add team members
                </Link>{" "}
                first.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
                {crew.map((m: CrewMember) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className={`w-full text-left px-3 py-2.5 min-h-12 flex items-center justify-between gap-2 transition-colors ${
                      selectedId === m.id ? "bg-primary/10" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{m.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[m.type === "subcontractor" ? m.company : m.role, m.phone, m.email]
                          .filter(Boolean)
                          .join(" · ") || "No contact info"}
                      </div>
                    </div>
                    {selectedId === m.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Preview</div>
            <pre className="text-xs bg-muted/40 rounded-lg p-3 whitespace-pre-wrap max-h-48 overflow-y-auto font-sans">
              {brief}
            </pre>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleCopy} className="flex-1">
              <Copy className="h-4 w-4 mr-2" /> Copy
            </Button>
            <Button
              onClick={handleSms}
              disabled={!selected?.phone}
              className="flex-1"
              title={!selected?.phone ? "Selected recipient has no phone number" : undefined}
            >
              <MessageSquare className="h-4 w-4 mr-2" /> Text
            </Button>
            <Button
              onClick={handleEmail}
              disabled={!selected?.email}
              className="flex-1"
              title={!selected?.email ? "Selected recipient has no email" : undefined}
            >
              <Mail className="h-4 w-4 mr-2" /> Email
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function JobDetail() {
  const [, params] = useRoute("/jobs/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  
  const { data: job, isLoading: jobLoading } = useGetJob(id);
  const { data: summary, isLoading: summaryLoading } = useGetJobSummary(id);
  const { data: estimates } = useListEstimates({ jobId: id });
  const updateJob = useUpdateJob();
  const createPhoto = useCreateJobPhoto();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const lastObjectPathRef = useRef<string | null>(null);

  const approvedEstimateId = (estimates ?? []).find((e) => e.status === "approved")?.id ?? null;
  const [sendOpen, setSendOpen] = useState(false);

  const handleStatusChange = (newStatus: string) => {
    updateJob.mutate(
      { id, data: { status: newStatus } },
      {
        onSuccess: (updatedJob) => {
          queryClient.setQueryData(getGetJobQueryKey(id), updatedJob);
          toast({ title: "Status updated" });
        }
      }
    );
  };

  if (jobLoading || summaryLoading) return <div className="p-6 md:p-8"><Skeleton className="h-64 w-full" /></div>;
  if (!job) return <div className="p-6 md:p-8 text-center"><h2 className="text-2xl font-bold">Job not found</h2><Link href="/jobs"><Button className="mt-4">Back to Jobs</Button></Link></div>;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 pb-24">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Link href="/jobs" className="hover:text-foreground flex items-center transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Jobs
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">{job.title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground text-sm">
            {job.clientName && (
              <Link href={`/clients/${job.clientId}`} className="hover:text-primary transition-colors flex items-center">
                <span className="font-medium text-foreground mr-1">Client:</span> {job.clientName}
              </Link>
            )}
            {job.address && (
              <span className="flex items-center"><MapPin className="w-3.5 h-3.5 mr-1" /> {job.address}</span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={job.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="estimate">Estimate</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="finished">Finished</SelectItem>
              <SelectItem value="invoiced">Invoiced</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setSendOpen(true)}>
            <Send className="w-4 h-4 mr-2" /> Send to Crew
          </Button>
          <Link href={`/quotes?jobId=${job.id}`}>
            <Button><Plus className="w-4 h-4 mr-2" /> Create Estimate</Button>
          </Link>
        </div>
      </div>

      <SendToCrewDialog job={job} jobId={id} open={sendOpen} onOpenChange={setSendOpen} />
      
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex w-full overflow-x-auto no-scrollbar justify-start bg-muted/50 p-1 rounded-lg">
          <TabsTrigger value="overview" className="shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm">Overview</TabsTrigger>
          <TabsTrigger value="materials" className="shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm">Materials</TabsTrigger>
          <TabsTrigger value="estimates" className="shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm">Estimates & Invoices</TabsTrigger>
          <TabsTrigger value="receipts" className="shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm">Receipts</TabsTrigger>
          <TabsTrigger value="photos" className="shrink-0 data-[state=active]:bg-background data-[state=active]:shadow-sm">Photos</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6 pt-4">
          <OverviewTab job={job} summary={summary} />
        </TabsContent>
        
        <TabsContent value="materials" className="pt-4">
          <MaterialsTab jobId={id} jobTitle={job.title} jobDescription={job.description} approvedEstimateId={approvedEstimateId} />
        </TabsContent>

        <TabsContent value="estimates" className="pt-4 space-y-6">
          <JobEstimatesCard jobId={id} />

          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Invoices</CardTitle>
                <CardDescription>Billing for this job</CardDescription>
              </div>
              <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" /> Create Invoice</Button>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 border border-dashed rounded-lg bg-muted/10">
                <Receipt className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-20" />
                <p className="text-muted-foreground text-sm">No invoices generated yet.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipts" className="pt-4">
          <ReceiptsTab jobId={id} />
        </TabsContent>

        <TabsContent value="photos" className="pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Job Photos</CardTitle>
                <CardDescription>Before, during, and after photos</CardDescription>
              </div>
              <ObjectUploader
                onGetUploadParameters={async (file) => {
                  const res = await fetch("/api/storage/uploads/request-url", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
                  });
                  const { uploadURL, objectPath } = await res.json();
                  lastObjectPathRef.current = objectPath;
                  return { method: "PUT", url: uploadURL, headers: { "Content-Type": file.type } };
                }}
                onComplete={async (result) => {
                  if (result.successful && result.successful.length > 0) {
                    const objectPath = lastObjectPathRef.current;
                    if (objectPath) {
                      createPhoto.mutate(
                        { jobId: id, data: { type: "during", imageUrl: `/api/storage${objectPath}` } },
                        {
                          onSuccess: () => {
                            queryClient.invalidateQueries({ queryKey: getListJobPhotosQueryKey(id) });
                            toast({ title: "Photo uploaded" });
                          }
                        }
                      );
                    }
                  }
                }}
                buttonClassName="bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 rounded-md text-sm font-medium inline-flex items-center justify-center"
              >
                <Plus className="w-4 h-4 mr-2" /> Upload Photo
              </ObjectUploader>
            </CardHeader>
            <CardContent>
              <div className="text-center py-16 border border-dashed rounded-lg bg-muted/10">
                <ImageIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-20" />
                <h3 className="text-lg font-medium mb-1">No photos uploaded</h3>
                <p className="text-muted-foreground text-sm">Document the job progress with photos.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
