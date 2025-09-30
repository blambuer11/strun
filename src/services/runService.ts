import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "./userService";
import * as turf from "@turf/turf";

export interface RunData {
  route: [number, number][]; // [lng, lat] pairs
  distance: number; // meters
  duration: number; // seconds
  avgPace: number; // min/km
  calories: number;
  xpEarned: number;
  area?: number; // square meters
}

export async function saveRun(runData: RunData) {
  const user = await getCurrentUser();
  
  if (!user) {
    console.error('No user found, cannot save run');
    return null;
  }
  
  try {
    // Create GeoJSON LineString
    const routeGeoJSON = {
      type: "LineString",
      coordinates: runData.route
    };
    
    // Calculate area if route is long enough
    let area = 0;
    if (runData.route.length >= 3) {
      const line = turf.lineString(runData.route);
      const buffered = turf.buffer(line, 10, { units: "meters" });
      if (buffered) {
        area = turf.area(buffered);
      }
    }
    
    const { data, error } = await supabase
      .from('runs')
      .insert({
        user_id: user.id,
        route: routeGeoJSON,
        area: area,
        distance: runData.distance,
        duration: runData.duration,
        avg_pace: runData.avgPace,
        calories_burned: runData.calories,
        xp_earned: runData.xpEarned
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error saving run:', error);
    return null;
  }
}

export async function getUserRuns(userId?: string) {
  try {
    let query = supabase
      .from('runs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching runs:', error);
    return [];
  }
}

export async function getTodayRuns() {
  const today = new Date().toISOString().slice(0, 10);
  
  try {
    const { data, error } = await supabase
      .from('runs')
      .select(`
        *,
        users!runs_user_id_fkey (
          name,
          avatar_url
        )
      `)
      .gte('created_at', today + 'T00:00:00')
      .lt('created_at', today + 'T23:59:59');
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching today runs:', error);
    return [];
  }
}