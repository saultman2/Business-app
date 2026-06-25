import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, crewMembersTable } from "@workspace/db";
import {
  ListCrewQueryParams,
  CreateCrewMemberBody,
  UpdateCrewMemberParams,
  UpdateCrewMemberBody,
  DeleteCrewMemberParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import type { CrewMember } from "@workspace/db";

const router: IRouter = Router();

router.use(requireAuth);

function serializeCrewMember(c: CrewMember) {
  return { ...c, createdAt: c.createdAt.toISOString() };
}

router.get("/crew", async (req, res): Promise<void> => {
  const query = ListCrewQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const companyId = req.companyId!;
  const conds = [eq(crewMembersTable.companyId, companyId)];
  if (query.data.type) {
    conds.push(eq(crewMembersTable.type, query.data.type));
  }
  const members = await db
    .select()
    .from(crewMembersTable)
    .where(and(...conds))
    .orderBy(asc(crewMembersTable.name));
  res.json(members.map(serializeCrewMember));
});

router.post("/crew", async (req, res): Promise<void> => {
  const parsed = CreateCrewMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [member] = await db
    .insert(crewMembersTable)
    .values({ ...parsed.data, companyId: req.companyId! })
    .returning();
  res.status(201).json(serializeCrewMember(member));
});

router.patch("/crew/:id", async (req, res): Promise<void> => {
  const params = UpdateCrewMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCrewMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [member] = await db
    .update(crewMembersTable)
    .set(parsed.data)
    .where(
      and(
        eq(crewMembersTable.id, params.data.id),
        eq(crewMembersTable.companyId, req.companyId!),
      ),
    )
    .returning();
  if (!member) {
    res.status(404).json({ error: "Crew member not found" });
    return;
  }
  res.json(serializeCrewMember(member));
});

router.delete("/crew/:id", async (req, res): Promise<void> => {
  const params = DeleteCrewMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [member] = await db
    .delete(crewMembersTable)
    .where(
      and(
        eq(crewMembersTable.id, params.data.id),
        eq(crewMembersTable.companyId, req.companyId!),
      ),
    )
    .returning();
  if (!member) {
    res.status(404).json({ error: "Crew member not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
