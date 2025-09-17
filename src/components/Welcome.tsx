import { Button } from "@/components/ui/button";
import { Play, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { loginWithGoogle, handleOAuthCallback, isAuthenticated } from "@/lib/zklogin";
import { toast } from "sonner";
import strunLogo from "@/assets/strun-logo-new.png";

interface WelcomeProps {
  onGetStarted: () => void;
  onConnectWallet: () => void;
}

export function Welcome({ onGetStarted, onConnectWallet }: WelcomeProps) {
  const [videoLoaded, setVideoLoaded] = useState(false);

  // Check for OAuth callback
  useEffect(() => {
    const checkAuth = async () => {
      if (window.location.hash && window.location.hash.includes('id_token')) {
        try {
          const address = await handleOAuthCallback();
          if (address) {
            toast.success("zkLogin ile başarıyla giriş yapıldı!");
            onGetStarted();
          } else {
            // Callback failed, show error
            toast.error("Giriş işlemi başarısız. Lütfen tekrar deneyin.");
          }
        } catch (error) {
          console.error('OAuth callback error:', error);
          toast.error("Giriş işlemi sırasında bir hata oluştu.");
        }
      } else if (isAuthenticated()) {
        onGetStarted();
      }
    };
    checkAuth();
  }, [onGetStarted]);

  const handleZkLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error('zkLogin error:', error);
      toast.error('Google ile giriş yapılamadı. Lütfen tekrar deneyin.');
    }
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
              onClick={onGetStarted}
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
}