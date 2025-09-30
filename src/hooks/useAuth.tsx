import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  initService, 
  loginWithGoogle, 
  logout as zkLogout, 
  isAuthenticated, 
  getCurrentUserInfo, 
  getCurrentUserAddress 
} from "@/lib/zklogin";
import { upsertUser } from "@/services/userService";
import { toast } from "sonner";

export function useAuth() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      
      try {
        // Initialize zkLogin service
        await initService();
        
        // Check if authenticated
        const isAuth = isAuthenticated();
        setAuthenticated(isAuth);
        
        if (isAuth) {
          // Get user info and save to database
          const dbUser = await upsertUser();
          if (dbUser) {
            setUser(dbUser);
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        setLoading(false);
      }
    };
    
    initAuth();
  }, []);

  const login = async () => {
    try {
      await loginWithGoogle();
      // The page will redirect, so no need to handle response here
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Failed to login");
    }
  };

  const logout = async () => {
    try {
      zkLogout();
      setAuthenticated(false);
      setUser(null);
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout");
    }
  };

  return {
    loading,
    authenticated,
    user,
    login,
    logout
  };
}