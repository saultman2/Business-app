import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";
import { clientsTable } from "./clients";

export const calendarEventsTable = pgTable("calendar_events", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobsTable.id),
  clientId: integer("client_id").references(() => clientsTable.id),
  title: text("title").notNull(),
  type: text("type").notNull().default("other"),
  startDatetime: text("start_datetime").notNull(),
  endDatetime: text("end_datetime").notNull(),
  allDay: boolean("all_day").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCalendarEventSchema = createInsertSchema(calendarEventsTable).omit({ id: true, createdAt: true });
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEventsTable.$inferSelect;
