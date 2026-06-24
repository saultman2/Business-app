import { Router, type IRouter } from "express";
import { eq, and, asc, desc } from "drizzle-orm";
import {
  db,
  invoicesTable,
  paymentsTable,
  clientsTable,
  jobsTable,
} from "@workspace/db";
import {
  ListInvoicesQueryParams,
  CreateInvoiceBody,
  GetInvoiceParams,
  UpdateInvoiceParams,
  UpdateInvoiceBody,
  DeleteInvoiceParams,
  CreatePaymentParams,
  CreatePaymentBody,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { ownsClient, ownsJob, ownsEstimate } from "../lib/ownership";
import {
  serializeInvoice,
  serializePayment,
  n,
  toNumStr,
} from "../lib/serialize";

const router: IRouter = Router();

router.use(requireAuth);

async function detail(companyId: number, id: number) {
  const [row] = await db
    .select({
      inv: invoicesTable,
      clientName: clientsTable.name,
      jobTitle: jobsTable.title,
    })
    .from(invoicesTable)
    .leftJoin(
      clientsTable,
      and(
        eq(invoicesTable.clientId, clientsTable.id),
        eq(clientsTable.companyId, companyId),
      ),
    )
    .leftJoin(
      jobsTable,
      and(
        eq(invoicesTable.jobId, jobsTable.id),
        eq(jobsTable.companyId, companyId),
      ),
    )
    .where(
      and(eq(invoicesTable.id, id), eq(invoicesTable.companyId, companyId)),
    );
  if (!row) return null;
  const payments = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.invoiceId, id))
    .orderBy(desc(paymentsTable.createdAt));
  return {
    ...serializeInvoice(row.inv, {
      clientName: row.clientName,
      jobTitle: row.jobTitle,
    }),
    payments: payments.map(serializePayment),
  };
}

router.get("/invoices", async (req, res): Promise<void> => {
  const query = ListInvoicesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const conds = [eq(invoicesTable.companyId, req.companyId!)];
  if (query.data.status)
    conds.push(eq(invoicesTable.status, query.data.status));
  const rows = await db
    .select({
      inv: invoicesTable,
      clientName: clientsTable.name,
      jobTitle: jobsTable.title,
    })
    .from(invoicesTable)
    .leftJoin(
      clientsTable,
      and(
        eq(invoicesTable.clientId, clientsTable.id),
        eq(clientsTable.companyId, req.companyId!),
      ),
    )
    .leftJoin(
      jobsTable,
      and(
        eq(invoicesTable.jobId, jobsTable.id),
        eq(jobsTable.companyId, req.companyId!),
      ),
    )
    .where(and(...conds))
    .orderBy(desc(invoicesTable.createdAt));
  res.json(
    rows.map((r) =>
      serializeInvoice(r.inv, {
        clientName: r.clientName,
        jobTitle: r.jobTitle,
      }),
    ),
  );
});

router.post("/invoices", async (req, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  if (
    !(await ownsJob(req.companyId!, d.jobId)) ||
    !(await ownsClient(req.companyId!, d.clientId)) ||
    !(await ownsEstimate(req.companyId!, d.estimateId))
  ) {
    res.status(400).json({ error: "Invalid job, client, or estimate reference" });
    return;
  }
  const total = n(d.totalAmount ?? 0);
  const [invoice] = await db
    .insert(invoicesTable)
    .values({
      companyId: req.companyId!,
      jobId: d.jobId ?? null,
      clientId: d.clientId ?? null,
      estimateId: d.estimateId ?? null,
      invoiceNumber: d.invoiceNumber,
      invoiceDate: d.invoiceDate,
      dueDate: d.dueDate,
      totalAmount: String(total),
      balanceDue: String(total),
      notes: d.notes,
    })
    .returning();
  res.status(201).json(serializeInvoice(invoice));
});

router.get("/invoices/:id", async (req, res): Promise<void> => {
  const params = GetInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const d = await detail(req.companyId!, params.data.id);
  if (!d) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  res.json(d);
});

router.patch("/invoices/:id", async (req, res): Promise<void> => {
  const params = UpdateInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.id, params.data.id),
        eq(invoicesTable.companyId, req.companyId!),
      ),
    );
  if (!existing) {
    res.status(404).json({ error: "Invoice not found" });
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
  const total = d.totalAmount !== undefined ? n(d.totalAmount) : n(existing.totalAmount);
  const paid = n(existing.amountPaid);
  const balanceDue = total - paid;
  let status = d.status ?? existing.status;
  if (d.status === undefined) {
    if (paid <= 0) status = "unpaid";
    else if (balanceDue <= 0) status = "paid";
    else status = "partial";
  }
  await db
    .update(invoicesTable)
    .set({
      jobId: d.jobId,
      clientId: d.clientId,
      invoiceNumber: d.invoiceNumber,
      invoiceDate: d.invoiceDate,
      dueDate: d.dueDate,
      totalAmount: toNumStr(d.totalAmount),
      balanceDue: String(balanceDue),
      status,
      notes: d.notes,
    })
    .where(eq(invoicesTable.id, params.data.id));
  res.json(await detail(req.companyId!, params.data.id));
});

router.delete("/invoices/:id", async (req, res): Promise<void> => {
  const params = DeleteInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [invoice] = await db
    .delete(invoicesTable)
    .where(
      and(
        eq(invoicesTable.id, params.data.id),
        eq(invoicesTable.companyId, req.companyId!),
      ),
    )
    .returning();
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  res.sendStatus(204);
});

router.post(
  "/invoices/:invoiceId/payments",
  async (req, res): Promise<void> => {
    const params = CreatePaymentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = CreatePaymentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [invoice] = await db
      .select()
      .from(invoicesTable)
      .where(
        and(
          eq(invoicesTable.id, params.data.invoiceId),
          eq(invoicesTable.companyId, req.companyId!),
        ),
      );
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    const d = parsed.data;
    await db.insert(paymentsTable).values({
      companyId: req.companyId!,
      invoiceId: invoice.id,
      amount: String(n(d.amount)),
      date: d.date,
      method: d.method,
      notes: d.notes,
    });

    const amountPaid = n(invoice.amountPaid) + n(d.amount);
    const total = n(invoice.totalAmount);
    const balanceDue = total - amountPaid;
    const status = balanceDue <= 0 ? "paid" : amountPaid > 0 ? "partial" : "unpaid";
    await db
      .update(invoicesTable)
      .set({
        amountPaid: String(amountPaid),
        balanceDue: String(balanceDue),
        status,
      })
      .where(eq(invoicesTable.id, invoice.id));

    if (status === "paid" && invoice.jobId) {
      await db
        .update(jobsTable)
        .set({ status: "paid" })
        .where(
          and(
            eq(jobsTable.id, invoice.jobId),
            eq(jobsTable.companyId, req.companyId!),
          ),
        );
    }
    res.status(201).json(await detail(req.companyId!, invoice.id));
  },
);

export default router;
