import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Profile as ProfileComponent } from "@/components/Profile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isAuthenticated, logout, getCurrentUserInfo } from "@/lib/zklogin";

const ProfilePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      if (!isAuthenticated()) {
        navigate("/auth");
        return;
      }

      // Get zkLogin info
      const zkInfo = getCurrentUserInfo();
      
      // Get Supabase user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (authUser) {
        // Get profile data
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .single();

        if (profile) {
          setUser({
            name: profile.username || 'User',
            address: zkInfo?.address || '0x...',
            stats: {
              totalRuns: profile.total_runs || 0,
              distance: profile.total_distance || 0,
              xpEarned: profile.xp || 0,
              territories: 0
            }
          });
        }
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    toast.info("Başarıyla çıkış yapıldı");
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <ProfileComponent
      user={user}
      onLogout={handleLogout}
    />
  );
};

export default ProfilePage;