---
name: Orval generated useQuery options require queryKey
description: How to pass enabled/other query options to generated useGetX hooks without a TS2741 queryKey error
---

The generated `useGetX(id, { query: {...} })` hooks type `query` as a full TanStack v5 `UseQueryOptions`, which makes `queryKey` **required**. Passing only `{ enabled: ... }` fails with TS2741 "Property 'queryKey' is missing".

**How to apply:** when you need `enabled` (or any partial query option) on a generated single-resource hook, also pass the matching generated query-key helper:

```ts
useGetEstimate(id ?? 0, {
  query: { enabled: !!id, queryKey: getGetEstimateQueryKey(id ?? 0) },
});
```

Every `useGetX` has a paired `getGetXQueryKey(...)` export. This is why most call sites pass no options at all — adding options forces you to also supply queryKey.
