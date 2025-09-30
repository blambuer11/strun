import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserInfo } from "@/lib/zklogin";
import * as turf from "@turf/turf";

export interface RunData {
  route: [number, number][]; // [lng, lat] pairs
  polygon?: any; // GeoJSON polygon
  bbox?: { lonMin: number; latMin: number; lonMax: number; latMax: number };
  area?: number; // square meters
  walrusCid?: string;
}

export async function saveRun(runData: RunData) {
  const userInfo = getCurrentUserInfo();
  
  if (!userInfo?.email) {
    console.error('No user found, cannot save run');
    return null;
  }
  
  try {
    // Create GeoJSON LineString
    const routeGeoJSON = {
      type: "LineString",
      coordinates: runData.route
    };
    
    // Calculate polygon and area if route is long enough
    let polygon = runData.polygon;
    let area = runData.area || 0;
    let bbox = runData.bbox;
    
    if (!polygon && runData.route.length >= 3) {
      const line = turf.lineString(runData.route);
      const buffered = turf.buffer(line, 10, { units: "meters" });
      if (buffered) {
        polygon = buffered;
        area = turf.area(buffered);
        const bounds = turf.bbox(buffered);
        bbox = {
          lonMin: bounds[0],
          latMin: bounds[1],
          lonMax: bounds[2],
          latMax: bounds[3]
        };
      }
    }
    
    const { data, error } = await supabase
      .from('runs')
      .insert({
        user_email: userInfo.email,
        route: routeGeoJSON,
        polygon: polygon,
        bbox: bbox,
        area_m2: area,
        walrus_cid: runData.walrusCid
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

export async function getUserRuns(userEmail?: string) {
  try {
    let query = supabase
      .from('runs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (userEmail) {
      query = query.eq('user_email', userEmail);
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
        users!runs_user_email_fkey (
          name,
          avatar_url
        )
      `)
      .eq('date', today);
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching today runs:', error);
    return [];
  }
}