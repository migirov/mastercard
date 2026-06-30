import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { api } from '@/api/apiClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, CreditCard, ChevronLeft, History, Settings2, PlusCircle, SlidersHorizontal, Columns2, Maximize2 } from 'lucide-react';
import CardCreationFlow from './chatbot-tabs/CardCreationFlow';
import CardsList from './chatbot-tabs/CardsList';
import TransactionHistory from './chatbot-tabs/TransactionHistory';
import CardSettings from './chatbot-tabs/CardSettings';
import CardSystemSettings from './chatbot-tabs/CardSystemSettings';

const TABS = [
  { id: 'cards', label: 'Cards', icon: CreditCard },
  { id: 'create', label: 'New Card', icon: PlusCircle },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Limits', icon: Settings2 },
  { id: 'system', label: 'System', icon: SlidersHorizontal },
];

export default function CardChatbot({ initialContext, employees, onClose }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(
    initialContext?.mode === 'create_card' ? 'create' : 'cards'
  );
  const [selectedEmployee, setSelectedEmployee] = useState(initialContext?.employee || null);
  const [viewMode, setViewMode] = useState('half'); // 'half' | 'full'

  const { data: cards = [] } = useQuery({
    queryKey: ['virtual_cards'],
    queryFn: () => api.entities.VirtualCard.list('-created_date', 200),
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['card_transactions'],
    queryFn: () => api.entities.CardTransaction.list('-created_date', 500),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['virtual_cards'] });
    queryClient.invalidateQueries({ queryKey: ['card_transactions'] });
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className={`relative ml-auto h-full bg-card border-l border-border shadow-2xl flex flex-col transition-all duration-300 ${viewMode === 'full' ? 'w-full max-w-full' : 'w-full max-w-[520px]'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-sm">Virtual Card Manager</h2>
              <p className="text-[11px] text-muted-foreground">Mastercard · XBS Payments</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode(viewMode === 'half' ? 'full' : 'half')}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              title={viewMode === 'half' ? 'מסך מלא' : 'חצי מסך'}
            >
              {viewMode === 'half' ? <Maximize2 className="w-4 h-4" /> : <Columns2 className="w-4 h-4" />}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Employee context bar */}
        {selectedEmployee && (
          <div className="px-4 py-2.5 bg-primary/5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                {selectedEmployee.full_name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <span className="text-xs font-medium">{selectedEmployee.full_name}</span>
              <span className="text-xs text-muted-foreground">· {selectedEmployee.department}</span>
            </div>
            <button onClick={() => setSelectedEmployee(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <ChevronLeft className="w-3.5 h-3.5" /> All
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0 px-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'cards' && (
            <CardsList
              cards={cards}
              employees={employees}
              selectedEmployee={selectedEmployee}
              onSelectEmployee={setSelectedEmployee}
              onCreateCard={() => setActiveTab('create')}
              onRefresh={refresh}
            />
          )}
          {activeTab === 'create' && (
            <CardCreationFlow
              employees={employees}
              preselectedEmployee={selectedEmployee}
              onCreated={() => { refresh(); setActiveTab('cards'); }}
            />
          )}
          {activeTab === 'history' && (
            <TransactionHistory
              transactions={transactions}
              cards={cards}
              selectedEmployee={selectedEmployee}
            />
          )}
          {activeTab === 'settings' && (
            <CardSettings
              cards={cards}
              selectedEmployee={selectedEmployee}
              onRefresh={refresh}
            />
          )}
          {activeTab === 'system' && (
            <CardSystemSettings />
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}