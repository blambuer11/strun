import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserInfo } from "@/lib/zklogin";

export interface PostData {
  content: string;
  runId?: string;
}

export async function createPost(postData: PostData) {
  const userInfo = getCurrentUserInfo();
  
  if (!userInfo?.email) {
    console.error('No user found, cannot create post');
    return null;
  }
  
  try {
    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_email: userInfo.email,
        content: postData.content,
        run_id: postData.runId
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error creating post:', error);
    return null;
  }
}

export async function getPosts() {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        users!posts_user_email_fkey (
          name,
          avatar_url,
          wallet
        ),
        runs!posts_run_id_fkey (
          area_m2,
          date,
          route
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching posts:', error);
    return [];
  }
}