import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  UserPlus, Pencil, Trash2, X, Check, RefreshCw,
  User, Mail, Shield, KeyRound
} from 'lucide-react';
import UserLimitsForm from './UserLimitsForm';

const ROLES = ['admin', 'manager', 'employee'];
const ROLE_COLORS = {
  admin: 'bg-purple-100 text-purple-700 border-purple-200',
  manager: 'bg-blue-100 text-blue-700 border-blue-200',
  employee: 'bg-gray-100 text-gray-600 border-gray-200',
};

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const EMPTY_FORM = { full_name: '', email: '', role: 'employee', payment_limits: {}, manager_id: '' };

export default function UsersTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [generatedCode, setGeneratedCode] = useState(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['app_users'],
    queryFn: () => api.entities.AppUser.list(),
  });

  const createUser = useMutation({
    mutationFn: (data) => api.entities.AppUser.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['app_users'] }); setShowForm(false); setForm(EMPTY_FORM); setGeneratedCode(null); },
  });

  const updateUser = useMutation({
    mutationFn: ({ id, data }) => api.entities.AppUser.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['app_users'] }); setEditingId(null); setForm(EMPTY_FORM); setGeneratedCode(null); },
  });

  const deleteUser = useMutation({
    mutationFn: (id) => api.entities.AppUser.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['app_users'] }),
  });

  const handleGenerateCode = () => {
    const code = generateCode();
    setGeneratedCode(code);
    setForm(f => ({ ...f, access_code: code }));
  };

  const handleSubmit = () => {
    const payload = {
      ...form,
      is_active: true,
    };
    if (editingId) {
      updateUser.mutate({ id: editingId, data: payload });
    } else {
      createUser.mutate(payload);
    }
  };

  const handleEdit = (user) => {
    setEditingId(user.id);
    setForm({
      full_name: user.full_name || '',
      email: user.email || '',
      role: user.role || 'employee',
      payment_limits: user.payment_limits || {},
      manager_id: user.manager_id || '',
      access_code: user.access_code || '',
    });
    setGeneratedCode(user.access_code || null);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setGeneratedCode(null);
  };

  const managers = users.filter(u => u.role === 'manager' || u.role === 'admin');

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm">User Management</h3>
            <p className="text-xs text-muted-foreground">{users.length} registered users</p>
          </div>
          {!showForm && (
            <Button size="sm" onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); setGeneratedCode(null); }}>
              <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add User
            </Button>
          )}
        </div>

        {/* Form */}
        {showForm && (
          <Card className="p-4 space-y-3 border-primary/30">
            <h4 className="text-sm font-semibold">{editingId ? 'Edit User' : 'New User'}</h4>

            <div className="space-y-2">
              <div className="relative">
                <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Full name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="pl-8 text-sm h-9" />
              </div>
              <div className="relative">
                <Mail className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="pl-8 text-sm h-9" />
              </div>

              {/* Role */}
              <div className="relative">
                <Shield className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full pl-8 pr-3 h-9 text-sm rounded-md border border-input bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>

              {/* Payment limits */}
              <UserLimitsForm
                limits={form.payment_limits || {}}
                onChange={v => setForm(f => ({ ...f, payment_limits: v }))}
              />

              {/* Manager */}
              {form.role === 'employee' && managers.length > 0 && (
                <div className="relative">
                  <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                  <select
                    value={form.manager_id}
                    onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))}
                    className="w-full pl-8 pr-3 h-9 text-sm rounded-md border border-input bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Select manager (optional)</option>
                    {managers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                </div>
              )}

              {/* Access code */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Access code"
                    value={form.access_code || ''}
                    onChange={e => setForm(f => ({ ...f, access_code: e.target.value }))}
                    className="pl-8 text-sm h-9 font-mono"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleGenerateCode} className="h-9 shrink-0">
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Generate
                </Button>
              </div>
              {generatedCode && (
                <p className="text-xs text-emerald-600 font-mono bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                  Access code: <span className="font-bold text-sm">{generatedCode}</span> — share with user
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleSubmit} disabled={!form.full_name || !form.email || createUser.isPending || updateUser.isPending} className="flex-1">
                <Check className="w-3.5 h-3.5 mr-1" /> {editingId ? 'Save' : 'Create User'}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card>
        )}

        {/* Users list */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
        ) : users.length === 0 ? (
          <Card className="p-6 text-center">
            <User className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No users yet. Add your first user.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {users.map(user => (
              <Card key={user.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{user.full_name}</span>
                      <Badge className={`text-[10px] border ${ROLE_COLORS[user.role]}`}>{user.role}</Badge>
                      {!user.is_active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {[['ILS','ils','₪'],['USD','usd','$'],['EUR','eur','€']].map(([cur, key, sym]) =>
                        user.payment_limits?.[`max_single_payment_${key}`] > 0 && (
                          <span key={cur} className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                            {sym}{user.payment_limits[`max_single_payment_${key}`].toLocaleString()} {cur}/tx
                          </span>
                        )
                      )}
                      {[['ILS','ils','₪'],['USD','usd','$'],['EUR','eur','€']].map(([cur, key, sym]) =>
                        user.payment_limits?.[`max_monthly_${key}`] > 0 && (
                          <span key={cur} className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                            {sym}{user.payment_limits[`max_monthly_${key}`].toLocaleString()} {cur}/mo
                          </span>
                        )
                      )}
                      {user.payment_limits?.allowed_currencies?.length > 0 && (
                        <span className="text-[11px] text-purple-700 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5">
                          {user.payment_limits.allowed_currencies.join(', ')}
                        </span>
                      )}
                      {user.payment_limits?.blocked_countries?.length > 0 && (
                        <span className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                          {user.payment_limits.blocked_countries.length} blocked countries
                        </span>
                      )}
                      {user.payment_limits?.requires_dual_approval && (
                        <span className="text-[11px] text-orange-700 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
                          Dual approval
                        </span>
                      )}
                      {(!user.payment_limits || Object.keys(user.payment_limits).length === 0) && (
                        <span className="text-[11px] text-muted-foreground">No limits set</span>
                      )}
                      {user.access_code && (
                        <span className="text-[11px] font-mono text-muted-foreground">
                          <KeyRound className="w-3 h-3 inline mr-0.5" />{user.access_code}
                        </span>
                      )}
                    </div>
                    {user.manager_id && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Manager: {users.find(u => u.id === user.manager_id)?.full_name || '—'}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(user)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteUser.mutate(user.id)}>
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