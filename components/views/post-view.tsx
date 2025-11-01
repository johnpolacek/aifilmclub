import { Calendar, Clock, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import type { ProjectFormData } from "@/components/project-form";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { EditPostButton } from "@/components/views/edit-post-button";
import type { Post } from "@/lib/posts";
import type { UserProfile } from "@/lib/profiles";
import { getPostImageUrl } from "@/lib/utils";

interface PostViewProps {
  post: Post;
  project: ProjectFormData & { username: string };
  creatorProfile: UserProfile | null;
  username: string;
  projectSlug: string;
}

export function PostView({ post, project, creatorProfile, username, projectSlug }: PostViewProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const renderVideoEmbeds = (content: string): string => {
    // Replace [youtube:VIDEO_ID] with HTML embed
    content = content.replace(
      /\[youtube:([^\]]+)\]/g,
      '<div class="video-container"><iframe width="100%" height="315" src="https://www.youtube.com/embed/$1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>'
    );

    // Replace [vimeo:VIDEO_ID] with HTML embed
    content = content.replace(
      /\[vimeo:([^\]]+)\]/g,
      '<div class="video-container"><iframe src="https://player.vimeo.com/video/$1" width="100%" height="315" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>'
    );

    return content;
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
        {/* Project Header */}
        <div className="mb-6 pb-6 border-b border-border">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl md:text-2xl font-bold">{project.title}</h2>
            {project.status && (
              <span className="px-2 py-0.5 bg-primary/20 text-primary rounded-full text-xs font-medium">
                {project.status}
              </span>
            )}
            {project.genre && (
              <span className="px-2 py-0.5 bg-muted/50 rounded-full text-xs">{project.genre}</span>
            )}
            {project.duration && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{project.duration}</span>
              </div>
            )}
            <Link
              href={`/${username}/${projectSlug}`}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors shrink-0 ml-auto"
            >
              <span>View Project</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="mb-6">
          {/* Post Title */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-3xl md:text-4xl font-bold text-pretty">{post.title}</h1>
            <EditPostButton projectId={post.projectId} postId={post.id} ownerUsername={username} />
          </div>

          {/* Post Meta */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              {creatorProfile?.avatar ? (
                <Image
                  src={creatorProfile.avatar}
                  alt={creatorProfile.name || username}
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <ImagePlaceholder variant="avatar" className="h-6 w-6" />
              )}
              <span className="font-medium">{creatorProfile?.name || username}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(post.createdAt)}</span>
              {post.updatedAt && post.updatedAt !== post.createdAt && (
                <span className="text-xs ml-1">(updated {formatDate(post.updatedAt)})</span>
              )}
            </div>
          </div>
        </div>

        {/* Post Image */}
        {post.image && post.username && (
          <div className="mb-6 rounded-md overflow-hidden border border-border">
            <Image
              src={getPostImageUrl(post.image, post.username)}
              alt={post.title}
              width={800}
              height={400}
              className="w-full h-auto object-contain"
            />
          </div>
        )}

        {/* Post Content */}
        <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:my-4 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_.video-container]:relative [&_.video-container]:pb-[56.25%] [&_.video-container]:h-0 [&_.video-container]:overflow-hidden [&_.video-container]:my-4 [&_.video-container]:mb-8 [&_.video-container_iframe]:absolute [&_.video-container_iframe]:top-0 [&_.video-container_iframe]:left-0 [&_.video-container_iframe]:w-full [&_.video-container_iframe]:h-full">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {renderVideoEmbeds(post.content)}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
