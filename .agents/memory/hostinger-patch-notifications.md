---
name: Hostinger patch delivery
description: Requirements for compatible Hostinger patch archives and PHP Web Push delivery.
---

Hostinger patch archives must preserve the historical root layout and include the compiled assets, `index.html`, PHP API, both Apache routing files, and the current SQLite database. Web Push deployments also need the root Service Worker and its notification icon; updating only the frontend bundle/API leaves browser registrations or database schema incomplete.

**Why:** Hostinger runs the PHP/SQLite production path independently from the development Node API, and push subscriptions depend on both the `push_subscriptions` schema/settings and a valid encrypted Web Push payload.

**How to apply:** Build the patch from the current `scripts/api-index.php` and `data/sabaik.db`, include `sw.js` and `notification-icon.png`, use portable archive paths, and implement Web Push with explicit HKDF-Extract/HKDF-Expand rather than passing salts to PHP's boolean `hash_hkdf` parameter.