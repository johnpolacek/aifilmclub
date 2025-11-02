import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

interface PostContentProps {
  content: string;
  className?: string;
}

/**
 * Renders video embeds from markdown syntax
 * Converts [youtube:VIDEO_ID] and [vimeo:VIDEO_ID] to HTML embeds
 */
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

/**
 * Shared component for rendering post content with consistent styling
 * Matches the spacing and alignment used in post-view.tsx
 */
export function PostContent({ content, className = "" }: PostContentProps) {
  return (
    <div
      className={`prose prose-sm max-w-none dark:prose-invert [&_p]:my-4 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_.video-container]:relative [&_.video-container]:pb-[56.25%] [&_.video-container]:h-0 [&_.video-container]:overflow-hidden [&_.video-container]:my-4 [&_.video-container]:mb-8 [&_.video-container_iframe]:absolute [&_.video-container_iframe]:top-0 [&_.video-container_iframe]:left-0 [&_.video-container_iframe]:w-full [&_.video-container_iframe]:h-full ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {renderVideoEmbeds(content)}
      </ReactMarkdown>
    </div>
  );
}

