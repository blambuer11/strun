import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Square, Battery, Radio, Navigation, MapPin, TrendingUp, Map } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import OpenStreetMap from "./OpenStreetMap";
import { claimTerritory, getUserTerritories, payTerritoryRent, startRunSession, completeRunSession } from "@/lib/sui-transactions";
import { toast } from "sonner";
import strunLogo from "@/assets/strun-logo-new.png";

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

  // Load existing territories
  useEffect(() => {
    const loadTerritories = async () => {
      try {
        const userTerritories = await getUserTerritories();
        setTerritories(userTerritories);
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
    toast.success(`Territory ready to claim! Area: ${(area / 10000).toFixed(2)} hectares`);
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
          onDistanceUpdate={(distance) => {
            setCurrentDistance(distance);
            // Calculate XP: 1 XP per 1000 meters (1km)
            const newXp = Math.floor(distance / 1000);
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
                {isRunning ? runningStats.time : stats.territories}
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
              onClick={isRunning ? onStopRun : onStartRun}
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
    </div>
  );
}