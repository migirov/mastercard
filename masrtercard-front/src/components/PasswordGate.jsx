import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

const PASSWORD = '0544326303';
const STORAGE_KEY = 'xbs_access_granted';

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
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value === PASSWORD) {
      try {
        sessionStorage.setItem(STORAGE_KEY, 'true');
      } catch {
        /* private mode — gate just won't persist across reloads */
      }
      setGranted(true);
    } else {
      setError(true);
      setValue('');
      setTimeout(() => setError(false), 2000);
    }
  };

  if (granted) return children;

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
              className={`pl-9 ${error ? 'border-destructive ring-1 ring-destructive' : ''}`}
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-destructive text-center">Incorrect password</p>}
          <Button type="submit" className="w-full">Enter</Button>
        </form>
      </div>
    </div>
  );
}