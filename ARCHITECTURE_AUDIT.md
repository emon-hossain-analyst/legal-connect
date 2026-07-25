# LegalConnect — Architecture & Workflow Audit

**Status:** Analysis only. No code modified in producing this report.

---

## 0. Coverage & confidence — read this first

This report distinguishes what was **verified by reading source** from what was **not examined**. A report that claimed uniform coverage of ~70 components and 83 migrations in one pass would be fabrication, so coverage is stated explicitly per module in §6.

| Confidence | Meaning |
|---|---|
| **VERIFIED** | Source read directly (SQL body and/or component). Findings are reproducible. |
| **PARTIAL** | Key path read; edges not traced. |
| **NOT AUDITED** | Not examined. Listed for completeness — absence of findings means absence of inspection, not absence of bugs. |

---

## 1. System architecture

**Pattern:** React SPA + Supabase BaaS. No custom application server.

```
React 18 (CRA)  ──HTTPS/WSS──▶  Supabase
  react-router v6                 ├── Auth (GoTrue)
  Context API (AuthContext)       ├── PostgreSQL + RLS
  Tailwind + CSS Modules          ├── Realtime (WAL → postgres_changes)
  react-hot-toast                 ├── Storage (documents, avatars, case-documents, blog-images)
        │                         └── Edge Functions (gemini-proxy, Deno)
        └── Vercel (static host, SPA rewrite, CSP headers)
```

**Consequence of this architecture:** there is no server-side layer to enforce invariants. Every business rule lives in either a Postgres function/trigger or React. Where the two disagree, React wins visually and Postgres wins in reality — the source of most defects in §7.

---

## 2. Role model — VERIFIED

Three roles, stored as `public.users.user_type`:

| Role | Route guard | RLS predicate |
|---|---|---|
| `client` | `<ProtectedRoute roles={['client']}>` | `is_owner(client_id)` |
| `lawyer` | `<ProtectedRoute roles={['lawyer']}>` | `is_owner(lawyer_id)` |
| `admin` | `<ProtectedRoute roles={['admin']}>` | `is_admin()` / `fn_is_admin()` |

**Finding — dual identity model.** `is_owner()` (migration 52/53) matches on `users.id = auth.uid() OR users.auth_id = auth.uid()`. Two coexisting identity conventions mean RLS predicates are written inconsistently across migrations: some join `users.auth_id`, some compare `id` directly. Any new policy must use the `is_owner`/`is_admin` helpers, never a raw comparison.

**Finding — `is_admin()` redefined 6×** (migrations 004, 08, 25, 26, 29, 49) with materially different bodies — some check `auth.jwt() ->> 'role'`, some don't. Whichever migration ran last wins. This is unaudited attack surface.

---

## 3. Route map — VERIFIED (79 routes)

| Zone | Prefix | Guard | Count |
|---|---|---|---|
| Public | `/`, `/lawyers`, `/jobs`, `/legal-updates`, `/pricing`, `/faq`, … | none | ~28 |
| Auth | `/login`, `/register`, `/forgot-password`, `/reset-password` | none | 4 |
| Client portal | `/client/portal/*` | `client` | 9 |
| Lawyer suite | `/lawyer-suite/*` | `lawyer` | 19 |
| Admin | `/admin/*` | `admin` | 11 |
| Shared/legacy | `/cases`, `/chat`, `/workspace/:id`, `/client/dashboard`, `/lawyer/dashboard` | authed | ~8 |

**Finding — duplicate surfaces for the same entity.** Cases are reachable at `/cases`, `/client/portal/cases`, `/lawyer-suite/cases`, and `/workspace/:id`, each with its own fetch logic and status vocabulary. This is the structural reason status bugs appear "fixed in one place, broken in another" (see §7.4).

---

## 4. Database relationship map — VERIFIED for the core spine

```
users ─┬─< lawyers / lawyer_profiles          (1:1-ish, three rating mirrors)
       ├─< job_posts ──< job_proposals ──┐
       │                                  │ (79) contract_id, case_id
       ├─< contracts ◀──────┬─────────────┘
       │        │           │
       │        │ case_id   │ (bidirectional; both sides written)
       │        ▼           │
       ├─< cases ◀──────────┘
       │     ├──< case_milestones      ⚠ FK added only in migration 83
       │     └──< linked_appointment_id ──▶ appointments
       ├─< contract_milestones          ⚠ FK added only in migration 83
       ├─< deliverables, contract_timeline
       ├─< payments ──< commission_transactions ──▶ lawyer_payouts ──< payout_requests
       ├─< reviews ──< review_replies / review_reports
       ├─< conversations ──< messages
       └─< notifications
```

### Duplicate sources of truth — VERIFIED

| Entity | Competing stores | Impact |
|---|---|---|
| Milestones | `case_milestones` **and** `contract_milestones` | `fn_approve_milestone_and_release_funds` branches between them; only one path wrote a ledger row (fixed in 77) |
| Ratings | `lawyers.avg_rating`, `lawyer_profiles.rating`, `users.rating` | Three mirrors kept in sync by one trigger; any direct write desyncs them |
| Reviews | `reviews` **and** legacy `feedback` | Both written on every submit |
| Jobs | `job_posts` **and** `jobs` | Admin merges + dedupes in JS |
| Inquiries | `contact_inquiries` **and** `contact_messages` | Admin Settings merges these *and* `localStorage` |
| Appointment time | `date`+`time` **and** `scheduled_at`/`scheduled_time` | Root of the `duration_minutes` class of bug |

---

## 5. Migration state — **HIGHEST-PRIORITY FINDING**

`sql/` contains **83 migrations**, applied manually via the Supabase SQL editor. There is no migration runner, no `schema_migrations` table, and no record of which have been applied.

**Migrations 73–83 are believed unapplied or partially applied.** Deployed frontend code already calls RPCs and reads columns those migrations create. Until they are applied in order, the running application is calling functions that do not exist.

This is not a code defect — it is a **process defect**, and it is the root cause of the "fixed it but it's still broken" cycle. Recommendation in §8.

---

## 6. Module status

### VERIFIED (source read this session)

| Module | Status | Notes |
|---|---|---|
| Job Board / Proposals | **BROKEN → fixed in 79/80** | See §7.1, §7.2 |
| Contracts | **BROKEN → fixed in 73/79/80/82** | See §7.3, §7.4 |
| Cases | **BROKEN → fixed in 82/83** | See §7.5, §7.6 |
| Appointments / Consultation | **INCOMPLETE → fixed in 75/76/81** | See §7.7 |
| Reviews & Ratings | **BROKEN → fixed in 78** | See §7.8 |
| Billing / Commission | **PARTIAL → fixed in 77** | Ledger gap on milestone release |

### PARTIAL

| Module | Notes |
|---|---|
| Admin Panel | Third-party audit supplied by product owner (over-fetching, hard deletes, fragmented tables). Not independently re-verified. |
| Dashboards | Lawyer dashboard realtime gap found and fixed (77). Counter accuracy not traced to source. |

### NOT AUDITED

Authentication internals · Messages/chat · Notifications delivery · Analytics · Portfolio · Availability · Consultation Settings · Credentials · Verification · AI Advisor · Blog/Legal Updates · Client Dashboard widgets · Search · Settings

---

## 7. Defects — root cause analysis

### 7.1 Silent contract creation failure — CRITICAL
`fn_accept_job_proposal_transactional` cast to `'Active'::contract_status_enum` and wrapped every step in `EXCEPTION WHEN OTHERS THEN NULL`. On failure it still returned `{success: true}` with `contract_id: NULL`. Client saw a success toast; no contract existed.
**Root cause:** blanket exception swallowing on a step that is the core deliverable, not an optional side effect.
**Fixed:** 73 §7, superseded by 79.

### 7.2 Counter-offer produced an orphan hire — CRITICAL
`fn_respond_counter_offer` set `status='accepted'` with a bare `UPDATE`, never calling the transactional hire. Result: no contract, no case, no lawyer assignment, `job_posts` left `open`.
**Root cause:** two independent code paths could mark a proposal hired; only one created artifacts.
**Fixed:** 79 — single hire path, all others delegate.

### 7.3 `contracts.status` enum could not hold its own values — CRITICAL
Column was a Postgres ENUM. Migrations 60/69 wrote `'ACTIVE'`, `'COMPLETED'`, `'UNDER_CLIENT_REVIEW'` — **never added to the type**. Every modern workflow RPC threw at runtime.
**Root cause:** `ALTER TYPE … ADD VALUE` drift across 32/33 vs. later CHECK-constraint-based assumptions.
**Fixed:** 73 — converted to `VARCHAR + CHECK`, matching the pattern already used for `cases.status` and `payments.status`.

### 7.4 Status vocabulary drift — SYSTEMIC
`contracts.status` accumulated ≥18 spellings (`Active`/`active`/`ACTIVE`, `Pending Review`/`PENDING_CONTRACT`…); `appointments.status` ≥15 across six migrations.
**Root cause:** each feature migration invented its own vocabulary; no canonical set existed.
**Fixed:** 73/75 normalize + `src/constants/contractStatus.js`, `appointmentStatus.js` as the single frontend source.
**Residual risk:** any un-migrated function still writing an old spelling now violates the CHECK. Three were found and patched (`fn_terminate_contract`, `fn_approve_contract`, `fn_request_contract_changes`); others may exist in un-audited modules.

### 7.5 Contract ↔ Case orphans — HIGH
`fn_auto_sync_contract_to_case` only fires `AFTER INSERT OR UPDATE OF status, case_id`. Contracts created before migration 62, or while the trigger was dropped, never got a case. A contract with no `cases` row is permanently invisible in My Cases, making the whole execution workflow unreachable.
Compounding: the trigger's status map predates the canonical set, so 11 statuses fell to `ELSE → 'Pending'`.
**Fixed:** 82 — shared mapper, rewritten triggers, 5-stage backfill.

### 7.6 Missing FKs → PostgREST 404 — HIGH
`case_milestones.case_id` and `contract_milestones.contract_id` were declared without `REFERENCES`. PostgREST cannot resolve `.select('…, case_milestones(*)')` without a real FK → `PGRST200` → **HTTP 404**, so `/lawyer-suite/cases` rendered empty.
**Root cause:** FK omitted at table creation (migration 31/03). Latent for months; surfaced when migration 82's `NOTIFY pgrst, 'reload schema'` flushed the stale cache.
**Fixed:** 83.

### 7.7 `duration_minutes` did not exist — HIGH
`appointments` was created three times (05, 26, 27) with different shapes; `CREATE TABLE IF NOT EXISTS` meant later column lists never applied. `fn_complete_consultation` read the column via `%ROWTYPE` → runtime error on every "Mark Completed".
Two latent bugs found alongside: a NULL schedule made `NOW() < NULL` → NULL, **silently passing the completion gate**; and refund tiering charged a fee on unknown timing.
**Fixed:** 81 — column added + backfill, both gates now fail closed.

### 7.8 Reviews violated a not-null constraint — CRITICAL
Migration 59 created `reviews` with `reviewer_id`/`reviewee_id` `NOT NULL`. Migration 61 redesigned the same table for a different shape via `ADD COLUMN` and never populated them. **Every review submission failed.**
**Root cause:** two incompatible designs layered on one table.
**Fixed:** 78 — populates both, adds `reviewer_role`, enables bidirectional (lawyer↔client) reviews.

### 7.9 Dead `try/catch` around Supabase calls — SYSTEMIC, PARTIALLY FIXED
`supabase-js` **resolves** on query failure (`{data: null, error}`); it does not throw. Every `try/catch` around a query is dead code — fallbacks never run, errors vanish, pages render empty with a clean console.
**Confirmed in:** `LawyerCasesView` (fixed). **Pattern also present in:** `AdminOverview.js`, `ClientDashboard.js`, `LawyerBillingView.js` — **not yet fixed**.
This is the single highest-value remaining sweep: it converts silent blank screens into diagnosable errors.

### 7.10 Silent-failure idiom in SQL — SYSTEMIC, PARTIALLY FIXED
`EXCEPTION WHEN OTHERS THEN NULL` appears throughout `sql/`. Legitimate for optional side effects (notifications); catastrophic on core writes (§7.1). Still present in `fn_complete_case`, `fn_complete_contract`, and others.

---

## 8. Prioritised plan

### P0 — Process (do before any further code)
1. **Apply migrations 73→83 in order**, verifying each. Deployed code already depends on them.
2. **Create a `schema_migrations` table** and record what has been applied. The absence of this is the root cause of the repair loop.

### P1 — Systemic correctness
3. Sweep the dead `try/catch` pattern (§7.9) across `AdminOverview`, `ClientDashboard`, `LawyerBillingView`. Mechanical, low-risk, high diagnostic value.
4. Audit remaining `EXCEPTION WHEN OTHERS THEN NULL` on core writes (§7.10); keep on notifications, remove on state transitions.
5. Grep every SQL function for legacy status spellings that now violate the CHECK constraints.

### P2 — Data integrity
6. FK audit across all tables — §7.6 proves they were omitted more than once.
7. Collapse duplicate sources of truth (§4), starting with `job_posts`/`jobs` and `contact_inquiries`/`contact_messages`.
8. Admin over-fetching (`SELECT *` on `documents`).

### P3 — Coverage
9. Vertical audits of NOT AUDITED modules (§6), one at a time. Messages/Notifications first — they have the widest cross-module reach.

---

## 9. Method note

Every defect in §7 was found by tracing **one** workflow end-to-end through all five layers (component → service → RPC → trigger → RLS → realtime). That approach found 4 real bugs per workflow, including several with silent data loss. Broad shallow passes over many modules did not find these — the failures are invisible from the UI and produce no console output by design (§7.9, §7.10).

Recommend continuing vertically, one workflow at a time.
