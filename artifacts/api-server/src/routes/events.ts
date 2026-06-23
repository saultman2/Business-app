import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, calendarEventsTable, jobsTable, clientsTable } from "@workspace/db";
import {
  ListEventsQueryParams,
  GetEventParams,
  CreateEventBody,
  UpdateEventParams,
  UpdateEventBody,
  DeleteEventParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatEvent(
  e: typeof calendarEventsTable.$inferSelect,
  jobTitle?: string | null,
  clientName?: string | null,
) {
  return {
    ...e,
    jobTitle: jobTitle ?? null,
    clientName: clientName ?? null,
    createdAt: e.createdAt.toISOString(),
  };
}

router.get("/events", async (req, res): Promise<void> => {
  const query = ListEventsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.startDate) conditions.push(gte(calendarEventsTable.startDatetime, query.data.startDate));
  if (query.data.endDate) conditions.push(lte(calendarEventsTable.endDatetime, query.data.endDate));
  if (query.data.jobId) conditions.push(eq(calendarEventsTable.jobId, Number(query.data.jobId)));

  const rows = await db
    .select({
      event: calendarEventsTable,
      jobTitle: jobsTable.title,
      clientName: clientsTable.name,
    })
    .from(calendarEventsTable)
    .leftJoin(jobsTable, eq(calendarEventsTable.jobId, jobsTable.id))
    .leftJoin(clientsTable, eq(calendarEventsTable.clientId, clientsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(calendarEventsTable.startDatetime);

  res.json(rows.map(({ event, jobTitle, clientName }) => formatEvent(event, jobTitle, clientName)));
});

router.post("/events", async (req, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [event] = await db.insert(calendarEventsTable).values({
    ...parsed.data,
    allDay: parsed.data.allDay ?? false,
  }).returning();
  res.status(201).json(formatEvent(event));
});

router.get("/events/:id", async (req, res): Promise<void> => {
  const params = GetEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select({ event: calendarEventsTable, jobTitle: jobsTable.title, clientName: clientsTable.name })
    .from(calendarEventsTable)
    .leftJoin(jobsTable, eq(calendarEventsTable.jobId, jobsTable.id))
    .leftJoin(clientsTable, eq(calendarEventsTable.clientId, clientsTable.id))
    .where(eq(calendarEventsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.json(formatEvent(row.event, row.jobTitle, row.clientName));
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
  const [event] = await db
    .update(calendarEventsTable)
    .set(parsed.data)
    .where(eq(calendarEventsTable.id, params.data.id))
    .returning();
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.json(formatEvent(event));
});

router.delete("/events/:id", async (req, res): Promise<void> => {
  const params = DeleteEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [event] = await db.delete(calendarEventsTable).where(eq(calendarEventsTable.id, params.data.id)).returning();
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
