import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Clock, AlertCircle, FileWarning, ArrowRight, FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import InvoiceStatusBadge from '@/components/dashboard/InvoiceStatusBadge';
import InvoiceDocViewer from './InvoiceDocViewer';

const currencySymbols = { ILS: '₪', USD: '$', EUR: '€' };

function Field({ label, value, className = '' }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${className}`}>{value}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">{title}</p>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

export default function TransferDetailDrawer({ invoice, onClose }) {
  const [showDoc, setShowDoc] = useState(false);
  if (!invoice) return null;

  const handleOpenDoc = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (invoice.file_url) setShowDoc(true);
  };

  const isFx = invoice.payment_currency && invoice.payment_currency !== invoice.currency;

  const statusConfig = {
    completed: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'Payment completed successfully' },
    pending: { icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', label: 'Payment is being processed by the bank' },
    processing: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', label: 'Payment is in processing' },
    rejected: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-200', label: 'Payment was rejected — please review and resubmit' },
    rfi: { icon: FileWarning, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', label: 'Additional information is required' },
    partially_paid: { icon: CheckCircle2, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', label: 'Partial payment processed — balance remains outstanding' },
  };

  const sc = statusConfig[invoice.status] || { icon: AlertCircle, color: 'text-muted-foreground', bg: 'bg-muted border-border', label: '' };
  const StatusIcon = sc.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-start justify-between p-4 border-b border-border shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <button
                  onClick={() => invoice.file_url && setShowDoc(true)}
                  className={`text-xs font-medium ${invoice.file_url ? 'text-primary hover:underline cursor-pointer' : 'text-muted-foreground'}`}
                  title={invoice.file_url ? 'Click to view document' : undefined}
                >
                  Invoice #{invoice.invoice_number}
                </button>
              </div>
              <h3 className="font-bold text-base">{invoice.supplier_name}</h3>
            </div>
            <div className="flex items-center gap-2">
              <InvoiceStatusBadge status={invoice.status} />
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 p-4 space-y-4">

            {/* Status banner */}
            {sc.label && (
              <div className={`flex items-center gap-2 p-3 rounded-lg border ${sc.bg}`}>
                <StatusIcon className={`w-4 h-4 shrink-0 ${sc.color}`} />
                <p className={`text-xs font-medium ${sc.color}`}>{sc.label}</p>
              </div>
            )}

            {/* RFI items */}
            {invoice.status === 'rfi' && invoice.rfi_items?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Missing Items</p>
                {invoice.rfi_items.map((rfi, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-orange-50 border border-orange-200">
                    <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <span className="text-xs text-orange-700">{rfi.item}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Invoice Details */}
            <Section title="Invoice Details">
              <Field label="Invoice Currency" value={`${currencySymbols[invoice.currency]} ${invoice.currency}`} />
              <Field label="Invoice Amount" value={`${currencySymbols[invoice.currency]}${invoice.amount?.toLocaleString()}`} className="font-bold" />
              <Field label="Due Date" value={invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : null} />
              {invoice.file_url && (
                <div className="col-span-2">
                  <button
                    onClick={handleOpenDoc}
                    className="w-full flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border hover:bg-muted transition-colors text-xs font-medium text-left"
                  >
                    <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                    View Invoice Document
                    <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
                  </button>
                </div>
              )}
            </Section>

            {/* Payment Details */}
            {(invoice.payment_amount || invoice.payment_currency) && (
              <Section title="Payment Details">
                <Field label="Payment Currency" value={invoice.payment_currency ? `${currencySymbols[invoice.payment_currency]} ${invoice.payment_currency}` : null} />
                <Field label="Amount Paid" value={invoice.payment_amount ? `${currencySymbols[invoice.payment_currency || invoice.currency]}${invoice.payment_amount?.toLocaleString()}` : null} className="font-bold text-primary" />
                {isFx && (
                  <>
                    <Field label="FX Rate" value={invoice.fx_rate ? `1 ${invoice.currency} = ${invoice.payment_currency === 'ILS' ? '₪' : invoice.payment_currency === 'USD' ? '$' : '€'}${Number(invoice.fx_rate).toFixed(4)} ${invoice.payment_currency}` : null} />
                    <div className="col-span-2 flex items-center gap-2 p-2 rounded-md bg-blue-50 border border-blue-200 text-xs">
                      <span className="font-medium text-blue-700">{currencySymbols[invoice.currency]}{invoice.amount?.toLocaleString()}</span>
                      <ArrowRight className="w-3 h-3 text-blue-400" />
                      <span className="font-bold text-blue-700">{currencySymbols[invoice.payment_currency]}{invoice.payment_amount?.toLocaleString()}</span>
                      <span className="text-blue-500 ml-auto">FX Converted</span>
                    </div>
                  </>
                )}
                <Field label="Transaction Cost" value={invoice.transaction_cost ? `$${invoice.transaction_cost}` : null} />
                {!['processing', 'pending'].includes(invoice.status) && (
                  <Field label="Processing Time" value={invoice.processing_time} />
                )}
                {!['processing', 'pending'].includes(invoice.status) && (
                  <Field label="Submitted At" value={invoice.completed_at ? format(new Date(invoice.completed_at), 'MMM d, yyyy HH:mm') : null} />
                )}
                {invoice.status === 'completed' && (
                  <Field label="Completed At" value={invoice.completed_at ? format(new Date(invoice.completed_at), 'MMM d, yyyy HH:mm') : null} />
                )}
              </Section>
            )}

            {/* Partial payment balance */}
            {invoice.status === 'partially_paid' && invoice.payment_amount && (
              <Section title="Balance">
                <Field label="Total Invoice" value={`${currencySymbols[invoice.currency]}${invoice.amount?.toLocaleString()}`} />
                <Field label="Amount Paid" value={`${currencySymbols[invoice.payment_currency || invoice.currency]}${invoice.payment_amount?.toLocaleString()}`} className="text-emerald-600" />
                <div className="col-span-2">
                  <Field label="Remaining Balance" value={`${currencySymbols[invoice.currency]}${(invoice.amount - invoice.payment_amount)?.toLocaleString()}`} className="text-orange-600 font-bold" />
                </div>
              </Section>
            )}

            {/* Beneficiary Details */}
            {(invoice.beneficiary_account || invoice.beneficiary_address) && (
              <Section title="Beneficiary Details">
                <div className="col-span-2">
                  <Field label="IBAN / Account" value={invoice.beneficiary_account} className="font-mono text-xs" />
                </div>
                <div className="col-span-2">
                  <Field label="Address" value={invoice.beneficiary_address} />
                </div>
              </Section>
            )}
          </div>
        </motion.div>
      </motion.div>

      {showDoc && (
        <InvoiceDocViewer
          fileUrl={invoice.file_url}
          invoiceNumber={invoice.invoice_number}
          onClose={() => setShowDoc(false)}
        />
      )}
    </AnimatePresence>
  );
}