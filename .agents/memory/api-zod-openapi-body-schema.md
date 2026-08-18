---
name: OpenAPI body schemas
description: A codegen compatibility rule for request bodies in the workspace OpenAPI spec.
---

When adding an OpenAPI endpoint with a request body, define the body under `components.schemas` and reference it with `$ref` instead of declaring the object inline at the operation.

**Why:** The workspace's Orval outputs export inline body names from both the generated Zod API module and generated type module, which can cause duplicate-export TypeScript failures during codegen.

**How to apply:** Use a named schema such as `ConversationTypingInput`, then run the API codegen and the full typecheck before restarting affected workflows.