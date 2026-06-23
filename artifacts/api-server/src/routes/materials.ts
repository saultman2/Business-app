import { Router, type IRouter } from "express";
import { eq, ilike, and } from "drizzle-orm";
import { db, materialsTable, supplierPricesTable } from "@workspace/db";
import {
  ListMaterialsQueryParams,
  GetMaterialParams,
  CreateMaterialBody,
  UpdateMaterialParams,
  UpdateMaterialBody,
  DeleteMaterialParams,
  GetMaterialPricesParams,
  AddMaterialPriceParams,
  AddMaterialPriceBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatMaterial(m: typeof materialsTable.$inferSelect) {
  return {
    ...m,
    basePrice: parseFloat(m.basePrice ?? "0"),
    createdAt: m.createdAt.toISOString(),
  };
}

function formatSupplierPrice(sp: typeof supplierPricesTable.$inferSelect) {
  return {
    ...sp,
    price: parseFloat(sp.price ?? "0"),
    updatedAt: sp.updatedAt.toISOString(),
  };
}

router.get("/materials", async (req, res): Promise<void> => {
  const query = ListMaterialsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.category) conditions.push(eq(materialsTable.category, query.data.category));
  if (query.data.search) conditions.push(ilike(materialsTable.name, `%${query.data.search}%`));

  const materials = await db
    .select()
    .from(materialsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(materialsTable.category, materialsTable.name);

  res.json(materials.map(formatMaterial));
});

router.post("/materials", async (req, res): Promise<void> => {
  const parsed = CreateMaterialBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [material] = await db.insert(materialsTable).values({
    ...parsed.data,
    basePrice: parsed.data.basePrice?.toString() ?? "0",
  }).returning();
  res.status(201).json(formatMaterial(material));
});

router.get("/materials/:id", async (req, res): Promise<void> => {
  const params = GetMaterialParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [material] = await db.select().from(materialsTable).where(eq(materialsTable.id, params.data.id));
  if (!material) {
    res.status(404).json({ error: "Material not found" });
    return;
  }
  res.json(formatMaterial(material));
});

router.patch("/materials/:id", async (req, res): Promise<void> => {
  const params = UpdateMaterialParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateMaterialBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.basePrice !== undefined) updateData.basePrice = parsed.data.basePrice.toString();
  const [material] = await db
    .update(materialsTable)
    .set(updateData)
    .where(eq(materialsTable.id, params.data.id))
    .returning();
  if (!material) {
    res.status(404).json({ error: "Material not found" });
    return;
  }
  res.json(formatMaterial(material));
});

router.delete("/materials/:id", async (req, res): Promise<void> => {
  const params = DeleteMaterialParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(supplierPricesTable).where(eq(supplierPricesTable.materialId, params.data.id));
  const [material] = await db.delete(materialsTable).where(eq(materialsTable.id, params.data.id)).returning();
  if (!material) {
    res.status(404).json({ error: "Material not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/materials/:id/prices", async (req, res): Promise<void> => {
  const params = GetMaterialPricesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const prices = await db
    .select()
    .from(supplierPricesTable)
    .where(eq(supplierPricesTable.materialId, params.data.id))
    .orderBy(supplierPricesTable.price);
  res.json(prices.map(formatSupplierPrice));
});

router.post("/materials/:id/prices", async (req, res): Promise<void> => {
  const params = AddMaterialPriceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AddMaterialPriceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [price] = await db.insert(supplierPricesTable).values({
    ...parsed.data,
    materialId: params.data.id,
    price: parsed.data.price.toString(),
    inStock: parsed.data.inStock ?? true,
  }).returning();
  res.status(201).json(formatSupplierPrice(price));
});

export default router;
