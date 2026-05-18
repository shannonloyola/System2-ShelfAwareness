import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, AppRole, MOBILE_ALLOWED_ROLES, ROLE_TAB_ACCESS } from '../services/supabaseClient';

export interface Profile {
  full_name: string;
  role: AppRole;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  canAccessTab: (tabName: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch user profile (uses auth app_metadata and user_metadata to bypass broken profiles RLS policy recursion)
  const fetchProfile = async (targetUser: User): Promise<Profile | null> => {
    try {
      // 1. Try to read from token metadata first (bypasses broken profiles RLS policy)
      if (targetUser?.app_metadata?.role) {
        const role = targetUser.app_metadata.role as AppRole;
        const full_name = targetUser.user_metadata?.full_name || 
                          targetUser.user_metadata?.name || 
                          targetUser.email?.split('@')[0] || 
                          'User';
        return { full_name, role };
      }

      // 2. Fallback to profiles table query if not in metadata (will fail if RLS policy has recursion)
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', targetUser.id)
        .single();

      if (error) {
        return null;
      }

      return data as Profile;
    } catch (err) {
      return null;
    }
  };

  // Check and sync session on mount
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          const fetchedProf = await fetchProfile(session.user);
          if (mounted) {
            if (fetchedProf && MOBILE_ALLOWED_ROLES.includes(fetchedProf.role)) {
              setUser(session.user);
              setProfile(fetchedProf);
            } else if (fetchedProf) {
              // Blocked role on session restore - sign out immediately
              await supabase.auth.signOut();
              setUser(null);
              setProfile(null);
            } else {
              setUser(session.user);
              setProfile(null);
            }
          }
        }
      } catch (err) {
        // Silent failure
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Subscribe to auth state updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (session?.user) {
        setLoading(true);
        const fetchedProf = await fetchProfile(session.user);
        
        if (mounted) {
          if (fetchedProf && MOBILE_ALLOWED_ROLES.includes(fetchedProf.role)) {
            setUser(session.user);
            setProfile(fetchedProf);
          } else if (fetchedProf) {
            // Blocked role
            setUser(null);
            setProfile(null);
            await supabase.auth.signOut();
          } else {
            setUser(session.user);
            setProfile(null);
          }
          setLoading(false);
        }
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        setLoading(false);
        return { error: error.message };
      }

      if (data?.user) {
        const fetchedProf = await fetchProfile(data.user);
        if (!fetchedProf) {
          await supabase.auth.signOut();
          setLoading(false);
          return { error: 'Failed to retrieve your profile. Please contact an administrator.' };
        }

        if (!MOBILE_ALLOWED_ROLES.includes(fetchedProf.role)) {
          await supabase.auth.signOut();
          setLoading(false);
          return {
            error: 'Mobile access is not available for your role. Please use the web portal.',
          };
        }

        setUser(data.user);
        setProfile(fetchedProf);
        setLoading(false);
        return { error: null };
      }

      setLoading(false);
      return { error: 'Unknown error occurred during login.' };
    } catch (err: any) {
      setLoading(false);
      return { error: err.message || 'An unexpected login error occurred.' };
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      // Silent failure
    } finally {
      setUser(null);
      setProfile(null);
      setLoading(false);
    }
  };

  const canAccessTab = (tabName: string): boolean => {
    if (!profile) return false;
    const allowedTabs = ROLE_TAB_ACCESS[profile.role] || [];
    return allowedTabs.includes(tabName);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, canAccessTab }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
