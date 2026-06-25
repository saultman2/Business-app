import { pgTable, serial, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invoiceStatusEnum = ["draft", "sent", "unpaid", "partial", "paid", "overdue"] as const;
export const paymentMethodEnum = ["cash", "check", "card", "bank_transfer", "other"] as const;

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  jobId: integer("job_id"),
  clientId: integer("client_id"),
  estimateId: integer("estimate_id"),
  invoiceNumber: text("invoice_number"),
  invoiceDate: text("invoice_date"),
  dueDate: text("due_date"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
  balanceDue: numeric("balance_due", { precision: 12, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  lineItemsJson: text("line_items_json"),
  servicesDescription: text("services_description"),
  paymentTerms: text("payment_terms"),
  template: text("template").notNull().default("clean"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  invoiceId: integer("invoice_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  date: text("date"),
  method: text("method").notNull().default("cash"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({
  id: true,
  companyId: true,
  createdAt: true,
  balanceDue: true,
  amountPaid: true,
  status: true,
});
export const updateInvoiceSchema = insertInvoiceSchema.partial();
export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({
  id: true,
  companyId: true,
  invoiceId: true,
  createdAt: true,
});
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
export type Payment = typeof paymentsTable.$inferSelect;
