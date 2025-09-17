import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Dashboard from "@/components/Dashboard";
import { supabase } from "@/integrations/supabase/client";
import { isAuthenticated } from "@/lib/zklogin";

const Home = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session && !isAuthenticated()) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkAuth = async () => {
    // Check zkLogin first
    if (!isAuthenticated()) {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    }
  };

  const handleStartRun = () => {
    navigate("/map");
  };

  return (
    <div className="min-h-screen bg-background">
      <Dashboard userId={session?.user?.id} onStartRun={handleStartRun} />
    </div>
  );
};

export default Home;