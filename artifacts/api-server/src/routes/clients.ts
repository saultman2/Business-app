import { Router, type IRouter } from "express";
import { eq, ilike, sql } from "drizzle-orm";
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

const router: IRouter = Router();

router.get("/clients", async (req, res): Promise<void> => {
  const query = ListClientsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let clientsQuery = db.select().from(clientsTable).$dynamic();
  if (query.data.search) {
    clientsQuery = clientsQuery.where(ilike(clientsTable.name, `%${query.data.search}%`));
  }

  const clients = await clientsQuery.orderBy(clientsTable.name);
  res.json(clients.map(c => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  })));
});

router.post("/clients", async (req, res): Promise<void> => {
  const parsed = CreateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [client] = await db.insert(clientsTable).values(parsed.data).returning();
  res.status(201).json({ ...client, createdAt: client.createdAt.toISOString() });
});

router.get("/clients/:id", async (req, res): Promise<void> => {
  const params = GetClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, params.data.id));
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.json({ ...client, createdAt: client.createdAt.toISOString() });
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
    .where(eq(clientsTable.id, params.data.id))
    .returning();
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.json({ ...client, createdAt: client.createdAt.toISOString() });
});

router.delete("/clients/:id", async (req, res): Promise<void> => {
  const params = DeleteClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [client] = await db.delete(clientsTable).where(eq(clientsTable.id, params.data.id)).returning();
  if (!client) {
    res.status(404).json({ error: "Client not found" });
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
    .where(eq(jobsTable.clientId, params.data.id))
    .orderBy(jobsTable.createdAt);

  const totalRevenue = jobs.reduce((sum, j) => sum + parseFloat(j.estimatedValue ?? "0"), 0);
  const completedJobs = jobs.filter(j => j.status === "completed").length;

  res.json({
    clientId: params.data.id,
    totalJobs: jobs.length,
    completedJobs,
    totalRevenue,
    jobs: jobs.map(j => ({
      ...j,
      clientName: null,
      estimatedValue: j.estimatedValue ? parseFloat(j.estimatedValue) : null,
      actualCost: j.actualCost ? parseFloat(j.actualCost) : null,
      createdAt: j.createdAt.toISOString(),
    })),
  });
});

export default router;
