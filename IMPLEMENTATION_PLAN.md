# LEGALCONNECT — IMPLEMENTATION PLAN (PHASE 3)

**Document Version:** 1.0.0  
**Date:** July 2026  
**Author:** Senior Full-Stack Engineer & Code Auditor  
**Project:** LegalConnect (Bangladesh Legal Platform)  
**Backend:** Supabase Exclusively (Auth, PostgreSQL, Realtime, Storage)

---

## EXECUTIVE SUMMARY

This Implementation Plan translates the findings from the **Codebase Audit Report (Phase 2)** into an actionable, sequential execution roadmap. To guarantee system stability, zero data loss, and architectural integrity, all refactoring and feature remediation work is organized into five discrete, sequential batches.

Per the strict project guidelines:
1. **No React Commission Math:** All financial calculations will be migrated to server-side PostgreSQL functions and triggers.
2. **Strict 3-State Rendering:** Every Supabase query across all components will be standardized to include **Loading**, **Error**, and **Empty** UI states.
3. **No Legacy Code:** All residual references to Express, Socket.io, pg, and nodemailer will be purged or modernized to native Supabase equivalents.

---

## BATCH 1: SECURITY & RLS FIXES (P0)
**Objective:** Secure all database tables, storage buckets, and route guards against unauthorized access, race conditions, and session flickering.

### 1.1 Refactor Route Guard & Session Handling
* **Target File:** `src/components/ProtectedRoute/ProtectedRoute.js`
* **Components / Functions to Modify:** `ProtectedRoute` component, `useEffect` session check.
* **Current Behavior:** Executes an independent `supabase.auth.getSession()` call on every route render, conflicting with `AuthContext` and causing race conditions or auth flicker.
* **New Behavior:** 
  - Remove local `useEffect` and session fetching.
  - Directly consume `user`, `session`, and `loading` from `useAuth()`.
  - Render a branded loading skeleton while `loading` is true.
  - If `!session`, cleanly redirect to `/login` with return URL state.
  - If `allowedRoles` is specified and `user.user_type` does not match (or is missing), redirect to `/unauthorized` or `/login` with an explicit error banner.

### 1.2 Enforce Storage Bucket Security & RLS Policies
* **Target File:** `supabase/migrations/004_security_and_rls_hardening.sql` (New Migration)
* **Components / Functions to Modify:** Storage bucket policies for `documents` (`workspace_docs/` and `chat_attachments/`).
* **Current Behavior:** Storage objects rely on generic read/write rules without verifying if the requesting user is a participant of the specific contract workspace or chat conversation.
* **New Behavior:**
  - Create helper functions `public.is_workspace_participant(p_workspace_id UUID)` and `public.is_conversation_participant(p_conversation_id UUID)`.
  - Apply strict RLS policies on `storage.objects` for bucket `'documents'`, ensuring only authenticated participants or verified admins can read, upload, or delete documents.

### 1.3 Standardize Admin RLS Helper Functions
* **Target File:** `supabase/migrations/004_security_and_rls_hardening.sql`
* **Components / Functions to Modify:** RLS policies on `platform_commission_config` and `commission_transactions`.
* **Current Behavior:** Policies rely on ad-hoc role checks that can fail or be bypassed if user metadata is out of sync.
* **New Behavior:** Create a robust `public.is_admin()` SQL security definer function checking `public.users.user_type = 'admin'` and attach it to all administrative tables and procedures.

---

## BATCH 2: THE COMMISSION CRITICAL ZONE — DATABASE FUNCTIONS & TRIGGERS (P0)
**Objective:** Eradicate all client-side financial calculations in React and establish immutable server-side PostgreSQL triggers and stored procedures for fees, commissions, and escrow releases.

### 2.1 Server-Side Payment & Commission Processing Trigger
* **Target File:** `supabase/migrations/005_financial_triggers_and_rpc.sql` (New Migration)
* **Components / Functions to Modify:** `payments` table triggers, `commission_transactions` table.
* **Current Behavior:** `payments` table columns (`commission_amount`, `net_amount`) are not populated automatically by the database when payments occur.
* **New Behavior:**
  - Create function `public.fn_process_payment_commission()` and trigger `trg_process_payment_commission` on `public.payments` (BEFORE INSERT OR UPDATE OF amount, status).
  - When a payment is marked `'completed'` or inserted, the trigger queries `platform_commission_config` (ID: 1), calculates exact `commission_amount` (e.g., amount * default_rate / 100) and `net_amount`, updates the payment record, and atomically inserts an audit record into `commission_transactions`.

### 2.2 Atomic Milestone Approval & Escrow Release RPC
* **Target File:** `supabase/migrations/005_financial_triggers_and_rpc.sql` & `src/pages/ClientCommunicationPortal/ClientCommunicationPortal.js`
* **Components / Functions to Modify:**
  - SQL: Create RPC `public.fn_approve_milestone_and_release_funds(p_milestone_id UUID, p_client_id UUID)`.
  - React: Refactor `handleStatusChange` / milestone approval logic.
* **Current Behavior:** The frontend sequentially updates `contract_milestones.status = 'approved'` and then manually calculates and adds funds to `contracts.released_amount` in React.
* **New Behavior:**
  - The React component calls `supabase.rpc('fn_approve_milestone_and_release_funds', { p_milestone_id: milestoneId, p_client_id: user.id })`.
  - The PostgreSQL RPC verifies client ownership, marks the milestone approved, updates `contracts.released_amount`, updates outstanding balances, and triggers escrow fund release to the lawyer's net balance atomically within a single database transaction.

### 2.3 Eliminate React Commission Math in Admin Overview
* **Target File:** `supabase/migrations/005_financial_triggers_and_rpc.sql` & `src/pages/Admin/AdminOverview.js`
* **Components / Functions to Modify:**
  - SQL: Create RPC `public.fn_get_admin_financial_summary()`.
  - React: `fetchDashboardData` in `AdminOverview.js`.
* **Current Behavior:** `AdminOverview.js` loops over all payments and multiplies by `commissionRate` in React memory (`const comm = Number(pay.amount || 0) * commissionRate`).
* **New Behavior:**
  - The PostgreSQL RPC sums historical `commission_amount` and `net_amount` directly from `commission_transactions` and `payments` tables using SQL aggregations.
  - `AdminOverview.js` simply calls `supabase.rpc('fn_get_admin_financial_summary')` and displays the exact database-verified figures.

### 2.4 Server-Side Booking Fee Calculation
* **Target File:** `supabase/migrations/005_financial_triggers_and_rpc.sql` & `src/pages/AppointmentBooking/AppointmentBooking.js`
* **Components / Functions to Modify:**
  - SQL: Create RPC `public.fn_calculate_booking_fee(p_lawyer_id UUID, p_fee_type TEXT)`.
  - React: Fee calculation logic in `AppointmentBooking.js`.
* **Current Behavior:** Hardcodes a 5% platform fee in React (`Math.round(fee * 0.05)`).
* **New Behavior:**
  - React calls `supabase.rpc('fn_calculate_booking_fee', { p_lawyer_id: lawyerId, p_fee_type: 'initial_consultation' })`.
  - DB returns `{ base_fee: 3000, platform_fee: 150, total_fee: 3150, currency: 'BDT' }` based on active platform configuration.

---

## BATCH 3: REALTIME & SOCKET CLEAN-UP (P1/P2)
**Objective:** Standardize realtime communication, eliminate channel collisions, prevent memory leaks, and remove legacy WebSocket/Socket.io terminology.

### 3.1 Standardize & Scope Realtime Channels in Communication Portals
* **Target File:** `src/pages/ClientCommunicationPortal/ClientCommunicationPortal.js` & `src/pages/LawyerSuite/LawyerCommunicationPortal.js`
* **Components / Functions to Modify:** `useEffect` channel subscription setup and teardown.
* **Current Behavior:** Uses static channel names (e.g., `portal_chat_lawyer`), risking channel collisions across multiple browser tabs or sessions.
* **New Behavior:**
  - Scope channel names dynamically by user ID and workspace ID: `portal_chat_${user.id}_${selectedChat?.id || 'global'}`.
  - Implement strict channel deduplication and verify `supabase.removeChannel(channel)` clean unsubscription in memoized cleanup handlers.

### 3.2 Refactor Legacy Naming & Clean Up `useChatSocket`
* **Target File:** `src/hooks/useChatSocket.js`
* **Components / Functions to Modify:** Hook structure, comments, and internal nomenclature.
* **Current Behavior:** Named `useChatSocket` with comments and naming implying Socket.io/WebSocket connections despite using Supabase Realtime channels.
* **New Behavior:**
  - Clean up all internal comments to reference Supabase Realtime Channels.
  - Standardize error handling and typing indicator emission using Supabase Presence/Broadcast channels cleanly without memory leaks.

---

## BATCH 4: CLIENT & LAWYER EXPERIENCE FIXES — LOADING/ERROR/EMPTY STATES (P1/P2)
**Objective:** Enforce Rule: *"Every Supabase query must have: loading state + error state + empty state."* Ensure seamless recovery from network drops or empty datasets across all user-facing workflows.

### 4.1 Consultation Settings Safeguard & Error State
* **Target File:** `src/pages/LawyerSuite/ConsultationSettings.js`
* **Components / Functions to Modify:** `useEffect` fetch logic, state declarations, and JSX rendering.
* **Current Behavior:** Silently catches fetch errors with `console.error` without updating UI. If network drops, lawyer sees default settings and risks overwriting saved rates upon clicking Save.
* **New Behavior:**
  - Add explicit `error` state (`const [error, setError] = useState(null)`).
  - If query fails, render a prominent red Error Banner: *"Failed to load your consultation settings. To prevent accidental data loss, saving is disabled until settings are reloaded."*
  - Add a "Retry Loading" button and disable the Save CTA while in error state.

### 4.2 Standardize 3-State UI in Client Dashboard & Cases
* **Target File:** `src/pages/Client/ClientDashboard.js`, `src/pages/Client/ClientCases.js`, & `src/pages/Client/ClientBilling.js`
* **Components / Functions to Modify:** Data fetching hooks and JSX rendering.
* **Current Behavior:** Missing dedicated error banners and unstyled text strings for empty states.
* **New Behavior:**
  - **Loading State:** Render branded design system skeletons (`SkeletonDashboard`, `SkeletonCard`).
  - **Error State:** Render standardized inline error banners with retry action buttons.
  - **Empty State:** Render rich empty state illustrations/cards with actionable CTAs (e.g., *"No active legal cases found. Browse our verified lawyers to book your first consultation."*).

### 4.3 Standardize 3-State UI in Lawyer Dashboard & Schedule
* **Target File:** `src/pages/LawyerSuite/LawyerSuiteDashboard.js`, `src/pages/LawyerSuite/LawyerCases.js`, & `src/pages/Lawyer/LawyerSchedule.js`
* **Components / Functions to Modify:** Data fetching hooks and JSX rendering.
* **Current Behavior:** Incomplete error handling and plain text empty states.
* **New Behavior:**
  - Apply strict 3-state rendering pattern across all lawyer data widgets (cases, schedule slots, earnings summaries).
  - Provide clear empty state guidance (e.g., *"No upcoming consultation slots scheduled. Click 'Add Availability' to open booking slots."*).

### 4.4 Global Suspense & Fallback Standardization
* **Target File:** `src/App.js`
* **Components / Functions to Modify:** `<Suspense fallback={...}>` container.
* **Current Behavior:** Uses `<div className="loading-spinner">Loading...</div>`.
* **New Behavior:** Replace with `<SkeletonDashboard />` or a branded, full-screen responsive LegalConnect loading layout.

---

## BATCH 5: ADMIN EXPERIENCE & LEGACY CLEAN-UP (P2/P3)
**Objective:** Complete transactional safety for administrative actions, standardize admin UI states, and purge all legacy code artifacts.

### 5.1 Transactional Lawyer Verification Procedure
* **Target File:** `supabase/migrations/005_financial_triggers_and_rpc.sql` & `src/pages/Admin/AdminVerification.js`
* **Components / Functions to Modify:**
  - SQL: Create RPC `public.fn_verify_lawyer(p_lawyer_id UUID, p_status TEXT, p_admin_id UUID)`.
  - React: Approval and rejection handler functions in `AdminVerification.js`.
* **Current Behavior:** Executes multi-step client-side updates across `users` and `lawyer_verification` tables without transaction safety.
* **New Behavior:**
  - React calls `supabase.rpc('fn_verify_lawyer', { p_lawyer_id: id, p_status: 'verified', p_admin_id: user.id })`.
  - DB atomically updates `users.is_verified`, updates `lawyer_verification.status`, records verification timestamp, and creates a system notification for the lawyer.

### 5.2 Admin Overview & Commission Settings 3-State UI
* **Target File:** `src/pages/Admin/AdminOverview.js`, `src/pages/Admin/AdminCommissionSettings.js`, & `src/pages/Admin/AdminDisputeResolution.js`
* **Components / Functions to Modify:** Fetching logic and JSX layouts.
* **Current Behavior:** Lacks explicit error banners and displays `0` figures when queries fail.
* **New Behavior:** Implement comprehensive Error Banners with retry triggers and rich Empty State cards across all administrative views.

### 5.3 Purge Dead Code & Legacy Artifacts
* **Target File:** Across all project files (`src/services/`, `package.json`, comments).
* **Components / Functions to Modify:** Strip unused imports, dead commented code, and legacy package notes.
* **Current Behavior:** Residual comments and notes referencing Express servers, Socket.io, pg, nodemailer, and JWT cookies.
* **New Behavior:** Clean codebase completely free of legacy references, ensuring 100% adherence to Supabase serverless standards.

---

## VERIFICATION & AUDIT SIGN-OFF PLAN

After executing each batch, verification will be performed:
1. **Database Integrity Check:** Verify via SQL queries that all triggers (`trg_process_payment_commission`) and RPC functions execute atomically without error.
2. **UI State Verification:** Simulate network failures and empty database tables to verify that Loading skeletons, Error banners with retry buttons, and Rich Empty states render correctly across Client, Lawyer, and Admin portals.
3. **Financial Math Verification:** Conduct end-to-end simulated payments and milestone approvals to confirm that zero financial or commission math occurs in React and that all ledger entries match exact PostgreSQL trigger calculations.

---
*End of Implementation Plan (Phase 3).*
