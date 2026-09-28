# Performance Design — auth-unit

## Design for NFR1.1/NFR1.2 (sign-in and admin-check latency)

No caching layer, connection pool, or async processing pattern is designed here — this Unit's entire performance surface is:

1. **Sign-in round trip (NFR1.1, < 3s p95)**: entirely delegated to Amplify Auth's hosted-UI redirect to Cognito, which redirects to Google. No design decision this Unit makes affects this path's latency — it is bounded by Google's and Cognito's own response times. The only client-side design choice is to show a loading indicator immediately on tap (standard Flutter pattern, not a distinct architectural decision).

2. **Admin-check latency (NFR1.2, < 5ms)**: a synchronous in-memory read of the already-decoded JWT's `cognito:groups` claim, held in `AuthState` (frontend-components.md). No network call, no database lookup — the design is simply "decode once at sign-in/refresh, read from memory thereafter," which every consuming Unit already does independently.

## Performance budget summary

| Target | Design approach |
|---|---|
| NFR1.1 (sign-in, <3s p95) | No custom optimization possible or needed — bounded by Cognito/Google's own latency |
| NFR1.2 (admin-check, <5ms) | In-memory JWT claim read, no I/O |

No resource pooling, CDN, or lazy-loading pattern applies — this Unit issues no requests of its own beyond the one-time hosted-UI redirect.
