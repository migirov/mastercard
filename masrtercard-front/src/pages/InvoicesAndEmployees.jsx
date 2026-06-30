import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Users, Search, RefreshCw, CreditCard,
  Plus, Sparkles
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InvoiceTable4 from '@/components/dashboard4/InvoiceTable4';
import EmployeeTable from '@/components/cards/EmployeeTable';
import StatusDrillDown from '@/components/dashboard/StatusDrillDown';
import UnifiedChatbot from '@/components/combined/UnifiedChatbot';
import CombinedActivationBanner from '@/components/combined/CombinedActivationBanner';
import CardAccountOnboarding from '@/components/cards/CardAccountOnboarding';
import ExistingAccountModal from '@/components/cards/ExistingAccountModal';

const DEPARTMENTS = ['All', 'Engineering', 'Sales', 'Marketing', 'Finance', 'HR', 'Operations', 'Management'];

export default function InvoicesAndEmployees() {
  const queryClient = useQueryClient();
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [empSearch, setEmpSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [showChatbot, setShowChatbot] = useState(false);
  const [chatbotInvoices, setChatbotInvoices] = useState([]);
  const [chatbotTab, setChatbotTab] = useState('pay');
  const [statusInvoice, setStatusInvoice] = useState(null);
  const [activeTab, setActiveTab] = useState('invoices');
  const [showBanner, setShowBanner] = useState(() => localStorage.getItem('ie_account_active') !== 'true');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showExistingAccount, setShowExistingAccount] = useState(false);
  const [accountActive, setAccountActive] = useState(() => localStorage.getItem('ie_account_active') === 'true');

  // Data
  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices4'],
    queryFn: () => api.entities.Invoice4.list('-created_date'),
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ['company_profile4'],
    queryFn: () => api.entities.CompanyProfile4.list(),
  });
  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.entities.Employee.list('-created_date', 100),
    staleTime: 0,
  });
  const { data: cards = [], isLoading: loadingCards } = useQuery({
    queryKey: ['virtual_cards'],
    queryFn: () => api.entities.VirtualCard.list('-created_date', 200),
    staleTime: 0,
  });

  const profile = profiles[0];
  const isKybVerified = profile?.kyb_verified && profile?.account_active;

  const updateInvoices = useMutation({
    mutationFn: async (updates) => {
      for (const { id, data } of updates) {
        await api.entities.Invoice4.update(id, data);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices4'] }),
  });

  const updateProfile = useMutation({
    mutationFn: ({ id, data }) => api.entities.CompanyProfile4.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company_profile4'] }),
  });

  const simulateStatusProgression = (list) => {
    const ids = list.map(i => i.id);
    setTimeout(async () => {
      for (const id of ids) await api.entities.Invoice4.update(id, { status: 'processing' });
      queryClient.invalidateQueries({ queryKey: ['invoices4'] });
      setTimeout(async () => {
        for (const inv of list) {
          await api.entities.Invoice4.update(inv.id, { status: 'completed', completed_at: new Date().toISOString() });
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
        completed_at: now,
        transaction_cost: inv.currency !== 'ILS' ? 2.5 : 1.5,
        processing_time: ['5 min','10 min','25 min','1 hour'][Math.floor(Math.random()*4)],
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
      const nb = {};
      if (deductions.ILS) nb.balance_ils = Math.max(0, (profile.balance_ils||0) - deductions.ILS);
      if (deductions.USD) nb.balance_usd = Math.max(0, (profile.balance_usd||0) - deductions.USD);
      if (deductions.EUR) nb.balance_eur = Math.max(0, (profile.balance_eur||0) - deductions.EUR);
      if (Object.keys(nb).length) updateProfile.mutate({ id: profile.id, data: nb });
    }
    setShowChatbot(false);
    setChatbotInvoices([]);
    setSelectedInvoiceIds([]);
  };

  const openChatbot = (tab = 'pay', invs = []) => {
    setChatbotInvoices(invs);
    setChatbotTab(tab);
    setShowChatbot(true);
  };

  const filteredInvoices = invoices.filter(inv =>
    !invoiceSearch ||
    inv.supplier_name?.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
    inv.invoice_number?.toLowerCase().includes(invoiceSearch.toLowerCase())
  );

  const filteredEmployees = employees.filter(emp => {
    const matchSearch = !empSearch ||
      emp.full_name?.toLowerCase().includes(empSearch.toLowerCase()) ||
      emp.email?.toLowerCase().includes(empSearch.toLowerCase());
    const matchDept = deptFilter === 'All' || emp.department === deptFilter;
    return matchSearch && matchDept;
  });

  const unpaidCount = invoices.filter(i => i.status === 'unpaid').length;
  const activeCards = cards.filter(c => c.status === 'active').length;

  return (
    <div className="min-h-screen bg-background">
      {/* Top sticky bar when invoices selected */}
      {isKybVerified && selectedInvoiceIds.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-2.5 bg-rose-600 text-white shadow-lg">
          <span className="text-sm font-semibold">{selectedInvoiceIds.length} invoice{selectedInvoiceIds.length !== 1 ? 's' : ''} selected</span>
          <Button size="sm" onClick={() => openChatbot('pay', invoices.filter(i => selectedInvoiceIds.includes(i.id)))}
            className="bg-white text-rose-600 hover:bg-white/90 font-bold">
            <CreditCard className="w-4 h-4 mr-1.5" /> Pay Now
          </Button>
        </div>
      )}

      {/* Page Header */}
      <div className="border-b border-border bg-card px-6 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-rose-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              Invoices & Employees
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage invoice payments and employee virtual cards in one place</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 rounded-lg">
              <FileText className="w-4 h-4 text-rose-600" />
              <span className="text-sm font-medium text-rose-600">{unpaidCount} unpaid</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">{employees.filter(e=>e.status==='active').length} employees</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 rounded-lg">
              <CreditCard className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-accent">{activeCards} cards</span>
            </div>
            <Button
              onClick={() => openChatbot('pay')}
              className="gap-2 bg-gradient-to-r from-primary to-rose-500 hover:from-primary/90 hover:to-rose-500/90 shadow-lg"
            >
              <Sparkles className="w-4 h-4" />
              Open Finance Hub
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs layout */}
      <div className="flex-1 flex flex-col min-h-[calc(100vh-120px)]">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="w-full border-b border-border bg-card rounded-none h-auto p-0">
            <TabsTrigger value="invoices" className="rounded-none border-b-2 data-[state=active]:border-rose-600 flex-1 gap-2 py-3">
              <FileText className="w-4 h-4 text-rose-600" />
              Invoices to Pay
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{unpaidCount}</span>
            </TabsTrigger>
            <TabsTrigger value="employees" className="rounded-none border-b-2 data-[state=active]:border-primary flex-1 gap-2 py-3">
              <Users className="w-4 h-4 text-primary" />
              Employees & Cards
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{employees.length}</span>
            </TabsTrigger>
          </TabsList>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="flex-1 flex flex-col m-0">
            <div className="px-5 py-4 border-b border-border bg-card/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Unpaid invoices</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['invoices4'] })}>
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                  {selectedInvoiceIds.length > 0 && (
                    <Button size="sm" onClick={() => openChatbot('pay', invoices.filter(i => selectedInvoiceIds.includes(i.id)))}
                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-8 gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> Pay {selectedInvoiceIds.length}
                    </Button>
                  )}
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search invoices..." value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)} className="pl-9 h-8 text-sm" />
              </div>
            </div>

            <div className="p-5 overflow-auto flex-1">
              {loadingInvoices ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-muted border-t-rose-600 rounded-full animate-spin" />
                </div>
              ) : (
                <InvoiceTable4
                  invoices={filteredInvoices}
                  selectedIds={selectedInvoiceIds}
                  onToggleSelect={(id) => setSelectedInvoiceIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])}
                  onToggleAll={(payable) => {
                    const allSel = payable.every(i => selectedInvoiceIds.includes(i.id));
                    if (allSel) setSelectedInvoiceIds(prev => prev.filter(id => !payable.find(i => i.id === id)));
                    else setSelectedInvoiceIds(prev => [...new Set([...prev, ...payable.map(i => i.id)])]);
                  }}
                  isKybVerified={isKybVerified}
                  onPaySingle={(inv) => openChatbot('pay', [inv])}
                  onViewStatus={setStatusInvoice}
                />
              )}
            </div>
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees" className="flex-1 flex flex-col m-0">
            <div className="px-5 py-4 border-b border-border bg-card/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Manage employees and cards</h3>
                <Button size="sm" onClick={() => openChatbot('new_card')} className="gap-1.5 h-8 text-xs">
                  <Plus className="w-3.5 h-3.5" /> New Card
                </Button>
              </div>
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search employees..." value={empSearch} onChange={e => setEmpSearch(e.target.value)} className="pl-9 h-8 text-sm" />
                </div>
              </div>
              <div className="flex gap-1 flex-wrap">
                {DEPARTMENTS.map(d => (
                  <button key={d} onClick={() => setDeptFilter(d)}
                    className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors font-medium ${
                      deptFilter === d ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                    }`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 overflow-auto flex-1">
              <EmployeeTable
                employees={filteredEmployees}
                cards={cards}
                isLoading={loadingEmployees || loadingCards}
                onCreateCard={(emp) => openChatbot('new_card')}
                onManageCards={(emp) => openChatbot('cards')}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Floating XBS button */}
      {!showChatbot && (
        <motion.button
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          onClick={() => openChatbot('pay')}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-primary to-rose-500 text-white shadow-2xl shadow-primary/40 flex flex-col items-center justify-center hover:shadow-primary/60 transition-shadow"
        >
          <span className="font-black text-sm leading-none">XBS</span>
          <span className="text-[9px] text-white/70 font-medium">Hub</span>
        </motion.button>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showChatbot && (
          <UnifiedChatbot
            invoices={chatbotInvoices}
            onClose={() => { setShowChatbot(false); setChatbotInvoices([]); }}
            onComplete={handlePaymentComplete}
            profile={profile}
            employees={employees}
            defaultTab={chatbotTab}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBanner && (
          <CombinedActivationBanner
            onDismiss={() => setShowBanner(false)}
            onJoinPayments={() => {
              setShowBanner(false);
              setShowOnboarding(true);
            }}
            onCreateCards={() => {
              setShowBanner(false);
              setShowOnboarding(true);
            }}
            onHaveAccount={() => {
              setShowBanner(false);
              setShowExistingAccount(true);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOnboarding && (
          <CardAccountOnboarding
            onComplete={() => {
              setShowOnboarding(false);
              localStorage.setItem('ie_account_active', 'true');
              setAccountActive(true);
            }}
            onClose={() => setShowOnboarding(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExistingAccount && (
          <ExistingAccountModal
            onClose={() => setShowExistingAccount(false)}
            onComplete={() => {
              setShowExistingAccount(false);
              localStorage.setItem('ie_account_active', 'true');
              setAccountActive(true);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {statusInvoice && (
          <StatusDrillDown
            invoice={statusInvoice}
            onClose={() => setStatusInvoice(null)}
            onPay={isKybVerified ? (inv) => { setStatusInvoice(null); openChatbot('pay', [inv]); } : undefined}
          />
        )}
      </AnimatePresence>
    </div>
  );
}