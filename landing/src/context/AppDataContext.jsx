import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loginUser } from "../services/api";

const AppDataContext = createContext(null);

const STORAGE_KEY = "intlexpress-session";

export function AppDataProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const storedSession = window.localStorage.getItem(STORAGE_KEY);

    if (storedSession) {
      setSession(JSON.parse(storedSession));
    }
  }, []);

  const signIn = async (credentials) => {
    setAuthLoading(true);

    try {
      const response = await loginUser(credentials);
      setSession(response);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(response));
      return response;
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = () => {
    setSession(null);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo(
    () => ({
      authLoading,
      session,
      signIn,
      signOut,
    }),
    [authLoading, session]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);

  if (!context) {
    throw new Error("useAppData must be used within AppDataProvider");
  }

  return context;
}
