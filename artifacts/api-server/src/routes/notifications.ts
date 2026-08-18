import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAdmin, requireNonDriver } from "../middleware/adminAuth";

const router = Router();

router.get("/notifications", requireAdmin, requireNonDriver, async (_req, res) => {
  const notifications = await db.select().from(notificationsTable).orderBy(desc(notificationsTable.createdAt));
  return res.json(notifications);
});

router.patch("/notifications/:id/read", requireAdmin, requireNonDriver, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const [notification] = await db.update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.id, id))
    .returning();
  if (!notification) return res.status(404).json({ error: "Not found" });
  return res.json(notification);
});

router.patch("/notifications/read-all", requireAdmin, requireNonDriver, async (_req, res) => {
  await db.update(notificationsTable).set({ isRead: true });
  return res.json({ success: true });
});

// Admin: delete single notification
router.delete("/admin/notifications/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [existing] = await db.select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(eq(notificationsTable.id, id));
  if (!existing) return res.status(404).json({ error: "Not found" });
  await db.delete(notificationsTable)
    .where(eq(notificationsTable.id, id))
    ;
  return res.json({ success: true });
});

// Admin: delete ALL notifications
router.delete("/admin/notifications", async (_req, res) => {
  await db.delete(notificationsTable);
  return res.json({ success: true });
});

export default router;
