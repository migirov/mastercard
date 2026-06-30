import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, CreditCard, Search, Plus, Filter } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import EmployeeTable from '@/components/cards/EmployeeTable';
import CardChatbot from '@/components/cards/CardChatbot';
import CardActivationBanner from '@/components/cards/CardActivationBanner';
import CardAccountOnboarding from '@/components/cards/CardAccountOnboarding';
import ExistingAccountModal from '@/components/cards/ExistingAccountModal';
const DEPARTMENTS = ['All', 'Engineering', 'Sales', 'Marketing', 'Finance', 'HR', 'Operations', 'Management', 'Other'];
const STATUSES = ['All', 'active', 'inactive'];

export default function CardManagement() {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [chatbotContext, setChatbotContext] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showExistingAccount, setShowExistingAccount] = useState(false);
  const [accountActive, setAccountActive] = useState(() => localStorage.getItem('cards_account_active') === 'true');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accountActive) {
      const t = setTimeout(() => setShowBanner(true), 800);
      return () => clearTimeout(t);
    }
  }, [accountActive]);

  const handleHaveAccount = () => {
    setShowBanner(false);
    setShowExistingAccount(true);
  };

  const handleCreateAccount = () => {
    setShowBanner(false);
    setShowOnboarding(true);
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    localStorage.setItem('cards_account_active', 'true');
    localStorage.removeItem('cards_banner_dismissed');
    setAccountActive(true);
  };

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.entities.Employee.list('-created_date', 100),
    staleTime: 0,
  });

  const { data: cards = [], isLoading: loadingCards } = useQuery({
    queryKey: ['virtual_cards'],
    queryFn: () => api.entities.VirtualCard.list('-created_date', 200),
    staleTime: 0,
  });

  const filtered = employees.filter(emp => {
    const matchSearch = !search ||
      emp.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      emp.email?.toLowerCase().includes(search.toLowerCase()) ||
      emp.role?.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === 'All' || emp.department === deptFilter;
    const matchStatus = statusFilter === 'All' || emp.status === statusFilter;
    return matchSearch && matchDept && matchStatus;
  });

  const openCardCreation = (employee = null) => {
    setChatbotContext(employee ? { mode: 'create_card', employee } : { mode: 'create_card' });
    setChatbotOpen(true);
  };

  const activeCards = cards.filter(c => c.status === 'active').length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-primary" />
              Employees or Team
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Mastercard virtual cards — spend, salary & more</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">{employees.filter(e => e.status === 'active').length} employees</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 rounded-lg">
              <CreditCard className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-accent">{activeCards} active cards</span>
            </div>
            <Button onClick={() => openCardCreation()} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Payment Card
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 border-b border-border bg-card/50">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <div className="flex gap-1 flex-wrap">
              {DEPARTMENTS.map(d => (
                <button key={d} onClick={() => setDeptFilter(d)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
                    deptFilter === d
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                  }`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-1">
            {STATUSES.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
                  statusFilter === s
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
                }`}>
                {s === 'All' ? 'All statuses' : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-6 py-6">
        <EmployeeTable
          employees={filtered}
          cards={cards}
          isLoading={isLoading || loadingCards}
          onCreateCard={openCardCreation}
          onManageCards={(emp) => { setChatbotContext({ mode: 'manage', employee: emp }); setChatbotOpen(true); }}
        />
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showBanner && (
          <CardActivationBanner
            onHaveAccount={handleHaveAccount}
            onCreateAccount={handleCreateAccount}
            onDismiss={() => { setShowBanner(false); }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showOnboarding && (
          <CardAccountOnboarding
            onComplete={handleOnboardingComplete}
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
              localStorage.setItem('cards_account_active', 'true');
              setAccountActive(true);
            }}
          />
        )}
      </AnimatePresence>



      {/* Chatbot */}
      {chatbotOpen && (
        <CardChatbot
          initialContext={chatbotContext}
          employees={employees}
          cards={cards}
          onClose={() => { setChatbotOpen(false); setChatbotContext(null); queryClient.invalidateQueries({ queryKey: ['virtual_cards'] }); queryClient.invalidateQueries({ queryKey: ['employees'] }); }}
        />
      )}
    </div>
  );
}