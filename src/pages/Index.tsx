import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Welcome } from "@/components/Welcome";
import Dashboard from "@/components/Dashboard";
import { MapView } from "@/components/MapView";
import { Profile } from "@/components/Profile";
import { Wallet } from "@/components/Wallet";
import { BottomNav } from "@/components/BottomNav";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("home");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runStartTime, setRunStartTime] = useState<number | null>(null);
  const [session, setSession] = useState<any>(null);
  const [runningStats, setRunningStats] = useState({
    distance: 0,
    time: "00:00",
    pace: 0
  });

  // User data
  const [user] = useState({
    name: "User",
    address: "0xa7b2c4e5f6789abc8f9c",
    stats: {
      totalRuns: 47,
      distance: 234000, // meters
      xpEarned: 5680,
      territories: 3
    }
  });

  // Stats for map view
  const [stats] = useState({
    xp: 1240,
    territories: 3,
    distance: 2400 // meters today
  });

  // Wallet data
  const [balance] = useState(1240);
  const [transactions] = useState([
    {
      id: "1",
      type: "earn" as const,
      description: "Territory Claimed",
      amount: 150,
      timestamp: "2 hours ago"
    },
    {
      id: "2",
      type: "spend" as const,
      description: "Rent Paid",
      amount: 50,
      timestamp: "Yesterday"
    },
    {
      id: "3",
      type: "earn" as const,
      description: "Daily Reward",
      amount: 25,
      timestamp: "Yesterday"
    },
    {
      id: "4",
      type: "earn" as const,
      description: "Territory Rent",
      amount: 75,
      timestamp: "2 days ago"
    }
  ]);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setIsAuthenticated(!!session);
      if (!session) {
        setActiveTab("home");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    setIsAuthenticated(!!session);
  };

  // Update running stats
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning && runStartTime) {
      interval = setInterval(() => {
        const elapsed = Date.now() - runStartTime;
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const displaySeconds = seconds % 60;
        
        // Simulate distance increase (100m per 30 seconds)
        const distance = (seconds / 30) * 0.1;
        
        // Calculate pace (min/km)
        const pace = distance > 0 ? (seconds / 60) / distance : 0;
        
        setRunningStats({
          distance,
          time: `${minutes.toString().padStart(2, "0")}:${displaySeconds.toString().padStart(2, "0")}`,
          pace
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, runStartTime]);

  const handleGetStarted = () => {
    setIsAuthenticated(true);
    setActiveTab("home");
  };

  const handleConnectWallet = () => {
    toast.info("Connecting to Sui wallet...");
    setTimeout(() => {
      setIsAuthenticated(true);
      setActiveTab("wallet");
      toast.success("Wallet connected successfully!");
    }, 1500);
  };

  const handleStartRun = async () => {
    // Request location permission first
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {
          setIsRunning(true);
          setRunStartTime(Date.now());
          setRunningStats({ distance: 0, time: "00:00", pace: 0 });
          setActiveTab("map"); // Navigate to map page
          toast.success("🏃 Run started! GPS tracking enabled.");
        },
        (error) => {
          console.error("Location error:", error);
          toast.error("⚠️ Please enable location access to start running!");
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    } else {
      toast.error("Geolocation is not supported by your browser");
    }
  };

  const handleStopRun = () => {
    setIsRunning(false);
    setRunStartTime(null);
    
    const xpEarned = Math.floor(runningStats.distance * 1000);
    if (xpEarned > 0) {
      toast.success(`Run completed! You've earned ${xpEarned} XP!`);
    } else {
      toast.info("Run completed!");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setSession(null);
    setActiveTab("home");
    toast.info("Logged out successfully");
  };

  const handleBuyXP = () => {
    toast.info("XP purchase coming soon!");
  };

  const handleSendXP = () => {
    toast.info("XP transfer coming soon!");
  };

  // Show welcome page if not authenticated
  if (!isAuthenticated) {
    return (
      <Welcome 
        onGetStarted={handleGetStarted}
        onConnectWallet={handleConnectWallet}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Main Content - Changed to allow scrolling */}
      <div className="min-h-screen overflow-y-auto pb-16">
        {activeTab === "home" && (
          <Dashboard userId={session?.user?.id} onStartRun={handleStartRun} />
        )}
        
        {activeTab === "map" && (
          <MapView
            isRunning={isRunning}
            onStartRun={handleStartRun}
            onStopRun={handleStopRun}
            stats={stats}
            runningStats={runningStats}
          />
        )}
        
        {activeTab === "wallet" && (
          <Wallet
            balance={balance}
            transactions={transactions}
            onBuyXP={handleBuyXP}
            onSendXP={handleSendXP}
          />
        )}
        
        {activeTab === "profile" && (
          <Profile
            user={user}
            onLogout={handleLogout}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      {isAuthenticated && (
        <BottomNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      )}
    </div>
  );
};

export default Index;