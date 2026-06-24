import { useState, useRef } from "react";
import { useRoute, Link } from "wouter";
import { 
  useGetJob, 
  useUpdateJob, 
  useGetJobSummary, 
  useGetJobMaterialList, 
  useListJobPhotos,
  useListEstimates,
  useListInvoices,
  useCreateJobPhoto,
  getGetJobQueryKey,
  getGetJobSummaryQueryKey,
  getListJobPhotosQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@workspace/object-storage-web";
import { HardHat, FileText, Image as ImageIcon, Receipt, ListTodo, MapPin, Calendar as CalendarIcon, Clock, Plus, ArrowLeft } from "lucide-react";

export default function JobDetail() {
  const [, params] = useRoute("/jobs/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  
  const { data: job, isLoading: jobLoading } = useGetJob(id);
  const { data: summary, isLoading: summaryLoading } = useGetJobSummary(id);
  const updateJob = useUpdateJob();
  const createPhoto = useCreateJobPhoto();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const lastObjectPathRef = useRef<string | null>(null);

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
          <Link href={`/jobs/${job.id}/estimate`}>
            <Button><Plus className="w-4 h-4 mr-2" /> Create Estimate</Button>
          </Link>
        </div>
      </div>
      
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-muted/50 p-1 rounded-lg">
          <TabsTrigger value="overview" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Overview</TabsTrigger>
          <TabsTrigger value="materials" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Materials</TabsTrigger>
          <TabsTrigger value="estimates" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Estimates & Invoices</TabsTrigger>
          <TabsTrigger value="photos" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Photos</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6 pt-4">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 shadow-sm border-border">
              <CardHeader>
                <CardTitle>Job Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-y-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block mb-1">Type</span>
                    <span className="font-medium">{job.jobType || 'Unspecified'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-1">Priority</span>
                    <Badge variant={job.priority === 'high' ? 'destructive' : job.priority === 'medium' ? 'default' : 'secondary'} className="capitalize">
                      {job.priority}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-1">Start Date</span>
                    <span className="font-medium flex items-center">
                      <CalendarIcon className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                      {formatDate(job.startDate) || 'TBD'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-1">Target End Date</span>
                    <span className="font-medium flex items-center">
                      <CalendarIcon className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                      {formatDate(job.endDate) || 'TBD'}
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
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border">
              <CardHeader>
                <CardTitle>Summary</CardTitle>
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
        </TabsContent>
        
        <TabsContent value="materials" className="pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Material List</CardTitle>
                <CardDescription>Track materials needed for this job</CardDescription>
              </div>
              <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Add Item</Button>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 border border-dashed rounded-lg bg-muted/10">
                <ListTodo className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-20" />
                <h3 className="text-lg font-medium mb-1">No materials added yet</h3>
                <p className="text-muted-foreground text-sm mb-4">Create a material list to track costs and prepare estimates.</p>
                <Button variant="outline">Add First Item</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="estimates" className="pt-4 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Estimates</CardTitle>
                <CardDescription>Estimates sent to client</CardDescription>
              </div>
              <Link href={`/jobs/${id}/estimate`}>
                <Button size="sm"><Plus className="w-4 h-4 mr-2" /> New Estimate</Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 border border-dashed rounded-lg bg-muted/10">
                <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-20" />
                <p className="text-muted-foreground text-sm">No estimates created yet.</p>
              </div>
            </CardContent>
          </Card>
          
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
