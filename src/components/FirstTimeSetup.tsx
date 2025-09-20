import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Camera, User, Zap, MapPin, Heart, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";

interface FirstTimeSetupProps {
  isOpen: boolean;
  onComplete: () => void;
  userEmail?: string;
  userId: string;
}

export function FirstTimeSetup({ isOpen, onComplete, userEmail, userId }: FirstTimeSetupProps) {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [permissions, setPermissions] = useState({
    location: false,
    notifications: false,
    healthGoogle: false,
    healthApple: false
  });

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarFile(file);
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      toast.success("Avatar uploaded successfully!");
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error("Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleUsernameSubmit = async () => {
    if (!username || username.length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }

    // Check if username is unique
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUser) {
      toast.error("Username already taken. Please choose another.");
      return;
    }

    setStep(2);
  };

  const handlePermissionsSubmit = () => {
    // Request actual permissions
    if (permissions.location && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => toast.success("Location permission granted!"),
        () => toast.error("Location permission denied")
      );
    }

    if (permissions.notifications && 'Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          toast.success("Notification permission granted!");
        }
      });
    }

    setStep(3);
  };

  const handleComplete = async () => {
    setUploading(true);

    try {
      // Update profile with all information
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          username,
          avatar_url: avatarUrl,
          referred_by: referralCode ? 
            (await supabase.from('profiles').select('id').eq('referral_code', referralCode).single()).data?.id 
            : null
        })
        .eq('user_id', userId);

      if (profileError) throw profileError;

      // Create user settings
      const { error: settingsError } = await supabase
        .from('user_settings')
        .insert({
          user_id: (await supabase.from('profiles').select('id').eq('user_id', userId).single()).data?.id,
          location_sharing: permissions.location,
          notifications_enabled: permissions.notifications,
          health_integration_google: permissions.healthGoogle,
          health_integration_apple: permissions.healthApple
        });

      if (settingsError) throw settingsError;

      toast.success("Welcome to StRun! Your profile is ready.");
      onComplete();
    } catch (error) {
      console.error('Profile setup error:', error);
      toast.error("Failed to complete setup. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Welcome to StRun! 🏃‍♂️</DialogTitle>
          <DialogDescription>
            {step === 1 && "Choose your unique username"}
            {step === 2 && "Grant permissions for the best experience"}
            {step === 3 && "Personalize your profile"}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Username */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="text-lg"
              />
              <p className="text-xs text-muted-foreground">
                This will be your unique identifier in StRun
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="referral">Referral Code (Optional)</Label>
              <Input
                id="referral"
                placeholder="Enter referral code"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                maxLength={8}
              />
              <p className="text-xs text-muted-foreground">
                Have a referral code? Both you and your referrer will earn bonus XP!
              </p>
            </div>

            <Button 
              onClick={handleUsernameSubmit} 
              className="w-full"
              disabled={!username || username.length < 3}
            >
              Continue
            </Button>
          </motion.div>
        )}

        {/* Step 2: Permissions */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <div className="space-y-3">
              <Card className="p-4 border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">Location Access</p>
                      <p className="text-xs text-muted-foreground">Track your runs accurately</p>
                    </div>
                  </div>
                  <Switch
                    checked={permissions.location}
                    onCheckedChange={(checked) => setPermissions(prev => ({ ...prev, location: checked }))}
                  />
                </div>
              </Card>

              <Card className="p-4 border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">Notifications</p>
                      <p className="text-xs text-muted-foreground">Get updates and achievements</p>
                    </div>
                  </div>
                  <Switch
                    checked={permissions.notifications}
                    onCheckedChange={(checked) => setPermissions(prev => ({ ...prev, notifications: checked }))}
                  />
                </div>
              </Card>

              <Card className="p-4 border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Heart className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">Health Integration</p>
                      <p className="text-xs text-muted-foreground">Sync with fitness apps</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={permissions.healthGoogle ? "default" : "outline"}
                      onClick={() => setPermissions(prev => ({ ...prev, healthGoogle: !prev.healthGoogle }))}
                    >
                      Google
                    </Button>
                    <Button
                      size="sm"
                      variant={permissions.healthApple ? "default" : "outline"}
                      onClick={() => setPermissions(prev => ({ ...prev, healthApple: !prev.healthApple }))}
                    >
                      Apple
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            <Button onClick={handlePermissionsSubmit} className="w-full">
              Continue
            </Button>
          </motion.div>
        )}

        {/* Step 3: Avatar */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="w-32 h-32 border-4 border-primary/20">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="text-3xl">
                  {username?.charAt(0).toUpperCase() || <User className="w-12 h-12" />}
                </AvatarFallback>
              </Avatar>

              <Label htmlFor="avatar-upload" className="cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors">
                  <Camera className="w-4 h-4" />
                  <span>Upload Avatar</span>
                </div>
                <Input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                />
              </Label>
            </div>

            <div className="bg-primary/5 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                <p className="font-medium">You're all set!</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Welcome to StRun, <span className="font-semibold text-foreground">@{username}</span>! 
                {referralCode && " You'll receive bonus XP for using a referral code!"}
              </p>
            </div>

            <Button 
              onClick={handleComplete} 
              className="w-full"
              disabled={uploading}
            >
              {uploading ? "Setting up..." : "Start Running!"}
            </Button>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}