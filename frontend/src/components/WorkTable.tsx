'use client';

import React, { useState } from 'react';
import { ExternalLink, MessageCircle, AlertTriangle, CheckCircle2, Edit3 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import WhatsAppModal from './WhatsAppModal';

export interface WorkProject {
  id: number;
  project_display_id?: string;
  customer_id: number;
  customer_project_seq?: number;
  project_name: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Postponed' | 'Cancelled';
  status_note?: string | null;
  committed_date: string;
  postponed_date?: string | null;
  total_amount: number;
  advance_paid: number;
  balance_due: number;
  payment_status: string;
  asset_link?: string | null;
  customer_display_id: string;
  customer_name: string;
  customer_phone: string;
  created_by_user_id?: number;
  owner_name?: string;
}

interface WorkTableProps {
  projects: WorkProject[];
  isBacklogView?: boolean;
  onStatusChange: (projectId: number, newStatus: string) => void;
  onEditProject?: (project: WorkProject) => void;
}

export default function WorkTable({ 
  projects, 
  isBacklogView = false, 
  onStatusChange,
  onEditProject 
}: WorkTableProps) {
  const { user } = useAuth();
  const [selectedWhatsAppProject, setSelectedWhatsAppProject] = useState<WorkProject | null>(null);

  const statusBadgeColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'In Progress': return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'Postponed': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Cancelled': return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default: return 'bg-slate-700/30 text-slate-300 border-slate-600/50';
    }
  };

  const paymentBadge = (paymentStatus: string, balanceDue: number) => {
    if (paymentStatus === 'Paid in Full' || balanceDue <= 0) {
      return <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">Paid in Full</span>;
    }
    if (paymentStatus === 'Partial Paid') {
      return <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 font-medium">Partial Paid</span>;
    }
    if (paymentStatus === 'Advance Paid') {
      return <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-medium">Advance Paid</span>;
    }
    return <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 font-medium">Payment Pending</span>;
  };

  if (projects.length === 0) {
    return (
      <div className="w-full py-16 text-center bg-slate-900/40 rounded-xl border border-slate-800 p-6">
        <CheckCircle2 className="w-10 h-10 text-emerald-400/80 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-200">
          {isBacklogView ? 'Zero Overdue Backlog' : 'No Pending Work Scheduled for Today'}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {isBacklogView ? 'All past commitments have been cleared.' : 'No active projects due.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full space-y-3">
        {/* MOBILE CARDS */}
        <div className="w-full grid grid-cols-1 gap-3 md:hidden">
          {projects.map((p) => (
            <div
              key={p.id}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3"
            >
              <div className="flex justify-between items-start">
                <div className="max-w-[75%]">
                  <span className="text-[10px] font-bold text-amber-400 font-mono tracking-wider">
                    {p.project_display_id || `#${p.id}`}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-100 truncate">{p.project_name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {p.customer_name} ({p.customer_display_id})
                  </p>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${statusBadgeColor(p.status)}`}>
                  {p.status}
                </span>
              </div>

              <div className="bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-300">
                <span className="text-slate-500 font-medium mr-1.5">Note:</span>
                <span className="italic">{p.status_note || 'No active note'}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/50">
                <div>
                  <span className="text-slate-400 block">Committed Date</span>
                  <span className={`font-medium ${isBacklogView ? 'text-rose-400 font-semibold' : 'text-slate-200'}`}>
                    {p.committed_date}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Financial State</span>
                  {paymentBadge(p.payment_status, p.balance_due)}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 gap-2">
                <select
                  value={p.status}
                  onChange={(e) => onStatusChange(p.id, e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Postponed">Postponed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>

                <div className="flex items-center space-x-1.5">
                  {user?.role === 'system' && onEditProject && (
                    <button
                      type="button"
                      onClick={() => onEditProject(p)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition"
                      title="Edit Record"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                  {p.asset_link && (
                    <a
                      href={p.asset_link}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                      title="View Cloud Assets"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedWhatsAppProject(p)}
                    className="flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* DESKTOP TABLE */}
        <div className="hidden md:block w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
          <table className="w-full table-fixed text-left text-xs text-slate-200 border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="w-[30%] py-3.5 px-4 font-semibold">Code & Project</th>
                <th className="w-[20%] py-3.5 px-4 font-semibold">Status Note</th>
                <th className="w-[12%] py-3.5 px-4 font-semibold">Delivery Date</th>
                <th className="w-[14%] py-3.5 px-4 font-semibold">Payment</th>
                <th className="w-[12%] py-3.5 px-4 font-semibold">Status</th>
                <th className="w-[12%] py-3.5 px-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 truncate">
                    <div className="flex items-center space-x-2 truncate">
                      <span className="font-mono text-amber-400 font-semibold text-[11px] shrink-0">
                        {p.project_display_id || `#${p.id}`}
                      </span>
                      <span className="font-semibold text-slate-100 truncate">{p.project_name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {p.customer_name} ({p.customer_display_id})
                    </div>
                  </td>
                  <td className="py-3 px-4 truncate">
                    <span className="text-slate-300 italic text-[11px] truncate block" title={p.status_note || ''}>
                      {p.status_note || '—'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center space-x-1 font-medium ${isBacklogView ? 'text-rose-400 font-semibold' : 'text-slate-300'}`}>
                      {isBacklogView && <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                      <span>{p.committed_date}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 truncate">
                    {paymentBadge(p.payment_status, p.balance_due)}
                    <div className="text-[10px] text-slate-400 mt-0.5">Due: ₹{p.balance_due}</div>
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={p.status}
                      onChange={(e) => onStatusChange(p.id, e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 text-xs rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Postponed">Postponed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center justify-end space-x-1.5">
                      {user?.role === 'system' && onEditProject && (
                        <button
                          type="button"
                          onClick={() => onEditProject(p)}
                          className="p-1.5 rounded-md bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-400 transition cursor-pointer"
                          title="Edit Record"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {p.asset_link && (
                        <a
                          href={p.asset_link}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          title="Open Cloud Assets"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedWhatsAppProject(p)}
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition shadow-sm cursor-pointer"
                        title="Send WhatsApp Template"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <WhatsAppModal
        project={selectedWhatsAppProject}
        isOpen={!!selectedWhatsAppProject}
        onClose={() => setSelectedWhatsAppProject(null)}
        currentUserDisplayName={user?.display_name || 'Workflow Executive'}
      />
    </>
  );
}