---
name: Hashed asset compatibility
description: Keeping Hostinger patches compatible with stale HTML or CDN/browser caches after Vite asset hashes change.
---

When a deployed page can retain an older Vite lazy-import URL, a lightweight compatibility alias for the reported old hashed chunk should be included in the next Hostinger patch alongside the newly hashed asset.

**Why:** Replacing hashed assets while an older cached `index.html` remains active can produce `ERR_ABORTED 404` for a dynamic import even though the current build is valid.

**How to apply:** Preserve the current source and new Vite output; add only the old chunk-name alias to the patch, verify both files have identical content, and keep the patch free of unrelated asset changes.