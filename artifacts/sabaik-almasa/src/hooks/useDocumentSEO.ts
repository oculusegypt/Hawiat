import { useEffect } from "react"
import { replaceLegacyCompanyName, useSiteSettings } from "@/context/SiteSettingsContext"

interface SEOOptions {
  title: string
  description?: string
  keywords?: string
  canonical?: string
  ogImage?: string
  ogImageAlt?: string
  ogType?: string
}

function setMeta(attr: string, value: string, attrName = "name") {
  if (!value) return
  let el = document.querySelector(`meta[${attrName}="${attr}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute(attrName, attr)
    document.head.appendChild(el)
  }
  el.content = value
}

function setCanonical(href: string) {
  let el = document.querySelector("link[rel='canonical']") as HTMLLinkElement | null
  if (!el) { el = document.createElement("link"); el.rel = "canonical"; document.head.appendChild(el) }
  el.href = href
}

export function useDocumentSEO({
  title,
  description,
  keywords,
  canonical,
  ogImage,
  ogImageAlt,
  ogType = "website",
}: SEOOptions) {
  const { companyName, isLoaded } = useSiteSettings()

  useEffect(() => {
    // Keep the static, neutral title from index.html until the configured
    // company name is available. This prevents a visible default-name flash.
    if (!isLoaded) return

    const replaceCompanyName = (value?: string) =>
      value ? replaceLegacyCompanyName(value, companyName) : value
    const resolvedTitle = replaceCompanyName(title) || title
    const resolvedDescription = replaceCompanyName(description)
    const resolvedKeywords = replaceCompanyName(keywords)
    const resolvedOgImageAlt = replaceCompanyName(ogImageAlt)
    const prevTitle = document.title
    const prevDesc  = document.querySelector('meta[name="description"]')?.getAttribute("content") ?? ""
    const prevCanon = document.querySelector("link[rel='canonical']")?.getAttribute("href") ?? ""

    document.title = resolvedTitle

    // Primary
    if (resolvedDescription) setMeta("description", resolvedDescription)
    if (resolvedKeywords)    setMeta("keywords",     resolvedKeywords)

    // Open Graph
    setMeta("og:title",       resolvedTitle, "property")
    setMeta("og:type",        ogType,      "property")
    setMeta("og:locale",      "ar_SA",     "property")
    setMeta("og:site_name",   companyName ? `${companyName} — تأجير حاويات بالرياض` : "تأجير حاويات بالرياض", "property")
    if (resolvedDescription) setMeta("og:description", resolvedDescription, "property")
    if (canonical)   setMeta("og:url",          canonical,  "property")
    if (ogImage) {
      setMeta("og:image",             ogImage,                            "property")
      setMeta("og:image:secure_url",  ogImage,                            "property")
      setMeta("og:image:alt",         resolvedOgImageAlt || resolvedTitle, "property")
    }

    // Twitter / X
    setMeta("twitter:card",        "summary_large_image")
    setMeta("twitter:title",       resolvedTitle)
    if (resolvedDescription) setMeta("twitter:description", resolvedDescription)
    if (canonical)   setMeta("twitter:url",         canonical)
    if (ogImage)     setMeta("twitter:image",       ogImage)
    if (ogImage)     setMeta("twitter:image:alt",   resolvedOgImageAlt || resolvedTitle)

    // Canonical link
    if (canonical) setCanonical(canonical)

    return () => {
      document.title = prevTitle
      if (prevDesc)  setMeta("description", prevDesc)
      if (prevCanon) setCanonical(prevCanon)
    }
  }, [title, description, keywords, canonical, ogImage, ogImageAlt, ogType, companyName, isLoaded])
}
