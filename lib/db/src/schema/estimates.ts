import { pgTable, serial, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";
import { clientsTable } from "./clients";

export const estimatesTable = pgTable("estimates", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobsTable.id),
  clientId: integer("client_id").references(() => clientsTable.id),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  sentAt: timestamp("sent_at"),
  validUntil: text("valid_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const estimateItemsTable = pgTable("estimate_items", {
  id: serial("id").primaryKey(),
  estimateId: integer("estimate_id").references(() => estimatesTable.id).notNull(),
  description: text("description").notNull(),
  category: text("category").notNull().default("material"),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull().default("1"),
  unit: text("unit").notNull().default("ea"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertEstimateSchema = createInsertSchema(estimatesTable).omit({ id: true, createdAt: true });
export const insertEstimateItemSchema = createInsertSchema(estimateItemsTable).omit({ id: true });
export type InsertEstimate = z.infer<typeof insertEstimateSchema>;
export type InsertEstimateItem = z.infer<typeof insertEstimateItemSchema>;
export type Estimate = typeof estimatesTable.$inferSelect;
export type EstimateItem = typeof estimateItemsTable.$inferSelect;
