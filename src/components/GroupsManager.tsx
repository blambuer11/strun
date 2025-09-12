import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Search, Globe, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GroupsManagerProps {
  userId?: string;
}

export default function GroupsManager({ userId }: GroupsManagerProps) {
  const [groups, setGroups] = useState<any[]>([]);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

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
        const { data: memberData } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", userId);
        
        if (memberData) {
          setMyGroups(memberData.map(m => m.group_id));
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
      const { error } = await supabase
        .from("group_members")
        .insert({ group_id: groupId, user_id: userId });

      if (error) throw error;

      toast.success("Joined group successfully!");
      setMyGroups([...myGroups, groupId]);
    } catch (error: any) {
      toast.error(error.message || "Failed to join group");
    }
  };

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.country.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="glass-card backdrop-blur-xl">
      <CardHeader>
        <CardTitle>Running Groups</CardTitle>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search groups by name, city, or country..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {filteredGroups.map((group) => (
            <div key={group.id} className="p-4 rounded-lg border border-border/50 hover:border-accent/50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{group.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
                  <div className="flex items-center gap-4 mt-3 text-sm">
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {group.country}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {group.city}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {group.current_members}/{group.max_members}
                    </span>
                  </div>
                </div>
                <div className="ml-4">
                  {myGroups.includes(group.id) ? (
                    <Badge variant="secondary">Joined</Badge>
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
        </div>
      </CardContent>
    </Card>
  );
}