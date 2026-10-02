'use client';

import React, { useState, useEffect } from 'react';
import { 
  UserPlus, KeyRound, CheckCircle2, 
  Trash2, Layers, Edit2, Save, Users, FolderKanban, X
} from 'lucide-react';
import AdminProjectEditModal from './AdminProjectEditModal';
import { WorkProject } from './WorkTable';

interface Group {
  id: number;
  name: string;
  group_code: string;
  description: string;
  member_count: number;
}

interface ActiveGroupInfo {
  group_id: number;
  group_name: string;
  group_code: string;
  role_in_group: 'lead' | 'member';
}

interface AppUser {
  id: number;
  username: string;
  display_name: string;
  user_code: string;
  role: 'system' | 'user';
  created_at: string;
  active_groups: ActiveGroupInfo[];
}

interface CustomerRecord {
  id: number;
  customer_display_id: string;
  name: string;
  phone_number: string;
  email?: string | null;
}

export default function AdminMasterPanel() {
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<'users' | 'groups' | 'projects' | 'customers'>('users');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // Group Form
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCode, setNewGroupCode] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newRoleInGroup, setNewRoleInGroup] = useState<'lead' | 'member'>('member');

  // User Form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newUserCode, setNewUserCode] = useState('');
  const [newRole, setNewRole] = useState<'system' | 'user'>('user');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // Edit User State
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUserCode, setEditUserCode] = useState('');
  const [editRole, setEditRole] = useState<'system' | 'user'>('user');
  const [editGroupId, setEditGroupId] = useState<string>('');

  // Edit Group State
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupCode, setEditGroupCode] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');

  // Edit Customer State
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);
  const [editCustName, setEditCustName] = useState('');
  const [editCustPhone, setEditCustPhone] = useState('');
  const [editCustEmail, setEditCustEmail] = useState('');

  // Edit Project (Modal based)
  const [editingProject, setEditingProject] = useState<WorkProject | null>(null);

  // Password Reset State
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');

  const fetchAllData = async () => {
    try {
      const [uRes, gRes, pRes, cRes] = await Promise.all([
        fetch('http://127.0.0.1:8000/api/admin/users'),
        fetch('http://127.0.0.1:8000/api/groups'),
        fetch('http://127.0.0.1:8000/api/projects/all?is_admin=true'),
        fetch('http://127.0.0.1:8000/api/customers'),
      ]);
      if (uRes.ok) setUsers((await uRes.json()).users || []);
      if (gRes.ok) {
        const gData = (await gRes.json()).groups || [];
        setGroups(gData);
        if (gData.length > 0 && !selectedGroupId) setSelectedGroupId(gData[0].id.toString());
      }
      if (pRes.ok) setProjects((await pRes.json()).projects || []);
      if (cRes.ok) setCustomers((await cRes.json()).customers || []);
    } catch {
      // Offline fallback
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const showNotification = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleSaveUserEdit = async (userId: number) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: editUsername.trim(),
          display_name: editDisplayName.trim(),
          user_code: editUserCode.trim().toUpperCase(),
          role: editRole,
        }),
      });
      if (res.ok) {
        showNotification('User profile saved.');
        setEditingUserId(null);
        fetchAllData();
      } else {
        const err = await res.json();
        showNotification(`Error: ${err.detail}`);
      }
    } catch {
      showNotification('Error saving user.');
    }
  };

  // --- DELETE HANDLERS ---

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!confirm(`Permanently delete user @${username}?`)) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/admin/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        showNotification(`User @${username} deleted.`);
        fetchAllData();
      } else {
        const err = await res.json();
        showNotification(`Error: ${err.detail}`);
      }
    } catch {
      showNotification('Error deleting user.');
    }
  };

  const handleDeleteGroup = async (groupId: number, groupName: string) => {
    if (!confirm(`Delete group "${groupName}"?`)) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/admin/groups/${groupId}`, { method: 'DELETE' });
      if (res.ok) {
        showNotification(`Group "${groupName}" deleted.`);
        fetchAllData();
      } else {
        const err = await res.json();
        showNotification(`Error: ${err.detail}`);
      }
    } catch {
      showNotification('Error deleting group.');
    }
  };

  const handleDeleteProject = async (projectId: number, prjName: string) => {
    if (!confirm(`Permanently remove project "${prjName}"?`)) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/admin/projects/${projectId}`, { method: 'DELETE' });
      if (res.ok) {
        showNotification('Project record deleted.');
        fetchAllData();
      } else {
        const err = await res.json();
        showNotification(`Error: ${err.detail}`);
      }
    } catch {
      showNotification('Error deleting project.');
    }
  };

  const handleDeleteCustomer = async (customerId: number, custName: string) => {
    if (!confirm(`Delete client "${custName}" and all associated orders?`)) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/admin/customers/${customerId}`, { method: 'DELETE' });
      if (res.ok) {
        showNotification(`Client "${custName}" deleted.`);
        fetchAllData();
      } else {
        const err = await res.json();
        showNotification(`Error: ${err.detail}`);
      }
    } catch {
      showNotification('Error deleting customer.');
    }
  };

  // --- CREATE & EDIT HANDLERS ---

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://127.0.0.1:8000/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName.trim(),
          group_code: newGroupCode.trim().toUpperCase(),
          description: newGroupDesc.trim() || null,
        }),
      });
      if (res.ok) {
        showNotification(`Group "${newGroupName}" created.`);
        setNewGroupName('');
        setNewGroupCode('');
        setNewGroupDesc('');
        fetchAllData();
      }
    } catch {
      showNotification('Error saving group.');
    }
  };

  const handleSaveGroupEdit = async (groupId: number) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/admin/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editGroupName.trim(),
          group_code: editGroupCode.trim().toUpperCase(),
          description: editGroupDesc.trim() || null,
        }),
      });
      if (res.ok) {
        showNotification('Group details updated.');
        setEditingGroupId(null);
        fetchAllData();
      } else {
        const err = await res.json();
        showNotification(`Error: ${err.detail}`);
      }
    } catch {
      showNotification('Error updating group.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://127.0.0.1:8000/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword.trim(),
          display_name: newDisplayName.trim(),
          user_code: newUserCode.trim().toUpperCase(),
          role: newRole,
          group_id: newRole === 'user' && selectedGroupId ? parseInt(selectedGroupId, 10) : null,
          role_in_group: newRoleInGroup,
        }),
      });

      if (res.ok) {
        showNotification(`User @${newUsername} created successfully.`);
        setNewUsername('');
        setNewPassword('');
        setNewDisplayName('');
        setNewUserCode('');
        setSelectedGroupId('');
        setNewRoleInGroup('member');
        fetchAllData();
      } else {
        const err = await res.json();
        showNotification(`Error: ${err.detail || 'Could not create user'}`);
      }
    } catch {
      showNotification('Network error while creating user.');
    }
  };

  const handleSaveCustomerEdit = async (customerId: number) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/admin/customers/${customerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editCustName.trim(),
          phone_number: editCustPhone.trim(),
          email: editCustEmail.trim() || null,
        }),
      });
      if (res.ok) {
        showNotification('Customer details updated.');
        setEditingCustomerId(null);
        fetchAllData();
      } else {
        const err = await res.json();
        showNotification(`Error: ${err.detail}`);
      }
    } catch {
      showNotification('Error updating customer.');
    }
  };

  const handleResetPassword = async (userId: number) => {
    if (!newResetPassword.trim()) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/admin/users/${userId}/reset-password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newResetPassword.trim() }),
      });
      if (res.ok) {
        showNotification('Password updated.');
        setResetUserId(null);
        setNewResetPassword('');
      }
    } catch {
      showNotification('Error updating password.');
    }
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div className="p-3 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Admin Subtabs */}
      <div className="flex border-b border-slate-800 gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveAdminSubTab('users')}
          className={`pb-2.5 border-b-2 transition cursor-pointer flex items-center space-x-1.5 ${
            activeAdminSubTab === 'users' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Users ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab('groups')}
          className={`pb-2.5 border-b-2 transition cursor-pointer flex items-center space-x-1.5 ${
            activeAdminSubTab === 'groups' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Groups ({groups.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab('projects')}
          className={`pb-2.5 border-b-2 transition cursor-pointer flex items-center space-x-1.5 ${
            activeAdminSubTab === 'projects' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FolderKanban className="w-3.5 h-3.5" />
          <span>Projects ({projects.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminSubTab('customers')}
          className={`pb-2.5 border-b-2 transition cursor-pointer flex items-center space-x-1.5 ${
            activeAdminSubTab === 'customers' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Customers ({customers.length})</span>
        </button>
      </div>

      {/* TAB 1: USERS */}
      {activeAdminSubTab === 'users' && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <UserPlus className="w-4 h-4 text-amber-500" />
              <span>Create New User</span>
            </h3>

            <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-7 gap-2.5 text-xs">
              <input
                type="text"
                required
                placeholder="Username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <input
                type="password"
                required
                placeholder="Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <input
                type="text"
                required
                placeholder="Display Name"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <input
                type="text"
                required
                maxLength={6}
                placeholder="Code (e.g. MKV)"
                value={newUserCode}
                onChange={(e) => setNewUserCode(e.target.value.toUpperCase())}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 uppercase placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'system' | 'user')}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="user">User</option>
                <option value="system">Console Admin</option>
              </select>

              {newRole === 'user' ? (
                <>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">No Group (0 Groups)</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.group_code})
                      </option>
                    ))}
                  </select>

                  <select
                    value={newRoleInGroup}
                    disabled={!selectedGroupId}
                    onChange={(e) => setNewRoleInGroup(e.target.value as 'lead' | 'member')}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-amber-500 disabled:opacity-40"
                  >
                    <option value="member">Role: Member</option>
                    <option value="lead">Role: Lead</option>
                  </select>
                </>
              ) : (
                <div className="sm:col-span-2 flex items-center text-slate-400 px-3 py-2 bg-slate-950/50 rounded-lg border border-slate-800 text-[11px]">
                  Global Overseer (Detached)
                </div>
              )}

              <div className="sm:col-span-7 flex justify-end">
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition cursor-pointer"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>

          <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
            <table className="w-full table-fixed text-left text-xs text-slate-200 border-collapse">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="w-[32%] py-3.5 px-4 font-semibold">User Details & Code</th>
                  <th className="w-[14%] py-3.5 px-4 font-semibold">Global Role</th>
                  <th className="w-[28%] py-3.5 px-4 font-semibold">Enrolled Groups & Roles</th>
                  <th className="w-[26%] py-3.5 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {users.map((u) => {
                  const isEditing = editingUserId === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/40">
                      {/* User Details & Code */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              value={editDisplayName}
                              onChange={(e) => setEditDisplayName(e.target.value)}
                              className="bg-slate-950 border border-slate-700 px-2 py-1 rounded text-xs w-full text-white"
                              placeholder="Display Name"
                            />
                            <div className="grid grid-cols-2 gap-1.5">
                              <input
                                type="text"
                                value={editUsername}
                                onChange={(e) => setEditUsername(e.target.value)}
                                className="bg-slate-950 border border-slate-700 px-2 py-1 rounded text-xs w-full text-amber-400 font-mono"
                                placeholder="Username"
                              />
                              <input
                                type="text"
                                value={editUserCode}
                                maxLength={6}
                                onChange={(e) => setEditUserCode(e.target.value.toUpperCase())}
                                className="bg-slate-950 border border-slate-700 px-2 py-1 rounded text-xs w-full text-amber-400 font-mono uppercase"
                                placeholder="Code (e.g. MKV)"
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="font-semibold text-white">{u.display_name}</span>
                            <div className="text-[11px] text-amber-500 font-mono">
                              @{u.username} <span className="text-slate-400">({u.user_code})</span>
                            </div>
                          </>
                        )}
                      </td>

                      {/* Global Role */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as any)}
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                          >
                            <option value="user">USER</option>
                            <option value="system">SYSTEM</option>
                          </select>
                        ) : (
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.role === 'system' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-300'
                          }`}>
                            {u.role.toUpperCase()}
                          </span>
                        )}
                      </td>

                      {/* Active GroupHub Groups with Lead/Member tags */}
                      <td className="py-3 px-4">
                        {u.role === 'system' ? (
                          <span className="text-amber-400 text-[11px] font-semibold">Global Overseer (All Groups)</span>
                        ) : u.active_groups && u.active_groups.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {u.active_groups.map((ag) => (
                              <span
                                key={ag.group_id}
                                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] bg-slate-950 border border-slate-800"
                              >
                                <span className="text-slate-200">{ag.group_name}</span>
                                <span className={`font-mono text-[9px] px-1 rounded ${
                                  ag.role_in_group === 'lead' ? 'bg-amber-500/20 text-amber-400 font-bold' : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {ag.role_in_group.toUpperCase()}
                                </span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">Unassigned (0 Groups)</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        {isEditing ? (
                          <div className="inline-flex items-center space-x-1.5">
                            <button
                              onClick={() => handleSaveUserEdit(u.id)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded text-xs flex items-center space-x-1 cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Save</span>
                            </button>
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded text-xs cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : resetUserId === u.id ? (
                          <div className="inline-flex items-center space-x-1.5">
                            <input
                              type="password"
                              placeholder="New Pass"
                              value={newResetPassword}
                              onChange={(e) => setNewResetPassword(e.target.value)}
                              className="bg-slate-950 border border-slate-700 px-2 py-1 rounded text-xs w-28 text-white"
                            />
                            <button
                              onClick={() => handleResetPassword(u.id)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded text-xs font-semibold cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setResetUserId(null)}
                              className="bg-slate-800 text-slate-300 px-2 py-1 rounded text-xs cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center space-x-3">
                            <button
                              onClick={() => {
                                setEditingUserId(u.id);
                                setEditUsername(u.username);
                                setEditDisplayName(u.display_name);
                                setEditUserCode(u.user_code);
                                setEditRole(u.role);
                              }}
                              className="text-slate-400 hover:text-amber-400 text-xs font-medium cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5 inline mr-1" />
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                setResetUserId(u.id);
                                setNewResetPassword('');
                              }}
                              className="text-slate-400 hover:text-amber-400 text-xs font-medium cursor-pointer"
                            >
                              <KeyRound className="w-3.5 h-3.5 inline mr-1" />
                              Reset
                            </button>
                            {u.role !== 'system' && (
                              <button
                                onClick={() => handleDeleteUser(u.id, u.username)}
                                className="text-slate-400 hover:text-rose-400 text-xs font-medium cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 inline mr-0.5 text-rose-500" />
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: GROUPS (EDIT + DELETE) */}
      {activeAdminSubTab === 'groups' && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Layers className="w-4 h-4 text-amber-500" />
              <span>Create New Group</span>
            </h3>

            <form onSubmit={handleCreateGroup} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
              <input
                type="text"
                required
                placeholder="Group Name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
              />
              <input
                type="text"
                required
                placeholder="Code (e.g. PSYNC)"
                value={newGroupCode}
                onChange={(e) => setNewGroupCode(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 uppercase"
              />
              <input
                type="text"
                placeholder="Description"
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
              />
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-lg cursor-pointer"
              >
                Save Group
              </button>
            </form>
          </div>

          <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
            <table className="w-full table-fixed text-left text-xs text-slate-200 border-collapse">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="w-[30%] py-3.5 px-4 font-semibold">Group Name</th>
                  <th className="w-[15%] py-3.5 px-4 font-semibold">Code</th>
                  <th className="w-[35%] py-3.5 px-4 font-semibold">Description</th>
                  <th className="w-[20%] py-3.5 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {groups.map((g) => {
                  const isEditing = editingGroupId === g.id;

                  return (
                    <tr key={g.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-semibold text-white">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editGroupName}
                            onChange={(e) => setEditGroupName(e.target.value)}
                            className="bg-slate-950 border border-slate-700 px-2 py-1 rounded text-xs w-full text-white"
                          />
                        ) : (
                          g.name
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-amber-400 font-bold">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editGroupCode}
                            onChange={(e) => setEditGroupCode(e.target.value)}
                            className="bg-slate-950 border border-slate-700 px-2 py-1 rounded text-xs w-24 text-amber-400 uppercase font-mono"
                          />
                        ) : (
                          g.group_code
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400 truncate">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editGroupDesc}
                            onChange={(e) => setEditGroupDesc(e.target.value)}
                            className="bg-slate-950 border border-slate-700 px-2 py-1 rounded text-xs w-full text-slate-300"
                          />
                        ) : (
                          g.description || '—'
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isEditing ? (
                          <div className="inline-flex items-center space-x-1.5">
                            <button
                              onClick={() => handleSaveGroupEdit(g.id)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded text-xs flex items-center space-x-1 cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Save</span>
                            </button>
                            <button
                              onClick={() => setEditingGroupId(null)}
                              className="bg-slate-800 text-slate-300 px-2 py-1 rounded text-xs cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center space-x-2.5">
                            <button
                              onClick={() => {
                                setEditingGroupId(g.id);
                                setEditGroupName(g.name);
                                setEditGroupCode(g.group_code);
                                setEditGroupDesc(g.description || '');
                              }}
                              className="text-slate-400 hover:text-amber-400 text-xs font-medium cursor-pointer"
                              title="Edit group"
                            >
                              <Edit2 className="w-3.5 h-3.5 inline mr-1" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteGroup(g.id, g.name)}
                              className="text-slate-400 hover:text-rose-400 text-xs font-medium inline-flex items-center space-x-1 cursor-pointer"
                              title="Delete group"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PROJECTS (EDIT VIA MODAL + DELETE) */}
      {activeAdminSubTab === 'projects' && (
        <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
          <table className="w-full table-fixed text-left text-xs text-slate-200 border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="w-[30%] py-3.5 px-4 font-semibold">Project Code & Name</th>
                <th className="w-[23%] py-3.5 px-4 font-semibold">Customer</th>
                <th className="w-[15%] py-3.5 px-4 font-semibold">Status</th>
                <th className="w-[14%] py-3.5 px-4 font-semibold">Value</th>
                <th className="w-[18%] py-3.5 px-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 truncate">
                    <span className="font-mono text-amber-400 font-semibold">{p.project_display_id}</span>
                    <span className="block font-medium text-slate-100 truncate">{p.project_name}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-300 truncate">{p.customer_name}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-200">₹{p.total_amount}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center space-x-2.5">
                      <button
                        onClick={() => setEditingProject(p)}
                        className="text-slate-400 hover:text-amber-400 text-xs font-medium cursor-pointer inline-flex items-center space-x-1"
                        title="Edit project record"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteProject(p.id, p.project_name)}
                        className="text-slate-400 hover:text-rose-400 text-xs font-medium inline-flex items-center space-x-1 cursor-pointer"
                        title="Delete project"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: CUSTOMERS (EDIT + DELETE) */}
      {activeAdminSubTab === 'customers' && (
        <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
          <table className="w-full table-fixed text-left text-xs text-slate-200 border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="w-[30%] py-3.5 px-4 font-semibold">Client ID & Name</th>
                <th className="w-[24%] py-3.5 px-4 font-semibold">Phone Number</th>
                <th className="w-[24%] py-3.5 px-4 font-semibold">Email</th>
                <th className="w-[22%] py-3.5 px-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {customers.map((c) => {
                const isEditing = editingCustomerId === c.id;

                return (
                  <tr key={c.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 truncate">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editCustName}
                          onChange={(e) => setEditCustName(e.target.value)}
                          className="bg-slate-950 border border-slate-700 px-2 py-1 rounded text-xs w-full text-white"
                        />
                      ) : (
                        <>
                          <span className="font-semibold text-slate-100">{c.name}</span>
                          <span className="block text-[11px] font-mono text-amber-500">{c.customer_display_id}</span>
                        </>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editCustPhone}
                          onChange={(e) => setEditCustPhone(e.target.value)}
                          className="bg-slate-950 border border-slate-700 px-2 py-1 rounded text-xs w-full text-slate-200"
                        />
                      ) : (
                        c.phone_number
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400 truncate">
                      {isEditing ? (
                        <input
                          type="email"
                          value={editCustEmail}
                          onChange={(e) => setEditCustEmail(e.target.value)}
                          className="bg-slate-950 border border-slate-700 px-2 py-1 rounded text-xs w-full text-slate-200"
                        />
                      ) : (
                        c.email || '—'
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isEditing ? (
                        <div className="inline-flex items-center space-x-1.5">
                          <button
                            onClick={() => handleSaveCustomerEdit(c.id)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded text-xs flex items-center space-x-1 cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                          <button
                            onClick={() => setEditingCustomerId(null)}
                            className="bg-slate-800 text-slate-300 px-2 py-1 rounded text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center space-x-2.5">
                          <button
                            onClick={() => {
                              setEditingCustomerId(c.id);
                              setEditCustName(c.name);
                              setEditCustPhone(c.phone_number);
                              setEditCustEmail(c.email || '');
                            }}
                            className="text-slate-400 hover:text-amber-400 text-xs font-medium cursor-pointer inline-flex items-center space-x-1"
                            title="Edit customer details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(c.id, c.name)}
                            className="text-slate-400 hover:text-rose-400 text-xs font-medium inline-flex items-center space-x-1 cursor-pointer"
                            title="Delete customer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Embedded Project Edit Modal for Admin Tab */}
      <AdminProjectEditModal
        project={editingProject}
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        onSaved={() => {
          fetchAllData();
        }}
      />
    </div>
  );
}