"use client";

import {
  Bold,
  Code,
  Code2,
  Copy,
  Download,
  Edit,
  FileText,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  Loader2,
  Plus,
  Rss,
  Trash2,
  Video,
  X,
  Youtube,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Post } from "@/lib/posts";
import { getPostImageUrl } from "@/lib/utils";

interface PostFormProps {
  projectId: string;
  initialPost?: Post;
  onSuccess?: () => void;
  onCancel?: () => void;
  redirectPath?: string;
}

export function PostForm({
  projectId,
  initialPost,
  onSuccess,
  onCancel,
  redirectPath,
}: PostFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialPost?.title || "");
  const [content, setContent] = useState(initialPost?.content || "");
  const [image, setImage] = useState(initialPost?.image || "");
  const [previewImage, setPreviewImage] = useState<string | null>(() => {
    // Load existing image URL if editing
    if (initialPost?.image && initialPost?.username) {
      const imageUrl = getPostImageUrl(initialPost.image, initialPost.username);
      return imageUrl || null;
    }
    return null;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isYouTubeDialogOpen, setIsYouTubeDialogOpen] = useState(false);
  const [isVimeoDialogOpen, setIsVimeoDialogOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inlineImageInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingInlineImage, setIsUploadingInlineImage] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      toast.error("Please fill in both title and content");
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading(initialPost ? "Updating post..." : "Creating post...");

    try {
      const { createPost, updatePost } = await import("@/lib/actions/posts");

      if (initialPost) {
        await updatePost(initialPost.id, { title, content, image });
        toast.success("Post updated successfully!", { id: loadingToast });
      } else {
        await createPost(projectId, { title, content, image });
        toast.success("Post created successfully!", { id: loadingToast });
      }

      // Reset form
      setTitle("");
      setContent("");
      setImage("");
      setPreviewImage(null);

      // Call success callback or redirect
      if (onSuccess) {
        onSuccess();
      } else if (redirectPath) {
        router.push(redirectPath);
      }
    } catch (error) {
      console.error(
        "Error saving post:",
        JSON.stringify(
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          null,
          2
        )
      );
      const errorMessage = error instanceof Error ? error.message : "Failed to save post";
      toast.error(errorMessage, { id: loadingToast });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  // Image compression utility
  const compressImage = async (
    file: File,
    maxSizeBytes: number = 900 * 1024, // 900KB to stay under 1MB limit
    scale: number = 1.0
  ): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = async () => {
          // Calculate new dimensions
          const maxWidth = 1920 * scale;
          const maxHeight = 1080 * scale;
          let width = img.width;
          let height = img.height;

          // Scale down if needed
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;
          }

          // Create canvas
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
          }

          // Draw image
          ctx.drawImage(img, 0, 0, width, height);

          // Try different quality levels sequentially
          const tryCompress = async (quality: number): Promise<File | null> => {
            return new Promise<File | null>((resolveQuality) => {
              canvas.toBlob(
                (blob: Blob | null) => {
                  if (blob && blob.size <= maxSizeBytes) {
                    const compressedFile = new File([blob], file.name, {
                      type: "image/jpeg",
                      lastModified: Date.now(),
                    });
                    resolveQuality(compressedFile);
                  } else {
                    resolveQuality(null);
                  }
                },
                "image/jpeg",
                quality
              );
            });
          };

          // Try quality levels from 0.9 down to 0.1
          for (let q = 0.9; q >= 0.1; q -= 0.1) {
            const compressed = await tryCompress(q);
            if (compressed) {
              resolve(compressed);
              return;
            }
          }

          // Fallback: use minimum quality
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                reject(new Error("Failed to compress image"));
              }
            },
            "image/jpeg",
            0.1
          );
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Upload image with compression
    setIsUploadingImage(true);
    const loadingToast = toast.loading("Processing image...");

    try {
      // Try uploading with compression
      let processedFile = file;
      let scale = 1.0;
      let attempt = 0;
      const maxAttempts = 3;

      while (attempt < maxAttempts) {
        try {
          // Compress image
          if (attempt === 0) {
            toast.loading("Compressing image...", { id: loadingToast });
          } else {
            toast.loading(`Scaling down image (attempt ${attempt + 1}/${maxAttempts})...`, {
              id: loadingToast,
            });
          }

          processedFile = await compressImage(processedFile, 900 * 1024, scale);

          // Create preview
          const reader = new FileReader();
          reader.onloadend = () => {
            setPreviewImage(reader.result as string);
          };
          reader.readAsDataURL(processedFile);

          // Upload image
          toast.loading("Uploading image...", { id: loadingToast });
          const { uploadPostImage } = await import("@/lib/actions/posts");
          const formData = new FormData();
          formData.append("image", processedFile);

          const result = await uploadPostImage(formData);

          if (result.success && result.imageFilename) {
            setImage(result.imageFilename);
            // Keep preview image visible after upload - don't clear it
            toast.success("Image uploaded successfully!", { id: loadingToast });
            break;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to upload image";

          // If it's a size error and we haven't tried scaling yet, scale down and retry
          if (
            (errorMessage.includes("Body exceeded") || errorMessage.includes("too large")) &&
            attempt < maxAttempts - 1
          ) {
            scale = scale * 0.5; // Scale down by 50%
            attempt++;
          } else {
            throw error;
          }
        }
      }

      if (attempt >= maxAttempts) {
        throw new Error("Failed to compress image to acceptable size");
      }
    } catch (error) {
      console.error(
        "Error uploading image:",
        JSON.stringify(
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            image,
          },
          null,
          2
        )
      );
      const errorMessage = error instanceof Error ? error.message : "Failed to upload image";
      toast.error(errorMessage, { id: loadingToast });
      setPreviewImage(null);
    } finally {
      setIsUploadingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleInsertInlineImage = () => {
    inlineImageInputRef.current?.click();
  };

  const handleRemoveImage = () => {
    setImage("");
    setPreviewImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleInlineImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Upload image with compression
    setIsUploadingInlineImage(true);
    const loadingToast = toast.loading("Processing image...");

    try {
      // Try uploading with compression
      let processedFile = file;
      let scale = 1.0;
      let attempt = 0;
      const maxAttempts = 3;

      while (attempt < maxAttempts) {
        try {
          // Compress image
          if (attempt === 0) {
            toast.loading("Compressing image...", { id: loadingToast });
          } else {
            toast.loading(`Scaling down image (attempt ${attempt + 1}/${maxAttempts})...`, {
              id: loadingToast,
            });
          }

          processedFile = await compressImage(processedFile, 900 * 1024, scale);

          // Upload image
          toast.loading("Uploading image...", { id: loadingToast });
          const { uploadPostImage } = await import("@/lib/actions/posts");
          const formData = new FormData();
          formData.append("image", processedFile);

          const result = await uploadPostImage(formData);

          if (result.success && result.imageFilename) {
            // Get username from initialPost or fetch it
            let username = initialPost?.username;
            if (!username) {
              // Fetch username from profile
              try {
                const { getOrCreateUserProfile } = await import("@/lib/actions/profiles");
                const profile = await getOrCreateUserProfile();
                username = profile.username;
              } catch (err) {
                console.error(
                  "Error getting username:",
                  JSON.stringify(
                    {
                      error: err instanceof Error ? err.message : String(err),
                    },
                    null,
                    2
                  )
                );
                toast.error("Failed to get username");
                return;
              }
            }

            // Construct image URL
            const imageUrl = getPostImageUrl(result.imageFilename, username);

            // Insert markdown image syntax at cursor position
            const textarea = document.getElementById("post-content") as HTMLTextAreaElement;
            if (textarea) {
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const imageMarkdown = `![${file.name.replace(/\.[^/.]+$/, "")}](${imageUrl})`;
              const newContent =
                content.substring(0, start) + imageMarkdown + content.substring(end);
              setContent(newContent);

              // Focus back on textarea and set cursor position
              setTimeout(() => {
                textarea.focus();
                const newPosition = start + imageMarkdown.length;
                textarea.setSelectionRange(newPosition, newPosition);
              }, 0);
            } else {
              // Fallback: append to end
              const imageMarkdown = `![${file.name.replace(/\.[^/.]+$/, "")}](${imageUrl})`;
              setContent(content + (content ? "\n\n" : "") + imageMarkdown);
            }

            toast.success("Image inserted successfully!", { id: loadingToast });
            break;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to upload image";

          // If it's a size error and we haven't tried scaling yet, scale down and retry
          if (
            (errorMessage.includes("Body exceeded") || errorMessage.includes("too large")) &&
            attempt < maxAttempts - 1
          ) {
            scale = scale * 0.5; // Scale down by 50%
            attempt++;
          } else {
            throw error;
          }
        }
      }

      if (attempt >= maxAttempts) {
        throw new Error("Failed to compress image to acceptable size");
      }
    } catch (error) {
      console.error(
        "Error uploading inline image:",
        JSON.stringify(
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          null,
          2
        )
      );
      const errorMessage = error instanceof Error ? error.message : "Failed to upload image";
      toast.error(errorMessage, { id: loadingToast });
    } finally {
      setIsUploadingInlineImage(false);
      // Reset file input
      if (inlineImageInputRef.current) {
        inlineImageInputRef.current.value = "";
      }
    }
  };

  const extractYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/.*[?&]v=([^&\n?#]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  const extractVimeoId = (url: string): string | null => {
    const patterns = [/(?:vimeo\.com\/)(\d+)/, /(?:player\.vimeo\.com\/video\/)(\d+)/];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  const insertYouTube = () => {
    setIsYouTubeDialogOpen(true);
  };

  const handleYouTubeSubmit = () => {
    if (!videoUrl.trim()) {
      setIsYouTubeDialogOpen(false);
      setVideoUrl("");
      return;
    }

    const videoId = extractYouTubeId(videoUrl);
    if (!videoId) {
      toast.error("Invalid YouTube URL. Please enter a valid YouTube link.");
      return;
    }

    const embedCode = `\n[youtube:${videoId}]\n\n`;

    const textarea = document.getElementById("post-content") as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + embedCode + content.substring(end);
      setContent(newContent);

      // Focus back on textarea and set cursor position
      setTimeout(() => {
        textarea.focus();
        const newPosition = start + embedCode.length;
        textarea.setSelectionRange(newPosition, newPosition);
      }, 0);
    } else {
      setContent(content + embedCode);
    }

    setIsYouTubeDialogOpen(false);
    setVideoUrl("");
  };

  const insertVimeo = () => {
    setIsVimeoDialogOpen(true);
  };

  const handleVimeoSubmit = () => {
    if (!videoUrl.trim()) {
      setIsVimeoDialogOpen(false);
      setVideoUrl("");
      return;
    }

    const videoId = extractVimeoId(videoUrl);
    if (!videoId) {
      toast.error("Invalid Vimeo URL. Please enter a valid Vimeo link.");
      return;
    }

    const embedCode = `\n[vimeo:${videoId}]\n\n`;

    const textarea = document.getElementById("post-content") as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + embedCode + content.substring(end);
      setContent(newContent);

      // Focus back on textarea and set cursor position
      setTimeout(() => {
        textarea.focus();
        const newPosition = start + embedCode.length;
        textarea.setSelectionRange(newPosition, newPosition);
      }, 0);
    } else {
      setContent(content + embedCode);
    }

    setIsVimeoDialogOpen(false);
    setVideoUrl("");
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

  // Markdown formatting helpers
  const insertMarkdown = (before: string, after: string = "") => {
    const textarea = document.getElementById("post-content") as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newText = before + selectedText + after;

    const newContent = content.substring(0, start) + newText + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      const newPosition = start + before.length + selectedText.length + after.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const insertHeading = (level: number) => {
    const heading = "#".repeat(level) + " ";
    insertMarkdown(heading, "");
  };

  const insertBold = () => insertMarkdown("**", "**");
  const insertItalic = () => insertMarkdown("*", "*");
  const insertCode = () => insertMarkdown("`", "`");
  const insertLink = () => {
    setIsLinkDialogOpen(true);
  };

  const handleLinkSubmit = () => {
    if (linkText.trim() && linkUrl.trim()) {
      const textarea = document.getElementById("post-content") as HTMLTextAreaElement;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = content.substring(start, end);
        const linkMarkdown = selectedText
          ? `[${selectedText}](${linkUrl.trim()})`
          : `[${linkText.trim()}](${linkUrl.trim()})`;

        const newContent = content.substring(0, start) + linkMarkdown + content.substring(end);
        setContent(newContent);

        setTimeout(() => {
          textarea.focus();
          const newPosition = start + linkMarkdown.length;
          textarea.setSelectionRange(newPosition, newPosition);
        }, 0);
      }
      setIsLinkDialogOpen(false);
      setLinkText("");
      setLinkUrl("");
    }
  };

  const insertList = () => {
    const textarea = document.getElementById("post-content") as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lines = content.substring(0, start).split("\n");
    const currentLine = lines[lines.length - 1];
    const indent = currentLine.match(/^(\s*)/)?.[1] || "";
    const newContent = content.substring(0, start) + `${indent}- ` + content.substring(start);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + indent.length + 2, start + indent.length + 2);
    }, 0);
  };

  // Export functions
  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand("copy");
          document.body.removeChild(textArea);
          return true;
        } catch (err) {
          document.body.removeChild(textArea);
          return false;
        }
      }
    } catch (err) {
      console.error(
        "Failed to copy to clipboard:",
        JSON.stringify(
          {
            error: err instanceof Error ? err.message : String(err),
          },
          null,
          2
        )
      );
      return false;
    }
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const convertToHTML = async (markdown: string): Promise<string> => {
    const processedContent = renderVideoEmbeds(markdown);
    try {
      const processor = remark().use(remarkGfm).use(remarkHtml);
      const result = await processor.process(processedContent);
      return result.toString();
    } catch (error) {
      console.error(
        "Error converting to HTML:",
        JSON.stringify(
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          null,
          2
        )
      );
      throw error;
    }
  };

  const handleCopyHTML = async () => {
    if (!content.trim()) {
      toast.error("No content to export");
      return;
    }

    try {
      const html = await convertToHTML(content);
      const fullHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    .video-container { position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; margin: 20px 0; }
    .video-container iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${html}
</body>
</html>`;

      const success = await copyToClipboard(fullHTML);
      if (success) {
        toast.success("HTML copied to clipboard!");
      } else {
        toast.error("Failed to copy to clipboard");
      }
    } catch (error) {
      console.error(
        "Error copying HTML:",
        JSON.stringify(
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          null,
          2
        )
      );
      toast.error("Failed to convert to HTML");
    }
  };

  const handleCopyMarkdown = async () => {
    if (!content.trim()) {
      toast.error("No content to export");
      return;
    }

    try {
      const success = await copyToClipboard(content);
      if (success) {
        toast.success("Markdown copied to clipboard!");
      } else {
        toast.error("Failed to copy to clipboard");
      }
    } catch (error) {
      console.error(
        "Error copying markdown:",
        JSON.stringify(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          null,
          2
        )
      );
      toast.error("Failed to copy markdown");
    }
  };

  const handleDownloadHTML = async () => {
    if (!content.trim()) {
      toast.error("No content to export");
      return;
    }

    try {
      const html = await convertToHTML(content);
      const fullHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    .video-container { position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; margin: 20px 0; }
    .video-container iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${html}
</body>
</html>`;

      const filename = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.html`;
      downloadFile(fullHTML, filename, "text/html");
      toast.success("HTML file downloaded!");
    } catch (error) {
      console.error(
        "Error downloading HTML:",
        JSON.stringify(
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          null,
          2
        )
      );
      toast.error("Failed to download HTML");
    }
  };

  const handleDownloadMarkdown = () => {
    if (!content.trim()) {
      toast.error("No content to export");
      return;
    }

    try {
      const filename = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
      downloadFile(content, filename, "text/markdown");
      toast.success("Markdown file downloaded!");
    } catch (error) {
      console.error(
        "Error downloading markdown:",
        JSON.stringify(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          null,
          2
        )
      );
      toast.error("Failed to download markdown");
    }
  };

  const handleExportRSS = async () => {
    if (!content.trim() || !title.trim()) {
      toast.error("Title and content are required for RSS export");
      return;
    }

    try {
      const html = await convertToHTML(content);
      const pubDate = new Date().toUTCString();
      const guid = initialPost?.id || `post-${Date.now()}`;

      const rssItem = `  <item>
    <title><![CDATA[${title}]]></title>
    <description><![CDATA[${html}]]></description>
    <pubDate>${pubDate}</pubDate>
    <guid>${guid}</guid>
  </item>`;

      const success = await copyToClipboard(rssItem);
      if (success) {
        toast.success("RSS item copied to clipboard!");
      } else {
        toast.error("Failed to copy to clipboard");
      }
    } catch (error) {
      console.error(
        "Error exporting RSS:",
        JSON.stringify(
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          null,
          2
        )
      );
      toast.error("Failed to export RSS");
    }
  };

  return (
    <Card className="bg-muted/30 border-border">
      <CardHeader>
        <CardTitle className="text-lg">{initialPost ? "Edit Post" : "Add New Post"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="post-title">Title</Label>
            <Input
              id="post-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title..."
              disabled={isSubmitting}
              className="mt-1"
            />
          </div>
          <div>
            <Label>
              Post Image <span className="text-xs text-muted-foreground">(Optional)</span>
            </Label>
            <div className="mt-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                disabled={isSubmitting || isUploadingImage}
              />
              {(image || previewImage || isUploadingImage) && (
                <div className="mb-2 relative">
                  <div className="relative w-full aspect-video rounded-md overflow-hidden border border-border bg-muted">
                    {isUploadingImage ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : previewImage ? (
                      <img
                        src={previewImage}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback: show error message
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML =
                              '<div class="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Failed to load image</div>';
                          }
                        }}
                      />
                    ) : image ? (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                        Image uploaded successfully
                      </div>
                    ) : null}
                  </div>
                  {!isUploadingImage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveImage}
                      disabled={isSubmitting}
                      className="absolute top-2 right-2 text-destructive bg-white/70 rounded p-0.5! h-auto w-auto!"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={handleImageClick}
                disabled={isSubmitting || isUploadingImage}
                className="w-full"
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                {isUploadingImage ? "Uploading..." : image ? "Change Image" : "Add Image"}
              </Button>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="post-content">Content</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSubmitting || !content.trim()}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleCopyMarkdown}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyHTML}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy HTML
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportRSS}>
                    <Rss className="h-4 w-4 mr-2" />
                    Copy RSS Item
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDownloadMarkdown}>
                    <Code2 className="h-4 w-4 mr-2" />
                    Download Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadHTML}>
                    <FileText className="h-4 w-4 mr-2" />
                    Download HTML
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Tabs defaultValue="edit" className="mt-1">
              <TabsList>
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="edit">
                <div className="border rounded-md">
                  <div className="flex items-center gap-1 p-2 border-b bg-muted/30 flex-wrap">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={insertBold}
                      disabled={isSubmitting}
                      className="h-7 w-7 p-0"
                      title="Bold (Ctrl+B)"
                    >
                      <Bold className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={insertItalic}
                      disabled={isSubmitting}
                      className="h-7 w-7 p-0"
                      title="Italic (Ctrl+I)"
                    >
                      <Italic className="h-4 w-4" />
                    </Button>
                    <div className="w-px h-4 bg-border mx-1" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => insertHeading(2)}
                      disabled={isSubmitting}
                      className="h-7 w-7 p-0"
                      title="Heading 2"
                    >
                      <Heading2 className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => insertHeading(3)}
                      disabled={isSubmitting}
                      className="h-7 w-7 p-0"
                      title="Heading 3"
                    >
                      <Heading3 className="h-4 w-4" />
                    </Button>
                    <div className="w-px h-4 bg-border mx-1" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={insertLink}
                      disabled={isSubmitting}
                      className="h-7 w-7 p-0"
                      title="Insert Link"
                    >
                      <LinkIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={insertCode}
                      disabled={isSubmitting}
                      className="h-7 w-7 p-0"
                      title="Inline Code"
                    >
                      <Code className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={insertList}
                      disabled={isSubmitting}
                      className="h-7 w-7 p-0"
                      title="Bullet List"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <div className="w-px h-4 bg-border mx-1" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleInsertInlineImage}
                      disabled={isSubmitting || isUploadingInlineImage}
                      className="h-7 w-7 p-0"
                      title="Insert Image"
                    >
                      {isUploadingInlineImage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImageIcon className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={insertYouTube}
                      disabled={isSubmitting}
                      className="h-7 px-2 text-xs"
                      title="Add YouTube Video"
                    >
                      <Youtube className="h-3 w-3 mr-1" />
                      YouTube
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={insertVimeo}
                      disabled={isSubmitting}
                      className="h-7 px-2 text-xs"
                      title="Add Vimeo Video"
                    >
                      <Video className="h-3 w-3 mr-1" />
                      Vimeo
                    </Button>
                  </div>
                  <Textarea
                    id="post-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write your post content in Markdown..."
                    rows={12}
                    disabled={isSubmitting}
                    className="font-mono text-sm border-0 rounded-t-none focus-visible:ring-0"
                  />
                </div>
                <input
                  ref={inlineImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleInlineImageChange}
                  className="hidden"
                  disabled={isSubmitting || isUploadingInlineImage}
                />
              </TabsContent>
              <TabsContent value="preview">
                <div className="prose prose-sm max-w-none dark:prose-invert border rounded-md p-4 min-h-[200px] bg-background [&_.video-container]:relative [&_.video-container]:pb-[56.25%] [&_.video-container]:h-0 [&_.video-container]:overflow-hidden [&_.video-container]:my-4 [&_.video-container_iframe]:absolute [&_.video-container_iframe]:top-0 [&_.video-container_iframe]:left-0 [&_.video-container_iframe]:w-full [&_.video-container_iframe]:h-full">
                  {content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                      {renderVideoEmbeds(content)}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground italic">Nothing to preview yet...</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {initialPost ? (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Update Post
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Post
                </>
              )}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>

      {/* YouTube Dialog */}
      <Dialog
        open={isYouTubeDialogOpen}
        onOpenChange={(open) => {
          setIsYouTubeDialogOpen(open);
          if (!open) setVideoUrl("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add YouTube Video</DialogTitle>
            <DialogDescription>
              Enter the YouTube video URL to embed it in your post.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="https://www.youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleYouTubeSubmit();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsYouTubeDialogOpen(false);
                setVideoUrl("");
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleYouTubeSubmit}>
              Add Video
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vimeo Dialog */}
      <Dialog
        open={isVimeoDialogOpen}
        onOpenChange={(open) => {
          setIsVimeoDialogOpen(open);
          if (!open) setVideoUrl("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Vimeo Video</DialogTitle>
            <DialogDescription>
              Enter the Vimeo video URL to embed it in your post.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="https://vimeo.com/..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleVimeoSubmit();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsVimeoDialogOpen(false);
                setVideoUrl("");
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleVimeoSubmit}>
              Add Video
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Dialog */}
      <Dialog
        open={isLinkDialogOpen}
        onOpenChange={(open) => {
          setIsLinkDialogOpen(open);
          if (!open) {
            setLinkText("");
            setLinkUrl("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
            <DialogDescription>
              Add a link to your post. If text is selected, it will be used as the link text.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="link-text">Link Text</Label>
              <Input
                id="link-text"
                placeholder="Link text..."
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                className="mt-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    document.getElementById("link-url")?.focus();
                  }
                }}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="mt-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleLinkSubmit();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsLinkDialogOpen(false);
                setLinkText("");
                setLinkUrl("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleLinkSubmit}
              disabled={!linkText.trim() || !linkUrl.trim()}
            >
              Insert Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
