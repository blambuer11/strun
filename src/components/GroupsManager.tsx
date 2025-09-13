import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Plus, Search, Globe, MapPin, Trophy, Calendar, Target, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CreateGroupModal from "./CreateGroupModal";

interface GroupsManagerProps {
  userId?: string;
}

export default function GroupsManager({ userId }: GroupsManagerProps) {
  const [groups, setGroups] = useState<any[]>([]);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    loadGroups();
  }, [userId]);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("groups")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (data) setGroups(data);

      if (userId) {
        // Get user's profile ID
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", userId)
          .single();
        
        if (profile) {
          const { data: memberData } = await supabase
            .from("group_members")
            .select("group_id")
            .eq("user_id", profile.id);
          
          if (memberData) {
            setMyGroups(memberData.map(m => m.group_id));
          }
        }
      }
    } catch (error) {
      console.error("Error loading groups:", error);
    } finally {
      setLoading(false);
    }
  };

  const joinGroup = async (groupId: string) => {
    if (!userId) {
      toast.error("Please login to join groups");
      return;
    }

    try {
      // Get user's profile ID
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!profile) {
        throw new Error("Profile not found");
      }

      const { error } = await supabase
        .from("group_members")
        .insert({ group_id: groupId, user_id: profile.id });

      if (error) throw error;

      // Update member count
      await supabase
        .from("groups")
        .update({ current_members: groups.find(g => g.id === groupId)?.current_members + 1 })
        .eq("id", groupId);

      toast.success("Joined group successfully!");
      setMyGroups([...myGroups, groupId]);
      loadGroups();
    } catch (error: any) {
      toast.error(error.message || "Failed to join group");
    }
  };

  const joinWithCode = async () => {
    const code = prompt("Enter group join code:");
    if (!code) return;

    try {
      const { data: group } = await supabase
        .from("groups")
        .select("id")
        .eq("join_code", code.toUpperCase())
        .single();

      if (group) {
        await joinGroup(group.id);
      } else {
        toast.error("Invalid join code");
      }
    } catch (error) {
      toast.error("Invalid join code");
    }
  };

  const filteredGroups = groups.filter(group => {
    const matchesSearch = 
      group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.running_area?.toLowerCase().includes(searchTerm.toLowerCase());

    if (activeTab === "my-groups") {
      return matchesSearch && myGroups.includes(group.id);
    } else if (activeTab === "community") {
      return matchesSearch && group.is_public;
    }
    return matchesSearch;
  });

  return (
    <>
      <Card className="glass-card backdrop-blur-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Running Groups</CardTitle>
              <CardDescription>Join groups and run together</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={joinWithCode}
              >
                Join with Code
              </Button>
              <Button 
                variant="gradient" 
                size="sm"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Group
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="all">All Groups</TabsTrigger>
              <TabsTrigger value="my-groups">My Groups</TabsTrigger>
              <TabsTrigger value="community">Community</TabsTrigger>
            </TabsList>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search groups..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <TabsContent value={activeTab} className="mt-0">
              <div className="grid gap-4">
                {filteredGroups.map((group) => (
                  <div key={group.id} className="p-4 rounded-lg border border-border/50 hover:border-accent/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{group.name}</h3>
                          {group.join_code && (
                            <Badge variant="outline" className="font-mono text-xs">
                              {group.join_code}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{group.description}</p>
                        
                        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3 text-primary" />
                            {group.country}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-accent" />
                            {group.city}
                            {group.running_area && ` • ${group.running_area}`}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-blue-500" />
                            {group.current_members}/{group.max_members} members
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3 text-green-500" />
                            {(group.weekly_goal / 1000)}km/week
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-orange-500" />
                            {(group.total_distance / 1000).toFixed(0)}km total
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        {myGroups.includes(group.id) ? (
                          <Badge variant="secondary">
                            <Users className="mr-1 h-3 w-3" />
                            Joined
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => joinGroup(group.id)}
                            disabled={group.current_members >= group.max_members}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Join
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredGroups.length === 0 && (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      {activeTab === "my-groups" 
                        ? "You haven't joined any groups yet" 
                        : "No groups found"}
                    </p>
                    {activeTab === "my-groups" && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-3"
                        onClick={() => setActiveTab("all")}
                      >
                        Browse Groups
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <CreateGroupModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        userId={userId}
        onGroupCreated={loadGroups}
      />
    </>
  );
}