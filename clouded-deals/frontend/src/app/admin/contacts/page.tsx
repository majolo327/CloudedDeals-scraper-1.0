'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const CONTACT_GOAL = 1000;

interface ContactRow {
  id: string;
  anon_id: string | null;
  phone: string | null;
  email: string | null;
  source: string;
  saved_deals_count: number | null;
  zip_entered: string | null;
  created_at: string;
}

interface ContactStats {
  total: number;
  phones: number;
  emails: number;
  bySavedDeals: number;
  byOutOfMarket: number;
  contacts: ContactRow[];
}

export default function ContactsPage() {
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('user_contacts')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      const contacts = (data || []) as ContactRow[];
      setStats({
        total: contacts.length,
        phones: contacts.filter(c => c.phone).length,
        emails: contacts.filter(c => c.email).length,
        bySavedDeals: contacts.filter(c => c.source === 'saved_deals_banner').length,
        byOutOfMarket: contacts.filter(c => c.source === 'out_of_market').length,
        contacts,
      });
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch contacts');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const handleExportCSV = () => {
    if (!stats?.contacts.length) return;

    const headers = ['phone', 'email', 'source', 'saved_deals_count', 'zip_entered', 'created_at'];
    const rows = stats.contacts.map(c =>
      headers.map(h => {
        const val = c[h as keyof ContactRow];
        return val != null ? String(val) : '';
      })
    );

    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clouded-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
        <p className="text-sm text-red-600 dark:text-red-400">Failed to load contacts: {error}</p>
        <button
          onClick={fetchStats}
          className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const progressPct = Math.min((stats.total / CONTACT_GOAL) * 100, 100);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            VIP Waitlist
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Contact collection for launch campaign (60-90 day horizon)
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={!stats.contacts.length}
          className="rounded-md bg-green-600 px-4 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      {/* Progress to 1,000 */}
      <div className="rounded-xl border border-zinc-200 bg-gradient-to-r from-purple-50 to-fuchsia-50 dark:border-zinc-800 dark:from-purple-950/30 dark:to-fuchsia-950/30">
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Progress to {CONTACT_GOAL.toLocaleString()} Contacts
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Phone numbers preferred for SMS campaign
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                {stats.total.toLocaleString()}
              </p>
              <p className="text-xs text-zinc-500">/ {CONTACT_GOAL.toLocaleString()}</p>
            </div>
          </div>
          <div className="h-4 rounded-full bg-white/60 dark:bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-400 transition-all duration-700"
              style={{ width: `${Math.max(progressPct, 0.5)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Scoreboard */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <StatCard label="Total Contacts" value={stats.total} />
        <StatCard label="Phone Numbers" value={stats.phones} />
        <StatCard label="Emails" value={stats.emails} />
        <StatCard label="From Saved Deals" value={stats.bySavedDeals} />
      </div>

      {/* Source breakdown */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">By Source</h3>
        </div>
        <div className="p-4 space-y-3">
          <SourceBar label="Saved Deals Banner" count={stats.bySavedDeals} total={stats.total} />
          <SourceBar label="Out of Market" count={stats.byOutOfMarket} total={stats.total} />
        </div>
      </div>

      {/* Recent contacts table */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Recent Contacts ({stats.contacts.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-100 text-xs text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Saves</th>
                <th className="px-4 py-2 font-medium">Zip</th>
                <th className="px-4 py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {stats.contacts.slice(0, 100).map((c) => (
                <tr key={c.id} className="text-zinc-700 dark:text-zinc-300">
                  <td className="px-4 py-2 text-xs font-mono">{c.phone || '-'}</td>
                  <td className="px-4 py-2 text-xs">{c.email || '-'}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.source === 'saved_deals_banner'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                    }`}>
                      {c.source === 'saved_deals_banner' ? 'Saved Deals' : c.source === 'out_of_market' ? 'Out of Market' : c.source}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-400">{c.saved_deals_count ?? '-'}</td>
                  <td className="px-4 py-2 text-xs text-zinc-400">{c.zip_entered || '-'}</td>
                  <td className="px-4 py-2 text-xs text-zinc-400 whitespace-nowrap">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {stats.contacts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                    No contacts captured yet. They&apos;ll show up here when users submit their info.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-1.5">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function SourceBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
      <div className="flex-1 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-purple-500/60"
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>
      <span className="w-12 text-right text-xs font-mono font-bold text-zinc-600 dark:text-zinc-300">{count}</span>
    </div>
  );
}
