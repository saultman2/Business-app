import { UsersRound } from "lucide-react";

export default function CrewPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Crew</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your team and assign them to jobs.
        </p>
      </div>

      <div className="text-center py-20 px-6 border border-dashed rounded-xl bg-card">
        <div className="bg-primary/10 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4">
          <UsersRound className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-1.5">Crew management is on the way</h3>
        <p className="text-muted-foreground max-w-sm mx-auto text-sm">
          Soon you'll be able to add team members, track who's on duty, and
          assign crew to jobs. Check back shortly.
        </p>
      </div>
    </div>
  );
}
