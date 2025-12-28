"use client";

import {
  Film,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Sparkles,
  Trash2,
  Upload,
  User,
  Video,
  X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { generateThumbnailFromFile } from "@/lib/video-thumbnail";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getImageUrl } from "@/lib/image-utils";
import type { GenerationMode, ReferenceImage, ReferenceImageType, Shot } from "@/lib/scenes-client";
import { uploadFile } from "@/lib/upload-utils";
import type { Character, Location } from "@/components/project-form";

// ============================================================================
// TYPES
// ============================================================================

interface ShotEditorModalProps {
  shot: Shot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (shot: Shot) => void;
  onDelete?: (shotId: string) => void;
  onGenerateVideo: (shot: Shot) => void;
  projectId: string;
  sceneId: string;
  characters?: Character[];
  locations?: Location[];
  username?: string;
  // Scene-specific data for filtering
  sceneCharacters?: string[]; // Character names in this scene
  sceneLocationId?: string; // Location name for this scene
}

// ============================================================================
// GENERATION MODE CONFIG
// ============================================================================

const GENERATION_MODES: { value: GenerationMode; label: string; description: string }[] = [
  {
    value: "text-only",
    label: "Text Prompt",
    description: "Generate video from a text description only",
  },
  {
    value: "start-frame",
    label: "Start Frame",
    description: "Animate from a starting image with a motion prompt",
  },
  {
    value: "start-end-frame",
    label: "Start + End Frames",
    description: "Generate video transitioning between two images",
  },
  {
    value: "reference-images",
    label: "Reference Images",
    description: "Use up to 3 images to guide style and content",
  },
];

interface ImageDropZoneProps {
  label: string;
  imageUrl?: string;
  onImageSelect: (file: File) => void;
  onImageRemove: () => void;
  disabled?: boolean;
}

function ImageDropZone({
  label,
  imageUrl,
  onImageSelect,
  onImageRemove,
  disabled,
}: ImageDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) {
        onImageSelect(file);
      }
    },
    [onImageSelect]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onImageSelect(file);
      }
    },
    [onImageSelect]
  );

  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      {imageUrl ? (
        <div className="relative aspect-video rounded-lg overflow-hidden border border-border group">
          <Image src={imageUrl} alt={label} fill className="object-cover" />
          <button
            type="button"
            onClick={onImageRemove}
            className="absolute top-2 right-2 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity z-10"
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => !disabled && inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            text-center aspect-video px-2 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors
            ${isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"}
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
          <span className="text-xs text-muted-foreground px-4">Drop image or click to upload</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
}

export function ShotEditorModal({
  shot,
  open,
  onOpenChange,
  onSave,
  onDelete,
  onGenerateVideo,
  projectId,
  sceneId,
  characters = [],
  locations = [],
  username = "",
  sceneCharacters = [],
  sceneLocationId,
}: ShotEditorModalProps) {
  // Local state for editing
  const [prompt, setPrompt] = useState(shot?.prompt || "");
  const [sourceType, setSourceType] = useState<"uploaded" | "generated">(
    shot?.sourceType || "generated"
  );
  const [generationMode, setGenerationMode] = useState<GenerationMode>(
    shot?.generationMode || "text-only"
  );
  const [startFrameImage, setStartFrameImage] = useState<string | undefined>(shot?.startFrameImage);
  const [endFrameImage, setEndFrameImage] = useState<string | undefined>(shot?.endFrameImage);
  const [typedReferenceImages, setTypedReferenceImages] = useState<ReferenceImage[]>(
    shot?.typedReferenceImages || []
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVideoDragOver, setIsVideoDragOver] = useState(false);

  // Start frame generation state
  const [startFrameInputMode, setStartFrameInputMode] = useState<"upload" | "generate">("upload");
  const [startFramePrompt, setStartFramePrompt] = useState("");
  const [startFrameReferenceImages, setStartFrameReferenceImages] = useState<ReferenceImage[]>([]);
  const [isGeneratingStartFrame, setIsGeneratingStartFrame] = useState(false);

  // End frame generation state  
  const [endFrameInputMode, setEndFrameInputMode] = useState<"upload" | "generate">("upload");
  const [endFramePrompt, setEndFramePrompt] = useState("");
  const [endFrameReferenceImages, setEndFrameReferenceImages] = useState<ReferenceImage[]>([]);
  const [isGeneratingEndFrame, setIsGeneratingEndFrame] = useState(false);

  const videoInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens or shot changes
  useEffect(() => {
    if (open && shot) {
      setPrompt(shot.prompt || "");
      setSourceType(shot.sourceType || "generated");
      setGenerationMode(shot.generationMode || "text-only");
      setStartFrameImage(shot.startFrameImage);
      setEndFrameImage(shot.endFrameImage);
      setTypedReferenceImages(shot.typedReferenceImages || []);
      // Reset generating state when modal opens to prevent stuck state
      setIsGenerating(false);
      setIsUploading(false);
      setUploadProgress(0);
      // Reset frame generation state
      setStartFrameInputMode("upload");
      setStartFramePrompt("");
      setStartFrameReferenceImages([]);
      setIsGeneratingStartFrame(false);
      setEndFrameInputMode("upload");
      setEndFramePrompt("");
      setEndFrameReferenceImages([]);
      setIsGeneratingEndFrame(false);
    }
  }, [open, shot]);

  // Handle image upload for a specific slot
  // Uses presigned URLs for large images (>5MB), otherwise uses server-side processing for optimization
  const handleImageUpload = async (
    file: File,
    slot: "start" | "end" | "reference",
    refType?: ReferenceImageType
  ) => {
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const result = await uploadFile(file, {
        projectId,
        sceneId,
        mediaType: "image",
        onProgress: setUploadProgress,
      });

      if (result.success && result.url) {
        if (slot === "start") {
          setStartFrameImage(result.url);
        } else if (slot === "end") {
          setEndFrameImage(result.url);
        } else if (slot === "reference" && refType) {
          const newRef: ReferenceImage = {
            url: result.url,
            type: refType,
          };
          setTypedReferenceImages((prev) => [...prev.slice(0, 2), newRef]);
        }
        toast.success("Image uploaded");
      } else {
        toast.error(result.error || "Failed to upload image");
      }
    } catch (error) {
      console.error("[ShotEditorModal] Upload error:", JSON.stringify({ error }, null, 2));
      toast.error("Failed to upload image");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Add a reference image from existing project assets
  const addReferenceImage = (url: string, type: ReferenceImageType, name?: string) => {
    if (typedReferenceImages.length >= 3) {
      toast.error("Maximum 3 reference images allowed");
      return;
    }
    // Check if this image is already added
    if (typedReferenceImages.some((ref) => ref.url === url)) {
      toast.error("This image is already added");
      return;
    }
    const newRef: ReferenceImage = { url, type, name };
    setTypedReferenceImages((prev) => [...prev, newRef]);
  };

  // Remove a typed reference image
  const removeTypedReferenceImage = (index: number) => {
    setTypedReferenceImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Generate a frame image using AI
  const handleGenerateFrameImage = async (frameType: "start" | "end") => {
    const framePrompt = frameType === "start" ? startFramePrompt : endFramePrompt;
    const frameReferenceImages = frameType === "start" ? startFrameReferenceImages : endFrameReferenceImages;
    const setIsGeneratingFrame = frameType === "start" ? setIsGeneratingStartFrame : setIsGeneratingEndFrame;
    const setFrameImage = frameType === "start" ? setStartFrameImage : setEndFrameImage;

    if (!framePrompt.trim()) {
      toast.error("Please enter a prompt for the image");
      return;
    }

    setIsGeneratingFrame(true);

    try {
      const response = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: framePrompt,
          projectId,
          sceneId,
          aspectRatio: "16:9",
          referenceImages: frameReferenceImages.length > 0 
            ? frameReferenceImages.map((ref) => ref.url) 
            : undefined,
        }),
      });

      const data = await response.json();

      if (data.success && data.image?.imageUrl) {
        setFrameImage(data.image.imageUrl);
        toast.success(`${frameType === "start" ? "Start" : "End"} frame generated!`);
      } else {
        toast.error(data.error || "Failed to generate image");
      }
    } catch (error) {
      console.error(
        "[ShotEditorModal] Generate frame error:",
        JSON.stringify({ error, frameType }, null, 2)
      );
      toast.error("Failed to generate image");
    } finally {
      setIsGeneratingFrame(false);
    }
  };

  // Add a reference image for frame generation
  const addFrameReferenceImage = (
    frameType: "start" | "end",
    url: string,
    type: ReferenceImageType,
    name?: string
  ) => {
    const setFrameReferenceImages = frameType === "start" 
      ? setStartFrameReferenceImages 
      : setEndFrameReferenceImages;
    const currentRefs = frameType === "start" 
      ? startFrameReferenceImages 
      : endFrameReferenceImages;

    if (currentRefs.length >= 3) {
      toast.error("Maximum 3 reference images allowed");
      return;
    }
    if (currentRefs.some((ref) => ref.url === url)) {
      toast.error("This image is already added");
      return;
    }
    setFrameReferenceImages((prev) => [...prev, { url, type, name }]);
  };

  // Remove a reference image for frame generation
  const removeFrameReferenceImage = (frameType: "start" | "end", index: number) => {
    const setFrameReferenceImages = frameType === "start" 
      ? setStartFrameReferenceImages 
      : setEndFrameReferenceImages;
    setFrameReferenceImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle video file upload - uses presigned URLs for large files
  const processVideoUpload = useCallback(
    async (file: File) => {
      if (!file || !shot) return;

      setIsUploading(true);
      setUploadProgress(0);

      try {
        const result = await uploadFile(file, {
          projectId,
          sceneId,
          mediaType: "video",
          onProgress: setUploadProgress,
        });

        if (result.success && shot && result.url) {
          console.log(
            "[ShotEditorModal] Video uploaded successfully:",
            JSON.stringify({ 
              shotId: shot.id, 
              videoUrl: result.url,
              projectId,
              sceneId 
            }, null, 2)
          );

          // Generate thumbnail client-side from the original file
          let thumbnailUrl: string | undefined;
          let durationMs = 5000; // Default duration
          try {
            console.log("[ShotEditorModal] Generating thumbnail client-side");
            const thumbnailResult = await generateThumbnailFromFile(file);
            
            if (thumbnailResult.success && thumbnailResult.thumbnailBlob) {
              durationMs = thumbnailResult.durationMs || 5000;
              
              // Upload thumbnail to S3
              const thumbnailFile = new File(
                [thumbnailResult.thumbnailBlob],
                `thumbnail-${shot.id}.jpg`,
                { type: "image/jpeg" }
              );
              
              const thumbnailUploadResult = await uploadFile(thumbnailFile, {
                projectId,
                sceneId,
                mediaType: "image",
              });
              
              if (thumbnailUploadResult.success && thumbnailUploadResult.url) {
                thumbnailUrl = thumbnailUploadResult.url;
                console.log(
                  "[ShotEditorModal] Thumbnail uploaded:",
                  JSON.stringify({ thumbnailUrl, durationMs }, null, 2)
                );
              }
            } else {
              console.log(
                "[ShotEditorModal] Thumbnail generation failed:",
                JSON.stringify({ error: thumbnailResult.error }, null, 2)
              );
            }
          } catch (thumbnailError) {
            console.error(
              "[ShotEditorModal] Error generating thumbnail:",
              JSON.stringify({ error: thumbnailError }, null, 2)
            );
            // Continue without thumbnail - video will still work
          }

          const updatedShot: Shot = {
            ...shot,
            prompt,
            sourceType: "uploaded",
            video: {
              url: result.url,
              status: "completed",
              thumbnailUrl, // Include thumbnail if generated
              durationMs, // Use actual duration from video
            },
            updatedAt: new Date().toISOString(),
          };
          onSave(updatedShot);
          toast.success("Video uploaded");
          onOpenChange(false);
        } else {
          toast.error(result.error || "Failed to upload video");
        }
      } catch (error) {
        console.error("[ShotEditorModal] Video upload error:", JSON.stringify({ error }, null, 2));
        toast.error("Failed to upload video");
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [shot, projectId, sceneId, prompt, onSave, onOpenChange]
  );

  // Handle video upload from file input
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processVideoUpload(file);
      if (e.target) {
        e.target.value = "";
      }
    }
  };

  // Handle video drag and drop
  const handleVideoDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsVideoDragOver(true);
  }, []);

  const handleVideoDragLeave = useCallback(() => {
    setIsVideoDragOver(false);
  }, []);

  const handleVideoDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsVideoDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("video/")) {
        await processVideoUpload(file);
      } else {
        toast.error("Please drop a video file");
      }
    },
    [processVideoUpload]
  );

  // Handle save
  const handleSave = () => {
    if (!shot) return;

    const updatedShot: Shot = {
      ...shot,
      prompt,
      sourceType,
      generationMode,
      startFrameImage,
      endFrameImage,
      typedReferenceImages: typedReferenceImages.length > 0 ? typedReferenceImages : undefined,
      // Also keep referenceImages for backwards compatibility
      referenceImages: typedReferenceImages.length > 0 
        ? typedReferenceImages.map((ref) => ref.url) 
        : undefined,
      updatedAt: new Date().toISOString(),
    };

    onSave(updatedShot);
    onOpenChange(false);
  };

  // Handle generate
  const handleGenerate = () => {
    if (!shot) return;

    // Validate requirements
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    if (generationMode === "start-frame" && !startFrameImage) {
      toast.error("Please upload a start frame image");
      return;
    }

    if (generationMode === "start-end-frame" && (!startFrameImage || !endFrameImage)) {
      toast.error("Please upload both start and end frame images");
      return;
    }

    if (generationMode === "reference-images" && typedReferenceImages.length === 0) {
      toast.error("Please add at least one reference image");
      return;
    }

    const updatedShot: Shot = {
      ...shot,
      prompt,
      sourceType: "generated",
      generationMode,
      startFrameImage,
      endFrameImage,
      typedReferenceImages: typedReferenceImages.length > 0 ? typedReferenceImages : undefined,
      // Also keep referenceImages for backwards compatibility
      referenceImages: typedReferenceImages.length > 0 
        ? typedReferenceImages.map((ref) => ref.url) 
        : undefined,
      video: {
        url: "",
        status: "processing",
      },
      updatedAt: new Date().toISOString(),
    };

    setIsGenerating(true);
    onGenerateVideo(updatedShot);
    // Close modal immediately - generation status is tracked via shot.video.status
    // This prevents the UI from getting stuck in "Generating..." state if API fails
    onOpenChange(false);
  };

  // Handle delete
  const handleDelete = () => {
    if (!shot || !onDelete) return;
    onDelete(shot.id);
    onOpenChange(false);
  };

  if (!shot) return null;

  const isNew = !shot.video?.url;

  // Determine if we need a wider dialog
  const needsWiderDialog = generationMode === "start-frame" || generationMode === "start-end-frame";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-h-[90vh] overflow-y-auto ${needsWiderDialog ? "max-w-4xl" : "max-w-2xl"}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            {isNew ? "Add Shot" : "Edit Shot"}
          </DialogTitle>
          <DialogDescription>
            Configure how this shot will be generated or upload a video directly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Source Type Toggle */}
          <div className="space-y-2">
            <Label>Source</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={sourceType === "generated" ? "default" : "outline"}
                onClick={() => setSourceType("generated")}
                className="flex-1"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate with AI
              </Button>
              <Button
                type="button"
                variant={sourceType === "uploaded" ? "default" : "outline"}
                onClick={() => {
                  // If no video exists, directly open file selector
                  if (!shot.video?.url) {
                    setSourceType("uploaded");
                    videoInputRef.current?.click();
                  } else {
                    setSourceType("uploaded");
                  }
                }}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Video
              </Button>
            </div>
          </div>

          {sourceType === "generated" ? (
            <>
              {/* Generation Mode */}
              <div className="space-y-2 w-full">
                <Label>Generation Mode</Label>
                <Select
                  value={generationMode}
                  onValueChange={(v) => setGenerationMode(v as GenerationMode)}
                >
                  <SelectTrigger className="w-full h-auto! py-3 [&>span]:flex-1 [&>span]:text-center">
                    <SelectValue>
                      <div className="flex flex-col items-center w-full">
                        <div className="font-medium">
                          {GENERATION_MODES.find((m) => m.value === generationMode)?.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {GENERATION_MODES.find((m) => m.value === generationMode)?.description}
                        </div>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {GENERATION_MODES.map((mode) => (
                      <SelectItem
                        key={mode.value}
                        value={mode.value}
                        className="h-auto! py-3 justify-center pl-8"
                      >
                        <div className="flex flex-col items-center text-center">
                          <div className="font-medium">{mode.label}</div>
                          <div className="text-xs">{mode.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Image inputs based on mode */}
              {/* Start Frame Mode */}
              {generationMode === "start-frame" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Start Frame Image</Label>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant={startFrameInputMode === "upload" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStartFrameInputMode("upload")}
                        className="text-xs"
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        Upload
                      </Button>
                      <Button
                        type="button"
                        variant={startFrameInputMode === "generate" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setStartFrameInputMode("generate")}
                        className="text-xs"
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        Generate AI
                      </Button>
                    </div>
                  </div>

                  {startFrameInputMode === "upload" ? (
                    <ImageDropZone
                      label=""
                      imageUrl={startFrameImage}
                      onImageSelect={(file) => handleImageUpload(file, "start")}
                      onImageRemove={() => setStartFrameImage(undefined)}
                      disabled={isUploading}
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {/* Left: Generation Controls */}
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Describe the image</Label>
                          <Textarea
                            value={startFramePrompt}
                            onChange={(e) => setStartFramePrompt(e.target.value)}
                            placeholder="A futuristic office with holographic displays, a man in a suit standing at his desk..."
                            rows={3}
                            className="text-sm"
                          />
                        </div>

                        {/* Reference Images for Generation */}
                        <div className="space-y-2">
                          <Label className="text-xs">Reference Images (optional, {startFrameReferenceImages.length}/3)</Label>
                          {startFrameReferenceImages.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {startFrameReferenceImages.map((ref, idx) => (
                                <div key={idx} className="relative w-12 h-12 rounded overflow-hidden group">
                                  <Image src={ref.url} alt={ref.name || ""} fill className="object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => removeFrameReferenceImage("start", idx)}
                                    className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="h-3 w-3 text-white" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Quick add from project assets */}
                          {startFrameReferenceImages.length < 3 && (
                            <div className="flex flex-wrap gap-1">
                              {/* Scene Location */}
                              {sceneLocationId && locations.find(l => l.name === sceneLocationId)?.image && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const loc = locations.find(l => l.name === sceneLocationId);
                                    if (loc?.image) {
                                      addFrameReferenceImage("start", getImageUrl({ type: "location", filename: loc.image, username }), "location", loc.name);
                                    }
                                  }}
                                  disabled={startFrameReferenceImages.some(r => r.name === sceneLocationId)}
                                  className="text-[10px] px-2 py-1 rounded bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 disabled:opacity-50 flex items-center gap-1"
                                >
                                  <MapPin className="h-2.5 w-2.5" />
                                  {sceneLocationId}
                                </button>
                              )}
                              {/* Scene Characters */}
                              {sceneCharacters.map((charName) => {
                                const char = characters.find(c => c.name === charName);
                                if (!char?.mainImage) return null;
                                return (
                                  <button
                                    key={charName}
                                    type="button"
                                    onClick={() => {
                                      addFrameReferenceImage("start", getImageUrl({ type: "character", filename: char.mainImage!, username }), "character", charName);
                                    }}
                                    disabled={startFrameReferenceImages.some(r => r.name === charName)}
                                    className="text-[10px] px-2 py-1 rounded bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 disabled:opacity-50 flex items-center gap-1"
                                  >
                                    <User className="h-2.5 w-2.5" />
                                    {charName}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <Button
                          type="button"
                          onClick={() => handleGenerateFrameImage("start")}
                          disabled={isGeneratingStartFrame || !startFramePrompt.trim()}
                          className="w-full"
                          size="sm"
                        >
                          {isGeneratingStartFrame ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" />
                              Generate Start Frame
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Right: Preview */}
                      <div className="space-y-2">
                        <Label className="text-xs">Preview</Label>
                        {startFrameImage ? (
                          <div className="relative aspect-video rounded-lg overflow-hidden border border-border group">
                            <Image src={startFrameImage} alt="Start frame" fill className="object-cover" />
                            <button
                              type="button"
                              onClick={() => setStartFrameImage(undefined)}
                              className="absolute top-2 right-2 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="aspect-video rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                            <div className="text-center text-muted-foreground">
                              <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-xs">Generated image will appear here</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Start + End Frame Mode */}
              {generationMode === "start-end-frame" && (
                <div className="grid grid-cols-2 gap-6">
                  {/* Start Frame */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Start Frame</Label>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant={startFrameInputMode === "upload" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setStartFrameInputMode("upload")}
                          className="text-[10px] h-6 px-2"
                        >
                          <Upload className="h-2.5 w-2.5 mr-1" />
                          Upload
                        </Button>
                        <Button
                          type="button"
                          variant={startFrameInputMode === "generate" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setStartFrameInputMode("generate")}
                          className="text-[10px] h-6 px-2"
                        >
                          <Sparkles className="h-2.5 w-2.5 mr-1" />
                          AI
                        </Button>
                      </div>
                    </div>

                    {startFrameInputMode === "upload" ? (
                      <ImageDropZone
                        label=""
                        imageUrl={startFrameImage}
                        onImageSelect={(file) => handleImageUpload(file, "start")}
                        onImageRemove={() => setStartFrameImage(undefined)}
                        disabled={isUploading}
                      />
                    ) : (
                      <div className="space-y-2">
                        <Textarea
                          value={startFramePrompt}
                          onChange={(e) => setStartFramePrompt(e.target.value)}
                          placeholder="Describe the starting image..."
                          rows={2}
                          className="text-xs"
                        />
                        {startFrameImage ? (
                          <div className="relative aspect-video rounded-lg overflow-hidden border border-border group">
                            <Image src={startFrameImage} alt="Start frame" fill className="object-cover" />
                            <button
                              type="button"
                              onClick={() => setStartFrameImage(undefined)}
                              className="absolute top-1 right-1 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            onClick={() => handleGenerateFrameImage("start")}
                            disabled={isGeneratingStartFrame || !startFramePrompt.trim()}
                            className="w-full"
                            size="sm"
                          >
                            {isGeneratingStartFrame ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Sparkles className="h-3 w-3 mr-1" />
                                Generate
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* End Frame */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">End Frame</Label>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant={endFrameInputMode === "upload" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setEndFrameInputMode("upload")}
                          className="text-[10px] h-6 px-2"
                        >
                          <Upload className="h-2.5 w-2.5 mr-1" />
                          Upload
                        </Button>
                        <Button
                          type="button"
                          variant={endFrameInputMode === "generate" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setEndFrameInputMode("generate")}
                          className="text-[10px] h-6 px-2"
                        >
                          <Sparkles className="h-2.5 w-2.5 mr-1" />
                          AI
                        </Button>
                      </div>
                    </div>

                    {endFrameInputMode === "upload" ? (
                      <ImageDropZone
                        label=""
                        imageUrl={endFrameImage}
                        onImageSelect={(file) => handleImageUpload(file, "end")}
                        onImageRemove={() => setEndFrameImage(undefined)}
                        disabled={isUploading}
                      />
                    ) : (
                      <div className="space-y-2">
                        <Textarea
                          value={endFramePrompt}
                          onChange={(e) => setEndFramePrompt(e.target.value)}
                          placeholder="Describe the ending image..."
                          rows={2}
                          className="text-xs"
                        />
                        {endFrameImage ? (
                          <div className="relative aspect-video rounded-lg overflow-hidden border border-border group">
                            <Image src={endFrameImage} alt="End frame" fill className="object-cover" />
                            <button
                              type="button"
                              onClick={() => setEndFrameImage(undefined)}
                              className="absolute top-1 right-1 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            onClick={() => handleGenerateFrameImage("end")}
                            disabled={isGeneratingEndFrame || !endFramePrompt.trim()}
                            className="w-full"
                            size="sm"
                          >
                            {isGeneratingEndFrame ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Sparkles className="h-3 w-3 mr-1" />
                                Generate
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {generationMode === "reference-images" && (
                <div className="space-y-4">
                  {/* Selected Reference Images */}
                  <div className="space-y-2">
                    <Label>Selected Reference Images ({typedReferenceImages.length}/3)</Label>
                    {typedReferenceImages.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {typedReferenceImages.map((ref, index) => (
                          <div
                            key={index}
                            className="relative aspect-video rounded-lg overflow-hidden border border-border group"
                          >
                            <Image
                              src={ref.url}
                              alt={ref.name || `Reference ${index + 1}`}
                              fill
                              className="object-cover"
                            />
                            {/* Type badge */}
                            <div
                              className={`absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 ${
                                ref.type === "location"
                                  ? "bg-blue-500/90 text-white"
                                  : "bg-purple-500/90 text-white"
                              }`}
                            >
                              {ref.type === "location" ? (
                                <MapPin className="h-2.5 w-2.5" />
                              ) : (
                                <User className="h-2.5 w-2.5" />
                              )}
                              {ref.name || ref.type}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeTypedReferenceImage(index)}
                              className="absolute top-1 right-1 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Select location or character images below to add as references
                      </p>
                    )}
                  </div>

                  {/* Scene Location and Character Images */}
                  {typedReferenceImages.length < 3 && (
                    <div className="space-y-4">
                      {/* Scene Location Images */}
                      {(() => {
                        const sceneLocation = sceneLocationId
                          ? locations.find((loc) => loc.name === sceneLocationId && (loc.image || (loc.images && loc.images.length > 0)))
                          : null;
                        
                        if (!sceneLocation) return null;

                        // Collect all location images (main + additional)
                        const allLocationImages: string[] = [];
                        if (sceneLocation.image) {
                          allLocationImages.push(sceneLocation.image);
                        }
                        if (sceneLocation.images) {
                          allLocationImages.push(...sceneLocation.images.filter(Boolean));
                        }

                        if (allLocationImages.length === 0) return null;

                        return (
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 text-blue-500" />
                              Location: {sceneLocation.name}
                            </Label>
                            <div className="flex flex-wrap gap-2">
                              {allLocationImages.map((filename, index) => {
                                const imageUrl = getImageUrl({
                                  type: "location",
                                  filename,
                                  username,
                                });
                                const isSelected = typedReferenceImages.some((ref) => ref.url === imageUrl);
                                return (
                                  <button
                                    key={`${sceneLocation.name}-${index}`}
                                    type="button"
                                    onClick={() =>
                                      addReferenceImage(imageUrl, "location", sceneLocation.name)
                                    }
                                    disabled={isSelected || isUploading}
                                    className={`relative w-28 aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                                      isSelected
                                        ? "border-blue-500 opacity-50 cursor-not-allowed"
                                        : "border-blue-500/50 hover:border-blue-500 cursor-pointer"
                                    }`}
                                  >
                                    <Image
                                      src={imageUrl}
                                      alt={`${sceneLocation.name} ${index + 1}`}
                                      fill
                                      className="object-cover"
                                    />
                                    {isSelected && (
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                        <span className="text-white text-xs font-medium">Added</span>
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Scene Characters Images */}
                      {(() => {
                        const sceneChars = characters.filter(
                          (char) => sceneCharacters.includes(char.name) && (char.mainImage || (char.images && char.images.length > 0))
                        );
                        
                        if (sceneChars.length === 0) return null;

                        return (
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                              <User className="h-3 w-3 text-purple-500" />
                              Characters
                            </Label>
                            <div className="flex flex-wrap gap-2">
                              {sceneChars.flatMap((character) => {
                                // Collect all character images (main + additional)
                                const allCharImages: string[] = [];
                                if (character.mainImage) {
                                  allCharImages.push(character.mainImage);
                                }
                                if (character.images) {
                                  allCharImages.push(...character.images.filter(Boolean));
                                }

                                return allCharImages.map((filename, index) => {
                                  const imageUrl = getImageUrl({
                                    type: "character",
                                    filename,
                                    username,
                                  });
                                  const isSelected = typedReferenceImages.some((ref) => ref.url === imageUrl);
                                  return (
                                    <button
                                      key={`${character.name}-${index}`}
                                      type="button"
                                      onClick={() =>
                                        addReferenceImage(imageUrl, "character", character.name)
                                      }
                                      disabled={isSelected || isUploading}
                                      className={`relative w-28 aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                                        isSelected
                                          ? "border-purple-500 opacity-50 cursor-not-allowed"
                                          : "border-purple-500/50 hover:border-purple-500 cursor-pointer"
                                      }`}
                                    >
                                      <Image
                                        src={imageUrl}
                                        alt={`${character.name} ${index + 1}`}
                                        fill
                                        className="object-cover"
                                      />
                                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                                        <span className="text-[10px] text-white truncate block">
                                          {character.name}
                                        </span>
                                      </div>
                                      {isSelected && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                          <span className="text-white text-xs font-medium">Added</span>
                                        </div>
                                      )}
                                    </button>
                                  );
                                });
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Prompt */}
              <div className="space-y-2">
                <Label htmlFor="shot-prompt">
                  {generationMode === "text-only" ? "Video Description" : "Prompt"}
                </Label>
                <Textarea
                  id="shot-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    generationMode === "text-only"
                      ? "Describe the video you want to generate..."
                      : "Describe how the scene should play out..."
                  }
                  rows={3}
                />
              </div>
            </>
          ) : (
            /* Upload Video */
            <div className="space-y-2">
              <Label>Upload Video</Label>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleVideoUpload}
                className="hidden"
              />
              {shot.video?.url ? (
                <div className="relative aspect-video rounded-lg overflow-hidden border border-border">
                  <video src={shot.video.url} controls className="w-full h-full object-cover" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  onDragOver={handleVideoDragOver}
                  onDragLeave={handleVideoDragLeave}
                  onDrop={handleVideoDrop}
                  disabled={isUploading}
                  className={`
                    w-full aspect-video rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors relative overflow-hidden cursor-pointer
                    ${isVideoDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"}
                    ${isUploading ? "opacity-50 cursor-not-allowed" : ""}
                  `}
                >
                  {isUploading ? (
                    <>
                      {/* Progress bar background */}
                      <div
                        className="absolute inset-0 bg-primary/10 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                      <div className="relative z-10 flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="text-sm font-medium text-primary">
                          Uploading... {uploadProgress}%
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Video className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Drop video or click to upload</span>
                      <span className="text-xs text-muted-foreground">Supports files up to 500MB</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {onDelete && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              className="w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Shot
            </Button>
          )}
          <div className="flex-1" />
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {sourceType === "generated" ? (
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Video
                </>
              )}
            </Button>
          ) : (
            <Button type="button" onClick={handleSave}>
              Save Shot
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ShotEditorModal;
