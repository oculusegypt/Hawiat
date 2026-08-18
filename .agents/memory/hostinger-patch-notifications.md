---
name: Hostinger patch delivery
description: Requirements for compatible Hostinger patch archives and PHP Web Push delivery.
---

Hostinger patch archives must preserve the historical root layout and include the compiled assets, `index.html`, PHP API, both Apache routing files, and the current SQLite database. Web Push deployments also need the root Service Worker and its notification icon; updating only the frontend bundle/API leaves browser registrations or database schema incomplete.

**Why:** Hostinger runs the PHP/SQLite production path independently from the development Node API, and push subscriptions depend on both the `push_subscriptions` schema/settings and a valid encrypted Web Push payload.

**How to apply:** Build the patch from the current `scripts/api-index.php` and `data/sabaik.db`, include `sw.js` and `notification-icon.png`, use portable archive paths, and implement Web Push with explicit HKDF-Extract/HKDF-Expand rather than passing salts to PHP's boolean `hash_hkdf` parameter.

Treat SQLite as a deployable snapshot: checkpoint WAL before copying, use DELETE journal mode in the Hostinger copy, and run an integrity check before packaging. If only ephemeral presence rows are duplicated, repair that table and vacuum the database without rebuilding business data.

**Why:** Shared hosting does not receive SQLite WAL sidecars, and a damaged presence index can make otherwise valid requests and conversations appear offline or break badge queries.

**How to apply:** Make the patch builder own the checkpoint/portable-copy steps and keep any presence-table cleanup isolated from requests, messages, settings, and other durable records.

Keep `/api/admin/conversations` aliases in the PHP API for list, detail, messages, typing, read, and delete operations while older Hostinger bundles may still call the admin-prefixed paths.

**Why:** Existing deployed JavaScript can outlive the source route convention; a valid conversation can look missing when only the URL prefix differs.

**How to apply:** Preserve `/api/conversations` as the canonical route, but make both prefixes return the same records and status codes.