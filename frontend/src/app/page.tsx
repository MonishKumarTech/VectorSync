'use client';

import React, { useEffect, useState } from 'react';
import { queueMutation } from '../../lib/syncQueue';

interface DashboardStat {
  status: string;
  count: number;
}

export default function HomePage() {
  const [stats, setStats] = useState<DashboardStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/dashboard/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats || []);
      }
    } catch {
      setActionMessage('Unable to reach backend; running offline mode.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Simulates updating Project 1 — if offline, queues mutation locally
  const handleSimulateStatusUpdate = async (newStatus: string) => {
    setActionMessage(null);
    const endpoint = '/api/projects/1/status';
    const payload = {
      status: newStatus,
      update_text: `Status changed to ${newStatus} from Next.js UI`,
    };

    if (!navigator.onLine) {
      await queueMutation(endpoint, 'PATCH', payload);
      setActionMessage(`Offline: Queued status change (${newStatus}) in IndexedDB.`);
      return;
    }

    try {
      const res = await fetch(`http://localhost:8000${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setActionMessage(`Status updated to ${newStatus} and logged.`);
        fetchStats();
      } else {
        await queueMutation(endpoint, 'PATCH', payload);
        setActionMessage('Server error: Queued change locally.');
      }
    } catch {
      await queueMutation(endpoint, 'PATCH', payload);
      setActionMessage('Network error: Queued change locally.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Operations Control</h1>
          <p className="text-xs text-slate-400 mt-1">Multi-Partner Unified Dashboard</p>
        </div>
        <button
          onClick={fetchStats}
          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded transition"
        >
          Refresh Data
        </button>
      </div>

      {actionMessage && (
        <div className="p-3 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded">
          {actionMessage}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {['Pending', 'Completed', 'Postponed'].map((statusKey) => {
          const item = stats.find((s) => s.status === statusKey);
          return (
            <div key={statusKey} className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                {statusKey} Projects
              </span>
              <p className="text-2xl font-semibold text-slate-100 mt-2">
                {loading ? '...' : item ? item.count : 0}
              </p>
            </div>
          );
        })}
      </div>

      {/* Test Action Sandbox */}
      <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-lg space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Force Sync & Offline Queue Test</h2>
        <p className="text-xs text-slate-400">
          Click a button to update Project #1. If offline, the action is queued locally in IndexedDB and flagged in the top banner.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={() => handleSimulateStatusUpdate('Pending')}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded"
          >
            Set Project 1: Pending
          </button>
          <button
            onClick={() => handleSimulateStatusUpdate('Completed')}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white rounded"
          >
            Set Project 1: Completed
          </button>
          <button
            onClick={() => handleSimulateStatusUpdate('Postponed')}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-xs font-medium text-white rounded"
          >
            Set Project 1: Postponed
          </button>
        </div>
      </div>
    </div>
  );
}