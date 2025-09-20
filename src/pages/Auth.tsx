import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Wallet, Play } from "lucide-react";
import strunLogo from "@/assets/strun-logo-new.png";
import { loginWithGoogle, handleOAuthCallback, isAuthenticated } from "@/lib/zklogin";
import { supabase } from "@/integrations/supabase/client";
import { FirstTimeSetup } from "@/components/FirstTimeSetup";

const Auth = () => {
  const navigate = useNavigate();
  const [videoLoaded, setVideoLoaded] = useState(false);

  // Check for OAuth callback
  useEffect(() => {
    // If already authenticated and no callback in progress, redirect
    if (isAuthenticated() && !window.location.hash.includes('id_token')) {
      console.log("[Auth] Already authenticated, redirecting to /home");
      navigate("/home", { replace: true });
      return;
    }

    const checkAuth = async () => {
      // Check if we have an id_token in the URL (OAuth callback)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const queryParams = new URLSearchParams(window.location.search);
      const idToken = hashParams.get('id_token') || queryParams.get('id_token');
      
      if (idToken) {
        console.log("[Auth] Processing OAuth callback with id_token");
        try {
          const address = await handleOAuthCallback();
          if (address) {
            console.log("[Auth] Login successful, navigating to /home");
            toast.success("Successfully logged in with zkLogin!");
            // Force navigation to home
            setTimeout(() => {
              navigate("/home", { replace: true });
            }, 100);
          } else {
            console.error("[Auth] handleOAuthCallback returned null");
            toast.error("Login failed. Please try again.");
          }
        } catch (error) {
          console.error('[Auth] OAuth callback error:', error);
          toast.error("An error occurred during login.");
        }
      }
    };
    
    checkAuth();
  }, [navigate]);

  const handleZkLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error('zkLogin error:', error);
      toast.error('Failed to login with Google. Please try again.');
    }
  };

  const handleGuestMode = () => {
    navigate("/home");
  };

  return (
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
                <Wallet className="mr-2" />
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
  );
};

export default Auth;