import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, jobPhotosTable } from "@workspace/db";
import {
  ListJobPhotosParams,
  AddJobPhotoParams,
  AddJobPhotoBody,
  UpdateJobPhotoParams,
  UpdateJobPhotoBody,
  DeleteJobPhotoParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatPhoto(p: typeof jobPhotosTable.$inferSelect) {
  return {
    ...p,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/jobs/:jobId/photos", async (req, res): Promise<void> => {
  const params = ListJobPhotosParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const photos = await db
    .select()
    .from(jobPhotosTable)
    .where(eq(jobPhotosTable.jobId, params.data.jobId))
    .orderBy(jobPhotosTable.createdAt);
  res.json(photos.map(formatPhoto));
});

router.post("/jobs/:jobId/photos", async (req, res): Promise<void> => {
  const params = AddJobPhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AddJobPhotoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [photo] = await db.insert(jobPhotosTable).values({
    ...parsed.data,
    jobId: params.data.jobId,
  }).returning();
  res.status(201).json(formatPhoto(photo));
});

router.patch("/jobs/:jobId/photos/:photoId", async (req, res): Promise<void> => {
  const params = UpdateJobPhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateJobPhotoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [photo] = await db
    .update(jobPhotosTable)
    .set(parsed.data)
    .where(eq(jobPhotosTable.id, params.data.photoId))
    .returning();
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }
  res.json(formatPhoto(photo));
});

router.delete("/jobs/:jobId/photos/:photoId", async (req, res): Promise<void> => {
  const params = DeleteJobPhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [photo] = await db
    .delete(jobPhotosTable)
    .where(eq(jobPhotosTable.id, params.data.photoId))
    .returning();
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
