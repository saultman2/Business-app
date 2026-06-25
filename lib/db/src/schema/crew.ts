import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const crewMembersTable = pgTable("crew_members", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  type: text("type").notNull().default("employee"),
  name: text("name").notNull(),
  role: text("role"),
  phone: text("phone"),
  email: text("email"),
  company: text("company"),
  specialty: text("specialty"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCrewMemberSchema = createInsertSchema(crewMembersTable).omit({
  id: true,
  companyId: true,
  createdAt: true,
});
export const updateCrewMemberSchema = insertCrewMemberSchema.partial();
export type InsertCrewMember = z.infer<typeof insertCrewMemberSchema>;
export type CrewMember = typeof crewMembersTable.$inferSelect;
