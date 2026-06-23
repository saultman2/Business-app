import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, jobsTable, clientsTable, estimatesTable, jobPhotosTable, receiptsTable } from "@workspace/db";
import {
  ListJobsQueryParams,
  GetJobParams,
  CreateJobBody,
  UpdateJobParams,
  UpdateJobBody,
  DeleteJobParams,
  GetJobSummaryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatJob(j: typeof jobsTable.$inferSelect, clientName?: string | null) {
  return {
    ...j,
    clientName: clientName ?? null,
    estimatedValue: j.estimatedValue ? parseFloat(j.estimatedValue) : null,
    actualCost: j.actualCost ? parseFloat(j.actualCost) : null,
    createdAt: j.createdAt.toISOString(),
  };
}

router.get("/jobs", async (req, res): Promise<void> => {
  const query = ListJobsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.status) conditions.push(eq(jobsTable.status, query.data.status));
  if (query.data.clientId) conditions.push(eq(jobsTable.clientId, Number(query.data.clientId)));

  const jobs = await db
    .select({
      job: jobsTable,
      clientName: clientsTable.name,
    })
    .from(jobsTable)
    .leftJoin(clientsTable, eq(jobsTable.clientId, clientsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(jobsTable.createdAt);

  res.json(jobs.map(({ job, clientName }) => formatJob(job, clientName)));
});

router.post("/jobs", async (req, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [job] = await db.insert(jobsTable).values(parsed.data).returning();
  res.status(201).json(formatJob(job));
});

router.get("/jobs/:id", async (req, res): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select({ job: jobsTable, clientName: clientsTable.name })
    .from(jobsTable)
    .leftJoin(clientsTable, eq(jobsTable.clientId, clientsTable.id))
    .where(eq(jobsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(formatJob(row.job, row.clientName));
});

router.patch("/jobs/:id", async (req, res): Promise<void> => {
  const params = UpdateJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [job] = await db
    .update(jobsTable)
    .set(parsed.data)
    .where(eq(jobsTable.id, params.data.id))
    .returning();
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(formatJob(job));
});

router.delete("/jobs/:id", async (req, res): Promise<void> => {
  const params = DeleteJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [job] = await db.delete(jobsTable).where(eq(jobsTable.id, params.data.id)).returning();
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/jobs/:id/summary", async (req, res): Promise<void> => {
  const params = GetJobSummaryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const jobId = params.data.id;

  const [estimates, photos, receipts] = await Promise.all([
    db.select().from(estimatesTable).where(eq(estimatesTable.jobId, jobId)),
    db.select().from(jobPhotosTable).where(eq(jobPhotosTable.jobId, jobId)),
    db.select().from(receiptsTable).where(eq(receiptsTable.jobId, jobId)),
  ]);

  const estimateTotal = estimates.reduce((s, e) => s + parseFloat(e.total ?? "0"), 0);
  const acceptedEstimateTotal = estimates.filter(e => e.status === "accepted").reduce((s, e) => s + parseFloat(e.total ?? "0"), 0);
  const receiptTotal = receipts.reduce((s, r) => s + parseFloat(r.amount ?? "0"), 0);

  res.json({
    jobId,
    estimateTotal,
    receiptTotal,
    photoCount: photos.length,
    beforePhotoCount: photos.filter(p => p.type === "before").length,
    afterPhotoCount: photos.filter(p => p.type === "after").length,
    estimateCount: estimates.length,
    acceptedEstimateTotal,
  });
});

export default router;
