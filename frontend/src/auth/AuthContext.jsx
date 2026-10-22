
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const AuthContext = createContext(null);

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");

const TOKEN_KEY = "grimora_access_token";
const USER_KEY = "grimora_user";

function readStoredUser() {
  try {
    const storedUser = localStorage.getItem(USER_KEY);
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function getTokenExpiration(token) {
  try {
    const payload = token.split(".")[1];

    if (!payload) {
      return null;
    }

    const normalized = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const decoded = JSON.parse(
      atob(normalized)
    );

    return typeof decoded.exp === "number"
      ? decoded.exp * 1000
      : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);

  const [token, setToken] = useState(() =>
    localStorage.getItem(TOKEN_KEY)
  );

  const [loading, setLoading] = useState(true);

  const sessionVersion = useRef(0);

  const clearSession = useCallback(() => {
    sessionVersion.current += 1;

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    setToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const login = async (email, password) => {
    const response = await fetch(
      `${API_BASE}/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        typeof data.detail === "string"
          ? data.detail
          : "Unable to sign in."
      );
    }

    const expiration = getTokenExpiration(
      data.access_token
    );

    if (!expiration || expiration <= Date.now()) {
      throw new Error(
        "The server returned an invalid or expired session."
      );
    }

    sessionVersion.current += 1;

    localStorage.setItem(
      TOKEN_KEY,
      data.access_token
    );

    localStorage.setItem(
      USER_KEY,
      JSON.stringify(data.user)
    );

    setToken(data.access_token);
    setUser(data.user);
    setLoading(false);

    return data.user;
  };

  const validateSession = useCallback(
    async (sessionToken) => {
      if (!sessionToken) {
        return;
      }

      const version = sessionVersion.current;

      const expiration = getTokenExpiration(
        sessionToken
      );

      if (!expiration || expiration <= Date.now()) {
        clearSession();
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE}/auth/me`,
          {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
            },
          }
        );

        if (
          version !== sessionVersion.current
        ) {
          return;
        }

        if (
          response.status === 401 ||
          response.status === 403
        ) {
          clearSession();
          return;
        }

        if (!response.ok) {
          return;
        }

        const currentUser = await response.json();

        if (
          version !== sessionVersion.current
        ) {
          return;
        }

        localStorage.setItem(
          USER_KEY,
          JSON.stringify(currentUser)
        );

        setUser(currentUser);
      } catch {
        // Keep the session during temporary
        // network failures. The next check
        // will try again.
      }
    },
    [clearSession]
  );

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let active = true;

    const initializeSession = async () => {
      const expiration = getTokenExpiration(token);

      if (!expiration || expiration <= Date.now()) {
        clearSession();
        return;
      }

      await validateSession(token);

      if (active) {
        setLoading(false);
      }
    };

    initializeSession();

    return () => {
      active = false;
    };
  }, [token, clearSession, validateSession]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const expiration = getTokenExpiration(token);

    if (!expiration || expiration <= Date.now()) {
      clearSession();
      return;
    }

    const remaining = expiration - Date.now();

    const timer = window.setTimeout(() => {
      clearSession();
    }, remaining);

    return () => {
      window.clearTimeout(timer);
    };
  }, [token, clearSession]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const checkSession = () => {
      const expiration = getTokenExpiration(token);

      if (!expiration || expiration <= Date.now()) {
        clearSession();
        return;
      }

      validateSession(token);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkSession();
      }
    };

    window.addEventListener("focus", checkSession);

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      window.removeEventListener(
        "focus",
        checkSession
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [token, clearSession, validateSession]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (
        event.key !== TOKEN_KEY &&
        event.key !== USER_KEY
      ) {
        return;
      }

      const storedToken = localStorage.getItem(
        TOKEN_KEY
      );

      if (!storedToken) {
        clearSession();
        return;
      }

      if (storedToken !== token) {
        sessionVersion.current += 1;

        setToken(storedToken);
        setUser(readStoredUser());
        setLoading(true);
      }
    };

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, [token, clearSession]);

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: Boolean(user && token),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider."
    );
  }

  return context;
}
