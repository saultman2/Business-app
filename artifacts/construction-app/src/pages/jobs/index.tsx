import React, { useState } from "react";
import { useListJobs, getListJobsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { HardHat, Search, Plus, MapPin, Calendar, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusColors = {
  lead: "bg-slate-100 text-slate-800",
  scheduled: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function JobsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: jobs, isLoading } = useListJobs({
    ...(statusFilter !== "all" ? { status: statusFilter } : {})
  });

  const filteredJobs = jobs?.filter(job => 
    search === "" || 
    job.title.toLowerCase().includes(search.toLowerCase()) || 
    job.clientName?.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return "$0";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Jobs</h1>
          <p className="text-slate-500 mt-1">Manage all construction projects</p>
        </div>
        <Button asChild>
          <Link href="/jobs/new"><Plus className="mr-2 h-4 w-4" /> New Job</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search jobs..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead>Job</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-5 w-32 bg-slate-100 animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-5 w-24 bg-slate-100 animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-6 w-20 bg-slate-100 animate-pulse rounded-full"></div></TableCell>
                    <TableCell><div className="h-5 w-16 bg-slate-100 animate-pulse rounded"></div></TableCell>
                    <TableCell><div className="h-5 w-24 bg-slate-100 animate-pulse rounded"></div></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))
              ) : filteredJobs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No jobs found matching your criteria
                  </TableCell>
                </TableRow>
              ) : (
                filteredJobs?.map(job => (
                  <TableRow key={job.id} className="group">
                    <TableCell>
                      <div className="font-medium text-slate-900 group-hover:text-primary transition-colors">
                        <Link href={`/jobs/${job.id}`}>{job.title}</Link>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center mt-1">
                        <MapPin className="h-3 w-3 mr-1" />
                        {job.address || "No address"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {job.clientId ? (
                        <Link href={`/clients/${job.clientId}`} className="hover:underline text-slate-700">
                          {job.clientName}
                        </Link>
                      ) : (
                        <span className="text-slate-500 italic">No client</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize border-none ${statusColors[job.status as keyof typeof statusColors]}`}>
                        {job.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatCurrency(job.estimatedValue)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-700">
                        {job.startDate ? format(new Date(job.startDate), 'MMM d, yyyy') : "TBD"}
                      </div>
                      <div className="text-xs text-slate-500">
                        to {job.endDate ? format(new Date(job.endDate), 'MMM d, yyyy') : "TBD"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/jobs/${job.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
