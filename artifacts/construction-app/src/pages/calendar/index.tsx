import React, { useState } from "react";
import { useListEvents, useCreateEvent, getListEventsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight, CalendarIcon, Clock, X } from "lucide-react";
import {
  format, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, subMonths, isSameMonth, isSameDay,
  startOfMonth, endOfMonth, parseISO, isAfter, startOfDay,
} from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export const EVENT_TYPE_OPTIONS = [
  { value: "quoting", label: "Quoting" },
  { value: "working", label: "Working" },
  { value: "follow_up", label: "Follow-up" },
  { value: "job_start", label: "Job Start" },
  { value: "job_end", label: "Job End" },
  { value: "meeting", label: "Meeting" },
  { value: "other", label: "Other" },
] as const;

export const typeColors: Record<string, string> = {
  quoting: "bg-blue-100 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300",
  working: "bg-teal-100 border-teal-200 text-teal-800 dark:bg-teal-900/30 dark:border-teal-800 dark:text-teal-300",
  follow_up: "bg-orange-100 border-orange-200 text-orange-800 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-300",
  job_start: "bg-green-100 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300",
  job_end: "bg-emerald-100 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300",
  meeting: "bg-purple-100 border-purple-200 text-purple-800 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-300",
  other: "bg-slate-100 border-slate-200 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300",
  estimate_appointment: "bg-blue-100 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300",
  job_work: "bg-teal-100 border-teal-200 text-teal-800 dark:bg-teal-900/30 dark:border-teal-800 dark:text-teal-300",
  payment_reminder: "bg-rose-100 border-rose-200 text-rose-800 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-300",
};

function getTypeColor(type: string): string {
  return typeColors[type] ?? typeColors.other;
}

function getTypeLabel(type: string): string {
  return EVENT_TYPE_OPTIONS.find(o => o.value === type)?.label ?? type.replace(/_/g, " ");
}

const dotColors: Record<string, string> = {
  quoting: "bg-blue-500",
  working: "bg-teal-500",
  follow_up: "bg-orange-500",
  job_start: "bg-green-500",
  job_end: "bg-emerald-500",
  meeting: "bg-purple-500",
  other: "bg-slate-400",
};

type CalendarEventLike = {
  id: number;
  title: string;
  type: string;
  startDatetime: string;
  allDay: boolean;
  jobTitle?: string | null;
  clientName?: string | null;
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [clickedEvent, setClickedEvent] = useState<CalendarEventLike | null>(null);

  const { data: events, isLoading } = useListEvents({});

  const createEvent = useCreateEvent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    type: "other" as string,
    startDatetime: new Date().toISOString().slice(0, 16),
    allDay: false,
    notes: "",
  });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const today = () => setCurrentDate(new Date());

  const daysInMonth = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate)),
    end: endOfWeek(endOfMonth(currentDate)),
  });

  const upcomingEvents = (events || [])
    .filter(e => isAfter(parseISO(e.startDatetime), startOfDay(new Date())))
    .slice(0, 5);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createEvent.mutate({
      data: {
        ...formData,
        startDatetime: new Date(formData.startDatetime).toISOString(),
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        toast({ title: "Event created successfully" });
        setIsCreateOpen(false);
        setFormData({ title: "", type: "other", startDatetime: new Date().toISOString().slice(0, 16), allDay: false, notes: "" });
      },
      onError: () => {
        toast({ title: "Error creating event", variant: "destructive" });
      },
    });
  };

  return (
    <div className="space-y-4 flex flex-col p-6 md:p-8 max-w-7xl mx-auto h-[calc(100vh-4rem)]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground mt-1">Manage jobs and appointments</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center rounded-md border bg-background shadow-sm">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="rounded-none border-r h-9 w-9">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={today} className="rounded-none font-medium px-4 h-9">Today</Button>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="rounded-none border-l h-9 w-9">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New Event
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[440px]">
              <DialogHeader>
                <DialogTitle>Add Calendar Event</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Event Title</Label>
                  <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type / Label</Label>
                    <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPE_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date & Time</Label>
                    <Input
                      type={formData.allDay ? "date" : "datetime-local"}
                      value={formData.startDatetime}
                      onChange={e => setFormData({ ...formData, startDatetime: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="allDay"
                    checked={formData.allDay}
                    onCheckedChange={c => setFormData({ ...formData, allDay: !!c })}
                  />
                  <Label htmlFor="allDay">All-day event</Label>
                </div>
                <div className="pt-2 flex justify-end">
                  <Button type="submit" disabled={createEvent.isPending}>
                    {createEvent.isPending ? "Saving…" : "Save Event"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Upcoming events strip */}
      {upcomingEvents.length > 0 && (
        <div className="shrink-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Upcoming</p>
          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {upcomingEvents.map(ev => (
              <button
                key={ev.id}
                type="button"
                onClick={() => setClickedEvent(ev as CalendarEventLike)}
                className={`flex-none flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity ${getTypeColor(ev.type)}`}
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${dotColors[ev.type] ?? "bg-slate-400"}`} />
                <span>{format(parseISO(ev.startDatetime), "MMM d")}</span>
                <span className="opacity-70">·</span>
                <span>{ev.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Event detail popup */}
      {clickedEvent && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4" onClick={() => setClickedEvent(null)}>
          <div
            className="bg-card border rounded-xl shadow-lg p-5 w-full max-w-sm z-50 relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setClickedEvent(null)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${dotColors[clickedEvent.type] ?? "bg-slate-400"}`} />
              <div className="space-y-1 min-w-0">
                <p className="font-semibold leading-tight">{clickedEvent.title}</p>
                <Badge variant="secondary" className="text-xs">{getTypeLabel(clickedEvent.type)}</Badge>
                <p className="text-sm text-muted-foreground">
                  {clickedEvent.allDay
                    ? format(parseISO(clickedEvent.startDatetime), "MMMM d, yyyy")
                    : format(parseISO(clickedEvent.startDatetime), "MMM d, yyyy 'at' h:mm a")}
                </p>
                {clickedEvent.jobTitle && <p className="text-sm text-muted-foreground">Job: {clickedEvent.jobTitle}</p>}
                {clickedEvent.clientName && <p className="text-sm text-muted-foreground">Client: {clickedEvent.clientName}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden shadow-sm border-border">
        <CardHeader className="py-3 border-b shrink-0 flex flex-row items-center justify-between bg-muted/20">
          <CardTitle className="text-xl font-bold">
            {format(currentDate, "MMMM yyyy")}
          </CardTitle>
          <div className="hidden md:flex gap-4">
            {EVENT_TYPE_OPTIONS.slice(0, 5).map(o => (
              <div key={o.value} className="flex items-center text-xs text-muted-foreground gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${dotColors[o.value] ?? "bg-slate-400"}`} />
                {o.label}
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto bg-background">
          <div className="grid grid-cols-7 border-b shrink-0 bg-muted/30">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
              <div key={day} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider border-r last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-fr h-full min-h-[500px]">
            {daysInMonth.map(day => {
              const dayEvents = (events || []).filter(e => {
                try { return isSameDay(parseISO(e.startDatetime), day); } catch { return false; }
              });
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[80px] p-1.5 border-r border-b last:border-r-0 ${!isCurrentMonth ? "bg-muted/10 opacity-60" : ""} ${isToday ? "bg-primary/5" : ""}`}
                >
                  <div className="flex justify-between items-center mb-1 px-0.5">
                    <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                      isToday ? "bg-primary text-primary-foreground" :
                      !isCurrentMonth ? "text-muted-foreground" : "text-foreground"
                    }`}>
                      {format(day, "d")}
                    </span>
                  </div>
                  <div className="space-y-1 overflow-y-auto max-h-[calc(100%-2rem)] hide-scrollbar">
                    {dayEvents.map(event => (
                      <button
                        key={event.id}
                        type="button"
                        className={`w-full text-left text-xs px-1.5 py-1 rounded truncate border ${getTypeColor(event.type)} cursor-pointer hover:opacity-80 transition-opacity`}
                        title={`${event.title}${event.jobTitle ? ` · ${event.jobTitle}` : ""}`}
                        onClick={() => setClickedEvent(event as CalendarEventLike)}
                      >
                        {!event.allDay && (
                          <span className="font-semibold opacity-70 mr-1">
                            {format(parseISO(event.startDatetime), "h:mm")}
                          </span>
                        )}
                        {event.title}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
