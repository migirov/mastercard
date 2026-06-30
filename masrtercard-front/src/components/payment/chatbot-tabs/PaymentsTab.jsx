import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import InvoiceStatusBadge from '@/components/dashboard/InvoiceStatusBadge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wallet, X } from 'lucide-react';
import TransferDetailDrawer from './TransferDetailDrawer';
import { AnimatePresence } from 'framer-motion';

const currencySymbols = { ILS: '₪', USD: '$', EUR: '€' };

const balanceCurrencies = [
  { code: 'ILS', symbol: '₪', flag: '🇮🇱', key: 'balance_ils', color: 'from-blue-500 to-blue-600' },
  { code: 'USD', symbol: '$', flag: '🇺🇸', key: 'balance_usd', color: 'from-emerald-500 to-emerald-600' },
  { code: 'EUR', symbol: '€', flag: '🇪🇺', key: 'balance_eur', color: 'from-violet-500 to-violet-600' },
];

const statusStats = [
  { label: 'Pending', status: 'pending', color: 'from-purple-500 to-purple-600', textColor: 'text-white', flag: '⏳' },
  { label: 'Completed', status: 'completed', color: 'from-emerald-500 to-emerald-600', textColor: 'text-white', flag: '✅' },
  { label: 'Rejected', status: 'rejected', color: 'from-red-500 to-red-600', textColor: 'text-white', flag: '❌' },
  { label: 'RFI', status: 'rfi', color: 'from-orange-500 to-orange-600', textColor: 'text-white', flag: '📋' },
];

export default function PaymentsTab({ entityName = 'Invoice' }) {
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [currencyFilter, setCurrencyFilter] = useState(null);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: [entityName],
    queryFn: () => api.entities[entityName].list('-updated_date'),
  });

  const profileEntity = entityName === 'Invoice' ? 'CompanyProfile' : entityName === 'Invoice2' ? 'CompanyProfile2' : entityName === 'Invoice3' ? 'CompanyProfile3' : 'CompanyProfile4';
  const { data: profiles = [] } = useQuery({
    queryKey: [profileEntity],
    queryFn: () => api.entities[profileEntity].list(),
  });

  const profile = profiles[0];
  const paidInvoices = invoices.filter(inv => inv.status !== 'unpaid');

  const filteredInvoices = paidInvoices.filter(inv => {
    if (statusFilter && inv.status !== statusFilter) return false;
    if (currencyFilter && inv.currency !== currencyFilter) return false;
    return true;
  });

  const toggleStatusFilter = (status) => {
    setStatusFilter(prev => prev === status ? null : status);
  };

  const toggleCurrencyFilter = (code) => {
    setCurrencyFilter(prev => prev === code ? null : code);
  };

  const hasFilter = statusFilter || currencyFilter;

  return (
    <>
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          {/* Balance cards */}
          {profile?.account_active && (
            <div className="grid grid-cols-3 gap-2">
              {balanceCurrencies.map((cur) => {
                const isActive = currencyFilter === cur.code;
                return (
                  <button
                    key={cur.code}
                    onClick={() => toggleCurrencyFilter(cur.code)}
                    className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${cur.color} p-3 text-white shadow text-left transition-all ${
                      isActive ? 'ring-2 ring-white ring-offset-1 scale-[1.03]' : 'hover:scale-[1.02]'
                    }`}
                  >
                    <div className="absolute top-0 right-0 w-12 h-12 bg-white/10 rounded-full -translate-y-4 translate-x-4" />
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-sm">{cur.flag}</span>
                      <span className="text-[10px] font-medium opacity-90">{cur.code}</span>
                      {isActive && <span className="ml-auto text-[9px] bg-white/30 rounded-full px-1.5 py-0.5">Filter ON</span>}
                    </div>
                    <p className="text-sm font-bold">{cur.symbol}{(profile[cur.key] || 0).toLocaleString()}</p>
                    <div className="flex items-center gap-1 mt-1 text-[9px] opacity-75">
                      <Wallet className="w-2.5 h-2.5" />
                      <span>Available</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Status stat cards */}
          <div className="grid grid-cols-2 gap-2">
            {statusStats.map((stat) => {
              const count = paidInvoices.filter(i => i.status === stat.status).length;
              const isActive = statusFilter === stat.status;
              return (
                <button
                  key={stat.label}
                  onClick={() => toggleStatusFilter(stat.status)}
                  className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${stat.color} p-3 text-left shadow transition-all ${
                    isActive ? 'ring-2 ring-white ring-offset-1 scale-[1.03]' : 'hover:scale-[1.02]'
                  }`}
                >
                  <div className="absolute top-0 right-0 w-10 h-10 bg-white/10 rounded-full -translate-y-3 translate-x-3" />
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-sm">{stat.flag}</span>
                    <span className="text-[10px] font-medium text-white/90">{stat.label}</span>
                    {isActive && <span className="ml-auto text-[9px] bg-white/30 rounded-full px-1.5 py-0.5 text-white">Filter ON</span>}
                  </div>
                  <p className="text-xl font-bold text-white">{count}</p>
                </button>
              );
            })}
          </div>

          {/* Active filter indicator */}
          {hasFilter && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <span>Showing: {[statusFilter, currencyFilter].filter(Boolean).join(' · ')}</span>
              <button
                onClick={() => { setStatusFilter(null); setCurrencyFilter(null); }}
                className="ml-auto flex items-center gap-1 text-primary hover:underline"
              >
                <X className="w-3 h-3" /> Clear filters
              </button>
            </div>
          )}

          {/* Payments table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs font-semibold uppercase">Invoice #</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Supplier</TableHead>
                    <TableHead className="text-xs font-semibold uppercase text-right">Amount</TableHead>
                    <TableHead className="text-xs font-semibold uppercase">Date</TableHead>
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
                  ) : filteredInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                        {hasFilter ? 'No payments match the current filter' : 'No payment history yet'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/60 transition-colors" onClick={() => setSelectedInvoice(inv)}>
                        <TableCell className="text-xs font-medium">{inv.invoice_number}</TableCell>
                        <TableCell className="text-xs">{inv.supplier_name}</TableCell>
                        <TableCell className="text-xs text-right font-semibold">
                          {currencySymbols[inv.currency]}{inv.amount?.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {inv.updated_date ? format(new Date(inv.updated_date), 'MMM d') : '—'}
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