import { Router, type IRouter } from "express";
import { eq, and, ilike, or, desc, count, sum } from "drizzle-orm";
import {
  db,
  jobsTable,
  clientsTable,
  jobPhotosTable,
  receiptsTable,
  estimatesTable,
  materialListsTable,
  materialItemsTable,
} from "@workspace/db";
import {
  ListJobsQueryParams,
  CreateJobBody,
  GetJobParams,
  UpdateJobParams,
  UpdateJobBody,
  DeleteJobParams,
  GetJobSummaryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { ownsClient } from "../lib/ownership";
import { serializeJob, n, nn, toNumStr } from "../lib/serialize";
import { hasActiveSubscription, FREE_JOB_LIMIT } from "../lib/revenuecat";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/jobs", async (req, res): Promise<void> => {
  const query = ListJobsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const conds = [eq(jobsTable.companyId, req.companyId!)];
  if (query.data.status) conds.push(eq(jobsTable.status, query.data.status));
  if (query.data.clientId)
    conds.push(eq(jobsTable.clientId, query.data.clientId));
  if (query.data.search) {
    const s = `%${query.data.search}%`;
    const orCond = or(
      ilike(jobsTable.title, s),
      ilike(jobsTable.address, s),
      ilike(jobsTable.city, s),
    );
    if (orCond) conds.push(orCond);
  }

  const rows = await db
    .select({ job: jobsTable, clientName: clientsTable.name })
    .from(jobsTable)
    .leftJoin(
      clientsTable,
      and(
        eq(jobsTable.clientId, clientsTable.id),
        eq(clientsTable.companyId, req.companyId!),
      ),
    )
    .where(and(...conds))
    .orderBy(desc(jobsTable.createdAt));

  res.json(rows.map((r) => serializeJob(r.job, r.clientName)));
});

router.post("/jobs", async (req, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  if (!(await ownsClient(req.companyId!, d.clientId))) {
    res.status(400).json({ error: "Invalid client reference" });
    return;
  }

  // Free-tier limit: companies without an active subscription may only keep a
  // limited number of jobs. Paid plans (Pro/Business) are unlimited.
  //
  // Invariant: each Clerk user owns exactly one company (JIT-provisioned by
  // owner id), so `req.userId` (the company owner) is the subscription identity
  // and matches the client's `Purchases.logIn(userId)`. When team members are
  // introduced (a Business feature), resolve the company owner's id here rather
  // than the requesting user's.
  const subscribed = await hasActiveSubscription(req.userId!);
  if (!subscribed) {
    const [{ c: jobCount }] = await db
      .select({ c: count() })
      .from(jobsTable)
      .where(eq(jobsTable.companyId, req.companyId!));
    if (jobCount >= FREE_JOB_LIMIT) {
      res.status(403).json({
        error: `Free plan is limited to ${FREE_JOB_LIMIT} jobs. Upgrade to Pro for unlimited jobs.`,
        code: "FREE_LIMIT_REACHED",
        limit: FREE_JOB_LIMIT,
      });
      return;
    }
  }

  const [job] = await db
    .insert(jobsTable)
    .values({
      ...d,
      companyId: req.companyId!,
      estimatedValue: toNumStr(d.estimatedValue),
      actualCost: toNumStr(d.actualCost),
    })
    .returning();
  res.status(201).json(serializeJob(job));
});

router.get("/jobs/finance-summary", async (req, res): Promise<void> => {
  const cid = req.companyId!;

  const [jobRows, materialTotals, estimateTotals] = await Promise.all([
    db
      .select({ job: jobsTable, clientName: clientsTable.name })
      .from(jobsTable)
      .leftJoin(
        clientsTable,
        and(eq(jobsTable.clientId, clientsTable.id), eq(clientsTable.companyId, cid)),
      )
      .where(eq(jobsTable.companyId, cid))
      .orderBy(desc(jobsTable.createdAt)),

    db
      .select({ jobId: materialListsTable.jobId, total: sum(materialItemsTable.lineTotal) })
      .from(materialItemsTable)
      .innerJoin(materialListsTable, eq(materialItemsTable.materialListId, materialListsTable.id))
      .where(eq(materialListsTable.companyId, cid))
      .groupBy(materialListsTable.jobId),

    db
      .select({
        jobId: estimatesTable.jobId,
        total: estimatesTable.total,
        laborSubtotal: estimatesTable.laborSubtotal,
        status: estimatesTable.status,
      })
      .from(estimatesTable)
      .where(eq(estimatesTable.companyId, cid))
      .orderBy(desc(estimatesTable.createdAt)),
  ]);

  const materialMap = new Map<number, number>();
  for (const row of materialTotals) {
    if (row.jobId != null) materialMap.set(row.jobId, n(row.total));
  }

  const estimateMap = new Map<number, { total: number; laborSubtotal: number }>();
  for (const row of estimateTotals) {
    if (row.jobId == null) continue;
    const existing = estimateMap.get(row.jobId);
    const isApproved = row.status === "approved";
    if (!existing || isApproved) {
      estimateMap.set(row.jobId, {
        total: n(row.total),
        laborSubtotal: n(row.laborSubtotal),
      });
    }
  }

  res.json(
    jobRows.map(({ job, clientName }) => ({
      id: job.id,
      title: job.title,
      clientId: job.clientId,
      clientName: clientName ?? null,
      status: job.status,
      billingStatus: job.billingStatus,
      materialsTotal: materialMap.get(job.id) ?? 0,
      laborTotal: estimateMap.get(job.id)?.laborSubtotal ?? 0,
      expectedPay:
        estimateMap.get(job.id)?.total ?? nn(job.estimatedValue) ?? 0,
    })),
  );
});

async function loadJob(companyId: number, id: number) {
  const [row] = await db
    .select({ job: jobsTable, clientName: clientsTable.name })
    .from(jobsTable)
    .leftJoin(
      clientsTable,
      and(
        eq(jobsTable.clientId, clientsTable.id),
        eq(clientsTable.companyId, companyId),
      ),
    )
    .where(and(eq(jobsTable.id, id), eq(jobsTable.companyId, companyId)));
  return row;
}

router.get("/jobs/:id", async (req, res): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const row = await loadJob(req.companyId!, params.data.id);
  if (!row) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(serializeJob(row.job, row.clientName));
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
  const d = parsed.data;
  if (!(await ownsClient(req.companyId!, d.clientId))) {
    res.status(400).json({ error: "Invalid client reference" });
    return;
  }
  const [updated] = await db
    .update(jobsTable)
    .set({
      ...d,
      estimatedValue: toNumStr(d.estimatedValue),
      actualCost: toNumStr(d.actualCost),
    })
    .where(
      and(
        eq(jobsTable.id, params.data.id),
        eq(jobsTable.companyId, req.companyId!),
      ),
    )
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  const row = await loadJob(req.companyId!, params.data.id);
  res.json(serializeJob(row!.job, row!.clientName));
});

router.delete("/jobs/:id", async (req, res): Promise<void> => {
  const params = DeleteJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [job] = await db
    .delete(jobsTable)
    .where(
      and(
        eq(jobsTable.id, params.data.id),
        eq(jobsTable.companyId, req.companyId!),
      ),
    )
    .returning();
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
  const row = await loadJob(req.companyId!, params.data.id);
  if (!row) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  const jobId = params.data.id;
  const cid = req.companyId!;
  const [[photos], [receipts], [estimates], [matList]] = await Promise.all([
    db
      .select({ c: count() })
      .from(jobPhotosTable)
      .where(
        and(
          eq(jobPhotosTable.jobId, jobId),
          eq(jobPhotosTable.companyId, cid),
        ),
      ),
    db
      .select({ total: sum(receiptsTable.amount) })
      .from(receiptsTable)
      .where(
        and(eq(receiptsTable.jobId, jobId), eq(receiptsTable.companyId, cid)),
      ),
    db
      .select({ c: count() })
      .from(estimatesTable)
      .where(
        and(eq(estimatesTable.jobId, jobId), eq(estimatesTable.companyId, cid)),
      ),
    db
      .select({ c: count() })
      .from(materialListsTable)
      .where(
        and(
          eq(materialListsTable.jobId, jobId),
          eq(materialListsTable.companyId, cid),
        ),
      ),
  ]);

  res.json({
    job: serializeJob(row.job, row.clientName),
    photoCount: photos.c,
    receiptTotal: n(receipts.total),
    estimateCount: estimates.c,
    hasMaterialList: matList.c > 0,
  });
});

export default router;
