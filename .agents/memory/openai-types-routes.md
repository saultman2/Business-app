---
name: OpenAI types in api-server routes
description: Don't use OpenAI namespace types in routes; use inline type aliases instead
---

The `openai` package is a transitive dep via `@workspace/integrations-openai-ai-server`. It is not directly installed in api-server, so `import type OpenAI from "openai"` fails typecheck.

**Why:** TypeScript resolves module types from the package's own node_modules, not transitive workspace lib dependencies.

**How to apply:** When you need `OpenAI.ChatCompletionContentPart` or similar, define an inline union type instead:
```ts
type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail: "low" | "high" | "auto" } };
```
