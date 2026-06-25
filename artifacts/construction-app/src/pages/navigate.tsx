import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useListJobs, useListClients, useListEvents } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin,
  Navigation,
  Phone,
  Copy,
  Apple,
  Map as MapIcon,
  CalendarClock,
} from "lucide-react";
import {
  buildFullAddress,
  defaultMapProvider,
  navigationUrl,
  type MapProvider,
} from "@/lib/maps";
import { formatDate } from "@/lib/format";

const INACTIVE_STATUSES = new Set(["paid"]);

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className="capitalize shrink-0">
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export default function NavigatePage() {
  const { toast } = useToast();
  const [provider, setProvider] = useState<MapProvider>(defaultMapProvider());

  const { data: jobs, isLoading } = useListJobs({});
  const { data: clients } = useListClients({});
  const { data: events } = useListEvents({});

  const clientById = useMemo(() => {
    const m = new Map<number, NonNullable<typeof clients>[number]>();
    (clients ?? []).forEach((c) => m.set(c.id, c));
    return m;
  }, [clients]);

  // Earliest upcoming appointment (calendar event) per job.
  const nextApptByJob = useMemo(() => {
    const now = Date.now();
    const m = new Map<number, number>();
    (events ?? []).forEach((e) => {
      if (e.jobId == null) return;
      const t = new Date(e.startDatetime).getTime();
      if (Number.isNaN(t) || t < now) return;
      const cur = m.get(e.jobId);
      if (cur === undefined || t < cur) m.set(e.jobId, t);
    });
    return m;
  }, [events]);

  const activeJobs = useMemo(() => {
    return (jobs ?? [])
      .filter((j) => !INACTIVE_STATUSES.has(j.status))
      .sort((a, b) => {
        const aAppt = nextApptByJob.get(a.id);
        const bAppt = nextApptByJob.get(b.id);
        // Jobs with an upcoming appointment first, soonest first.
        if (aAppt !== undefined && bAppt !== undefined) return aAppt - bAppt;
        if (aAppt !== undefined) return -1;
        if (bAppt !== undefined) return 1;
        // Fallback for jobs without a scheduled visit: most recent first.
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
  }, [jobs, nextApptByJob]);

  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      toast({ title: "Address copied to clipboard" });
    } catch {
      toast({ title: "Couldn't copy address", variant: "destructive" });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Navigate
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            One-tap directions to your active job sites.
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40 self-start">
          <button
            onClick={() => setProvider("apple")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              provider === "apple"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Apple className="h-4 w-4" />
            Apple
          </button>
          <button
            onClick={() => setProvider("google")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              provider === "google"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MapIcon className="h-4 w-4" />
            Google
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : activeJobs.length === 0 ? (
        <div className="text-center py-20 px-6 border border-dashed rounded-xl bg-card">
          <div className="bg-primary/10 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4">
            <Navigation className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-1.5">No active jobs</h3>
          <p className="text-muted-foreground max-w-sm mx-auto text-sm mb-5">
            Once you have active jobs with addresses, they'll appear here with
            one-tap navigation.
          </p>
          <Link href="/jobs">
            <Button>Go to Projects</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {activeJobs.map((job) => {
            const client =
              job.clientId != null ? clientById.get(job.clientId) : undefined;
            const fullAddress =
              buildFullAddress(job) ||
              buildFullAddress({
                address: client?.address,
                city: client?.city,
                state: client?.state,
                zipCode: client?.zipCode,
              });
            const phone = client?.phone?.trim() || "";

            return (
              <div
                key={job.id}
                className="bg-card border border-card-border rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Link href={`/jobs/${job.id}`}>
                      <span className="font-semibold text-base truncate hover:text-primary cursor-pointer">
                        {job.title}
                      </span>
                    </Link>
                    <StatusBadge status={job.status} />
                  </div>
                  <div className="text-sm text-muted-foreground mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{job.clientName || "No client assigned"}</span>
                    {nextApptByJob.get(job.id) !== undefined && (
                      <span className="inline-flex items-center gap-1 text-primary font-medium">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Next visit {formatDate(new Date(nextApptByJob.get(job.id)!).toISOString())}
                      </span>
                    )}
                  </div>

                  {fullAddress ? (
                    <button
                      onClick={() => copyAddress(fullAddress)}
                      className="flex items-start gap-1.5 text-sm text-foreground hover:text-primary text-left group"
                      title="Tap to copy address"
                    >
                      <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground group-hover:text-primary" />
                      <span className="leading-snug">{fullAddress}</span>
                      <Copy className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-0 group-hover:opacity-60" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 text-sm">
                      <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        No address on file
                      </span>
                      {job.clientId != null && (
                        <Link href={`/clients/${job.clientId}`}>
                          <span className="text-primary hover:underline cursor-pointer">
                            Add one
                          </span>
                        </Link>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {phone && (
                    <a href={`tel:${phone}`}>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Phone className="h-4 w-4" />
                        Call
                      </Button>
                    </a>
                  )}
                  {fullAddress && (
                    <a
                      href={navigationUrl(fullAddress, provider)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" className="gap-1.5">
                        <Navigation className="h-4 w-4" />
                        Navigate
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
