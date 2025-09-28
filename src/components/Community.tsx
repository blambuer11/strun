import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Heart, 
  MessageCircle, 
  Repeat2, 
  Share2, 
  Image as ImageIcon, 
  MapPin,
  Clock,
  TrendingUp,
  Upload
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

interface Post {
  id: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  content: string;
  image_url?: string;
  location?: string;
  likes: number;
  reposts: number;
  comments: Comment[];
  created_at: string;
  has_liked?: boolean;
  has_reposted?: boolean;
}

interface Comment {
  id: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  content: string;
  created_at: string;
}

export default function Community() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState<{ [key: string]: string }>({});
  const [showComments, setShowComments] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    loadPosts();
    setupRealtimeSubscription();
  }, []);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('community-posts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'community_posts'
        },
        () => {
          loadPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const loadPosts = async () => {
    try {
      // First get posts
      const { data: postsData, error: postsError } = await supabase
        .from('community_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      if (!postsData) {
        setPosts([]);
        return;
      }

      // Get user profiles
      const userIds = [...new Set(postsData.map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);

      // Get likes
      const postIds = postsData.map(p => p.id);
      const { data: likes } = await supabase
        .from('post_likes')
        .select('post_id, user_id')
        .in('post_id', postIds);

      // Get comments
      const { data: comments } = await supabase
        .from('post_comments')
        .select('*')
        .in('post_id', postIds)
        .order('created_at', { ascending: true });

      // Get comment user profiles
      const commentUserIds = [...new Set(comments?.map(c => c.user_id) || [])];
      const { data: commentProfiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', commentUserIds);

      const { data: { user } } = await supabase.auth.getUser();
      const userProfile = user ? await getUserProfile(user.id) : null;

      // Format posts with all related data
      const formattedPosts = postsData.map(post => {
        const profile = profiles?.find(p => p.id === post.user_id);
        const postLikes = likes?.filter(l => l.post_id === post.id) || [];
        const postComments = comments?.filter(c => c.post_id === post.id) || [];

        return {
          id: post.id,
          user_id: post.user_id,
          username: profile?.username || 'Anonymous',
          avatar_url: profile?.avatar_url,
          content: post.content,
          image_url: post.image_url,
          location: post.location,
          likes: post.likes_count || 0,
          reposts: post.reposts_count || 0,
          comments: postComments.map(c => {
            const commentProfile = commentProfiles?.find(p => p.id === c.user_id);
            return {
              id: c.id,
              user_id: c.user_id,
              username: commentProfile?.username || 'Anonymous',
              avatar_url: commentProfile?.avatar_url,
              content: c.content,
              created_at: c.created_at
            };
          }),
          created_at: post.created_at,
          has_liked: postLikes.some(l => l.user_id === userProfile?.id),
          has_reposted: false
        };
      });

      setPosts(formattedPosts);
    } catch (error) {
      console.error('Error loading posts:', error);
      toast.error("Failed to load posts");
    }
  };

  const getUserProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single();
    return data;
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePost = async () => {
    // First check zkLogin authentication 
    const zkLoginAddress = localStorage.getItem("strun_sui_address");
    const zkLoginToken = localStorage.getItem("strun_id_token");
    
    let profileId: string | null = null;
    let authUserId: string | null = null;
    
    // If zkLogin user, find or create profile
    if (zkLoginAddress && zkLoginToken) {
      // Try to find existing profile
      let { data: profile } = await supabase
        .from('profiles')
        .select('id, user_id')
        .eq('wallet_address', zkLoginAddress)
        .single();
      
      // If no profile exists, create one for zkLogin user
      if (!profile) {
        const { data: newProfile, error } = await supabase
          .from('profiles')
          .insert({
            wallet_address: zkLoginAddress,
            username: zkLoginAddress.slice(0, 8),
            email: `${zkLoginAddress}@zklogin.local`,
            user_id: zkLoginAddress, // Use wallet address as user_id for zkLogin users
          })
          .select()
          .single();
          
        if (error) {
          console.error("Error creating profile:", error);
          toast.error("Failed to create profile");
          return;
        }
        profile = newProfile;
      }
      
      if (profile) {
        profileId = profile.id;
        authUserId = profile.user_id || zkLoginAddress;
      }
    }
    
    // Fallback to Supabase auth if not zkLogin
    if (!profileId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please login to post");
        return;
      }
      
      authUserId = user.id;
      const profile = await getUserProfile(user.id);
      if (!profile) {
        toast.error("Profile not found");
        return;
      }
      profileId = profile.id;
    }

    if (!newPost.trim() && !selectedImage) {
      toast.error("Please add some content or an image");
      return;
    }

    setLoading(true);
    try {

      let imageUrl = null;
      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${authUserId}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError, data } = await supabase.storage
          .from('community')
          .upload(fileName, selectedImage);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('community')
          .getPublicUrl(fileName);
        
        imageUrl = publicUrl;
      }

      const { error } = await supabase
        .from('community_posts')
        .insert({
          user_id: profileId,
          content: newPost,
          image_url: imageUrl,
          location: null, // Implement location if needed
          likes_count: 0,
          reposts_count: 0
        });

      if (error) throw error;

      toast.success("Posted successfully!");
      setNewPost("");
      setSelectedImage(null);
      setImagePreview("");
      loadPosts();
    } catch (error: any) {
      console.error('Error posting:', error);
      toast.error(error.message || "Failed to post");
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please login to like");
      return;
    }

    try {
      const profile = await getUserProfile(user.id);
      if (!profile) throw new Error("Profile not found");

      const post = posts.find(p => p.id === postId);
      if (!post) return;

      if (post.has_liked) {
        // Unlike
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', profile.id);

        await supabase
          .from('community_posts')
          .update({ likes_count: Math.max(0, post.likes - 1) })
          .eq('id', postId);
      } else {
        // Like
        await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: profile.id });

        await supabase
          .from('community_posts')
          .update({ likes_count: post.likes + 1 })
          .eq('id', postId);
      }

      loadPosts();
    } catch (error) {
      console.error('Error liking post:', error);
      toast.error("Failed to like post");
    }
  };

  const handleComment = async (postId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please login to comment");
      return;
    }

    const comment = commentText[postId];
    if (!comment?.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    try {
      const profile = await getUserProfile(user.id);
      if (!profile) throw new Error("Profile not found");

      await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: profile.id,
          content: comment
        });

      toast.success("Comment added!");
      setCommentText({ ...commentText, [postId]: "" });
      loadPosts();
    } catch (error) {
      console.error('Error commenting:', error);
      toast.error("Failed to add comment");
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Create Post */}
        <Card className="glass-card backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Share Your Run</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Share your running experience..."
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              rows={3}
              className="resize-none"
            />
            
            {imagePreview && (
              <div className="relative">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="w-full rounded-lg max-h-64 object-cover"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    setSelectedImage(null);
                    setImagePreview("");
                  }}
                >
                  Remove
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  id="image-upload"
                />
                <label htmlFor="image-upload">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <span>
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Add Image
                    </span>
                  </Button>
                </label>
              </div>
              
              <Button
                onClick={handlePost}
                disabled={loading || (!newPost.trim() && !selectedImage)}
                variant="gradient"
              >
                {loading ? "Posting..." : "Post"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Posts Feed */}
        <div className="space-y-4">
          {posts.map((post) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="glass-card backdrop-blur-sm">
                <CardContent className="p-4 space-y-3">
                  {/* Post Header */}
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={post.avatar_url} />
                      <AvatarFallback>
                        {post.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{post.username}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(post.created_at)}
                        </span>
                      </div>
                      {post.location && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {post.location}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Post Content */}
                  <p className="text-foreground whitespace-pre-wrap">{post.content}</p>
                  
                  {post.image_url && (
                    <img 
                      src={post.image_url} 
                      alt="Post" 
                      className="w-full rounded-lg max-h-96 object-cover"
                    />
                  )}

                  {/* Post Actions */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLike(post.id)}
                        className={post.has_liked ? "text-red-500" : ""}
                      >
                        <Heart className={`h-4 w-4 mr-1 ${post.has_liked ? "fill-current" : ""}`} />
                        {post.likes}
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowComments({ ...showComments, [post.id]: !showComments[post.id] })}
                      >
                        <MessageCircle className="h-4 w-4 mr-1" />
                        {post.comments.length}
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled
                      >
                        <Repeat2 className="h-4 w-4 mr-1" />
                        {post.reposts}
                      </Button>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Comments Section */}
                  {showComments[post.id] && (
                    <div className="space-y-3 pt-3 border-t">
                      {post.comments.map((comment) => (
                        <div key={comment.id} className="flex gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={comment.avatar_url} />
                            <AvatarFallback>
                              {comment.username.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="bg-muted rounded-lg p-2">
                              <span className="font-semibold text-sm">{comment.username}</span>
                              <p className="text-sm mt-1">{comment.content}</p>
                            </div>
                            <span className="text-xs text-muted-foreground ml-2">
                              {formatTime(comment.created_at)}
                            </span>
                          </div>
                        </div>
                      ))}
                      
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add a comment..."
                          value={commentText[post.id] || ""}
                          onChange={(e) => setCommentText({ ...commentText, [post.id]: e.target.value })}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleComment(post.id);
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleComment(post.id)}
                        >
                          Post
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {posts.length === 0 && (
          <Card className="glass-card backdrop-blur-sm">
            <CardContent className="text-center py-12">
              <TrendingUp className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground">No posts yet. Be the first to share!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}