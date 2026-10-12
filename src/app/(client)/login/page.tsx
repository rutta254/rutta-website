// src/app/(client)/login/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { FcGoogle } from 'react-icons/fc';
import { FaGithub, FaXTwitter, FaFacebook, FaDiscord, FaReddit, FaLinkedin } from 'react-icons/fa6';

export default function ClientLoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistering) {
      alert(`Registering client: ${name} with ${identifier}`);
    } else {
      alert(`Logging in client with: ${identifier}`);
    }
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

        {/* Primary Social Provider (Google) */}
        <div>
          <button
            onClick={() => signIn('google', { callbackUrl: '/hub' })}
            className="w-full py-3 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 flex items-center justify-center gap-3 transition shadow-sm"
          >
            <FcGoogle className="text-base" /> Continue with Google
          </button>
        </div>

        {/* Secondary Social Providers Grid */}
        <div className="space-y-2">
          <p className="text-center text-[10px] uppercase font-bold tracking-widest text-slate-500">
            Or log in with preferred media
          </p>
          
          <div className="grid grid-cols-3 gap-2">
            {/* GitHub */}
            <button
              onClick={() => signIn('github', { callbackUrl: '/hub' })}
              className="py-2.5 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 flex items-center justify-center gap-2 transition"
              title="Sign in with GitHub"
            >
              <FaGithub className="text-sm" /> <span className="hidden sm:inline">GitHub</span>
            </button>

            {/* X (Twitter) */}
            <button
              onClick={() => signIn('twitter', { callbackUrl: '/hub' })}
              className="py-2.5 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 flex items-center justify-center gap-2 transition"
              title="Sign in with X"
            >
              <FaXTwitter className="text-sm" /> <span className="hidden sm:inline">X</span>
            </button>

            {/* Meta / Facebook */}
            <button
              onClick={() => signIn('facebook', { callbackUrl: '/hub' })}
              className="py-2.5 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 flex items-center justify-center gap-2 transition"
              title="Sign in with Meta / Facebook"
            >
              <FaFacebook className="text-sm text-blue-500" /> <span className="hidden sm:inline">Meta</span>
            </button>

            {/* Discord */}
            <button
              onClick={() => signIn('discord', { callbackUrl: '/hub' })}
              className="py-2.5 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 flex items-center justify-center gap-2 transition"
              title="Sign in with Discord"
            >
              <FaDiscord className="text-sm text-indigo-400" /> <span className="hidden sm:inline">Discord</span>
            </button>

            {/* Reddit */}
            <button
              onClick={() => signIn('reddit', { callbackUrl: '/hub' })}
              className="py-2.5 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 flex items-center justify-center gap-2 transition"
              title="Sign in with Reddit"
            >
              <FaReddit className="text-sm text-orange-500" /> <span className="hidden sm:inline">Reddit</span>
            </button>

            {/* LinkedIn */}
            <button
              onClick={() => signIn('linkedin', { callbackUrl: '/hub' })}
              className="py-2.5 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 flex items-center justify-center gap-2 transition"
              title="Sign in with LinkedIn"
            >
              <FaLinkedin className="text-sm text-blue-400" /> <span className="hidden sm:inline">LinkedIn</span>
            </button>
          </div>
        </div>

        <div className="flex items-center my-4">
          <div className="flex-grow border-t border-slate-800"></div>
          <span className="px-3 text-xs text-slate-500 uppercase tracking-widest">Or with email / phone</span>
          <div className="flex-grow border-t border-slate-800"></div>
        </div>

        {/* Credentials Form */}
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

        {/* Navigation / Toggle */}
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