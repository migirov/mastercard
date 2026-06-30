import React, { useState, useEffect } from 'react';
import { api } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Search, RefreshCw, Landmark } from 'lucide-react';
import { Input } from '@/components/ui/input';

import InvoiceTable4 from '@/components/dashboard4/InvoiceTable4';
import StatusDrillDown from '@/components/dashboard/StatusDrillDown';
import ActivationBanner4 from '@/components/onboarding/ActivationBanner4';
import BankOnboarding4 from '@/components/onboarding/BankOnboarding4';
import PaymentChatbot4 from '@/components/payment4/PaymentChatbot4';
import ApprovalNotificationBanner from '@/components/notifications/ApprovalNotificationBanner';

export default function Dashboard4() {
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
    queryKey: ['invoices4'],
    queryFn: () => api.entities.Invoice4.list('-created_date'),
  });

  const { data: profiles = [], isLoading: loadingProfile } = useQuery({
    queryKey: ['company_profile4'],
    queryFn: () => api.entities.CompanyProfile4.list(),
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
    mutationFn: ({ id, data }) => api.entities.CompanyProfile4.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company_profile4'] }),
  });

  const updateInvoices = useMutation({
    mutationFn: async (updates) => {
      for (const { id, data } of updates) {
        await api.entities.Invoice4.update(id, data);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices4'] }),
  });

  const handleJoinNow = () => {
    setShowBanner(false);
    setShowOnboarding(true);
  };

  // funding is the amounts chosen in BankOnboarding4
  const handleOnboardingComplete = (funding) => {
    if (profile) {
      updateProfile.mutate({
        id: profile.id,
        data: {
          kyb_verified: true,
          account_active: true,
          balance_ils: funding?.ILS ?? 0,
          balance_usd: funding?.USD ?? 0,
          balance_eur: funding?.EUR ?? 0,
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
        await api.entities.Invoice4.update(id, { status: 'processing' });
      }
      queryClient.invalidateQueries({ queryKey: ['invoices4'] });
      setTimeout(async () => {
        for (const inv of invoicesList) {
          const isPartial = inv.payment_currency === inv.currency
            && inv.payment_amount && inv.payment_amount < inv.amount;
          await api.entities.Invoice4.update(inv.id, {
            status: isPartial ? 'partially_paid' : 'completed',
            completed_at: new Date().toISOString(),
          });
        }
        queryClient.invalidateQueries({ queryKey: ['invoices4'] });
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
      {/* Floating sticky Pay Now bar */}
      {isKybVerified && selectedIds.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-2.5 bg-rose-600 text-white shadow-lg">
          <span className="text-sm font-semibold">{selectedIds.length} invoice{selectedIds.length !== 1 ? 's' : ''} selected</span>
          <Button
            onClick={handlePaySelected}
            size="sm"
            className="bg-white text-rose-600 hover:bg-white/90 font-bold shadow"
          >
            <CreditCard className="w-4 h-4 mr-1.5" /> Pay Now
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-sm">
              <Landmark className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Accounts Payable</h1>
          </div>
          <p className="text-sm text-muted-foreground">Manage invoice payments via Bank X — fund accounts from your existing company bank</p>
        </div>
        <Button
          disabled={!isKybVerified || selectedIds.length === 0}
          onClick={handlePaySelected}
          size="lg"
          className={`font-semibold shadow-lg transition-all ${
            isKybVerified && selectedIds.length > 0
              ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200'
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
          <Input placeholder="Search invoices..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['invoices4'] })}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Invoice Table */}
      {loadingInvoices ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-muted border-t-rose-600 rounded-full animate-spin" />
        </div>
      ) : (
        <InvoiceTable4
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
        {showBanner && <ActivationBanner4 onJoinNow={handleJoinNow} onDismiss={() => setShowBanner(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showOnboarding && <BankOnboarding4 onComplete={handleOnboardingComplete} onClose={() => setShowOnboarding(false)} />}
      </AnimatePresence>

      {/* Floating XBS button */}
      {!showChatbot && (
        <motion.button
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          onClick={() => handleOpenChatbot()}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 w-14 h-14 md:w-16 md:h-16 rounded-full bg-primary text-white shadow-2xl shadow-primary/30 flex flex-col items-center justify-center hover:bg-primary/90 transition-colors gap-0.5"
          title="Open XBS Partner 4"
        >
          <span className="font-black text-base leading-none tracking-tight">XBS</span>
          <span className="text-[9px] text-white/70 font-medium">P4</span>
        </motion.button>
      )}

      <AnimatePresence>
        {showChatbot && (
          <PaymentChatbot4
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