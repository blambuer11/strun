import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Square, Battery, Radio, Navigation, MapPin, TrendingUp, Map, AlertTriangle, Coins, Shield, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MapLibreView } from "./MapLibreView";
import { toast } from "sonner";
import strunLogo from "@/assets/strun-logo-new.png";
import { getCurrentUserInfo } from "@/lib/zklogin";
import { supabase } from "@/integrations/supabase/client";
import { mintLandNFT, isZoneMinted } from "@/lib/sui-land-contract";
import { detectZoneFromTrace, validateRunTrace, computeZoneId, formatZoneMetadata } from "@/lib/zone-detection";
import { awardXP, payZoneRent, applyUnauthorizedEntryPenalty, calculateRunXP, XP_CONFIG } from "@/lib/xp-economics";
import { walrusClient } from "@/lib/walrus-client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

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

interface Territory {
  id: string;
  name: string;
  path: Array<{ lat: number; lng: number }>;
  area: number;
  owner?: string;
  rentPrice?: number;
  color?: string;
}

export function MapView({ 
  isRunning, 
  onStartRun, 
  onStopRun, 
  stats,
  runningStats = { distance: 0, time: "00:00", pace: 0 }
}: MapViewProps) {
  const [showRentModal, setShowRentModal] = useState(false);
  const [rentTerritory, setRentTerritory] = useState<Territory | null>(null);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [canClaim, setCanClaim] = useState(false);
  const [territoryPath, setTerritoryPath] = useState<Array<{ lat: number; lng: number }>>([]);
  const [territoryArea, setTerritoryArea] = useState(0);
  const [currentDistance, setCurrentDistance] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [runTime, setRunTime] = useState("00:00");
  const [runStartTime, setRunStartTime] = useState<number | null>(null);
  const [showMintModal, setShowMintModal] = useState(false);
  const [runCompleted, setRunCompleted] = useState(false);
  const [completedPath, setCompletedPath] = useState<Array<{ lat: number; lng: number }>>([]);
  const [runTrace, setRunTrace] = useState<any>(null);
  const [detectedZone, setDetectedZone] = useState<any>(null);
  const [minting, setMinting] = useState(false);
  const [rentAcceptTimer, setRentAcceptTimer] = useState<NodeJS.Timeout | null>(null);
  const [unauthorizedEntries, setUnauthorizedEntries] = useState<Set<string>>(new Set());
  
  // Mint form data
  const [zoneName, setZoneName] = useState("");
  const [zoneDescription, setZoneDescription] = useState("");
  const [zoneRentPrice, setZoneRentPrice] = useState(10);
  const [mintProgress, setMintProgress] = useState(0);

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
        // Get all regions from database
        const { data: regions, error } = await supabase
          .from('regions')
          .select('*, profiles!owner_id(username, avatar_url)');
        
        if (error) {
          console.error("Failed to load regions:", error);
          return;
        }
        
        // Format regions for map display
        const formattedTerritories = regions?.map(region => ({
          id: region.id,
          name: region.name,
          path: region.coordinates as Array<{ lat: number; lng: number }>,
          area: region.area,
          owner: region.profiles?.username || 'Unknown',
          rentPrice: region.rent_price,
          color: region.color || '#FF6B6B'
        })) || [];
        
        setTerritories(formattedTerritories);
      } catch (error) {
        console.error("Failed to load territories:", error);
      }
    };
    
    loadTerritories();
    const interval = setInterval(loadTerritories, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  const handleStartRun = async () => {
    try {
      // Initialize run trace
      setRunTrace({
        points: [],
        distance: 0,
        duration: 0,
        avgSpeed: 0,
        maxSpeed: 0
      });
      
      setXpEarned(0);
      setCurrentDistance(0);
      setRunCompleted(false);
      setCompletedPath([]);
      setShowStats(true);
      
      onStartRun();
      toast.success("Run started! Start moving to capture territory.");
    } catch (error) {
      console.error("Failed to start run:", error);
      toast.error("Failed to start run");
    }
  };

  const handleStopRun = async () => {
    try {
      if (runTrace && runTrace.points.length > 0) {
        // Validate run trace for anti-cheat
        const validation = validateRunTrace(runTrace);
        
        if (!validation.valid) {
          toast.error("Run validation failed: " + validation.issues[0]);
          // Still allow stopping but mark as unverified
        }
        
        // Detect zone from trace
        const zone = detectZoneFromTrace(runTrace);
        
        if (zone) {
          setDetectedZone(zone);
          setCanClaim(true);
          setTerritoryPath(zone.polygon || []);
          setTerritoryArea(zone.area);
          setCompletedPath(zone.polygon || []);
          
          // Calculate XP earned
          const distanceKm = currentDistance / 1000;
          const duration = (Date.now() - (runStartTime || 0)) / 1000 / 3600; // hours
          const earnedXP = calculateRunXP(distanceKm, duration);
          setXpEarned(earnedXP);
          
          toast.success(`Zone detected! Area: ${zone.area.toFixed(0)}m². You can mint it as NFT!`);
          setShowMintModal(true);
        } else {
          // Just a regular run, no zone created
          const distanceKm = currentDistance / 1000;
          const duration = (Date.now() - (runStartTime || 0)) / 1000 / 3600;
          const earnedXP = calculateRunXP(distanceKm, duration);
          
          // Award XP for the run
          const { data: authUser } = await supabase.auth.getUser();
          if (authUser?.user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('user_id', authUser.user.id)
              .single();
            
            if (profile) {
              await awardXP(
                profile.id,
                earnedXP,
                'run',
                `Completed ${distanceKm.toFixed(2)}km run`
              );
            }
          }
          
          toast.success(`Run completed! Distance: ${distanceKm.toFixed(2)}km, XP earned: ${earnedXP}`);
        }
        
        // Get profile for saving
        const { data: authUser2 } = await supabase.auth.getUser();
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', authUser2?.user?.id || '')
          .single();
        
        // Save run to Walrus
        const runData = {
          userId: userProfile?.id || '',
          startTime: runStartTime || Date.now(),
          endTime: Date.now(),
          distance: currentDistance,
          route: runTrace.points.map((p: any) => ({
            lat: p.lat,
            lng: p.lng,
            timestamp: p.timestamp
          })),
          xpEarned,
          territoriesClaimed: detectedZone ? [detectedZone.id] : []
        };
        
        const blobId = await walrusClient.storeRunningSession(runData);
        console.log("Run saved to Walrus:", blobId);
        
        // Save run to Supabase
        const { data: authUser } = await supabase.auth.getUser();
        if (authUser?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', authUser.user.id)
            .single();
          
          // Save run properly but don't insert yet - let the parent handle it
          setShowStats(false);
        }
      }
      
      setRunCompleted(true);
      onStopRun();
    } catch (error) {
      console.error("Failed to stop run:", error);
      toast.error("Failed to stop run");
      onStopRun();
    }
  };

  const handlePathUpdate = (path: [number, number][]) => {
    // Convert LatLng format to { lat, lng } format
    const convertedPath = path.map(p => ({ lat: p[0], lng: p[1] }));
    setTerritoryPath(convertedPath);
    
    // Update run trace
    if (isRunning && runTrace && path.length > 0) {
      const lastPoint = path[path.length - 1];
      const newPoint = {
        lat: lastPoint[0],
        lng: lastPoint[1],
        timestamp: Date.now(),
        accuracy: 10, // Default accuracy
        speed: runningStats.pace
      };
      
      setRunTrace({
        ...runTrace,
        points: [...runTrace.points, newPoint],
        distance: currentDistance,
        duration: (Date.now() - (runStartTime || 0)) / 1000,
        avgSpeed: runningStats.pace,
        maxSpeed: Math.max(runTrace.maxSpeed, runningStats.pace)
      });
    }
  };

  const handleDistanceUpdate = (distance: number) => {
    setCurrentDistance(distance);
  };

  const handleTerritoryComplete = async (territory: { path: [number, number][]; area: number }) => {
    // Convert LatLng format to { lat, lng } format
    const convertedPath = territory.path.map(p => ({ lat: p[0], lng: p[1] }));
    setTerritoryPath(convertedPath);
    setTerritoryArea(territory.area);
    setCanClaim(true);
    setCompletedPath(convertedPath);
    
    if (detectedZone) {
      setShowMintModal(true);
    }
  };

  const handleEnterExistingTerritory = async (territoryId: string) => {
    // Check if already in unauthorized list
    if (unauthorizedEntries.has(territoryId)) {
      return; // Already penalized
    }
    
    // Find the territory by ID
    const territory = territories.find(t => t.id === territoryId);
    if (!territory) return;
    
    // Get current user
    const { data: authUser } = await supabase.auth.getUser();
    if (!authUser?.user) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', authUser.user.id)
      .single();
    
    if (!profile) return;
    
    // Check if user owns this territory
    const { data: region } = await supabase
      .from('regions')
      .select('owner_id')
      .eq('id', territoryId)
      .single();
    
    if (region?.owner_id === profile.id) {
      return; // Owner can enter freely
    }
    
    setRentTerritory(territory);
    setShowRentModal(true);
    
    // Start 30-second timer for accepting rent
    const timer = setTimeout(async () => {
      if (showRentModal && rentTerritory?.id === territory.id) {
        // User didn't accept in time - apply penalty
        setShowRentModal(false);
        setUnauthorizedEntries(prev => new Set(prev).add(territory.id));
        
        await applyUnauthorizedEntryPenalty(
          profile.id,
          territory.id,
          territory.rentPrice || XP_CONFIG.ZONE_RENT_PERCENTAGE * 100
        );
        
        toast.error("Unauthorized entry penalty applied!");
      }
    }, 30000);
    
    setRentAcceptTimer(timer);
  };

  const handleMintZone = async () => {
    if (!detectedZone || !zoneName) {
      toast.error("Please provide a name for your zone");
      return;
    }
    
    setMinting(true);
    setMintProgress(10);
    
    try {
      // Get current user
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user) throw new Error("Not authenticated");
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authUser.user.id)
        .single();
      
      if (!profile) throw new Error("Profile not found");
      
      setMintProgress(20);
      
      // Check if zone already minted
      const { zoneId } = computeZoneId(detectedZone.bbox, detectedZone.zoom);
      const alreadyMinted = await isZoneMinted(
        detectedZone.bbox.latMin,
        detectedZone.bbox.lonMin,
        detectedZone.zoom
      );
      
      if (alreadyMinted) {
        toast.error("This zone has already been minted!");
        setMinting(false);
        return;
      }
      
      setMintProgress(40);
      
      // Format metadata
      const metadata = formatZoneMetadata(detectedZone, profile.username || profile.email, {
        name: zoneName,
        description: zoneDescription,
        rentPrice: zoneRentPrice,
        createdBy: profile.id,
        runStats: {
          distance: currentDistance,
          duration: Date.now() - (runStartTime || 0),
          xpEarned
        }
      });
      
      setMintProgress(60);
      
      // Store metadata in Walrus
      const metadataBlobId = await walrusClient.storeBlob(JSON.stringify(metadata));
      console.log("Metadata stored in Walrus:", metadataBlobId);
      
      setMintProgress(80);
      
      // Mint NFT on Sui
      const coordinates = detectedZone.polygon || [
        { lat: detectedZone.bbox.latMin, lng: detectedZone.bbox.lonMin },
        { lat: detectedZone.bbox.latMax, lng: detectedZone.bbox.lonMin },
        { lat: detectedZone.bbox.latMax, lng: detectedZone.bbox.lonMax },
        { lat: detectedZone.bbox.latMin, lng: detectedZone.bbox.lonMax }
      ];
      
      const nftId = await mintLandNFT(
        coordinates,
        detectedZone.zoom,
        zoneName,
        zoneDescription
      );
      
      setMintProgress(90);
      
      // Save to database
      await supabase
        .from('regions')
        .insert({
          id: zoneId,
          name: zoneName,
          description: zoneDescription,
          coordinates: detectedZone.polygon,
          area: detectedZone.area,
          owner_id: profile.id,
          rent_price: zoneRentPrice,
          nft_id: nftId,
          metadata: metadata,
          color: `#${Math.floor(Math.random()*16777215).toString(16)}`
        });
      
      // Award XP for zone creation
      await awardXP(
        profile.id,
        XP_CONFIG.XP_PER_ZONE_CREATION,
        'zone',
        `Created zone: ${zoneName}`
      );
      
      // Check if first zone for bonus
      const { count } = await supabase
        .from('regions')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', profile.id);
      
      if (count === 1) {
        await awardXP(
          profile.id,
          XP_CONFIG.XP_BONUS_FIRST_ZONE,
          'bonus',
          'First zone bonus!'
        );
      }
      
      setMintProgress(100);
      
      toast.success(`Zone "${zoneName}" minted successfully! NFT ID: ${nftId}`);
      
      // Reload territories
      const { data: regions } = await supabase
        .from('regions')
        .select('*, profiles!owner_id(username, avatar_url)');
      
      const formattedTerritories = regions?.map(region => ({
        id: region.id,
        name: region.name,
        path: region.coordinates as Array<{ lat: number; lng: number }>,
        area: region.area,
        owner: region.profiles?.username || 'Unknown',
        rentPrice: region.rent_price,
        color: region.color || '#FF6B6B'
      })) || [];
      
      setTerritories(formattedTerritories);
      
      // Reset states
      setShowMintModal(false);
      setCanClaim(false);
      setDetectedZone(null);
      setZoneName("");
      setZoneDescription("");
      setZoneRentPrice(10);
    } catch (error) {
      console.error("Failed to mint zone:", error);
      toast.error("Failed to mint zone: " + error.message);
    } finally {
      setMinting(false);
      setMintProgress(0);
    }
  };

  const handlePayRent = async () => {
    if (!rentTerritory) return;
    
    try {
      // Clear timer since user accepted
      if (rentAcceptTimer) {
        clearTimeout(rentAcceptTimer);
        setRentAcceptTimer(null);
      }
      
      // Get current user
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user) throw new Error("Not authenticated");
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', authUser.user.id)
        .single();
      
      if (!profile) throw new Error("Profile not found");
      
      // Get territory owner
      const { data: region } = await supabase
        .from('regions')
        .select('owner_id')
        .eq('id', rentTerritory.id)
        .single();
      
      if (!region?.owner_id) throw new Error("Territory owner not found");
      
      // Process payment
      const rentAmount = rentTerritory.rentPrice || 10;
      const { success, error } = await payZoneRent(
        profile.id,
        region.owner_id,
        rentTerritory.id,
        rentAmount
      );
      
      if (success) {
        toast.success(`Rent paid: ${rentAmount} XP`);
        
        // Record visit - get current values first then update
        const { data: currentRegion } = await supabase
          .from('regions')
          .select('visitors, total_earnings')
          .eq('id', rentTerritory.id)
          .single();
        
        if (currentRegion) {
          await supabase
            .from('regions')
            .update({
              visitors: (currentRegion.visitors || 0) + 1,
              last_visited: new Date().toISOString(),
              total_earnings: (currentRegion.total_earnings || 0) + rentAmount
            })
            .eq('id', rentTerritory.id);
        }
      } else {
        toast.error(error || "Failed to pay rent");
      }
      
      setShowRentModal(false);
      setRentTerritory(null);
    } catch (error) {
      console.error("Failed to pay rent:", error);
      toast.error("Failed to pay rent");
    }
  };

  const handleDeclineRent = () => {
    // User declined - will be penalized after timer
    setShowRentModal(false);
    toast.warning("You have 30 seconds to leave the zone or face a penalty!");
  };

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <img src={strunLogo} alt="STRUN" className="h-8" />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1">
              <Radio className="w-4 h-4 text-green-400" />
              <span className="text-xs text-white">GPS Active</span>
            </div>
            <div className="flex items-center gap-1 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1">
              <Battery className="w-4 h-4 text-white" />
              <span className="text-xs text-white">87%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <MapLibreView
        isRunning={isRunning}
        onPathUpdate={handlePathUpdate}
        onDistanceUpdate={handleDistanceUpdate}
        onTerritoryComplete={handleTerritoryComplete}
        onEnterExistingTerritory={handleEnterExistingTerritory}
        existingTerritories={territories.map(t => ({
          id: t.id,
          name: t.name,
          coordinates: {
            type: "Polygon",
            coordinates: [t.path.map(p => [p.lng, p.lat])]
          },
          owner_id: t.owner,
          rent_price: t.rentPrice || 5
        }))}
      />

      {/* Stats Overlay */}
      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-4 right-4 z-10"
          >
            <div className="bg-black/80 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-400">Distance</p>
                  <p className="text-xl font-bold text-white">
                    {(currentDistance / 1000).toFixed(2)} km
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Time</p>
                  <p className="text-xl font-bold text-white">{runTime}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">XP Earned</p>
                  <p className="text-xl font-bold text-cyan-400">+{xpEarned}</p>
                </div>
              </div>
              {detectedZone && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-white">Zone Detected</span>
                    </div>
                    <span className="text-sm text-cyan-400">
                      {detectedZone.area.toFixed(0)} m²
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black to-transparent p-4 pb-8">
        <div className="max-w-md mx-auto space-y-4">
          {/* XP and Territory Stats */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-semibold text-white">{stats.xp} XP</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-2">
              <Map className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-semibold text-white">{territories.length} Zones</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!isRunning ? (
              <>
                <Button
                  onClick={handleStartRun}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-6 rounded-2xl shadow-lg shadow-cyan-500/25"
                >
                  <Play className="mr-2 h-5 w-5" />
                  Start Run
                </Button>
                {runCompleted && detectedZone && (
                  <Button
                    onClick={() => setShowMintModal(true)}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-bold py-6 rounded-2xl shadow-lg shadow-purple-500/25"
                  >
                    <MapPin className="mr-2 h-5 w-5" />
                    Mint Zone
                  </Button>
                )}
              </>
            ) : (
              <Button
                onClick={handleStopRun}
                className="flex-1 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white font-bold py-6 rounded-2xl shadow-lg shadow-red-500/25"
              >
                <Square className="mr-2 h-5 w-5" />
                Stop Run
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Rent Modal */}
      <Dialog open={showRentModal} onOpenChange={setShowRentModal}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Entering Territory
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              You are entering a territory owned by another user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {rentTerritory && (
              <>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-400">Territory</p>
                  <p className="font-semibold">{rentTerritory.name}</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Owner: {rentTerritory.owner}
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-sm text-gray-400">Rent Cost</p>
                  <p className="text-2xl font-bold text-cyan-400">
                    {rentTerritory.rentPrice} XP
                  </p>
                </div>
                <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-3">
                  <p className="text-sm text-yellow-400">
                    ⚠️ You have 30 seconds to accept or leave the zone.
                    Unauthorized entry will result in a 2x penalty!
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handlePayRent}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Coins className="mr-2 h-4 w-4" />
              Pay Rent
            </Button>
            <Button
              onClick={handleDeclineRent}
              variant="outline"
              className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Decline
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mint NFT Modal */}
      <Dialog open={showMintModal} onOpenChange={setShowMintModal}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-500" />
              Mint Zone as NFT
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Claim your captured territory on the blockchain
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {detectedZone && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-400">Area</p>
                    <p className="font-semibold">{detectedZone.area.toFixed(0)} m²</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Perimeter</p>
                    <p className="font-semibold">{detectedZone.perimeter.toFixed(0)} m</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Zone ID</p>
                    <p className="font-mono text-xs">{detectedZone.id.slice(0, 10)}...</p>
                  </div>
                  <div>
                    <p className="text-gray-400">XP Reward</p>
                    <p className="font-semibold text-cyan-400">+{XP_CONFIG.XP_PER_ZONE_CREATION}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="zone-name" className="text-gray-300">Zone Name *</Label>
                <Input
                  id="zone-name"
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  placeholder="Enter a unique name for your zone"
                  className="bg-gray-800 border-gray-700 text-white"
                  maxLength={50}
                />
              </div>
              
              <div>
                <Label htmlFor="zone-desc" className="text-gray-300">Description</Label>
                <Textarea
                  id="zone-desc"
                  value={zoneDescription}
                  onChange={(e) => setZoneDescription(e.target.value)}
                  placeholder="Describe your zone (optional)"
                  className="bg-gray-800 border-gray-700 text-white"
                  rows={3}
                  maxLength={200}
                />
              </div>
              
              <div>
                <Label htmlFor="rent-price" className="text-gray-300">
                  Rent Price (XP per entry)
                </Label>
                <Input
                  id="rent-price"
                  type="number"
                  value={zoneRentPrice}
                  onChange={(e) => setZoneRentPrice(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                  max={100}
                  className="bg-gray-800 border-gray-700 text-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Other users pay this when entering your zone
                </p>
              </div>
            </div>
            
            {minting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Minting progress</span>
                  <span className="text-cyan-400">{mintProgress}%</span>
                </div>
                <Progress value={mintProgress} className="h-2" />
                <p className="text-xs text-gray-500">
                  {mintProgress < 20 && "Initializing..."}
                  {mintProgress >= 20 && mintProgress < 40 && "Checking uniqueness..."}
                  {mintProgress >= 40 && mintProgress < 60 && "Preparing metadata..."}
                  {mintProgress >= 60 && mintProgress < 80 && "Storing on Walrus..."}
                  {mintProgress >= 80 && mintProgress < 100 && "Minting NFT on Sui..."}
                  {mintProgress === 100 && "Complete!"}
                </p>
              </div>
            )}
          </div>
          
          <div className="flex gap-3">
            <Button
              onClick={handleMintZone}
              disabled={!zoneName || minting}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
            >
              {minting ? (
                <>Minting... ({mintProgress}%)</>
              ) : (
                <>
                  <MapPin className="mr-2 h-4 w-4" />
                  Mint Zone NFT
                </>
              )}
            </Button>
            <Button
              onClick={() => setShowMintModal(false)}
              variant="outline"
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
              disabled={minting}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}