import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, receiptsTable, jobsTable } from "@workspace/db";
import {
  ListReceiptsQueryParams,
  GetReceiptParams,
  CreateReceiptBody,
  UpdateReceiptParams,
  UpdateReceiptBody,
  DeleteReceiptParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatReceipt(r: typeof receiptsTable.$inferSelect, jobTitle?: string | null) {
  return {
    ...r,
    jobTitle: jobTitle ?? null,
    amount: parseFloat(r.amount ?? "0"),
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/receipts", async (req, res): Promise<void> => {
  const query = ListReceiptsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.jobId) conditions.push(eq(receiptsTable.jobId, Number(query.data.jobId)));
  if (query.data.category) conditions.push(eq(receiptsTable.category, query.data.category));

  const rows = await db
    .select({ receipt: receiptsTable, jobTitle: jobsTable.title })
    .from(receiptsTable)
    .leftJoin(jobsTable, eq(receiptsTable.jobId, jobsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(receiptsTable.date);

  res.json(rows.map(({ receipt, jobTitle }) => formatReceipt(receipt, jobTitle)));
});

router.post("/receipts", async (req, res): Promise<void> => {
  const parsed = CreateReceiptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [receipt] = await db.insert(receiptsTable).values({
    ...parsed.data,
    amount: parsed.data.amount.toString(),
  }).returning();
  res.status(201).json(formatReceipt(receipt));
});

router.get("/receipts/:id", async (req, res): Promise<void> => {
  const params = GetReceiptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select({ receipt: receiptsTable, jobTitle: jobsTable.title })
    .from(receiptsTable)
    .leftJoin(jobsTable, eq(receiptsTable.jobId, jobsTable.id))
    .where(eq(receiptsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Receipt not found" });
    return;
  }
  res.json(formatReceipt(row.receipt, row.jobTitle));
});

router.patch("/receipts/:id", async (req, res): Promise<void> => {
  const params = UpdateReceiptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateReceiptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.amount !== undefined) updateData.amount = parsed.data.amount.toString();
  const [receipt] = await db
    .update(receiptsTable)
    .set(updateData)
    .where(eq(receiptsTable.id, params.data.id))
    .returning();
  if (!receipt) {
    res.status(404).json({ error: "Receipt not found" });
    return;
  }
  res.json(formatReceipt(receipt));
});

router.delete("/receipts/:id", async (req, res): Promise<void> => {
  const params = DeleteReceiptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [receipt] = await db.delete(receiptsTable).where(eq(receiptsTable.id, params.data.id)).returning();
  if (!receipt) {
    res.status(404).json({ error: "Receipt not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
