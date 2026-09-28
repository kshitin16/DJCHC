# Architecture Decision Records — Domain Design

## ADR-001: Fold admin-allowlist management into AuthComponent, backend-only

### Context

Feed posts and (later) PDF-library documents can only be created, edited, or deleted by an admin — someone whose Google account is on an allowlist. The allowlist itself needed to be manageable without a code change (per Requirements Analysis Q3), which raised a component-boundary question: does allowlist management deserve its own building block, or does it belong inside the component that already resolves signed-in identity? The builder further clarified (Domain Design Q2) that there is deliberately no in-app admin UI for managing the allowlist — the app owner manages it directly at the data layer.

### Decision

Admin-allowlist storage and the "is this identity an admin" check both live inside **AuthComponent**, alongside identity resolution. No separate AdminManagementComponent exists.

### Consequences

**Positive**: one component owns the whole "who is this person and what can they do" concern, which is exactly the boundary DDD favors for an authorization check that every other component depends on. Avoids an extra component with no in-app feature surface to justify it, given the backend-only management model. **Negative**: AuthComponent's responsibility is slightly broader than "identity resolution alone" — if the allowlist later grows a real management feature (an in-app screen, approval workflow, etc.), this decision should be revisited. **Security implication**: because AuthComponent is the single point every mutation-capable component depends on for the admin check, its correctness is security-critical — Functional Design must specify that this check happens server-side (in the AppSync/Lambda layer), never trusted from a client-supplied flag, consistent with the "server-side admin enforcement" good practice noted (but not made a firm rule) in Practices Discovery.

### Alternatives Rejected

**Separate AdminManagementComponent**: would isolate allowlist storage/mutation from identity resolution, giving it room to grow into its own feature later. Rejected because there is no in-app admin-UI surface for it today (confirmed at Q2) — a component boundary with no feature on the other side of it is unjustified complexity for a solo builder to maintain, per Feasibility's "favor conventional, well-documented patterns" guidance. Revisit if the allowlist ever grows an in-app management screen.

---

## ADR-002: No separate User/Profile entity — components reference the raw Google identity

### Context

Every owned entity in this domain (Post, Suggestion, Donation, Document) needs to record who created or submitted it. The question (Domain Design Q3) was whether that identity needs its own modeled entity/component — e.g. to support a display name — or whether referencing the raw Cognito-federated Google identity is sufficient.

### Decision

No User or Profile entity/component exists in this domain. Every owned entity stores the acting person's Google identity as a plain attribute (`createdByGoogleId`, `submittedByGoogleId`, `donorGoogleId`, `uploadedByGoogleId`) rather than a cross-component entity reference. Cognito remains the external system of record for identity; this domain never duplicates or models it.

### Consequences

**Positive**: avoids maintaining a redundant copy of identity data this domain doesn't need yet, and sidesteps an entire class of "keep the profile in sync with Google" problems. Fewer entities, less code, consistent with a solo builder favoring the well-documented, conventional pattern of trusting the identity provider. **Negative**: if a friendly display name (rather than a raw email/Cognito ID) is ever wanted on a post or suggestion, this decision must be revisited — it's a scope decision the builder explicitly confirmed is out of reach for now (Q3), not a technical limitation.

### Alternatives Rejected

**A small Profile component/entity** (e.g. googleId → displayName): would let posts and suggestions show a friendly name instead of a raw identity. Rejected because nothing in Requirements Analysis or this stage's interview asked for it, and the builder explicitly confirmed the raw identity is enough for this release (Q3). Revisit if a display-name requirement surfaces later — reversible, since adding a Profile entity later doesn't require changing any existing entity's shape, only adding an optional cross-component reference.

---

## ADR-003: Event and Visiting Dignitary posts share one Post entity with a `type` field

### Context

The feed has two post types today (Event, Visiting Dignitary) with a third (Donation Call-out) arriving once donations ship. Both current types share the same basic shape — a title, a date, and a description. The question (Domain Design Q4) was whether to model this as one shared entity with a discriminator field, or as separate entities per type.

### Decision

**Post** is a single entity owned by FeedComponent, with a `type` attribute distinguishing Event / Visiting Dignitary / (later) Donation Call-out.

### Consequences

**Positive**: one entity, one set of CRUD operations, less code for a solo builder to write and maintain across three post types that are structurally identical today. **Negative**: if a post type's shape diverges meaningfully later (for example, a Donation Call-out needing a linked donation amount or campaign reference), the shared shape may need optional type-specific fields, which is a smaller change than an outright entity split but still a change. This is a reversible decision — Functional Design can add optional fields per type without breaking the shared shape, and a full split into separate entities remains possible if divergence grows large enough to justify it.

### Alternatives Rejected

**Separate entities per post type** (e.g. EventPost, DignitaryPost): would keep room to diverge freely from day one with no shared-shape constraint. Rejected per the builder's explicit preference (Q4) to keep one shape while the types remain structurally identical — introducing three near-identical entities now would be premature differentiation for a domain that doesn't need it yet.

---

## ADR-004: Map the full domain now, including later-release components

### Context

Requirements Analysis and Scope Definition both distinguish a first release (auth, feed, suggestion box) from a later release (donations, PDF library). Domain Design needed to decide whether to design building blocks for the whole domain now, or defer the later-release components until that work is actually scoped in more implementation detail.

### Decision

This stage designs building blocks for the full domain now — DonationComponent and PdfLibraryComponent are catalogued in `components.md` alongside the first-release components, each clearly labeled "Later Release."

### Consequences

**Positive**: the full domain picture exists in one place, so Units Generation and later design stages can see how the later-release components will eventually connect to AuthComponent without re-discovering the domain from scratch when that work resumes. **Negative**: some detail in DonationComponent and PdfLibraryComponent (for example, the exact aggregator integration shape) is necessarily provisional, since the later release hasn't been scoped to the same depth as the first release yet — Functional Design for those components should expect to revisit and refine, not treat this catalogue as final for capabilities that haven't been built yet.

### Alternatives Rejected

**First-release components only**: would keep this stage's scope tightly matched to what's about to be built, deferring later-release design until that work is actually scheduled. Rejected per the builder's explicit preference (Q1) to see the full picture upfront.

---

## ADR-005: ReminderComponent is a new component, owning reminders via a guest (unauthenticated) identity

### Context

Mid-Construction, the builder requested a new first-release capability: a calendar view of Event posts with day-before push reminders (snooze, auto-clear, user-cancel-anytime — `requirements.md` FR7.1-FR7.8). Two decisions were needed: (1) whether reminders belong inside FeedComponent (which already owns the `Post` data reminders are built from) or in a new component, and (2) whether reminder actions require a signed-in Google identity, given FR7.8 flagged this as an explicitly open technical question with a strong preference for no sign-in at all.

### Decision

A new **ReminderComponent** owns reminder scheduling, snooze/cancel state, device push-token registration, and push delivery. It depends on FeedComponent (read-only) for Event-post data and dateTime-change notices, but is otherwise independent. Reminder ownership uses a **Cognito guest (unauthenticated) identity pool identity**, persisted per device — no Google sign-in is required for any reminder action (Domain Design Q2).

### Consequences

**Positive**: matches the builder's strong no-sign-in preference exactly, using a real, supported Amplify mechanism (Amplify Data's `allow.guest()` authorization mode against a Cognito Identity Pool guest identity) rather than a workaround; keeps FeedComponent's boundary unchanged (it gains one dependent, not new responsibilities); mirrors this project's own established precedent of splitting out a component when the access/identity model materially differs (the same reasoning that produced SuggestionComponent). **Negative**: a guest identity is device-local, so a user's reminders do not follow them across a reinstall or a second device — acceptable because nothing in FR7 requires cross-device reminder sync; the exact scheduled-compute mechanism that fires reminders at their target times is deferred to Infrastructure Design, so this ADR establishes the dependency exists without pinning the implementation.

### Alternatives Rejected

**Fold reminders into FeedComponent** (Domain Design Q1, Option B): rejected — reminders have their own lifecycle (scheduled → snoozed → fired/cleared/cancelled), their own external dependencies (push delivery, scheduled compute, a distinct identity model), and no independent value without an event to attach to, but that's true of Suggestion's relationship to Auth too, and this project already chose to split for exactly that reason once before.

**Require Google sign-in for reminders** (Domain Design Q2, Option B): rejected — the builder's Requirements Analysis answer (Q4) was explicit that sign-in was only an acceptable fallback if guest access were technically infeasible, and AWS Amplify's guest-identity support means it isn't.
