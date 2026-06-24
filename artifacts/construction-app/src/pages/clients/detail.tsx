import { useRoute, Link, useLocation } from "wouter";
import { useGetClient, useGetClientHistory } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Phone, Mail, MapPin, Plus } from "lucide-react";

export default function ClientDetail() {
  const [, params] = useRoute("/clients/:id");
  const [, setLocation] = useLocation();
  const id = params?.id ? parseInt(params.id) : 0;

  const { data: client, isLoading: clientLoading } = useGetClient(id);
  const { data: history, isLoading: historyLoading } = useGetClientHistory(id);

  if (clientLoading || historyLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!client) return <div className="p-6">Client not found</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/clients")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
        </div>
        <Button onClick={() => setLocation(`/jobs?newJobClientId=${id}`)}>
          <Plus className="h-4 w-4 mr-2" />
          New Job
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Contact Info</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {client.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{client.phone}</span>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{client.email}</span>
              </div>
            )}
            {(client.address || client.city) && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>
                  {[client.address, client.city, client.state, client.zipCode].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
            {!client.phone && !client.email && !client.address && (
              <p className="text-muted-foreground text-sm">No contact info on file.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Jobs</span>
              <span className="font-semibold">{history?.totalJobs ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Completed Jobs</span>
              <span className="font-semibold">{history?.completedJobs ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Revenue</span>
              <span className="font-semibold">{formatCurrency(history?.totalRevenue ?? 0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Jobs</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setLocation(`/jobs?newJobClientId=${id}`)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Job
          </Button>
        </CardHeader>
        <CardContent>
          {history?.jobs?.length ? (
            <div className="space-y-2">
              {history.jobs.map(job => (
                <Link key={job.id} href={`/jobs/${job.id}`}>
                  <div className="flex justify-between items-center p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    <div>
                      <div className="font-semibold">{job.title}</div>
                      <div className="text-sm text-muted-foreground capitalize">{job.status.replace(/_/g, " ")}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-semibold">{formatCurrency(job.estimatedValue)}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No jobs yet for this client.</p>
              <Button variant="outline" onClick={() => setLocation(`/jobs?newJobClientId=${id}`)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Job
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
