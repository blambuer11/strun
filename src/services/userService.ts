import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserInfo, getCurrentUserAddress } from "@/lib/zklogin";

export async function upsertUser() {
  const userInfo = getCurrentUserInfo();
  const wallet = getCurrentUserAddress();
  
  if (!userInfo || !userInfo.email) return null;
  
  try {
    const { data, error } = await supabase
      .from('users')
      .upsert({
        email: userInfo.email,
        name: userInfo.name || userInfo.email.split('@')[0],
        avatar_url: userInfo.picture,
        wallet
      }, {
        onConflict: 'email'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error upserting user:', error);
    return null;
  }
}

export async function getCurrentUser() {
  const userInfo = getCurrentUserInfo();
  
  if (!userInfo || !userInfo.email) return null;
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', userInfo.email)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // User doesn't exist, create them
        return await upsertUser();
      }
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}