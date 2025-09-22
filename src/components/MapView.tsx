import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Square, Battery, Radio, Navigation, MapPin, TrendingUp, Map, AlertTriangle, Coins } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import OpenStreetMap from "./OpenStreetMap";
import { claimTerritory, getUserTerritories, payTerritoryRent, startRunSession, completeRunSession } from "@/lib/sui-transactions";
import { toast } from "sonner";
import strunLogo from "@/assets/strun-logo-new.png";
import { getCurrentUserInfo } from "@/lib/zklogin";
import { supabase } from "@/integrations/supabase/client";
import { mintLandNFT, isZoneMinted } from "@/lib/sui-land-contract";

interface MapViewProps {
  isRunning: boolean;
  onStartRun: () => void;
  onStopRun: () => void;
  stats: {
    xp: number;
    territories: number;
    distance: number;
  };
  runningStats?: {
    distance: number;
    time: string;
    pace: number;
  };
}

export function MapView({ 
  isRunning, 
  onStartRun, 
  onStopRun, 
  stats,
  runningStats = { distance: 0, time: "00:00", pace: 0 }
}: MapViewProps) {
  const [showRentModal, setShowRentModal] = useState(false);
  const [rentTerritory, setRentTerritory] = useState<any>(null);
  const [territories, setTerritories] = useState<any[]>([]);
  const [canClaim, setCanClaim] = useState(false);
  const [territoryPath, setTerritoryPath] = useState<Array<{ lat: number; lng: number }>>([]);
  const [territoryArea, setTerritoryArea] = useState(0);
  const [currentDistance, setCurrentDistance] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [runTime, setRunTime] = useState("00:00");
  const [runStartTime, setRunStartTime] = useState<number | null>(null);
  const [showMintModal, setShowMintModal] = useState(false);
  const [runCompleted, setRunCompleted] = useState(false);
  const [completedPath, setCompletedPath] = useState<Array<{ lat: number; lng: number }>>([]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning) {
      if (!runStartTime) {
        setRunStartTime(Date.now());
      }
      
      interval = setInterval(() => {
        if (runStartTime) {
          const elapsed = Date.now() - runStartTime;
          const seconds = Math.floor(elapsed / 1000);
          const minutes = Math.floor(seconds / 60);
          const displaySeconds = seconds % 60;
          setRunTime(`${minutes.toString().padStart(2, "0")}:${displaySeconds.toString().padStart(2, "0")}`);
        }
      }, 1000);
    } else {
      setRunTime("00:00");
      setRunStartTime(null);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, runStartTime]);

  // Load existing territories
  useEffect(() => {
    const loadTerritories = async () => {
      try {
        // Get current user info
        const zkInfo = getCurrentUserInfo();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        // Get all regions from database
        const { data: regions, error } = await supabase
          .from('regions')
          .select('*');
        
        if (error) {
          console.error("Failed to load regions:", error);
          return;
        }
        
        // Format regions for map display
        const formattedTerritories = regions?.map(region => ({
          id: region.id,
          name: region.name,
          coordinates: region.coordinates as Array<{ lat: number; lng: number }>,
          owner: region.owner_id || 'Unknown',
          rentPrice: region.rent_price || 20,
          isOwned: authUser?.id && region.owner_id === authUser.id
        })) || [];
        
        setTerritories(formattedTerritories);
      } catch (error) {
        console.error("Failed to load territories:", error);
      }
    };
    loadTerritories();
  }, []);

  const handleTerritoryComplete = (area: number, path: Array<{ lat: number; lng: number }>) => {
    setCanClaim(true);
    setTerritoryArea(area);
    setTerritoryPath(path);
    toast.success(`Territory ready to claim! Area: ${area.toFixed(0)} m²`);
  };
  
  const handleEnterExistingTerritory = (territory: { id: string; name: string; owner: string; rentPrice: number }) => {
    // Don't show rent modal if it's the user's own territory
    const isOwned = territories.find(t => t.id === territory.id)?.isOwned;
    if (isOwned) {
      toast.info(`Welcome back to your territory: ${territory.name}`);
      return;
    }
    
    setRentTerritory(territory);
    setShowRentModal(true);
    toast.warning(`⚠️ You've entered ${territory.name}! Rent: ${territory.rentPrice} XP`);
  };

  const handleClaimTerritory = async () => {
    if (!canClaim || !isRunning) return;
    
    try {
      const territoryName = prompt("Name your territory:") || "My Territory";
      const rentPrice = Math.floor(territoryArea / 100); // 1 XP per 100m²
      
      await claimTerritory({
        name: territoryName,
        coordinates: territoryPath,
        area: territoryArea,
        rentPrice,
      });
      
      toast.success(`Territory "${territoryName}" claimed! You earned ${Math.floor(territoryArea / 10)} XP!`);
      setCanClaim(false);
      
      // Reload territories
      const updatedTerritories = await getUserTerritories();
      setTerritories(updatedTerritories);
      
      onStopRun();
    } catch (error) {
      console.error("Failed to claim territory:", error);
      toast.error("Failed to claim territory. Please try again.");
    }
  };
  
  const handlePayRent = async () => {
    if (!rentTerritory) return;
    
    try {
      await payTerritoryRent(
        rentTerritory.id,
        rentTerritory.owner,
        rentTerritory.rentPrice
      );
      toast.success(`Paid ${rentTerritory.rentPrice} XP rent to territory owner`);
      setShowRentModal(false);
      setRentTerritory(null);
    } catch (error) {
      console.error("Failed to pay rent:", error);
      toast.error("Failed to pay rent");
    }
  };
  
  const handleDeclineRent = () => {
    if (rentTerritory) {
      const penalty = rentTerritory.rentPrice * 2;
      toast.warning(`Penalty: ${penalty} XP will be deducted`);
    }
    setShowRentModal(false);
    setRentTerritory(null);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="glass-card backdrop-blur-xl border-b border-white/10 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <img 
              src={strunLogo} 
              alt="StRun Logo" 
              className="h-10 w-auto object-contain"
            />
            <div>
              <p className="text-xs text-muted-foreground">
                {isRunning ? (
                  <span className="flex items-center gap-1">
                    <Radio className="w-3 h-3 text-destructive animate-pulse" />
                    Running...
                  </span>
                ) : (
                  "Ready to run"
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Battery className="w-4 h-4" />
            <span className="text-sm">89%</span>
          </div>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative overflow-hidden">
        <OpenStreetMap 
          isRunning={isRunning}
          onTerritoryComplete={handleTerritoryComplete}
          onEnterExistingTerritory={handleEnterExistingTerritory}
          onDistanceUpdate={(distance) => {
            setCurrentDistance(distance);
            // Calculate XP: 1 XP per 10 meters
            const newXp = Math.floor(distance / 10);
            if (newXp > xpEarned) {
              setXpEarned(newXp);
              toast.success(`+${newXp - xpEarned} XP earned!`);
            }
          }}
          existingTerritories={territories}
        />
      </div>

      {/* Bottom Controls */}
      <div className="glass-card backdrop-blur-xl border-t border-white/10 pb-20">
        <div className="p-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">
                {isRunning ? currentDistance.toFixed(0) : stats.xp}
              </div>
              <div className="text-xs text-muted-foreground">
                {isRunning ? "Meters" : "XP"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">
                {isRunning ? runTime : stats.territories}
              </div>
              <div className="text-xs text-muted-foreground">
                {isRunning ? "Time" : "Territories"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">
                {isRunning ? `${xpEarned} XP` : `${(stats.distance / 1000).toFixed(1)}km`}
              </div>
              <div className="text-xs text-muted-foreground">
                {isRunning ? "Earned" : "Today"}
              </div>
            </div>
          </div>

          {/* Run Button */}
          {canClaim && isRunning ? (
            <Button
              variant="gradient"
              size="lg"
              className="w-full h-14 text-lg rounded-xl animate-pulse"
              onClick={handleClaimTerritory}
            >
              <MapPin className="mr-2" />
              Claim Territory ({(territoryArea / 10000).toFixed(2)} ha)
            </Button>
          ) : (
            <Button
              variant={isRunning ? "running" : "gradient"}
              size="lg"
              className="w-full h-14 text-lg rounded-xl shadow-lg"
              onClick={async () => {
                if (isRunning) {
                  onStopRun();
                  if (territoryPath.length > 0) {
                    setRunCompleted(true);
                    setCompletedPath(territoryPath);
                    setShowMintModal(true);
                  }
                } else {
                  onStartRun();
                }
              }}
            >
              {isRunning ? (
                <>
                  <Square className="mr-2" />
                  Stop Running
                </>
              ) : (
                <>
                  <Play className="mr-2" />
                  Start Run
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Rent Modal */}
      <Dialog open={showRentModal} onOpenChange={setShowRentModal}>
        <DialogContent className="bg-card border-white/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl">🏃‍♂️ Territory Entry</DialogTitle>
            <DialogDescription className="text-muted-foreground pt-2">
              {rentTerritory ? (
                <>You've entered {rentTerritory.name}. Pay {rentTerritory.rentPrice} XP rent to continue?</>
              ) : (
                <>You've entered a territory. Pay rent to continue?</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-4">
            <Button 
              variant="gradient" 
              onClick={handlePayRent}
              className="w-full"
            >
              Pay {rentTerritory?.rentPrice || 100} XP
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDeclineRent}
              className="w-full text-destructive border-destructive/50 hover:bg-destructive/10"
            >
              Decline ({rentTerritory ? rentTerritory.rentPrice * 2 : 200} XP penalty)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* NFT Mint Modal */}
      <Dialog open={showMintModal} onOpenChange={setShowMintModal}>
        <DialogContent className="bg-card border-white/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Coins className="h-5 w-5 text-accent" />
              Mint Territory NFT
            </DialogTitle>
            <DialogDescription className="text-muted-foreground pt-2">
              You've completed a run in this area! Would you like to mint this territory as an NFT on Sui blockchain?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Area</p>
                <p className="font-semibold">{(territoryArea / 10000).toFixed(2)} ha</p>
              </div>
              <div>
                <p className="text-muted-foreground">XP Earned</p>
                <p className="font-semibold text-accent">{xpEarned} XP</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              variant="gradient" 
              onClick={async () => {
                try {
                  if (completedPath.length > 0) {
                    // Check if zone is already minted
                    const isMinted = await isZoneMinted(
                      completedPath[0].lat,
                      completedPath[0].lng,
                      18 // Default zoom level
                    );

                    if (isMinted) {
                      toast.error("This area has already been minted as NFT!");
                      setShowMintModal(false);
                      return;
                    }

                    const territoryName = prompt("Name your territory:") || "My Territory";
                    
                    // Mint NFT on Sui
                    const nftId = await mintLandNFT(
                      completedPath,
                      18,
                      territoryName,
                      `Territory captured on ${new Date().toLocaleDateString()}`
                    );

                    toast.success(`NFT Minted! ID: ${nftId.slice(0, 8)}...`);
                    
                    // Save to database
                    const { data: authUser } = await supabase.auth.getUser();
                    if (authUser?.user) {
                      const { data: profile } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('user_id', authUser.user.id)
                        .single();

                      if (profile) {
                        await supabase.from('regions').insert({
                          name: territoryName,
                          coordinates: completedPath,
                          area: territoryArea,
                          owner_id: profile.id,
                          nft_id: nftId,
                          rent_price: Math.floor(territoryArea / 100)
                        });
                      }
                    }
                  }
                  setShowMintModal(false);
                } catch (error) {
                  console.error("Failed to mint NFT:", error);
                  toast.error("Failed to mint NFT");
                }
              }}
              className="w-full"
            >
              <Coins className="mr-2 h-4 w-4" />
              Mint as NFT
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowMintModal(false);
                toast.info("You can mint this territory later from your profile");
              }}
              className="w-full"
            >
              Skip for Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}