'use client';

import React from 'react';
import { X, Send, CheckCircle2, Clock, CreditCard, HeartHandshake } from 'lucide-react';
import { WorkProject } from './WorkTable';

interface WhatsAppModalProps {
  project: WorkProject | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserDisplayName: string;
}

export default function WhatsAppModal({
  project,
  isOpen,
  onClose,
  currentUserDisplayName,
}: WhatsAppModalProps) {
  if (!isOpen || !project) return null;

  const rawPhone = project.customer_phone.replace(/\D/g, '');
  const phone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
  const clientName = project.customer_name;
  const prjName = project.project_name;
  const prjCode = project.project_display_id || `#${project.id}`;
  const sender = currentUserDisplayName;

  const options = [
    {
      id: 'welcome',
      title: '1. Welcome & Project Accepted',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
      text: `Hello ${clientName},\n\nWe are pleased to inform you that your project *"${prjName}"* [${prjCode}] has been accepted and scheduled with *${sender}*.\n\nOur team has started initial preparations. You will receive progress updates directly here.\n\nWarm regards,\n*${sender}*`,
    },
    {
      id: 'next_stage',
      title: '2. Next Stage / Delivery Update',
      icon: <Clock className="w-4 h-4 text-sky-400" />,
      text: `Hello ${clientName},\n\nUpdate regarding your order *"${prjName}"* [${prjCode}]:\n\n• Current Status: *${project.status}*\n• Progress Note: *${project.status_note || 'On track'}*\n• Committed Target Date: *${project.committed_date}*\n\nPlease let us know if any further adjustments or review materials are needed.\n\nBest regards,\n*${sender}*`,
    },
    {
      id: 'payment_pending',
      title: '3. Payment Pending Notice',
      icon: <CreditCard className="w-4 h-4 text-amber-400" />,
      text: `Hello ${clientName},\n\nRegarding your order *"${prjName}"* [${prjCode}] with *${sender}*:\n\n• Total Project Amount: ₹${project.total_amount}\n• Advance Received: ₹${project.advance_paid}\n• *Pending Balance Due: ₹${project.balance_due}*\n\nKindly settle the pending balance at your earliest convenience to facilitate final handover.\n\nThank you,\n*${sender}*`,
    },
    {
      id: 'thankyou',
      title: '4. Thank You & Order Completed',
      icon: <HeartHandshake className="w-4 h-4 text-emerald-400" />,
      text: `Dear ${clientName},\n\nYour project *"${prjName}"* [${prjCode}] has been successfully completed and finalized.\n\nThank you for working with *${sender}*. We truly value your trust and look forward to collaborating with you again soon!\n\nBest wishes,\n*${sender}*`,
    },
  ];

  const handleSend = (msgText: string) => {
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msgText)}`;
    window.open(url, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-5 sm:p-6 text-slate-100 space-y-4 my-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <span>Send WhatsApp Update</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              To: <strong className="text-slate-200">{clientName}</strong> ({project.customer_phone}) • From: <strong className="text-amber-400">{sender}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2.5">
          {options.map((opt) => (
            <div
              key={opt.id}
              onClick={() => handleSend(opt.text)}
              className="p-3 bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 rounded-xl transition cursor-pointer group space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 font-semibold text-xs text-slate-200 group-hover:text-emerald-400">
                  {opt.icon}
                  <span>{opt.title}</span>
                </div>
                <Send className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition" />
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2 italic font-mono bg-slate-900/50 p-1.5 rounded border border-slate-800/40">
                {opt.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}