import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface Brand {
  id: string;
  name: string;
  whatsapp_phone: string | null;
  inactivity_days: number;
  optout_keywords: string;
}

interface UserRole {
  brand_id: string;
  role: AppRole;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: { display_name: string | null; avatar_url: string | null } | null;
  brands: Brand[];
  currentBrand: Brand | null;
  currentRole: AppRole | null;
  userRoles: UserRole[];
  setCurrentBrandId: (id: string) => void;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [currentBrandId, setCurrentBrandId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const currentBrand = brands.find((b) => b.id === currentBrandId) || brands[0] || null;
  const currentRole = userRoles.find((r) => r.brand_id === (currentBrand?.id))?.role || null;

  const fetchUserData = async (userId: string) => {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("display_name, avatar_url").eq("user_id", userId).single(),
      supabase.from("user_roles").select("brand_id, role").eq("user_id", userId),
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    if (rolesRes.data) {
      setUserRoles(rolesRes.data);
      // Fetch brands the user has access to
      const brandIds = rolesRes.data.map((r) => r.brand_id);
      if (brandIds.length > 0) {
        const brandsRes = await supabase.from("brands").select("*").in("id", brandIds);
        if (brandsRes.data) {
          setBrands(brandsRes.data);
          if (!currentBrandId && brandsRes.data.length > 0) {
            setCurrentBrandId(brandsRes.data[0].id);
          }
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
        setBrands([]);
        setUserRoles([]);
        setCurrentBrandId(null);
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
        brands,
        currentBrand,
        currentRole,
        userRoles,
        setCurrentBrandId,
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
