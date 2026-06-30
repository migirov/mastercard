import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { CreditCard, Plus, Settings, User } from 'lucide-react';

const DEPT_COLORS = {
  Engineering: 'bg-blue-50 text-blue-700',
  Sales: 'bg-green-50 text-green-700',
  Marketing: 'bg-pink-50 text-pink-700',
  Finance: 'bg-violet-50 text-violet-700',
  HR: 'bg-orange-50 text-orange-700',
  Operations: 'bg-cyan-50 text-cyan-700',
  Management: 'bg-yellow-50 text-yellow-700',
  Other: 'bg-gray-50 text-gray-700',
};

export default function EmployeeTable({ employees, cards, isLoading, onCreateCard, onManageCards }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin mr-2" />
        Loading employees...
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <User className="w-10 h-10 opacity-30" />
        <p className="text-sm">No employees found</p>
        <Button variant="outline" size="sm" onClick={() => onCreateCard(null)}>
          <Plus className="w-4 h-4 mr-1" /> Add employee via chatbot
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employee</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Department</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cards</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monthly Budget</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map(emp => {
              const empCards = cards.filter(c => c.employee_id === emp.id);
              const activeCards = empCards.filter(c => c.status === 'active');
              return (
                <TableRow key={emp.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {emp.full_name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{emp.full_name}</p>
                        <p className="text-xs text-muted-foreground">{emp.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{emp.role || '—'}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${DEPT_COLORS[emp.department] || 'bg-gray-50 text-gray-700'}`}>
                      {emp.department}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">{activeCards.length}</span>
                      {empCards.length > activeCards.length && (
                        <span className="text-xs text-muted-foreground">/ {empCards.length}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                      emp.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${emp.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      {emp.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm font-medium tabular-nums">
                    {emp.monthly_budget_ils ? `₪${emp.monthly_budget_ils.toLocaleString()}` : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1"
                        onClick={() => onCreateCard(emp)}>
                        <Plus className="w-3.5 h-3.5" /> Card
                      </Button>
                      {empCards.length > 0 && (
                        <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs gap-1"
                          onClick={() => onManageCards(emp)}>
                          <Settings className="w-3.5 h-3.5" /> Manage
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}