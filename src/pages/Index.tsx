import { useState, useEffect } from "react";
import { Welcome } from "@/components/Welcome";
import { MapView } from "@/components/MapView";
import { Profile } from "@/components/Profile";
import { Wallet } from "@/components/Wallet";
import { BottomNav } from "@/components/BottomNav";
import { toast } from "sonner";

const Index = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runStartTime, setRunStartTime] = useState<number | null>(null);
  const [runningStats, setRunningStats] = useState({
    distance: 0,
    time: "00:00",
    pace: 0
  });

  // User data
  const [user] = useState({
    name: "Egemen",
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
    setActiveTab("map");
    toast.success("Welcome to Strun! Start running to claim territories.");
  };

  const handleConnectWallet = () => {
    toast.info("Connecting to Sui wallet...");
    setTimeout(() => {
      setIsAuthenticated(true);
      setActiveTab("wallet");
      toast.success("Wallet connected successfully!");
    }, 1500);
  };

  const handleStartRun = () => {
    setIsRunning(true);
    setRunStartTime(Date.now());
    setRunningStats({ distance: 0, time: "00:00", pace: 0 });
    toast.success("Run started! Keep moving to claim territory.");
  };

  const handleStopRun = () => {
    setIsRunning(false);
    setRunStartTime(null);
    
    if (runningStats.distance >= 0.1) {
      toast.success(`Territory claimed! You've earned ${Math.floor(runningStats.distance * 1000)} XP!`);
    } else {
      toast.warning("Run more to claim a territory!");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setActiveTab("home");
    toast.info("Logged out successfully");
  };

  const handleBuyXP = () => {
    toast.info("XP purchase coming soon!");
  };

  const handleSendXP = () => {
    toast.info("XP transfer coming soon!");
  };

  // If not authenticated, show welcome screen
  if (!isAuthenticated) {
    return (
      <Welcome 
        onGetStarted={handleGetStarted}
        onConnectWallet={handleConnectWallet}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <div className="h-screen overflow-hidden">
        {activeTab === "home" && (
          <Welcome 
            onGetStarted={() => setActiveTab("map")}
            onConnectWallet={() => setActiveTab("wallet")}
          />
        )}
        
        {activeTab === "map" && (
          <div className="flex items-center justify-center h-full bg-muted/10">
            <div className="text-center p-8">
              <h2 className="text-2xl font-bold mb-2">Map Temporarily Disabled</h2>
              <p className="text-muted-foreground">
                We're fixing a technical issue with the map component
              </p>
              <p className="text-sm mt-4">
                Console: Debugging render2 error
              </p>
            </div>
          </div>
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
