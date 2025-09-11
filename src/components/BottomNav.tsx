import { Home, Map, User, Wallet } from "lucide-react";
import { motion } from "framer-motion";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const tabs = [
    { id: "home", icon: Home, label: "Home" },
    { id: "map", icon: Map, label: "Map" },
    { id: "wallet", icon: Wallet, label: "Wallet" },
    { id: "profile", icon: User, label: "Profile" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 glass-card backdrop-blur-xl border-t border-white/10 z-50">
      <div className="flex justify-around items-center py-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="relative flex flex-col items-center justify-center p-2 w-full"
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-lg"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <tab.icon 
              className={`w-5 h-5 relative z-10 transition-colors ${
                activeTab === tab.id 
                  ? "text-accent" 
                  : "text-muted-foreground"
              }`}
            />
            <span className={`text-xs mt-1 relative z-10 transition-colors ${
              activeTab === tab.id 
                ? "text-accent" 
                : "text-muted-foreground"
            }`}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}