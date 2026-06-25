import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import {
  db,
  jobsTable,
  materialListsTable,
  materialItemsTable,
  materialPriceHistoryTable,
} from "@workspace/db";
import {
  GetJobMaterialListParams,
  UpdateJobMaterialListParams,
  UpdateJobMaterialListBody,
  CreateMaterialItemParams,
  CreateMaterialItemBody,
  UpdateMaterialItemParams,
  UpdateMaterialItemBody,
  DeleteMaterialItemParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { serializeMaterialItem, n, toNumStr } from "../lib/serialize";

const router: IRouter = Router();

router.use(requireAuth);

async function getOrCreateList(companyId: number, jobId: number) {
  const [existing] = await db
    .select()
    .from(materialListsTable)
    .where(
      and(
        eq(materialListsTable.jobId, jobId),
        eq(materialListsTable.companyId, companyId),
      ),
    );
  if (existing) return existing;
  const [created] = await db
    .insert(materialListsTable)
    .values({ companyId, jobId })
    .returning();
  return created;
}

async function listDetail(companyId: number, jobId: number) {
  const list = await getOrCreateList(companyId, jobId);
  const items = await db
    .select()
    .from(materialItemsTable)
    .where(eq(materialItemsTable.materialListId, list.id))
    .orderBy(asc(materialItemsTable.sortOrder), asc(materialItemsTable.id));

  const subtotal = items.reduce((s, i) => s + n(i.lineTotal), 0);
  const taxableSubtotal = items
    .filter((i) => i.taxable)
    .reduce((s, i) => s + n(i.lineTotal), 0);
  const markupSubtotal = items
    .filter((i) => i.markup)
    .reduce((s, i) => s + n(i.lineTotal), 0);

  return {
    id: list.id,
    jobId: list.jobId,
    name: list.name,
    notes: list.notes,
    items: items.map(serializeMaterialItem),
    subtotal,
    taxableSubtotal,
    markupSubtotal,
  };
}

async function indexPriceHistory(
  companyId: number,
  name: string,
  unitPrice: number,
  unit: string | null | undefined,
  jobId: number | null,
) {
  if (!name.trim() || !Number.isFinite(unitPrice) || unitPrice <= 0) return;
  await db.insert(materialPriceHistoryTable).values({
    companyId,
    itemName: name.trim().toLowerCase(),
    unitPrice: String(unitPrice),
    unit: unit ?? null,
    sourceJobId: jobId,
  });
}

async function ensureJob(companyId: number, jobId: number) {
  const [job] = await db
    .select({ id: jobsTable.id })
    .from(jobsTable)
    .where(and(eq(jobsTable.id, jobId), eq(jobsTable.companyId, companyId)));
  return !!job;
}

router.get(
  "/jobs/:jobId/material-list",
  async (req, res): Promise<void> => {
    const params = GetJobMaterialListParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!(await ensureJob(req.companyId!, params.data.jobId))) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json(await listDetail(req.companyId!, params.data.jobId));
  },
);

router.patch(
  "/jobs/:jobId/material-list",
  async (req, res): Promise<void> => {
    const params = UpdateJobMaterialListParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateJobMaterialListBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (!(await ensureJob(req.companyId!, params.data.jobId))) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    const list = await getOrCreateList(req.companyId!, params.data.jobId);
    await db
      .update(materialListsTable)
      .set(parsed.data)
      .where(eq(materialListsTable.id, list.id));
    res.json(await listDetail(req.companyId!, params.data.jobId));
  },
);

router.post(
  "/jobs/:jobId/material-list/items",
  async (req, res): Promise<void> => {
    const params = CreateMaterialItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = CreateMaterialItemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (!(await ensureJob(req.companyId!, params.data.jobId))) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    const list = await getOrCreateList(req.companyId!, params.data.jobId);
    const d = parsed.data;
    const qty = n(d.quantity ?? 0);
    const price = n(d.unitPrice ?? 0);
    const [item] = await db
      .insert(materialItemsTable)
      .values({
        companyId: req.companyId!,
        materialListId: list.id,
        name: d.name,
        description: d.description,
        quantity: toNumStr(d.quantity),
        unit: d.unit,
        unitPrice: toNumStr(d.unitPrice),
        lineTotal: String(qty * price),
        supplier: d.supplier,
        sku: d.sku,
        category: d.category,
        taxable: d.taxable,
        markup: d.markup,
        notes: d.notes,
        sortOrder: d.sortOrder,
      })
      .returning();
    await indexPriceHistory(
      req.companyId!,
      item.name,
      price,
      item.unit,
      params.data.jobId,
    );
    res.status(201).json(serializeMaterialItem(item));
  },
);

router.patch("/material-items/:id", async (req, res): Promise<void> => {
  const params = UpdateMaterialItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateMaterialItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(materialItemsTable)
    .where(
      and(
        eq(materialItemsTable.id, params.data.id),
        eq(materialItemsTable.companyId, req.companyId!),
      ),
    );
  if (!existing) {
    res.status(404).json({ error: "Material item not found" });
    return;
  }
  const d = parsed.data;
  const qty = d.quantity !== undefined ? n(d.quantity) : n(existing.quantity);
  const oldPrice = n(existing.unitPrice);
  const price =
    d.unitPrice !== undefined ? n(d.unitPrice) : n(existing.unitPrice);
  const [item] = await db
    .update(materialItemsTable)
    .set({
      name: d.name,
      description: d.description,
      quantity: toNumStr(d.quantity),
      unit: d.unit,
      unitPrice: toNumStr(d.unitPrice),
      lineTotal: String(qty * price),
      supplier: d.supplier,
      sku: d.sku,
      category: d.category,
      taxable: d.taxable,
      markup: d.markup,
      notes: d.notes,
      sortOrder: d.sortOrder,
    })
    .where(eq(materialItemsTable.id, params.data.id))
    .returning();
  if (price > 0 && price !== oldPrice) {
    const [list] = await db
      .select({ jobId: materialListsTable.jobId })
      .from(materialListsTable)
      .where(eq(materialListsTable.id, item.materialListId));
    await indexPriceHistory(
      req.companyId!,
      item.name,
      price,
      item.unit,
      list?.jobId ?? null,
    );
  }
  res.json(serializeMaterialItem(item));
});

router.delete("/material-items/:id", async (req, res): Promise<void> => {
  const params = DeleteMaterialItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [item] = await db
    .delete(materialItemsTable)
    .where(
      and(
        eq(materialItemsTable.id, params.data.id),
        eq(materialItemsTable.companyId, req.companyId!),
      ),
    )
    .returning();
  if (!item) {
    res.status(404).json({ error: "Material item not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
