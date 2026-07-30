import React, { createContext, useState, useContext, useEffect } from 'react';
import { api } from '@/api/apiClient';

// Auth context. In the standalone demo there is no remote auth backend, so we resolve the
// (demo) user from our own BFF (`api.auth.me()` → demo-api /auth/me) and never block the app
// on a remote auth check.
// The de-facto "login" is the PasswordGate, whose password is verified server-side; this context
// just exposes a user — except for the one case below, where the gate session has expired.
const AuthContext = createContext();

/** Did this request fail because the gate proof is missing, expired or rejected? */
function isGateFailure(error) {
  return (
    /** @type {any} */ (error)?.status === 401 &&
    String(/** @type {any} */ (error)?.body ?? '').includes('gate_required')
  );
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    checkUserAuth();
  }, []);

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await api.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Demo auth check failed:', error);
      setIsAuthenticated(false);
      // An expired gate session is the one failure worth acting on rather than rendering through.
      // Without this the app would come up looking normal with every panel quietly erroring; the
      // proof has a 12 h lifetime, so this is a case a real reviewer will hit. demoApi has already
      // discarded the dead proof, so this just returns them to the gate to type the password again.
      if (isGateFailure(error)) navigateToLogin();
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    api.auth.logout();
  };

  const navigateToLogin = () => {
    api.auth.redirectToLogin();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        // kept for API compatibility with existing consumers (no remote settings in the demo)
        isLoadingPublicSettings: false,
        authError: null,
        appPublicSettings: null,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState: checkUserAuth,
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
