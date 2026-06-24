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
import { serializeJob, n, toNumStr } from "../lib/serialize";

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
