import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MapPin, Trophy, Users, Calendar } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  userId?: string;
  onGroupCreated: () => void;
}

export default function CreateGroupModal({ open, onClose, userId, onGroupCreated }: CreateGroupModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    country: "",
    city: "",
    runningArea: "",
    maxMembers: 50,
    weeklyGoal: 100,
    hasReward: false,
    rewardDescription: "",
    startDate: "",
    endDate: "",
    latitude: "",
    longitude: ""
  });

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString()
          }));
          toast.success("Location captured!");
        },
        () => {
          toast.error("Could not get location");
        }
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      toast.error("Please login to create a group");
      return;
    }

    setLoading(true);
    try {
      // Get user profile ID
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!profile) {
        throw new Error("Profile not found");
      }

      // Generate join code
      const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Create metadata with reward and location info
      const metadata: any = {
        hasReward: formData.hasReward,
        rewardDescription: formData.rewardDescription,
        startDate: formData.startDate,
        endDate: formData.endDate,
        coordinates: {
          lat: parseFloat(formData.latitude) || null,
          lng: parseFloat(formData.longitude) || null
        }
      };

      // Create group
      const { data: group, error } = await supabase
        .from("groups")
        .insert({
          name: formData.name,
          description: formData.description,
          country: formData.country,
          city: formData.city,
          running_area: formData.runningArea,
          max_members: formData.maxMembers,
          weekly_goal: formData.weeklyGoal * 1000, // Convert to meters
          creator_id: profile.id,
          join_code: joinCode,
          is_public: true
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-join creator to the group
      await supabase
        .from("group_members")
        .insert({
          group_id: group.id,
          user_id: profile.id,
          role: "admin"
        });

      toast.success(`Group "${formData.name}" created! Join code: ${joinCode}`);
      onGroupCreated();
      onClose();
    } catch (error: any) {
      console.error("Error creating group:", error);
      toast.error(error.message || "Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold gradient-text">Create Running Group</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Group Name *</Label>
              <Input
                id="name"
                required
                placeholder="Morning Runners Club"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxMembers">Max Members</Label>
              <Input
                id="maxMembers"
                type="number"
                min="2"
                max="500"
                value={formData.maxMembers}
                onChange={(e) => setFormData(prev => ({ ...prev, maxMembers: parseInt(e.target.value) }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="A friendly group for morning runs in the park..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">Country *</Label>
              <Input
                id="country"
                required
                placeholder="Turkey"
                value={formData.country}
                onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                required
                placeholder="Istanbul"
                value={formData.city}
                onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="runningArea">Running Area</Label>
              <Input
                id="runningArea"
                placeholder="Belgrad Forest"
                value={formData.runningArea}
                onChange={(e) => setFormData(prev => ({ ...prev, runningArea: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-4 p-4 rounded-lg border border-border/50">
            <div className="flex items-center justify-between">
              <Label htmlFor="location">Meeting Location</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={getCurrentLocation}
              >
                <MapPin className="mr-2 h-4 w-4" />
                Use Current Location
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="Latitude"
                value={formData.latitude}
                onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
              />
              <Input
                placeholder="Longitude"
                value={formData.longitude}
                onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="weeklyGoal">Weekly Goal (km)</Label>
            <Input
              id="weeklyGoal"
              type="number"
              min="1"
              max="1000"
              value={formData.weeklyGoal}
              onChange={(e) => setFormData(prev => ({ ...prev, weeklyGoal: parseInt(e.target.value) }))}
            />
          </div>

          <div className="space-y-4 p-4 rounded-lg border border-accent/30 bg-accent/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-accent" />
                <Label htmlFor="hasReward">Reward for Participants</Label>
              </div>
              <Switch
                id="hasReward"
                checked={formData.hasReward}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasReward: checked }))}
              />
            </div>

            {formData.hasReward && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="rewardDescription">Reward Description</Label>
                  <Textarea
                    id="rewardDescription"
                    placeholder="Top 3 runners will receive special NFT badges and 1000 bonus XP..."
                    value={formData.rewardDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, rewardDescription: e.target.value }))}
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" disabled={loading}>
              {loading ? "Creating..." : "Create Group"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}