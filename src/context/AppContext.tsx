import React, { createContext, useContext, useMemo, useState } from 'react';

interface AppState {
  isLoggedIn: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('isLoggedIn') === 'true';
  });

  const value = useMemo<AppState>(() => ({
    isLoggedIn,
    login: (username, password) => {
      if (username === 'admin' && password === 'admin123') {
        setIsLoggedIn(true);
        localStorage.setItem('isLoggedIn', 'true');
        return true;
      }
      return false;
    },
    logout: () => {
      setIsLoggedIn(false);
      localStorage.removeItem('isLoggedIn');
    },
  }), [isLoggedIn]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used inside AppProvider');
  return ctx;
}
