import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Loader2, AlertTriangle, Inbox } from 'lucide-react';

/**
 * Shared chrome for the "Features" pages. Each page maps to a Mastercard cross-border API
 * the core flow never surfaced; the `source` badge tells the user whether the data they're
 * looking at is a real Mastercard answer (`live`) or a synthesized one (`demo`).
 */

/** Live (real Mastercard) vs Demo (synthesized) badge — driven by a response's `source`. */
export function SourceBadge({ source }) {
  if (!source) return null;
  const live = source === 'live';
  return (
    <Badge
      className={`text-[10px] ${
        live
          ? 'bg-green-50 text-green-700 border-green-200'
          : 'bg-amber-50 text-amber-700 border-amber-200'
      }`}
    >
      {live ? 'Live · Mastercard' : 'Demo'}
    </Badge>
  );
}

/** Page wrapper: centered column, header with icon/title/subtitle + the source badge. */
export default function FeatureShell({ icon: Icon, title, subtitle, source, children }) {
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">
      <header className="space-y-1">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
          )}
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          <SourceBadge source={source} />
        </div>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </header>
      {children}
    </div>
  );
}

/** A titled card section (form or results). */
export function FeatureCard({ title, children, className = '' }) {
  return (
    <Card className={`p-5 space-y-4 ${className}`}>
      {title && (
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
      )}
      {children}
    </Card>
  );
}

/**
 * Uniform result area: shows a spinner while loading, the error message on failure, an
 * empty state when there's nothing, else the children. `empty` is a boolean the caller
 * computes (e.g. `!result` or `rows.length === 0`).
 */
export function ResultPanel({ loading, error, empty, emptyHint, children }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{String(error)}</span>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground py-8">
        <Inbox className="w-6 h-6 opacity-50" />
        {emptyHint || 'Submit the form to see results.'}
      </div>
    );
  }
  return children;
}

/**
 * Simple table from an array of row objects. `columns` is `[{ key, label, render? }]`.
 * Renders nothing if there are no rows (let ResultPanel handle the empty state).
 */
export function DataTable({ columns, rows }) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-left">
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border">
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2 align-top">
                  {c.render ? c.render(row) : displayValue(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Key/value list for a single object result. `entries` is `[[label, value], ...]`. */
export function KeyValueList({ entries }) {
  return (
    <dl className="divide-y divide-border rounded-lg border border-border">
      {entries
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-3 py-2 text-sm">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium text-right break-all">{displayValue(v)}</dd>
          </div>
        ))}
    </dl>
  );
}

function displayValue(v) {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
