/**
 * Payment Service Module — LegalConnect
 * 
 * Handles simulated payments and commission calculations.
 * Designed as a standalone module so a real gateway (SSLCommerz/Stripe)
 * can replace only this file later without touching any other code.
 */
import { supabase } from './supabase';

/**
 * Get the current platform commission config from the database.
 * Never hardcodes the rate — always reads from platform_commission_config.
 */
export const getCommissionConfig = async () => {
  const { data, error } = await supabase
    .from('platform_commission_config')
    .select('*')
    .eq('id', 1)
    .single();

  if (error || !data) {
    console.error('Failed to fetch commission config:', error);
    return { commission_percentage: 10.00 }; // Safe fallback, but DB is source of truth
  }
  return data;
};

/**
 * Generate a unique reference number for a payment.
 */
const generateReferenceNumber = () => {
  const prefix = 'LC';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

/**
 * Simulate a payment (no real gateway).
 * 
 * The commission math happens in the PostgreSQL trigger (handle_payment_insert_completed),
 * NOT here. This function just inserts the payment record with status 'completed'.
 * 
 * @param {Object} params
 * @param {string} params.client_id - UUID of the paying client
 * @param {string} params.lawyer_id - UUID of the receiving lawyer
 * @param {number} params.amount - Total consultation fee amount
 * @param {string} [params.appointment_id] - UUID of the appointment (optional)
 * @param {string} [params.case_id] - UUID of the case (optional)
 * @param {string} [params.payment_method] - e.g. 'simulated', 'bkash', 'card'
 * 
 * @returns {Object} { success, payment, error }
 */
export const simulatePayment = async ({
  client_id,
  lawyer_id,
  amount,
  appointment_id = null,
  case_id = null,
  payment_method = 'simulated'
}) => {
  try {
    if (!client_id || !lawyer_id || !amount || amount <= 0) {
      return { success: false, payment: null, error: 'Invalid payment parameters' };
    }

    const reference_number = generateReferenceNumber();

    // Insert payment as completed — the DB trigger handles commission calculation
    const { data, error } = await supabase
      .from('payments')
      .insert([{
        client_id,
        lawyer_id,
        appointment_id,
        case_id,
        amount: parseFloat(amount),
        payment_method,
        status: 'completed',
        reference_number,
      }])
      .select()
      .single();

    if (error) {
      console.error('Payment insert error:', error);
      return { success: false, payment: null, error: error.message };
    }

    return { success: true, payment: data, error: null };
  } catch (err) {
    console.error('Payment service error:', err);
    return { success: false, payment: null, error: err.message };
  }
};

/**
 * Get payment receipt data for a completed payment.
 */
export const getPaymentReceipt = async (paymentId) => {
  const { data, error } = await supabase
    .from('payments')
    .select('*, client:users!payments_client_id_fkey(name, email), lawyer:users!payments_lawyer_id_fkey(name, email)')
    .eq('id', paymentId)
    .single();

  if (error) {
    console.error('Failed to fetch receipt:', error);
    return null;
  }
  return data;
};

/**
 * Get lawyer's earnings summary from lawyer_payouts table.
 */
export const getLawyerEarnings = async (lawyerId) => {
  const { data, error } = await supabase
    .from('lawyer_payouts')
    .select('*')
    .eq('lawyer_id', lawyerId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch lawyer earnings:', error);
    return { total_earned: 0, pending_payout: 0 };
  }

  return data || { total_earned: 0, pending_payout: 0 };
};

/**
 * Update the platform commission percentage (admin only).
 */
export const updateCommissionRate = async (newRate, adminId) => {
  const { data, error } = await supabase
    .from('platform_commission_config')
    .update({
      commission_percentage: parseFloat(newRate),
      updated_at: new Date().toISOString(),
      updated_by: adminId
    })
    .eq('id', 1)
    .select()
    .single();

  if (error) {
    console.error('Failed to update commission rate:', error);
    return { success: false, error: error.message };
  }
  return { success: true, data };
};
