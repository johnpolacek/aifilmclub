"use client";

import {
  Camera,
  Check,
  File,
  Film,
  LinkIcon,
  MapPin,
  Plus,
  Upload,
  User,
  Wrench,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type React from "react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getCharacterImageUrl, getLocationImageUrl, getThumbnailUrl } from "@/lib/utils";

// Types
export interface ProjectLinks {
  links: Array<{ label: string; url: string }>;
}

export type ToolCategory = "image" | "video" | "sound" | "other";

export interface CategorizedTool {
  name: string;
  category: ToolCategory;
}

export interface Character {
  name: string;
  description: string;
  type?: "Main Character" | "Protagonist" | "Supporting";
  image?: string; // filename only, similar to thumbnail
}

export interface Location {
  name: string;
  description: string;
  image?: string; // filename only
}

export interface ProjectFile {
  name: string; // Display name (e.g., "Screenplay.pdf")
  filename: string; // S3 filename (e.g., "1761873619145-screenplay.pdf")
  size?: number; // File size in bytes
  type?: string; // MIME type (e.g., "application/pdf")
}

export interface ProjectFormData {
  title: string;
  description: string;
  status: "In Progress" | "Completed";
  duration: string;
  genre: string;
  characters?: Character[];
  setting?: {
    locations?: Location[];
  };
  thumbnail?: string;
  links: ProjectLinks;
  tools: CategorizedTool[];
  screenplay?: ProjectFile;
  username?: string;
  slug?: string;
}

// Common tools by category
const COMMON_TOOLS = {
  image: [
    "Midjourney",
    "DALL-E",
    "Stable Diffusion",
    "Leonardo AI",
    "Ideogram",
    "Flux",
    "Adobe Firefly",
    "Other",
  ],
  video: [
    "Runway Gen-3",
    "Google Veo",
    "Pika Labs",
    "Kling AI",
    "Luma Dream Machine",
    "HaiperAI",
    "Sora",
    "Other",
  ],
  sound: ["ElevenLabs", "Suno", "Udio", "Mubert", "AIVA", "Soundraw", "Other"],
  other: [
    "Adobe After Effects",
    "Adobe Premiere Pro",
    "Adobe Photoshop",
    "Adobe Illustrator",
    "DaVinci Resolve",
    "Final Cut Pro",
    "Avid Media Composer",
    "Blender",
    "Cinema 4D",
    "Maya",
    "Adobe Audition",
    "Pro Tools",
    "Logic Pro",
    "Ableton Live",
    "Other",
  ],
} as const;

// Helper function to infer label from URL
function inferLabelFromUrl(url: string): string {
  const urlLower = url.toLowerCase();

  if (urlLower.includes("youtube.com") || urlLower.includes("youtu.be")) return "YouTube";
  if (urlLower.includes("vimeo.com")) return "Vimeo";
  if (urlLower.includes("x.com") || urlLower.includes("twitter.com")) return "X (Twitter)";
  if (urlLower.includes("instagram.com")) return "Instagram";
  if (urlLower.includes("tiktok.com")) return "TikTok";
  if (urlLower.includes("facebook.com")) return "Facebook";
  if (urlLower.includes("linkedin.com")) return "LinkedIn";

  // For other URLs, try to extract domain name
  try {
    const domain = new URL(url).hostname.replace("www.", "");
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch {
    return "Website";
  }
}

interface ProjectFormProps {
  initialData?: Partial<ProjectFormData>;
  projectId?: string;
  isEditing?: boolean;
  redirectPath?: string;
}

export default function ProjectForm({
  initialData,
  projectId,
  isEditing = false,
  redirectPath = "/dashboard",
}: ProjectFormProps) {
  const router = useRouter();
  const genreSelectId = useId();
  const durationSelectId = useId();
  const characterTypeSelectIds = useRef<Record<number, string>>({});

  // Helper to migrate old link format to new format
  const migrateLinks = (links?: ProjectLinks | Record<string, unknown>): ProjectLinks => {
    if (!links) return { links: [] };

    // If already in new format
    if ("links" in links && Array.isArray(links.links)) return links as ProjectLinks;

    // Migrate from old format
    const migratedLinks: Array<{ label: string; url: string }> = [];
    const oldLinks = links as Record<string, unknown>;

    if (typeof oldLinks.youtube === "string")
      migratedLinks.push({ label: "YouTube", url: oldLinks.youtube });
    if (typeof oldLinks.vimeo === "string")
      migratedLinks.push({ label: "Vimeo", url: oldLinks.vimeo });
    if (typeof oldLinks.x === "string")
      migratedLinks.push({ label: "X (Twitter)", url: oldLinks.x });
    if (typeof oldLinks.instagram === "string")
      migratedLinks.push({ label: "Instagram", url: oldLinks.instagram });
    if (typeof oldLinks.website === "string")
      migratedLinks.push({ label: "Website", url: oldLinks.website });
    if (Array.isArray(oldLinks.custom))
      migratedLinks.push(...(oldLinks.custom as Array<{ label: string; url: string }>));

    return { links: migratedLinks };
  };

  // Helper to migrate old tools format (string[]) to new format (CategorizedTool[])
  const migrateTools = (tools?: CategorizedTool[] | string[]): CategorizedTool[] => {
    if (!tools || tools.length === 0) return [];

    // If already in new format (has category property)
    if (typeof tools[0] === "object" && "category" in tools[0]) {
      return tools as CategorizedTool[];
    }

    // Migrate from old format (string array) - categorize as "other"
    return (tools as string[]).map((name) => ({ name, category: "other" as ToolCategory }));
  };

  // Helper to migrate old characters format (string) to new format (Character[])
  const migrateCharacters = (characters?: Character[] | string): Character[] => {
    if (!characters) return [];

    // If already in new format (array of Character objects)
    if (
      Array.isArray(characters) &&
      characters.length > 0 &&
      typeof characters[0] === "object" &&
      "name" in characters[0]
    ) {
      return characters as Character[];
    }

    // Migrate from old format (string) - return empty array (can't convert string to structured data)
    return [];
  };

  const [formData, setFormData] = useState<ProjectFormData>({
    title: initialData?.title || "",
    description: initialData?.description || "",
    status: (initialData?.status as ProjectFormData["status"]) || "In Progress",
    duration: initialData?.duration || "",
    genre: initialData?.genre || "",
    characters: migrateCharacters(initialData?.characters),
    setting: initialData?.setting || { locations: [] },
    thumbnail: initialData?.thumbnail,
    links: migrateLinks(initialData?.links),
    tools: migrateTools(initialData?.tools),
    screenplay: initialData?.screenplay || (initialData as any)?.files?.[0], // Migrate old files array to screenplay
    username: initialData?.username,
    slug: initialData?.slug,
  });

  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [selectedTool, setSelectedTool] = useState<Record<ToolCategory, string>>({
    video: "",
    image: "",
    sound: "",
    other: "",
  });
  const [customToolInput, setCustomToolInput] = useState<Record<ToolCategory, string>>({
    video: "",
    image: "",
    sound: "",
    other: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const characterFileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const locationFileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [uploadingCharacterIndex, setUploadingCharacterIndex] = useState<number | null>(null);
  const [uploadingLocationIndex, setUploadingLocationIndex] = useState<number | null>(null);
  const [characterPreviewImages, setCharacterPreviewImages] = useState<Record<number, string>>({});
  const [locationPreviewImages, setLocationPreviewImages] = useState<Record<number, string>>({});
  const [hasVideoTool, setHasVideoTool] = useState(() => {
    const tools = migrateTools(initialData?.tools);
    return tools.some((tool) => tool.category === "video");
  });
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that at least one video tool is added
    if (!hasVideoTool) {
      toast.error("Please add at least one Video Generation tool");
      return;
    }

    setIsSubmitting(true);

    // Show loading toast
    const loadingToast = toast.loading(isEditing ? "Updating project..." : "Creating project...");

    try {
      // Generate slug for new projects
      if (!isEditing && formData.title) {
        const slug = formData.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        formData.slug = slug;
      }

      // Import and call the Server Action
      const { submitProjectForm } = await import("@/lib/actions/projects");

      // This will handle both create and update, plus authentication
      const result = await submitProjectForm(formData, projectId, redirectPath);

      // If there's an error result (not a redirect), show it
      if (result && !result.success) {
        throw new Error(result.error || "Failed to save project");
      }

      // Dismiss loading and show success
      toast.success(isEditing ? "Project updated successfully!" : "Project created successfully!", {
        id: loadingToast,
      });

      // If we get here and didn't redirect, navigate manually
      // (though submitProjectForm should redirect on success)
      router.push(redirectPath);
    } catch (error) {
      // Check if this is a Next.js redirect error - if so, let it propagate
      if (error && typeof error === "object" && "digest" in error) {
        const errorDigest = String(error.digest || "");
        if (errorDigest.includes("NEXT_REDIRECT")) {
          // Re-throw redirect errors to let Next.js handle them
          // Don't reset submitting state here as redirect will navigate away
          throw error;
        }
      }

      console.error("Error submitting project:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save project. Please try again.";

      // Dismiss loading and show error
      toast.error(errorMessage, {
        id: loadingToast,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push(redirectPath);
  };

  const addLink = () => {
    if (newLinkUrl.trim()) {
      const label = inferLabelFromUrl(newLinkUrl);
      setFormData({
        ...formData,
        links: {
          links: [...formData.links.links, { label, url: newLinkUrl.trim() }],
        },
      });
      setNewLinkUrl("");
    }
  };

  const removeLink = (index: number) => {
    setFormData({
      ...formData,
      links: {
        links: formData.links.links.filter((_, i) => i !== index),
      },
    });
  };

  const addTool = (category: ToolCategory, toolName?: string) => {
    const nameToAdd =
      toolName ||
      (selectedTool[category] === "Other"
        ? customToolInput[category].trim()
        : selectedTool[category]);

    if (nameToAdd) {
      const newTools = [...formData.tools, { name: nameToAdd, category }];
      setFormData({
        ...formData,
        tools: newTools,
      });

      // Reset the inputs
      if (selectedTool[category] === "Other") {
        setCustomToolInput({ ...customToolInput, [category]: "" });
      }
      setSelectedTool({ ...selectedTool, [category]: "" });

      // Update video tool tracker
      if (category === "video") {
        setHasVideoTool(true);
      }
    }
  };

  const removeTool = (index: number) => {
    const toolToRemove = formData.tools[index];
    const newTools = formData.tools.filter((_, i) => i !== index);

    setFormData({
      ...formData,
      tools: newTools,
    });

    // Update video tool tracker if we removed a video tool
    if (toolToRemove.category === "video") {
      setHasVideoTool(newTools.some((tool) => tool.category === "video"));
    }
  };

  const getToolsByCategory = (category: ToolCategory) => {
    return formData.tools.filter((tool) => tool.category === category);
  };

  const getCategoryLabel = (category: ToolCategory): string => {
    const labels = {
      image: "Image Generation",
      video: "Video Generation",
      sound: "Sound Generation",
      other: "Multimedia",
    };
    return labels[category];
  };

  const addCharacter = () => {
    const newIndex = (formData.characters || []).length;
    // Generate ID for the new character's type select
    characterTypeSelectIds.current[newIndex] = `character-type-${newIndex}-${Date.now()}`;
    const newCharacters = [
      ...(formData.characters || []),
      { name: "", description: "", type: undefined as Character["type"] },
    ];
    setFormData({
      ...formData,
      characters: newCharacters,
    });
  };

  const removeCharacter = (index: number) => {
    const newCharacters = formData.characters?.filter((_, i) => i !== index) || [];
    setFormData({
      ...formData,
      characters: newCharacters,
    });
    // Clean up preview image and ref
    const newPreviews = { ...characterPreviewImages };
    delete newPreviews[index];
    setCharacterPreviewImages(newPreviews);
  };

  const updateCharacter = (
    index: number,
    field: keyof Character,
    value: string | Character["type"]
  ) => {
    const newCharacters = [...(formData.characters || [])];
    newCharacters[index] = { ...newCharacters[index], [field]: value };
    setFormData({
      ...formData,
      characters: newCharacters,
    });
  };

  const handleCharacterImageClick = (index: number) => {
    characterFileInputRefs.current[index]?.click();
  };

  const handleCharacterImageChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate raw file size (max 20MB - we'll compress it)
    const maxRawSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxRawSize) {
      toast.error("Image must be less than 20MB");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setCharacterPreviewImages({
        ...characterPreviewImages,
        [index]: reader.result as string,
      });
    };
    reader.readAsDataURL(file);

    // Compress and upload image
    setUploadingCharacterIndex(index);
    const loadingToast = toast.loading("Compressing image...");

    try {
      // Compress image client-side (16:9 aspect ratio for character images, max 1920x1080, full width display)
      const compressedFile = await compressImage(file, 1920, 1080, 0.85, 16 / 9);

      // Validate compressed size (max 2MB)
      const maxCompressedSize = 2 * 1024 * 1024; // 2MB
      if (compressedFile.size > maxCompressedSize) {
        toast.error("Compressed image is still too large. Please try a smaller image.", {
          id: loadingToast,
        });
        setUploadingCharacterIndex(null);
        return;
      }

      toast.loading("Uploading character image...", { id: loadingToast });

      const { uploadCharacterImage } = await import("@/lib/actions/projects");
      const uploadFormData = new FormData();
      uploadFormData.append("image", compressedFile);

      const result = await uploadCharacterImage(uploadFormData);

      if (result.success && result.imageFilename) {
        const newCharacters = [...(formData.characters || [])];
        newCharacters[index] = { ...newCharacters[index], image: result.imageFilename };
        setFormData({
          ...formData,
          characters: newCharacters,
        });
        setCharacterPreviewImages({
          ...characterPreviewImages,
          [index]: "",
        });
        toast.success("Character image uploaded successfully!", {
          id: loadingToast,
        });
      }
    } catch (error) {
      console.error("Error uploading character image:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to upload character image";
      toast.error(errorMessage, {
        id: loadingToast,
      });
      setCharacterPreviewImages({
        ...characterPreviewImages,
        [index]: "",
      });
    } finally {
      setUploadingCharacterIndex(null);
      // Reset file input
      if (characterFileInputRefs.current[index]) {
        characterFileInputRefs.current[index]!.value = "";
      }
    }
  };

  const addLocation = () => {
    const newLocations = [...(formData.setting?.locations || []), { name: "", description: "" }];
    setFormData({
      ...formData,
      setting: {
        ...formData.setting,
        locations: newLocations,
      },
    });
  };

  const removeLocation = (index: number) => {
    const newLocations = (formData.setting?.locations || []).filter((_, i) => i !== index);
    setFormData({
      ...formData,
      setting: {
        ...formData.setting,
        locations: newLocations,
      },
    });
    // Clean up preview image and ref
    const newPreviews = { ...locationPreviewImages };
    delete newPreviews[index];
    setLocationPreviewImages(newPreviews);
  };

  const updateLocation = (index: number, field: keyof Location, value: string) => {
    const newLocations = [...(formData.setting?.locations || [])];
    newLocations[index] = { ...newLocations[index], [field]: value };
    setFormData({
      ...formData,
      setting: {
        ...formData.setting,
        locations: newLocations,
      },
    });
  };

  const handleLocationImageClick = (index: number) => {
    locationFileInputRefs.current[index]?.click();
  };

  const handleLocationImageChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate raw file size (max 20MB - we'll compress it)
    const maxRawSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxRawSize) {
      toast.error("Image must be less than 20MB");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLocationPreviewImages({
        ...locationPreviewImages,
        [index]: reader.result as string,
      });
    };
    reader.readAsDataURL(file);

    // Compress and upload image
    setUploadingLocationIndex(index);
    const loadingToast = toast.loading("Compressing image...");

    try {
      // Compress image client-side (16:9 aspect ratio for location images, max 1920x1080)
      const compressedFile = await compressImage(file, 1920, 1080, 0.85, 16 / 9);

      // Validate compressed size (max 2MB)
      const maxCompressedSize = 2 * 1024 * 1024; // 2MB
      if (compressedFile.size > maxCompressedSize) {
        toast.error("Compressed image is still too large. Please try a smaller image.", {
          id: loadingToast,
        });
        setUploadingLocationIndex(null);
        return;
      }

      toast.loading("Uploading location image...", { id: loadingToast });

      const { uploadLocationImage } = await import("@/lib/actions/projects");
      const uploadFormData = new FormData();
      uploadFormData.append("image", compressedFile);

      const result = await uploadLocationImage(uploadFormData);

      if (result.success && result.imageFilename) {
        const newLocations = [...(formData.setting?.locations || [])];
        newLocations[index] = { ...newLocations[index], image: result.imageFilename };
        setFormData({
          ...formData,
          setting: {
            ...formData.setting,
            locations: newLocations,
          },
        });
        setLocationPreviewImages({
          ...locationPreviewImages,
          [index]: "",
        });
        toast.success("Location image uploaded successfully!", {
          id: loadingToast,
        });
      }
    } catch (error) {
      console.error("Error uploading location image:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to upload location image";
      toast.error(errorMessage, {
        id: loadingToast,
      });
      setLocationPreviewImages({
        ...locationPreviewImages,
        [index]: "",
      });
    } finally {
      setUploadingLocationIndex(null);
      // Reset file input
      if (locationFileInputRefs.current[index]) {
        locationFileInputRefs.current[index]!.value = "";
      }
    }
  };

  const handleProjectFileClick = () => {
    projectFileInputRef.current?.click();
  };

  const handleProjectFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (PDF only)
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a PDF file");
      return;
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast.error("File must be less than 50MB");
      return;
    }

    setIsUploadingFile(true);
    const loadingToast = toast.loading("Uploading screenplay...");

    try {
      const { uploadProjectFile } = await import("@/lib/actions/projects");
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);

      const result = await uploadProjectFile(uploadFormData);

      if (result.success && result.filename) {
        setFormData({
          ...formData,
          screenplay: {
            name: result.originalName,
            filename: result.filename,
            size: result.size,
            type: result.type,
          },
        });
        toast.success("Screenplay uploaded successfully!", {
          id: loadingToast,
        });
      }
    } catch (error) {
      console.error("Error uploading screenplay:", JSON.stringify(error, null, 2));
      const errorMessage = error instanceof Error ? error.message : "Failed to upload screenplay";
      toast.error(errorMessage, {
        id: loadingToast,
      });
    } finally {
      setIsUploadingFile(false);
      // Reset file input
      if (projectFileInputRef.current) {
        projectFileInputRef.current.value = "";
      }
    }
  };

  const removeScreenplay = () => {
    setFormData({
      ...formData,
      screenplay: undefined,
    });
  };

  // Compress image client-side before upload
  const compressImage = (
    file: File,
    maxWidth: number = 1920,
    maxHeight: number = 1080,
    quality: number = 0.85,
    targetAspect?: number
  ): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement("img");
        img.onload = () => {
          // Calculate new dimensions maintaining aspect ratio
          let width = img.width;
          let height = img.height;

          // Resize if needed
          if (width > maxWidth || height > maxHeight) {
            const aspectRatio = width / height;
            if (width > height) {
              width = Math.min(width, maxWidth);
              height = width / aspectRatio;
            } else {
              height = Math.min(height, maxHeight);
              width = height * aspectRatio;
            }
          }

          // Crop to target aspect ratio if provided
          if (targetAspect !== undefined) {
            const currentAspect = width / height;

            if (Math.abs(currentAspect - targetAspect) > 0.01) {
              if (currentAspect > targetAspect) {
                // Image is wider, crop horizontally
                width = height * targetAspect;
              } else {
                // Image is taller, crop vertically
                height = width / targetAspect;
              }
            }
          }

          // Create canvas and draw resized image
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob and then to File
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Failed to compress image"));
                return;
              }

              // Create a new File with compressed data
              const compressedFile = new globalThis.File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });

              resolve(compressedFile);
            },
            "image/jpeg",
            quality
          );
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate raw file size (max 20MB - we'll compress it)
    const maxRawSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxRawSize) {
      toast.error("Image must be less than 20MB");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Compress and upload image
    setIsUploadingImage(true);
    const loadingToast = toast.loading("Compressing image...");

    try {
      // Compress image client-side (16:9 aspect ratio, max 1920x1080)
      const compressedFile = await compressImage(file, 1920, 1080, 0.85, 16 / 9);

      // Validate compressed size (max 2MB - should be well under this after compression)
      const maxCompressedSize = 2 * 1024 * 1024; // 2MB
      if (compressedFile.size > maxCompressedSize) {
        toast.error("Compressed image is still too large. Please try a smaller image.", {
          id: loadingToast,
        });
        setIsUploadingImage(false);
        return;
      }

      toast.loading("Uploading thumbnail...", { id: loadingToast });

      const { uploadProjectThumbnail } = await import("@/lib/actions/projects");
      const uploadFormData = new FormData();
      uploadFormData.append("image", compressedFile);

      const result = await uploadProjectThumbnail(uploadFormData);

      if (result.success && result.thumbnailFilename) {
        setFormData({
          ...formData,
          thumbnail: result.thumbnailFilename,
        });
        setPreviewImage(null);
        toast.success("Thumbnail uploaded successfully!", {
          id: loadingToast,
        });
      }
    } catch (error) {
      console.error("Error uploading thumbnail:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to upload thumbnail";
      toast.error(errorMessage, {
        id: loadingToast,
      });
      setPreviewImage(null);
    } finally {
      setIsUploadingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            {isEditing ? "Edit Project" : "Create New Project"}
          </CardTitle>
          <CardDescription>
            {isEditing
              ? "Update your project details"
              : "Add a new AI film project to your portfolio"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Project Title *</Label>
            <Input
              id="title"
              placeholder="Enter your project title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="bg-background"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe your AI film project, its themes, and creative vision..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={6}
              className="bg-background resize-none"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Project Status *</Label>
            <ToggleGroup
              type="single"
              value={formData.status}
              onValueChange={(value) => {
                if (value) {
                  setFormData({ ...formData, status: value as ProjectFormData["status"] });
                }
              }}
              variant="outline"
              spacing={0}
              className="w-full justify-start"
            >
              <ToggleGroupItem
                value="In Progress"
                className="flex-1 transition-all ease-in-out data-[state=off]:cursor-pointer data-[state=off]:hover:bg-white data-[state=off]:hover:text-black data-[state=on]:bg-foreground data-[state=on]:text-background"
              >
                {formData.status === "In Progress" && <Check className="h-4 w-4 mr-2" />}
                In Progress
              </ToggleGroupItem>
              <ToggleGroupItem
                value="Completed"
                className="flex-1 transition-all ease-in-out data-[state=off]:cursor-pointer data-[state=off]:hover:bg-white data-[state=off]:hover:text-black data-[state=on]:bg-foreground data-[state=on]:text-background"
              >
                {formData.status === "Completed" && <Check className="h-4 w-4 mr-2" />}
                Completed
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="genre">Genre</Label>
              <Select
                value={formData.genre}
                onValueChange={(value) => setFormData({ ...formData, genre: value })}
              >
                <SelectTrigger className="w-full bg-background" id={genreSelectId}>
                  <SelectValue placeholder="Select genre..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Action">Action</SelectItem>
                  <SelectItem value="Animation">Animation</SelectItem>
                  <SelectItem value="Comedy">Comedy</SelectItem>
                  <SelectItem value="Documentary">Documentary</SelectItem>
                  <SelectItem value="Drama">Drama</SelectItem>
                  <SelectItem value="Fantasy">Fantasy</SelectItem>
                  <SelectItem value="Horror">Horror</SelectItem>
                  <SelectItem value="Romance">Romance</SelectItem>
                  <SelectItem value="Sci-Fi">Sci-Fi</SelectItem>
                  <SelectItem value="Thriller">Thriller</SelectItem>
                  <SelectItem value="Experimental">Experimental</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Select
                value={formData.duration}
                onValueChange={(value) => setFormData({ ...formData, duration: value })}
              >
                <SelectTrigger className="w-full bg-background" id={durationSelectId}>
                  <SelectValue placeholder="Select duration..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Short (< 5 min)">Short (&lt; 5 min)</SelectItem>
                  <SelectItem value="Medium (5-20 min)">Medium (5-20 min)</SelectItem>
                  <SelectItem value="Long (20-50 min)">Long (20-50 min)</SelectItem>
                  <SelectItem value="Feature (50+ min)">Feature (50+ min)</SelectItem>
                  <SelectItem value="Series/Episode">Series / Episodic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="thumbnail">Project Image</Label>
            <div className="space-y-4">
              {/* Thumbnail Preview */}
              <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border bg-muted/30">
                {previewImage || formData.thumbnail ? (
                  <Image
                    src={previewImage || getThumbnailUrl(formData.thumbnail, formData.username)}
                    alt="Project image"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"></div>
                )}
                {/* Upload overlay */}
                <button
                  type="button"
                  onClick={handleImageClick}
                  disabled={isUploadingImage}
                  className="group absolute inset-0 flex items-center justify-center bg-black/60 opacity-50 hover:opacity-100 transition-all duration-300 cursor-pointer disabled:cursor-not-allowed"
                  aria-label="Upload project image"
                >
                  {isUploadingImage ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Camera className="h-8 w-8 text-white" />
                      <span className="text-sm text-white font-medium">
                        {formData.thumbnail ? "Change Image" : "Upload Image"}
                      </span>
                    </div>
                  )}
                </button>
              </div>

              {/* Upload Button */}
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleImageClick}
                  disabled={isUploadingImage}
                  className="bg-transparent"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploadingImage
                    ? "Uploading..."
                    : formData.thumbnail
                      ? "Change Image"
                      : "Upload Image"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {formData.thumbnail ? "Image uploaded" : "No image selected"}
                </span>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                disabled={isUploadingImage}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Characters</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Add characters to your project with images, names, and descriptions
            </p>

            <div className="space-y-4">
              {(formData.characters || []).map((character, index) => {
                // Generate ID for this character's type select if not already generated
                if (!characterTypeSelectIds.current[index]) {
                  characterTypeSelectIds.current[index] = `character-type-${index}-${Date.now()}`;
                }
                const typeSelectId = characterTypeSelectIds.current[index]!;
                return (
                  <Card key={index} className="bg-muted/30 border-border">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-start justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCharacter(index)}
                          className="text-destructive hover:text-destructive h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Character Name */}
                      <div className="space-y-2">
                        <Label htmlFor={`character-name-${index}`}>Name</Label>
                        <Input
                          id={`character-name-${index}`}
                          placeholder="Enter character name"
                          value={character.name}
                          onChange={(e) => updateCharacter(index, "name", e.target.value)}
                          className="bg-background"
                        />
                      </div>

                      {/* Character Type */}
                      <div className="space-y-2">
                        <Label htmlFor={typeSelectId}>Type</Label>
                        <Select
                          value={character.type || ""}
                          onValueChange={(value) => {
                            if (value) {
                              updateCharacter(index, "type", value as Character["type"]);
                            }
                          }}
                        >
                          <SelectTrigger className="w-full bg-background" id={typeSelectId}>
                            <SelectValue placeholder="Select character type..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Main Character">Main Character</SelectItem>
                            <SelectItem value="Protagonist">Protagonist</SelectItem>
                            <SelectItem value="Supporting">Supporting</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Character Image - Full Width */}
                      <div className="space-y-2">
                        <Label>Character Image</Label>
                        <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border bg-muted/30">
                          {characterPreviewImages[index] ||
                          (character.image && formData.username) ? (
                            <Image
                              src={
                                characterPreviewImages[index] ||
                                getCharacterImageUrl(character.image, formData.username) ||
                                ""
                              }
                              alt={character.name || "Character"}
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <User className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCharacterImageClick(index)}
                            disabled={uploadingCharacterIndex === index}
                            className="group absolute inset-0 flex items-center justify-center bg-black/60 opacity-50 hover:opacity-100 transition-all duration-300 cursor-pointer disabled:cursor-not-allowed"
                            aria-label="Upload character image"
                          >
                            {uploadingCharacterIndex === index ? (
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                            ) : (
                              <Camera className="h-8 w-8 text-white" />
                            )}
                          </button>
                        </div>
                        <input
                          ref={(el) => {
                            characterFileInputRefs.current[index] = el;
                          }}
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleCharacterImageChange(e, index)}
                          className="hidden"
                          disabled={uploadingCharacterIndex === index}
                        />
                      </div>

                      {/* Character Description */}
                      <div className="space-y-2">
                        <Label htmlFor={`character-description-${index}`}>Description</Label>
                        <Textarea
                          id={`character-description-${index}`}
                          placeholder="Describe this character..."
                          value={character.description}
                          onChange={(e) => updateCharacter(index, "description", e.target.value)}
                          rows={3}
                          className="bg-background resize-none"
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              <Button
                type="button"
                variant="outline"
                onClick={addCharacter}
                className="w-full bg-transparent"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Character
              </Button>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Setting</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Add locations to your project setting with optional images and descriptions
            </p>

            <div className="space-y-4">
              {(formData.setting?.locations || []).map((location, index) => (
                <Card key={index} className="bg-muted/30 border-border">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-start justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLocation(index)}
                        className="text-destructive hover:text-destructive h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Location Name */}
                    <div className="space-y-2">
                      <Label htmlFor={`location-name-${index}`}>Name</Label>
                      <Input
                        id={`location-name-${index}`}
                        placeholder="Enter location name"
                        value={location.name}
                        onChange={(e) => updateLocation(index, "name", e.target.value)}
                        className="bg-background"
                      />
                    </div>

                    {/* Location Image - Optional, Full Width */}
                    <div className="space-y-2">
                      <Label>Location Image (Optional)</Label>
                      <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border bg-muted/30">
                        {locationPreviewImages[index] || (location.image && formData.username) ? (
                          <Image
                            src={
                              locationPreviewImages[index] ||
                              getLocationImageUrl(location.image, formData.username) ||
                              ""
                            }
                            alt={location.name || "Location"}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <MapPin className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleLocationImageClick(index)}
                          disabled={uploadingLocationIndex === index}
                          className="group absolute inset-0 flex items-center justify-center bg-black/60 opacity-50 hover:opacity-100 transition-all duration-300 cursor-pointer disabled:cursor-not-allowed"
                          aria-label="Upload location image"
                        >
                          {uploadingLocationIndex === index ? (
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                          ) : (
                            <Camera className="h-8 w-8 text-white" />
                          )}
                        </button>
                      </div>
                      <input
                        ref={(el) => {
                          locationFileInputRefs.current[index] = el;
                        }}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleLocationImageChange(e, index)}
                        className="hidden"
                        disabled={uploadingLocationIndex === index}
                      />
                    </div>

                    {/* Location Description */}
                    <div className="space-y-2">
                      <Label htmlFor={`location-description-${index}`}>Description</Label>
                      <Textarea
                        id={`location-description-${index}`}
                        placeholder="Describe this location..."
                        value={location.description}
                        onChange={(e) => updateLocation(index, "description", e.target.value)}
                        rows={3}
                        className="bg-background resize-none"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={addLocation}
                className="w-full bg-transparent"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Location
              </Button>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Project Links</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Add links to your project (YouTube, Vimeo, Instagram, etc.)
            </p>

            <div className="space-y-3">
              {formData.links.links.map((link, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-muted/30 rounded-md">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{link.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLink(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <div className="flex gap-2">
                <Input
                  placeholder="Enter URL (e.g., https://youtube.com/watch?v=...)"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addLink();
                    }
                  }}
                  className="bg-background"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addLink}
                  className="bg-transparent"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Tools</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Add the tools you used, organized by category
            </p>

            {/* Add tools by category */}
            <div className="space-y-4">
              {(["video", "image", "sound", "other"] as ToolCategory[]).map((category) => {
                const toolsInCategory = getToolsByCategory(category);
                return (
                  <div key={category} className="space-y-2">
                    <Label htmlFor={`tool-${category}`}>
                      {getCategoryLabel(category)}
                      {category === "video" && !hasVideoTool && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </Label>
                    {/* Display added tools for this category */}
                    {toolsInCategory.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {toolsInCategory.map((tool, index) => {
                          const globalIndex = formData.tools.indexOf(tool);
                          return (
                            <div
                              key={`${category}-${index}`}
                              className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm"
                            >
                              <span>{tool.name}</span>
                              <button
                                type="button"
                                onClick={() => removeTool(globalIndex)}
                                className="hover:text-primary/70 transition-colors"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Select
                        value={selectedTool[category]}
                        onValueChange={(value) => {
                          setSelectedTool({ ...selectedTool, [category]: value });
                          if (value !== "Other") {
                            // Auto-add tool when selected (not "Other")
                            addTool(category, value);
                          } else {
                            setCustomToolInput({ ...customToolInput, [category]: "" });
                          }
                        }}
                        key={`tool-select-${category}`}
                      >
                        <SelectTrigger className="w-full bg-background">
                          <SelectValue
                            placeholder={`Add ${getCategoryLabel(category).toLowerCase()} tool...`}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {COMMON_TOOLS[category].map((tool) => (
                            <SelectItem key={tool} value={tool}>
                              {tool}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedTool[category] === "Other" && (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Enter custom tool"
                            value={customToolInput[category]}
                            onChange={(e) =>
                              setCustomToolInput({ ...customToolInput, [category]: e.target.value })
                            }
                            onKeyPress={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addTool(category);
                              }
                            }}
                            className="flex-1 bg-background"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => addTool(category)}
                            disabled={!customToolInput[category].trim()}
                            className="bg-transparent"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {category === "video" && !hasVideoTool && (
                      <p className="text-xs text-destructive pb-2">
                        * At least one Video Generation tool is required
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <File className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Screenplay / Script</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Upload a PDF of your screenplay or script
            </p>

            <div className="space-y-3">
              {/* Display uploaded screenplay */}
              {formData.screenplay && (
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-md">
                  <File className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{formData.screenplay.name}</p>
                    {formData.screenplay.size && (
                      <p className="text-xs text-muted-foreground">
                        {(formData.screenplay.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeScreenplay}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Upload button */}
              <Button
                type="button"
                variant="outline"
                onClick={handleProjectFileClick}
                disabled={isUploadingFile}
                className="w-full bg-transparent"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploadingFile
                  ? "Uploading..."
                  : formData.screenplay
                    ? "Replace Screenplay"
                    : "Upload Screenplay"}
              </Button>

              {/* Hidden file input */}
              <input
                ref={projectFileInputRef}
                type="file"
                onChange={handleProjectFileChange}
                className="hidden"
                disabled={isUploadingFile}
                accept=".pdf,application/pdf"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create Project"}
            </Button>
            <Button
              type="button"
              onClick={handleCancel}
              variant="outline"
              className="flex-1 bg-transparent"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
