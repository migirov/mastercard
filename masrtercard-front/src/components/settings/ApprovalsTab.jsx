import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, TrendingUp, Timer, ArrowRight, Eye, FileX } from 'lucide-react';
import InvoiceDocViewer from '@/components/payment/chatbot-tabs/InvoiceDocViewer';
import { format } from 'date-fns';

const BOI_RATES = { USD: { rate: 3.618 }, EUR: { rate: 4.098 } };
const currencySymbols = { ILS: '₪', USD: '$', EUR: '€' };

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
};

function CountdownTimer({ startDate }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const end = new Date(startDate).getTime() + 15 * 60 * 1000;
    const calc = () => Math.max(0, Math.floor((end - Date.now()) / 1000));
    setRemaining(calc());
    const interval = setInterval(() => setRemaining(calc()), 1000);
    return () => clearInterval(interval);
  }, [startDate]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isExpired = remaining === 0;
  const isUrgent = remaining < 120;

  return (
    <div className={`flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full border ${
      isExpired ? 'bg-red-50 border-red-200 text-red-600' :
      isUrgent ? 'bg-orange-50 border-orange-200 text-orange-600' :
      'bg-blue-50 border-blue-200 text-blue-600'
    }`}>
      <Timer className="w-3 h-3" />
      {isExpired ? 'Quote expired' : `${mins}:${String(secs).padStart(2, '0')}`}
    </div>
  );
}

function calcPaymentAmt(inv) {
  if (!inv.payment_currency || inv.payment_currency === inv.currency) return { rate: 1, payAmt: inv.payment_amount || inv.amount };
  const spread = 0.005;
  let midRate;
  if (inv.currency !== 'ILS' && inv.payment_currency === 'ILS') {
    midRate = BOI_RATES[inv.currency]?.rate || 1;
  } else if (inv.currency === 'ILS' && inv.payment_currency !== 'ILS') {
    midRate = 1 / (BOI_RATES[inv.payment_currency]?.rate || 1);
  } else {
    const from = BOI_RATES[inv.currency]?.rate || 1;
    const to = BOI_RATES[inv.payment_currency]?.rate || 1;
    midRate = from / to;
  }
  const bankRate = midRate * (1 - spread);
  return { rate: bankRate, payAmt: inv.fx_rate ? (inv.amount * inv.fx_rate * (1 - spread)) : (inv.amount * bankRate) };
}

function ApprovalCard({ approval, onApprove, onReject }) {
  const [expanded, setExpanded] = useState(approval.status === 'pending');
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [noDocInvoice, setNoDocInvoice] = useState(null);

  const cfg = STATUS_CONFIG[approval.status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;

  // Group totals by payment_currency
  const totals = {};
  (approval.invoice_details || []).forEach(inv => {
    const cur = inv.payment_currency || inv.currency;
    const amt = inv.payment_amount || inv.amount;
    totals[cur] = (totals[cur] || 0) + amt;
  });

  return (
    <Card className={`p-3 ${approval.status === 'pending' ? 'border-yellow-300' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{approval.requester_name || 'User'}</span>
            <Badge className={`text-[10px] border ${cfg.color}`}>
              <Icon className="w-3 h-3 mr-1" />{cfg.label}
            </Badge>
            {approval.status === 'pending' && (
              <CountdownTimer startDate={approval.created_date} />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Approver: {approval.approver_name || '—'} · {approval.invoice_ids?.length || 0} invoice{approval.invoice_ids?.length !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-muted-foreground">{approval.created_date ? format(new Date(approval.created_date), 'MMM d, HH:mm') : ''}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setExpanded(e => !e)}>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Notes to approver */}
          {approval.notes_to_approver && (
            <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Notes from requester</p>
              <p className="text-xs">{approval.notes_to_approver}</p>
            </div>
          )}

          {/* Invoice lines with FX */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Payment Details (Actual FX Quote)
            </p>
            <div className="space-y-1.5">
              {(approval.invoice_details || []).map((inv, i) => {
                const hasFx = inv.payment_currency && inv.payment_currency !== inv.currency;
                const payAmt = inv.payment_amount || inv.amount;
                const invoiceId = approval.invoice_ids?.[i];
                return (
                  <div key={i} className="p-2.5 rounded-lg bg-muted/30 border border-border text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">{inv.supplier_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">#{inv.invoice_number}</span>
                        <div className="relative">
                          <button
                            onClick={async () => {
                              const entityName = approval.entity_name || 'Invoice';
                              const record = await api.entities[entityName].get(invoiceId);
                              if (record?.file_url) {
                                setViewingDoc({ fileUrl: record.file_url, invoiceNumber: inv.invoice_number });
                              } else {
                                setNoDocInvoice(inv.invoice_number);
                                setTimeout(() => setNoDocInvoice(null), 3000);
                              }
                            }}
                            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="View invoice document"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {noDocInvoice === inv.invoice_number && (
                            <div className="absolute bottom-full right-0 mb-1 whitespace-nowrap bg-gray-800 text-white text-[10px] px-2 py-1 rounded-lg flex items-center gap-1 z-50 shadow-lg">
                              <FileX className="w-3 h-3" /> No document attached
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Invoice: {currencySymbols[inv.currency]}{inv.amount?.toLocaleString()}</span>
                      {hasFx ? (
                        <div className="flex items-center gap-1 text-blue-600 font-medium">
                          <ArrowRight className="w-3 h-3" />
                          <span>Pay: {currencySymbols[inv.payment_currency]}{payAmt?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      ) : (
                        <span className="font-medium">Pay: {currencySymbols[inv.payment_currency || inv.currency]}{payAmt?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      )}
                    </div>
                    {hasFx && inv.fx_rate && (
                      <div className="text-[10px] text-muted-foreground">
                        Rate: 1 {inv.currency} = {currencySymbols[inv.payment_currency]}{(inv.fx_rate * 0.995).toFixed(4)} {inv.payment_currency} (incl. spread)
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals per currency */}
          <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Total to be paid</p>
            {Object.entries(totals).map(([cur, amt]) => (
              <div key={cur} className="flex justify-between text-sm font-bold">
                <span>{cur}</span>
                <span>{currencySymbols[cur]}{amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>

          {approval.rejection_note && (
            <div className="text-xs p-2 rounded bg-red-50 border border-red-200 text-red-700">
              Rejection note: {approval.rejection_note}
            </div>
          )}

          {approval.status === 'pending' && (
            <div className="flex gap-2 pt-1">
              {!showRejectInput ? (
                <>
                  <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onApprove(approval)}>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50" onClick={() => setShowRejectInput(true)}>
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                  </Button>
                </>
              ) : (
                <div className="w-full space-y-2">
                  <textarea
                    className="w-full text-xs border border-input rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    rows={3}
                    placeholder="Reason for rejection (free text)..."
                    value={rejectNote}
                    onChange={e => setRejectNote(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={() => { onReject(approval, rejectNote); setShowRejectInput(false); }}>
                      Confirm Reject
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowRejectInput(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {viewingDoc && (
        <InvoiceDocViewer
          fileUrl={viewingDoc.fileUrl}
          invoiceNumber={viewingDoc.invoiceNumber}
          onClose={() => setViewingDoc(null)}
        />
      )}
    </Card>
  );
}

export default function ApprovalsTab() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('pending');

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ['payment_approvals'],
    queryFn: () => api.entities.PaymentApproval.list('-created_date', 50),
  });

  const updateApproval = useMutation({
    mutationFn: ({ id, data }) => api.entities.PaymentApproval.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment_approvals'] }),
  });

  const handleApprove = async (approval) => {
    const entityName = approval.entity_name || 'Invoice4';
    // Update invoices to 'pending'
    for (const id of (approval.invoice_ids || [])) {
      await api.entities[entityName].update(id, { status: 'pending' });
    }
    queryClient.invalidateQueries({ queryKey: [`invoices${entityName.replace('Invoice', '')}`] });
    updateApproval.mutate({ id: approval.id, data: { status: 'approved' } });
  };

  const handleReject = async (approval, note) => {
    const entityName = approval.entity_name || 'Invoice4';
    // Update invoices to 'not_approved'
    for (const id of (approval.invoice_ids || [])) {
      await api.entities[entityName].update(id, { status: 'not_approved' });
    }
    queryClient.invalidateQueries({ queryKey: [`invoices${entityName.replace('Invoice', '')}`] });
    updateApproval.mutate({ id: approval.id, data: { status: 'rejected', rejection_note: note } });
  };

  const filtered = approvals.filter(a => filter === 'all' || a.status === filter);
  const pendingCount = approvals.filter(a => a.status === 'pending').length;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div>
          <h3 className="font-bold text-sm flex items-center gap-2">
            Payment Approvals
            {pendingCount > 0 && (
              <span className="bg-yellow-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">{pendingCount}</span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground">FX quote valid for 15 minutes from submission</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {['pending', 'approved', 'rejected', 'all'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 text-xs py-1 rounded-md font-medium transition-all ${filter === f ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'pending' && pendingCount > 0 && ` (${pendingCount})`}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
        ) : filtered.length === 0 ? (
          <Card className="p-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No {filter === 'all' ? '' : filter} approvals</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(a => (
              <ApprovalCard key={a.id} approval={a} onApprove={handleApprove} onReject={handleReject} />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}