import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle2, XCircle, ChevronDown, ChevronUp, Clock, ArrowRight, X, Timer, Eye, FileX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useEffect } from 'react';
import InvoiceDocViewer from '@/components/payment/chatbot-tabs/InvoiceDocViewer';

const currencySymbols = { ILS: '₪', USD: '$', EUR: '€' };

const STATUS_CONFIG = {
  pending: { label: 'Pending', bg: 'bg-yellow-50 border-yellow-300', badge: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: Clock },
  approved: { label: 'Approved', bg: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  rejected: { label: 'Rejected', bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
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
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${
      isExpired ? 'bg-red-100 border-red-300 text-red-600' :
      isUrgent ? 'bg-orange-100 border-orange-300 text-orange-600' :
      'bg-blue-100 border-blue-300 text-blue-600'
    }`}>
      <Timer className="w-2.5 h-2.5" />
      {isExpired ? 'Expired' : `${mins}:${String(secs).padStart(2, '0')}`}
    </span>
  );
}

function ApprovalRow({ approval, onApprove, onReject, onDismiss }) {
  const [expanded, setExpanded] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [viewingDoc, setViewingDoc] = useState(null); // { fileUrl, invoiceNumber }
  const [noDocInvoice, setNoDocInvoice] = useState(null); // invoice number with no doc
  const cfg = STATUS_CONFIG[approval.status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;

  const totals = {};
  (approval.invoice_details || []).forEach(inv => {
    const cur = inv.payment_currency || inv.currency;
    const amt = inv.payment_amount || inv.amount;
    totals[cur] = (totals[cur] || 0) + amt;
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`rounded-xl border-2 shadow-sm overflow-hidden ${cfg.bg}`}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          approval.status === 'pending' ? 'bg-yellow-100' :
          approval.status === 'approved' ? 'bg-emerald-100' : 'bg-red-100'
        }`}>
          <Icon className={`w-4 h-4 ${
            approval.status === 'pending' ? 'text-yellow-600' :
            approval.status === 'approved' ? 'text-emerald-600' : 'text-red-600'
          }`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{approval.requester_name || 'User'}</span>
            <Badge className={`text-[10px] border px-1.5 py-0 ${cfg.badge}`}>
              {cfg.label}
            </Badge>
            {approval.status === 'pending' && (
              <CountdownTimer startDate={approval.created_date} />
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="text-xs text-muted-foreground">
              {approval.invoice_ids?.length || 0} invoice{approval.invoice_ids?.length !== 1 ? 's' : ''} · {approval.created_date ? format(new Date(approval.created_date), 'MMM d, HH:mm') : ''}
            </span>
            <div className="flex items-center gap-1">
              {Object.entries(totals).map(([cur, amt]) => (
                <span key={cur} className="text-xs font-bold">
                  {currencySymbols[cur]}{amt.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {cur}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {approval.status === 'pending' && (
            <>
              <Button size="sm" className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => onApprove(approval)}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => { setShowReject(true); setExpanded(true); }}>
                <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
              </Button>
            </>
          )}
          <button onClick={() => setExpanded(e => !e)}
            className="p-1 rounded-lg hover:bg-black/5 transition-colors text-muted-foreground">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {approval.status !== 'pending' && (
            <button onClick={() => onDismiss(approval.id)}
              className="p-1 rounded-lg hover:bg-black/5 transition-colors text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-black/5"
          >
            <div className="px-4 py-3 space-y-3 bg-white/50">
              {approval.notes_to_approver && (
                <div className="p-2.5 rounded-lg bg-muted/60 border border-border text-xs">
                  <span className="font-semibold">Note: </span>{approval.notes_to_approver}
                </div>
              )}

              <div className="space-y-1.5">
                {(approval.invoice_details || []).map((inv, i) => {
                  const hasFx = inv.payment_currency && inv.payment_currency !== inv.currency;
                  const payAmt = inv.payment_amount || inv.amount;
                  const invoiceId = approval.invoice_ids?.[i];
                  return (
                    <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white border border-border">
                      <div>
                        <span className="font-semibold">{inv.supplier_name}</span>
                        <span className="text-muted-foreground ml-1">#{inv.invoice_number}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">{currencySymbols[inv.currency]}{inv.amount?.toLocaleString()}</span>
                          {hasFx && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
                          <span className="font-semibold">
                            {hasFx && `${currencySymbols[inv.payment_currency]}`}{payAmt?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {inv.payment_currency || inv.currency}
                          </span>
                        </div>
                        <div className="relative">
                          <button
                            onClick={async () => {
                              const entityName = approval.entity_name || 'Invoice4';
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
                  );
                })}
              </div>

              {approval.rejection_note && (
                <div className="text-xs p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700">
                  <span className="font-semibold">Rejection note: </span>{approval.rejection_note}
                </div>
              )}

              {showReject && approval.status === 'pending' && (
                <div className="space-y-2 pt-1">
                <textarea
                  className={`w-full text-xs border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none bg-white ${
                    rejectNote.trim() === '' && rejectNote !== '' ? 'border-red-400' : rejectNote.trim() === '' ? 'border-input' : 'border-input'
                  }`}
                  rows={2}
                  placeholder="Reason for rejection (required)..."
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                  autoFocus
                />
                {rejectNote === '' && (
                  <p className="text-[10px] text-red-500">A rejection reason is required before confirming.</p>
                )}
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs h-7 disabled:opacity-50"
                    disabled={!rejectNote.trim()}
                    onClick={() => { if (rejectNote.trim()) { onReject(approval, rejectNote); setShowReject(false); } }}>
                    Confirm Reject
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setShowReject(false)}>Cancel</Button>
                </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {viewingDoc && (
        <InvoiceDocViewer
          fileUrl={viewingDoc.fileUrl}
          invoiceNumber={viewingDoc.invoiceNumber}
          onClose={() => setViewingDoc(null)}
        />
      )}
    </motion.div>
  );
}

export default function ApprovalNotificationBanner() {
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_approvals') || '[]'); } catch { return []; }
  });
  const [showAll, setShowAll] = useState(false);

  const { data: approvals = [] } = useQuery({
    queryKey: ['payment_approvals'],
    queryFn: () => api.entities.PaymentApproval.list('-created_date', 50),
    refetchInterval: 30000,
  });

  const updateApproval = useMutation({
    mutationFn: ({ id, data }) => api.entities.PaymentApproval.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment_approvals'] }),
  });

  const handleApprove = async (approval) => {
    const entityName = approval.entity_name || 'Invoice4';
    for (const id of (approval.invoice_ids || [])) {
      await api.entities[entityName].update(id, { status: 'pending' });
    }
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['invoices3'] });
    queryClient.invalidateQueries({ queryKey: ['invoices4'] });
    updateApproval.mutate({ id: approval.id, data: { status: 'approved' } });
  };

  const handleReject = async (approval, note) => {
    const entityName = approval.entity_name || 'Invoice4';
    for (const id of (approval.invoice_ids || [])) {
      await api.entities[entityName].update(id, { status: 'not_approved' });
    }
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['invoices3'] });
    queryClient.invalidateQueries({ queryKey: ['invoices4'] });
    updateApproval.mutate({ id: approval.id, data: { status: 'rejected', rejection_note: note } });
  };

  const handleDismiss = (id) => {
    const updated = [...dismissed, id];
    setDismissed(updated);
    localStorage.setItem('dismissed_approvals', JSON.stringify(updated));
  };

  // Always show pending; show resolved only if not dismissed
  const pending = approvals.filter(a => a.status === 'pending');
  const resolved = approvals.filter(a => a.status !== 'pending' && !dismissed.includes(a.id));

  const visible = showAll ? [...pending, ...resolved] : pending;

  if (approvals.length === 0) return null;

  return (
    <div className="px-4 md:px-6 pt-4 space-y-2">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`relative p-1.5 rounded-lg ${pending.length > 0 ? 'bg-yellow-100' : 'bg-muted'}`}>
            <Bell className={`w-4 h-4 ${pending.length > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`} />
            {pending.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {pending.length}
              </span>
            )}
          </div>
          <div>
            <span className="text-sm font-semibold">Payment Approvals</span>
            {pending.length > 0 && (
              <span className="ml-2 text-xs text-yellow-600 font-medium animate-pulse">{pending.length} pending</span>
            )}
          </div>
        </div>
        {resolved.length > 0 && (
          <button onClick={() => setShowAll(s => !s)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            {showAll ? 'Hide resolved' : `Show ${resolved.length} resolved`}
            {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Approval cards */}
      <AnimatePresence mode="popLayout">
        {visible.map(approval => (
          <ApprovalRow
            key={approval.id}
            approval={approval}
            onApprove={handleApprove}
            onReject={handleReject}
            onDismiss={handleDismiss}
          />
        ))}
      </AnimatePresence>

      {pending.length === 0 && visible.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
          <CheckCircle2 className="w-4 h-4" /> All caught up — no pending approvals
        </motion.div>
      )}
    </div>
  );
}