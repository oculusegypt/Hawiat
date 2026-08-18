import { Router } from "express";
import { db } from "@workspace/db";
import { heroSlidesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();

router.get("/slides", async (_req, res) => {
  const slides = await db.select().from(heroSlidesTable).orderBy(asc(heroSlidesTable.order));
  return res.json(slides);
});

router.post("/slides", async (req, res) => {
  const { title, subtitle, imageUrl, ctaText, order, isActive } = req.body;
  const [slide] = await db.insert(heroSlidesTable).values({
    title, subtitle, imageUrl, ctaText, order: order ?? 0, isActive: isActive ?? true,
  }).returning();
  return res.status(201).json(slide);
});

router.patch("/slides/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { title, subtitle, imageUrl, ctaText, order, isActive } = req.body;
  const [slide] = await db.update(heroSlidesTable)
    .set({ title, subtitle, imageUrl, ctaText, order, isActive })
    .where(eq(heroSlidesTable.id, id))
    .returning();
  if (!slide) return res.status(404).json({ error: "Not found" });
  return res.json(slide);
});

router.delete("/slides/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(heroSlidesTable).where(eq(heroSlidesTable.id, id));
  return res.status(204).send();
});

export default router;
