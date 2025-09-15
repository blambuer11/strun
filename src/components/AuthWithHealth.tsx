import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, Heart, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { loginWithGoogle } from "@/lib/zklogin";
import { healthIntegration } from "@/lib/health-integration";

interface AuthWithHealthProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (username: string) => void;
}

export function AuthWithHealth({ open, onClose, onSuccess }: AuthWithHealthProps) {
  const [username, setUsername] = useState("");
  const [googleHealthConsent, setGoogleHealthConsent] = useState(false);
  const [appleHealthConsent, setAppleHealthConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim()) {
      toast.error("Lütfen kullanıcı adı girin");
      return;
    }

    if (username.length < 3) {
      toast.error("Kullanıcı adı en az 3 karakter olmalıdır");
      return;
    }

    setLoading(true);
    
    // Store username and consents temporarily
    sessionStorage.setItem('pending_username', username);
    sessionStorage.setItem('google_health_consent', googleHealthConsent.toString());
    sessionStorage.setItem('apple_health_consent', appleHealthConsent.toString());
    
    // Request health permissions if consented
    if (googleHealthConsent) {
      const granted = await healthIntegration.requestGoogleHealthPermission();
      if (granted) {
        toast.success("Google Health bağlantısı kuruldu!");
      }
    }
    
    if (appleHealthConsent) {
      const granted = await healthIntegration.requestAppleHealthPermission();
      if (granted) {
        toast.success("Apple Health bağlantısı kuruldu!");
      }
    }
    
    // Proceed with Google login
    await loginWithGoogle();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            StRun'a Hoş Geldiniz
          </DialogTitle>
        </DialogHeader>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="username">Kullanıcı Adı</Label>
            <Input
              id="username"
              placeholder="Kullanıcı adınızı girin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Bu isim liderboard ve grup aktivitelerinde görünecektir
            </p>
          </div>

          <div className="space-y-3">
            <Label>Sağlık Verileri İzinleri (Opsiyonel)</Label>
            
            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <Checkbox 
                id="google-health"
                checked={googleHealthConsent}
                onCheckedChange={(checked) => setGoogleHealthConsent(checked as boolean)}
                disabled={loading}
              />
              <Label 
                htmlFor="google-health" 
                className="flex items-center gap-2 cursor-pointer flex-1"
              >
                <Smartphone className="h-4 w-4 text-green-600" />
                <div>
                  <p className="font-medium">Google Health</p>
                  <p className="text-xs text-muted-foreground">
                    Adım sayısı, kalori ve diğer fitness verilerini senkronize et
                  </p>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <Checkbox 
                id="apple-health"
                checked={appleHealthConsent}
                onCheckedChange={(checked) => setAppleHealthConsent(checked as boolean)}
                disabled={loading}
              />
              <Label 
                htmlFor="apple-health" 
                className="flex items-center gap-2 cursor-pointer flex-1"
              >
                <Heart className="h-4 w-4 text-red-500" />
                <div>
                  <p className="font-medium">Apple Health</p>
                  <p className="text-xs text-muted-foreground">
                    iOS cihazlardan sağlık verilerini senkronize et
                  </p>
                </div>
              </Label>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Sağlık verileri Walrus üzerinde güvenli bir şekilde saklanacaktır. 
            Bu izinleri daha sonra profil ayarlarından değiştirebilirsiniz.
          </p>

          <Button
            className="w-full"
            variant="gradient"
            size="lg"
            onClick={handleLogin}
            disabled={loading || !username.trim()}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2" />
                Giriş yapılıyor...
              </>
            ) : (
              <>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google ile Giriş Yap (zkLogin)
              </>
            )}
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}