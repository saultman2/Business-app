import { pgTable, serial, text, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const materialsTable = pgTable("materials", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  unit: text("unit").notNull(),
  basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull().default("0"),
  sku: text("sku"),
  lowesUrl: text("lowes_url"),
  homeDepotUrl: text("home_depot_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supplierPricesTable = pgTable("supplier_prices", {
  id: serial("id").primaryKey(),
  materialId: integer("material_id").references(() => materialsTable.id).notNull(),
  supplierName: text("supplier_name").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  url: text("url"),
  zipCode: text("zip_code"),
  inStock: boolean("in_stock").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMaterialSchema = createInsertSchema(materialsTable).omit({ id: true, createdAt: true });
export const insertSupplierPriceSchema = createInsertSchema(supplierPricesTable).omit({ id: true, updatedAt: true });
export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type InsertSupplierPrice = z.infer<typeof insertSupplierPriceSchema>;
export type Material = typeof materialsTable.$inferSelect;
export type SupplierPrice = typeof supplierPricesTable.$inferSelect;
