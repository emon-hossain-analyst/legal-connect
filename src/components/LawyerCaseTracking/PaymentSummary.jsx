import React from 'react';

const PaymentSummary = ({ caseData, payments = [] }) => {
  const agreedFee = Number(
    caseData?.contract?.amount ||
    caseData?.contract?.agreed_amount ||
    caseData?.agreed_fee ||
    0
  );

  // Calculate actual paid from payment records or contract balance
  let paidAmount = 0;
  if (Array.isArray(payments) && payments.length > 0) {
    paidAmount = payments
      .filter((p) => String(p.status).toLowerCase() === 'paid' || String(p.status).toLowerCase() === 'completed')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  } else if (caseData?.contract?.outstanding_balance !== undefined) {
    const balance = Number(caseData.contract.outstanding_balance || 0);
    paidAmount = Math.max(0, agreedFee - balance);
  } else if (caseData?.payment_status === 'paid' || caseData?.contract?.status === 'active') {
    paidAmount = agreedFee;
  }

  const pendingAmount = Math.max(0, agreedFee - paidAmount);

  // Platform fee (Standard 10% for escrow assurance)
  const platformFeeRate = 0.10;
  const platformFee = Math.round(agreedFee * platformFeeRate);
  const netEarnings = Math.max(0, agreedFee - platformFee);

  return (
    <div className="bg-white rounded-2xl border border-border-subtle p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
        <h4 className="font-serif font-bold text-base text-navy-primary flex items-center gap-2">
          <span>💳</span>
          <span>Financials & Earnings Breakdown</span>
        </h4>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
          Escrow Protected
        </span>
      </div>

      <div className="space-y-2.5 text-xs">
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-bg-light/70 border border-border-subtle/60">
          <span className="font-bold text-gray-600">Total Agreed Retainer Fee</span>
          <span className="font-black text-navy-primary text-sm">
            BDT {agreedFee.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
          <span className="font-bold text-emerald-800">Amount Received / Paid in Escrow</span>
          <span className="font-black text-emerald-900 text-sm">
            BDT {paidAmount.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80">
          <span className="font-bold text-amber-800">Pending / Outstanding Balance</span>
          <span className="font-black text-amber-900 text-sm">
            BDT {pendingAmount.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-200/80">
          <span className="font-bold text-gray-600 flex items-center gap-1">
            <span>Platform Service Fee (10%)</span>
            <span className="text-[10px] text-text-muted">(Security & Escrow)</span>
          </span>
          <span className="font-semibold text-gray-700">
            - BDT {platformFee.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-navy-primary text-white shadow-xs mt-2">
          <span className="font-bold text-sm tracking-wide">Net Advocate Earnings</span>
          <span className="font-black text-accent-gold text-base">
            BDT {netEarnings.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PaymentSummary;
