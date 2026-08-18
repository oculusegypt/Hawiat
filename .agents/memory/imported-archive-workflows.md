---
name: Imported archive workflows
description: Running web apps restored from uploaded archives in this workspace.
---

Uploaded project archives can contain valid `.replit-artifact/artifact.toml` files without those artifacts being registered as managed workflows in the current session. The app may still build and serve correctly once a workflow is configured against the archive's declared port and base path.

**Why:** Artifact registration is session/workspace state, while archive extraction restores files only; assuming the manifest automatically creates a workflow can lead to a false "workflow not found" result.

**How to apply:** After extracting an archive, check both registered artifacts and configured workflows. If the imported artifact is absent, configure one minimal frontend workflow using the port/base path from its manifest, then verify the proxied root and API health endpoint.