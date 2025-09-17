import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { isAuthenticated } from "@/lib/zklogin";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("home");

  // Map routes to tab names
  useEffect(() => {
    const path = location.pathname.replace("/", "") || "home";
    setActiveTab(path);
  }, [location]);

  const handleTabChange = (tab: string) => {
    navigate(`/${tab === "home" ? "" : tab}`);
  };

  // Don't show bottom nav on auth page
  const showBottomNav = location.pathname !== "/auth" && isAuthenticated();

  return (
    <div className="min-h-screen bg-background">
      <div className={showBottomNav ? "pb-16" : ""}>
        {children}
      </div>
      {showBottomNav && (
        <BottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      )}
    </div>
  );
}