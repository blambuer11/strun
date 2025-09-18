import React, { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Map from "./pages/Map";
import WalletPage from "./pages/Wallet";
import ProfilePage from "./pages/Profile";
import NotFound from "./pages/NotFound";
import { isAuthenticated, initService } from "@/lib/zklogin";

const queryClient = new QueryClient();

// ✅ Protected Route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();

  if (!isAuthenticated()) {
    // redirect + save current location
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const App = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // ✅ zkLogin callback işlemini router hazırken çalıştır
    initService()
      .catch((err) => console.error("zkLogin init error:", err))
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    // ✅ Callback işlenene kadar boş ekran veya loader göster
    return <div>Loading...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Home />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/map"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Map />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/wallet"
              element={
                <ProtectedRoute>
                  <Layout>
                    <WalletPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ProfilePage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            {/* CATCH-ALL */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
