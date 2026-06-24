import React from "react";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HardHat, FileText, DollarSign, Users, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading || !summary) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[120px]" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Command Center</h1>
          <p className="text-slate-500 mt-1">Overview of your construction business</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/clients/new">New Client</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/estimates/new">New Estimate</Link>
          </Button>
          <Button asChild>
            <Link href="/jobs/new">New Job</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <HardHat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeJobs}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Estimates</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.estimatesSent}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.estimatesDrafted} drafted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collected Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalPaidAmount)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalClients}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary.recentJobs.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">No recent jobs</div>
              ) : (
                summary.recentJobs.map(job => (
                  <Link href={`/jobs/${job.id}`} key={job.id} className="flex items-center justify-between group hover:bg-slate-50 p-2 -mx-2 rounded-md transition-colors cursor-pointer">
                    <div className="flex flex-col">
                      <span className="font-medium group-hover:text-primary transition-colors">{job.title}</span>
                      <span className="text-sm text-muted-foreground">{job.clientName}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-mono">{formatCurrency(job.estimatedValue || 0)}</span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">{job.status.replace('_', ' ')}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming Events</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/calendar">View Calendar</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary.upcomingEvents.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">No upcoming events</div>
              ) : (
                summary.upcomingEvents.map(event => (
                  <div key={event.id} className="flex items-start gap-4">
                    <div className="flex flex-col items-center justify-center bg-slate-100 rounded-md w-12 h-12 shrink-0">
                      <span className="text-xs font-medium text-slate-500 uppercase">{format(new Date(event.startDatetime), 'MMM')}</span>
                      <span className="text-lg font-bold text-slate-900 leading-none">{format(new Date(event.startDatetime), 'd')}</span>
                    </div>
                    <div className="flex flex-col justify-center py-1">
                      <span className="font-medium text-sm">{event.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {event.allDay ? 'All Day' : format(new Date(event.startDatetime), 'h:mm a')}
                        {event.jobTitle ? ` · ${event.jobTitle}` : ''}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
