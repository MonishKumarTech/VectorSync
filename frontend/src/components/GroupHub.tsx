'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Users, UserCheck, LogOut, Plus, 
  MessageSquare, Clock, CheckCircle2, 
  Trash2, ShieldAlert, AlertTriangle, Shield
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface UserGroup {
  id: number;
  name: string;
  group_code: string;
  description: string;
  membership_status: 'active' | 'pending';
  role_in_group: 'lead' | 'member';
}

interface PendingRequest {
  id: number;
  user_id: number;
  username: string;
  display_name: string;
  user_code: string;
  requested_at: string;
}

interface GroupMember {
  id: number;
  username: string;
  display_name: string;
  user_code: string;
  role_in_group: 'lead' | 'member';
}

interface AvailableGroup {
  id: number;
  name: string;
  group_code: string;
  description: string;
}

export default function GroupHub() {
  const { user, setActiveGroup, authFetch } = useAuth();
  
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [allGroups, setAllGroups] = useState<AvailableGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  
  const [notice, setNotice] = useState<string | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [targetJoinGroupId, setTargetJoinGroupId] = useState<string>('');

  // Double Confirmation Modal States
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  const [removeStep, setRemoveStep] = useState<1 | 2>(1);
  const [confirmationInput, setConfirmationInput] = useState('');

  const showNotification = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const fetchUserGroups = useCallback(async () => {
    if (!user) return;
    try {
      const res = await authFetch(`/api/user/${user.id}/groups`);
      if (res.ok) {
        const data = await res.json();
        const list: UserGroup[] = data.groups || [];
        setUserGroups(list);

        const activeList = list.filter(g => g.membership_status === 'active');
        if (activeList.length > 0 && !selectedGroupId) {
          const initial = activeList[0];
          setSelectedGroupId(initial.id);
          setActiveGroup({
            id: initial.id,
            name: initial.name,
            group_code: initial.group_code,
            role_in_group: initial.role_in_group
          });
        } else if (user.role === 'system' && !selectedGroupId) {
          const allRes = await authFetch('/api/groups');
          if (allRes.ok) {
            const allData = await allRes.json();
            if (allData.groups?.length > 0) {
              const rootDefault = allData.groups[0];
              setSelectedGroupId(rootDefault.id);
              setActiveGroup({
                id: rootDefault.id,
                name: rootDefault.name,
                group_code: rootDefault.group_code,
                role_in_group: 'lead'
              });
            }
          }
        }
      }
    } catch {
      // offline handling
    }
  }, [user, selectedGroupId, authFetch, setActiveGroup]);

  const fetchGroupDetails = useCallback(async () => {
    if (!selectedGroupId) return;
    try {
      const [mRes, rRes] = await Promise.all([
        authFetch(`/api/groups/${selectedGroupId}/members`),
        authFetch(`/api/groups/${selectedGroupId}/pending-requests`),
      ]);
      if (mRes.ok) setMembers((await mRes.json()).members || []);
      if (rRes.ok) setPendingRequests((await rRes.json()).requests || []);
    } catch {
      // offline handling
    }
  }, [selectedGroupId, authFetch]);

  const fetchAllAvailableGroups = async () => {
    try {
      const res = await authFetch('/api/groups');
      if (res.ok) {
        const data = await res.json();
        setAllGroups(data.groups || []);
        if (data.groups?.length > 0) setTargetJoinGroupId(data.groups[0].id.toString());
      }
    } catch {
      // offline handling
    }
  };

  useEffect(() => {
    fetchUserGroups();
  }, [fetchUserGroups]);

  useEffect(() => {
    fetchGroupDetails();
  }, [fetchGroupDetails]);

  // Synchronize when switching groups via the pill selector
  const handleSelectGroup = (groupId: number) => {
    setSelectedGroupId(groupId);
    const active = userGroups.find(ug => ug.id === groupId && ug.membership_status === 'active');
    if (active) {
      setActiveGroup({
        id: active.id,
        name: active.name,
        group_code: active.group_code,
        role_in_group: active.role_in_group
      });
    } else if (user?.role === 'system') {
      const found = allGroups.find(ag => ag.id === groupId);
      if (found) {
        setActiveGroup({
          id: found.id,
          name: found.name,
          group_code: found.group_code,
          role_in_group: 'lead'
        });
      }
    }
  };

  // Determine current user's authority for the active group
  const activeMembership = userGroups.find(g => g.id === selectedGroupId && g.membership_status === 'active');
  const isLeaderOrAdmin = user?.role === 'system' || activeMembership?.role_in_group === 'lead';

  // Request to Join Group (Token-authenticated)
  const handleRequestJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetJoinGroupId) return;

    try {
      const res = await authFetch('/api/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: parseInt(targetJoinGroupId, 10) }),
      });
      if (res.ok) {
        showNotification('Join request submitted. Awaiting Lead or Admin approval.');
        setIsJoinModalOpen(false);
        fetchUserGroups();
      } else {
        const err = await res.json();
        showNotification(`Error: ${err.detail}`);
      }
    } catch {
      showNotification('Network error sending join request.');
    }
  };

  // Voluntary Leave (Token-authenticated)
  const handleLeaveGroup = async (groupId: number) => {
    if (!confirm('Are you sure you want to leave this group? You can request to rejoin at any time.')) return;

    try {
      const res = await authFetch(`/api/groups/${groupId}/leave`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showNotification('You have left the group.');
        setSelectedGroupId(null);
        setActiveGroup(null);
        fetchUserGroups();
      } else {
        const err = await res.json();
        showNotification(`Error: ${err.detail}`);
      }
    } catch {
      showNotification('Error leaving group.');
    }
  };

  // Promote / Demote Member Role (Token-authenticated)
  const handleRoleChange = async (targetUserId: number, newRole: 'lead' | 'member') => {
    if (!selectedGroupId) return;

    try {
      const res = await authFetch(
        `/api/groups/${selectedGroupId}/members/${targetUserId}/role`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role_in_group: newRole }),
        }
      );
      if (res.ok) {
        showNotification(`Role updated to ${newRole.toUpperCase()}.`);
        fetchGroupDetails();
      } else {
        const err = await res.json();
        showNotification(`Error: ${err.detail}`);
      }
    } catch {
      showNotification('Error updating member role.');
    }
  };

  // Final Step 2 Member Kick (Token-authenticated)
  const handleExecuteRemoval = async () => {
    if (!selectedGroupId || !memberToRemove) return;

    try {
      const res = await authFetch(
        `/api/groups/${selectedGroupId}/members/${memberToRemove.id}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        showNotification(`${memberToRemove.display_name} has been removed from this group.`);
        setMemberToRemove(null);
        setRemoveStep(1);
        setConfirmationInput('');
        fetchGroupDetails();
      } else {
        const err = await res.json();
        showNotification(`Error: ${err.detail}`);
      }
    } catch {
      showNotification('Error removing member.');
    }
  };

  // Approve / Decline Pending Candidate
  const handleDecision = async (membershipId: number, action: 'approve' | 'reject') => {
    if (!selectedGroupId) return;

    try {
      const res = await authFetch(
        `/api/groups/${selectedGroupId}/requests/${membershipId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        }
      );
      if (res.ok) {
        showNotification(`Candidate request ${action}d.`);
        fetchGroupDetails();
      } else {
        const err = await res.json();
        showNotification(`Error: ${err.detail}`);
      }
    } catch {
      showNotification('Error processing request.');
    }
  };

  const currentGroupView = userGroups.find(g => g.id === selectedGroupId) || allGroups.find(g => g.id === selectedGroupId);

  return (
    <div className="space-y-6">
      {notice && (
        <div className="p-3 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Group Navigation Ribbon */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 mr-2 flex items-center space-x-1">
            <Users className="w-4 h-4 text-amber-500" />
            <span>Active Groups:</span>
          </span>

          {userGroups.filter(g => g.membership_status === 'active').length === 0 && user?.role !== 'system' ? (
            <span className="text-xs text-slate-400 italic bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              Not currently enrolled in any group
            </span>
          ) : (
            (user?.role === 'system' ? allGroups : userGroups.filter(g => g.membership_status === 'active')).map((g) => (
              <button
                key={g.id}
                onClick={() => handleSelectGroup(g.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                  selectedGroupId === g.id
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                <span>{g.name}</span>
                <span className="font-mono text-[10px] opacity-80">({g.group_code})</span>
              </button>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            fetchAllAvailableGroups();
            setIsJoinModalOpen(true);
          }}
          className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Request to Join Group</span>
        </button>
      </div>

      {/* Outgoing Pending Requests Banner */}
      {userGroups.filter(g => g.membership_status === 'pending').length > 0 && (
        <div className="bg-sky-950/40 border border-sky-800/60 p-3.5 rounded-xl space-y-1">
          <div className="text-xs text-sky-300 font-semibold flex items-center space-x-1.5">
            <Clock className="w-4 h-4 text-sky-400" />
            <span>Your Outgoing Pending Group Requests:</span>
          </div>
          <div className="text-[11px] text-slate-300">
            {userGroups.filter(g => g.membership_status === 'pending').map(g => (
              <span key={g.id} className="inline-block bg-slate-900 border border-slate-700 px-2 py-0.5 rounded mr-2 mt-1">
                {g.name} ({g.group_code}) • Awaiting Approval
              </span>
            ))}
          </div>
        </div>
      )}

      {selectedGroupId && currentGroupView && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Group View & Chatbox Container */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center space-x-2">
                    <span>{currentGroupView.name}</span>
                    <span className="font-mono text-xs px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">
                      {currentGroupView.group_code}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">{currentGroupView.description || 'Collaborative workspace space'}</p>
                </div>

                {user?.role !== 'system' && (
                  <button
                    onClick={() => handleLeaveGroup(selectedGroupId)}
                    className="flex items-center space-x-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-950/60 border border-rose-800/40 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                    title="Leave this group at any time"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Leave Group</span>
                  </button>
                )}
              </div>
            </div>

            {/* Chatbox Container */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Internal Channel ({currentGroupView.name})
                  </h3>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">Channel Active</span>
              </div>

              <div className="h-56 rounded-xl bg-slate-950/60 border border-slate-800/80 p-4 flex flex-col items-center justify-center text-center text-slate-500 text-xs space-y-2">
                <MessageSquare className="w-8 h-8 opacity-40 text-amber-400" />
                <p className="font-medium text-slate-400">Channel #{currentGroupView.group_code.toLowerCase()}-sync connected</p>
                <p className="text-[11px] max-w-sm">
                  Dedicated secure message feed reserved for active members and leads of {currentGroupView.name}.
                </p>
              </div>
            </div>
          </div>

          {/* Members Roster & Management */}
          <div className="space-y-5">
            {/* Join Requests Desk (Leads & Admin) */}
            {isLeaderOrAdmin && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                  <UserCheck className="w-4 h-4 text-amber-500" />
                  <span>Join Requests ({pendingRequests.length})</span>
                </h3>

                {pendingRequests.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-1">No pending requests.</p>
                ) : (
                  <div className="space-y-2">
                    {pendingRequests.map((req) => (
                      <div key={req.id} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                        <div>
                          <span className="font-semibold text-slate-200">{req.display_name}</span>
                          <span className="text-[11px] text-slate-400 block font-mono">@{req.username}</span>
                        </div>
                        <div className="flex items-center space-x-2 pt-1 border-t border-slate-900">
                          <button
                            onClick={() => handleDecision(req.id, 'approve')}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-1 rounded text-[11px] transition cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleDecision(req.id, 'reject')}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-1 rounded text-[11px] transition cursor-pointer"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Active Enrolled Members */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                  <Users className="w-4 h-4 text-amber-500" />
                  <span>Enrolled Members ({members.length})</span>
                </h3>
              </div>

              <div className="divide-y divide-slate-800/80">
                {members.map((m) => {
                  const isLead = m.role_in_group === 'lead';
                  const isSelf = user?.id === m.id;

                  return (
                    <div key={m.id} className="py-3 flex flex-col gap-2 text-xs">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-semibold text-slate-200">{m.display_name}</span>
                          <span className="text-[11px] text-slate-500 block font-mono">@{m.username} ({m.user_code})</span>
                        </div>
                        
                        <span className={`inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                          isLead 
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {isLead && <Shield className="w-3 h-3 text-amber-400 inline" />}
                          <span>{isLead ? 'LEAD' : 'MEMBER'}</span>
                        </span>
                      </div>

                      {/* Controls for Leads and Admin */}
                      {isLeaderOrAdmin && !isSelf && (
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/50">
                          {/* Role Switcher */}
                          <select
                            value={m.role_in_group}
                            onChange={(e) => handleRoleChange(m.id, e.target.value as 'lead' | 'member')}
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-[11px] text-slate-300 focus:outline-none focus:border-amber-500"
                          >
                            <option value="member">Role: Member</option>
                            <option value="lead">Role: Lead (Co-Authority)</option>
                          </select>

                          {/* Double Confirmation Kick Trigger */}
                          <button
                            onClick={() => {
                              setMemberToRemove(m);
                              setRemoveStep(1);
                              setConfirmationInput('');
                            }}
                            className="text-rose-400 hover:text-rose-300 text-[11px] font-medium flex items-center space-x-1 cursor-pointer hover:bg-rose-950/40 px-2 py-0.5 rounded transition"
                            title="Remove member from this group"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remove</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DOUBLE CONFIRMATION REMOVAL MODAL */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center space-x-2.5 text-rose-400">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-white">
                  {removeStep === 1 ? 'Step 1: Confirm Member Removal' : 'Step 2: Final Verification'}
                </h3>
                <p className="text-[11px] text-slate-400">Target: {memberToRemove.display_name} (@{memberToRemove.username})</p>
              </div>
            </div>

            {removeStep === 1 ? (
              <div className="space-y-4 text-xs">
                <p className="text-slate-300 leading-relaxed">
                  Are you sure you want to remove <strong className="text-white">{memberToRemove.display_name}</strong> from this group? 
                  They will lose visibility into group operations and the internal chat channel.
                </p>
                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setMemberToRemove(null)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoveStep(2)}
                    className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition"
                  >
                    Proceed to Step 2
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-rose-950/30 border border-rose-800/60 rounded-xl space-y-1.5">
                  <span className="font-semibold text-rose-300 flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Double Confirmation Required</span>
                  </span>
                  <p className="text-[11px] text-slate-300">
                    Type <strong className="text-rose-400 font-mono">REMOVE</strong> below to confirm permanent revocation of their membership:
                  </p>
                </div>

                <input
                  type="text"
                  placeholder="Type REMOVE"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 uppercase tracking-widest text-center focus:outline-none focus:border-rose-500"
                />

                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setMemberToRemove(null);
                      setRemoveStep(1);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={confirmationInput.trim() !== 'REMOVE'}
                    onClick={handleExecuteRemoval}
                    className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Confirm & Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REQUEST TO JOIN MODAL */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl text-slate-100 space-y-4">
            <h3 className="text-sm font-bold text-white">Request to Join an Organization Group</h3>
            <p className="text-xs text-slate-400">
              Select the group you want to join. A group Lead or the System Admin will review your entry.
            </p>

            <form onSubmit={handleRequestJoin} className="space-y-4 text-xs">
              <select
                value={targetJoinGroupId}
                onChange={(e) => setTargetJoinGroupId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              >
                {allGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.group_code})
                  </option>
                ))}
              </select>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}