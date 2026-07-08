# LEGALCONNECT — CODEBASE AUDIT REPORT (PHASE 2)

**Document Version:** 1.0.0  
**Date:** July 2026  
**Auditor:** Senior Full-Stack Engineer & Code Auditor  
**Project:** LegalConnect (Bangladesh Legal Platform)  
**Backend:** Supabase Exclusively (Auth, PostgreSQL, Realtime, Storage)

---

## EXECUTIVE SUMMARY

This report provides an exhaustive, line-by-line technical audit of the **LegalConnect** web application. The audit was conducted following a meticulous examination of all codebase assets, including React components, custom hooks, context providers, service layers, and Supabase SQL migrations.

### Key Findings Overview:
1. **Critical Financial Rule Violation (P0):** Commission calculations and fee aggregations are currently being executed in React client-side code (e.g., in `AdminOverview.js` and `AppointmentBooking.js`). This violates the core architectural mandate: *"Never do commission math in React — database function only."*
2. **Missing UI States (P1/P2):** Across numerous pages and components, Supabase queries lack complete **Loading**, **Error**, and **Empty** states. Many components silently log errors to the console without alerting the user or rendering fallback UI.
3. **Route & Auth Guard Inconsistencies (P1):** Redundant session checks in `ProtectedRoute.js` conflict with `AuthContext`, creating race conditions and potential flashes of unauthenticated content.
4. **Database Trigger & RLS Gaps (P0/P1):** The PostgreSQL database lacks atomic triggers on the `payments` and `contracts` tables to automatically compute commission deductions and escrow releases.

---

## SECTION A: ARCHITECTURE & ROUTING AUDIT

### 1. Route Guard & Session Management (`ProtectedRoute.js`)
* **File Path:** [src/components/ProtectedRoute/ProtectedRoute.js](file:///e:/University/9th%20semester/P_three/LegalConnect/src/components/ProtectedRoute/ProtectedRoute.js#L14-L44)
* **Lines:** 14–44
* **Issue Description:** `ProtectedRoute` performs an independent `supabase.auth.getSession()` call inside a `useEffect` hook on every route render. This is redundant because `AuthContext` already maintains the global authentication state and session. 
* **Impact:**
  - **Race Conditions:** If `AuthContext` is still initializing while `ProtectedRoute` completes its local session check (or vice versa), users experience flickering redirects or get erroneously sent to `/login`.
  - **Duplicate Network/Storage Requests:** Unnecessary asynchronous queries to Supabase Auth on every navigation event.
* **Remediation:** Refactor `ProtectedRoute` to consume `user`, `session`, and `loading` directly from `useAuth()`. Remove the local `useEffect` session check entirely.

### 2. Role-Based Access Control (RBAC) Vulnerabilities
* **File Path:** [src/components/ProtectedRoute/ProtectedRoute.js](file:///e:/University/9th%20semester/P_three/LegalConnect/src/components/ProtectedRoute/ProtectedRoute.js#L46-L56)
* **Lines:** 46–56
* **Issue Description:** The guard checks `user.user_type` against `allowedRoles`. However, if `user_type` is undefined in the user object (e.g., due to incomplete profile hydration in `AuthContext`), the user is redirected to `/unauthorized` or `/login` without a clear error message.
* **Remediation:** Ensure `AuthContext` guarantees profile hydration before setting `loading: false`. Add explicit fallback handling in `ProtectedRoute` when role metadata is missing or corrupted.

### 3. Route Structure & Duplicate Workflows (`App.js`)
* **File Path:** [src/App.js](file:///e:/University/9th%20semester/P_three/LegalConnect/src/App.js#L54-L120)
* **Lines:** 54–120
* **Issue Description:** There is fragmentation and overlap between appointment booking and consultation workflows. Both `AppointmentBooking.js` (`/booking/:lawyerId`) and `LawyerConsultationModal.js` / `ConsultationBookingModal.js` implement booking logic with conflicting state structures.
* **Remediation:** Consolidate booking routing into a single, canonical booking flow governed by unified parameters.

### 4. Inadequate Suspense & Fallback UI
* **File Path:** [src/App.js](file:///e:/University/9th%20semester/P_three/LegalConnect/src/App.js#L35-L42)
* **Lines:** 35–42
* **Issue Description:** The global `Suspense` fallback is a generic unstyled `<div>Loading...</div>` spinner rather than utilizing the standardized design system skeletons (e.g., `SkeletonDashboard` or `SkeletonProfile`).
* **Remediation:** Replace the generic spinner in `App.js` with a branded, responsive skeleton loader.

---

## SECTION B: SUPABASE BACKEND AUDIT

### 1. Missing Database Triggers for Payments & Commissions
* **File Path:** [supabase/migrations/001_initial_schema.sql](file:///e:/University/9th%20semester/P_three/LegalConnect/supabase/migrations/001_initial_schema.sql#L254-L280) & [003_commission_schema.sql](file:///e:/University/9th%20semester/P_three/LegalConnect/supabase/migrations/003_commission_schema.sql#L80-L100)
* **Issue Description:** In `001_initial_schema.sql`, the `payments` table contains `commission_amount` and `net_amount` columns. However, there is no PostgreSQL trigger attached to `payments` to automatically compute these amounts upon insertion or update. In `003_commission_schema.sql`, the commission trigger `trg_calculate_commission` is attached only to `commission_transactions`.
* **Impact:** If a payment record is inserted into `payments`, `commission_amount` and `net_amount` remain NULL or rely on whatever value the client sends, creating a severe data integrity vulnerability.
* **Remediation:** Create a robust PostgreSQL trigger on `payments` (and `contracts`) that calls a server-side function (`fn_process_payment_commission`) to atomically calculate commission from `platform_commission_config` and populate both `payments` and `commission_transactions`.

### 2. Row-Level Security (RLS) Policy Gaps
* **File Path:** [supabase/migrations/002_rls_policies.sql](file:///e:/University/9th%20semester/P_three/LegalConnect/supabase/migrations/002_rls_policies.sql) & [003_commission_schema.sql](file:///e:/University/9th%20semester/P_three/LegalConnect/supabase/migrations/003_commission_schema.sql#L40-L75)
* **Issue Description:** 
  - While basic RLS exists for `users`, `lawyers`, and `contracts`, RLS policies on `platform_commission_config` and `commission_transactions` rely on admin role checks that assume `auth.jwt() ->> 'role' = 'admin'` or query the `users` table. If JWT claims are out of sync with table roles, admin operations fail or become exposed.
  - Storage bucket policies for `documents` (`workspace_docs` and `chat_attachments`) lack explicit RLS checks enforcing that only participants of the specific `workspace_id` or `conversation_id` can download or read the files.
* **Remediation:** Standardize RLS helper functions (e.g., `is_admin()`, `is_workspace_participant()`) and apply strict policies across all tables and storage buckets.

### 3. Query Error Handling & Missing UI States
* **File Path:** Across all service files ([src/services/](file:///e:/University/9th%20semester/P_three/LegalConnect/src/services/)) and pages.
* **Issue Description:** Violated Rule: *"Every Supabase query must have: loading state + error state + empty state."* Dozens of component queries trap errors with `console.error(err)` without updating component state to display an error banner or empty state illustration.
* **Remediation:** Implement strict 3-state rendering (Loading Skeleton -> Error Banner with Retry -> Empty State Banner -> Data Grid) across all data-fetching components.

---

## SECTION C: FINANCIAL & TRANSACTION AUDIT (THE COMMISSION CRITICAL ZONE)

### 1. Client-Side Commission Calculation in Admin Dashboard (P0 CRITICAL)
* **File Path:** [src/pages/Admin/AdminOverview.js](file:///e:/University/9th%20semester/P_three/LegalConnect/src/pages/Admin/AdminOverview.js#L112-L130)
* **Lines:** 112–130
* **Code Snippet:**
  ```javascript
  const commissionRate = Number(config?.default_rate || 15) / 100;
  // ...
  const comm = Number(pay.amount || 0) * commissionRate;
  ```
* **Issue Description:** The Admin Overview dashboard calculates total platform revenue and commission revenue dynamically inside React by iterating through fetched payment records and multiplying by `commissionRate`.
* **Impact:** Direct violation of architectural rules. Client-side financial math is vulnerable to precision floating-point errors, manipulation, and discrepancies when individual lawyers have custom commission tiers or when historical commission rates change over time.
* **Remediation:** Remove all commission math from React. Create a PostgreSQL RPC function or view (e.g., `fn_get_admin_financial_summary()`) that aggregates exact historical commission amounts directly from the database.

### 2. Hardcoded Platform Fee Math in Appointment Booking (P0 CRITICAL)
* **File Path:** [src/pages/AppointmentBooking/AppointmentBooking.js](file:///e:/University/9th%20semester/P_three/LegalConnect/src/pages/AppointmentBooking/AppointmentBooking.js#L172-L186)
* **Lines:** 172–186
* **Code Snippet:**
  ```javascript
  const fee = Number(selectedLawyer.consultation_fee || 3000);
  const platformFee = Math.round(fee * 0.05); // Hardcoded 5% in React!
  const total = fee + platformFee;
  ```
* **Issue Description:** When a client books an appointment, the frontend hardcodes a 5% platform fee calculation in React to display the total price and pass to the checkout flow.
* **Impact:** Severe violation of central commission configuration. If the admin updates the platform commission in `platform_commission_config`, `AppointmentBooking.js` will continue charging a hardcoded 5%.
* **Remediation:** Fetch fee breakdown via a database RPC function (`fn_calculate_booking_fee(lawyer_id, fee_type)`) that reads from `platform_commission_config` and returns the exact breakdown (base fee, platform tax/commission, total payable).

### 3. Non-Transactional Escrow & Milestone Fund Release (P0 CRITICAL)
* **File Path:** [src/pages/ClientCommunicationPortal/ClientCommunicationPortal.js](file:///e:/University/9th%20semester/P_three/LegalConnect/src/pages/ClientCommunicationPortal/ClientCommunicationPortal.js#L125-L138)
* **Lines:** 125–138
* **Issue Description:** When a client approves a case milestone, the frontend sends two separate Supabase update requests:
  1. Updates `contract_milestones` status to `'approved'`.
  2. Updates `contracts` table `released_amount` by adding the milestone amount in client-side math.
* **Impact:** If the network fails between request 1 and request 2, the milestone is approved but funds are never released (or vice versa). Furthermore, no commission deduction is recorded atomically during milestone release.
* **Remediation:** Replace client-side multi-step updates with an atomic PostgreSQL transaction function: `rpc('fn_approve_milestone_and_release_funds', { p_milestone_id: milestoneId })`.

---

## SECTION D: REALTIME & SOCKET AUDIT

### 1. Realtime Channel Subscription Management
* **File Path:** [src/hooks/useChatSocket.js](file:///e:/University/9th%20semester/P_three/LegalConnect/src/hooks/useChatSocket.js#L35-L65), [ClientCommunicationPortal.js](file:///e:/University/9th%20semester/P_three/LegalConnect/src/pages/ClientCommunicationPortal/ClientCommunicationPortal.js#L150-L190), & [LawyerCommunicationPortal.js](file:///e:/University/9th%20semester/P_three/LegalConnect/src/pages/LawyerSuite/LawyerCommunicationPortal.js#L192-L236)
* **Issue Description:** 
  - Components subscribe to Supabase Realtime channels (`postgres_changes` on `messages` and `conversations`).
  - While cleanup functions call `supabase.removeChannel(channel)`, multiple components instantiate independent channels listening to the same database events without channel deduplication or shared socket context.
  - In `LawyerCommunicationPortal.js` ([line 194](file:///e:/University/9th%20semester/P_three/LegalConnect/src/pages/LawyerSuite/LawyerCommunicationPortal.js#L194)), the channel name is static (`portal_chat_lawyer`). If multiple instances or tabs are open, channel collision can occur.
* **Remediation:** Ensure unique channel naming scoped by user ID or workspace ID (`portal_chat_lawyer_${user.id}`) and verify clean unsubscription on unmount.

### 2. Legacy Socket Naming (`useChatSocket.js`)
* **File Path:** [src/hooks/useChatSocket.js](file:///e:/University/9th%20semester/P_three/LegalConnect/src/hooks/useChatSocket.js)
* **Issue Description:** The hook is named `useChatSocket` and exposes `emitTyping`, which implies WebSocket/Socket.io architecture. In reality, it is powered entirely by Supabase Realtime channels. While functionally working, the legacy naming creates cognitive dissonance and technical debt.
* **Remediation:** Document and rename or refactor internal variables during Phase 4 to reflect pure Supabase Realtime architecture.

---

## SECTION E: CLIENT EXPERIENCE AUDIT

### 1. Client Dashboard (`ClientDashboard.js`)
* **File Path:** [src/pages/Client/ClientDashboard.js](file:///e:/University/9th%20semester/P_three/LegalConnect/src/pages/Client/ClientDashboard.js)
* **Issue Description:**
  - **Missing Error UI:** If `fetchDashboardData()` fails when querying contracts or appointments, `loading` is set to false, but no error state banner is shown to the user.
  - **Empty States:** When a client has no active appointments or contracts, simple text strings are shown instead of structured, aesthetically pleasing empty state cards with call-to-action buttons (e.g., "Find a Lawyer").
* **Remediation:** Implement standardized Error Banners and Rich Empty State components across all dashboard widgets.

### 2. Client Communication Portal (`ClientCommunicationPortal.js`)
* **File Path:** [src/pages/ClientCommunicationPortal/ClientCommunicationPortal.js](file:///e:/University/9th%20semester/P_three/LegalConnect/src/pages/ClientCommunicationPortal/ClientCommunicationPortal.js#L588-L729)
* **Issue Description:**
  - **File Upload Error Handling:** When uploading attachments ([lines 630-650](file:///e:/University/9th%20semester/P_three/LegalConnect/src/pages/ClientCommunicationPortal/ClientCommunicationPortal.js#L630-L650)), if storage quota is exceeded or RLS fails, only a toast message appears; the UI does not show failed upload retry states in the document list.
  - **Milestone State:** Lacks visual feedback or confirmation modals before approving high-value financial milestones.

### 3. Appointment Booking (`AppointmentBooking.js`)
* **File Path:** [src/pages/AppointmentBooking/AppointmentBooking.js](file:///e:/University/9th%20semester/P_three/LegalConnect/src/pages/AppointmentBooking/AppointmentBooking.js#L275-L366)
* **Issue Description:**
  - **Missing Empty State:** If lawyer filtering returns 0 results, the page renders an empty container without guiding the user to reset filters.
  - **Submit Error Recovery:** If booking submission fails at line 350, the user must re-enter selection details.

---

## SECTION F: LAWYER EXPERIENCE AUDIT

### 1. Consultation Settings (`ConsultationSettings.js`)
* **File Path:** [src/pages/LawyerSuite/ConsultationSettings.js](file:///e:/University/9th%20semester/P_three/LegalConnect/src/pages/LawyerSuite/ConsultationSettings.js#L47-L63)
* **Lines:** 47–63
* **Issue Description:** In `useEffect`, when fetching existing settings from `consultation_settings`, errors are caught and logged to console (`console.error`), but no error state UI is rendered. If the network drops, the lawyer sees the default settings form. If they click "Save", they will inadvertently overwrite their saved rates with default values!
* **Remediation:** Add explicit `error` state. If fetching settings fails, disable the form and display an error banner with a "Retry Fetching Settings" button.

### 2. Lawyer Communication Portal (`LawyerCommunicationPortal.js`)
* **File Path:** [src/pages/LawyerSuite/LawyerCommunicationPortal.js](file:///e:/University/9th%20semester/P_three/LegalConnect/src/pages/LawyerSuite/LawyerCommunicationPortal.js#L433-L470)
* **Lines:** 433–470
* **Issue Description:** In `handleCreateContract`, the lawyer creates a contract directly from the chat overlay. The amount and agreed fee are taken from raw text input without server-side validation against the lawyer's configured minimum rates or platform policies.
* **Remediation:** Enforce server-side validation via DB constraints or RPC functions during contract initiation.

### 3. Lawyer Earnings & Cases (`LawyerEarnings.js`, `LawyerCases.js`)
* **File Path:** [src/pages/Lawyer/LawyerEarnings.js](file:///e:/University/9th%20semester/P_three/LegalConnect/src/pages/Lawyer/LawyerEarnings.js) & [LawyerCases.js](file:///e:/University/9th%20semester/P_three/LegalConnect/src/pages/LawyerSuite/LawyerCases.js)
* **Issue Description:**
  - Lacks dedicated empty state graphics when a lawyer has 0 completed cases or $0 earnings.
  - Earnings overview calculates totals by summing arrays in frontend memory rather than querying a database reporting view.

---

## SECTION G: ADMIN EXPERIENCE AUDIT

### 1. Admin Overview & Financial Metrics (`AdminOverview.js`)
* **File Path:** [src/pages/Admin/AdminOverview.js](file:///e:/University/9th%20semester/P_three/LegalConnect/src/pages/Admin/AdminOverview.js#L66-L148)
* **Lines:** 66–148
* **Issue Description:**
  - As noted in Section C, financial metrics are computed client-side.
  - **Error State Gap:** If `fetchDashboardData` fails, `loading` is set to false, but the dashboard renders empty metric cards (`0 BDT`, `0 Users`) instead of displaying an explicit system error banner.

### 2. Admin Verification (`AdminVerification.js`)
* **File Path:** [src/pages/Admin/AdminVerification.js](file:///e:/University/9th%20semester/P_three/LegalConnect/src/pages/Admin/AdminVerification.js)
* **Issue Description:**
  - Approving or rejecting a lawyer requires updating both `users.is_verified` and `lawyer_verification.status`. Currently done via sequential client-side queries without transaction safety.
* **Remediation:** Wrap verification state changes in a transactional DB procedure: `fn_verify_lawyer(p_lawyer_id, p_status)`.

### 3. Commission Settings (`AdminCommissionSettings.js`)
* **File Path:** [src/pages/Admin/AdminCommissionSettings.js](file:///e:/University/9th%20semester/P_three/LegalConnect/src/pages/Admin/AdminCommissionSettings.js#L54-L65)
* **Issue Description:** Lacks error boundary rendering if updating `platform_commission_config` fails due to RLS or network timeout.

---

## SECTION H: DEAD CODE & LEGACY ARTIFACTS

### 1. Legacy Package & Naming References
* **Issue Description:**
  - References to legacy backend concepts (`Socket.io`, `Express`, `pg`, `nodemailer`, `JWT cookie system`) exist in historical notes, comments, and file naming conventions (e.g., `useChatSocket.js`).
  - The project is 100% Supabase serverless. Any residual dead code or misleading naming must be treated as technical debt and isolated.
* **Remediation:** During Phase 4 execution, purge dead legacy comments, strip unused imports across all services, and ensure clean adherence to Supabase-only architecture.

---

## SECTION I: PRIORITIZED FIX MATRIX (P0, P1, P2, P3)

| Priority | Component / File | Section | Issue Description | Remediation Action (Phase 4) |
| :---: | :--- | :---: | :--- | :--- |
| **P0** | `AdminOverview.js` | C1, G1 | Client-side commission & revenue math in React. | Create PostgreSQL RPC `fn_get_admin_financial_summary()` & remove React math. |
| **P0** | `AppointmentBooking.js` | C2, E3 | Hardcoded 5% platform fee calculation in React. | Create PostgreSQL RPC `fn_calculate_booking_fee()` reading from DB config. |
| **P0** | `ClientCommunicationPortal.js` | C3, E2 | Non-transactional milestone approval & fund release. | Create atomic PostgreSQL RPC `fn_approve_milestone_and_release_funds()`. |
| **P0** | `001_initial_schema.sql` / DB | B1 | Missing DB triggers on `payments` for automatic commission calculation. | Create trigger & function `fn_process_payment_commission()` on `payments` & `contracts`. |
| **P1** | `ProtectedRoute.js` | A1, A2 | Redundant `getSession` in `useEffect` causing race conditions & auth flicker. | Refactor to consume `user`, `session`, `loading` directly from `useAuth()`. |
| **P1** | `ConsultationSettings.js` | F1 | Missing error UI state; network failure risks overwriting lawyer settings. | Add explicit UI error banner & disable form saving when fetch fails. |
| **P1** | `AdminVerification.js` | G2 | Multi-step client-side lawyer verification updates lack transaction safety. | Create transactional DB RPC `fn_verify_lawyer()`. |
| **P1** | `LawyerCommunicationPortal.js`| F2 | Unvalidated contract creation from chat overlay. | Add server-side fee validation & strict error state handling. |
| **P2** | All Pages & Components | B3, E1, F3 | Missing strict 3-state UI (Loading Skeleton + Error Banner + Empty State). | Add standardized Loading, Error, and Empty state UI across all Supabase queries. |
| **P2** | `App.js` | A4 | Generic unstyled `<div className="loading-spinner">Loading...</div>` fallback. | Replace with standardized `SkeletonDashboard` / branded loader. |
| **P2** | `useChatSocket.js` / Portals | D1 | Realtime channel naming collisions & lack of memoized cleanup verification. | Scope channel names by user/workspace ID & verify clean unsubscription. |
| **P3** | `useChatSocket.js` / Services | D2, H1 | Legacy naming (`Socket`) & dead code comments referencing Express/Socket.io. | Clean up comments, standardize terminology to Supabase Realtime. |

---
*End of Codebase Audit Report (Phase 2).*
