import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserInfo, getCurrentUserAddress } from "@/lib/zklogin";

export async function upsertUser() {
  const userInfo = getCurrentUserInfo();
  const wallet = getCurrentUserAddress();
  
  if (!userInfo || !userInfo.email) return null;
  
  try {
    // First try to find existing user
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', userInfo.email)
      .single();
    
    if (existingUser) {
      // Update user if needed
      const { data, error } = await supabase
        .from('users')
        .update({
          name: userInfo.name || userInfo.email.split('@')[0],
          avatar_url: userInfo.picture,
          wallet
        })
        .eq('email', userInfo.email)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } else {
      // Create new user
      const { data, error } = await supabase
        .from('users')
        .insert({
          email: userInfo.email,
          name: userInfo.name || userInfo.email.split('@')[0],
          avatar_url: userInfo.picture,
          wallet
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  } catch (error: any) {
    // If error is because user doesn't exist, try to create
    if (error?.code === 'PGRST116') {
      try {
        const { data, error: insertError } = await supabase
          .from('users')
          .insert({
            email: userInfo.email,
            name: userInfo.name || userInfo.email.split('@')[0],
            avatar_url: userInfo.picture,
            wallet
          })
          .select()
          .single();
        
        if (insertError) throw insertError;
        return data;
      } catch (insertErr) {
        console.error('Error creating user:', insertErr);
        return null;
      }
    }
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