import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, RefreshCw, Building2, Users, CheckSquare } from 'lucide-react';
import UsersTab from '@/components/settings/UsersTab';
import ApprovalsTab from '@/components/settings/ApprovalsTab';

const TABS = [
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'approvals', label: 'Approvals', icon: CheckSquare },
];

export default function SettingsTab3() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('company');

  const { data: profiles = [] } = useQuery({
    queryKey: ['company_profile3'],
    queryFn: () => api.entities.CompanyProfile3.list(),
  });

  const profile = profiles[0];

  const resetDemo = useMutation({
    mutationFn: async () => {
      if (profile) {
        await api.entities.CompanyProfile3.update(profile.id, {
          kyb_verified: false, account_active: false,
          balance_ils: 0, balance_usd: 0, balance_eur: 0,
          onboarding_step: 'not_started',
        });
      }
      const invoices = await api.entities.Invoice3.list();
      for (const inv of invoices) {
        await api.entities.Invoice3.update(inv.id, { status: 'unpaid', payment_currency: null, payment_amount: null, fx_rate: null, completed_at: null });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company_profile3'] });
      queryClient.invalidateQueries({ queryKey: ['invoices3'] });
    },
  });

  const { data: approvals = [] } = useQuery({
    queryKey: ['payment_approvals'],
    queryFn: () => api.entities.PaymentApproval.list('-created_date', 50),
  });
  const pendingCount = approvals.filter(a => a.status === 'pending').length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border shrink-0">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2 relative ${
                activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.id === 'approvals' && pendingCount > 0 && (
                <span className="absolute top-1.5 right-2 bg-yellow-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">{pendingCount}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'approvals' && <ApprovalsTab />}
        {activeTab === 'company' && <div className="p-5 space-y-5 overflow-y-auto h-full">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Company Status</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
            <span className="text-sm font-medium">KYB Verification</span>
            <Badge className={profile?.kyb_verified ? 'bg-accent/10 text-accent border-accent/20' : 'bg-muted text-muted-foreground'}>
              {profile?.kyb_verified ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
              {profile?.kyb_verified ? 'Verified' : 'Not verified'}
            </Badge>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
            <span className="text-sm font-medium">Account Active</span>
            <Badge className={profile?.account_active ? 'bg-accent/10 text-accent border-accent/20' : 'bg-muted text-muted-foreground'}>
              {profile?.account_active ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
              {profile?.account_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Demo Controls</p>
        <p className="text-xs text-muted-foreground mb-3">Reset Partner 3 to initial demo state (does not delete invoices).</p>
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => resetDemo.mutate()}
          disabled={resetDemo.isPending}
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-2 ${resetDemo.isPending ? 'animate-spin' : ''}`} />
          Reset Demo
        </Button>
      </div>
    </div>}
      </div>
    </div>
  );
}