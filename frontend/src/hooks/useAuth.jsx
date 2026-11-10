import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { TOKEN_STORAGE_KEY } from '../services/api';
import { authService } from '../services/authService';
import { applyThemeToDom } from './useTheme';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const syncTheme = useCallback((themePref) => {
    const resolved = themePref === 'light' ? 'light' : 'dark';
    localStorage.setItem('study_buddy_theme', resolved);
    applyThemeToDom(resolved);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const profile = await authService.getMe();
      setUser(profile);
      syncTheme(profile.theme_preference);
      return profile;
    } catch {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [syncTheme]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('study_buddy_theme') || 'dark';
    applyThemeToDom(savedTheme);
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener('study-buddy:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('study-buddy:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(
    async (credentials) => {
      const data = await authService.login(credentials);
      setUser(data.user);
      syncTheme(data.user?.theme_preference);
      return data;
    },
    [syncTheme]
  );

  const register = useCallback(
    async (payload) => {
      const data = await authService.register(payload);
      setUser(data.user);
      syncTheme(data.user?.theme_preference);
      return data;
    },
    [syncTheme]
  );

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const updateUserState = useCallback(
    (nextUser) => {
      setUser(nextUser);
      if (nextUser?.theme_preference) {
        syncTheme(nextUser.theme_preference);
      }
    },
    [syncTheme]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        loading,
        login,
        register,
        logout,
        refreshUser,
        updateUserState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

