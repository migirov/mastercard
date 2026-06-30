import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Calendar, Building2, CreditCard, Hash, MapPin, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { safeHttpUrl } from '@/lib/utils';
import { format } from 'date-fns';
import InvoiceStatusBadge from './InvoiceStatusBadge';
import RfiWorkflow from './RfiWorkflow';

const currencySymbols = { ILS: '₪', USD: '$', EUR: '€' };

function Field({ label, value, icon: Icon }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
    </div>
  );
}

export default function InvoiceDetailDrawer({ invoice, onClose, onPay, isKybVerified }) {
  const [tab, setTab] = useState('details');
  if (!invoice) return null;

  const isRfi = invoice.status === 'rfi';
  const isPayable = ['unpaid', 'rfi', 'partially_paid'].includes(invoice.status);
  const sym = currencySymbols[invoice.currency] || '';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-card shadow-2xl border-l border-border flex flex-col"
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-base">{invoice.supplier_name}</h2>
                <p className="text-xs text-muted-foreground">#{invoice.invoice_number}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Amount hero */}
          <div className="px-5 py-4 bg-muted/30 border-b border-border flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Invoice Amount</p>
              <p className="text-3xl font-bold tabular-nums">{sym}{invoice.amount?.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{invoice.currency}</p>
            </div>
            <InvoiceStatusBadge status={invoice.status} />
          </div>

          {/* Tabs for RFI */}
          {isRfi && (
            <div className="flex border-b border-border shrink-0">
              <button
                onClick={() => setTab('details')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-all ${tab === 'details' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <FileText className="w-3.5 h-3.5" /> Details
              </button>
              <button
                onClick={() => setTab('rfi')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-all ${tab === 'rfi' ? 'border-orange-500 text-orange-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <AlertCircle className="w-3.5 h-3.5" /> RFI
                <span className="ml-1 bg-orange-100 text-orange-600 text-[9px] font-bold rounded-full px-1.5 py-0.5">
                  {invoice.rfi_items?.length || 1}
                </span>
              </button>
            </div>
          )}

          {/* RFI tab content */}
          {isRfi && tab === 'rfi' && (
            <div className="flex-1 overflow-y-auto p-4">
              <RfiWorkflow invoice={invoice} onAllResolved={onClose} />
            </div>
          )}

          {/* Details */}
          {(!isRfi || tab === 'details') && (
          <div className="flex-1 overflow-y-auto p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Invoice Details</p>
            <div>
              <Field label="Invoice Number" value={invoice.invoice_number} icon={Hash} />
              <Field label="Supplier" value={invoice.supplier_name} icon={Building2} />
              <Field
                label="Due Date"
                value={invoice.due_date ? format(new Date(invoice.due_date), 'MMMM d, yyyy') : null}
                icon={Calendar}
              />
              <Field label="Currency" value={`${sym} ${invoice.currency}`} icon={CreditCard} />
              {invoice.beneficiary_account && (
                <Field label="Beneficiary Account / IBAN" value={invoice.beneficiary_account} icon={CreditCard} />
              )}
              {invoice.beneficiary_address && (
                <Field label="Beneficiary Address" value={invoice.beneficiary_address} icon={MapPin} />
              )}
              {invoice.rejection_reason && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-4 mb-1">Rejection Info</p>
                  <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-0.5">Rejection Reason</p>
                      <p className="text-sm font-medium text-red-600 break-words">{invoice.rejection_reason}</p>
                    </div>
                  </div>
                </>
              )}
              {invoice.payment_currency && invoice.payment_amount && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-4 mb-1">Payment Info</p>
                  <Field label="Payment Currency" value={invoice.payment_currency} icon={CreditCard} />
                  <Field
                    label="Payment Amount"
                    value={`${currencySymbols[invoice.payment_currency] || ''}${invoice.payment_amount?.toLocaleString()}`}
                    icon={CreditCard}
                  />
                  {invoice.fx_rate && invoice.payment_currency !== invoice.currency && (
                    <Field label="FX Rate" value={`1 ${invoice.currency} = ${Number(invoice.fx_rate).toFixed(4)} ${invoice.payment_currency}`} icon={CreditCard} />
                  )}
                </>
              )}
              {safeHttpUrl(invoice.file_url) && (
                <div className="mt-4">
                  <a
                    href={safeHttpUrl(invoice.file_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View attached document
                  </a>
                </div>
              )}
            </div>
          </div>

          )}

          {/* Footer actions */}
          {isPayable && tab !== 'rfi' && (
            <div className="p-5 border-t border-border">
              <Button
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
                disabled={!isKybVerified}
                onClick={() => { onClose(); onPay(invoice); }}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                {invoice.status === 'partially_paid' ? 'Complete Payment' : 'Pay Now'}
              </Button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}