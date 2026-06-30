import React from 'react';
import { format } from 'date-fns';
import { Building2, Calendar, CreditCard, Hash, MapPin, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import InvoiceStatusBadge from '@/components/dashboard/InvoiceStatusBadge';

const currencySymbols = { ILS: '₪', USD: '$', EUR: '€' };

function Field({ label, value, icon: Icon, className = '' }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className={`text-sm font-medium break-words ${className}`}>{value}</p>
      </div>
    </div>
  );
}

export default function InvoiceDetailView3({ invoice, onPay, isKybVerified }) {
  if (!invoice) return null;

  const sym = currencySymbols[invoice.currency] || '';
  const isPayable = ['unpaid', 'rfi', 'partially_paid'].includes(invoice.status);
  const isRejected = invoice.status === 'rejected';
  const isCompleted = invoice.status === 'completed';
  const isPending = ['pending', 'processing'].includes(invoice.status);

  return (
    <ScrollArea className="h-full">
      <div className="p-5 space-y-4">
        {/* Hero */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Invoice Amount</p>
            <p className="text-3xl font-bold tabular-nums">{sym}{invoice.amount?.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{invoice.currency}</p>
          </div>
          <InvoiceStatusBadge status={invoice.status} />
        </div>

        {/* Status banners */}
        {isRejected && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-red-700 font-semibold">Payment Rejected</p>
              {invoice.rejection_reason && (
                <p className="text-xs text-red-600 mt-0.5">{invoice.rejection_reason}</p>
              )}
              {!invoice.rejection_reason && (
                <p className="text-xs text-red-500 mt-0.5">No reason provided — contact your payment provider</p>
              )}
            </div>
          </div>
        )}
        {isCompleted && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-700 font-semibold">Payment completed successfully</p>
          </div>
        )}
        {isPending && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <Clock className="w-4 h-4 text-blue-600 shrink-0" />
            <p className="text-sm text-blue-700 font-semibold">Payment is being processed</p>
          </div>
        )}

        {/* Invoice details */}
        <div>
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
          </div>
        </div>

        {/* Payment info */}
        {invoice.payment_currency && invoice.payment_amount && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Payment Info</p>
            <div>
              <Field label="Payment Currency" value={invoice.payment_currency} icon={CreditCard} />
              <Field
                label="Payment Amount"
                value={`${currencySymbols[invoice.payment_currency] || ''}${invoice.payment_amount?.toLocaleString()}`}
                icon={CreditCard}
              />
              {invoice.fx_rate && invoice.payment_currency !== invoice.currency && (
                <Field
                  label="FX Rate"
                  value={`1 ${invoice.currency} = ${Number(invoice.fx_rate).toFixed(4)} ${invoice.payment_currency}`}
                  icon={CreditCard}
                />
              )}
              {invoice.transaction_cost && (
                <Field label="Transaction Fee" value={`$${invoice.transaction_cost}`} icon={CreditCard} />
              )}
              {invoice.processing_time && (
                <Field label="Processing Time" value={invoice.processing_time} icon={Clock} />
              )}
              {invoice.completed_at && (
                <Field
                  label={isCompleted ? "Paid At" : "Submitted At"}
                  value={format(new Date(invoice.completed_at), 'MMM d, yyyy HH:mm')}
                  icon={Calendar}
                />
              )}
            </div>
          </div>
        )}

        {/* Action */}
        {isPayable && onPay && (
          <Button
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
            disabled={!isKybVerified}
            onClick={() => onPay(invoice)}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            {invoice.status === 'partially_paid' ? 'Complete Payment' : 'Pay Now'}
          </Button>
        )}
        {isRejected && onPay && (
          <Button
            className="w-full bg-primary hover:bg-primary/90 font-semibold"
            disabled={!isKybVerified}
            onClick={() => onPay(invoice)}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Resubmit Payment
          </Button>
        )}
      </div>
    </ScrollArea>
  );
}