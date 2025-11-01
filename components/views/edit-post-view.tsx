import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PostForm } from "@/components/post-form";
import type { Post } from "@/lib/posts";

interface EditPostViewProps {
  projectId: string;
  post: Post | null;
}

export function EditPostView({ projectId, post }: EditPostViewProps) {
  if (!post) {
    return (
      <div className="min-h-screen bg-background pt-24 pb-16">
        <div className="container mx-auto px-4 lg:px-8 max-w-3xl">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-primary mb-6 hover:opacity-80 transition-opacity"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-semibold">Back to Dashboard</span>
          </Link>
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-2">Post Not Found</h2>
            <p className="text-muted-foreground">
              The post you&apos;re looking for doesn&apos;t exist.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <div className="container mx-auto px-4 lg:px-8 max-w-3xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-primary mb-6 hover:opacity-80 transition-opacity"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm font-semibold">Back to Dashboard</span>
        </Link>

        <PostForm projectId={projectId} initialPost={post} redirectPath="/dashboard" />
      </div>
    </div>
  );
}
