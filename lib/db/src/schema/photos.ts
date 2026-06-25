import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const photoTypeEnum = ["before", "during", "after", "receipt", "material", "other"] as const;

export const renderTypeEnum = ["before", "after"] as const;

export const jobPhotosTable = pgTable("job_photos", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  jobId: integer("job_id").notNull(),
  type: text("type").notNull().default("other"),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  takenAt: text("taken_at"),
  renderType: text("render_type"),
  pairedPhotoId: integer("paired_photo_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertJobPhotoSchema = createInsertSchema(jobPhotosTable).omit({
  id: true,
  companyId: true,
  createdAt: true,
});
export const updateJobPhotoSchema = insertJobPhotoSchema.partial().omit({ jobId: true });
export type InsertJobPhoto = z.infer<typeof insertJobPhotoSchema>;
export type JobPhoto = typeof jobPhotosTable.$inferSelect;
