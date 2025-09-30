import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Profile as ProfileComponent } from "@/components/Profile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isAuthenticated, logout, getCurrentUserInfo, getCurrentUserAddress } from "@/lib/zklogin";
import { getOrCreateWalletForUser } from "@/lib/auto-wallet";
import { Button } from "@/components/ui/button";

const ProfilePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      // Get Supabase user first
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        // Check zkLogin as fallback
        if (!isAuthenticated()) {
          navigate("/auth");
          return;
        }
      }

      // Get zkLogin info if available
      const zkInfo = getCurrentUserInfo();
      const zkAddress = getCurrentUserAddress();
      
      if (authUser) {
        // Check if profile exists
        let { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .maybeSingle();

        // If profile doesn't exist, create it
        if (!profile && authUser.email) {
          console.log("Creating new profile for user:", authUser.id);
          
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              user_id: authUser.id,
              email: authUser.email,
              username: authUser.email.split('@')[0] || 'User',
              wallet_address: zkAddress || null,
              level: 1,
              xp: 0,
              total_runs: 0,
              total_distance: 0,
              total_area: 0,
              referral_count: 0,
              referral_xp_earned: 0
            })
            .select()
            .single();
          
          if (createError) {
            console.error("Profile creation error:", createError);
            toast.error("Profil oluşturulamadı: " + createError.message);
            return;
          } else {
            profile = newProfile;
            toast.success("Profil başarıyla oluşturuldu!");
          }
        }

        // Get or create wallet address
        let walletAddress = zkAddress || profile?.wallet_address;
        
        // If no wallet, try to get or create auto-wallet for email users
        if (!walletAddress && authUser.email && authUser.id) {
          try {
            console.log("Getting/creating wallet for user:", authUser.id);
            const wallet = await getOrCreateWalletForUser(authUser.id);
            if (wallet) {
              walletAddress = wallet.address;
              console.log("Wallet address obtained:", walletAddress);
              
              // Update profile with wallet address
              if (profile) {
                await supabase
                  .from('profiles')
                  .update({ wallet_address: walletAddress })
                  .eq('user_id', authUser.id);
              }
            }
          } catch (error) {
            console.error("Wallet creation/retrieval error:", error);
          }
        }

        if (profile) {
          setUser({
            name: profile.username || authUser.email?.split('@')[0] || 'User',
            address: walletAddress || 'Wallet yok',
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
      console.error("Profile loading error:", error);
      toast.error("Profil yüklenemedi");
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

  // If no user data, show message
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No profile data available</p>
          <Button onClick={() => navigate("/auth")} className="mt-4">
            Go to Login
          </Button>
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