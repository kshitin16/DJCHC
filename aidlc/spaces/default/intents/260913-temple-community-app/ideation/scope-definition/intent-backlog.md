# Intent Backlog — Digamber Jain Temple Community App

Proto-Units are capability-level backlog entries at this stage — the actual Unit-of-Work decomposition happens in Units Generation (2.7). Each entry below carries a MoSCoW category, its walking-skeleton-first sequencing position, and the source it traces back to.

## MoSCoW Prioritization

| Proto-Unit | MoSCoW | Sequencing position | Rationale | Source |
|---|---|---|---|---|
| Auth foundation (Cognito Google federation, admin allowlist group) | Must Have | 1 — walking skeleton | Every other must-have capability depends on sign-in and the admin/public split; nothing else can be demoed without it | [desc] [Q4] |
| Content feed — minimal slice (one post type, admin-created, publicly readable) | Must Have | 1 — walking skeleton | The thinnest end-to-end proof that admin-post-to-public-read works across the whole stack | [Q4] [Q5] |
| Content feed — full first-release scope (event dates/times + visiting-dignitary posts) | Must Have | 2 | Completes the must-have feed once the skeleton proves the pattern | [Q3] [Q5] |
| Suggestion box (authenticated submission, admin-only visibility) | Must Have | 3 | Second must-have capability; depends on the same auth foundation, not on the feed | [Q3] |
| Donations — one-time UPI via aggregator | Should Have | 4 (later release) | Named as the higher-priority half of the donation feature once it starts; blocked externally on the aggregator merchant account | [Q1] [Q2] |
| Donations — recurring/Autopay | Could Have | 5 (later release) | Follows one-time donations once the aggregator fully supports it | [Q2] |
| Donation call-outs in the content feed | Could Have | 5 (later release) | Has no content to call out until the donation feature exists | [Q5] |
| PDF library (fixed initial categories, browsable) | Could Have | 4 (later release, can run alongside donations) | Independent of donations — no shared dependency — so it can proceed in parallel with the donation work once the first release ships | [Q3] [Q6] |
| RAG-based AI-assisted chat for Jain-religion questions | Won't Have (this time) | Not sequenced | Documented for future consideration; not part of either scoped release | [Q3] |
| Admin-editable PDF category structure | Won't Have (this time) | Not sequenced | The later PDF release ships with a fixed category list; this remains a future enhancement | [Q6] |

## Value Stream Map

```
[Auth foundation]
      |
      v
[Content feed: minimal slice]  (walking skeleton — proves the stack end to end)
      |
      v
[Content feed: full first release] ---> Community sees temple happenings reliably (Success Metric: adoption)
      |
      v
[Suggestion box] ---> Admins receive member feedback without a separate channel
      |
      v
  == first release ships here ==
      |
      +---> [Donations: one-time UPI]  ---> Temple has its first digital donation channel
      |            |
      |            v
      |     [Donations: recurring/Autopay] ---> Recurring giving without repeated manual action
      |            |
      |            v
      |     [Donation call-outs in feed] ---> Feed becomes the single place for both news and giving
      |
      +---> [PDF library: fixed categories] ---> Members access religious texts without a separate source
                    (runs independently of the donation chain — no shared dependency)

<!-- Text fallback: Auth foundation feeds into a minimal content-feed slice (the walking
skeleton), which extends into the full first-release feed, then the suggestion box —
this is where the first release ships. From there, two independent later-release
chains proceed in parallel: one-time donations extending into recurring/Autopay
donations and then donation call-outs in the feed; and the PDF library with its
fixed initial categories, which has no dependency on the donation chain. -->
```

## Assumptions & Open Questions

None.
