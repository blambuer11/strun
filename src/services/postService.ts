import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "./userService";

export interface PostData {
  content: string;
  runId?: string;
  imageUrl?: string;
}

export async function createPost(postData: PostData) {
  const user = await getCurrentUser();
  
  if (!user) {
    console.error('No user found, cannot create post');
    return null;
  }
  
  try {
    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        content: postData.content,
        run_id: postData.runId,
        image_url: postData.imageUrl
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
        users!posts_user_id_fkey (
          name,
          avatar_url,
          wallet
        ),
        runs!posts_run_id_fkey (
          distance,
          duration,
          area
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

export async function likePost(postId: string) {
  try {
    // Update likes count
    const { data: post } = await supabase
      .from('posts')
      .select('likes_count')
      .eq('id', postId)
      .single();
    
    if (!post) return;
    
    const { error } = await supabase
      .from('posts')
      .update({ likes_count: (post.likes_count || 0) + 1 })
      .eq('id', postId);
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Error liking post:', error);
    return false;
  }
}