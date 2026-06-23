import React from "react";
import { useListEvents } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, isSameMonth, isSameDay, startOfMonth, endOfMonth, parseISO } from "date-fns";

const typeColors = {
  estimate_visit: "bg-blue-100 border-blue-200 text-blue-800",
  job_start: "bg-green-100 border-green-200 text-green-800",
  job_work: "bg-teal-100 border-teal-200 text-teal-800",
  job_end: "bg-emerald-100 border-emerald-200 text-emerald-800",
  follow_up: "bg-orange-100 border-orange-200 text-orange-800",
  meeting: "bg-purple-100 border-purple-200 text-purple-800",
  other: "bg-slate-100 border-slate-200 text-slate-800"
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = React.useState(new Date());
  
  // Use a wide date range to ensure we capture events for the view
  const startDate = startOfWeek(startOfMonth(currentDate)).toISOString();
  const endDate = endOfWeek(endOfMonth(currentDate)).toISOString();
  
  const { data: events, isLoading } = useListEvents({
    startDate,
    endDate
  });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const today = () => setCurrentDate(new Date());

  const daysInMonth = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate)),
    end: endOfWeek(endOfMonth(currentDate))
  });

  return (
    <div className="space-y-6 h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Schedule</h1>
          <p className="text-slate-500 mt-1">Manage jobs and appointments</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-md border border-slate-200 bg-white">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="rounded-none border-r"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" onClick={today} className="rounded-none font-medium px-4">Today</Button>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="rounded-none border-l"><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button><Plus className="mr-2 h-4 w-4" /> New Event</Button>
        </div>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <CardHeader className="py-4 border-b shrink-0 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-bold">
            {format(currentDate, "MMMM yyyy")}
          </CardTitle>
          <div className="flex gap-2">
            <div className="flex items-center text-xs"><div className="w-3 h-3 rounded-full bg-blue-500 mr-1.5"></div> Estimate</div>
            <div className="flex items-center text-xs"><div className="w-3 h-3 rounded-full bg-green-500 mr-1.5"></div> Job</div>
            <div className="flex items-center text-xs"><div className="w-3 h-3 rounded-full bg-orange-500 mr-1.5"></div> Follow-up</div>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto">
          <div className="grid grid-cols-7 border-b shrink-0 bg-slate-50">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-2 text-center text-sm font-medium text-slate-500 border-r last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-fr h-full">
            {daysInMonth.map((day, idx) => {
              const dayEvents = events?.filter(e => isSameDay(parseISO(e.startDatetime), day)) || [];
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, new Date());
              
              return (
                <div 
                  key={day.toISOString()} 
                  className={`min-h-[120px] p-2 border-r border-b ${!isCurrentMonth ? 'bg-slate-50/50' : ''} ${isToday ? 'bg-blue-50/20' : ''}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-primary text-primary-foreground' : 
                      !isCurrentMonth ? 'text-slate-400' : 'text-slate-700'
                    }`}>
                      {format(day, 'd')}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayEvents.map(event => (
                      <div 
                        key={event.id}
                        className={`text-xs px-2 py-1 rounded truncate border ${typeColors[event.type as keyof typeof typeColors] || typeColors.other} cursor-pointer hover:brightness-95`}
                        title={`${event.title} - ${event.jobTitle || event.clientName || ''}`}
                      >
                        <span className="font-semibold">{format(parseISO(event.startDatetime), 'h:mma')}</span> {event.title}
                      </div>
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
