"use client";

import {
  Film,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
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
import type { GenerationMode, Shot } from "@/lib/scenes-client";
import { uploadFile } from "@/lib/upload-utils";

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

// ============================================================================
// IMAGE DROP ZONE COMPONENT
// ============================================================================

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
  const [referenceImages, setReferenceImages] = useState<string[]>(shot?.referenceImages || []);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const videoInputRef = useRef<HTMLInputElement>(null);

  // Reset state when shot changes
  const _resetState = useCallback(() => {
    setPrompt(shot?.prompt || "");
    setSourceType(shot?.sourceType || "generated");
    setGenerationMode(shot?.generationMode || "text-only");
    setStartFrameImage(shot?.startFrameImage);
    setEndFrameImage(shot?.endFrameImage);
    setReferenceImages(shot?.referenceImages || []);
  }, [shot]);

  // Handle image upload for a specific slot
  // Uses presigned URLs for large images (>5MB), otherwise uses server-side processing for optimization
  const handleImageUpload = async (file: File, slot: "start" | "end" | "reference") => {
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
        } else if (slot === "reference") {
          setReferenceImages((prev) => [...prev.slice(0, 2), result.url!]);
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

  // Handle video upload - uses presigned URLs for large files
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        const updatedShot: Shot = {
          ...shot,
          prompt,
          sourceType: "uploaded",
          video: {
            url: result.url,
            status: "completed",
            durationMs: 5000, // Default duration, would need video metadata to get actual
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
      if (e.target) {
        e.target.value = "";
      }
    }
  };

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
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
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

    if (generationMode === "reference-images" && referenceImages.length === 0) {
      toast.error("Please upload at least one reference image");
      return;
    }

    const updatedShot: Shot = {
      ...shot,
      prompt,
      sourceType: "generated",
      generationMode,
      startFrameImage,
      endFrameImage,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      video: {
        url: "",
        status: "processing",
      },
      updatedAt: new Date().toISOString(),
    };

    setIsGenerating(true);
    onGenerateVideo(updatedShot);
  };

  // Handle delete
  const handleDelete = () => {
    if (!shot || !onDelete) return;
    onDelete(shot.id);
    onOpenChange(false);
  };

  // Remove reference image
  const removeReferenceImage = (index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  };

  if (!shot) return null;

  const isNew = !shot.video?.url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                onClick={() => setSourceType("uploaded")}
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
              {generationMode === "start-frame" && (
                <ImageDropZone
                  label="Start Frame Image"
                  imageUrl={startFrameImage}
                  onImageSelect={(file) => handleImageUpload(file, "start")}
                  onImageRemove={() => setStartFrameImage(undefined)}
                  disabled={isUploading}
                />
              )}

              {generationMode === "start-end-frame" && (
                <div className="grid grid-cols-2 gap-4">
                  <ImageDropZone
                    label="Start Frame"
                    imageUrl={startFrameImage}
                    onImageSelect={(file) => handleImageUpload(file, "start")}
                    onImageRemove={() => setStartFrameImage(undefined)}
                    disabled={isUploading}
                  />
                  <ImageDropZone
                    label="End Frame"
                    imageUrl={endFrameImage}
                    onImageSelect={(file) => handleImageUpload(file, "end")}
                    onImageRemove={() => setEndFrameImage(undefined)}
                    disabled={isUploading}
                  />
                </div>
              )}

              {generationMode === "reference-images" && (
                <div className="space-y-2">
                  <Label>Reference Images (up to 3)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {referenceImages.map((img, index) => (
                      <div
                        key={index}
                        className="relative aspect-video rounded-lg overflow-hidden border border-border group"
                      >
                        <Image
                          src={img}
                          alt={`Reference ${index + 1}`}
                          fill
                          className="object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeReferenceImage(index)}
                          className="absolute top-1 right-1 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {referenceImages.length < 3 && (
                      <ImageDropZone
                        label=""
                        imageUrl={undefined}
                        onImageSelect={(file) => handleImageUpload(file, "reference")}
                        onImageRemove={() => {}}
                        disabled={isUploading}
                      />
                    )}
                  </div>
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
                  disabled={isUploading}
                  className="w-full aspect-video rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 flex flex-col items-center justify-center gap-2 transition-colors relative overflow-hidden"
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
                      <span className="text-sm text-muted-foreground">Click to upload video</span>
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
