import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, RefreshCw, Shield, Building2, Users, CheckSquare, BookUser } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import UsersTab from '@/components/settings/UsersTab';
import ApprovalsTab from '@/components/settings/ApprovalsTab';
import RecipientsTab from '@/components/settings/RecipientsTab';

const TABS = [
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'approvals', label: 'Approvals', icon: CheckSquare },
  { id: 'recipients', label: 'Recipients', icon: BookUser },
];

export default function SettingsTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('company');
  const [keepRecipients, setKeepRecipients] = useState(
    () => localStorage.getItem('keep_recipients_data') === 'true'
  );

  const handleKeepRecipientsToggle = (val) => {
    setKeepRecipients(val);
    localStorage.setItem('keep_recipients_data', val ? 'true' : 'false');
    if (!val && activeTab === 'recipients') setActiveTab('company');
  };

  const { data: profiles = [] } = useQuery({
    queryKey: ['company_profile'],
    queryFn: () => api.entities.CompanyProfile.list(),
  });
  const profile = profiles[0];

  // Pending approvals badge
  const { data: approvals = [] } = useQuery({
    queryKey: ['payment_approvals'],
    queryFn: () => api.entities.PaymentApproval.list('-created_date', 50),
  });
  const pendingCount = approvals.filter(a => a.status === 'pending').length;

  const resetDemo = useMutation({
    mutationFn: async () => {
      if (profile) {
        await api.entities.CompanyProfile.update(profile.id, {
          kyb_verified: false, account_active: false,
          balance_ils: 0, balance_usd: 0, balance_eur: 0, onboarding_step: 'not_started',
        });
      }
      const invoices = await api.entities.Invoice.list();
      for (const inv of invoices) {
        await api.entities.Invoice.update(inv.id, {
          status: inv.rfi_items?.length > 0 ? 'rfi' : 'unpaid',
          payment_currency: null, payment_amount: null, fx_rate: null,
          completed_at: null, processing_time: null, transaction_cost: null,
          beneficiary_account: '', beneficiary_address: '',
        });
      }
    },
    onSuccess: () => {
      // Scope the refetch to what this save affects (not the whole app cache).
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['company_profile'] });
    },
  });

  return (
    <div className="flex flex-col h-full">
      {/* Tab nav */}
      <div className="flex border-b border-border shrink-0">
        {TABS.filter(t => t.id !== 'recipients' || keepRecipients).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2 relative ${
                activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.id === 'approvals' && pendingCount > 0 && (
                <span className="absolute top-1.5 right-2 bg-yellow-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'company' && (
          <div className="p-4 space-y-4 overflow-y-auto h-full">
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Company Profile</h3>
                  <p className="text-xs text-muted-foreground">{profile?.company_name || 'Not set'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">KYB Verification</span>
                  </div>
                  {profile?.kyb_verified ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
                    </Badge>
                  ) : (
                    <Badge className="bg-muted text-muted-foreground border-border text-[10px]">
                      <XCircle className="w-3 h-3 mr-1" /> Not Verified
                    </Badge>
                  )}
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">Account Status</span>
                  </div>
                  {profile?.account_active ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                    </Badge>
                  ) : (
                    <Badge className="bg-muted text-muted-foreground border-border text-[10px]">
                      <XCircle className="w-3 h-3 mr-1" /> Inactive
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="font-bold text-sm mb-1">Recipient Data</h3>
              <p className="text-xs text-muted-foreground mb-3">Keep a record of recipient details from invoice payments.</p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Keep record of recipients data</span>
                <Switch checked={keepRecipients} onCheckedChange={handleKeepRecipientsToggle} />
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="font-bold text-sm mb-1">Demo Controls</h3>
              <p className="text-xs text-muted-foreground mb-3">Reset the demo to start the onboarding flow from the beginning.</p>
              <Button variant="destructive" size="sm" onClick={() => resetDemo.mutate()} disabled={resetDemo.isPending} className="w-full">
                <RefreshCw className={`w-4 h-4 mr-2 ${resetDemo.isPending ? 'animate-spin' : ''}`} />
                Reset Demo
              </Button>
            </Card>
          </div>
        )}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'approvals' && <ApprovalsTab />}
        {activeTab === 'recipients' && keepRecipients && <RecipientsTab />}
      </div>
    </div>
  );
}