"use client";
import {
  createContext,
  useContext,
  ReactNode,
} from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

type AuthSession = {
  userId: Id<"users">;
  tenantId: Id<"tenants">;
  role: string;
  userName: string;
  locationIds: Id<"locations">[];
};

type AuthContextType = {
  session: AuthSession | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  logout: async () => {},
});

export function AuthProvider({
  children,
  token,
}: {
  children: ReactNode;
  token: string | null;
}) {
  const sessionData = useQuery(
    api.auth.session.validateSession,
    token ? { token } : "skip"
  );
  const logoutMutation = useMutation(api.auth.session.logout);

  const isLoading = token !== null && sessionData === undefined;

  const logout = async () => {
    if (token) {
      try {
        await logoutMutation({ token });
      } catch {
        // Even if the server call fails, still tear down the client-side
        // session so the user isn't trapped in a stale UI.
      }
    }

    if (typeof document !== "undefined") {
      // Expire the auth cookie on every plausible path so middleware no
      // longer sees a token. Without this, refreshing the login page can
      // re-attach the dead token and flash old auth state.
      document.cookie =
        "session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
      document.cookie =
        "session_token=; Path=/login; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    }

    if (typeof window !== "undefined") {
      // Drop any cached service-worker assets so the next page load fetches
      // a fresh shell — prevents stale UI from a previous user.
      try {
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {
        // ignore
      }

      // Hard reload to "/login" so React tree, Convex client subscriptions,
      // and any in-memory state from the previous session are discarded.
      window.location.replace("/login");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session: sessionData ?? null,
        token,
        isLoading,
        isAuthenticated: !!sessionData,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
