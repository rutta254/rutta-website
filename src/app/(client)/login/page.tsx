'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { FcGoogle } from 'react-icons/fc';
import { FaGithub, FaXTwitter, FaFacebook, FaDiscord, FaLinkedin } from 'react-icons/fa6';

function EmailSignInForm() {
  const [email, setEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);
    setIsError(false);

    try {
      const result = await signIn('email', {
        email: email.trim(),
        callbackUrl: '/admin',
        redirect: false,
      });

      if (result?.error) {
        setIsError(true);
        setStatusMessage('Could not send magic link. Please check your email and SMTP configuration.');
      } else {
        setStatusMessage('Magic sign-in link sent! Check your inbox and click the link to open /admin.');
      }
    } catch {
      setIsError(true);
      setStatusMessage('Something went wrong while requesting the sign-in link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleEmailSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Email Address (Magic Link)
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="the_subSaharan@proton.me"
          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition text-sm"
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-cyan-500/20 disabled:opacity-60"
      >
        {loading ? 'Sending Magic Link...' : 'Send Magic Sign-In Link'}
      </button>

      {statusMessage && (
        <p className={`text-xs text-center ${isError ? 'text-rose-400' : 'text-emerald-400'}`}>
          {statusMessage}
        </p>
      )}
    </form>
  );
}

export default function ClientLoginPage() {
  const handleSocialLogin = async (provider: 'google' | 'github') => {
    await signIn(provider, { callbackUrl: '/hub' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black tracking-wider text-cyan-400">RUTTA GROUP</h1>
          <p className="text-xs text-slate-400">
            Sign in with a magic email link or continue with your connected provider.
          </p>
        </div>

        {/* Email Magic Link Form (Required for RG000 Admin) */}
        <EmailSignInForm />

        <div className="flex items-center my-2">
          <div className="flex-grow border-t border-slate-800" />
          <span className="px-3 text-xs text-slate-500 uppercase tracking-widest">Or OAuth</span>
          <div className="flex-grow border-t border-slate-800" />
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={() => handleSocialLogin('google')}
          className="w-full py-3 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 flex items-center justify-center gap-3 transition shadow-sm"
        >
          <FcGoogle className="text-base" /> Continue with Google
        </button>

        {/* GitHub */}
        <button
          type="button"
          onClick={() => handleSocialLogin('github')}
          className="w-full py-3 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-xl text-xs font-semibold text-slate-200 flex items-center justify-center gap-3 transition shadow-sm"
        >
          <FaGithub className="text-base text-white" /> Continue with GitHub
        </button>

        {/* Coming Soon Providers */}
        <div className="space-y-2">
          <p className="text-center text-[10px] uppercase font-bold tracking-widest text-slate-600">
            Coming Soon
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: <FaXTwitter className="text-sm" />, label: 'X' },
              { icon: <FaFacebook className="text-sm text-blue-500/40" />, label: 'Meta' },
              { icon: <FaLinkedin className="text-sm text-blue-400/40" />, label: 'LinkedIn' },
              { icon: <FaDiscord className="text-sm text-indigo-400/40" />, label: 'Discord' },
            ].map(({ icon, label }) => (
              <div
                key={label}
                title={`${label} — Coming Soon`}
                className="py-2.5 px-3 bg-slate-950/50 border border-slate-800/50 rounded-xl text-xs font-medium text-slate-600 flex items-center justify-center gap-2 cursor-not-allowed opacity-50"
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center text-xs text-slate-400 pt-2">
          <Link href="/" className="text-slate-500 hover:text-slate-300 transition">
            &larr; Return to Rutta Group Gateway
          </Link>
        </div>
      </div>
    </div>
  );
}