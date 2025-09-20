import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Dashboard from "@/components/Dashboard";
import { toast } from "sonner";
import { isAuthenticated, getCurrentUserInfo } from "@/lib/zklogin";
import { supabase } from "@/integrations/supabase/client";
import { FirstTimeSetup } from "@/components/FirstTimeSetup";

const Home = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showFirstTimeSetup, setShowFirstTimeSetup] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    checkAuthAndProfile();
  }, []);

  const checkAuthAndProfile = async () => {
    try {
      // Check if authenticated with zkLogin
      if (!isAuthenticated()) {
        navigate("/auth");
        return;
      }

      // Get current user info from zkLogin
      const zkUserInfo = getCurrentUserInfo();
      if (!zkUserInfo?.address) {
        console.error("No zkLogin user info found");
        navigate("/auth");
        return;
      }

      // Create or sign in with Supabase using zkLogin address as identifier
      const email = `${zkUserInfo.address.toLowerCase()}@strun.zklogin`;
      const password = zkUserInfo.address; // Use address as password
      
      // Try to sign in first
      let { error: signInError, data: signInData } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        // If sign in fails, create new user
        const { error: signUpError, data: signUpData } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              wallet_address: zkUserInfo.address,
              username: zkUserInfo.name || email.split('@')[0]
            },
            emailRedirectTo: `${window.location.origin}/`
          }
        });

        if (signUpError) {
          console.error("Failed to create Supabase user:", signUpError);
          toast.error("Failed to sync profile. Please try again.");
          navigate("/auth");
          return;
        }

        // Auto sign in after sign up
        const { error: autoSignInError, data: autoSignInData } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (!autoSignInError && autoSignInData.user) {
          setUserId(autoSignInData.user.id);
          // New user - show first time setup
          setShowFirstTimeSetup(true);
        }
      } else if (signInData?.user) {
        setUserId(signInData.user.id);
        
        // Check if profile exists and is complete
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', signInData.user.id)
          .single();

        if (!profile || !profile.username) {
          // Profile incomplete, show setup
          setShowFirstTimeSetup(true);
        } else {
          setUserProfile(profile);
        }
      }
    } catch (error) {
      console.error("Auth/Profile check error:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSetupComplete = async () => {
    setShowFirstTimeSetup(false);
    await checkAuthAndProfile(); // Reload profile
  };

  const handleStartRun = () => {
    navigate("/map");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Dashboard userId={userId} onStartRun={handleStartRun} />
      {showFirstTimeSetup && (
        <FirstTimeSetup
          isOpen={showFirstTimeSetup}
          onComplete={handleSetupComplete}
          userEmail={userProfile?.email}
          userId={userId}
        />
      )}
    </div>
  );
};

export default Home;