import { Router } from "express";
import { db } from "@workspace/db";
import { companyValuesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();

router.get("/values", async (_req, res) => {
  const values = await db.select().from(companyValuesTable).orderBy(asc(companyValuesTable.order));
  return res.json(values);
});

router.post("/values", async (req, res) => {
  const { title, description, icon, order } = req.body;
  const [value] = await db.insert(companyValuesTable).values({
    title, description, icon, order: order ?? 0,
  }).returning();
  return res.status(201).json(value);
});

router.patch("/values/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { title, description, icon, order } = req.body;
  const [value] = await db.update(companyValuesTable)
    .set({ title, description, icon, order })
    .where(eq(companyValuesTable.id, id))
    .returning();
  if (!value) return res.status(404).json({ error: "Not found" });
  return res.json(value);
});

router.delete("/values/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(companyValuesTable).where(eq(companyValuesTable.id, id));
  return res.status(204).send();
});

export default router;
