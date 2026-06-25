import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import {
  db,
  companiesTable,
  clientsTable,
  jobsTable,
  materialListsTable,
  materialItemsTable,
  materialPriceHistoryTable,
  estimatesTable,
  estimateItemsTable,
  invoicesTable,
  paymentsTable,
  jobPhotosTable,
  receiptsTable,
  calendarEventsTable,
  crewMembersTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.use(requireAuth);

// Delete all company-scoped business records for a company. Does NOT delete the
// company row itself, so it can be reused for both "clear my data" and full
// account deletion.
async function deleteCompanyBusinessData(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  companyId: number,
): Promise<void> {
  await tx.delete(estimateItemsTable).where(eq(estimateItemsTable.companyId, companyId));
  await tx.delete(estimatesTable).where(eq(estimatesTable.companyId, companyId));
  await tx.delete(materialItemsTable).where(eq(materialItemsTable.companyId, companyId));
  await tx
    .delete(materialPriceHistoryTable)
    .where(eq(materialPriceHistoryTable.companyId, companyId));
  await tx.delete(materialListsTable).where(eq(materialListsTable.companyId, companyId));
  await tx.delete(paymentsTable).where(eq(paymentsTable.companyId, companyId));
  await tx.delete(invoicesTable).where(eq(invoicesTable.companyId, companyId));
  await tx.delete(jobPhotosTable).where(eq(jobPhotosTable.companyId, companyId));
  await tx.delete(receiptsTable).where(eq(receiptsTable.companyId, companyId));
  await tx.delete(calendarEventsTable).where(eq(calendarEventsTable.companyId, companyId));
  await tx.delete(crewMembersTable).where(eq(crewMembersTable.companyId, companyId));
  await tx.delete(jobsTable).where(eq(jobsTable.companyId, companyId));
  await tx.delete(clientsTable).where(eq(clientsTable.companyId, companyId));
}

// Request deletion of all business data while keeping the account and company
// profile intact. Processed immediately.
router.post("/account/data-deletion", async (req, res): Promise<void> => {
  const companyId = req.companyId!;
  await db.transaction(async (tx) => {
    await deleteCompanyBusinessData(tx, companyId);
  });
  res.json({ ok: true });
});

// Permanently delete the account: removes all company-scoped data, the company
// row, and the Clerk user. Irreversible.
router.delete("/account", async (req, res): Promise<void> => {
  const companyId = req.companyId!;
  const userId = req.userId!;

  await db.transaction(async (tx) => {
    await deleteCompanyBusinessData(tx, companyId);
    await tx.delete(companiesTable).where(eq(companiesTable.id, companyId));
  });

  try {
    await clerkClient.users.deleteUser(userId);
  } catch (err) {
    req.log?.error({ err }, "failed to delete Clerk user after data removal");
    res
      .status(502)
      .json({ error: "Account data deleted, but failed to delete login. Contact support." });
    return;
  }

  res.status(204).end();
});

export default router;
