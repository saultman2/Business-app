import { Router, type IRouter } from "express";
import { eq, and, ilike, or, desc, sql, getTableColumns } from "drizzle-orm";
import { db, clientsTable, jobsTable } from "@workspace/db";
import {
  ListClientsQueryParams,
  GetClientParams,
  CreateClientBody,
  UpdateClientParams,
  UpdateClientBody,
  DeleteClientParams,
  GetClientHistoryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { serializeClient, serializeJob, n } from "../lib/serialize";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/clients", async (req, res): Promise<void> => {
  const query = ListClientsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const companyId = req.companyId!;
  const conds = [eq(clientsTable.companyId, companyId)];
  if (query.data.search) {
    const term = `%${query.data.search}%`;
    conds.push(
      or(
        ilike(clientsTable.name, term),
        ilike(clientsTable.phone, term),
        ilike(clientsTable.address, term),
        ilike(clientsTable.city, term),
      )!,
    );
  }

  const clients = await db
    .select({
      ...getTableColumns(clientsTable),
      jobCount: sql<number>`(
        SELECT count(*)::int FROM jobs
        WHERE jobs.client_id = ${clientsTable.id}
          AND jobs.company_id = ${companyId}
      )`,
      latestJobStatus: sql<string | null>`(
        SELECT status FROM jobs
        WHERE jobs.client_id = ${clientsTable.id}
          AND jobs.company_id = ${companyId}
        ORDER BY jobs.created_at DESC LIMIT 1
      )`,
    })
    .from(clientsTable)
    .where(and(...conds))
    .orderBy(clientsTable.name);

  res.json(
    clients.map(c => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
  );
});

router.post("/clients", async (req, res): Promise<void> => {
  const parsed = CreateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [client] = await db
    .insert(clientsTable)
    .values({ ...parsed.data, companyId: req.companyId! })
    .returning();
  res.status(201).json(serializeClient(client));
});

router.get("/clients/:id", async (req, res): Promise<void> => {
  const params = GetClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [client] = await db
    .select()
    .from(clientsTable)
    .where(
      and(
        eq(clientsTable.id, params.data.id),
        eq(clientsTable.companyId, req.companyId!),
      ),
    );
  if (!client) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(serializeClient(client));
});

router.patch("/clients/:id", async (req, res): Promise<void> => {
  const params = UpdateClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [client] = await db
    .update(clientsTable)
    .set(parsed.data)
    .where(
      and(
        eq(clientsTable.id, params.data.id),
        eq(clientsTable.companyId, req.companyId!),
      ),
    )
    .returning();
  if (!client) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(serializeClient(client));
});

router.delete("/clients/:id", async (req, res): Promise<void> => {
  const params = DeleteClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [client] = await db
    .delete(clientsTable)
    .where(
      and(
        eq(clientsTable.id, params.data.id),
        eq(clientsTable.companyId, req.companyId!),
      ),
    )
    .returning();
  if (!client) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/clients/:id/history", async (req, res): Promise<void> => {
  const params = GetClientHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const jobs = await db
    .select()
    .from(jobsTable)
    .where(
      and(
        eq(jobsTable.clientId, params.data.id),
        eq(jobsTable.companyId, req.companyId!),
      ),
    )
    .orderBy(desc(jobsTable.createdAt));

  const totalRevenue = jobs.reduce((sum, j) => sum + n(j.estimatedValue), 0);
  const completedJobs = jobs.filter((j) => j.status === "paid").length;

  res.json({
    clientId: params.data.id,
    totalJobs: jobs.length,
    completedJobs,
    totalRevenue,
    jobs: jobs.map((j) => serializeJob(j)),
  });
});

export default router;
