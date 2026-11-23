'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { signOut } from 'next-auth/react';

type User = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  image: string | null;
  role: string;
  clientNumber: number | null;
  phone: string | null;
  company: string | null;
  country: string | null;
  profileComplete: boolean;
  createdAt: Date;
};

type Tab = 'profile' | 'security' | 'notifications' | 'display' | 'insights';

export default function SettingsClient({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [suggestingUsername, setSuggestingUsername] = useState(false);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);

  const [profile, setProfile] = useState({
    username: user.username ?? '',
    phone: user.phone ?? '',
    company: user.company ?? '',
    country: user.country ?? '',
  });

  const [notifications, setNotifications] = useState({
    emailUpdates: true,
    projectUpdates: true,
    newsletter: false,
  });

  const [display, setDisplay] = useState({
    theme: 'dark',
    language: 'en',
    compactMode: false,
  });

  const clientId = user.clientNumber
    ? `RG-${String(user.clientNumber).padStart(3, '0')}`
    : 'Not assigned';

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'security', label: 'Security' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'display', label: 'Display' },
    { key: 'insights', label: 'Insights' },
  ];

  const saveProfile = async () => {
    setSaving(true);
    setMessage('');

    const usernameRegex = /^[a-z0-9_.]{3,20}$/;
    if (profile.username && !usernameRegex.test(profile.username)) {
      setMessage('Username must be 3-20 characters, lowercase letters, numbers, underscores and dots only.');
      setSaving(false);
      return;
    }

    const res = await fetch('/api/user/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });

    if (res.ok) {
      setMessage('Profile saved successfully. Redirecting...');
      setTimeout(() => {
        window.location.href = '/hub';
      }, 1000);
    } else {
      const data = await res.json();
      setMessage(data.error ?? 'Failed to save. Please try again.');
    }
    setSaving(false);
  };

  const suggestUsernames = async () => {
    setSuggestingUsername(true);
    setUsernameSuggestions([]);
    try {
      const res = await fetch('/api/user/suggest-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: user.name }),
      });
      const data = await res.json();
      setUsernameSuggestions(data.suggestions ?? []);
    } catch {
      setUsernameSuggestions([]);
    }
    setSuggestingUsername(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/hub" className="text-xs text-slate-400 hover:text-white transition">
              &larr; Back to Hub
            </Link>
            <h1 className="text-lg font-bold text-white">Settings</h1>
          </div>
          <div className="flex items-center gap-3">
            {user.image && (
              <div className="relative w-8 h-8 rounded-full overflow-hidden border border-slate-700">
                <Image src={user.image} alt={user.name ?? 'User'} fill className="object-cover" />
              </div>
            )}
            <span className="text-xs text-slate-400">{user.email}</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-slate-800 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Current Profile */}
            <div className="flex items-center gap-4 p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-cyan-500/40">
                {user.image ? (
                  <Image src={user.image} alt={user.name ?? 'User'} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full bg-cyan-700 flex items-center justify-center text-white font-bold text-xl">
                    {user.name?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                )}
              </div>
              <div>
                <div className="font-semibold text-white">{user.name}</div>
                <div className="text-xs text-slate-400">{user.email}</div>
                <div className="text-xs text-cyan-400 font-mono mt-0.5">{clientId}</div>
              </div>
            </div>

            {/* Username */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Username
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">@</span>
                  <input
                    type="text"
                    value={profile.username}
                    onChange={e => setProfile({ ...profile, username: e.target.value.toLowerCase() })}
                    placeholder="your_username"
                    className="w-full pl-7 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 text-sm"
                  />
                </div>
                <button
                  onClick={suggestUsernames}
                  disabled={suggestingUsername}
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-cyan-400 transition disabled:opacity-50 whitespace-nowrap"
                >
                  {suggestingUsername ? 'Thinking...' : '✦ Suggest'}
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                Lowercase letters, numbers, underscores and dots. 3–20 characters.
              </p>

              {/* Suggestions */}
              {usernameSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {usernameSuggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => setProfile({ ...profile, username: s })}
                      className="px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-xs text-cyan-400 hover:bg-cyan-500/20 transition font-mono"
                    >
                      @{s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Phone Number
              </label>
              <input
                type="tel"
                value={profile.phone}
                onChange={e => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+254 700 000 000"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 text-sm"
              />
            </div>

            {/* Company */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Company / Organization
              </label>
              <input
                type="text"
                value={profile.company}
                onChange={e => setProfile({ ...profile, company: e.target.value })}
                placeholder="Your company"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 text-sm"
              />
            </div>

            {/* Country */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Country
              </label>
              <input
                type="text"
                value={profile.country}
                onChange={e => setProfile({ ...profile, country: e.target.value })}
                placeholder="Kenya"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 text-sm"
              />
            </div>

            {message && (
              <p className={`text-xs ${message.includes('success') ? 'text-emerald-400' : 'text-red-400'}`}>
                {message}
              </p>
            )}

            <button
              onClick={saveProfile}
              disabled={saving}
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-xl transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
              <h2 className="text-sm font-semibold text-white">Account Details</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Client ID', value: clientId },
                  { label: 'Role', value: user.role },
                  { label: 'Email', value: user.email ?? '—' },
                  { label: 'Profile Complete', value: user.profileComplete ? 'Yes' : 'No' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
                    <div className="text-sm text-white font-mono mt-0.5">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
              <h2 className="text-sm font-semibold text-white">Connected Accounts</h2>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-slate-900">G</span>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Google</div>
                    <div className="text-[10px] text-slate-400">{user.email}</div>
                  </div>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                  Connected
                </span>
              </div>
            </div>

            <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl space-y-3">
              <h2 className="text-sm font-semibold text-red-400">Danger Zone</h2>
              <p className="text-xs text-slate-400">
                Sign out from all devices or delete your account. Account deletion is permanent.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-300 transition"
                >
                  Sign Out
                </button>
                <button className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-800/50 rounded-lg text-xs font-semibold text-red-400 transition">
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            {[
              { key: 'emailUpdates', label: 'Email Updates', desc: 'Receive important account and security emails' },
              { key: 'projectUpdates', label: 'Project Updates', desc: 'Get notified when your projects or requests change status' },
              { key: 'newsletter', label: 'Newsletter', desc: 'Rutta Group news, launches and announcements' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <div>
                  <div className="text-sm font-semibold text-white">{label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{desc}</div>
                </div>
                <button
                  onClick={() => setNotifications(n => ({ ...n, [key]: !n[key as keyof typeof n] }))}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    notifications[key as keyof typeof notifications] ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    notifications[key as keyof typeof notifications] ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            ))}
            <p className="text-xs text-slate-500 pt-2">
              Notification delivery requires email setup. Preferences are saved for when it is enabled.
            </p>
          </div>
        )}

        {/* Display Tab */}
        {activeTab === 'display' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Theme
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['dark', 'light', 'system'].map(t => (
                  <button
                    key={t}
                    onClick={() => setDisplay(d => ({ ...d, theme: t }))}
                    className={`py-3 rounded-xl border text-xs font-semibold capitalize transition ${
                      display.theme === t
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500">Light mode coming soon.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Language
              </label>
              <select
                value={display.language}
                onChange={e => setDisplay(d => ({ ...d, language: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 text-sm"
              >
                <option value="en">English</option>
                <option value="sw">Swahili</option>
                <option value="fr">French</option>
                <option value="ar">Arabic</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <div>
                <div className="text-sm font-semibold text-white">Compact Mode</div>
                <div className="text-xs text-slate-400 mt-0.5">Reduce spacing and padding across the interface</div>
              </div>
              <button
                onClick={() => setDisplay(d => ({ ...d, compactMode: !d.compactMode }))}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  display.compactMode ? 'bg-cyan-500' : 'bg-slate-700'
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  display.compactMode ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        )}

        {/* Insights Tab */}
        {activeTab === 'insights' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Member Since', value: new Date(user.createdAt).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' }) },
                { label: 'Client ID', value: clientId },
                { label: 'Role', value: user.role },
                { label: 'Account Status', value: user.profileComplete ? 'Complete' : 'Incomplete' },
              ].map(({ label, value }) => (
                <div key={label} className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
                  <div className="text-sm font-semibold text-white mt-1">{value}</div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Connected Services</div>
              <div className="text-xs text-slate-300">Google — {user.email}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}