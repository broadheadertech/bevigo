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
      await logoutMutation({ token });
    }
    // Clear cookie by redirecting to login
    // The middleware will handle the redirect since the session is now invalid
    window.location.href = "/login";
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
