import React, { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Wallet as WalletIcon, Play, MapPin, User, Home as HomeIcon, Trophy, Settings, LogOut, Users } from "lucide-react";
import strunLogo from "@/assets/strun-logo-new.png";
import { loginWithGoogle, handleOAuthCallback, isAuthenticated, logout, getCurrentUserAddress, getCurrentUserInfo, initService } from "@/lib/zklogin";
import Dashboard from "./components/Dashboard";
import { MapView } from "./components/MapView";
import { Wallet } from "./components/Wallet";
import { Profile } from "./components/Profile";
import Community from "./components/Community";
import "maplibre-gl/dist/maplibre-gl.css";

const queryClient = new QueryClient();

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState({
    xp: 0,
    territories: 0,
    distance: 0
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check for OAuth callback FIRST
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const queryParams = new URLSearchParams(window.location.search);
        const idToken = hashParams.get('id_token') || queryParams.get('id_token');
        
        if (idToken) {
          console.log("[App] Processing OAuth callback");
          // Don't call initService here - just handle the callback
          const address = await handleOAuthCallback();
          if (address) {
            setIsLoggedIn(true);
            toast.success("Successfully logged in with zkLogin!");
            // URL cleanup is handled in handleOAuthCallback
          } else {
            // If callback failed, initialize service for retry
            await initService();
          }
        } else {
          // Check if already authenticated
          const authenticated = isAuthenticated();
          console.log("[App] Authentication check:", authenticated);
          
          if (authenticated) {
            setIsLoggedIn(true);
          } else {
            // Only initialize if not authenticated and not handling callback
            await initService();
          }
        }
      } catch (error) {
        console.error('[App] Auth check error:', error);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  const handleZkLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error('zkLogin error:', error);
      toast.error('Failed to login with Google. Please try again.');
    }
  };

  const handleGuestMode = () => {
    setIsGuest(true);
    toast.success("Welcome to StRun in guest mode!");
  };

  const handleLogout = () => {
    logout();
    setIsLoggedIn(false);
    setIsGuest(false);
    setActiveTab("dashboard");
    toast.success("Logged out successfully");
  };

  if (loading) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading StRun...</p>
            </div>
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // Login Screen
  if (!isLoggedIn && !isGuest) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <div className="min-h-screen relative overflow-hidden">
            {/* Background Video */}
            <video
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              onLoadedData={() => setVideoLoaded(true)}
            >
              <source src="/strun-intro.mp4" type="video/mp4" />
            </video>
            
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background/80" />
            
            {/* Content */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: videoLoaded ? 1 : 0 }}
              className="relative min-h-screen flex items-center justify-center p-6"
            >
              <div className="w-full max-w-md">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-center space-y-8"
                >
                  {/* Logo */}
                  <motion.div
                    initial={{ y: -20 }}
                    animate={{ y: 0 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className="mx-auto w-48 h-32 flex items-center justify-center"
                  >
                    <img 
                      src={strunLogo} 
                      alt="StRun Logo" 
                      className="w-full h-full object-contain drop-shadow-2xl"
                    />
                  </motion.div>

                  {/* Title */}
                  <div className="space-y-4">
                    <motion.h1
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-4xl font-bold text-foreground"
                    >
                      Welcome to <span className="gradient-text">StRun</span>
                    </motion.h1>
                    <motion.p
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="text-muted-foreground text-lg"
                    >
                      Run the streets. Own the grid. Turn your runs into blockchain territory.
                    </motion.p>
                  </div>

                  {/* Buttons */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="space-y-3"
                  >
                    <Button 
                      variant="gradient" 
                      size="lg" 
                      className="w-full h-14 text-lg rounded-xl"
                      onClick={handleZkLogin}
                    >
                      <WalletIcon className="mr-2" />
                      Login with Google (zkLogin)
                    </Button>
                    <Button 
                      variant="glass" 
                      size="lg" 
                      className="w-full h-14 text-lg rounded-xl"
                      onClick={handleGuestMode}
                    >
                      <Play className="mr-2" />
                      Continue as Guest
                    </Button>
                  </motion.div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // Main App
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <div className="min-h-screen bg-background">
          {/* Header */}
          <header className="border-b bg-card">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img src={strunLogo} alt="StRun" className="h-10 w-auto" />
                <h1 className="text-2xl font-bold gradient-text">StRun</h1>
              </div>
              <div className="flex items-center gap-4">
                {isLoggedIn && (
                  <div className="text-sm text-muted-foreground">
                    {getCurrentUserAddress()?.slice(0, 6)}...{getCurrentUserAddress()?.slice(-4)}
                  </div>
                )}
                {isGuest && (
                  <div className="text-sm text-muted-foreground">Guest Mode</div>
                )}
                <Button variant="ghost" size="icon" onClick={handleLogout}>
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="container mx-auto px-4 py-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-5 mb-6">
                <TabsTrigger value="dashboard" className="flex items-center gap-2">
                  <HomeIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </TabsTrigger>
                <TabsTrigger value="map" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span className="hidden sm:inline">Map</span>
                </TabsTrigger>
                <TabsTrigger value="wallet" className="flex items-center gap-2">
                  <WalletIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Wallet</span>
                </TabsTrigger>
                <TabsTrigger value="community" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Community</span>
                </TabsTrigger>
                <TabsTrigger value="profile" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Profile</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard">
                <Dashboard />
              </TabsContent>

              <TabsContent value="map">
                <MapView 
                  isRunning={isRunning}
                  onStartRun={() => setIsRunning(true)}
                  onStopRun={() => setIsRunning(false)}
                  stats={stats}
                />
              </TabsContent>

              <TabsContent value="wallet">
                {isGuest ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Wallet</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">Please login with zkLogin to access wallet features.</p>
                      <Button onClick={handleZkLogin} className="mt-4">
                        <WalletIcon className="mr-2 h-4 w-4" />
                        Login with zkLogin
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Wallet balance={0} transactions={[]} />
                )}
              </TabsContent>

              <TabsContent value="community">
                <Community />
              </TabsContent>

              <TabsContent value="profile">
                <Profile user={getCurrentUserInfo()} onLogout={handleLogout} />
              </TabsContent>
            </Tabs>
          </main>

          {/* Bottom Navigation for Mobile */}
          <div className="fixed bottom-0 left-0 right-0 bg-card border-t md:hidden">
            <div className="grid grid-cols-5 p-2">
              <Button
                variant={activeTab === "dashboard" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("dashboard")}
                className="flex flex-col items-center gap-1 h-auto py-2"
              >
                <HomeIcon className="h-5 w-5" />
                <span className="text-xs">Home</span>
              </Button>
              <Button
                variant={activeTab === "map" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("map")}
                className="flex flex-col items-center gap-1 h-auto py-2"
              >
                <MapPin className="h-5 w-5" />
                <span className="text-xs">Map</span>
              </Button>
              <Button
                variant={activeTab === "wallet" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("wallet")}
                className="flex flex-col items-center gap-1 h-auto py-2"
              >
                <WalletIcon className="h-5 w-5" />
                <span className="text-xs">Wallet</span>
              </Button>
              <Button
                variant={activeTab === "community" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("community")}
                className="flex flex-col items-center gap-1 h-auto py-2"
              >
                <Users className="h-5 w-5" />
                <span className="text-xs">Feed</span>
              </Button>
              <Button
                variant={activeTab === "profile" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("profile")}
                className="flex flex-col items-center gap-1 h-auto py-2"
              >
                <User className="h-5 w-5" />
                <span className="text-xs">Profile</span>
              </Button>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;