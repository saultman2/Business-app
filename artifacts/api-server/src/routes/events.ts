import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, calendarEventsTable, jobsTable, clientsTable } from "@workspace/db";
import {
  ListEventsQueryParams,
  CreateEventBody,
  GetEventParams,
  UpdateEventParams,
  UpdateEventBody,
  DeleteEventParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { ownsClient, ownsJob } from "../lib/ownership";
import { serializeEvent } from "../lib/serialize";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/events", async (req, res): Promise<void> => {
  const query = ListEventsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const conds = [eq(calendarEventsTable.companyId, req.companyId!)];
  if (query.data.jobId)
    conds.push(eq(calendarEventsTable.jobId, query.data.jobId));
  const rows = await db
    .select({
      event: calendarEventsTable,
      jobTitle: jobsTable.title,
      clientName: clientsTable.name,
    })
    .from(calendarEventsTable)
    .leftJoin(
      jobsTable,
      and(
        eq(calendarEventsTable.jobId, jobsTable.id),
        eq(jobsTable.companyId, req.companyId!),
      ),
    )
    .leftJoin(
      clientsTable,
      and(
        eq(calendarEventsTable.clientId, clientsTable.id),
        eq(clientsTable.companyId, req.companyId!),
      ),
    )
    .where(and(...conds))
    .orderBy(asc(calendarEventsTable.startDatetime));
  res.json(
    rows.map((r) =>
      serializeEvent(r.event, {
        jobTitle: r.jobTitle,
        clientName: r.clientName,
      }),
    ),
  );
});

router.post("/events", async (req, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  if (
    !(await ownsJob(req.companyId!, d.jobId)) ||
    !(await ownsClient(req.companyId!, d.clientId))
  ) {
    res.status(400).json({ error: "Invalid job or client reference" });
    return;
  }
  const [event] = await db
    .insert(calendarEventsTable)
    .values({ ...d, companyId: req.companyId! })
    .returning();
  res.status(201).json(serializeEvent(event));
});

router.get("/events/:id", async (req, res): Promise<void> => {
  const params = GetEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [event] = await db
    .select()
    .from(calendarEventsTable)
    .where(
      and(
        eq(calendarEventsTable.id, params.data.id),
        eq(calendarEventsTable.companyId, req.companyId!),
      ),
    );
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.json(serializeEvent(event));
});

router.patch("/events/:id", async (req, res): Promise<void> => {
  const params = UpdateEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  if (
    !(await ownsJob(req.companyId!, d.jobId)) ||
    !(await ownsClient(req.companyId!, d.clientId))
  ) {
    res.status(400).json({ error: "Invalid job or client reference" });
    return;
  }
  const [event] = await db
    .update(calendarEventsTable)
    .set(d)
    .where(
      and(
        eq(calendarEventsTable.id, params.data.id),
        eq(calendarEventsTable.companyId, req.companyId!),
      ),
    )
    .returning();
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.json(serializeEvent(event));
});

router.delete("/events/:id", async (req, res): Promise<void> => {
  const params = DeleteEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [event] = await db
    .delete(calendarEventsTable)
    .where(
      and(
        eq(calendarEventsTable.id, params.data.id),
        eq(calendarEventsTable.companyId, req.companyId!),
      ),
    )
    .returning();
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
