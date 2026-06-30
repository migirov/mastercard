import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import InvoiceStatusBadge from '@/components/dashboard/InvoiceStatusBadge';
import { ScrollArea } from '@/components/ui/scroll-area';
import TransferDetailDrawer from './TransferDetailDrawer';
import { AnimatePresence } from 'framer-motion';
import { ArrowUpCircle } from 'lucide-react';

const methodColors = {
  'Bank Transfer': 'bg-blue-50 text-blue-700 border-blue-200',
  'MASAV Transfer': 'bg-purple-50 text-purple-700 border-purple-200',
  'Account-to-Account (A2A)': 'bg-green-50 text-green-700 border-green-200',
};

const currencySymbols = { ILS: '₪', USD: '$', EUR: '€' };

export default function ReportsTab({ entityName = 'Invoice' }) {
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: [entityName],
    queryFn: () => api.entities[entityName].list('-updated_date'),
  });

  const { data: topUps = [] } = useQuery({
    queryKey: ['topups'],
    queryFn: () => api.entities.TopUp.list('-date'),
  });

  const processedInvoices = invoices.filter(inv => inv.status !== 'unpaid');

  const totalByCurrency = processedInvoices.reduce((acc, inv) => {
    acc[inv.currency] = (acc[inv.currency] || 0) + (inv.amount || 0);
    return acc;
  }, {});

  return (
    <>
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {['ILS', 'USD', 'EUR'].map(cur => (
            <Card key={cur} className="p-3">
              <p className="text-[11px] text-muted-foreground">Total {cur}</p>
              <p className="text-lg font-bold mt-0.5">
                {currencySymbols[cur]}{(totalByCurrency[cur] || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {processedInvoices.filter(i => i.currency === cur).length} invoices
              </p>
            </Card>
          ))}
        </div>

        {/* Top-Ups Section */}
        <Card className="overflow-hidden">
          <div className="p-3 border-b border-border flex items-center gap-2">
            <ArrowUpCircle className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold">Account Top-Ups</h3>
            <span className="ml-auto text-xs text-muted-foreground">{topUps.length} records</span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold uppercase">Account</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Date</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-right">Amount (ILS)</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topUps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                      No top-ups recorded yet
                    </TableCell>
                  </TableRow>
                ) : (
                  topUps.map((tu) => (
                    <TableRow key={tu.id}>
                      <TableCell className="text-xs font-medium">{tu.account_name || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {tu.date ? format(new Date(tu.date), 'dd MMM yyyy, HH:mm') : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-right font-semibold">
                        ₪{(tu.amount_ils || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${methodColors[tu.transfer_method] || 'bg-muted text-muted-foreground border-border'}`}>
                          {tu.transfer_method}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="p-3 border-b border-border">
            <h3 className="text-sm font-bold">Processed Invoices</h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold uppercase">Invoice #</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Supplier</TableHead>
                  <TableHead className="text-xs font-semibold uppercase text-right">Amount</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Cost</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : processedInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                      No processed invoices yet
                    </TableCell>
                  </TableRow>
                ) : (
                  processedInvoices.map((inv) => (
                    <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/60 transition-colors" onClick={() => setSelectedInvoice(inv)}>
                      <TableCell className="text-xs font-medium">{inv.invoice_number}</TableCell>
                      <TableCell className="text-xs">{inv.supplier_name}</TableCell>
                      <TableCell className="text-xs text-right font-semibold">
                        {currencySymbols[inv.currency]}{inv.amount?.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {inv.transaction_cost ? `$${inv.transaction_cost}` : '—'}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={inv.status} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </ScrollArea>

      <AnimatePresence>
        {selectedInvoice && (
          <TransferDetailDrawer invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
        )}
      </AnimatePresence>
    </>
  );
}