# Isolated AI trial

The trial is independent of the active application: `demo/index.html`, `demo/demo.css`, and `demo/demo.mjs` use only hard-coded fictitious monthly totals. Copy the local analysis module and original mountain image into the same directory before serving. Its CSP disallows network connections. No Firebase configuration, authentication, live records or provider keys are needed. History and a ten-question daily allowance live in browser storage under a separate demo key.

Provider adapters remain available for unit tests. A key's syntax, provider marketing, and daily question limits cannot establish an enforceable zero-spend limit. `remoteGenerationAllowed()` therefore fails closed, even if administrators configure primary or backup keys. The local engine is the automatic fallback. No live provider tests were performed. A future remote enablement requires a separately approved, verified provider-side zero-spend enforcement mechanism.

Run `npm run check`, `node --check functions/index.js`, and `node --test functions/ai/*.test.*`. The AI verification workflow packages a standalone demo artifact without deploying the production application.
