import { Button } from "@/components/ui/button";
import { Play, Wallet } from "lucide-react";
import { motion } from "framer-motion";

interface WelcomeProps {
  onGetStarted: () => void;
  onConnectWallet: () => void;
}

export function Welcome({ onGetStarted, onConnectWallet }: WelcomeProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex items-center justify-center p-6"
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
            className="mx-auto w-24 h-24 bg-gradient-to-br from-primary to-accent rounded-3xl flex items-center justify-center shadow-lg glow"
          >
            <span className="text-4xl font-bold text-white">S</span>
          </motion.div>

          {/* Title */}
          <div className="space-y-4">
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-4xl font-bold text-foreground"
            >
              Welcome to <span className="gradient-text">Strun</span>
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
              onClick={onGetStarted}
            >
              <Play className="mr-2" />
              Get Started
            </Button>
            <Button 
              variant="glass" 
              size="lg" 
              className="w-full h-14 text-lg rounded-xl"
              onClick={onConnectWallet}
            >
              <Wallet className="mr-2" />
              Connect Wallet
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}