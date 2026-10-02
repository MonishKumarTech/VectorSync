'use client';

import React from 'react';
import { Users, Phone, Mail, ChevronRight, FolderKanban } from 'lucide-react';

export interface CustomerStats {
  id: number;
  customer_display_id: string;
  user_code?: string;
  name: string;
  phone_number: string;
  email?: string | null;
  total_orders: number;
  completed_orders: number;
  active_orders: number;
}

interface CustomerBoardProps {
  customers: CustomerStats[];
  onSelectCustomer?: (customerId: number, customerName: string) => void;
}

export default function CustomerBoard({ customers, onSelectCustomer }: CustomerBoardProps) {
  if (customers.length === 0) {
    return (
      <div className="w-full py-16 text-center bg-slate-900/40 rounded-xl border border-slate-800 p-6 text-slate-400">
        <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-semibold text-slate-200">No customers registered yet</p>
        <p className="text-xs text-slate-400 mt-1">Register a new customer via Project Intake above.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* MOBILE VIEW */}
      <div className="w-full grid grid-cols-1 gap-3 md:hidden">
        {customers.map((c) => (
          <div
            key={c.id}
            onClick={() => onSelectCustomer && onSelectCustomer(c.id, c.name)}
            className="w-full bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-xl p-4 shadow-sm space-y-3 transition cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono font-bold text-amber-500 tracking-wider">
                  {c.customer_display_id}
                </span>
                <h3 className="text-sm font-semibold text-slate-100">{c.name}</h3>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </div>

            <div className="text-xs text-slate-300 space-y-1">
              <div className="flex items-center space-x-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{c.phone_number}</span>
              </div>
              {c.email && (
                <div className="flex items-center space-x-1.5 text-slate-400 text-[11px]">
                  <Mail className="w-3.5 h-3.5" />
                  <span>{c.email}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center text-[11px]">
              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/40">
                <span className="text-slate-400 block text-[10px]">Total</span>
                <span className="font-bold text-slate-200">{c.total_orders}</span>
              </div>
              <div className="bg-sky-500/10 p-2 rounded-lg border border-sky-500/20">
                <span className="text-sky-400 block text-[10px]">Active</span>
                <span className="font-bold text-sky-300">{c.active_orders}</span>
              </div>
              <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                <span className="text-emerald-400 block text-[10px]">Completed</span>
                <span className="font-bold text-emerald-300">{c.completed_orders}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* DESKTOP VIEW */}
      <div className="hidden md:block w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
        <table className="w-full table-fixed text-left text-xs text-slate-200 border-collapse">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
              <th className="w-[35%] py-3.5 px-4 font-semibold">Client ID & Name</th>
              <th className="w-[30%] py-3.5 px-4 font-semibold">Contact Information</th>
              <th className="w-[10%] py-3.5 px-4 text-center font-semibold">Total Orders</th>
              <th className="w-[10%] py-3.5 px-4 text-center font-semibold">Active Orders</th>
              <th className="w-[10%] py-3.5 px-4 text-center font-semibold">Completed</th>
              <th className="w-[5%] py-3.5 px-4 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {customers.map((c) => (
              <tr
                key={c.id}
                onClick={() => onSelectCustomer && onSelectCustomer(c.id, c.name)}
                className="hover:bg-slate-800/40 transition cursor-pointer"
              >
                <td className="py-3 px-4 truncate">
                  <div className="font-semibold text-slate-100 truncate">{c.name}</div>
                  <div className="text-[11px] text-amber-500 font-mono mt-0.5">{c.customer_display_id}</div>
                </td>
                <td className="py-3 px-4 truncate">
                  <div className="flex items-center space-x-1.5 text-slate-300 truncate">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{c.phone_number}</span>
                  </div>
                  {c.email && (
                    <div className="flex items-center space-x-1.5 text-slate-400 text-[11px] mt-0.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                </td>
                <td className="py-3 px-4 text-center font-bold text-slate-200">
                  {c.total_orders}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30">
                    {c.active_orders}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {c.completed_orders}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition"
                    title="View Customer Projects"
                  >
                    <FolderKanban className="w-4 h-4 ml-auto" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}