import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const materialListsTable = pgTable("material_lists", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  jobId: integer("job_id").notNull(),
  name: text("name").notNull().default("Material List"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const materialItemsTable = pgTable("material_items", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  materialListId: integer("material_list_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("0"),
  unit: text("unit").notNull().default("ea"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull().default("0"),
  supplier: text("supplier"),
  sku: text("sku"),
  category: text("category"),
  taxable: boolean("taxable").notNull().default(false),
  markup: boolean("markup").notNull().default(false),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const materialPriceHistoryTable = pgTable(
  "material_price_history",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").notNull(),
    itemName: text("item_name").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    unit: text("unit"),
    sourceJobId: integer("source_job_id"),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
  },
  (t) => [index("mph_company_item_idx").on(t.companyId, t.itemName)],
);

export const insertMaterialListSchema = createInsertSchema(materialListsTable).omit({
  id: true,
  companyId: true,
  createdAt: true,
});
export const updateMaterialListSchema = insertMaterialListSchema.partial().omit({ jobId: true });
export const insertMaterialItemSchema = createInsertSchema(materialItemsTable).omit({
  id: true,
  companyId: true,
  materialListId: true,
  lineTotal: true,
});
export const updateMaterialItemSchema = insertMaterialItemSchema.partial();
export type InsertMaterialList = z.infer<typeof insertMaterialListSchema>;
export type InsertMaterialItem = z.infer<typeof insertMaterialItemSchema>;
export type MaterialList = typeof materialListsTable.$inferSelect;
export type MaterialItem = typeof materialItemsTable.$inferSelect;
export type MaterialPriceHistory = typeof materialPriceHistoryTable.$inferSelect;
