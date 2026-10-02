'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Users, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { WorkProject } from './WorkTable';

interface GroupMember {
  id: number;
  username: string;
  display_name: string;
  role: string;
}

interface GroupDashboardProps {
  groupId: number;
  groupName: string;
  onEditProject?: (project: WorkProject) => void;
}

export default function GroupDashboard({ groupId, groupName, onEditProject }: GroupDashboardProps) {
  const { user } = useAuth();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroupData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/groups/${groupId}/dashboard`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        setProjects(data.projects || []);
      }
    } catch {
      // offline handling
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchGroupData();
  }, [fetchGroupData]);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold text-amber-500 uppercase tracking-widest block mb-0.5">
            Group Shared Workspace
          </span>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <span>{groupName}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            All partner members in this group can view collective schedules and progress in real time[cite: 1].
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-slate-200">{members.length} Members:</span>
            <span className="text-slate-400">
              {members.map(m => m.display_name).join(', ')}
            </span>
          </div>
        </div>
      </div>

      <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
        <table className="w-full table-fixed text-left text-xs text-slate-200 border-collapse">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
              <th className="w-[30%] py-3.5 px-4 font-semibold">Project & Customer</th>
              <th className="w-[18%] py-3.5 px-4 font-semibold">Assigned Member</th>
              <th className="w-[18%] py-3.5 px-4 font-semibold">Status & Note</th>
              <th className="w-[14%] py-3.5 px-4 font-semibold">Committed Date</th>
              <th className="w-[10%] py-3.5 px-4 font-semibold">Due Balance</th>
              <th className="w-[10%] py-3.5 px-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {projects.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  No active projects logged for this group.
                </td>
              </tr>
            ) : (
              projects.map((p) => {
                const canEdit = user?.role === 'system' || user?.id === p.created_by_user_id;

                return (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 truncate">
                      <div className="font-semibold text-slate-100 truncate">{p.project_name}</div>
                      <div className="text-[11px] text-amber-400 font-mono mt-0.5">
                        {p.project_display_id} • {p.customer_name}
                      </div>
                    </td>
                    <td className="py-3 px-4 truncate">
                      <span className="font-medium text-slate-200">{p.owner_name}</span>
                      <span className="text-[11px] text-slate-500 block">@{p.owner_username}</span>
                    </td>
                    <td className="py-3 px-4 truncate">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {p.status}
                      </span>
                      <span className="text-[11px] text-slate-400 block italic truncate mt-0.5">
                        {p.status_note || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-medium">
                      {p.committed_date}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-semibold ${p.balance_due > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        ₹{p.balance_due}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center space-x-1.5">
                        {!canEdit && (
                          <span title="Read-only: Member owned" className="p-1.5 text-slate-600">
                            <Lock className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {canEdit && onEditProject && (
                          <button
                            onClick={() => onEditProject(p)}
                            className="p-1.5 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition text-[11px]"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}