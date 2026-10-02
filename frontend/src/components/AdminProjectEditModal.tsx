'use client';

import React, { useState } from 'react';
import { X, Save, AlertCircle, ShieldAlert } from 'lucide-react';
import { WorkProject } from './WorkTable';

interface AdminProjectEditModalProps {
  project: WorkProject | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function AdminProjectEditModal({ project, isOpen, onClose, onSaved }: AdminProjectEditModalProps) {
  if (!isOpen || !project) return null;

  const [projectName, setProjectName] = useState(project.project_name);
  const [statusNote, setStatusNote] = useState(project.status_note || '');
  const [committedDate, setCommittedDate] = useState(project.committed_date);
  const [totalAmount, setTotalAmount] = useState(project.total_amount.toString());
  const [advancePaid, setAdvancePaid] = useState(project.advance_paid.toString());
  const [status, setStatus] = useState(project.status);
  const [assetLink, setAssetLink] = useState(project.asset_link || '');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    const payload = {
      project_name: projectName.trim(),
      status_note: statusNote.trim() || null,
      committed_date: committedDate,
      total_amount: parseFloat(totalAmount) || 0,
      advance_paid: parseFloat(advancePaid) || 0,
      status: status,
      asset_link: assetLink.trim() || null,
    };

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/admin/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onSaved();
        onClose();
      } else {
        const data = await res.json();
        setErrorMsg(data.detail || 'Failed to update record');
      }
    } catch {
      setErrorMsg('Failed to connect to backend server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl p-5 sm:p-6 text-slate-100 my-auto space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-base font-bold text-white">Console Record Override</h2>
              <p className="text-xs text-slate-400">Editing [{project.project_display_id || `#${project.id}`}]</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="flex items-center space-x-2 text-xs text-rose-400 bg-rose-950/40 border border-rose-800 p-2.5 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          <div>
            <label className="text-slate-300 font-medium">Project Title</label>
            <input
              type="text"
              required
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500 mt-1"
            />
          </div>

          <div>
            <label className="text-slate-300 font-medium">Status / Progress Note</label>
            <input
              type="text"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder="e.g. Parts arriving Monday, Draft reviewed"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500 mt-1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-medium">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 mt-1"
              >
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Postponed">Postponed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 font-medium">Committed Date</label>
              <input
                type="date"
                required
                value={committedDate}
                onChange={(e) => setCommittedDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <div>
              <label className="text-slate-300 font-medium">Total Price (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 mt-1"
              />
            </div>
            <div>
              <label className="text-slate-300 font-medium">Advance Paid (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                value={advancePaid}
                onChange={(e) => setAdvancePaid(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-medium">Cloud Asset Link</label>
            <input
              type="url"
              value={assetLink}
              onChange={(e) => setAssetLink(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 mt-1"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? 'Saving...' : 'Save Record'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}