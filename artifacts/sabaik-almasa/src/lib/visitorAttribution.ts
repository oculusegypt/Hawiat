export interface VisitorTracking {
  sessionId: string
  referrer: string
  landingPage: string
  utmSource: string
  utmMedium: string
  utmCampaign: string
  gclid: string
}

const SESSION_KEY = "sab_sid"
const ATTRIBUTION_KEY = "sab_attribution"

function createSessionId() {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID()
    }
  } catch {
    // Fall back for older browsers and restricted storage contexts.
  }
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

function safeRead(key: string) {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function safeWrite(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // Tracking must never block a customer's request.
  }
}

function getSessionId() {
  const existing = safeRead(SESSION_KEY)
  if (existing) return existing
  const created = createSessionId()
  safeWrite(SESSION_KEY, created)
  return created
}

export function getVisitorTracking(): VisitorTracking {
  const sessionId = getSessionId()
  const currentPath = `${window.location.pathname}${window.location.search}`
  let stored: Partial<VisitorTracking> | null = null

  try {
    const raw = safeRead(ATTRIBUTION_KEY)
    if (raw) stored = JSON.parse(raw) as Partial<VisitorTracking>
  } catch {
    stored = null
  }

  if (!stored?.landingPage) {
    const query = new URLSearchParams(window.location.search)
    stored = {
      referrer: document.referrer || "",
      landingPage: currentPath,
      utmSource: query.get("utm_source") || "",
      utmMedium: query.get("utm_medium") || "",
      utmCampaign: query.get("utm_campaign") || "",
      gclid: query.get("gclid") || "",
    }
    safeWrite(ATTRIBUTION_KEY, JSON.stringify(stored))
  }

  return {
    sessionId,
    referrer: stored?.referrer || "",
    landingPage: stored?.landingPage || currentPath,
    utmSource: stored?.utmSource || "",
    utmMedium: stored?.utmMedium || "",
    utmCampaign: stored?.utmCampaign || "",
    gclid: stored?.gclid || "",
  }
}