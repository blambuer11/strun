import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Upload, 
  Camera, 
  User, 
  Copy, 
  Share2, 
  Bell, 
  MapPin, 
  Moon, 
  Globe, 
  Shield,
  Users,
  Gift
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProfileSettingsProps {
  profileId: string;
  currentUsername?: string;
  currentAvatar?: string;
  referralCode?: string;
  onAvatarUpdate?: (url: string) => void;
  onUsernameUpdate?: (username: string) => void;
}

export function ProfileSettings({ 
  profileId, 
  currentUsername, 
  currentAvatar,
  referralCode,
  onAvatarUpdate,
  onUsernameUpdate
}: ProfileSettingsProps) {
  const [username, setUsername] = useState(currentUsername || '');
  const [avatarUrl, setAvatarUrl] = useState(currentAvatar || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [referralLink, setReferralLink] = useState('');
  
  // Settings state
  const [settings, setSettings] = useState({
    notifications_enabled: true,
    location_sharing: true,
    health_integration_google: false,
    health_integration_apple: false,
    privacy_mode: 'public',
    language: 'en',
    theme: 'dark'
  });

  useEffect(() => {
    if (referralCode) {
      const baseUrl = window.location.origin;
      setReferralLink(`${baseUrl}/auth?ref=${referralCode}`);
    }
    fetchUserSettings();
  }, [referralCode]);

  const fetchUserSettings = async () => {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', profileId)
      .maybeSingle();

    if (data) {
      setSettings({
        notifications_enabled: data.notifications_enabled ?? true,
        location_sharing: data.location_sharing ?? true,
        health_integration_google: data.health_integration_google ?? false,
        health_integration_apple: data.health_integration_apple ?? false,
        privacy_mode: data.privacy_mode ?? 'public',
        language: data.language ?? 'en',
        theme: data.theme ?? 'dark'
      });
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${profileId}/${Date.now()}.${fileExt}`;
      const filePath = `${profileId}/${fileName}`;

      // Upload image to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profileId);

      if (updateError) {
        throw updateError;
      }

      setAvatarUrl(publicUrl);
      onAvatarUpdate?.(publicUrl);
      toast.success('Avatar updated successfully!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleUsernameUpdate = async () => {
    if (!username || username === currentUsername) return;
    
    try {
      setSaving(true);
      
      // Check if username is available
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .neq('id', profileId)
        .maybeSingle();

      if (existing) {
        toast.error('Username already taken');
        return;
      }

      // Update username
      const { error } = await supabase
        .from('profiles')
        .update({ username })
        .eq('id', profileId);

      if (error) throw error;

      onUsernameUpdate?.(username);
      toast.success('Username updated successfully!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSettingsUpdate = async (key: string, value: any) => {
    try {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);

      // Check if settings exist
      const { data: existing } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', profileId)
        .maybeSingle();

      if (existing) {
        // Update existing settings
        const { error } = await supabase
          .from('user_settings')
          .update({ [key]: value })
          .eq('user_id', profileId);

        if (error) throw error;
      } else {
        // Create new settings
        const { error } = await supabase
          .from('user_settings')
          .insert({
            user_id: profileId,
            ...newSettings
          });

        if (error) throw error;
      }

      toast.success('Settings updated');
    } catch (error: any) {
      toast.error('Failed to update settings');
      console.error(error);
    }
  };

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('Referral link copied to clipboard!');
  };

  const shareReferralLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join StRun',
          text: 'Join me on StRun and earn XP bonuses!',
          url: referralLink
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      copyReferralLink();
    }
  };

  return (
    <Tabs defaultValue="profile" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
        <TabsTrigger value="referral">Referral</TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="space-y-4">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Profile Information</h3>
          
          {/* Avatar Upload */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-white" />
                )}
              </div>
              <label 
                htmlFor="avatar-upload" 
                className="absolute bottom-0 right-0 p-2 bg-primary rounded-full cursor-pointer hover:bg-primary/80 transition-colors"
              >
                <Camera className="w-4 h-4 text-white" />
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                />
              </label>
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                Click the camera icon to upload a profile photo
              </p>
              {uploading && <p className="text-sm text-primary">Uploading...</p>}
            </div>
          </div>

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <div className="flex gap-2">
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
              />
              <Button 
                onClick={handleUsernameUpdate}
                disabled={saving || !username || username === currentUsername}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="settings" className="space-y-4">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Platform Settings</h3>
          
          <div className="space-y-4">
            {/* Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="notifications">Push Notifications</Label>
              </div>
              <Switch
                id="notifications"
                checked={settings.notifications_enabled}
                onCheckedChange={(checked) => handleSettingsUpdate('notifications_enabled', checked)}
              />
            </div>

            {/* Location Sharing */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="location">Location Sharing</Label>
              </div>
              <Switch
                id="location"
                checked={settings.location_sharing}
                onCheckedChange={(checked) => handleSettingsUpdate('location_sharing', checked)}
              />
            </div>

            {/* Privacy Mode */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="privacy">Privacy Mode</Label>
              </div>
              <Select
                value={settings.privacy_mode}
                onValueChange={(value) => handleSettingsUpdate('privacy_mode', value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="friends">Friends</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Theme */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="theme">Theme</Label>
              </div>
              <Select
                value={settings.theme}
                onValueChange={(value) => handleSettingsUpdate('theme', value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Language */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="language">Language</Label>
              </div>
              <Select
                value={settings.language}
                onValueChange={(value) => handleSettingsUpdate('language', value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="tr">Türkçe</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="referral" className="space-y-4">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Referral Program
          </h3>
          
          <div className="space-y-4">
            <div className="p-4 bg-primary/10 rounded-lg">
              <p className="text-sm font-medium mb-2">Your Referral Code</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-background rounded text-lg font-bold">
                  {referralCode || 'Loading...'}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(referralCode || '');
                    toast.success('Code copied!');
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Referral Link</Label>
              <div className="flex gap-2">
                <Input value={referralLink} readOnly />
                <Button onClick={copyReferralLink} size="icon" variant="outline">
                  <Copy className="w-4 h-4" />
                </Button>
                <Button onClick={shareReferralLink} size="icon" variant="outline">
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="p-4 bg-accent/10 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Referral Rewards
              </h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• You earn <span className="font-bold text-primary">500 XP</span> for each friend who joins</li>
                <li>• Your friend gets <span className="font-bold text-primary">100 XP</span> bonus on signup</li>
                <li>• No limit on referrals!</li>
              </ul>
            </div>
          </div>
        </Card>
      </TabsContent>
    </Tabs>
  );
}