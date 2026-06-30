import React, { useState, useEffect } from 'react';
import { api } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Search, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';

import InvoiceTable from '@/components/dashboard/InvoiceTable';
import StatusDrillDown from '@/components/dashboard/StatusDrillDown';
import ActivationBanner2 from '@/components/onboarding/ActivationBanner2';
import BankOnboarding2 from '@/components/onboarding/BankOnboarding2';
import PaymentChatbot2 from '@/components/payment2/PaymentChatbot2';
import ApprovalNotificationBanner from '@/components/notifications/ApprovalNotificationBanner';

export default function Dashboard2() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBanner, setShowBanner] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [chatbotInvoices, setChatbotInvoices] = useState([]);
  const [chatbotDefaultTab, setChatbotDefaultTab] = useState('pay');
  const [statusInvoice, setStatusInvoice] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices2'],
    queryFn: () => api.entities.Invoice2.list('-created_date'),
  });

  const { data: profiles = [], isLoading: loadingProfile } = useQuery({
    queryKey: ['company_profile2'],
    queryFn: () => api.entities.CompanyProfile2.list(),
  });

  const profile = profiles[0];
  const isKybVerified = profile?.kyb_verified && profile?.account_active;

  useEffect(() => {
    if (!loadingProfile && profile && !profile.kyb_verified && profile.onboarding_step === 'not_started') {
      const timer = setTimeout(() => setShowBanner(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [loadingProfile, profile]);

  const updateProfile = useMutation({
    mutationFn: ({ id, data }) => api.entities.CompanyProfile2.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company_profile2'] }),
  });

  const updateInvoices = useMutation({
    mutationFn: async (updates) => {
      for (const { id, data } of updates) {
        await api.entities.Invoice2.update(id, data);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices2'] }),
  });

  const handleJoinNow = () => {
    setShowBanner(false);
    setShowOnboarding(true);
  };

  const handleOnboardingComplete = () => {
    if (profile) {
      updateProfile.mutate({
        id: profile.id,
        data: {
          kyb_verified: true,
          account_active: true,
          balance_ils: 0,
          balance_usd: 0,
          balance_eur: 0,
          onboarding_step: 'activated',
        },
      });
    }
    setShowOnboarding(false);
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleToggleAll = (payable) => {
    const allSelected = payable.every(inv => selectedIds.includes(inv.id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !payable.find(inv => inv.id === id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...payable.map(inv => inv.id)])]);
    }
  };

  const handlePaySelected = () => {
    const selected = invoices.filter(inv => selectedIds.includes(inv.id));
    if (selected.length === 0) return;
    setChatbotInvoices(selected);
    setChatbotDefaultTab('pay');
    setShowChatbot(true);
  };

  const handlePaySingle = (invoice) => {
    setChatbotInvoices([invoice]);
    setChatbotDefaultTab('pay');
    setShowChatbot(true);
  };

  const handleOpenChatbot = (tab) => {
    setChatbotInvoices([]);
    setChatbotDefaultTab(tab || (isKybVerified ? 'payments' : 'pay'));
    setShowChatbot(true);
  };

  const simulateStatusProgression = async (invoicesList) => {
    const ids = invoicesList.map(inv => inv.id);
    setTimeout(async () => {
      for (const id of ids) {
        await api.entities.Invoice2.update(id, { status: 'processing' });
      }
      queryClient.invalidateQueries({ queryKey: ['invoices2'] });
      setTimeout(async () => {
        for (const inv of invoicesList) {
          const isPartial = inv.payment_currency === inv.currency
            && inv.payment_amount && inv.payment_amount < inv.amount;
          await api.entities.Invoice2.update(inv.id, {
            status: isPartial ? 'partially_paid' : 'completed',
            completed_at: new Date().toISOString(),
          });
        }
        queryClient.invalidateQueries({ queryKey: ['invoices2'] });
      }, 8000);
    }, 5000);
  };

  const handlePaymentComplete = (reviewedInvoices) => {
    const now = new Date().toISOString();
    const sourceList = reviewedInvoices || chatbotInvoices;
    const updates = sourceList.map(inv => ({
      id: inv.id,
      data: {
        status: 'pending',
        payment_currency: inv.payment_currency || inv.currency,
        payment_amount: inv.payment_amount || inv.amount,
        fx_rate: inv.fx_rate || 1,
        beneficiary_account: inv.beneficiary_account || '',
        beneficiary_address: inv.beneficiary_address || '',
        completed_at: now,
        transaction_cost: inv.currency !== 'ILS' ? (Math.random() < 0.5 ? 2 : 3) : (Math.random() < 0.5 ? 1 : 2),
        processing_time: (() => { const opts = ['5 min', '10 min', '25 min', '1 hour', '2 hours', '4 hours', '7 hours']; return opts[Math.floor(Math.random() * opts.length)]; })(),
      },
    }));
    updateInvoices.mutate(updates);
    simulateStatusProgression(sourceList);

    if (profile) {
      const deductions = { ILS: 0, USD: 0, EUR: 0 };
      sourceList.forEach(inv => {
        const cur = inv.payment_currency || inv.currency;
        deductions[cur] = (deductions[cur] || 0) + (inv.payment_amount || inv.amount);
      });
      const newBalances = {};
      if (deductions.ILS) newBalances.balance_ils = Math.max(0, (profile.balance_ils || 0) - deductions.ILS);
      if (deductions.USD) newBalances.balance_usd = Math.max(0, (profile.balance_usd || 0) - deductions.USD);
      if (deductions.EUR) newBalances.balance_eur = Math.max(0, (profile.balance_eur || 0) - deductions.EUR);
      if (Object.keys(newBalances).length > 0) {
        updateProfile.mutate({ id: profile.id, data: newBalances });
      }
    }

    setShowChatbot(false);
    setChatbotInvoices([]);
    setSelectedIds([]);
  };

  const filteredInvoices = invoices.filter(inv =>
    !searchQuery ||
    inv.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-[1400px] mx-auto pb-24 md:pb-8">
      <ApprovalNotificationBanner />
      <div className="p-3 md:p-8 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Accounts Payable</h1>

          </div>
          <p className="text-sm text-muted-foreground">Manage and process your invoice payments via certified payment institution</p>
        </div>
        <Button
          disabled={!isKybVerified || selectedIds.length === 0}
          onClick={handlePaySelected}
          size="lg"
          className={`font-semibold shadow-lg transition-all ${
            isKybVerified && selectedIds.length > 0
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
              : 'bg-muted text-muted-foreground cursor-not-allowed shadow-none'
          }`}
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Pay now
          {selectedIds.length > 0 && (
            <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">{selectedIds.length}</span>
          )}
        </Button>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['invoices2'] })}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Invoice Table */}
      {loadingInvoices ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-muted border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : (
        <InvoiceTable
          invoices={filteredInvoices}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleAll={handleToggleAll}
          isKybVerified={isKybVerified}
          onPaySingle={handlePaySingle}
          onViewStatus={setStatusInvoice}
        />
      )}

      {/* Modals */}
      <AnimatePresence>
        {showBanner && <ActivationBanner2 onJoinNow={handleJoinNow} onDismiss={() => setShowBanner(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showOnboarding && <BankOnboarding2 onComplete={handleOnboardingComplete} onClose={() => setShowOnboarding(false)} />}
      </AnimatePresence>

      {/* Floating button — indigo themed */}
      {!showChatbot && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => handleOpenChatbot()}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 w-14 h-14 md:w-16 md:h-16 rounded-full bg-primary text-white shadow-2xl shadow-primary/30 flex flex-col items-center justify-center hover:bg-primary/90 transition-colors gap-0.5"
          title="Open XBS Partner 2"
        >
          <span className="font-black text-base leading-none tracking-tight">XBS</span>
          <span className="text-[9px] text-indigo-200 font-medium">P2</span>
        </motion.button>
      )}

      <AnimatePresence>
        {showChatbot && (
          <PaymentChatbot2
            invoices={chatbotInvoices}
            onClose={() => setShowChatbot(false)}
            onComplete={handlePaymentComplete}
            profile={profile}
            defaultTab={chatbotDefaultTab}
            onOnboardingComplete={handleOnboardingComplete}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {statusInvoice && <StatusDrillDown invoice={statusInvoice} onClose={() => setStatusInvoice(null)} onPay={isKybVerified ? (inv) => { setStatusInvoice(null); handlePaySingle(inv); } : undefined} />}
      </AnimatePresence>
      </div>
    </div>
  );
}