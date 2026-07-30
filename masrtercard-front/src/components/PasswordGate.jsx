import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { verifyGatePassword } from '@/api/gate';

const STORAGE_KEY = 'xbs_access_granted';

// There is deliberately NO password constant in this file. The value is checked server-side by
// app-bff against DEMO_GATE_PASSWORD; a constant here would be inlined into the built bundle by
// Vite and would therefore ship inside the published image, which is how it leaked before.

/** Messages per failure state. `bad-password` is the only one the user caused. */
const MESSAGES = {
  'bad-password': 'Incorrect password',
  'rate-limited': 'Too many attempts. Try again in a few minutes.',
  unavailable: 'Cannot reach the server. Check that the backend is running.',
};

// sessionStorage can throw (Safari private mode / hardened privacy) — never let that crash the app.
function readGranted() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function PasswordGate({ children }) {
  const [granted, setGranted] = useState(readGranted);
  const [value, setValue] = useState('');
  /** @type {['idle'|'pending'|'bad-password'|'rate-limited'|'unavailable', Function]} */
  const [status, setStatus] = useState('idle');
  const clearTimer = useRef(/** @type {any} */ (null));

  // The 2s auto-clear below sets state on a timer; if the component unmounts first (it unmounts on
  // success) React warns. Cancel on unmount.
  useEffect(
    () => () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    },
    [],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Re-entry guard. Without it, holding Enter fires one request per keypress and burns the whole
    // 10-attempt server-side budget in about a second — locking the user out with a 429.
    if (status === 'pending') return;
    setStatus('pending');

    const result = await verifyGatePassword(value);

    if (result === 'ok') {
      try {
        sessionStorage.setItem(STORAGE_KEY, 'true');
      } catch {
        /* private mode — gate just won't persist across reloads */
      }
      setGranted(true);
      return;
    }

    setStatus(result);
    // Clear the field only when the value was wrong. On a backend failure the value is still
    // correct, so keeping it means a retry after `docker compose up` needs no retyping.
    if (result === 'bad-password') {
      setValue('');
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => setStatus('idle'), 2000);
    }
    // 'rate-limited' and 'unavailable' persist until the next submit: neither condition has gone
    // away after two seconds, so silently hiding the message would just confuse.
  };

  if (granted) return children;

  const pending = status === 'pending';
  const wrongPassword = status === 'bad-password';
  const message = MESSAGES[status];

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 w-full max-w-xs px-6">
        {/* Logo */}
        <div className="w-20 h-20 rounded-full bg-primary shadow-2xl shadow-primary/30 flex flex-col items-center justify-center gap-1">
          <span className="text-white font-black text-xl leading-none tracking-tight">XBS</span>
          <div className="flex items-center -space-x-2">
            <div className="w-4 h-4 rounded-full bg-red-500 opacity-90" />
            <div className="w-4 h-4 rounded-full bg-yellow-400 opacity-90" />
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-xl font-bold">XBS Embedded</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-3">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Password"
              // The red ring keys off a WRONG PASSWORD only — a 502 must not paint the field as
              // though the user erred.
              className={`pl-9 ${wrongPassword ? 'border-destructive ring-1 ring-destructive' : ''}`}
              disabled={pending}
              autoFocus
            />
          </div>
          {message && (
            // Destructive styling only for the user's own mistake; the other two are our fault and
            // are styled as information, so the visual language itself distinguishes them.
            <p
              className={`text-xs text-center ${wrongPassword ? 'text-destructive' : 'text-muted-foreground'}`}
            >
              {message}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Checking…' : 'Enter'}
          </Button>
        </form>
      </div>
    </div>
  );
}
