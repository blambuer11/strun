import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LogOut, Trophy, Map, Activity, Clock, Target, Award, Settings, User, Heart, Smartphone, Edit2, Copy, Check, Upload, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ProfileSettings } from "./ProfileSettings";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

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
  const [showSettings, setShowSettings] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [healthIntegrations, setHealthIntegrations] = useState({
    googleHealth: false,
    appleHealth: false
  });
  const [editingProfile, setEditingProfile] = useState(false);
  const [username, setUsername] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [walletCopied, setWalletCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Default values if user is null
  const userStats = user?.stats || {
    totalRuns: 0,
    distance: 0,
    xpEarned: 0,
    territories: 0
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: authUser } = await supabase.auth.getUser();
    if (authUser?.user) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authUser.user.id)
        .single();
      setProfile(data);
      if (data) {
        setUsername(data.username || '');
        setAvatarUrl(data.avatar_url || '');
      }
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user) throw new Error("Not authenticated");

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${authUser.user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile
      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', authUser.user.id);

      setAvatarUrl(publicUrl);
      toast.success("Profile picture updated!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload profile picture");
    } finally {
      setUploading(false);
    }
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
          <div className="relative inline-block">
            {avatarUrl ? (
              <motion.img
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring" }}
                src={avatarUrl}
                alt="Profile"
                className="mx-auto w-20 h-20 rounded-full object-cover shadow-lg border-2 border-primary"
              />
            ) : (
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring" }}
                className="mx-auto w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg"
              >
                {(username || user?.name || 'U').charAt(0).toUpperCase()}
              </motion.div>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-background border"
              onClick={() => setEditingProfile(true)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          </div>
          <div>
            {editingProfile ? (
              <div className="space-y-3 max-w-xs mx-auto">
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="text-center"
                />
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? "Uploading..." : "Upload Photo"}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      const { data: authUser } = await supabase.auth.getUser();
                      if (authUser?.user) {
                        await supabase
                          .from('profiles')
                          .update({ 
                            username, 
                            avatar_url: avatarUrl || null 
                          })
                          .eq('user_id', authUser.user.id);
                        toast.success("Profile updated!");
                        setEditingProfile(false);
                        fetchProfile();
                      }
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingProfile(false);
                      setUsername(profile?.username || user?.name || '');
                      setAvatarUrl(profile?.avatar_url || '');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-foreground">{username || user?.name || 'User'}</h2>
                {(user?.address || profile?.wallet_address) && (
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <p className="text-sm text-muted-foreground font-mono">
                      {(user?.address || profile?.wallet_address || '').slice(0, 6)}...{(user?.address || profile?.wallet_address || '').slice(-4)}
                    </p>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => {
                        const walletAddress = user?.address || profile?.wallet_address || '';
                        if (walletAddress) {
                          navigator.clipboard.writeText(walletAddress);
                          setWalletCopied(true);
                          toast.success("Wallet address copied!");
                          setTimeout(() => setWalletCopied(false), 2000);
                        } else {
                          toast.error("No wallet address available");
                        }
                      }}
                    >
                      {walletCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>

        {/* Referral Code Section */}
        {profile?.referral_code && (
          <Card className="p-4 bg-card/50 border-white/10 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Referral Program
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Your Referral Code</p>
                  <p className="text-lg font-mono font-bold text-primary">{profile.referral_code}</p>
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(profile.referral_code);
                    setCopied(true);
                    toast.success("Referral code copied!");
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              
              {/* Referral Link */}
              <div className="p-3 bg-background/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Share your referral link</p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={`${window.location.origin}/auth?ref=${profile.referral_code}`}
                    className="flex-1 px-3 py-2 text-xs font-mono bg-background/70 rounded border border-border"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const referralLink = `${window.location.origin}/auth?ref=${profile.referral_code}`;
                      navigator.clipboard.writeText(referralLink);
                      toast.success("Referral link copied!");
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-2 bg-background/30 rounded">
                  <p className="text-2xl font-bold text-foreground">{profile.referral_count || 0}</p>
                  <p className="text-xs text-muted-foreground">Referrals</p>
                </div>
                <div className="text-center p-2 bg-background/30 rounded">
                  <p className="text-2xl font-bold text-accent">{profile.referral_xp_earned || 0}</p>
                  <p className="text-xs text-muted-foreground">XP Earned</p>
                </div>
              </div>
              
              <div className="p-2 bg-primary/10 rounded text-xs text-muted-foreground">
                <p>🎁 Earn 500 XP for each friend who joins!</p>
                <p>💰 New users get 100 bonus XP when using your code.</p>
              </div>
            </div>
          </Card>
        )}

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