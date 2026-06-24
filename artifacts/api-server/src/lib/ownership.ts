import { and, eq, or } from "drizzle-orm";
import {
  db,
  clientsTable,
  jobsTable,
  estimatesTable,
  invoicesTable,
  companiesTable,
  jobPhotosTable,
  receiptsTable,
} from "@workspace/db";

/**
 * Ownership guards: verify that a foreign-key reference supplied by the client
 * actually belongs to the authenticated company. Returns true when the id is
 * null/undefined (i.e. clearing/optional reference) so callers can pass values
 * straight through. Prevents cross-tenant reference injection.
 */

export async function ownsClient(
  companyId: number,
  id: number | null | undefined,
): Promise<boolean> {
  if (id == null) return true;
  const [row] = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(and(eq(clientsTable.id, id), eq(clientsTable.companyId, companyId)));
  return !!row;
}

export async function ownsJob(
  companyId: number,
  id: number | null | undefined,
): Promise<boolean> {
  if (id == null) return true;
  const [row] = await db
    .select({ id: jobsTable.id })
    .from(jobsTable)
    .where(and(eq(jobsTable.id, id), eq(jobsTable.companyId, companyId)));
  return !!row;
}

export async function ownsEstimate(
  companyId: number,
  id: number | null | undefined,
): Promise<boolean> {
  if (id == null) return true;
  const [row] = await db
    .select({ id: estimatesTable.id })
    .from(estimatesTable)
    .where(
      and(eq(estimatesTable.id, id), eq(estimatesTable.companyId, companyId)),
    );
  return !!row;
}

export async function ownsInvoice(
  companyId: number,
  id: number | null | undefined,
): Promise<boolean> {
  if (id == null) return true;
  const [row] = await db
    .select({ id: invoicesTable.id })
    .from(invoicesTable)
    .where(
      and(eq(invoicesTable.id, id), eq(invoicesTable.companyId, companyId)),
    );
  return !!row;
}

/**
 * Verify a private storage object is referenced by a record owned by the
 * company. The frontend stores the full proxy path (e.g.
 * "/api/storage/objects/uploads/<uuid>") on the company logo, a job photo, or a
 * receipt. We only serve a private object if one of those company-scoped
 * records points at it.
 */
export async function companyOwnsObject(
  companyId: number,
  storedUrl: string,
): Promise<boolean> {
  const [logo] = await db
    .select({ id: companiesTable.id })
    .from(companiesTable)
    .where(
      and(
        eq(companiesTable.id, companyId),
        eq(companiesTable.logoUrl, storedUrl),
      ),
    );
  if (logo) return true;

  const [photo] = await db
    .select({ id: jobPhotosTable.id })
    .from(jobPhotosTable)
    .where(
      and(
        eq(jobPhotosTable.companyId, companyId),
        eq(jobPhotosTable.imageUrl, storedUrl),
      ),
    );
  if (photo) return true;

  const [receipt] = await db
    .select({ id: receiptsTable.id })
    .from(receiptsTable)
    .where(
      and(
        eq(receiptsTable.companyId, companyId),
        eq(receiptsTable.imageUrl, storedUrl),
      ),
    );
  return !!receipt;
}

// Re-export to keep a single import site if callers need raw operators.
export { and, eq, or };
