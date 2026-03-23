import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, setTelegramInitData, setJwtToken, getJwtToken, clearJwtToken, User, UserWithRoles } from './api';
import { getInitDataRaw } from './telegram-provider';
import { isBrowser, isCapacitorNative } from './environment';

interface AuthContextType {
  user: User | null;
  permissions: string[];
  roleNames: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  showEnrollment: boolean;  // Whether to show enrollment screen
  isEnrolling: boolean;     // Whether enrollment API is in progress
  needsBrowserLogin: boolean; // Whether to show browser login page
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
  login: () => Promise<void>;
  loginWithWidget: (token: string, user: User, permissions?: string[], roleNames?: string[]) => void;
  refreshUser: () => Promise<void>;
  completeEnrollment: (timezone: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roleNames, setRoleNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);

  // Show enrollment based on server state - default false until we know from server
  const showEnrollment = user !== null && !user.enrollmentCompleted;

  const setUserWithRoles = useCallback((data: UserWithRoles) => {
    setUser(data.user);
    setPermissions(data.permissions || []);
    setRoleNames(data.roleNames || []);
  }, []);

  // Mark enrollment as completed via API
  const completeEnrollment = useCallback(async (timezone: string) => {
    if (!user || isEnrolling) return;

    setIsEnrolling(true);
    try {
      const response = await authApi.completeEnrollment(timezone);
      // Update user with new enrollment status
      setUser(response.user);
    } catch (err) {
      console.error('Failed to complete enrollment:', err);
      // Still allow user to continue even if API fails
      setUser(prev => prev ? { ...prev, enrollmentCompleted: true } : null);
    } finally {
      setIsEnrolling(false);
    }
  }, [user, isEnrolling]);

  // Browser login callback (called by BrowserLoginPage after Telegram Login Widget success)
  const loginWithWidget = useCallback((token: string, userData: User, perms?: string[], roles?: string[]) => {
    setJwtToken(token);
    setUser(userData);
    setPermissions(perms || []);
    setRoleNames(roles || []);
    setIsLoading(false);
    setError(null);
  }, []);

  const login = useCallback(async () => {
    const initDataRaw = getInitDataRaw();

    if (initDataRaw) {
      // Mini App mode — authenticate with initData
      try {
        setIsLoading(true);
        setError(null);
        setTelegramInitData(initDataRaw);
        const data = await authApi.loginWithTelegram();
        setUserWithRoles(data);
      } catch (err) {
        console.error('Login failed:', err);
        setError(err instanceof Error ? err.message : 'Login failed');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Browser / Capacitor mode — try existing JWT token
    if (isBrowser()) {
      let token = getJwtToken();

      // Capacitor cold start: check if app was launched by auth deep link
      // (appUrlOpen event fires before listeners are ready, so we must check getLaunchUrl)
      if (!token && isCapacitorNative()) {
        try {
          const { App } = await import('@capacitor/app');
          const launchUrl = await App.getLaunchUrl();
          // Use string matching — new URL() handles custom schemes inconsistently
          // across Android WebView versions
          if (launchUrl?.url && launchUrl.url.includes('://auth/callback')) {
            const tokenMatch = launchUrl.url.match(/[?&]token=([^&]+)/);
            const launchToken = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
            if (launchToken) {
              setJwtToken(launchToken);
              token = launchToken;
            }
          }
        } catch {
          // Not in Capacitor or getLaunchUrl failed — continue normally
        }
      }

      if (token) {
        try {
          setIsLoading(true);
          setError(null);
          const data = await authApi.getCurrentUser();
          setUserWithRoles(data);
        } catch {
          // fetchWithAuth clears token on 401 — check if it's still there
          if (getJwtToken()) {
            // Token still valid but network error — retry after delay
            await new Promise(r => setTimeout(r, 2000));
            try {
              const data = await authApi.getCurrentUser();
              setUserWithRoles(data);
            } catch {
              // Second attempt failed too — if token still exists, keep loading state
              // so user doesn't see login page for a transient error
              if (!getJwtToken()) {
                // Token was cleared (401) — fall through to show login
              }
            }
          }
          // Token cleared by 401 — will show login page
        } finally {
          setIsLoading(false);
        }
        return;
      }
      // No JWT — will show browser login page
      setIsLoading(false);
      return;
    }

    // Dev mode fallback
    if (import.meta.env.DEV) {
      console.log('Development mode: Using mock user data');
      const mockCreatedAt = new Date().toISOString();
      setUser({
        id: 1,
        telegramId: 123456789,
        username: 'dev_user',
        firstName: '测试',
        lastName: '用户',
        languageCode: 'zh',
        isPremium: false,
        photoUrl: null,
        bio: null,
        tags: [],
        allowTelegramContact: true,
        credits: 100,
        campusPoints: 500,
        enrollmentCompleted: false,
        isAdmin: true,
        isBanned: false,
        bannedAt: null,
        bannedReason: null,
        statusText: null,
        statusImageKey: null,
        statusUpdatedAt: null,
        createdAt: mockCreatedAt,
        updatedAt: mockCreatedAt,
      });
      // Mock admin permissions for dev
      setPermissions([
        'admin.panel', 'course.manage', 'content.review', 'content.takedown',
        'comment.moderate', 'post.feature', 'user.ban', 'user.view', 'user.role.manage',
        'item.manage', 'item.grant', 'punishment.manage', 'buff.manage',
        'role.manage', 'changelog.manage', 'foundation.manage', 'feedback.manage',
        'sticker.manage', 'landmark.manage', 'club.manage', 'category.manage',
        'major.manage', 'task.manage',
      ]);
      setRoleNames(['校长']);
    }

    setIsLoading(false);
  }, [setUserWithRoles]);

  const refreshUser = useCallback(async () => {
    const initDataRaw = getInitDataRaw();
    const token = getJwtToken();
    if (!initDataRaw && !token) return;

    try {
      const data = await authApi.getCurrentUser();
      setUserWithRoles(data);
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  }, [setUserWithRoles]);

  // Auto-login on mount
  useEffect(() => {
    // Small delay to ensure TelegramProvider has initialized
    const timer = setTimeout(() => {
      login();
    }, 100);
    return () => clearTimeout(timer);
  }, [login]);

  const hasPermission = useCallback((permission: string) => {
    return permissions.includes(permission);
  }, [permissions]);

  const hasAnyPermission = useCallback((...perms: string[]) => {
    return perms.some(p => permissions.includes(p));
  }, [permissions]);

  // Show browser login when: not loading, no user, in browser mode, AND no stored token
  // (if token exists but user is null, it's likely a network issue — don't show login page)
  const needsBrowserLogin = !isLoading && !user && isBrowser() && !getJwtToken();

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        roleNames,
        isLoading,
        isAuthenticated: !!user,
        error,
        showEnrollment,
        isEnrolling,
        needsBrowserLogin,
        hasPermission,
        hasAnyPermission,
        login,
        loginWithWidget,
        refreshUser,
        completeEnrollment,
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

// Hook to get display name from user
export const useUserDisplayName = () => {
  const { user } = useAuth();
  if (!user) return 'Guest';

  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  return user.firstName || user.username || 'User';
};

// Hook to get user avatar URL
export const useUserAvatar = () => {
  const { user } = useAuth();
  // Return photoUrl if available, otherwise a default avatar
  return user?.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.firstName || 'U')}&background=EE5A7C&color=fff`;
};
