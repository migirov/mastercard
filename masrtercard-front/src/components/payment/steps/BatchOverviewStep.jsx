import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Pencil, CheckCircle2, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

const currencySymbols = { ILS: '₪', USD: '$', EUR: '€' };

function InvoiceSummaryCard({ inv, idx, onEdit }) {
  const isFx = inv.payment_currency !== inv.currency;
  return (
    <Card className="p-4 border-border space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] text-muted-foreground">#{inv.invoice_number}</p>
          <p className="font-semibold text-sm">{inv.supplier_name}</p>
          {inv.due_date && (
            <p className="text-xs text-muted-foreground mt-0.5">Due: {format(new Date(inv.due_date), 'MMM d, yyyy')}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(idx)}>
            <Pencil className="w-3 h-3" />
          </Button>
          <CheckCircle2 className="w-4 h-4 text-accent" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-muted/50 rounded-lg p-2">
          <p className="text-muted-foreground text-[10px] mb-0.5">Invoice Amount</p>
          <p className="font-semibold">{currencySymbols[inv.currency]}{inv.amount?.toLocaleString()}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2">
          <p className="text-muted-foreground text-[10px] mb-0.5">Payment Amount</p>
          <p className="font-semibold text-primary">{currencySymbols[inv.payment_currency]}{inv.payment_amount?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        </div>
        {isFx && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 col-span-2">
            <p className="text-muted-foreground text-[10px] mb-0.5">FX Rate</p>
            <p className="font-semibold text-blue-700">
              1 {inv.currency} = {currencySymbols[inv.payment_currency]}{inv.fx_rate?.toFixed(4)} {inv.payment_currency}
            </p>
          </div>
        )}
        {inv.beneficiary_account && (
          <div className="bg-muted/50 rounded-lg p-2 col-span-2">
            <p className="text-muted-foreground text-[10px] mb-0.5">Beneficiary</p>
            <p className="font-mono text-[11px] truncate">{inv.beneficiary_account}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function BatchOverviewStep({ invoices, onEdit, onProceed }) {
  return (
    <div className="space-y-3">
      {invoices.map((inv, idx) => (
        <InvoiceSummaryCard key={inv.id || idx} inv={inv} idx={idx} onEdit={onEdit} />
      ))}

      <Button
        onClick={onProceed}
        className="w-full bg-primary hover:bg-primary/90 font-semibold"
      >
        Proceed to payment
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}