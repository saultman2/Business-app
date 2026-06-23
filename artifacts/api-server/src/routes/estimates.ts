import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, estimatesTable, estimateItemsTable, jobsTable, clientsTable } from "@workspace/db";
import {
  ListEstimatesQueryParams,
  GetEstimateParams,
  CreateEstimateBody,
  UpdateEstimateParams,
  UpdateEstimateBody,
  DeleteEstimateParams,
  SendEstimateParams,
  SendEstimateBody,
  ListEstimateItemsParams,
  CreateEstimateItemParams,
  CreateEstimateItemBody,
  UpdateEstimateItemParams,
  UpdateEstimateItemBody,
  DeleteEstimateItemParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatEstimate(e: typeof estimatesTable.$inferSelect, jobTitle?: string | null, clientName?: string | null) {
  return {
    ...e,
    jobTitle: jobTitle ?? null,
    clientName: clientName ?? null,
    subtotal: parseFloat(e.subtotal ?? "0"),
    taxRate: parseFloat(e.taxRate ?? "0"),
    taxAmount: parseFloat(e.taxAmount ?? "0"),
    total: parseFloat(e.total ?? "0"),
    sentAt: e.sentAt ? e.sentAt.toISOString() : null,
    createdAt: e.createdAt.toISOString(),
  };
}

function formatItem(item: typeof estimateItemsTable.$inferSelect) {
  return {
    ...item,
    quantity: parseFloat(item.quantity ?? "1"),
    unitPrice: parseFloat(item.unitPrice ?? "0"),
    totalPrice: parseFloat(item.totalPrice ?? "0"),
  };
}

async function recalcEstimate(estimateId: number, taxRate: number) {
  const items = await db.select().from(estimateItemsTable).where(eq(estimateItemsTable.estimateId, estimateId));
  const subtotal = items.reduce((s, i) => s + parseFloat(i.totalPrice ?? "0"), 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;
  await db
    .update(estimatesTable)
    .set({
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      total: total.toFixed(2),
    })
    .where(eq(estimatesTable.id, estimateId));
}

router.get("/estimates", async (req, res): Promise<void> => {
  const query = ListEstimatesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.jobId) conditions.push(eq(estimatesTable.jobId, Number(query.data.jobId)));
  if (query.data.status) conditions.push(eq(estimatesTable.status, query.data.status));

  const rows = await db
    .select({ estimate: estimatesTable, jobTitle: jobsTable.title, clientName: clientsTable.name })
    .from(estimatesTable)
    .leftJoin(jobsTable, eq(estimatesTable.jobId, jobsTable.id))
    .leftJoin(clientsTable, eq(estimatesTable.clientId, clientsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(estimatesTable.createdAt);

  res.json(rows.map(({ estimate, jobTitle, clientName }) => formatEstimate(estimate, jobTitle, clientName)));
});

router.post("/estimates", async (req, res): Promise<void> => {
  const parsed = CreateEstimateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [estimate] = await db.insert(estimatesTable).values({
    ...parsed.data,
    taxRate: parsed.data.taxRate?.toString() ?? "0",
  }).returning();
  res.status(201).json(formatEstimate(estimate));
});

router.get("/estimates/:id", async (req, res): Promise<void> => {
  const params = GetEstimateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select({ estimate: estimatesTable, jobTitle: jobsTable.title, clientName: clientsTable.name })
    .from(estimatesTable)
    .leftJoin(jobsTable, eq(estimatesTable.jobId, jobsTable.id))
    .leftJoin(clientsTable, eq(estimatesTable.clientId, clientsTable.id))
    .where(eq(estimatesTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Estimate not found" });
    return;
  }
  res.json(formatEstimate(row.estimate, row.jobTitle, row.clientName));
});

router.patch("/estimates/:id", async (req, res): Promise<void> => {
  const params = UpdateEstimateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateEstimateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.taxRate !== undefined) {
    updateData.taxRate = parsed.data.taxRate.toString();
    await recalcEstimate(params.data.id, parsed.data.taxRate);
  }
  const [estimate] = await db
    .update(estimatesTable)
    .set(updateData)
    .where(eq(estimatesTable.id, params.data.id))
    .returning();
  if (!estimate) {
    res.status(404).json({ error: "Estimate not found" });
    return;
  }
  res.json(formatEstimate(estimate));
});

router.delete("/estimates/:id", async (req, res): Promise<void> => {
  const params = DeleteEstimateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(estimateItemsTable).where(eq(estimateItemsTable.estimateId, params.data.id));
  const [estimate] = await db.delete(estimatesTable).where(eq(estimatesTable.id, params.data.id)).returning();
  if (!estimate) {
    res.status(404).json({ error: "Estimate not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/estimates/:id/send", async (req, res): Promise<void> => {
  const params = SendEstimateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SendEstimateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [estimate] = await db
    .update(estimatesTable)
    .set({ status: "sent", sentAt: new Date() })
    .where(eq(estimatesTable.id, params.data.id))
    .returning();
  if (!estimate) {
    res.status(404).json({ error: "Estimate not found" });
    return;
  }
  res.json(formatEstimate(estimate));
});

// ── ESTIMATE ITEMS ──

router.get("/estimates/:estimateId/items", async (req, res): Promise<void> => {
  const params = ListEstimateItemsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const items = await db
    .select()
    .from(estimateItemsTable)
    .where(eq(estimateItemsTable.estimateId, params.data.estimateId))
    .orderBy(estimateItemsTable.sortOrder);
  res.json(items.map(formatItem));
});

router.post("/estimates/:estimateId/items", async (req, res): Promise<void> => {
  const params = CreateEstimateItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateEstimateItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const totalPrice = (parsed.data.quantity ?? 1) * (parsed.data.unitPrice ?? 0);
  const [item] = await db
    .insert(estimateItemsTable)
    .values({
      ...parsed.data,
      estimateId: params.data.estimateId,
      quantity: parsed.data.quantity?.toString() ?? "1",
      unitPrice: parsed.data.unitPrice?.toString() ?? "0",
      totalPrice: totalPrice.toFixed(2),
    })
    .returning();

  // Recalc estimate totals
  const [estimate] = await db.select().from(estimatesTable).where(eq(estimatesTable.id, params.data.estimateId));
  if (estimate) {
    await recalcEstimate(params.data.estimateId, parseFloat(estimate.taxRate ?? "0"));
  }

  res.status(201).json(formatItem(item));
});

router.patch("/estimates/:estimateId/items/:itemId", async (req, res): Promise<void> => {
  const params = UpdateEstimateItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateEstimateItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Get existing item to recalc
  const [existing] = await db.select().from(estimateItemsTable).where(eq(estimateItemsTable.id, params.data.itemId));
  if (!existing) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  const qty = parsed.data.quantity ?? parseFloat(existing.quantity ?? "1");
  const price = parsed.data.unitPrice ?? parseFloat(existing.unitPrice ?? "0");
  const totalPrice = qty * price;

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.quantity !== undefined) updateData.quantity = parsed.data.quantity.toString();
  if (parsed.data.unitPrice !== undefined) updateData.unitPrice = parsed.data.unitPrice.toString();
  updateData.totalPrice = totalPrice.toFixed(2);

  const [item] = await db
    .update(estimateItemsTable)
    .set(updateData)
    .where(eq(estimateItemsTable.id, params.data.itemId))
    .returning();

  const [estimate] = await db.select().from(estimatesTable).where(eq(estimatesTable.id, existing.estimateId));
  if (estimate) {
    await recalcEstimate(existing.estimateId, parseFloat(estimate.taxRate ?? "0"));
  }

  res.json(formatItem(item));
});

router.delete("/estimates/:estimateId/items/:itemId", async (req, res): Promise<void> => {
  const params = DeleteEstimateItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [item] = await db
    .delete(estimateItemsTable)
    .where(eq(estimateItemsTable.id, params.data.itemId))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  const [estimate] = await db.select().from(estimatesTable).where(eq(estimatesTable.id, params.data.estimateId));
  if (estimate) {
    await recalcEstimate(params.data.estimateId, parseFloat(estimate.taxRate ?? "0"));
  }

  res.sendStatus(204);
});

export default router;
