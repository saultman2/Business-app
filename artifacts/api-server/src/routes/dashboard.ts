import { Router, type IRouter } from "express";
import { eq, gte, sql } from "drizzle-orm";
import { db, jobsTable, estimatesTable, clientsTable, calendarEventsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const todayStr = now.toISOString();

  const [jobs, estimates, clients, upcomingEvents, recentJobRows] = await Promise.all([
    db.select({ status: jobsTable.status }).from(jobsTable),
    db.select({ status: estimatesTable.status, total: estimatesTable.total, createdAt: estimatesTable.createdAt }).from(estimatesTable),
    db.select({ id: clientsTable.id }).from(clientsTable),
    db
      .select({
        event: calendarEventsTable,
        jobTitle: jobsTable.title,
        clientName: clientsTable.name,
      })
      .from(calendarEventsTable)
      .leftJoin(jobsTable, eq(calendarEventsTable.jobId, jobsTable.id))
      .leftJoin(clientsTable, eq(calendarEventsTable.clientId, clientsTable.id))
      .where(gte(calendarEventsTable.startDatetime, todayStr))
      .orderBy(calendarEventsTable.startDatetime)
      .limit(5),
    db
      .select({ job: jobsTable, clientName: clientsTable.name })
      .from(jobsTable)
      .leftJoin(clientsTable, eq(jobsTable.clientId, clientsTable.id))
      .orderBy(jobsTable.createdAt)
      .limit(5),
  ]);

  const activeJobsCount = jobs.filter(j => j.status === "in_progress" || j.status === "scheduled").length;
  const pendingEstimates = estimates.filter(e => e.status === "sent" || e.status === "draft");
  const pendingEstimatesTotal = pendingEstimates.reduce((s, e) => s + parseFloat(e.total ?? "0"), 0);

  const thisMonthRevenue = estimates
    .filter(e => e.status === "accepted" && e.createdAt >= new Date(startOfMonth))
    .reduce((s, e) => s + parseFloat(e.total ?? "0"), 0);

  res.json({
    activeJobsCount,
    pendingEstimatesCount: pendingEstimates.length,
    pendingEstimatesTotal,
    thisMonthRevenue,
    totalClientsCount: clients.length,
    upcomingEventsCount: upcomingEvents.length,
    recentJobs: recentJobRows.map(({ job, clientName }) => ({
      ...job,
      clientName: clientName ?? null,
      estimatedValue: job.estimatedValue ? parseFloat(job.estimatedValue) : null,
      actualCost: job.actualCost ? parseFloat(job.actualCost) : null,
      createdAt: job.createdAt.toISOString(),
    })),
    upcomingEvents: upcomingEvents.map(({ event, jobTitle, clientName }) => ({
      ...event,
      jobTitle: jobTitle ?? null,
      clientName: clientName ?? null,
      createdAt: event.createdAt.toISOString(),
    })),
  });
});

export default router;
