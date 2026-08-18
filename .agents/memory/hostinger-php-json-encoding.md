---
name: Hostinger PHP JSON encoding
description: Preventing empty API responses when legacy SQLite text contains malformed UTF-8.
---

Hostinger PHP API responses that serialize legacy SQLite text must use `JSON_INVALID_UTF8_SUBSTITUTE`; otherwise `json_encode()` can return `false` and emit an empty 200 response.

**Why:** A malformed legacy blog value caused the admin articles endpoint to return HTTP 200 with no JSON body, which the static frontend reported as an invalid response.

**How to apply:** Add the flag to JSON responses that include imported or legacy database text, especially blog, SEO, notification, and content-management endpoints.