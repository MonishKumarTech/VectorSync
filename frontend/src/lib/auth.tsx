'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE } from './api';

export interface GroupMembershipBrief {
  id: number;
  name: string;
  group_code: string;
  role_in_group: 'lead' | 'member';
}

export interface AuthUser {
  id: number;
  username: string;
  display_name: string;
  role: 'system' | 'user';
  user_code: string;
  group_id?: number | null;
  group_name?: string | null;
  groups?: GroupMembershipBrief[];
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  activeGroup: GroupMembershipBrief | null;
  setActiveGroup: (group: GroupMembershipBrief | null) => void;
  login: (userData: AuthUser, accessToken: string) => void;
  logout: () => void;
  isLoading: boolean;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<GroupMembershipBrief | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('vectorsync_user');
    const savedToken = localStorage.getItem('vectorsync_token');
    const savedGroup = localStorage.getItem('vectorsync_active_group');

    if (savedUser && savedToken) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setToken(savedToken);
        if (savedGroup) {
          setActiveGroup(JSON.parse(savedGroup));
        } else if (parsed.groups && parsed.groups.length > 0) {
          setActiveGroup(parsed.groups[0]);
        }
      } catch {
        localStorage.clear();
      }
    }
    setIsLoading(false);
  }, []);

  const login = (userData: AuthUser, accessToken: string) => {
    setUser(userData);
    setToken(accessToken);
    localStorage.setItem('vectorsync_user', JSON.stringify(userData));
    localStorage.setItem('vectorsync_token', accessToken);

    const initialGroup = userData.groups && userData.groups.length > 0 ? userData.groups[0] : null;
    setActiveGroup(initialGroup);
    if (initialGroup) {
      localStorage.setItem('vectorsync_active_group', JSON.stringify(initialGroup));
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setActiveGroup(null);
    localStorage.removeItem('vectorsync_user');
    localStorage.removeItem('vectorsync_token');
    localStorage.removeItem('vectorsync_active_group');
  };

  const handleSetActiveGroup = (group: GroupMembershipBrief | null) => {
    setActiveGroup(group);
    if (group) {
      localStorage.setItem('vectorsync_active_group', JSON.stringify(group));
    } else {
      localStorage.removeItem('vectorsync_active_group');
    }
  };

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
    const headers = new Headers(options.headers || {});
    
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(fullUrl, { ...options, headers });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        activeGroup,
        setActiveGroup: handleSetActiveGroup,
        login,
        logout,
        isLoading,
        authFetch
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};