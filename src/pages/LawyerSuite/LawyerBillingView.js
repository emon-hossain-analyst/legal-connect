import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';

const LawyerBillingView = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({ total_earnings: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchBillingData();

    const channel = supabase
      .channel('lawyer_billing_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchBillingData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lawyer_payouts' }, () => fetchBillingData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const currentUserId = user?.id;
      if (!currentUserId) {
        setTransactions([]);
        setStats({ total_earnings: 0, pending: 0, platform_fee: 0 });
        setLoading(false);
        return;
      }

      // Query payments table first
      let paymentsList = [];
      try {
        const { data: payData } = await supabase
          .from('payments')
          .select('*, client:users!payments_client_id_fkey(name, email)')
          .eq('lawyer_id', currentUserId)
          .order('created_at', { ascending: false });
        if (payData) paymentsList = payData;
      } catch (e) {}

      // Fallback or combine with billing_invoices
      let invoicesList = [];
      try {
        const { data: invData } = await supabase
          .from('billing_invoices')
          .select('*')
          .eq('lawyer_id', currentUserId)
          .order('created_at', { ascending: false });
        if (invData) invoicesList = invData;
      } catch (e2) {}

      const combined = [
        ...paymentsList.map(p => ({
          id: p.id,
          created_at: p.created_at,
          client_name: p.client?.name || p.client?.email || 'Client Consultation',
          amount: p.amount,
          lawyer_payout: p.lawyer_payout || p.amount,
          commission_amount: p.commission_amount || 0,
          status: p.status || 'completed',
          reference_number: p.reference_number
        })),
        ...invoicesList.map(i => ({
          id: i.id,
          created_at: i.created_at,
          client_name: i.client?.name || i.client_name || 'Legal Service Invoice',
          amount: i.amount,
          lawyer_payout: i.amount,
          commission_amount: 0,
          status: i.status || 'pending',
          reference_number: `INV-${i.id?.toString().slice(0, 6)}`
        }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setTransactions(combined);

      const paidSum = combined
        .filter(t => t.status === 'completed' || t.status === 'released' || t.status === 'paid')
        .reduce((sum, t) => sum + Number(t.lawyer_payout || 0), 0);
      const pendingSum = combined
        .filter(t => t.status === 'pending')
        .reduce((sum, t) => sum + Number(t.lawyer_payout || 0), 0);
      const commSum = combined
        .reduce((sum, t) => sum + Number(t.commission_amount || 0), 0);

      setStats({
        total_earnings: paidSum,
        pending: pendingSum,
        platform_fee: commSum
      });
    } catch (err) {
      console.error('Error fetching billing data:', err);
      setTransactions([]);
      setStats({ total_earnings: 0, pending: 0, platform_fee: 0 });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading billing data...</div>;

  return (
    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-surface-container-lowest">
      <div className="mb-8 animate-fadeIn">
        <h2 className="font-serif text-[32px] font-bold text-[#041635] mb-2">Billing & Invoices</h2>
        <p className="text-gray-600 text-[15px] max-w-xl">
          Track your earnings, manage invoices, and view payment history.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-fadeIn">
        <div className="bg-white p-6 rounded-lg border border-[#D0D7E3] shadow-sm">
          <p className="text-sm font-bold text-gray-500 uppercase">Net Payout Earnings</p>
          <h3 className="text-3xl font-serif font-bold text-[#041635] mt-2">BDT {stats.total_earnings.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-6 rounded-lg border border-[#D0D7E3] shadow-sm">
          <p className="text-sm font-bold text-gray-500 uppercase">Platform Fee Deducted</p>
          <h3 className="text-3xl font-serif font-bold text-gray-600 mt-2">BDT {(stats.platform_fee || 0).toLocaleString()}</h3>
        </div>
        <div className="bg-white p-6 rounded-lg border border-[#D0D7E3] shadow-sm">
          <p className="text-sm font-bold text-gray-500 uppercase">Pending Payments</p>
          <h3 className="text-3xl font-serif font-bold text-orange-600 mt-2">BDT {stats.pending.toLocaleString()}</h3>
        </div>
      </div>

      <h3 className="font-serif text-2xl font-bold text-[#041635] mb-4 animate-fadeIn">Transaction History</h3>

      <div className="space-y-4 animate-fadeIn">
        {transactions.length === 0 ? (
          <div className="bg-white p-8 rounded-lg border border-[#D0D7E3] text-center text-gray-500 shadow-sm">
            <span className="material-symbols-outlined text-4xl mb-4 text-gray-300">receipt_long</span>
            <h3 className="text-xl font-bold text-gray-700 mb-2">No Transactions Yet</h3>
            <p>Your financial overview and invoices will appear here once you complete consultations or receive payments.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-[#D0D7E3] shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-[#D0D7E3]">
                <tr>
                  <th className="p-4 text-sm font-bold text-gray-600">Date</th>
                  <th className="p-4 text-sm font-bold text-gray-600">Client / Ref</th>
                  <th className="p-4 text-sm font-bold text-gray-600">Gross Fee</th>
                  <th className="p-4 text-sm font-bold text-gray-600">Platform Fee</th>
                  <th className="p-4 text-sm font-bold text-gray-600">Net Payout</th>
                  <th className="p-4 text-sm font-bold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="p-4 text-sm text-gray-700">{new Date(tx.created_at).toLocaleDateString()}</td>
                    <td className="p-4 text-sm">
                      <div className="font-bold text-[#041635]">{tx.client_name}</div>
                      {tx.reference_number && <div className="text-[11px] text-gray-400 font-mono">{tx.reference_number}</div>}
                    </td>
                    <td className="p-4 text-sm font-bold text-gray-700">BDT {Number(tx.amount || 0).toFixed(2)}</td>
                    <td className="p-4 text-sm text-red-600">-BDT {Number(tx.commission_amount || 0).toFixed(2)}</td>
                    <td className="p-4 text-sm font-bold text-green-700">BDT {Number(tx.lawyer_payout || tx.amount || 0).toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs font-bold uppercase rounded-full ${tx.status === 'completed' || tx.status === 'released' || tx.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LawyerBillingView;
