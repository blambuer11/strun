import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapView } from "@/components/MapView";
import { toast } from "sonner";
import { isAuthenticated } from "@/lib/zklogin";
import { upsertUser, getCurrentUser } from "@/services/userService";
import { saveRun, RunData } from "@/services/runService";

const Map = () => {
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);
  const [runStartTime, setRunStartTime] = useState<number | null>(null);
  const [runningStats, setRunningStats] = useState({
    distance: 0,
    time: "00:00",
    pace: 0
  });

  const [stats] = useState({
    xp: 1240,
    territories: 3,
    distance: 2400
  });

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/auth");
    }
  }, [navigate]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning && runStartTime) {
      interval = setInterval(() => {
        const elapsed = Date.now() - runStartTime;
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const displaySeconds = seconds % 60;
        
        const distance = (seconds / 30) * 0.1;
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

  const handleStartRun = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {
          setIsRunning(true);
          setRunStartTime(Date.now());
          setRunningStats({ distance: 0, time: "00:00", pace: 0 });
          toast.success("🏃 Koşu başladı! GPS takibi etkin.");
        },
        (error) => {
          console.error("Location error:", error);
          toast.error("⚠️ Koşuya başlamak için konum erişimine izin verin!");
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    } else {
      toast.error("Tarayıcınız konum servislerini desteklemiyor");
    }
  };

  const handleStopRun = () => {
    setIsRunning(false);
    setRunStartTime(null);
    
    const xpEarned = Math.floor(runningStats.distance * 1000);
    if (xpEarned > 0) {
      toast.success(`Koşu tamamlandı! ${xpEarned} XP kazandınız!`);
    } else {
      toast.info("Koşu tamamlandı!");
    }
  };

  return (
    <MapView
      isRunning={isRunning}
      onStartRun={handleStartRun}
      onStopRun={handleStopRun}
      stats={stats}
      runningStats={runningStats}
    />
  );
};

export default Map;