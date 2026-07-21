import { supabase } from './supabase';

/**
 * RealtimeSyncService — singleton that combines:
 *   1. Supabase Broadcast  (instant cross-tab/cross-user push)
 *   2. Postgres CDC        (catches every DB-level lawyers UPDATE)
 *
 * Rules:
 *  - Only ONE channel is ever created (singleton guard).
 *  - `self: true` so the sender tab also receives its own broadcast.
 *  - Auto-reconnects once on CHANNEL_ERROR / TIMED_OUT.
 *  - All subscribers receive a normalised payload:
 *      { source, lawyerId, userId, is_verified, verification_status, record? }
 */
const MAX_RECONNECT_DELAY_MS = 60000;
const BASE_RECONNECT_DELAY_MS = 3000;

// Audit #23: exponential backoff (3s, 6s, 12s, 24s, ... capped at 60s) instead
// of retrying at a fixed 3s interval forever, which hammers Supabase during a
// sustained outage instead of backing off.
function nextReconnectDelay(attempt) {
  const delay = BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt);
  return Math.min(delay, MAX_RECONNECT_DELAY_MS);
}

class RealtimeSyncService {
  constructor() {
    this._listeners = new Set();
    this._channel = null;
    this._subscribed = false;
    this._reconnectTimer = null;
    this._reconnectAttempts = 0;
    this._caseReconnectAttempts = 0;
  }

  // ─── public API ────────────────────────────────────────────────────────────

  /**
   * Subscribe to lawyer-approval / verification changes.
   * @param {(payload: object) => void} cb
   * @returns {() => void}  unsubscribe function — call on component unmount
   */
  subscribe(cb) {
    if (typeof cb !== 'function') return () => {};
    this._listeners.add(cb);
    this._ensureChannel();
    return () => this._listeners.delete(cb);
  }

  /**
   * Broadcast an approval change to every connected tab/user.
   * Also notifies local listeners immediately (no round-trip wait).
   */
  async broadcastApprovalChange(data = {}) {
    const payload = {
      source: 'broadcast',
      timestamp: Date.now(),
      lawyerId: data.lawyerId ?? null,
      userId: data.userId ?? data.profileId ?? null,
      is_verified: data.is_verified ?? true,
      verification_status: data.verification_status ?? 'verified',
      action: data.action ?? 'APPROVED',
    };

    // Notify local listeners immediately — no waiting for network round-trip
    this._notify(payload);

    // Then push to all other connected clients
    if (this._channel && this._subscribed) {
      await this._channel
        .send({ type: 'broadcast', event: 'LAWYER_APPROVAL', payload })
        .catch((err) => console.warn('[RealtimeSync] broadcast send error:', err));
    }
  }

  /** Tear down cleanly (call on app unmount if needed). */
  cleanup() {
    clearTimeout(this._reconnectTimer);
    if (this._channel) {
      supabase.removeChannel(this._channel);
      this._channel = null;
    }
    this._subscribed = false;
    this._listeners.clear();
  }

  // ─── private ───────────────────────────────────────────────────────────────

  _ensureChannel() {
    if (this._subscribed && this._channel) return;
    if (this._channel) return; // already connecting

    // Channel name must NOT start with "realtime:" — use a plain unique name
    this._channel = supabase
      .channel('lc_lawyer_approval_v3', {
        config: {
          broadcast: { self: true },   // sender tab also receives its own events
          presence: { key: '' },
        },
      })
      // ── 1. Broadcast: instant notification sent by admin after RPC call ──
      .on('broadcast', { event: 'LAWYER_APPROVAL' }, ({ payload }) => {
        this._notify({ source: 'broadcast', ...payload });
      })
      // ── 2. CDC: catches every UPDATE on public.lawyers (any client/tab) ──
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'lawyers' },
        ({ new: rec, old: prev }) => {
          const statusChanged =
            rec.verification_status !== prev?.verification_status;
          const verifiedChanged = rec.is_verified !== prev?.is_verified;
          if (statusChanged || verifiedChanged) {
            this._notify({
              source: 'cdc_lawyers',
              lawyerId: rec.id,
              userId: rec.user_id,
              is_verified: rec.is_verified,
              verification_status: rec.verification_status,
              record: rec,
            });
          }
        }
      )
      // ── 3. CDC: catches is_active / is_verified changes on public.users ──
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users' },
        ({ new: rec, old: prev }) => {
          if (
            rec.is_verified !== prev?.is_verified ||
            rec.is_active !== prev?.is_active
          ) {
            this._notify({
              source: 'cdc_users',
              userId: rec.id,
              is_verified: rec.is_verified,
              is_active: rec.is_active,
              record: rec,
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this._subscribed = true;
          this._reconnectAttempts = 0;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this._subscribed = false;
          supabase.removeChannel(this._channel);
          this._channel = null;
          const delay = nextReconnectDelay(this._reconnectAttempts++);
          clearTimeout(this._reconnectTimer);
          this._reconnectTimer = setTimeout(() => this._ensureChannel(), delay);
        }
      });
  }

  _notify(data) {
    this._listeners.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.error('[RealtimeSync] listener error:', e);
      }
    });
  }

  // ─── Case & Contract Workflow Real-Time Sync ────────────────────────────────

  /**
   * Subscribe to real-time case, contract, timeline, deliverable, and notification updates.
   * @param {(payload: object) => void} cb
   * @returns {() => void} unsubscribe function
   */
  subscribeCaseWorkflow(cb) {
    if (typeof cb !== 'function') return () => {};
    if (!this._caseListeners) this._caseListeners = new Set();
    this._caseListeners.add(cb);
    this._ensureCaseChannel();
    return () => this._caseListeners?.delete(cb);
  }

  /**
   * Broadcast instant case/contract/deliverable workflow updates across all open tabs/users.
   */
  async broadcastCaseChange(data = {}) {
    const payload = {
      source: 'broadcast_case',
      timestamp: Date.now(),
      caseId: data.caseId ?? null,
      contractId: data.contractId ?? null,
      action: data.action ?? 'UPDATE',
      ...data,
    };

    this._notifyCases(payload);

    if (this._caseChannel && this._caseSubscribed) {
      await this._caseChannel
        .send({ type: 'broadcast', event: 'CASE_WORKFLOW_UPDATE', payload })
        .catch((err) => console.warn('[RealtimeSync] case broadcast send error:', err));
    }
  }

  _ensureCaseChannel() {
    if (this._caseSubscribed && this._caseChannel) return;
    if (this._caseChannel) return; // already connecting

    if (!this._caseListeners) this._caseListeners = new Set();

    this._caseChannel = supabase
      .channel('lc_case_workflow_sync_v1', {
        config: {
          broadcast: { self: true },
        },
      })
      .on('broadcast', { event: 'CASE_WORKFLOW_UPDATE' }, ({ payload }) => {
        this._notifyCases({ source: 'broadcast', ...payload });
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cases' },
        (payload) => this._notifyCases({ source: 'cdc_cases', table: 'cases', payload })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contracts' },
        (payload) => this._notifyCases({ source: 'cdc_contracts', table: 'contracts', payload })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contract_timeline' },
        (payload) => this._notifyCases({ source: 'cdc_timeline', table: 'contract_timeline', payload })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deliverables' },
        (payload) => this._notifyCases({ source: 'cdc_deliverables', table: 'deliverables', payload })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'case_milestones' },
        (payload) => this._notifyCases({ source: 'cdc_milestones', table: 'case_milestones', payload })
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this._caseSubscribed = true;
          this._caseReconnectAttempts = 0;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this._caseSubscribed = false;
          if (this._caseChannel) {
            supabase.removeChannel(this._caseChannel);
            this._caseChannel = null;
          }
          const delay = nextReconnectDelay(this._caseReconnectAttempts++);
          clearTimeout(this._caseReconnectTimer);
          this._caseReconnectTimer = setTimeout(() => this._ensureCaseChannel(), delay);
        }
      });
  }

  _notifyCases(data) {
    if (!this._caseListeners) return;
    this._caseListeners.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.error('[RealtimeSync] case listener error:', e);
      }
    });
  }
}

export const realtimeSync = new RealtimeSyncService();
export default realtimeSync;
