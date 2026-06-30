import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, AlertCircle, CheckCircle2, CreditCard, FileText, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { xbs } from '@/api/xbs';
import InvoiceStatusBadge from './InvoiceStatusBadge';
import RfiWorkflow from './RfiWorkflow';

const currencySymbols = { ILS: '₪', USD: '$', EUR: '€' };

/** Tiny live/demo badge for the `source` flag returned by /xbs/status. */
function SourceBadge({ source }) {
  if (!source) return null;
  const live = source === 'live';
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${live ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
      {live ? 'Live · Mastercard' : 'Demo'}
    </span>
  );
}

function InfoGrid({ children }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function InfoBox({ label, value, className = '', colSpan = false }) {
  return (
    <div className={`p-3 rounded-lg bg-muted/50 border border-border ${colSpan ? 'col-span-2' : ''}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-semibold text-sm mt-0.5 ${className}`}>{value || '—'}</p>
    </div>
  );
}

export default function StatusDrillDown({ invoice, onClose, onPay }) {
  const [tab, setTab] = useState('invoice');
  // Live payment status/timeline from the Mastercard gateway (/xbs/status), keyed by the
  // payment_ref captured at pay time. Demo mode returns a deterministic stage timeline; the
  // `source` flag shows whether it came from the live gateway.
  const [tracking, setTracking] = useState(null);
  useEffect(() => {
    const ref = invoice?.payment_ref || invoice?.invoice_number || invoice?.id;
    const isPaymentStatus = ['pending', 'processing', 'completed', 'partially_paid'].includes(invoice?.status);
    if (!ref || !isPaymentStatus) { setTracking(null); return; }
    let cancelled = false;
    xbs.status(ref)
      .then(r => { if (!cancelled && r?.history?.length) setTracking(r); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [invoice?.id, invoice?.status, invoice?.payment_ref]);

  if (!invoice) return null;

  const sym = currencySymbols;
  const isRejected = invoice.status === 'rejected';
  const isCompleted = invoice.status === 'completed';
  const isPending = invoice.status === 'pending';
  const isPartial = invoice.status === 'partially_paid';

  // Two-tab layout for rejected & completed & pending
  const showTabs = ['rejected', 'completed', 'pending', 'partially_paid', 'processing'].includes(invoice.status);

  const completedAt = invoice.completed_at ? new Date(invoice.completed_at) : null;
  const submittedAt = invoice.created_date ? new Date(invoice.created_date) : null;

  const renderInvoiceTab = () => (
    <div className="space-y-3">
      <InfoGrid>
        <InfoBox label="Supplier" value={invoice.supplier_name} />
        <InfoBox label="Invoice #" value={invoice.invoice_number} />
        <InfoBox label="Invoice Amount" value={`${sym[invoice.currency]}${invoice.amount?.toLocaleString()}`} className="font-bold" />
        <InfoBox label="Currency" value={invoice.currency} />
        <InfoBox label="Due Date" value={invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : null} />
        {invoice.beneficiary_account && (
          <InfoBox label="Beneficiary Account" value={invoice.beneficiary_account} colSpan className="font-mono text-xs" />
        )}
        {invoice.beneficiary_address && (
          <InfoBox label="Beneficiary Address" value={invoice.beneficiary_address} colSpan />
        )}
      </InfoGrid>
    </div>
  );

  const renderPaymentTab = () => {
    if (isRejected) {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <p className="text-sm text-red-700 font-medium">Payment was rejected</p>
          </div>
          <InfoGrid>
            <InfoBox
              label="Rejection Reason"
              value={invoice.rejection_reason || 'No reason provided — contact your payment provider'}
              colSpan
              className="text-red-700"
            />
            <InfoBox label="Payment Amount" value={invoice.payment_amount ? `${sym[invoice.payment_currency || invoice.currency]}${invoice.payment_amount?.toLocaleString()}` : `${sym[invoice.currency]}${invoice.amount?.toLocaleString()}`} />
            <InfoBox label="Submitted At" value={completedAt ? format(completedAt, 'MMM d, yyyy HH:mm') : null} />
          </InfoGrid>
          {onPay && (
            <Button className="w-full bg-primary hover:bg-primary/90 font-semibold" onClick={() => { onClose(); onPay(invoice); }}>
              <CreditCard className="w-4 h-4 mr-2" /> Resubmit Payment
            </Button>
          )}
        </div>
      );
    }

    if (isCompleted) {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-700 font-medium">Payment completed successfully</p>
          </div>
          <InfoGrid>
            <InfoBox label="Paid At" value={completedAt ? format(completedAt, 'MMM d, yyyy HH:mm') : null} className="text-emerald-700" />
            <InfoBox label="Processing Time" value={invoice.processing_time} className="text-blue-700" />
            <InfoBox label="Amount Paid" value={`${sym[invoice.payment_currency || invoice.currency]}${(invoice.payment_amount || invoice.amount)?.toLocaleString()}`} className="font-bold" />
            <InfoBox label="Transaction Fee" value={invoice.transaction_cost ? `$${invoice.transaction_cost}` : null} />
            {invoice.payment_currency && invoice.payment_currency !== invoice.currency && (
              <InfoBox label="FX Rate" value={`1 ${invoice.currency} = ${invoice.payment_currency === 'ILS' ? '₪' : invoice.payment_currency === 'USD' ? '$' : '€'}${invoice.fx_rate?.toFixed(4)} ${invoice.payment_currency}`} colSpan />
            )}
          </InfoGrid>
        </div>
      );
    }

    if (isPending) {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-50 border border-purple-200">
            <Clock className="w-4 h-4 text-purple-600 shrink-0" />
            <p className="text-sm text-purple-700 font-medium">Payment is being processed by the bank</p>
          </div>
          <InfoGrid>
            <InfoBox label="Payment Amount" value={`${sym[invoice.payment_currency || invoice.currency]}${(invoice.payment_amount || invoice.amount)?.toLocaleString()}`} />
            <InfoBox label="Submitted At" value={completedAt ? format(completedAt, 'MMM d, HH:mm') : null} />
            <InfoBox label="Est. Processing" value={invoice.processing_time || '5 min – 7 hours'} />
            <InfoBox label="Transaction Fee" value={invoice.transaction_cost ? `$${invoice.transaction_cost}` : null} />
            {invoice.fx_rate && invoice.payment_currency !== invoice.currency && (
              <InfoBox label="FX Rate" value={`1 ${invoice.currency} = ${invoice.payment_currency === 'ILS' ? '₪' : invoice.payment_currency === 'USD' ? '$' : '€'}${Number(invoice.fx_rate)?.toFixed(4)} ${invoice.payment_currency}`} colSpan />
            )}
          </InfoGrid>
        </div>
      );
    }

    if (isPartial) {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
            <CheckCircle2 className="w-4 h-4 text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-700 font-medium">Partial payment — balance outstanding</p>
          </div>
          <InfoGrid>
            <InfoBox label="Total Invoice" value={`${sym[invoice.currency]}${invoice.amount?.toLocaleString()}`} />
            <InfoBox label="Amount Paid" value={`${sym[invoice.payment_currency || invoice.currency]}${invoice.payment_amount?.toLocaleString()}`} className="text-accent" />
            <InfoBox label="Remaining Balance" value={`${sym[invoice.currency]}${(invoice.amount - invoice.payment_amount)?.toLocaleString()}`} className="text-orange-600 font-bold" />
            <InfoBox label="Paid At" value={completedAt ? format(completedAt, 'MMM d, HH:mm') : null} />
          </InfoGrid>
          {onPay && (
            <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold" onClick={() => { onClose(); onPay(invoice); }}>
              <CreditCard className="w-4 h-4 mr-2" /> Complete Payment
            </Button>
          )}
        </div>
      );
    }

    // processing
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
          <Clock className="w-4 h-4 text-blue-600 shrink-0" />
          <p className="text-sm text-blue-700 font-medium">Payment is being processed</p>
        </div>
        <InfoGrid>
          <InfoBox label="Payment Amount" value={`${sym[invoice.payment_currency || invoice.currency]}${(invoice.payment_amount || invoice.amount)?.toLocaleString()}`} />
          <InfoBox label="Submitted At" value={completedAt ? format(completedAt, 'MMM d, HH:mm') : null} />
        </InfoGrid>
      </div>
    );
  };

  const renderRfiContent = () => (
    <RfiWorkflow invoice={invoice} onAllResolved={onClose} />
  );

  const renderDefaultContent = () => (
    <InfoGrid>
      <InfoBox label="Amount" value={`${sym[invoice.currency]}${invoice.amount?.toLocaleString()}`} />
      <InfoBox label="Due Date" value={invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : null} />
    </InfoGrid>
  );

  // Real processing timeline from the gateway (/xbs/status). Each entry is a stage with a
  // timestamp; the badge shows live vs demo.
  const renderTimeline = () => (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        Processing timeline <SourceBadge source={tracking.source} />
        <span className="normal-case font-normal text-[10px] text-muted-foreground">via Mastercard gateway</span>
      </p>
      <div className="space-y-1.5">
        {tracking.history.map((h, i) => (
          <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/40 border border-border">
            <span className="font-medium capitalize">
              {h.status}{h.stage ? ` · ${String(h.stage).replace(/_/g, ' ')}` : ''}
            </span>
            <span className="text-muted-foreground">{format(new Date(h.timestamp), 'MMM d, HH:mm')}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card rounded-xl shadow-2xl border border-border max-w-lg w-full"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div>
              <h3 className="font-bold">{invoice.supplier_name}</h3>
              <p className="text-xs text-muted-foreground">Invoice #{invoice.invoice_number}</p>
            </div>
            <div className="flex items-center gap-3">
              <InvoiceStatusBadge status={invoice.status} />
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Tabs for statuses that have payment info */}
          {showTabs && (
            <div className="flex border-b border-border">
              <button
                onClick={() => setTab('invoice')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2 ${
                  tab === 'invoice' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Invoice
              </button>
              <button
                onClick={() => setTab('payment')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2 ${
                  tab === 'payment' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Banknote className="w-3.5 h-3.5" /> Payment
              </button>
            </div>
          )}

          <div className="p-5">
            {invoice.status === 'rfi' && renderRfiContent()}
            {!['rfi'].includes(invoice.status) && showTabs && (
              tab === 'invoice' ? renderInvoiceTab() : (
                <div className="space-y-4">
                  {renderPaymentTab()}
                  {tracking && renderTimeline()}
                </div>
              )
            )}
            {!showTabs && !['rfi'].includes(invoice.status) && renderDefaultContent()}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}