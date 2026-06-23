import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";

export const jobPhotosTable = pgTable("job_photos", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobsTable.id).notNull(),
  type: text("type").notNull().default("other"),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  takenAt: text("taken_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertJobPhotoSchema = createInsertSchema(jobPhotosTable).omit({ id: true, createdAt: true });
export type InsertJobPhoto = z.infer<typeof insertJobPhotoSchema>;
export type JobPhoto = typeof jobPhotosTable.$inferSelect;
