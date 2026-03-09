// --------------------------------------------------------------------------
// AuthContext — backed by the REST API + Socket.io.
// --------------------------------------------------------------------------

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";

import {
  apiFetch,
  setTokens,
  clearTokens,
  getAccessToken,
  setWorkspaceId,
  getWorkspaceId,
} from "@/lib/api/client";

import { connectSocket, disconnectSocket } from "@/lib/api/socket";

// ── Types ──────────────────────────────────────────────────────────────────

type WorkspaceRole = "owner" | "admin" | "member";

interface AppUser {
  id: string;
  email: string;
}

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
}

interface Workspace {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
}

interface WorkspaceMembership {
  workspace_id: string;
  role: WorkspaceRole;
}

interface SubscriptionInfo {
  plan: string;
  status: string | null;
  billingType: string | null;
  limits: { maxLeads: number; maxMessages: number; maxUsers: number };
  currentPeriodEnd: string | null;
}

const defaultSubscription: SubscriptionInfo = {
  plan: "free",
  status: null,
  billingType: null,
  limits: { maxLeads: 50, maxMessages: 100, maxUsers: 1 },
  currentPeriodEnd: null,
};

// Public interface — kept compatible with the old Supabase-based context so
// consumers (pages, components) do not need changes.
export interface AuthContextType {
  /** Always null. Kept for backward compatibility with pages that reference `session`. */
  session: null;
  user: AppUser | null;
  profile: Profile | null;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentWorkspaceRole: WorkspaceRole | null;
  memberships: WorkspaceMembership[];
  subscription: SubscriptionInfo;
  setCurrentWorkspaceId: (id: string) => void;
  loading: boolean;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
}

// ── API response shapes ────────────────────────────────────────────────────

interface AuthMeResponse {
  user: AppUser;
  profile: Profile;
  workspaces: Workspace[];
  memberships: WorkspaceMembership[];
  subscription: SubscriptionInfo | null;
}

interface AuthLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AppUser;
  profile: Profile;
  workspaces: Workspace[];
  memberships: WorkspaceMembership[];
  subscription: SubscriptionInfo | null;
}

interface AuthSignupResponse {
  accessToken: string;
  refreshToken: string;
  user: AppUser;
  profile: Profile;
  workspaces: Workspace[];
  memberships: WorkspaceMembership[];
  subscription: SubscriptionInfo | null;
}

// ── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Provider ───────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [memberships, setMemberships] = useState<WorkspaceMembership[]>([]);
  const [currentWsId, setCurrentWsId] = useState<string | null>(
    getWorkspaceId,
  );
  const [subscription, setSubscription] =
    useState<SubscriptionInfo>(defaultSubscription);
  const [loading, setLoading] = useState(true);

  // Derived state
  const currentWorkspace =
    workspaces.find((w) => w.id === currentWsId) || workspaces[0] || null;
  const currentWorkspaceRole =
    memberships.find((m) => m.workspace_id === currentWorkspace?.id)?.role ??
    null;

  // ── Helpers ────────────────────────────────────────────────────────────

  /** Apply data returned from /auth/me or login/signup into state. */
  const applyUserData = useCallback(
    (data: {
      user: AppUser;
      profile: Profile;
      workspaces: Workspace[];
      memberships: WorkspaceMembership[];
      subscription: SubscriptionInfo | null;
    }) => {
      setUser(data.user);
      setProfile(data.profile);
      setWorkspaces(data.workspaces);
      setMemberships(data.memberships);
      setSubscription(data.subscription ?? defaultSubscription);

      // Resolve current workspace id
      const savedWsId = getWorkspaceId();
      const validSaved = data.workspaces.some((w) => w.id === savedWsId);
      const effectiveWsId = validSaved
        ? savedWsId!
        : data.workspaces[0]?.id ?? null;

      if (effectiveWsId) {
        setCurrentWsId(effectiveWsId);
        setWorkspaceId(effectiveWsId);
      }
    },
    [],
  );

  /** Connect socket using current token + workspace. */
  const ensureSocket = useCallback((wsId: string | null) => {
    const token = getAccessToken();
    if (token && wsId) {
      connectSocket(token, wsId);
    }
  }, []);

  // ── fetchMe ────────────────────────────────────────────────────────────

  const fetchMe = useCallback(async () => {
    const data = await apiFetch<AuthMeResponse>("/auth/me");
    applyUserData(data);
    return data;
  }, [applyUserData]);

  // ── On mount ───────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await fetchMe();
        if (cancelled) return;

        // Connect socket after data is loaded
        const savedWsId = getWorkspaceId();
        const validSaved = data.workspaces.some((w) => w.id === savedWsId);
        const wsId = validSaved ? savedWsId : data.workspaces[0]?.id ?? null;
        ensureSocket(wsId);
      } catch {
        // fetchMe already handles 401 refresh internally via apiFetch.
        // If we still end up here the tokens are already cleared.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── signIn ─────────────────────────────────────────────────────────────

  const signIn = useCallback(
    async (email: string, password: string) => {
      const data = await apiFetch<AuthLoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        noAuth: true,
      });

      setTokens(data.accessToken, data.refreshToken);
      applyUserData(data);

      const wsId = data.workspaces[0]?.id ?? null;
      if (wsId) setWorkspaceId(wsId);
      ensureSocket(wsId);
    },
    [applyUserData, ensureSocket],
  );

  // ── signUp ─────────────────────────────────────────────────────────────

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const data = await apiFetch<AuthSignupResponse>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, display_name: displayName }),
        noAuth: true,
      });

      setTokens(data.accessToken, data.refreshToken);
      applyUserData(data);

      const wsId = data.workspaces[0]?.id ?? null;
      if (wsId) setWorkspaceId(wsId);
      ensureSocket(wsId);
    },
    [applyUserData, ensureSocket],
  );

  // ── signOut ────────────────────────────────────────────────────────────

  const signOut = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        await apiFetch("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch {
      // Best-effort — even if the server call fails we still clear local state.
    }

    clearTokens();
    disconnectSocket();

    setUser(null);
    setProfile(null);
    setWorkspaces([]);
    setMemberships([]);
    setCurrentWsId(null);
    setSubscription(defaultSubscription);
  }, []);

  // ── setCurrentWorkspaceId ──────────────────────────────────────────────

  const handleSetCurrentWorkspaceId = useCallback(
    (id: string) => {
      setCurrentWsId(id);
      setWorkspaceId(id);
      ensureSocket(id);
    },
    [ensureSocket],
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <AuthContext.Provider
      value={{
        session: null,
        user,
        profile,
        workspaces,
        currentWorkspace,
        currentWorkspaceRole,
        memberships,
        subscription,
        setCurrentWorkspaceId: handleSetCurrentWorkspaceId,
        loading,
        signOut,
        signIn,
        signUp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ── Hook ───────────────────────────────────────────────────────────────────

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
