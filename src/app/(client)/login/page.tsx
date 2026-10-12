// src/app/(client)/login/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ClientLoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [identifier, setIdentifier] = useState(''); // Email or Phone
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistering) {
      alert(`Registering client: ${name} with ${identifier}`);
      // Add your client registration logic here (e.g., Firebase, Supabase, or NextAuth)
    } else {
      alert(`Logging in client with: ${identifier}`);
      // Add your client login logic here
    }
  };

  const handleSocialLogin = (provider: string) => {
    alert(`Redirecting to ${provider} authentication...`);
    // Integrate Google / Social provider callback here
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black tracking-wider text-cyan-400">RUTTA GROUP</h1>
          <p className="text-xs text-slate-400">
            {isRegistering ? 'Create a new client account to save your progress.' : 'Sign in to access your client hub & projects.'}
          </p>
        </div>

        {/* Social Logins Integration Placeholder */}
        <div className="space-y-3">
          <button
            onClick={() => handleSocialLogin('Google')}
            className="w-full py-3 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 flex items-center justify-center gap-3 transition"
          >
            <span>🌐</span> Continue with Google
          </button>
        </div>

        <div className="flex items-center my-4">
          <div className="flex-grow border-t border-slate-800"></div>
          <span className="px-3 text-xs text-slate-500 uppercase tracking-widest">Or with email / phone</span>
          <div className="flex-grow border-t border-slate-800"></div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Full Name / Company
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe / Engineering Corp"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition text-sm"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Email Address or Phone Number
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="name@example.com or +123456789"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition text-sm"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-cyan-500/20"
          >
            {isRegistering ? 'Register Account' : 'Sign In'}
          </button>
        </form>

        {/* Toggle between Login and Register */}
        <div className="text-center text-xs text-slate-400 space-y-2 pt-2">
          <p>
            {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-cyan-400 font-semibold hover:underline ml-1"
            >
              {isRegistering ? 'Sign In' : 'Register Now'}
            </button>
          </p>
          <div className="pt-2">
            <Link href="/" className="text-slate-500 hover:text-slate-300 transition">
              &larr; Return to Rutta Group Gateway
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}