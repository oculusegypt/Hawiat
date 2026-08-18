---
name: React DOM ownership
description: Preventing reconciliation failures caused by imperative DOM changes inside React-managed trees.
---

React must remain the sole owner of descendants rendered inside a React root. Imperative operations such as `innerHTML`, `removeChild`, or manual child replacement inside those descendants can cause delayed `removeChild` and `insertBefore` errors during animation or re-rendering.

**Why:** A failed image fallback that replaced a React-managed parent with `innerHTML` left React's fiber tree pointing at nodes that no longer existed, producing repeated runtime errors after the initial page appeared to load normally.

**How to apply:** Represent fallback, loading, and error states with React state and conditional rendering. Reserve direct DOM APIs for external containers that React does not render or own.