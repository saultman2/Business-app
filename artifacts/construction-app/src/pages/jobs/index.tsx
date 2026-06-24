import { useState, useEffect } from "react";
import {
  useListJobs, useCreateJob, getListJobsQueryKey,
  useListClients, useCreateClient, getListClientsQueryKey,
  useCreateEvent, getListEventsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Plus, HardHat, MapPin, Check, ChevronsUpDown, UserPlus, ChevronDown, ChevronUp, CalendarPlus } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const EVENT_LABEL_OPTIONS = [
  { label: "Quoting", value: "quoting" },
  { label: "Working", value: "working" },
  { label: "Follow-up", value: "follow_up" },
  { label: "Job Start", value: "job_start" },
  { label: "Job End", value: "job_end" },
  { label: "Meeting", value: "meeting" },
  { label: "Other", value: "other" },
] as const;

type EventLabelValue = (typeof EVENT_LABEL_OPTIONS)[number]["value"];

function getEventTitle(jobTitle: string, eventLabel: EventLabelValue) {
  const labelText = EVENT_LABEL_OPTIONS.find(o => o.value === eventLabel)?.label ?? "";
  return `${jobTitle} — ${labelText}`;
}

const defaultForm = {
  title: "",
  description: "",
  jobType: "",
  status: "new",
  address: "",
  city: "",
  state: "",
  zipCode: "",
};

export default function JobsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [newClientData, setNewClientData] = useState({ name: "", phone: "", address: "" });
  const [scheduleDate, setScheduleDate] = useState("");
  const [eventLabel, setEventLabel] = useState<EventLabelValue>("quoting");
  const [formData, setFormData] = useState(defaultForm);

  const { data: jobs, isLoading } = useListJobs({
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(search ? { search } : {}),
  });

  const { data: clients } = useListClients({});
  const createJob = useCreateJob();
  const createClient = useCreateClient();
  const createEvent = useCreateEvent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preClientId = params.get("newJobClientId");
    if (preClientId) {
      const id = parseInt(preClientId, 10);
      if (!isNaN(id)) {
        setSelectedClientId(id);
        setIsCreateOpen(true);
      }
    }
  }, []);

  useEffect(() => {
    if (selectedClientId && clients) {
      const client = clients.find(c => c.id === selectedClientId);
      if (client) {
        setFormData(prev => ({
          ...prev,
          address: client.address ?? prev.address,
          city: client.city ?? prev.city,
          state: client.state ?? prev.state,
          zipCode: client.zipCode ?? prev.zipCode,
        }));
      }
    }
  }, [selectedClientId, clients]);

  const selectedClient = clients?.find(c => c.id === selectedClientId);

  const resetForm = () => {
    setFormData(defaultForm);
    setSelectedClientId(null);
    setShowNewClientForm(false);
    setNewClientData({ name: "", phone: "", address: "" });
    setScheduleDate("");
    setEventLabel("quoting");
    setClientDropdownOpen(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let clientId: number | undefined = selectedClientId ?? undefined;

    if (showNewClientForm && newClientData.name.trim()) {
      try {
        const newClient = await createClient.mutateAsync({
          data: {
            name: newClientData.name,
            phone: newClientData.phone || undefined,
            address: newClientData.address || undefined,
          },
        });
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
        clientId = newClient.id;
      } catch {
        toast({ title: "Error creating client", variant: "destructive" });
        return;
      }
    }

    try {
      const job = await createJob.mutateAsync({ data: { ...formData, clientId } });
      queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });

      if (scheduleDate) {
        try {
          await createEvent.mutateAsync({
            data: {
              title: getEventTitle(formData.title, eventLabel),
              type: eventLabel,
              startDatetime: new Date(scheduleDate + "T08:00:00").toISOString(),
              allDay: true,
              jobId: job.id,
              clientId,
            },
          });
          queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        } catch {
          /* event failure is non-fatal */
        }
      }

      toast({ title: scheduleDate ? "Job created and added to calendar" : "Job created" });
      setIsCreateOpen(false);
      resetForm();
    } catch {
      toast({ title: "Error creating job", variant: "destructive" });
    }
  };

  const isPending = createJob.isPending || createClient.isPending || createEvent.isPending;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground mt-1">Manage your construction projects.</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Job
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Job</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-5 pt-2">
              {/* Client selector */}
              <div className="space-y-2">
                <Label>Client</Label>
                {!showNewClientForm ? (
                  <div className="space-y-2">
                    <Popover open={clientDropdownOpen} onOpenChange={setClientDropdownOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={clientDropdownOpen}
                          className="w-full justify-between font-normal"
                        >
                          {selectedClient ? selectedClient.name : "Search existing client…"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[480px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Type to search clients…" />
                          <CommandList>
                            <CommandEmpty>No clients found.</CommandEmpty>
                            <CommandGroup>
                              {clients?.map(c => (
                                <CommandItem
                                  key={c.id}
                                  value={c.name}
                                  onSelect={() => {
                                    setSelectedClientId(c.id === selectedClientId ? null : c.id);
                                    setClientDropdownOpen(false);
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", selectedClientId === c.id ? "opacity-100" : "opacity-0")} />
                                  <div>
                                    <div className="font-medium">{c.name}</div>
                                    {(c.phone || c.city) && (
                                      <div className="text-xs text-muted-foreground">
                                        {c.phone}{c.phone && c.city ? " · " : ""}{c.city}
                                      </div>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                      onClick={() => { setShowNewClientForm(true); setSelectedClientId(null); }}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      New client
                    </button>
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">New Client</p>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setShowNewClientForm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                    <Input
                      placeholder="Full name *"
                      value={newClientData.name}
                      onChange={e => setNewClientData(prev => ({ ...prev, name: e.target.value }))}
                      required={showNewClientForm}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Phone"
                        value={newClientData.phone}
                        onChange={e => setNewClientData(prev => ({ ...prev, phone: e.target.value }))}
                      />
                      <Input
                        placeholder="Address"
                        value={newClientData.address}
                        onChange={e => setNewClientData(prev => ({ ...prev, address: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Job Title *</Label>
                <Input id="title" name="title" value={formData.title} onChange={handleChange} required placeholder="e.g. Kitchen Remodel" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="jobType">Job Type</Label>
                <Input id="jobType" name="jobType" value={formData.jobType} onChange={handleChange} placeholder="e.g. Remodel, Roofing, HVAC" />
              </div>

              {/* Schedule + Event Label */}
              <div className="border rounded-lg p-4 space-y-3 bg-muted/10">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CalendarPlus className="h-4 w-4 text-primary" />
                  Schedule (optional)
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="scheduleDate" className="text-xs">Date</Label>
                    <Input
                      id="scheduleDate"
                      type="date"
                      value={scheduleDate}
                      onChange={e => setScheduleDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Auto-label as</Label>
                    <Select value={eventLabel} onValueChange={v => setEventLabel(v as EventLabelValue)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EVENT_LABEL_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {scheduleDate && (
                  <p className="text-xs text-muted-foreground">
                    A "{EVENT_LABEL_OPTIONS.find(o => o.value === eventLabel)?.label}" calendar event will be created automatically.
                  </p>
                )}
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address">Job Address</Label>
                <Input id="address" name="address" value={formData.address} onChange={handleChange} placeholder="Street address" />
                <div className="grid grid-cols-6 gap-2">
                  <Input className="col-span-3" name="city" value={formData.city} onChange={handleChange} placeholder="City" />
                  <Input className="col-span-1" name="state" value={formData.state} onChange={handleChange} placeholder="ST" />
                  <Input className="col-span-2" name="zipCode" value={formData.zipCode} onChange={handleChange} placeholder="ZIP" />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>Cancel</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Creating…" : "Create Job"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs…"
            className="pl-9 bg-background"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="material_list">Material List</SelectItem>
            <SelectItem value="estimate">Estimate</SelectItem>
            <SelectItem value="estimate_sent">Estimate Sent</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="finished">Finished</SelectItem>
            <SelectItem value="invoiced">Invoiced</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : !jobs || jobs.length === 0 ? (
        <div className="text-center py-16 px-6 border border-dashed rounded-xl bg-card">
          <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <HardHat className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No jobs found</h2>
          <p className="text-muted-foreground max-w-sm mx-auto mb-6">
            {search || statusFilter !== "all" ? "No jobs match your criteria." : "Get started by adding your first job."}
          </p>
          {!(search || statusFilter !== "all") && (
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Job
            </Button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map(job => (
            <Link key={job.id} href={`/jobs/${job.id}`}>
              <Card className="hover:border-primary/50 hover:shadow-md cursor-pointer transition-all h-full">
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-semibold text-lg line-clamp-1 pr-2">{job.title}</div>
                    <div className="text-xs px-2.5 py-1 font-medium rounded-full bg-primary/10 text-primary capitalize shrink-0">
                      {job.status.replace(/_/g, " ")}
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground mb-4 line-clamp-1">
                    {job.clientName || "No client assigned"}
                  </div>

                  <div className="space-y-2 mt-auto text-sm text-muted-foreground">
                    {job.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="line-clamp-1">{job.address}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 mt-2 border-t">
                      <div className="font-medium text-foreground">{formatCurrency(job.estimatedValue)}</div>
                      <div className="text-xs">{formatDate(job.createdAt)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
