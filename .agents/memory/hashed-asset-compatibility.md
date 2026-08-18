---
name: Hashed asset compatibility
description: Keeping Hostinger patches compatible with stale HTML or CDN/browser caches after Vite asset hashes change.
---

When a deployed page can retain older Vite asset URLs, the next Hostinger patch must include regenerated static HTML pages plus lightweight compatibility aliases for the reported old hashed chunks.

**Why:** Replacing hashed assets while old prerendered pages or cached HTML remain active can produce `ERR_ABORTED 404` for vendor files, styles, or dynamic imports even though the current build is valid.

**How to apply:** Run prerender after Vite build, copy all generated HTML into the patch, add only the reported old chunk-name aliases, verify aliases match current chunks, and keep uploads/images untouched.