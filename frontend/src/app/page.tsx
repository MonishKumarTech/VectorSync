'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Plus, 
  RefreshCw, 
  Calendar, 
  AlertTriangle, 
  Users, 
  Filter, 
  X, 
  LogOut, 
  ShieldCheck, 
  Layers,
  Sliders
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import LoginModal from '@/components/LoginModal';
import NewProjectModal from '@/components/NewProjectModal';
import WorkTable, { WorkProject } from '@/components/WorkTable';
import CustomerBoard, { CustomerStats } from '@/components/CustomerBoard';
import AdminMasterPanel from '@/components/AdminMasterPanel';
import AdminProjectEditModal from '@/components/AdminProjectEditModal';
import GroupHub from '@/components/GroupHub';

interface DashboardStat {
  status: string;
  count: number;
}

export default function HomePage() {
  const { user, logout, activeGroup, authFetch, isLoading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<'schedule' | 'backlog' | 'customers' | 'filtered' | 'grouphub' | 'console'>('schedule');

  // Drill-Down Filters
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string | null>(null);
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<{ id: number; name: string } | null>(null);

  // Edit Project State
  const [editingProject, setEditingProject] = useState<WorkProject | null>(null);

  const [stats, setStats] = useState<DashboardStat[]>([]);
  const [scheduleProjects, setScheduleProjects] = useState<WorkProject[]>([]);
  const [backlogProjects, setBacklogProjects] = useState<WorkProject[]>([]);
  const [customers, setCustomers] = useState<CustomerStats[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<WorkProject[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const isSystemAdmin = user?.role === 'system' || (user as any)?.role === 'admin';
    const effectiveUserId = user?.id ?? (user as any)?.user_id;

    const queryParam = isSystemAdmin 
      ? '?is_admin=true' 
      : (effectiveUserId ? `?user_id=${effectiveUserId}` : '');

    try {
      const [statsRes, schedRes, backRes, custRes] = await Promise.all([
        authFetch(`/api/dashboard/stats${queryParam}`),
        authFetch(`/api/projects/schedule${queryParam}`),
        authFetch(`/api/projects/backlog${queryParam}`),
        authFetch('/api/customers/board'),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats || []);
      }
      if (schedRes.ok) setScheduleProjects((await schedRes.json()).schedule || []);
      if (backRes.ok) setBacklogProjects((await backRes.json()).backlog || []);
      if (custRes.ok) setCustomers((await custRes.json()).board || []);
    } catch {
      setActionNotice('Running in offline / local cache mode.');
    } finally {
      setLoading(false);
    }
  }, [user, authFetch]);

  const loadFilteredProjects = useCallback(async () => {
    if (!selectedStatusFilter && !selectedCustomerFilter) return;

    setLoading(true);
    const params = new URLSearchParams();
    if (selectedStatusFilter) params.append('status', selectedStatusFilter);
    if (selectedCustomerFilter) params.append('customer_id', selectedCustomerFilter.id.toString());
    
    if (user?.role === 'system') {
      params.append('is_admin', 'true');
    } else if (user?.id) {
      params.append('user_id', user.id.toString());
    }

    try {
      const res = await authFetch(`/api/projects/all?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setFilteredProjects(data.projects || []);
        setActiveTab('filtered');
      }
    } catch {
      setActionNotice('Failed to fetch filtered projects.');
    } finally {
      setLoading(false);
    }
  }, [selectedStatusFilter, selectedCustomerFilter, user, authFetch]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  useEffect(() => {
    if (selectedStatusFilter || selectedCustomerFilter) {
      loadFilteredProjects();
    }
  }, [selectedStatusFilter, selectedCustomerFilter, loadFilteredProjects]);

  const handleStatusCardClick = (statusKey: string) => {
    setSelectedCustomerFilter(null);
    setSelectedStatusFilter(statusKey);
  };

  const handleCustomerSelect = (customerId: number, customerName: string) => {
    setSelectedStatusFilter(null);
    setSelectedCustomerFilter({ id: customerId, name: customerName });
  };

  const clearDrillDownFilter = () => {
    setSelectedStatusFilter(null);
    setSelectedCustomerFilter(null);
    setActiveTab('schedule');
    loadData();
  };

  const handleStatusChange = async (projectId: number, newStatus: string) => {
    setActionNotice(null);
    const payload = {
      status: newStatus,
      update_text: `Status transitioned to ${newStatus} via VectorSync Workspace`,
    };

    try {
      const res = await authFetch(`/api/projects/${projectId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setActionNotice(`Project #${projectId} updated to ${newStatus}.`);
        loadData();
        if (selectedStatusFilter || selectedCustomerFilter) {
          loadFilteredProjects();
        }
      } else {
        const err = await res.json();
        setActionNotice(`Error: ${err.detail || 'Server rejected status update.'}`);
      }
    } catch {
      setActionNotice('Connection lost.');
    } finally {
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-xs">
        Loading VectorSync Portal...
      </div>
    );
  }

  if (!user) {
    return <LoginModal />;
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Session Top Bar with Live Active Group Sync */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">
              VectorSync {user.role === 'system' ? '• System Console' : ''}
            </h1>
            <p className="text-[11px] text-slate-400">
              User: <span className="font-semibold text-slate-200">{user.display_name}</span>
              {' • '}
              Active Group: <span className="text-amber-400 font-medium">
                {user.role === 'system' 
                  ? 'Global Overseer (Detached)' 
                  : activeGroup 
                    ? `${activeGroup.name} (${activeGroup.role_in_group.toUpperCase()})` 
                    : 'No Group Enrolled'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => {
              loadData();
              if (selectedStatusFilter || selectedCustomerFilter) loadFilteredProjects();
            }}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
          
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-lg transition shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="flex items-center space-x-1 text-xs text-slate-400 hover:text-rose-400 bg-slate-800/80 hover:bg-slate-800 px-3 py-2 rounded-lg transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl">
          {actionNotice}
        </div>
      )}

      {/* Aggregate Metric Cards */}
      <div>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Click any card to inspect projects by status:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {['Pending', 'In Progress', 'Completed', 'Postponed'].map((statusKey) => {
            const item = stats.find(
              (s) => s.status?.trim().toLowerCase() === statusKey.trim().toLowerCase()
            );
            const isCardActive = selectedStatusFilter === statusKey;

            return (
              <div
                key={statusKey}
                onClick={() => handleStatusCardClick(statusKey)}
                className={`p-4 rounded-xl border transition cursor-pointer select-none ${
                  isCardActive
                    ? 'bg-amber-500/10 border-amber-500 shadow-md ring-1 ring-amber-500'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    {statusKey}
                  </span>
                  {isCardActive && <Filter className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <p className="text-xl sm:text-2xl font-bold text-slate-100 mt-1">
                  {loading ? '...' : (item ? item.count : 0)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Filter Banner */}
      {(selectedStatusFilter || selectedCustomerFilter) && (
        <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 rounded-xl">
          <div className="flex items-center space-x-2 text-xs text-amber-300">
            <Filter className="w-4 h-4 text-amber-400" />
            <span>
              Filtered by:{' '}
              <strong className="text-white">
                {selectedStatusFilter ? `Status: ${selectedStatusFilter}` : `Client: ${selectedCustomerFilter?.name}`}
              </strong>
            </span>
          </div>
          <button
            type="button"
            onClick={clearDrillDownFilter}
            className="flex items-center space-x-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-md transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear Filter</span>
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-6 text-xs font-semibold overflow-x-auto">
        {(selectedStatusFilter || selectedCustomerFilter) && (
          <button
            onClick={() => setActiveTab('filtered')}
            className={`flex items-center space-x-2 pb-3 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'filtered'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filtered ({filteredProjects.length})</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('schedule')}
          className={`flex items-center space-x-2 pb-3 border-b-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'schedule'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Today&apos;s Schedule ({scheduleProjects.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('backlog')}
          className={`flex items-center space-x-2 pb-3 border-b-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'backlog'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Overdue Backlog ({backlogProjects.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('customers')}
          className={`flex items-center space-x-2 pb-3 border-b-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'customers'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Customer Board ({customers.length})</span>
        </button>

        {/* Group Hub Tab */}
        <button
          onClick={() => setActiveTab('grouphub')}
          className={`flex items-center space-x-2 pb-3 border-b-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'grouphub'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Group Hub & Chatbox</span>
        </button>

        {/* Super-Access System Console: only for role == 'system' */}
        {user.role === 'system' && (
          <button
            onClick={() => setActiveTab('console')}
            className={`flex items-center space-x-2 pb-3 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'console'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>System Console</span>
          </button>
        )}
      </div>

      {/* Tab Views */}
      {activeTab === 'filtered' && (
        <WorkTable
          projects={filteredProjects}
          isBacklogView={false}
          onStatusChange={handleStatusChange}
          onEditProject={(p) => setEditingProject(p)}
        />
      )}

      {activeTab === 'schedule' && (
        <WorkTable
          projects={scheduleProjects}
          isBacklogView={false}
          onStatusChange={handleStatusChange}
          onEditProject={(p) => setEditingProject(p)}
        />
      )}

      {activeTab === 'backlog' && (
        <WorkTable
          projects={backlogProjects}
          isBacklogView={true}
          onStatusChange={handleStatusChange}
          onEditProject={(p) => setEditingProject(p)}
        />
      )}

      {activeTab === 'customers' && (
        <CustomerBoard
          customers={customers}
          onSelectCustomer={handleCustomerSelect}
        />
      )}

      {activeTab === 'grouphub' && (
        <GroupHub />
      )}

      {activeTab === 'console' && user.role === 'system' && (
        <AdminMasterPanel />
      )}

      {/* Modals */}
      <NewProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onProjectCreated={() => {
          loadData();
          if (selectedStatusFilter || selectedCustomerFilter) loadFilteredProjects();
        }}
      />

      <AdminProjectEditModal
        project={editingProject}
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        onSaved={() => {
          loadData();
          if (selectedStatusFilter || selectedCustomerFilter) loadFilteredProjects();
        }}
      />
    </div>
  );
}