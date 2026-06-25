import { pgTable, serial, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobStageEnum = [
  "new",
  "material_list",
  "estimate",
  "estimate_sent",
  "approved",
  "in_progress",
  "finished",
  "invoiced",
  "paid",
] as const;

export const jobPriorityEnum = ["low", "normal", "high", "urgent"] as const;

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  title: text("title").notNull(),
  clientId: integer("client_id"),
  status: text("status").notNull().default("new"),
  jobType: text("job_type"),
  priority: text("priority").notNull().default("normal"),
  description: text("description"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  estimatedValue: numeric("estimated_value", { precision: 12, scale: 2 }),
  actualCost: numeric("actual_cost", { precision: 12, scale: 2 }),
  notes: text("notes"),
  billingStatus: text("billing_status").notNull().default("none"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({
  id: true,
  companyId: true,
  createdAt: true,
});
export const updateJobSchema = insertJobSchema.partial();
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
