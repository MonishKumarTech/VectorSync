// frontend/src/components/SyncHeader.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { getPendingQueueCount, flushSyncQueue } from '../lib/syncQueue';

export default function SyncHeader() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSynced, setLastSynced] = useState<string>('Just now');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingQueueCount();
      setPendingCount(count);
    } catch {
      // IndexedDB fallback
    }
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setStatusMessage('Working offline. Edits are queued locally.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [refreshPendingCount]);

  const triggerSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setStatusMessage(null);

    try {
      const result = await flushSyncQueue();
      await refreshPendingCount();

      if (result.errors > 0) {
        setStatusMessage('Sync incomplete: Network dropped or server unreachable.');
      } else {
        setLastSynced(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        setStatusMessage(result.syncedCount > 0 ? `Synced ${result.syncedCount} changes.` : 'Cloud is up to date.');
      }
    } catch {
      setStatusMessage('Force sync failed. Changes remain safe locally.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  return (
    <header className="w-full bg-slate-900 border-b border-slate-800 text-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between text-xs sm:text-sm">
      {/* Brand & Connection State */}
      <div className="flex items-center space-x-3">
        <span className="font-bold tracking-wider text-slate-100 text-sm sm:text-base">
          VECTOR<span className="text-amber-500">SYNC</span>
        </span>
        <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium text-xs">Live</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-rose-400 font-medium text-xs">Offline</span>
            </>
          )}
        </div>
      </div>

      {/* Sync Status & Force Sync Button */}
      <div className="flex items-center space-x-3 mt-1 sm:mt-0">
        {pendingCount > 0 ? (
          <span className="flex items-center space-x-1 text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/50">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{pendingCount} pending local change{pendingCount > 1 ? 's' : ''}</span>
          </span>
        ) : (
          <span className="hidden md:flex items-center space-x-1 text-slate-400">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            <span>Synced at {lastSynced}</span>
          </span>
        )}

        {statusMessage && (
          <span className="text-xs text-slate-300 italic hidden lg:inline">
            {statusMessage}
          </span>
        )}

        {/* Force Sync Action Button */}
        <button
          onClick={triggerSync}
          disabled={isSyncing}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded font-medium transition-all ${
            isSyncing
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 active:scale-95 shadow-sm'
          }`}
          title="Manually push pending local changes to the cloud database"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Syncing...' : 'Force Sync'}</span>
        </button>
      </div>
    </header>
  );
}