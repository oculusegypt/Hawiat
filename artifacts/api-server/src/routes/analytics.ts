import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { pageViewsTable, activeVisitorsTable } from "@workspace/db";
import { eq, gte, sql } from "drizzle-orm";
import crypto from "crypto";
import { getSetting } from "./settings";
import { requireAdmin } from "../middleware/adminAuth";
import { serviceRequestsTable } from "@workspace/db";
import { SOURCE_LABELS, sourceForRow } from "../lib/attribution";

const router = Router();

function detectDevice(ua: string): "mobile" | "tablet" | "desktop" {
  const u = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobi))/i.test(u)) return "tablet";
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(u)) return "mobile";
  return "desktop";
}

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip + "sabaik-salt").digest("hex").slice(0, 16);
}

function isoNow() { return new Date().toISOString(); }
function isoAgo(ms: number) { return new Date(Date.now() - ms).toISOString(); }

function firstHeader(req: Request, names: string[]): string {
  for (const name of names) {
    const value = req.headers[name];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 120);
  }
  return "";
}

// Uses GeoIP headers supplied by a reverse proxy/CDN when available. Raw IP is
// never stored and no external lookup is performed from the request path.
function getGeo(req: Request) {
  return {
    country: firstHeader(req, [
      "cf-ipcountry", "x-country-code", "x-geo-country",
      "x-country", "cloudfront-viewer-country", "x-appengine-country",
    ]),
    city: firstHeader(req, ["cf-ipcity", "x-city", "x-geo-city", "x-client-city"]),
  };
}

function getQueryString(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 160) : "";
}

function getPeriod(req: Request) {
  const period = getQueryString(req.query.period) || "monthly";
  const now = new Date();
  if (period === "yesterday") {
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    return { key: period, from: start.toISOString(), to: end.toISOString() };
  }
  if (period === "weekly") return { key: period, from: isoAgo(7 * 24 * 60 * 60 * 1000), to: undefined };
  if (period === "all") return { key: period, from: undefined, to: undefined };
  if (period === "custom") {
    const from = getQueryString(req.query.from);
    const to = getQueryString(req.query.to);
    const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(from) ? new Date(`${from}T00:00:00.000Z`) : null;
    const toDate = /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(`${to}T23:59:59.999Z`) : null;
    if (fromDate && !Number.isNaN(fromDate.getTime()) && toDate && !Number.isNaN(toDate.getTime())) {
      return { key: period, from: fromDate.toISOString(), to: toDate.toISOString(), fromDate: from, toDate: to };
    }
  }
  return { key: "monthly", from: isoAgo(30 * 24 * 60 * 60 * 1000), to: undefined };
}

function viewWeight(row: Parameters<typeof sourceForRow>[0], googleOrganicWeightEnabled: boolean): number {
  return googleOrganicWeightEnabled && sourceForRow(row) === SOURCE_LABELS.googleOrganic
    ? 8
    : 1;
}

function countBy<T>(
  rows: T[],
  getValue: (row: T) => string,
  getWeight: (row: T) => number = () => 1,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value = getValue(row) || "غير محدد";
    counts[value] = (counts[value] || 0) + getWeight(row);
  }
  return counts;
}

function weightedViews<T>(rows: T[], getWeight: (row: T) => number): number {
  return rows.reduce((total, row) => total + getWeight(row), 0);
}

function ranked(counts: Record<string, number>, limit = 8) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

router.post("/track", async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim().slice(0, 160) : "";
    if (!sessionId) return res.status(400).json({ error: "sessionId required" });

    const ua = req.headers["user-agent"] || "";
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
    const geo = getGeo(req);
    const page = typeof body.page === "string" ? body.page.slice(0, 500) : "/";
    const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 1000) : "";
    const utmSource = typeof body.utmSource === "string" ? body.utmSource.slice(0, 160) : "";
    const utmMedium = typeof body.utmMedium === "string" ? body.utmMedium.slice(0, 160) : "";
    const utmCampaign = typeof body.utmCampaign === "string" ? body.utmCampaign.slice(0, 160) : "";
    const deviceType = detectDevice(ua);
    const now = isoNow();
    const googleOrganicWeightEnabled =
      (await getSetting("analytics_google_search_weight_enabled")) === "true";
    const weight = (row: {
      referrer?: string | null;
      utmSource?: string | null;
      utmMedium?: string | null;
      gclid?: string | null;
    }) => viewWeight(row, googleOrganicWeightEnabled);

    await db.insert(pageViewsTable).values({
      sessionId, page, referrer, ipHash: hashIp(ip), deviceType,
      country: geo.country, city: geo.city, utmSource, utmMedium, utmCampaign,
      gclid: typeof body.gclid === "string" ? body.gclid.slice(0, 200) : "",
    });

    const existing = await db.select().from(activeVisitorsTable).where(eq(activeVisitorsTable.sessionId, sessionId));
    if (existing.length > 0) {
      await db.update(activeVisitorsTable).set({ page, lastSeen: now, deviceType }).where(eq(activeVisitorsTable.sessionId, sessionId));
    } else {
      await db.insert(activeVisitorsTable).values({ sessionId, page, deviceType, lastSeen: now });
    }
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

router.get("/admin/analytics", requireAdmin, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.set("Pragma", "no-cache");
    const now = isoNow();
    const period = getPeriod(req);
    const fiveMinAgo = isoAgo(5 * 60 * 1000);
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const todayIso = startOfToday.toISOString();
    const weekIso = isoAgo(7 * 24 * 60 * 60 * 1000);
    const monthIso = isoAgo(30 * 24 * 60 * 60 * 1000);
    await db.delete(activeVisitorsTable).where(sql`${activeVisitorsTable.lastSeen} < ${fiveMinAgo}`);
    const activeRows = await db.select().from(activeVisitorsTable);
    const allRows = await db.select().from(pageViewsTable);
    const allRequests = await db.select().from(serviceRequestsTable);
    const googleOrganicWeightEnabled =
      (await getSetting("analytics_google_search_weight_enabled")) === "true";
    const weight = (row: typeof allRows[number]) =>
      viewWeight(row, googleOrganicWeightEnabled);
    const rowsIn = (from?: string, to?: string) => allRows.filter(row =>
      (!from || row.createdAt >= from) && (!to || row.createdAt <= to),
    );
    const selectedRows = rowsIn(period.from, period.to);
    const selectedRequests = allRequests.filter(request =>
      (!period.from || request.createdAt >= period.from) && (!period.to || request.createdAt <= period.to),
    );
    const todayRows = rowsIn(todayIso);
    const weekRows = rowsIn(weekIso);
    const monthRows = rowsIn(monthIso);

    const devices = { mobile: 0, tablet: 0, desktop: 0 };
    for (const row of selectedRows) {
      const rowWeight = weight(row);
      if (row.deviceType === "mobile") devices.mobile += rowWeight;
      else if (row.deviceType === "tablet") devices.tablet += rowWeight;
      else devices.desktop += rowWeight;
    }

    const hourly = Array(24).fill(0) as number[];
    for (const row of selectedRows) {
      const hour = new Date(row.createdAt).getHours();
      if (hour >= 0 && hour < 24) hourly[hour] += weight(row);
    }
    const dailyCounts = countBy(selectedRows, row => row.createdAt.slice(0, 10), weight);
    const daily = Object.entries(dailyCounts).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
    const locationRows = (field: "country" | "city") => ranked(countBy(selectedRows, row => row[field] || ""), 10)
      .map(({ label, count }) => ({ [field]: label, count }));
    const viewSourceCounts = countBy(selectedRows, sourceForRow, weight);
    const requestSourceCounts = countBy(selectedRequests, request => request.acquisitionSource || sourceForRow({
      referrer: request.attributionReferrer,
      utmSource: request.attributionUtmSource,
      utmMedium: request.attributionUtmMedium,
      utmCampaign: request.attributionUtmCampaign,
      gclid: request.attributionGclid,
    }));
    const conversionSources = [...new Set([...Object.keys(viewSourceCounts), ...Object.keys(requestSourceCounts)])]
      .sort((a, b) => (requestSourceCounts[b] || 0) - (requestSourceCounts[a] || 0) || (viewSourceCounts[b] || 0) - (viewSourceCounts[a] || 0))
      .map(source => {
        const views = viewSourceCounts[source] || 0;
        const orders = requestSourceCounts[source] || 0;
        return {
          source,
          views,
          orders,
          rate: views > 0 ? Number(((orders / views) * 100).toFixed(1)) : 0,
        };
      });
    const orderStatuses = {
      pending: selectedRequests.filter(request => request.status === "pending").length,
      inProgress: selectedRequests.filter(request => request.status === "in_progress").length,
      completed: selectedRequests.filter(request => request.status === "completed").length,
      cancelled: selectedRequests.filter(request => request.status === "cancelled").length,
    };

    return res.json({
      activeCount: activeRows.length,
      activePages: activeRows.map(row => ({ page: row.page, device: row.deviceType })),
      period: {
        key: period.key,
        from: period.from ?? null,
        to: period.to ?? null,
        views: weightedViews(selectedRows, weight),
        unique: new Set(selectedRows.map(row => row.sessionId)).size,
      },
      today: { views: weightedViews(todayRows, weight), unique: new Set(todayRows.map(row => row.sessionId)).size },
      week: { views: weightedViews(weekRows, weight), unique: new Set(weekRows.map(row => row.sessionId)).size },
      month: { views: weightedViews(monthRows, weight), unique: new Set(monthRows.map(row => row.sessionId)).size },
      topPages: ranked(countBy(selectedRows, row => row.page, weight), 8).map(({ label, count }) => ({ page: label, count })),
      topReferrers: ranked(countBy(selectedRows, row => row.referrer || "مباشر", weight), 8)
        .map(({ label, count }) => ({ referrer: label, count })),
      sources: ranked(countBy(selectedRows, sourceForRow, weight), 10).map(({ label, count }) => ({ source: label, count })),
      orders: {
        total: selectedRequests.length,
        completed: orderStatuses.completed,
        conversionRate: selectedRows.length > 0
          ? Number(((selectedRequests.length / new Set(selectedRows.map(row => row.sessionId)).size) * 100).toFixed(1))
          : 0,
        statuses: orderStatuses,
      },
      conversionSources,
      countries: locationRows("country"),
      cities: locationRows("city"),
      devices,
      hourly,
      daily,
      generatedAt: now,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

async function clearAnalytics(res: Response) {
  try {
    await db.delete(pageViewsTable);
    await db.delete(activeVisitorsTable);
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "تعذر حذف تحليلات الموقع" });
  }
}

router.delete("/admin/analytics", requireAdmin, async (_req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.set("Pragma", "no-cache");
  return clearAnalytics(res);
});

// POST is kept as the primary compatibility path for shared hosting setups
// that restrict or rewrite DELETE requests before PHP receives them.
router.post("/admin/analytics/clear", requireAdmin, async (_req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.set("Pragma", "no-cache");
  return clearAnalytics(res);
});

export default router;