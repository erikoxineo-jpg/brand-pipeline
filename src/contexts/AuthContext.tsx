import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type WorkspaceRole = Database["public"]["Enums"]["workspace_role"];

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

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: { display_name: string | null; avatar_url: string | null } | null;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentWorkspaceRole: WorkspaceRole | null;
  memberships: WorkspaceMembership[];
  setCurrentWorkspaceId: (id: string) => void;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [memberships, setMemberships] = useState<WorkspaceMembership[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const currentWorkspace =
    workspaces.find((w) => w.id === currentWorkspaceId) || workspaces[0] || null;
  const currentWorkspaceRole =
    memberships.find((m) => m.workspace_id === currentWorkspace?.id)?.role || null;

  const fetchUserData = async (userId: string) => {
    const profileRes = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", userId)
      .single();

    if (profileRes.data) {
      setProfile(profileRes.data);
    }

    // Ensure the user has at least one workspace; create a default one if needed.
    const membershipsRes = await supabase
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", userId);

    if (membershipsRes.error) {
      // In case the table doesn't exist yet or RLS misconfigured, fail gracefully.
      return;
    }

    let effectiveMemberships = membershipsRes.data ?? [];

    if (!effectiveMemberships.length) {
      const defaultName =
        profileRes.data?.display_name || "Meu primeiro workspace";

      const { error: rpcError } = await supabase
        .rpc("create_my_workspace", { ws_name: defaultName });

      if (rpcError) {
        setMemberships([]);
        setWorkspaces([]);
        setCurrentWorkspaceId(null);
        return;
      }

      const refreshedMemberships = await supabase
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", userId);

      if (refreshedMemberships.data) {
        effectiveMemberships = refreshedMemberships.data;
      }
    }

    setMemberships(effectiveMemberships);

    const workspaceIds = effectiveMemberships.map((m) => m.workspace_id);
    if (workspaceIds.length > 0) {
      const workspacesRes = await supabase
        .from("workspaces")
        .select("*")
        .in("id", workspaceIds);

      if (workspacesRes.data) {
        setWorkspaces(workspacesRes.data);
        if (!currentWorkspaceId && workspacesRes.data.length > 0) {
          setCurrentWorkspaceId(workspacesRes.data[0].id);
        }
      }
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchUserData(session.user.id), 0);
      } else {
        setProfile(null);
        setWorkspaces([]);
        setMemberships([]);
        setCurrentWorkspaceId(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        workspaces,
        currentWorkspace,
        currentWorkspaceRole,
        memberships,
        setCurrentWorkspaceId,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
