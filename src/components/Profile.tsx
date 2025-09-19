import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LogOut, Trophy, Map, Activity, Clock, Target, Award, Heart, Smartphone } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import strunLogo from "@/assets/strun-logo-new.png";
import { healthIntegration } from "@/lib/health-integration";
import { initializeUserWallet } from "@/lib/auto-wallet";
import { supabase } from "@/integrations/supabase/client";

interface ProfileProps {
  user?: {
    name?: string;
    address?: string;
    stats?: {
      totalRuns: number;
      distance: number;
      xpEarned: number;
      territories: number;
    };
  } | null;
  onLogout: () => void;
}

export function Profile({ user, onLogout }: ProfileProps) {
  const [healthIntegrations, setHealthIntegrations] = useState({
    googleHealth: false,
    appleHealth: false
  });

  // Default values if user is null
  const userStats = user?.stats || {
    totalRuns: 0,
    distance: 0,
    xpEarned: 0,
    territories: 0
  };

  const achievements = [
    { icon: Activity, title: "Total Runs", value: userStats.totalRuns, color: "text-primary" },
    { icon: Map, title: "Distance", value: `${(userStats.distance / 1000).toFixed(1)}km`, color: "text-accent" },
    { icon: Trophy, title: "XP Earned", value: userStats.xpEarned.toLocaleString(), color: "text-yellow-500" },
    { icon: Target, title: "Territories", value: userStats.territories, color: "text-destructive" },
  ];

  const territories = [
    { name: "Central Park", claimed: "2 days ago", xp: 340 },
    { name: "Times Square", claimed: "1 week ago", xp: 180 },
    { name: "Brooklyn Bridge", claimed: "2 weeks ago", xp: 250 },
  ];

  const handleHealthToggle = (platform: 'googleHealth' | 'appleHealth') => {
    setHealthIntegrations(prev => ({
      ...prev,
      [platform]: !prev[platform]
    }));
    
    if (!healthIntegrations[platform]) {
      toast.success(`${platform === 'googleHealth' ? 'Google Health' : 'Apple Health'} connected!`);
    } else {
      toast.info(`${platform === 'googleHealth' ? 'Google Health' : 'Apple Health'} disconnected`);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4 pt-8"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring" }}
            className="mx-auto w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg"
          >
            {(user?.name || 'U').charAt(0).toUpperCase()}
          </motion.div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{user?.name || 'User'}</h2>
            {user?.address && (
              <p className="text-sm text-muted-foreground font-mono">
                {user.address.slice(0, 6)}...{user.address.slice(-4)}
              </p>
            )}
          </div>
        </motion.div>

        {/* Health Integrations */}
        <Card className="p-4 bg-card/50 border-white/10 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" />
            Health Integrations
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="google-health" className="flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Google Health
              </Label>
              <Switch
                id="google-health"
                checked={healthIntegrations.googleHealth}
                onCheckedChange={() => handleHealthToggle('googleHealth')}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="apple-health" className="flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Apple Health
              </Label>
              <Switch
                id="apple-health"
                checked={healthIntegrations.appleHealth}
                onCheckedChange={() => handleHealthToggle('appleHealth')}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Connect to sync your running data and health metrics
            </p>
          </div>
        </Card>

        {/* Achievements Grid */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            Statistics
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {achievements.map((achievement, index) => (
              <motion.div
                key={achievement.title}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-4 bg-card/50 border-white/10 backdrop-blur-sm hover:bg-card/70 transition-colors">
                  <achievement.icon className={`w-8 h-8 ${achievement.color} mb-2`} />
                  <div className="text-2xl font-bold text-foreground">{achievement.value}</div>
                  <div className="text-xs text-muted-foreground">{achievement.title}</div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* My Territories */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Map className="w-5 h-5 text-accent" />
            My Territories
          </h3>
          <div className="space-y-2">
            {territories.map((territory, index) => (
              <motion.div
                key={territory.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-4 bg-card/50 border-white/10 backdrop-blur-sm hover:bg-card/70 transition-colors">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold text-foreground">{territory.name}</h4>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        Claimed {territory.claimed}
                      </p>
                    </div>
                    <div className="text-accent font-bold">+{territory.xp} XP</div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Logout Button */}
        <Button
          variant="destructive"
          size="lg"
          className="w-full rounded-xl"
          onClick={onLogout}
        >
          <LogOut className="mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
}