import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import API from "../services/api";

const AuthContext = createContext(null);

const USER_KEY = "quantix_user";
const TOKEN_KEY = "quantix_token";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem(TOKEN_KEY) || null;
  });

  const [loading, setLoading] = useState(true);

  const persistAuth = (payload) => {
    const nextUser = payload.user || null;
    const nextToken = payload.token || null;

    setUser(nextUser);
    setToken(nextToken);

    if (nextUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    } else {
      localStorage.removeItem(USER_KEY);
    }

    if (nextToken) {
      localStorage.setItem(TOKEN_KEY, nextToken);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  };

  const clearAuth = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  };

  const fetchMe = async () => {
    try {
      if (!localStorage.getItem(TOKEN_KEY)) {
        setLoading(false);
        return;
      }

      const { data } = await API.get("/auth/me");
      setUser(data.user);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    } catch (error) {
      console.error("fetchMe error:", error);
      clearAuth();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  const login = async ({ email, password }) => {
    const { data } = await API.post("/auth/login", { email, password });

    persistAuth({
      user: data.user,
      token: data.token,
    });

    return data;
  };

  const register = async ({ fullName, username, email, password }) => {
    const { data } = await API.post("/auth/register", {
      fullName,
      username,
      email,
      password,
    });

    persistAuth({
      user: data.user,
      token: data.token,
    });

    return data;
  };

  const logout = () => {
    clearAuth();
    window.location.href = "/login";
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: !!token,
      setUser,
      login,
      register,
      logout,
      refetchMe: fetchMe,
    }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};