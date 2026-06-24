import { Router, type IRouter } from "express";
import { eq, and, asc, desc } from "drizzle-orm";
import {
  db,
  estimatesTable,
  estimateItemsTable,
  clientsTable,
  jobsTable,
  materialListsTable,
  materialItemsTable,
  invoicesTable,
  type Estimate,
} from "@workspace/db";
import {
  ListEstimatesQueryParams,
  CreateEstimateBody,
  GetEstimateParams,
  UpdateEstimateParams,
  UpdateEstimateBody,
  DeleteEstimateParams,
  SendEstimateParams,
  SendEstimateBody,
  ApproveEstimateParams,
  ConvertEstimateToInvoiceParams,
  CreateEstimateItemParams,
  CreateEstimateItemBody,
  UpdateEstimateItemParams,
  UpdateEstimateItemBody,
  DeleteEstimateItemParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { ownsClient, ownsJob } from "../lib/ownership";
import {
  serializeEstimate,
  serializeEstimateItem,
  serializeInvoice,
  n,
  toNumStr,
} from "../lib/serialize";

const router: IRouter = Router();

router.use(requireAuth);

async function recalc(companyId: number, estimateId: number): Promise<Estimate> {
  const [est] = await db
    .select()
    .from(estimatesTable)
    .where(
      and(
        eq(estimatesTable.id, estimateId),
        eq(estimatesTable.companyId, companyId),
      ),
    );
  const items = await db
    .select()
    .from(estimateItemsTable)
    .where(eq(estimateItemsTable.estimateId, estimateId));

  const sectionSum = (section: string) =>
    items
      .filter((i) => i.section === section)
      .reduce((s, i) => s + n(i.lineTotal), 0);

  const materialSubtotal = est.includeMaterials ? sectionSum("material") : 0;
  let laborSubtotal = 0;
  if (est.includeLabor) {
    laborSubtotal =
      est.laborMethod === "flat" ? n(est.laborFlatCost) : sectionSum("labor");
  }
  const equipmentSubtotal = est.includeEquipment ? sectionSum("equipment") : 0;
  const otherItems = sectionSum("other");

  const permits = est.includePermits ? n(est.permitsAmount) : 0;
  const disposal = est.includeDisposal ? n(est.disposalAmount) : 0;
  const delivery = est.includeDelivery ? n(est.deliveryAmount) : 0;
  const subcontractor = est.includeSubcontractor
    ? n(est.subcontractorAmount)
    : 0;
  const overhead = est.includeOverhead ? n(est.overheadAmount) : 0;
  const otherChargesSubtotal =
    permits + disposal + delivery + subcontractor + otherItems;

  const base =
    materialSubtotal +
    laborSubtotal +
    equipmentSubtotal +
    otherChargesSubtotal +
    overhead;

  const markupAmount = est.includeProfit ? (base * n(est.markupPct)) / 100 : 0;
  const discountAmount = est.includeDiscount ? n(est.discountAmount) : 0;
  const preTax = base + markupAmount - discountAmount;
  const taxAmount = est.includeTax ? (preTax * n(est.taxRate)) / 100 : 0;
  const total = preTax + taxAmount;

  const [updated] = await db
    .update(estimatesTable)
    .set({
      materialSubtotal: String(materialSubtotal),
      laborSubtotal: String(laborSubtotal),
      equipmentSubtotal: String(equipmentSubtotal),
      otherChargesSubtotal: String(otherChargesSubtotal),
      markupAmount: String(markupAmount),
      taxAmount: String(taxAmount),
      total: String(total),
    })
    .where(eq(estimatesTable.id, estimateId))
    .returning();
  return updated;
}

async function detail(companyId: number, estimateId: number) {
  const [row] = await db
    .select({
      est: estimatesTable,
      clientName: clientsTable.name,
      jobTitle: jobsTable.title,
    })
    .from(estimatesTable)
    .leftJoin(
      clientsTable,
      and(
        eq(estimatesTable.clientId, clientsTable.id),
        eq(clientsTable.companyId, companyId),
      ),
    )
    .leftJoin(
      jobsTable,
      and(
        eq(estimatesTable.jobId, jobsTable.id),
        eq(jobsTable.companyId, companyId),
      ),
    )
    .where(
      and(
        eq(estimatesTable.id, estimateId),
        eq(estimatesTable.companyId, companyId),
      ),
    );
  if (!row) return null;
  const items = await db
    .select()
    .from(estimateItemsTable)
    .where(eq(estimateItemsTable.estimateId, estimateId))
    .orderBy(asc(estimateItemsTable.sortOrder), asc(estimateItemsTable.id));
  return {
    ...serializeEstimate(row.est, {
      clientName: row.clientName,
      jobTitle: row.jobTitle,
    }),
    items: items.map(serializeEstimateItem),
  };
}

router.get("/estimates", async (req, res): Promise<void> => {
  const query = ListEstimatesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const conds = [eq(estimatesTable.companyId, req.companyId!)];
  if (query.data.status)
    conds.push(eq(estimatesTable.status, query.data.status));
  if (query.data.jobId) conds.push(eq(estimatesTable.jobId, query.data.jobId));
  const rows = await db
    .select({
      est: estimatesTable,
      clientName: clientsTable.name,
      jobTitle: jobsTable.title,
    })
    .from(estimatesTable)
    .leftJoin(
      clientsTable,
      and(
        eq(estimatesTable.clientId, clientsTable.id),
        eq(clientsTable.companyId, req.companyId!),
      ),
    )
    .leftJoin(
      jobsTable,
      and(
        eq(estimatesTable.jobId, jobsTable.id),
        eq(jobsTable.companyId, req.companyId!),
      ),
    )
    .where(and(...conds))
    .orderBy(desc(estimatesTable.createdAt));
  res.json(
    rows.map((r) =>
      serializeEstimate(r.est, {
        clientName: r.clientName,
        jobTitle: r.jobTitle,
      }),
    ),
  );
});

router.post("/estimates", async (req, res): Promise<void> => {
  const parsed = CreateEstimateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  if (
    !(await ownsJob(req.companyId!, d.jobId)) ||
    !(await ownsClient(req.companyId!, d.clientId))
  ) {
    res.status(400).json({ error: "Invalid job or client reference" });
    return;
  }
  const [est] = await db
    .insert(estimatesTable)
    .values({
      companyId: req.companyId!,
      jobId: d.jobId ?? null,
      clientId: d.clientId ?? null,
      title: d.title,
    })
    .returning();

  if (d.importMaterialList && d.jobId) {
    const [list] = await db
      .select()
      .from(materialListsTable)
      .where(
        and(
          eq(materialListsTable.jobId, d.jobId),
          eq(materialListsTable.companyId, req.companyId!),
        ),
      );
    if (list) {
      const items = await db
        .select()
        .from(materialItemsTable)
        .where(eq(materialItemsTable.materialListId, list.id))
        .orderBy(asc(materialItemsTable.sortOrder));
      if (items.length > 0) {
        await db.insert(estimateItemsTable).values(
          items.map((m, idx) => ({
            companyId: req.companyId!,
            estimateId: est.id,
            section: "material",
            description: m.name,
            quantity: m.quantity,
            unit: m.unit,
            unitPrice: m.unitPrice,
            lineTotal: m.lineTotal,
            sortOrder: idx,
          })),
        );
      }
    }
  }

  await recalc(req.companyId!, est.id);
  res.status(201).json(await detail(req.companyId!, est.id));
});

router.get("/estimates/:id", async (req, res): Promise<void> => {
  const params = GetEstimateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const d = await detail(req.companyId!, params.data.id);
  if (!d) {
    res.status(404).json({ error: "Estimate not found" });
    return;
  }
  res.json(d);
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
  const d = parsed.data;
  const [existing] = await db
    .select({ id: estimatesTable.id })
    .from(estimatesTable)
    .where(
      and(
        eq(estimatesTable.id, params.data.id),
        eq(estimatesTable.companyId, req.companyId!),
      ),
    );
  if (!existing) {
    res.status(404).json({ error: "Estimate not found" });
    return;
  }
  if (
    !(await ownsJob(req.companyId!, d.jobId)) ||
    !(await ownsClient(req.companyId!, d.clientId))
  ) {
    res.status(400).json({ error: "Invalid job or client reference" });
    return;
  }
  await db
    .update(estimatesTable)
    .set({
      jobId: d.jobId,
      clientId: d.clientId,
      estimateNumber: d.estimateNumber,
      title: d.title,
      status: d.status,
      estimateDate: d.estimateDate,
      validUntil: d.validUntil,
      scopeOfWork: d.scopeOfWork,
      includeMaterials: d.includeMaterials,
      includeLabor: d.includeLabor,
      includeEquipment: d.includeEquipment,
      includePermits: d.includePermits,
      includeDisposal: d.includeDisposal,
      includeDelivery: d.includeDelivery,
      includeSubcontractor: d.includeSubcontractor,
      includeOverhead: d.includeOverhead,
      includeProfit: d.includeProfit,
      includeTax: d.includeTax,
      includeDiscount: d.includeDiscount,
      includeDeposit: d.includeDeposit,
      laborMethod: d.laborMethod,
      laborFlatCost: toNumStr(d.laborFlatCost),
      permitsAmount: toNumStr(d.permitsAmount),
      disposalAmount: toNumStr(d.disposalAmount),
      deliveryAmount: toNumStr(d.deliveryAmount),
      subcontractorAmount: toNumStr(d.subcontractorAmount),
      overheadAmount: toNumStr(d.overheadAmount),
      taxRate: toNumStr(d.taxRate),
      markupPct: toNumStr(d.markupPct),
      discountAmount: toNumStr(d.discountAmount),
      depositRequired: toNumStr(d.depositRequired),
      notes: d.notes,
      terms: d.terms,
      warrantyNote: d.warrantyNote,
    })
    .where(eq(estimatesTable.id, params.data.id));
  await recalc(req.companyId!, params.data.id);
  res.json(await detail(req.companyId!, params.data.id));
});

router.delete("/estimates/:id", async (req, res): Promise<void> => {
  const params = DeleteEstimateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [est] = await db
    .delete(estimatesTable)
    .where(
      and(
        eq(estimatesTable.id, params.data.id),
        eq(estimatesTable.companyId, req.companyId!),
      ),
    )
    .returning();
  if (!est) {
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
  const [est] = await db
    .update(estimatesTable)
    .set({ status: "sent", sentAt: new Date() })
    .where(
      and(
        eq(estimatesTable.id, params.data.id),
        eq(estimatesTable.companyId, req.companyId!),
      ),
    )
    .returning();
  if (!est) {
    res.status(404).json({ error: "Estimate not found" });
    return;
  }
  if (est.jobId) {
    await db
      .update(jobsTable)
      .set({ status: "estimate_sent" })
      .where(
        and(
          eq(jobsTable.id, est.jobId),
          eq(jobsTable.companyId, req.companyId!),
        ),
      );
  }
  const channel = parsed.data.channel;
  res.json({
    sent: false,
    marked: true,
    warning: `${channel === "email" ? "Email" : "SMS"} delivery is not configured yet. The estimate was marked as sent — connect a provider to send it automatically.`,
  });
});

router.post("/estimates/:id/approve", async (req, res): Promise<void> => {
  const params = ApproveEstimateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [est] = await db
    .update(estimatesTable)
    .set({ status: "approved", approvedAt: new Date() })
    .where(
      and(
        eq(estimatesTable.id, params.data.id),
        eq(estimatesTable.companyId, req.companyId!),
      ),
    )
    .returning();
  if (!est) {
    res.status(404).json({ error: "Estimate not found" });
    return;
  }
  if (est.jobId) {
    await db
      .update(jobsTable)
      .set({ status: "approved" })
      .where(
        and(
          eq(jobsTable.id, est.jobId),
          eq(jobsTable.companyId, req.companyId!),
        ),
      );
  }
  res.json(await detail(req.companyId!, params.data.id));
});

router.post(
  "/estimates/:id/convert-to-invoice",
  async (req, res): Promise<void> => {
    const params = ConvertEstimateToInvoiceParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [est] = await db
      .select()
      .from(estimatesTable)
      .where(
        and(
          eq(estimatesTable.id, params.data.id),
          eq(estimatesTable.companyId, req.companyId!),
        ),
      );
    if (!est) {
      res.status(404).json({ error: "Estimate not found" });
      return;
    }
    const total = n(est.total);
    const [invoice] = await db
      .insert(invoicesTable)
      .values({
        companyId: req.companyId!,
        jobId: est.jobId,
        clientId: est.clientId,
        estimateId: est.id,
        totalAmount: String(total),
        balanceDue: String(total),
        status: "unpaid",
      })
      .returning();
    if (est.jobId) {
      await db
        .update(jobsTable)
        .set({ status: "invoiced" })
        .where(
          and(
            eq(jobsTable.id, est.jobId),
            eq(jobsTable.companyId, req.companyId!),
          ),
        );
    }
    res.status(201).json(serializeInvoice(invoice));
  },
);

router.post(
  "/estimates/:estimateId/items",
  async (req, res): Promise<void> => {
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
    const [est] = await db
      .select({ id: estimatesTable.id })
      .from(estimatesTable)
      .where(
        and(
          eq(estimatesTable.id, params.data.estimateId),
          eq(estimatesTable.companyId, req.companyId!),
        ),
      );
    if (!est) {
      res.status(404).json({ error: "Estimate not found" });
      return;
    }
    const d = parsed.data;
    const section = d.section ?? "material";
    const qty = n(d.quantity ?? 0);
    const price = n(d.unitPrice ?? 0);
    const hours = n(d.hours ?? 0);
    const rate = n(d.hourlyRate ?? 0);
    const lineTotal = section === "labor" ? hours * rate : qty * price;
    const [item] = await db
      .insert(estimateItemsTable)
      .values({
        companyId: req.companyId!,
        estimateId: params.data.estimateId,
        section,
        description: d.description,
        quantity: toNumStr(d.quantity),
        unit: d.unit,
        unitPrice: toNumStr(d.unitPrice),
        hours: toNumStr(d.hours),
        hourlyRate: toNumStr(d.hourlyRate),
        lineTotal: String(lineTotal),
        sortOrder: d.sortOrder,
      })
      .returning();
    await recalc(req.companyId!, params.data.estimateId);
    res.status(201).json(serializeEstimateItem(item));
  },
);

router.patch("/estimate-items/:id", async (req, res): Promise<void> => {
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
  const [existing] = await db
    .select()
    .from(estimateItemsTable)
    .where(
      and(
        eq(estimateItemsTable.id, params.data.id),
        eq(estimateItemsTable.companyId, req.companyId!),
      ),
    );
  if (!existing) {
    res.status(404).json({ error: "Estimate item not found" });
    return;
  }
  const d = parsed.data;
  const section = d.section ?? existing.section;
  const qty = d.quantity !== undefined ? n(d.quantity) : n(existing.quantity);
  const price =
    d.unitPrice !== undefined ? n(d.unitPrice) : n(existing.unitPrice);
  const hours = d.hours !== undefined ? n(d.hours) : n(existing.hours);
  const rate =
    d.hourlyRate !== undefined ? n(d.hourlyRate) : n(existing.hourlyRate);
  const lineTotal = section === "labor" ? hours * rate : qty * price;
  const [item] = await db
    .update(estimateItemsTable)
    .set({
      section: d.section,
      description: d.description,
      quantity: toNumStr(d.quantity),
      unit: d.unit,
      unitPrice: toNumStr(d.unitPrice),
      hours: toNumStr(d.hours),
      hourlyRate: toNumStr(d.hourlyRate),
      lineTotal: String(lineTotal),
      sortOrder: d.sortOrder,
    })
    .where(eq(estimateItemsTable.id, params.data.id))
    .returning();
  await recalc(req.companyId!, existing.estimateId);
  res.json(serializeEstimateItem(item));
});

router.delete("/estimate-items/:id", async (req, res): Promise<void> => {
  const params = DeleteEstimateItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [item] = await db
    .delete(estimateItemsTable)
    .where(
      and(
        eq(estimateItemsTable.id, params.data.id),
        eq(estimateItemsTable.companyId, req.companyId!),
      ),
    )
    .returning();
  if (!item) {
    res.status(404).json({ error: "Estimate item not found" });
    return;
  }
  await recalc(req.companyId!, item.estimateId);
  res.sendStatus(204);
});

export default router;
