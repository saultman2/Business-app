---
name: recharts HMR invalid-hook quirk
description: Why recharts throws a transient "Invalid hook call / useRef null" in the console during Vite HMR in construction-app
---

# recharts + Vite HMR transient error

When a page that renders recharts components is hot-swapped by Vite HMR, the browser
console can show "Invalid hook call" / "Cannot read properties of null (reading 'useRef')"
originating from `recharts.js`. This is a **transient HMR artifact**, not a real bug.

**Why:** React's "more than one copy of React" message is misleading here. The repo has a
single deduped React (19.x) and recharts is correctly linked against it
(`recharts@…_react-dom@…_react@…` in `node_modules/.pnpm`). The error only fires at the
moment of the hot-swap when recharts' internal component identity changes mid-session; it
does not recur after a full page reload.

**How to apply:** Before treating a recharts console error as blocking, check it only
appears at an HMR update timestamp and is absent after a full reload. Verify a single React
copy with `ls node_modules/.pnpm | rg '^react@'`. Don't chase a phantom React-duplication
fix — just reload.
