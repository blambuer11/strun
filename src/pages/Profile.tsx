import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Profile as ProfileComponent } from "@/components/Profile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isAuthenticated, logout } from "@/lib/zklogin";

const ProfilePage = () => {
  const navigate = useNavigate();
  
  const [user] = useState({
    name: "User",
    address: "0xa7b2c4e5f6789abc8f9c",
    stats: {
      totalRuns: 47,
      distance: 234000,
      xpEarned: 5680,
      territories: 3
    }
  });

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/auth");
    }
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    toast.info("Başarıyla çıkış yapıldı");
    navigate("/auth");
  };

  return (
    <ProfileComponent
      user={user}
      onLogout={handleLogout}
    />
  );
};

export default ProfilePage;