import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('access_token'));
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('auth_user');
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore and validate stored session
    const savedToken = localStorage.getItem('access_token');
    const savedUser = localStorage.getItem('auth_user');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('auth_user');
        setToken(null);
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  const login = (tokenResponse) => {
    const { accessToken, user: userData, role } = tokenResponse;
    const finalUser = userData || { role };
    if (!finalUser.role && role) {
      finalUser.role = role;
    }

    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('auth_user', JSON.stringify(finalUser));
    setToken(accessToken);
    setUser(finalUser);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
  };

  const isAuthenticated = Boolean(token && user);
  const isAdmin = user?.role === 'admin';

  const value = {
    token,
    user,
    role: user?.role,
    isAuthenticated,
    isAdmin,
    loading,
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

