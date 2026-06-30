import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle2, XCircle, RefreshCw, Shield, Building2, Users,
  UserPlus, Pencil, Trash2, X, Check, User, Mail, Loader2
} from 'lucide-react';

const TABS = [
  { id: 'company', label: 'חברה', icon: Building2 },
  { id: 'employees', label: 'עובדים', icon: Users },
];

const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'Finance', 'HR', 'Operations', 'Management', 'Other'];

const CARD_TYPES = ['personal', 'team', 'department'];
const CARD_PURPOSES = ['salary', 'spend', 'travel', 'meals', 'software', 'hardware', 'marketing', 'other'];

const CARD_TYPE_LABELS = { personal: 'אישי', team: 'צוות', department: 'מחלקה' };
const PURPOSE_LABELS = { salary: 'שכר', spend: 'הוצאות', travel: 'נסיעות', meals: 'ארוחות', software: 'תוכנה', hardware: 'חומרה', marketing: 'מרקטינג', other: 'אחר' };

const EMPTY_EMP = {
  full_name: '', email: '', phone: '', department: 'Engineering', role: '', status: 'active',
  monthly_budget_ils: 0,
  card_permissions: {
    allowed_card_types: ['personal', 'team', 'department'],
    allowed_purposes: ['salary','spend','travel','meals','software','hardware','marketing','other'],
    max_cards: 0,
    max_single_transaction_ils: 0,
    max_monthly_ils: 0,
  }
};

// ── Card Permissions sub-form ──────────────────────────────────────────────────
function CardPermissionsForm({ perms = {}, onChange }) {
  const allowed_card_types = perms.allowed_card_types ?? CARD_TYPES;
  const allowed_purposes = perms.allowed_purposes ?? CARD_PURPOSES;

  const toggleItem = (field, value) => {
    const arr = perms[field] ?? (field === 'allowed_card_types' ? CARD_TYPES : CARD_PURPOSES);
    const next = arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value];
    onChange({ ...perms, [field]: next });
  };

  return (
    <div className="space-y-3 p-3 rounded-xl bg-muted/40 border border-border">
      <p className="text-xs font-semibold text-foreground">הרשאות הנפקת כרטיסים</p>

      {/* Card types */}
      <div>
        <p className="text-[11px] text-muted-foreground mb-1.5">סוגי כרטיס מותרים</p>
        <div className="flex gap-1.5 flex-wrap">
          {CARD_TYPES.map(t => (
            <button key={t} type="button"
              onClick={() => toggleItem('allowed_card_types', t)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                allowed_card_types.includes(t)
                  ? 'bg-primary text-white border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/40'
              }`}>
              {CARD_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Purposes */}
      <div>
        <p className="text-[11px] text-muted-foreground mb-1.5">מטרות מותרות</p>
        <div className="flex gap-1.5 flex-wrap">
          {CARD_PURPOSES.map(p => (
            <button key={p} type="button"
              onClick={() => toggleItem('allowed_purposes', p)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                allowed_purposes.includes(p)
                  ? 'bg-primary text-white border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/40'
              }`}>
              {PURPOSE_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Limits */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">מקס׳ כרטיסים</p>
          <Input type="number" min="0" placeholder="∞"
            value={perms.max_cards || ''}
            onChange={e => onChange({ ...perms, max_cards: Number(e.target.value) })}
            className="h-8 text-xs font-mono" />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">לימיט/עסקה (₪)</p>
          <Input type="number" min="0" placeholder="∞"
            value={perms.max_single_transaction_ils || ''}
            onChange={e => onChange({ ...perms, max_single_transaction_ils: Number(e.target.value) })}
            className="h-8 text-xs font-mono" />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">לימיט/חודש (₪)</p>
          <Input type="number" min="0" placeholder="∞"
            value={perms.max_monthly_ils || ''}
            onChange={e => onChange({ ...perms, max_monthly_ils: Number(e.target.value) })}
            className="h-8 text-xs font-mono" />
        </div>
      </div>
    </div>
  );
}

// ── Employee mini-form ─────────────────────────────────────────────────────────
function EmployeeForm({ form, setForm, onSubmit, onCancel, isEditing, isPending }) {
  return (
    <Card className="p-4 space-y-3 border-primary/30">
      <h4 className="text-sm font-semibold">{isEditing ? 'ערוך עובד' : 'עובד חדש'}</h4>
      <div className="space-y-2">
        <div className="relative">
          <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="שם מלא" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="pl-8 text-sm h-9" />
        </div>
        <div className="relative">
          <Mail className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="אימייל" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="pl-8 text-sm h-9" />
        </div>
        <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
          className="w-full px-3 h-9 text-sm rounded-md border border-input bg-transparent focus:outline-none focus:ring-1 focus:ring-ring">
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <Input placeholder="תפקיד (Job title)" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="text-sm h-9" />
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">תקציב חודשי (₪)</label>
          <Input type="number" placeholder="0" value={form.monthly_budget_ils || ''} onChange={e => setForm(f => ({ ...f, monthly_budget_ils: Number(e.target.value) }))} className="text-sm h-9 font-mono" />
        </div>
        <CardPermissionsForm
          perms={form.card_permissions || {}}
          onChange={v => setForm(f => ({ ...f, card_permissions: v }))}
        />
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onSubmit} disabled={!form.full_name || !form.email || isPending} className="flex-1">
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
          {isEditing ? 'שמור' : 'צור עובד'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}><X className="w-3.5 h-3.5" /></Button>
      </div>
    </Card>
  );
}

// ── Employees tab ──────────────────────────────────────────────────────────────
function EmployeesTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_EMP);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.entities.Employee.list('-created_date', 100),
  });

  const createEmp = useMutation({
    mutationFn: (data) => api.entities.Employee.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); setShowForm(false); setForm(EMPTY_EMP); },
  });

  const updateEmp = useMutation({
    mutationFn: ({ id, data }) => api.entities.Employee.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); setEditingId(null); setShowForm(false); setForm(EMPTY_EMP); },
  });

  const deleteEmp = useMutation({
    mutationFn: (id) => api.entities.Employee.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });

  const handleEdit = (emp) => {
    setEditingId(emp.id);
    setForm({
      full_name: emp.full_name || '',
      email: emp.email || '',
      phone: emp.phone || '',
      department: emp.department || 'Engineering',
      role: emp.role || '',
      status: emp.status || 'active',
      monthly_budget_ils: emp.monthly_budget_ils || 0,
      card_permissions: emp.card_permissions || {},
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (editingId) updateEmp.mutate({ id: editingId, data: form });
    else createEmp.mutate(form);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm">ניהול עובדים</h3>
            <p className="text-xs text-muted-foreground">{employees.length} עובדים רשומים</p>
          </div>
          {!showForm && (
            <Button size="sm" onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_EMP); }}>
              <UserPlus className="w-3.5 h-3.5 mr-1.5" /> הוסף
            </Button>
          )}
        </div>

        {showForm && (
          <EmployeeForm
            form={form}
            setForm={setForm}
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_EMP); }}
            isEditing={!!editingId}
            isPending={createEmp.isPending || updateEmp.isPending}
          />
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">טוען...</p>
        ) : employees.length === 0 ? (
          <Card className="p-6 text-center">
            <User className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">אין עובדים. הוסף עובד ראשון.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {employees.map(emp => (
              <Card key={emp.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{emp.full_name}</span>
                      <Badge variant="outline" className="text-[10px]">{emp.department}</Badge>
                      {emp.status === 'inactive' && <Badge variant="outline" className="text-[10px] text-red-500">לא פעיל</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{emp.role} · {emp.email}</p>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {emp.monthly_budget_ils > 0 && (
                        <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                          ₪{emp.monthly_budget_ils.toLocaleString()}/חודש
                        </span>
                      )}
                      {emp.card_permissions?.max_cards > 0 && (
                        <span className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                          מקס׳ {emp.card_permissions.max_cards} כרטיסים
                        </span>
                      )}
                      {emp.card_permissions?.max_single_transaction_ils > 0 && (
                        <span className="text-[11px] text-purple-700 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5">
                          ₪{emp.card_permissions.max_single_transaction_ils.toLocaleString()}/עסקה
                        </span>
                      )}
                      {emp.card_permissions?.max_monthly_ils > 0 && (
                        <span className="text-[11px] text-orange-700 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
                          ₪{emp.card_permissions.max_monthly_ils.toLocaleString()}/חודש
                        </span>
                      )}
                      {emp.card_permissions?.allowed_purposes?.length > 0 && emp.card_permissions.allowed_purposes.length < CARD_PURPOSES.length && (
                        <span className="text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">
                          {emp.card_permissions.allowed_purposes.map(p => PURPOSE_LABELS[p]).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(emp)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteEmp.mutate(emp.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// ── Company tab ────────────────────────────────────────────────────────────────
function CompanyTab() {
  const queryClient = useQueryClient();

  const { data: profiles = [] } = useQuery({
    queryKey: ['company_profile4'],
    queryFn: () => api.entities.CompanyProfile4.list(),
  });
  const profile = profiles[0];

  const toggleKYB = useMutation({
    mutationFn: () => api.entities.CompanyProfile4.update(profile.id, { kyb_verified: !profile?.kyb_verified }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company_profile4'] }),
  });

  const toggleAccount = useMutation({
    mutationFn: () => api.entities.CompanyProfile4.update(profile.id, { account_active: !profile?.account_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company_profile4'] }),
  });

  const resetDemo = useMutation({
    mutationFn: async () => {
      if (profile) {
        await api.entities.CompanyProfile4.update(profile.id, {
          kyb_verified: false,
          account_active: false,
          balance_ils: 0,
          balance_usd: 0,
          balance_eur: 0,
          onboarding_step: 'not_started',
        });
      }
      // Reset all card transactions
      const txns = await api.entities.CardTransaction.list();
      await Promise.all(txns.map(t => api.entities.CardTransaction.delete(t.id)));
    },
    onSuccess: () => {
      localStorage.removeItem('cards_account_active');
      queryClient.invalidateQueries();
    },
  });

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* KYB + Account status */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-sm">פרופיל חברה</h3>
              <p className="text-xs text-muted-foreground">{profile?.company_name || 'לא הוגדר'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">KYB</span>
              </div>
              {profile?.kyb_verified ? (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> מאומת
                </Badge>
              ) : (
                <Badge className="bg-muted text-muted-foreground border-border text-[10px]">
                  <XCircle className="w-3 h-3 mr-1" /> לא מאומת
                </Badge>
              )}
              <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => toggleKYB.mutate()} disabled={!profile || toggleKYB.isPending}>
                {profile?.kyb_verified ? 'בטל אימות' : 'אמת KYB'}
              </Button>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">חשבון</span>
              </div>
              {profile?.account_active ? (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> פעיל
                </Badge>
              ) : (
                <Badge className="bg-muted text-muted-foreground border-border text-[10px]">
                  <XCircle className="w-3 h-3 mr-1" /> לא פעיל
                </Badge>
              )}
              <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => toggleAccount.mutate()} disabled={!profile || toggleAccount.isPending}>
                {profile?.account_active ? 'השבת' : 'הפעל'}
              </Button>
            </div>
          </div>

          {/* Balances */}
          {profile && (
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[['ILS','₪','balance_ils'], ['USD','$','balance_usd'], ['EUR','€','balance_eur']].map(([cur, sym, key]) => (
                <div key={cur} className="p-2 rounded-lg bg-muted/40 border border-border text-center">
                  <p className="text-[10px] text-muted-foreground">{cur}</p>
                  <p className="text-sm font-bold font-mono">{sym}{(profile[key] || 0).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Demo reset */}
        <Card className="p-4">
          <h3 className="font-bold text-sm mb-1">איפוס דמו</h3>
          <p className="text-xs text-muted-foreground mb-3">מאפס את חשבון הכרטיסים ומסיר את כל ה-transactions לדמו מחדש.</p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => resetDemo.mutate()}
            disabled={resetDemo.isPending}
            className="w-full"
          >
            {resetDemo.isPending
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <RefreshCw className="w-4 h-4 mr-2" />
            }
            {resetDemo.isPending ? 'מאפס...' : 'אפס דמו'}
          </Button>
        </Card>
      </div>
    </ScrollArea>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export default function CardSystemSettings() {
  const [activeTab, setActiveTab] = useState('company');

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border shrink-0">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2 ${
                activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'company' && <CompanyTab />}
        {activeTab === 'employees' && <EmployeesTab />}
      </div>
    </div>
  );
}