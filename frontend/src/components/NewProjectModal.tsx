'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
import { queueMutation } from '@/lib/syncQueue';

interface Customer {
  id: number;
  customer_display_id: string;
  name: string;
  phone_number: string;
}

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: () => void;
}

export default function NewProjectModal({ isOpen, onClose, onProjectCreated }: NewProjectModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isCreatingNewCustomer, setIsCreatingNewCustomer] = useState<boolean>(false);

  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');

  const [projectName, setProjectName] = useState('');
  const [assignedPartner, setAssignedPartner] = useState<'MK-Vector' | 'Lakshmi Photographic Studio' | 'Teffill'>('MK-Vector');
  const [committedDate, setCommittedDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalAmount, setTotalAmount] = useState('0');
  const [advancePaid, setAdvancePaid] = useState('0');
  const [assetLink, setAssetLink] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
    }
  }, [isOpen]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/customers');
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
        if (data.customers.length > 0 && !selectedCustomerId) {
          setSelectedCustomerId(data.customers[0].id.toString());
        }
      }
    } catch {
      // Offline fallback handling
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    let activeCustomerId = parseInt(selectedCustomerId, 10);

    if (isCreatingNewCustomer) {
      if (!custName.trim() || !custPhone.trim()) {
        setErrorMsg('Please enter customer name and phone number.');
        setSubmitting(false);
        return;
      }

      try {
        const custRes = await fetch('http://localhost:8000/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: custName, phone_number: custPhone, email: custEmail || null }),
        });

        if (custRes.ok) {
          const custData = await custRes.json();
          activeCustomerId = custData.customer.id;
        } else {
          throw new Error('Failed to register customer');
        }
      } catch {
        setErrorMsg('Could not reach backend to register customer.');
        setSubmitting(false);
        return;
      }
    }

    const payload = {
      customer_id: activeCustomerId,
      project_name: projectName,
      assigned_partner: assignedPartner,
      committed_date: committedDate,
      total_amount: parseFloat(totalAmount) || 0,
      advance_paid: parseFloat(advancePaid) || 0,
      asset_link: assetLink || null,
    };

    if (typeof window !== 'undefined' && !navigator.onLine) {
      await queueMutation('/api/projects', 'POST', payload);
      alert('Offline: Project queued in local storage.');
      setSubmitting(false);
      onProjectCreated();
      onClose();
      return;
    }

    try {
      const res = await fetch('http://localhost:8000/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onProjectCreated();
        onClose();
      } else {
        const data = await res.json();
        setErrorMsg(data.detail || 'Failed to create project');
      }
    } catch {
      await queueMutation('/api/projects', 'POST', payload);
      alert('Backend unreachable. Project queued locally.');
      onProjectCreated();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      {/* Centered Modal Card Container */}
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-6 text-slate-100 my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <h2 className="text-base font-semibold text-white tracking-wide">
            New Project Registration
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1 rounded-md hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="flex items-center space-x-2 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 p-2.5 rounded-lg mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Customer Selection */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="font-medium text-slate-300">Customer</label>
              <button
                type="button"
                onClick={() => setIsCreatingNewCustomer(!isCreatingNewCustomer)}
                className="text-amber-400 hover:text-amber-300 font-medium flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isCreatingNewCustomer ? 'Select Existing' : 'New Customer'}</span>
              </button>
            </div>

            {isCreatingNewCustomer ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                <input
                  type="text"
                  placeholder="Full Name"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <input
                  type="tel"
                  placeholder="Phone (WhatsApp)"
                  required
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            ) : (
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
              >
                {customers.length === 0 ? (
                  <option value="">No existing customers found — Click + New Customer</option>
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

          {/* Project Name */}
          <div className="space-y-1.5">
            <label className="font-medium text-slate-300">Project Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Wedding Highlight Video, Acrylic Frame 12x18"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Partner & Committed Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-medium text-slate-300">Assign Partner</label>
              <select
                value={assignedPartner}
                onChange={(e) => setAssignedPartner(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="MK-Vector">MK-Vector</option>
                <option value="Lakshmi Photographic Studio">Lakshmi Studio</option>
                <option value="Teffill">Teffill</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-slate-300">Committed Delivery Date</label>
              <input
                type="date"
                required
                value={committedDate}
                onChange={(e) => setCommittedDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Financials */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-medium text-slate-300">Total Amount (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-slate-300">Advance Paid (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={advancePaid}
                onChange={(e) => setAdvancePaid(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Asset Cloud Link */}
          <div className="space-y-1.5">
            <label className="font-medium text-slate-300">Asset Cloud Link (Drive / Dropbox / NAS)</label>
            <input
              type="url"
              placeholder="https://drive.google.com/..."
              value={assetLink}
              onChange={(e) => setAssetLink(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-md transition cursor-pointer"
            >
              {submitting ? 'Registering...' : 'Register Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}