// src/app/admin/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Set your secure master password here
    if (password === 'RuttaGroup2026!') {
      // Secure admin cookie valid for 24 hours
      document.cookie = "admin_auth=true; path=/; max-age=86400; Secure; SameSite=Strict";
      router.push('/admin');
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
        
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black tracking-wider text-cyan-400">RUTTA ADMIN</h1>
          <p className="text-xs text-slate-400">Enter your master password to access the control panel.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Master Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              placeholder="••••••••••••"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition"
              required
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 font-medium text-center">
              Invalid password. Please try again.
            </p>
          )}

          <button
            type="submit"
            className="w-full py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-cyan-500/20"
          >
            Authenticate & Access
          </button>
        </form>

        <div className="text-center pt-2">
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition">
            &larr; Return to Rutta Group Gateway
          </Link>
        </div>

      </div>
    </div>
  );
}