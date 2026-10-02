'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  login: (userData: AuthUser, accessToken?: string) => void;
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
    if (typeof window === 'undefined') return;

    const savedUser = localStorage.getItem('vectorsync_user');
    const savedToken = localStorage.getItem('vectorsync_token');
    const savedGroup = localStorage.getItem('vectorsync_active_group');

    if (savedUser && savedToken) {
      try {
        const parsed: AuthUser = JSON.parse(savedUser);
        setUser(parsed);
        setToken(savedToken);

        if (savedGroup) {
          setActiveGroup(JSON.parse(savedGroup));
        } else if (parsed.groups && parsed.groups.length > 0) {
          setActiveGroup(parsed.groups[0]);
        }
      } catch {
        localStorage.removeItem('vectorsync_user');
        localStorage.removeItem('vectorsync_token');
        localStorage.removeItem('vectorsync_active_group');
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((userData: AuthUser, accessToken?: string) => {
    setUser(userData);
    const tokenVal = accessToken || '';
    setToken(tokenVal);

    if (typeof window !== 'undefined') {
      localStorage.setItem('vectorsync_user', JSON.stringify(userData));
      if (tokenVal) {
        localStorage.setItem('vectorsync_token', tokenVal);
      }
    }

    const initialGroup = userData.groups && userData.groups.length > 0 ? userData.groups[0] : null;
    setActiveGroup(initialGroup);

    if (typeof window !== 'undefined') {
      if (initialGroup) {
        localStorage.setItem('vectorsync_active_group', JSON.stringify(initialGroup));
      } else {
        localStorage.removeItem('vectorsync_active_group');
      }
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setActiveGroup(null);

    if (typeof window !== 'undefined') {
      localStorage.removeItem('vectorsync_user');
      localStorage.removeItem('vectorsync_token');
      localStorage.removeItem('vectorsync_active_group');
    }
  }, []);

  const handleSetActiveGroup = useCallback((group: GroupMembershipBrief | null) => {
    setActiveGroup(group);
    if (typeof window !== 'undefined') {
      if (group) {
        localStorage.setItem('vectorsync_active_group', JSON.stringify(group));
      } else {
        localStorage.removeItem('vectorsync_active_group');
      }
    }
  }, []);

  const authFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const cleanBase = (API_BASE || '').replace(/\/+$/, '');
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    const fullUrl = url.startsWith('http://') || url.startsWith('https://') 
      ? url 
      : `${cleanBase}${cleanPath}`;

    const headers = new Headers(options.headers || {});

    const currentToken = token || (typeof window !== 'undefined' ? localStorage.getItem('vectorsync_token') : null);
    if (currentToken) {
      headers.set('Authorization', `Bearer ${currentToken}`);
    }

    const response = await fetch(fullUrl, { ...options, headers });

    // Auto logout if the token expires or is rejected
    if (response.status === 401) {
      logout();
    }

    return response;
  }, [token, logout]);

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