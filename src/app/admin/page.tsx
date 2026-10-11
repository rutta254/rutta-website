// src/app/admin/page.tsx
'use client';

import Link from 'next/link';

export default function AdminOverview() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white">Admin Control Center</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your enterprise ventures, backend pipelines, and platform states.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-900">Haya Structures</h3>
          <p className="text-xs text-slate-500 mt-1">Engineering tools & API telemetry.</p>
          <Link href="/haya-structures" className="text-xs font-semibold text-blue-600 mt-4 block">
            View Live Suite &rarr;
          </Link>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-900">Automation Workflows</h3>
          <p className="text-xs text-slate-500 mt-1">Manage Make.com / n8n cross-posting.</p>
          <span className="text-xs font-semibold text-purple-600 mt-4 block">Connected</span>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-900">System Security</h3>
          <p className="text-xs text-slate-500 mt-1">Admin Session Status: Active</p>
          <span className="text-xs font-semibold text-emerald-600 mt-4 block">Protected</span>
        </div>
      </div>
    </div>
  );
}