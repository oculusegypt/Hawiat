import { Router } from "express";
import { db } from "@workspace/db";
import { conversationsTable, messagesTable, containersTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { createNotification } from "../lib/pushNotifications";
import { requireAdmin, requireNonDriver } from "../middleware/adminAuth";

const router = Router();

router.get("/conversations", requireAdmin, requireNonDriver, async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const conversations = await db.select().from(conversationsTable).orderBy(desc(conversationsTable.updatedAt));
  return res.json(conversations);
});

router.post("/conversations", async (req, res) => {
  const { clientName, phone, email, subject, packageId, packageName } = req.body;
  const [conversation] = await db.insert(conversationsTable).values({
    clientName, phone, email, subject: subject || null,
    packageId: packageId == null || packageId === "" ? null : Number(packageId),
    packageName: packageName || null,
  }).returning();

  await createNotification({
    title: "محادثة جديدة",
    message: `بدأ ${clientName} محادثة جديدة`,
    type: "chat",
    refId: conversation.id,
    refType: "conversation",
  });

  return res.status(201).json(conversation);
});

router.get("/conversations/:id", async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "معرّف المحادثة غير صحيح" });
  }
  const [conversation] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conversation) return res.status(404).json({ error: "المحادثة غير موجودة" });
  return res.json(conversation);
});

router.patch("/conversations/:id", requireAdmin, requireNonDriver, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const { status } = req.body;
  const [conversation] = await db.update(conversationsTable)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(conversationsTable.id, id))
    .returning();
  if (!conversation) return res.status(404).json({ error: "Not found" });
  return res.json(conversation);
});

router.get("/conversations/:id/messages", async (req, res) => {
  const id = parseInt(req.params.id);
  const messages = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversationId, id))
    .orderBy(desc(messagesTable.createdAt));
  // Mark as read
  await db.update(messagesTable).set({ isRead: "true" }).where(eq(messagesTable.conversationId, id));
  // Reset unread count
  await db.update(conversationsTable).set({ unreadCount: 0 }).where(eq(conversationsTable.id, id));
  return res.json(messages.reverse());
});

router.post("/conversations/:id/messages", async (req, res) => {
  const id = parseInt(req.params.id);
  const {
    content,
    senderType,
    messageType,
    metadata,
    attachmentUrl,
    attachmentType,
    locationLat,
    locationLng,
    locationLabel,
  } = req.body;
  if (typeof content !== "string" || (!content.trim() && !attachmentUrl && !locationLat)) {
    return res.status(400).json({ error: "الرسالة فارغة" });
  }
  const normalizedMessageType = messageType || "text";
  if (!["text", "package_form", "order_confirmation"].includes(normalizedMessageType)) {
    return res.status(400).json({ error: "نوع الرسالة غير صحيح" });
  }
  if (normalizedMessageType === "package_form") {
    let parsedMetadata: unknown;
    try {
      parsedMetadata = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
    } catch {
      return res.status(400).json({ error: "بيانات نموذج الباقة غير صحيحة" });
    }
    const containerId = Number((parsedMetadata as { containerId?: unknown } | null)?.containerId);
    if (!Number.isInteger(containerId) || containerId <= 0) {
      return res.status(400).json({ error: "معرّف الباقة غير صحيح" });
    }
    const [container] = await db.select({ id: containersTable.id })
      .from(containersTable)
      .where(eq(containersTable.id, containerId));
    if (!container) {
      return res.status(404).json({ error: "الباقة غير موجودة" });
    }
  }
  const [message] = await db.insert(messagesTable).values({
    conversationId: id,
    content: content || "",
    messageType: normalizedMessageType,
    metadata: metadata == null ? null : String(metadata),
    attachmentUrl: attachmentUrl || null,
    attachmentType: attachmentType || null,
    locationLat: locationLat == null ? null : String(locationLat),
    locationLng: locationLng == null ? null : String(locationLng),
    locationLabel: locationLabel || null,
    senderType: senderType ?? "client",
  }).returning();

  // Update conversation — increment unread only for client messages
  await db.update(conversationsTable)
    .set({
      lastMessage: content,
      updatedAt: new Date().toISOString(),
      unreadCount: senderType === "client" ? sql`unread_count + 1` : sql`unread_count`,
    })
    .where(eq(conversationsTable.id, id));

  if (senderType === "client") {
    const [conversation] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
    if (conversation) {
      await createNotification({
        title: "رسالة جديدة",
        message: `رسالة جديدة من ${conversation.clientName}`,
        type: "chat",
        refId: id,
        refType: "conversation",
      });
    }
  }

  return res.status(201).json({
    ...message,
    messageType: message.messageType || "text",
    isRead: message.isRead === "true",
  });
});

// Admin: delete single conversation + its messages
router.delete("/admin/conversations/:id", requireAdmin, requireNonDriver, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "معرّف المحادثة غير صحيح" });

  const [conversation] = await db.select({ id: conversationsTable.id })
    .from(conversationsTable)
    .where(eq(conversationsTable.id, id));
  if (!conversation) return res.status(404).json({ error: "المحادثة غير موجودة" });

  await db.delete(messagesTable).where(eq(messagesTable.conversationId, id));
  await db.delete(conversationsTable).where(eq(conversationsTable.id, id));
  return res.json({ success: true, id });
});

// Admin: delete ALL conversations + messages
router.delete("/admin/conversations", requireAdmin, requireNonDriver, async (_req, res) => {
  await db.delete(messagesTable);
  await db.delete(conversationsTable);
  return res.json({ success: true });
});

export default router;
