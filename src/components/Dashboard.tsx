import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Trophy, Users, MapPin, TrendingUp, Clock, Activity, 
  Target, Award, Zap, Globe, ChevronRight, Plus,
  UserPlus, Calendar, Flag, Mountain, Info, Play
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import GroupsManager from "./GroupsManager";
import { getCurrentUserInfo } from "@/lib/zklogin";


interface DashboardProps {
  userId?: string;
  onStartRun?: () => void;
}

export default function Dashboard({ userId, onStartRun }: DashboardProps) {
  
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    totalRuns: 0,
    totalDistance: 0,
    totalArea: 0,
    weeklyDistance: 0,
    bestRun: 0,
    averagePace: 0,
    currentStreak: 0,
    longestStreak: 0
  });
  const [recentRuns, setRecentRuns] = useState<any[]>([]);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [userId]);

  const loadDashboardData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Load user profile (secure - only own data)
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Load recent runs with email
      const userInfo = getCurrentUserInfo();
      if (userInfo?.email) {
        const { data: runsData } = await supabase
          .from("runs")
          .select("*")
          .eq("user_email", userInfo.email)
          .order("created_at", { ascending: false })
          .limit(5);

        if (runsData) {
          setRecentRuns(runsData);
          
          // Calculate stats - using area_m2 instead of distance
          const totalArea = runsData.reduce((sum, run) => sum + (run.area_m2 || 0), 0);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          const weeklyRuns = runsData.filter(run => new Date(run.created_at) > weekAgo);
          const weeklyArea = weeklyRuns.reduce((sum, run) => sum + (run.area_m2 || 0), 0);
          const bestRun = Math.max(...runsData.map(run => run.area_m2 || 0));

          setStats({
            totalRuns: runsData.length,
            totalDistance: Math.round(totalArea / 1000), // Convert to km² for display
            totalArea: totalArea,
            weeklyDistance: Math.round(weeklyArea / 1000),
            bestRun: Math.round(bestRun / 1000),
            averagePace: 6.5, // Calculate from runs
            currentStreak: 3, // Calculate from runs
            longestStreak: 7 // Calculate from runs
          });
        }
      }

      // Load user's groups
      const { data: groupsData } = await supabase
        .from("group_members")
        .select(`
          *,
          groups:group_id (*)
        `)
        .eq("user_email", userInfo?.email || '')
        .limit(3);

      if (groupsData) {
        setMyGroups(groupsData.map(g => g.groups));
      }

    } catch (error) {
      console.error("Error loading dashboard:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const calculateLevel = (xp: number) => {
    return Math.floor(xp / 1000) + 1;
  };

  const calculateProgress = (xp: number) => {
    return (xp % 1000) / 10;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 p-2">
      {/* Compact Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-2"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold gradient-text">
              {profile?.username || 'Runner'}
            </h1>
          </div>
          <Button 
            variant="gradient" 
            size="sm"
            onClick={onStartRun}
            className="shadow-lg"
          >
            <Play className="h-3 w-3 mr-1" />
            <span className="text-xs">Start Run</span>
          </Button>
        </div>
      </motion.div>

      {/* Compact Stats Overview for Mobile */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="glass-card backdrop-blur-xl">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <Trophy className="h-3 w-3 text-primary" />
                <Info 
                  className="h-3 w-3 text-muted-foreground cursor-pointer"
                  onClick={() => {
                    toast.info(
                      <div className="space-y-2">
                        <h3 className="font-semibold">XP System</h3>
                        <ul className="text-xs space-y-1">
                          <li>• Run: 100m = 10 XP</li>
                          <li>• Territory: 50-500 XP</li>
                          <li>• Daily: 25 XP</li>
                          <li>• Weekly: 100 XP</li>
                          <li>• Group: 2x XP</li>
                          <li>• Referral: 500 XP</li>
                        </ul>
                      </div>,
                      { duration: 5000 }
                    );
                  }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Level</p>
              <p className="text-base font-bold">{calculateLevel(profile?.xp || 0)}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-accent">{profile?.xp || 0} XP</span>
                <span className="text-[10px] text-muted-foreground">{1000 - (profile?.xp % 1000)} to next</span>
              </div>
              <Progress value={calculateProgress(profile?.xp || 0)} className="h-1 mt-1" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass-card backdrop-blur-xl">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <Activity className="h-3 w-3 text-accent" />
              </div>
              <p className="text-[10px] text-muted-foreground">Distance</p>
              <p className="text-base font-bold">{(stats.totalDistance / 1000).toFixed(1)}<span className="text-xs ml-1">km</span></p>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-2 w-2 text-accent" />
                <span className="text-[10px] text-accent">+{(stats.weeklyDistance / 1000).toFixed(1)} km/week</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="glass-card backdrop-blur-xl">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <MapPin className="h-3 w-3 text-primary" />
              </div>
              <p className="text-[10px] text-muted-foreground">Territory</p>
              <p className="text-base font-bold">{(stats.totalArea / 10000).toFixed(1)}<span className="text-xs ml-1">ha</span></p>
              <span className="text-[10px] text-primary">{profile?.total_runs || 0} runs</span>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="glass-card backdrop-blur-xl">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <UserPlus className="h-3 w-3 text-yellow-500" />
              </div>
              <p className="text-[10px] text-muted-foreground">Referrals</p>
              <p className="text-base font-bold">{profile?.referral_count || 0}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-yellow-500">{profile?.referral_xp_earned || 0} XP</span>
                <Badge variant="secondary" className="text-[8px] px-1 py-0 h-4">
                  {profile?.referral_code}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Content - Immediately Visible */}
      <Tabs defaultValue="overview" className="space-y-2">
        <TabsList className="grid w-full grid-cols-4 glass-card">
          <TabsTrigger value="overview" className="text-[11px] py-2">Overview</TabsTrigger>
          <TabsTrigger value="runs" className="text-[11px] py-2">Recent Runs</TabsTrigger>
          <TabsTrigger value="groups" className="text-[11px] py-2">Groups</TabsTrigger>
          <TabsTrigger value="achievements" className="text-[11px] py-2">Achievements</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Weekly Progress */}
            <Card className="glass-card backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-accent" />
                  Weekly Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Distance Goal</span>
                    <span>{(stats.weeklyDistance / 1000).toFixed(1)} / 50 km</span>
                  </div>
                  <Progress value={(stats.weeklyDistance / 50000) * 100} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Run Streak</span>
                    <span>{stats.currentStreak} days</span>
                  </div>
                  <Progress value={(stats.currentStreak / 7) * 100} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Territories</span>
                    <span>3 / 5 this week</span>
                  </div>
                  <Progress value={60} />
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="glass-card backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Performance Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Best Run</span>
                  <span className="font-bold">{(stats.bestRun / 1000).toFixed(1)} km</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Avg Pace</span>
                  <span className="font-bold">{stats.averagePace.toFixed(1)} min/km</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Runs</span>
                  <span className="font-bold">{stats.totalRuns}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Longest Streak</span>
                  <span className="font-bold">{stats.longestStreak} days</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* My Groups Preview */}
          <Card className="glass-card backdrop-blur-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-accent" />
                  My Groups
                </CardTitle>
                <Button variant="ghost" size="sm">
                  View All <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {myGroups.length > 0 ? (
                <div className="space-y-3">
                  {myGroups.map((group) => (
                    <div key={group.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-accent/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                          <Users className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                          <p className="font-medium">{group.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {group.city}, {group.country} • {group.current_members} members
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">
                        {(group.total_distance / 1000).toFixed(0)} km
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-muted-foreground">No groups joined yet</p>
                  <Button variant="outline" size="sm" className="mt-3">
                    <Plus className="mr-2 h-4 w-4" />
                    Join a Group
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
          <Card className="glass-card backdrop-blur-xl">
            <CardHeader>
              <CardTitle>Recent Runs</CardTitle>
              <CardDescription>Your running history and performance</CardDescription>
            </CardHeader>
            <CardContent>
              {recentRuns.length > 0 ? (
                <div className="space-y-3">
                  {recentRuns.map((run) => (
                    <div key={run.id} className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-accent/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                          <Activity className="h-6 w-6 text-accent" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {(run.distance / 1000).toFixed(1)} km run
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {Math.floor(run.duration / 60)} min
                            </span>
                            <span className="flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              {run.xp_earned} XP
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(run.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        View Details
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Activity className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-muted-foreground">No runs yet</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={onStartRun}>
                    Start Your First Run
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups">
          <GroupsManager userId={profile?.id} />
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          <Card className="glass-card backdrop-blur-xl">
            <CardHeader>
              <CardTitle>Achievements</CardTitle>
              <CardDescription>Unlock achievements as you progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { icon: Trophy, name: "First Run", desc: "Complete your first run", earned: true },
                  { icon: Flag, name: "Territory Lord", desc: "Claim 10 territories", earned: true },
                  { icon: Mountain, name: "Marathon Runner", desc: "Run 42.2 km total", earned: false },
                  { icon: Users, name: "Team Player", desc: "Join 3 groups", earned: false },
                  { icon: Award, name: "Streak Master", desc: "7 day run streak", earned: false },
                  { icon: Globe, name: "World Explorer", desc: "Run in 5 cities", earned: false }
                ].map((achievement, idx) => (
                  <div 
                    key={idx}
                    className={`p-4 rounded-lg border ${
                      achievement.earned 
                        ? "bg-accent/10 border-accent/30" 
                        : "bg-muted/10 border-border/30 opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        achievement.earned ? "bg-accent/20" : "bg-muted/20"
                      }`}>
                        <achievement.icon className={`h-5 w-5 ${
                          achievement.earned ? "text-accent" : "text-muted-foreground"
                        }`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{achievement.name}</p>
                        <p className="text-xs text-muted-foreground">{achievement.desc}</p>
                      </div>
                      {achievement.earned && (
                        <Badge variant="secondary" className="ml-auto">
                          Earned
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}