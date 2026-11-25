import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  AUTH_EXPIRED_EVENT,
  clearStoredAuth,
  getRemainingTokenMs,
  isTokenExpired,
} from '../utils/authToken';

const AuthContext = createContext(null);

function readInitialAuthState() {
  const savedToken = localStorage.getItem('access_token') || localStorage.getItem('token');
  const savedUserRaw = localStorage.getItem('auth_user');

  if (!savedToken || !savedUserRaw) {
    return { token: null, user: null, sessionExpired: false };
  }

  if (isTokenExpired(savedToken)) {
    clearStoredAuth();
    return { token: null, user: null, sessionExpired: true };
  }

  try {
    return {
      token: savedToken,
      user: JSON.parse(savedUserRaw),
      sessionExpired: false,
    };
  } catch {
    clearStoredAuth();
    return { token: null, user: null, sessionExpired: false };
  }
}

export function AuthProvider({ children }) {
  const initialState = readInitialAuthState();
  const [token, setToken] = useState(initialState.token);
  const [user, setUser] = useState(initialState.user);
  const [sessionExpired, setSessionExpired] = useState(initialState.sessionExpired);
  const [loading, setLoading] = useState(false);

  const expireSession = useCallback(() => {
    clearStoredAuth();
    setToken(null);
    setUser(null);
    setSessionExpired(true);
  }, []);

  // Lắng nghe sự kiện 401 từ API Client và đồng bộ đăng xuất giữa các tab
  useEffect(() => {
    const handleAuthExpired = (event) => {
      const reason = event?.detail?.reason;
      clearStoredAuth();
      setToken(null);
      setUser(null);
      setSessionExpired(reason !== 'unauthenticated');
    };

    const handleStorageChange = (event) => {
      if (event.key === 'access_token' || event.key === 'token' || event.key === 'auth_user') {
        const next = readInitialAuthState();
        setToken(next.token);
        setUser(next.user);
        if (next.token) {
          setSessionExpired(false);
        }
      }
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Tự động hết phiên đúng thời điểm JWT exp đến hạn nếu tab đang mở
  useEffect(() => {
    if (!token) return;
    const remainingMs = getRemainingTokenMs(token);
    if (remainingMs === null) return;

    if (remainingMs <= 0) {
      expireSession();
      return;
    }

    const cappedDelay = Math.min(remainingMs, 2147483647);
    const timer = setTimeout(() => {
      expireSession();
    }, cappedDelay);

    return () => clearTimeout(timer);
  }, [token, expireSession]);

  const login = useCallback((tokenResponse) => {
    const { accessToken, user: userData, role } = tokenResponse;
    const finalUser = userData || { role };
    if (!finalUser.role && role) {
      finalUser.role = role;
    }

    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('auth_user', JSON.stringify(finalUser));
    setToken(accessToken);
    setUser(finalUser);
    setSessionExpired(false);
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setToken(null);
    setUser(null);
    setSessionExpired(false);
  }, []);

  const clearSessionExpired = useCallback(() => {
    setSessionExpired(false);
  }, []);

  const updateUserProfile = useCallback((partialUser) => {
    setUser((prev) => {
      const merged = { ...(prev || {}), ...partialUser };
      localStorage.setItem('auth_user', JSON.stringify(merged));
      return merged;
    });
  }, []);

  const isAuthenticated = Boolean(token && user);
  const isAdmin = user?.role === 'admin';

  const value = {
    token,
    user,
    role: user?.role,
    isAuthenticated,
    isAdmin,
    loading,
    sessionExpired,
    clearSessionExpired,
    updateUserProfile,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
