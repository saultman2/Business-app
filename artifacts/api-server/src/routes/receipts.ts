import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, receiptsTable, jobsTable } from "@workspace/db";
import {
  ListReceiptsQueryParams,
  CreateReceiptBody,
  GetReceiptParams,
  UpdateReceiptParams,
  UpdateReceiptBody,
  DeleteReceiptParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { ownsJob } from "../lib/ownership";
import { serializeReceipt, toNumStr } from "../lib/serialize";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/receipts", async (req, res): Promise<void> => {
  const query = ListReceiptsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const conds = [eq(receiptsTable.companyId, req.companyId!)];
  if (query.data.jobId) conds.push(eq(receiptsTable.jobId, query.data.jobId));
  if (query.data.category)
    conds.push(eq(receiptsTable.category, query.data.category));
  const rows = await db
    .select({ receipt: receiptsTable, jobTitle: jobsTable.title })
    .from(receiptsTable)
    .leftJoin(
      jobsTable,
      and(
        eq(receiptsTable.jobId, jobsTable.id),
        eq(jobsTable.companyId, req.companyId!),
      ),
    )
    .where(and(...conds))
    .orderBy(desc(receiptsTable.createdAt));
  res.json(rows.map((r) => serializeReceipt(r.receipt, r.jobTitle)));
});

router.post("/receipts", async (req, res): Promise<void> => {
  const parsed = CreateReceiptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  if (!(await ownsJob(req.companyId!, d.jobId))) {
    res.status(400).json({ error: "Invalid job reference" });
    return;
  }
  const [receipt] = await db
    .insert(receiptsTable)
    .values({
      companyId: req.companyId!,
      jobId: d.jobId ?? null,
      vendor: d.vendor,
      amount: toNumStr(d.amount),
      date: d.date,
      category: d.category,
      description: d.description,
      imageUrl: d.imageUrl,
    })
    .returning();
  res.status(201).json(serializeReceipt(receipt));
});

router.get("/receipts/:id", async (req, res): Promise<void> => {
  const params = GetReceiptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [receipt] = await db
    .select()
    .from(receiptsTable)
    .where(
      and(
        eq(receiptsTable.id, params.data.id),
        eq(receiptsTable.companyId, req.companyId!),
      ),
    );
  if (!receipt) {
    res.status(404).json({ error: "Receipt not found" });
    return;
  }
  res.json(serializeReceipt(receipt));
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
  const d = parsed.data;
  if (!(await ownsJob(req.companyId!, d.jobId))) {
    res.status(400).json({ error: "Invalid job reference" });
    return;
  }
  const [receipt] = await db
    .update(receiptsTable)
    .set({
      jobId: d.jobId,
      vendor: d.vendor,
      amount: toNumStr(d.amount),
      date: d.date,
      category: d.category,
      description: d.description,
      imageUrl: d.imageUrl,
    })
    .where(
      and(
        eq(receiptsTable.id, params.data.id),
        eq(receiptsTable.companyId, req.companyId!),
      ),
    )
    .returning();
  if (!receipt) {
    res.status(404).json({ error: "Receipt not found" });
    return;
  }
  res.json(serializeReceipt(receipt));
});

router.delete("/receipts/:id", async (req, res): Promise<void> => {
  const params = DeleteReceiptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [receipt] = await db
    .delete(receiptsTable)
    .where(
      and(
        eq(receiptsTable.id, params.data.id),
        eq(receiptsTable.companyId, req.companyId!),
      ),
    )
    .returning();
  if (!receipt) {
    res.status(404).json({ error: "Receipt not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
