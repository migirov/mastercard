import React from 'react';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, ExternalLink } from 'lucide-react';
import InvoiceStatusBadge from '@/components/dashboard/InvoiceStatusBadge';

const currencySymbols = { ILS: '₪', USD: '$', EUR: '€' };

export default function InvoiceTable3({ invoices, selectedIds, onToggleSelect, onToggleAll, isKybVerified, onPaySingle, onViewStatus }) {
  const payableInvoices = invoices.filter(inv => ['unpaid', 'rfi'].includes(inv.status));
  const allSelected = payableInvoices.length > 0 && payableInvoices.every(inv => selectedIds.includes(inv.id));

  return (
    <>
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12">
                  <Checkbox checked={allSelected} onCheckedChange={() => onToggleAll(payableInvoices)} disabled={!isKybVerified} />
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invoice #</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supplier</TableHead>
                <TableHead className="hidden sm:table-cell text-xs font-semibold uppercase tracking-wider text-muted-foreground">Currency</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Amount</TableHead>
                <TableHead className="hidden md:table-cell text-xs font-semibold uppercase tracking-wider text-muted-foreground">Due Date</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => {
                const isSelected = selectedIds.includes(invoice.id);
                const isPayable = ['unpaid', 'rfi'].includes(invoice.status);
                const isCrossBorder = invoice.currency !== 'ILS';
                return (
                  <TableRow
                    key={invoice.id}
                    onClick={() => onViewStatus(invoice)}
                    className={`cursor-pointer transition-colors hover:bg-muted/40 ${isSelected ? 'bg-primary/5' : ''} ${
                      isKybVerified && isCrossBorder && isPayable ? 'ring-1 ring-inset ring-accent/20' : ''
                    }`}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect(invoice.id)} disabled={!isKybVerified || !isPayable} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{invoice.invoice_number}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-sm max-w-[120px] truncate">{invoice.supplier_name}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md ${
                        invoice.currency === 'ILS' ? 'bg-blue-50 text-blue-700' :
                        invoice.currency === 'USD' ? 'bg-emerald-50 text-emerald-700' :
                        'bg-violet-50 text-violet-700'
                      }`}>
                        {currencySymbols[invoice.currency]} {invoice.currency}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm tabular-nums">
                      {currencySymbols[invoice.currency]}{invoice.amount?.toLocaleString()}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={invoice.status} />
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {isPayable ? (
                        <Button
                          size="sm"
                          disabled={!isKybVerified}
                          onClick={() => onPaySingle(invoice)}
                          className={`text-xs h-8 px-3 ${isKybVerified ? 'bg-accent hover:bg-accent/90 text-accent-foreground' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
                        >
                          Pay now
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => onViewStatus(invoice)} className="text-xs h-8 px-3">
                          <ExternalLink className="w-3 h-3 mr-1" /> Details
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

    </>
  );
}