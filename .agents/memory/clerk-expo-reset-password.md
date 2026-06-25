---
name: Clerk Expo reset-password future API
description: resetPasswordEmailCode.sendCode() takes 0 args in Clerk Expo v3.5.x; email param requires ts-expect-error
---

# Clerk Expo Reset Password — v3.5.x Type Gap

## Rule
`signIn.resetPasswordEmailCode.sendCode` is typed as `() => void` (0 args) in `@clerk/expo` v3.5.x, but the JS runtime **does** accept `{ email: string }` at runtime.

**How to apply:** Suppress the single TS error with `// @ts-expect-error` on the `sendCode` call, passing `{ email }` as documented:
```ts
// @ts-expect-error Clerk v3.5.x types for sendCode omit the email param; runtime accepts it
const { error } = await signIn.resetPasswordEmailCode.sendCode({ email });
```

**Why:** The Clerk future API docs and skill references describe `sendCode({ email })`, but the TypeScript definition lags. This is intentional — the runtime JS is correct. The suppressor can be removed once Clerk updates its types.

Installed version: `@clerk/expo@3.5.3` (SDK 54 era).
