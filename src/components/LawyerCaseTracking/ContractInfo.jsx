import React from 'react';
import CaseStatusBadge from './CaseStatusBadge';

const ContractInfo = ({ contract, agreedFee = 0 }) => {
  if (!contract && !agreedFee) {
    return (
      <div className="bg-white rounded-2xl border border-border-subtle p-6 shadow-xs text-center space-y-3">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
          📜
        </div>
        <div>
          <h4 className="font-bold text-navy-primary text-sm">No Formal Contract Attached Yet</h4>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            This matter is currently operating under standard platform consultation terms. Issue or link a contract to enforce milestone payments.
          </p>
        </div>
      </div>
    );
  }

  const contractId = contract?.id ? `#CNT-${String(contract.id).slice(0, 8).toUpperCase()}` : '#CNT-STANDARD';
  const signedDate = contract?.updated_at || contract?.created_at
    ? new Date(contract.updated_at || contract.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Not Executed';

  const status = contract?.status || 'Active';
  const paymentTerms = contract?.payment_terms || 'Milestone Retainer (Secure Escrow)';
  const totalAmount = Number(contract?.amount || contract?.agreed_amount || agreedFee || 0);
  const remainingBalance = Number(contract?.outstanding_balance !== undefined ? contract.outstanding_balance : 0);

  const handleDownloadContract = () => {
    // Generate text or trigger download
    const content = `LEGALCONNECT CONTRACT SUMMARY\n===============================\nContract ID: ${contractId}\nStatus: ${status}\nSigned Date: ${signedDate}\nPayment Terms: ${paymentTerms}\nTotal Fee: BDT ${totalAmount}\nRemaining Balance: BDT ${remainingBalance}\n\nThis document verifies the binding legal representation terms registered in LegalConnect Supabase database.`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Contract_${contractId.replace('#', '')}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-2xl border border-border-subtle p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
        <h4 className="font-serif font-bold text-base text-navy-primary flex items-center gap-2">
          <span>📜</span>
          <span>Contract Details & Terms</span>
        </h4>
        <CaseStatusBadge status={status} size="sm" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="bg-bg-light/60 p-3 rounded-xl border border-border-subtle/80">
          <span className="text-[11px] uppercase font-bold text-text-muted block">Contract ID</span>
          <span className="font-mono font-bold text-navy-primary text-sm mt-0.5 block">{contractId}</span>
        </div>

        <div className="bg-bg-light/60 p-3 rounded-xl border border-border-subtle/80">
          <span className="text-[11px] uppercase font-bold text-text-muted block">Signed / Effective Date</span>
          <span className="font-bold text-navy-primary text-sm mt-0.5 block">{signedDate}</span>
        </div>

        <div className="bg-bg-light/60 p-3 rounded-xl border border-border-subtle/80 sm:col-span-2">
          <span className="text-[11px] uppercase font-bold text-text-muted block">Payment Terms & Schedule</span>
          <span className="font-bold text-navy-primary text-sm mt-0.5 block">{paymentTerms}</span>
        </div>

        <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
          <span className="text-[11px] uppercase font-bold text-emerald-800 block">Total Agreed Retainer</span>
          <span className="font-black text-emerald-900 text-base mt-0.5 block">
            BDT {totalAmount.toLocaleString()}
          </span>
        </div>

        <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200">
          <span className="text-[11px] uppercase font-bold text-amber-800 block">Remaining Balance</span>
          <span className="font-black text-amber-900 text-base mt-0.5 block">
            BDT {remainingBalance.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={handleDownloadContract}
          className="w-full sm:w-auto px-4 py-2.5 bg-navy-primary hover:bg-navy-secondary text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">download</span>
          <span>Download Contract Summary</span>
        </button>
      </div>
    </div>
  );
};

export default ContractInfo;
