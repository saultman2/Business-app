---
name: Zod in api-server
description: zod must be explicitly added to api-server's dependencies to bundle correctly
---

The api-server uses esbuild for bundling. Packages must be in `artifacts/api-server/package.json` dependencies to resolve. `zod` is not inherited from workspace libs even if a lib dependency uses it.

**Why:** esbuild resolves from the artifact's own node_modules; transitive deps from workspace libs aren't re-exported for direct use.

**How to apply:** When adding `import { z } from "zod"` to any api-server route, first check that `"zod": "catalog:"` is in `artifacts/api-server/package.json` dependencies. Run `pnpm install` after adding.
