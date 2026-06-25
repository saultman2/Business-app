import { useState } from "react";
import {
  useListCrew,
  useCreateCrewMember,
  useUpdateCrewMember,
  useDeleteCrewMember,
  getListCrewQueryKey,
  type CrewMember,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { UsersRound, Plus, Pencil, Trash2, Phone, Mail, HardHat, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type CrewType = "employee" | "subcontractor";

interface CrewForm {
  name: string;
  role: string;
  phone: string;
  email: string;
  company: string;
  specialty: string;
  notes: string;
}

const emptyForm: CrewForm = {
  name: "",
  role: "",
  phone: "",
  email: "",
  company: "",
  specialty: "",
  notes: "",
};

function toForm(m: CrewMember): CrewForm {
  return {
    name: m.name ?? "",
    role: m.role ?? "",
    phone: m.phone ?? "",
    email: m.email ?? "",
    company: m.company ?? "",
    specialty: m.specialty ?? "",
    notes: m.notes ?? "",
  };
}

function nullify(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

export default function CrewPage() {
  const [tab, setTab] = useState<CrewType>("employee");

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Crew</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your team and subcontractors, and forward job details to them.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as CrewType)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="employee">
            <HardHat className="h-4 w-4 mr-2" /> Team Members
          </TabsTrigger>
          <TabsTrigger value="subcontractor">
            <Wrench className="h-4 w-4 mr-2" /> Subcontractors
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employee" className="pt-6">
          <CrewList type="employee" />
        </TabsContent>
        <TabsContent value="subcontractor" className="pt-6">
          <CrewList type="subcontractor" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CrewList({ type }: { type: CrewType }) {
  const { data: members, isLoading } = useListCrew({ type });
  const createMember = useCreateCrewMember();
  const updateMember = useUpdateCrewMember();
  const deleteMember = useDeleteCrewMember();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CrewMember | null>(null);
  const [form, setForm] = useState<CrewForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<CrewMember | null>(null);

  const isSub = type === "subcontractor";
  const noun = isSub ? "Subcontractor" : "Team Member";

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListCrewQueryKey({ type }) });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (m: CrewMember) => {
    setEditing(m);
    setForm(toForm(m));
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      type,
      name: form.name.trim(),
      role: nullify(form.role),
      phone: nullify(form.phone),
      email: nullify(form.email),
      company: nullify(form.company),
      specialty: nullify(form.specialty),
      notes: nullify(form.notes),
    };
    if (editing) {
      updateMember.mutate(
        { id: editing.id, data },
        {
          onSuccess: () => {
            invalidate();
            toast({ title: `${noun} updated` });
            setDialogOpen(false);
          },
          onError: () => toast({ title: `Error updating ${noun.toLowerCase()}`, variant: "destructive" }),
        },
      );
    } else {
      createMember.mutate(
        { data },
        {
          onSuccess: () => {
            invalidate();
            toast({ title: `${noun} added` });
            setDialogOpen(false);
          },
          onError: () => toast({ title: `Error adding ${noun.toLowerCase()}`, variant: "destructive" }),
        },
      );
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMember.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: `${noun} removed` });
          setDeleteTarget(null);
        },
        onError: () => toast({ title: `Error removing ${noun.toLowerCase()}`, variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Add {noun}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !members || members.length === 0 ? (
        <div className="text-center py-16 px-6 border border-dashed rounded-xl bg-card">
          <div className="bg-primary/10 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4">
            <UsersRound className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-1.5">
            No {isSub ? "subcontractors" : "team members"} yet
          </h3>
          <p className="text-muted-foreground max-w-sm mx-auto text-sm mb-6">
            {isSub
              ? "Add the subcontractors you work with so you can quickly send them job details."
              : "Add your crew so you can assign them to jobs and send them job briefs."}
          </p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Add First {noun}
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="rounded-xl border bg-card p-4 flex flex-col gap-2 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{m.name}</div>
                  {isSub ? (
                    <div className="text-xs text-muted-foreground truncate">
                      {[m.company, m.specialty].filter(Boolean).join(" · ") || "—"}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground truncate">
                      {m.role || "—"}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => openEdit(m)}
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(m)}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-1 text-sm">
                {m.phone && (
                  <a
                    href={`tel:${m.phone}`}
                    className="flex items-center gap-2 text-muted-foreground hover:text-primary min-h-8"
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0" /> {m.phone}
                  </a>
                )}
                {m.email && (
                  <a
                    href={`mailto:${m.email}`}
                    className="flex items-center gap-2 text-muted-foreground hover:text-primary min-h-8 truncate"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0" /> {m.email}
                  </a>
                )}
                {!m.phone && !m.email && (
                  <span className="text-xs text-muted-foreground/60">No contact info</span>
                )}
              </div>
              {m.notes && (
                <p className="text-xs text-muted-foreground border-t pt-2 mt-1">{m.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${noun}` : `Add ${noun}`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            {isSub ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialty">Specialty</Label>
                  <Input
                    id="specialty"
                    placeholder="e.g. Plumbing, HVAC"
                    value={form.specialty}
                    onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  placeholder="e.g. Foreman, Electrician"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={createMember.isPending || updateMember.isPending}
              >
                {createMember.isPending || updateMember.isPending
                  ? "Saving…"
                  : editing
                    ? "Save Changes"
                    : `Add ${noun}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this {noun.toLowerCase()} from your crew. This
              can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
