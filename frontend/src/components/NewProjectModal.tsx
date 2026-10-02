'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, AlertCircle, User, Calendar, CreditCard, Link2, FileText } from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface Customer {
  id: number;
  customer_display_id: string;
  name: string;
  phone_number: string;
  email?: string | null;
  user_code?: string | null;
}

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: () => void;
}

export default function NewProjectModal({ isOpen, onClose, onProjectCreated }: NewProjectModalProps) {
  const { user, authFetch } = useAuth();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isCreatingNewCustomer, setIsCreatingNewCustomer] = useState<boolean>(false);

  // New Customer Fields
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');

  // Project Fields
  const [projectName, setProjectName] = useState('');
  const [statusNote, setStatusNote] = useState('Project accepted');
  const [committedDate, setCommittedDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalAmount, setTotalAmount] = useState('0');
  const [advancePaid, setAdvancePaid] = useState('0');
  const [assetLink, setAssetLink] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchCustomers = async () => {
    try {
      const res = await authFetch('/api/customers');
      if (res.ok) {
        const data = await res.json();
        const list: Customer[] = data.customers || [];
        setCustomers(list);
        if (list.length > 0 && !selectedCustomerId) {
          setSelectedCustomerId(list[0].id.toString());
        }
      }
    } catch {
      // offline handling
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const activeUserCode = user?.user_code || 'MKV';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    let activeCustomerId = parseInt(selectedCustomerId, 10);

    if (isCreatingNewCustomer) {
      if (!custName.trim() || !custPhone.trim()) {
        setErrorMsg('Please enter customer full name and WhatsApp phone number.');
        setSubmitting(false);
        return;
      }

      try {
        const custRes = await authFetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: custName.trim(),
            phone_number: custPhone.trim(),
            email: custEmail.trim() || null,
            user_code: activeUserCode,
          }),
        });

        if (custRes.ok) {
          const custData = await custRes.json();
          activeCustomerId = custData.customer.id;
        } else {
          const errData = await custRes.json();
          throw new Error(errData.detail || 'Failed to create customer');
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Could not register customer with backend.');
        setSubmitting(false);
        return;
      }
    }

    if (!activeCustomerId) {
      setErrorMsg('Please select or register a customer.');
      setSubmitting(false);
      return;
    }

    const payload = {
      customer_id: activeCustomerId,
      created_by_user_id: user?.id || 1,
      project_name: projectName.trim(),
      status_note: statusNote.trim() || 'Project accepted',
      committed_date: committedDate,
      total_amount: parseFloat(totalAmount) || 0,
      advance_paid: parseFloat(advancePaid) || 0,
      asset_link: assetLink.trim() || null,
    };

    try {
      const res = await authFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // Reset states
        setProjectName('');
        setStatusNote('Project accepted');
        setTotalAmount('0');
        setAdvancePaid('0');
        setAssetLink('');
        setIsCreatingNewCustomer(false);
        onProjectCreated();
        onClose();
      } else {
        const data = await res.json();
        setErrorMsg(data.detail || 'Failed to create project');
      }
    } catch {
      setErrorMsg('Connection error saving project.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-5 sm:p-6 text-slate-100 my-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              New Project Intake
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Operating User: <span className="text-amber-400 font-semibold">{user?.display_name}</span> ({activeUserCode})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="flex items-center space-x-2 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 p-3 rounded-lg mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* CUSTOMER SELECTION */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="font-semibold text-slate-200 flex items-center space-x-1.5">
                <User className="w-4 h-4 text-amber-500" />
                <span>Customer Profile</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingNewCustomer(!isCreatingNewCustomer)}
                className="text-amber-400 hover:text-amber-300 font-medium flex items-center space-x-1 cursor-pointer bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1 rounded-md transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isCreatingNewCustomer ? 'Select Existing Client' : 'Add New Customer'}</span>
              </button>
            </div>

            {isCreatingNewCustomer ? (
              <div className="bg-slate-950 p-3.5 rounded-xl border border-amber-500/30 space-y-2.5">
                <span className="text-[11px] text-amber-400 font-medium block">
                  New Client ID Prefix: <strong>{activeUserCode}_CUS_...</strong>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Full Name *"
                    required
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="tel"
                    placeholder="WhatsApp Phone *"
                    required
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            ) : (
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {customers.length === 0 ? (
                  <option value="">No clients registered — click &quot;Add New Customer&quot; above</option>
                ) : (
                  customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customer_display_id} — {c.name} ({c.phone_number})
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* PROJECT ATTRIBUTES */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200">Project Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Reception Album 12x36, Laser Toner Drum"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200 flex items-center space-x-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              <span>Initial Status Note</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Awaiting client review, Parts ordered"
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200 flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              <span>Committed Delivery Date</span>
            </label>
            <input
              type="date"
              required
              value={committedDate}
              onChange={(e) => setCommittedDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-200 flex items-center space-x-1">
                <CreditCard className="w-3.5 h-3.5 text-amber-500" />
                <span>Total Project Amount (₹)</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-200">Advance Received (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={advancePaid}
                onChange={(e) => setAdvancePaid(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-200 flex items-center space-x-1">
              <Link2 className="w-3.5 h-3.5 text-amber-500" />
              <span>Asset Cloud Link (Drive / Dropbox)</span>
            </label>
            <input
              type="url"
              placeholder="https://drive.google.com/..."
              value={assetLink}
              onChange={(e) => setAssetLink(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition shadow-md cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Creating Project...' : 'Register Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}