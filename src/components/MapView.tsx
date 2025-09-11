import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Square, Battery, Radio, Navigation, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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
  const [userPosition, setUserPosition] = useState({ x: 50, y: 50 });
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        setUserPosition(prev => ({
          x: Math.min(100, Math.max(0, prev.x + (Math.random() - 0.5) * 5)),
          y: Math.min(100, Math.max(0, prev.y + (Math.random() - 0.5) * 5))
        }));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isRunning]);

  // Simulate entering a territory
  useEffect(() => {
    if (isRunning && Math.random() > 0.95) {
      setShowRentModal(true);
    }
  }, [userPosition, isRunning]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="glass-card backdrop-blur-xl border-b border-white/10 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <div>
              <h3 className="text-foreground font-semibold">Strun</h3>
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
      <div 
        ref={mapRef}
        className="flex-1 relative bg-gradient-to-br from-blue-950/50 to-purple-950/50 map-grid overflow-hidden"
      >
        {/* User Marker */}
        <motion.div
          animate={{
            left: `${userPosition.x}%`,
            top: `${userPosition.y}%`,
          }}
          transition={{ type: "spring", stiffness: 100 }}
          className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 z-20"
        >
          <div className="w-full h-full bg-accent rounded-full border-2 border-white shadow-lg animate-pulse-ring">
            <Navigation className="w-3 h-3 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
        </motion.div>

        {/* Territories */}
        <div className="absolute top-[20%] left-[15%] w-24 h-20 border-2 border-primary/50 bg-primary/20 rounded-lg flex items-center justify-center">
          <MapPin className="w-4 h-4 text-primary" />
        </div>
        <div className="absolute top-[60%] right-[20%] w-20 h-20 border-2 border-accent/50 bg-accent/20 rounded-lg flex items-center justify-center">
          <MapPin className="w-4 h-4 text-accent" />
        </div>

        {/* Running Path */}
        {isRunning && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 5, repeat: Infinity }}
              d={`M ${userPosition.x * 3.2} ${userPosition.y * 6.4} Q ${(userPosition.x + 20) * 3.2} ${(userPosition.y - 10) * 6.4} ${(userPosition.x + 40) * 3.2} ${userPosition.y * 6.4}`}
              stroke="url(#gradient)"
              strokeWidth="3"
              fill="none"
              strokeDasharray="5,5"
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(var(--accent))" />
              </linearGradient>
            </defs>
          </svg>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="glass-card backdrop-blur-xl border-t border-white/10">
        <div className="p-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">
                {isRunning ? runningStats.distance.toFixed(1) : stats.xp}
              </div>
              <div className="text-xs text-muted-foreground">
                {isRunning ? "km" : "XP"}
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
                {isRunning ? runningStats.pace.toFixed(1) : `${(stats.distance / 1000).toFixed(1)}km`}
              </div>
              <div className="text-xs text-muted-foreground">
                {isRunning ? "Pace" : "Today"}
              </div>
            </div>
          </div>

          {/* Run Button */}
          <Button
            variant={isRunning ? "running" : "gradient"}
            size="lg"
            className="w-full h-14 text-lg rounded-xl"
            onClick={isRunning ? onStopRun : onStartRun}
          >
            {isRunning ? (
              <>
                <Square className="mr-2" />
                Claim Territory
              </>
            ) : (
              <>
                <Play className="mr-2" />
                Start Run
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Rent Modal */}
      <Dialog open={showRentModal} onOpenChange={setShowRentModal}>
        <DialogContent className="bg-card border-white/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl">🏃‍♂️ Territory Entry</DialogTitle>
            <DialogDescription className="text-muted-foreground pt-2">
              You've entered @runner23's territory. Pay 100 XP rent to continue?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-4">
            <Button 
              variant="gradient" 
              onClick={() => setShowRentModal(false)}
              className="w-full"
            >
              Pay 100 XP
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowRentModal(false)}
              className="w-full text-destructive border-destructive/50 hover:bg-destructive/10"
            >
              Decline (200 XP penalty)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}