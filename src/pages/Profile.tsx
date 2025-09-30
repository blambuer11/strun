import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Profile as ProfileComponent } from "@/components/Profile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isAuthenticated, logout, getCurrentUserInfo, getCurrentUserAddress } from "@/lib/zklogin";
import { getOrCreateWalletForUser } from "@/lib/auto-wallet";

const ProfilePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      // Check both zkLogin and Supabase auth
      const zkAuthenticated = isAuthenticated();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!zkAuthenticated && !authUser) {
        navigate("/auth");
        return;
      }

      // Get zkLogin info if available
      const zkInfo = getCurrentUserInfo();
      const zkAddress = getCurrentUserAddress();
      
      if (authUser) {
        // Ensure profile exists or create it
        let { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .maybeSingle();

        // If profile doesn't exist, create it
        if (!profile) {
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              user_id: authUser.id,
              email: authUser.email,
              username: authUser.email?.split('@')[0] || 'User',
              wallet_address: zkAddress || null
            })
            .select()
            .single();
          
          if (createError) {
            console.error("Failed to create profile:", createError);
            toast.error("Failed to create user profile");
          } else {
            profile = newProfile;
          }
        }

        // Get or create wallet address
        let walletAddress = zkAddress || profile?.wallet_address;
        
        // If no wallet, try to get or create auto-wallet for email users
        if (!walletAddress && authUser.email) {
          try {
            const wallet = await getOrCreateWalletForUser(authUser.id);
            if (wallet) {
              walletAddress = wallet.address;
              
              // Update profile with wallet address
              await supabase
                .from('profiles')
                .update({ wallet_address: walletAddress })
                .eq('user_id', authUser.id);
            }
          } catch (error) {
            console.error("Failed to get/create wallet:", error);
          }
        }

        if (profile) {
          setUser({
            name: profile.username || authUser.email?.split('@')[0] || 'User',
            address: walletAddress || 'No wallet',
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
      toast.error("Failed to load profile");
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