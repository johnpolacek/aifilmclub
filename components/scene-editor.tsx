"use client";

import {
  Edit,
  Film,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ExtractConfirmDialog } from "@/components/extract-confirm-dialog";
import type { Character, Location } from "@/components/project-form";
import { ScreenplayElementComponent } from "@/components/screenplay-element";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { GeneratedImage, GeneratedVideo, Scene } from "@/lib/scenes-client";
import { elementsToText, parseScreenplayToElements } from "@/lib/screenplay-parser";
import type { ScreenplayElement, ScreenplayElementType } from "@/lib/types/screenplay";
import { createScreenplayElement, ELEMENT_TYPE_LABELS } from "@/lib/types/screenplay";
import { uploadFile } from "@/lib/upload-utils";

interface SceneEditorProps {
  scene: Scene;
  characters: Character[];
  onSave: (scene: Scene) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function SceneEditor({ scene, characters, onSave, onCancel, onDelete }: SceneEditorProps) {
  const [editedScene, setEditedScene] = useState<Scene>(scene);
  const [isSaving, setIsSaving] = useState(false);

  // Screenplay editing state - structured elements
  const [isEditingScreenplay, setIsEditingScreenplay] = useState(false);
  const [screenplayElements, setScreenplayElements] = useState<ScreenplayElement[]>([]);
  const [focusedElementIndex, setFocusedElementIndex] = useState(0);
  const elementRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  const handleScreenplayEdit = () => {
    // Parse the plain text screenplay into structured elements
    const elements = editedScene.screenplay
      ? parseScreenplayToElements(editedScene.screenplay)
      : [createScreenplayElement("action", "")];
    setScreenplayElements(elements.length > 0 ? elements : [createScreenplayElement("action", "")]);
    setFocusedElementIndex(0);
    setIsEditingScreenplay(true);
  };

  const handleScreenplaySave = () => {
    // Convert structured elements back to plain text
    const plainText = elementsToText(screenplayElements);
    setEditedScene({ ...editedScene, screenplay: plainText });
    setIsEditingScreenplay(false);
  };

  const handleScreenplayCancel = () => {
    setScreenplayElements([]);
    setIsEditingScreenplay(false);
  };

  // Handle element content change
  const handleElementChange = useCallback((id: string, content: string) => {
    setScreenplayElements((prev) => prev.map((el) => (el.id === id ? { ...el, content } : el)));
  }, []);

  // Handle element type change
  const handleElementTypeChange = useCallback((id: string, type: ScreenplayElementType) => {
    setScreenplayElements((prev) => prev.map((el) => (el.id === id ? { ...el, type } : el)));
  }, []);

  // Delete element
  const handleElementDelete = useCallback((id: string) => {
    setScreenplayElements((prev) => {
      const index = prev.findIndex((el) => el.id === id);
      const filtered = prev.filter((el) => el.id !== id);
      if (filtered.length === 0) {
        return [createScreenplayElement("action", "")];
      }
      if (index > 0) {
        setFocusedElementIndex(index - 1);
      } else {
        setFocusedElementIndex(0);
      }
      return filtered;
    });
  }, []);

  // Insert new element after index
  const handleElementInsertAfter = useCallback((index: number, type: ScreenplayElementType) => {
    const newElement = createScreenplayElement(type, "");
    setScreenplayElements((prev) => {
      const updated = [...prev];
      updated.splice(index + 1, 0, newElement);
      return updated;
    });
    setFocusedElementIndex(index + 1);
  }, []);

  // Determine next element type based on current type
  const getNextType = useCallback((currentType: ScreenplayElementType): ScreenplayElementType => {
    switch (currentType) {
      case "scene_heading":
        return "action";
      case "action":
        return "action";
      case "character":
        return "dialogue";
      case "parenthetical":
        return "dialogue";
      case "dialogue":
        return "character";
      case "transition":
        return "scene_heading";
      default:
        return "action";
    }
  }, []);

  // Handle keyboard navigation
  const handleElementKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const currentElement = screenplayElements[index];
      const target = e.target as HTMLTextAreaElement;
      const cursorAtStart = target.selectionStart === 0 && target.selectionEnd === 0;
      const cursorAtEnd = target.selectionStart === currentElement.content.length;

      // Enter: Create new element after current
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const nextType = getNextType(currentElement.type);
        handleElementInsertAfter(index, nextType);
        return;
      }

      // Backspace on empty element: Delete and focus previous
      if (e.key === "Backspace" && currentElement.content === "" && screenplayElements.length > 1) {
        e.preventDefault();
        handleElementDelete(currentElement.id);
        return;
      }

      // Tab on empty element: Change element type cyclically
      if (e.key === "Tab" && !e.shiftKey && currentElement.content === "") {
        e.preventDefault();
        const types: ScreenplayElementType[] = [
          "scene_heading",
          "action",
          "character",
          "dialogue",
          "parenthetical",
          "transition",
        ];
        const currentIndex = types.indexOf(currentElement.type);
        const nextIndex = (currentIndex + 1) % types.length;
        handleElementTypeChange(currentElement.id, types[nextIndex]);
        return;
      }

      // Tab with content: Move to next element
      if (e.key === "Tab" && !e.shiftKey && currentElement.content !== "") {
        if (index < screenplayElements.length - 1) {
          e.preventDefault();
          setFocusedElementIndex(index + 1);
        }
        return;
      }

      // Shift+Tab: Move to previous element
      if (e.key === "Tab" && e.shiftKey) {
        if (index > 0) {
          e.preventDefault();
          setFocusedElementIndex(index - 1);
        }
        return;
      }

      // Arrow Down at end of content: Move to next element
      if (e.key === "ArrowDown" && cursorAtEnd) {
        if (index < screenplayElements.length - 1) {
          e.preventDefault();
          setFocusedElementIndex(index + 1);
        }
        return;
      }

      // Arrow Up at start of content: Move to previous element
      if (e.key === "ArrowUp" && cursorAtStart) {
        if (index > 0) {
          e.preventDefault();
          setFocusedElementIndex(index - 1);
        }
        return;
      }
    },
    [
      screenplayElements,
      handleElementDelete,
      handleElementInsertAfter,
      handleElementTypeChange,
      getNextType,
    ]
  );

  // Add new element at the end
  const handleAddElement = (type: ScreenplayElementType) => {
    const newElement = createScreenplayElement(type, "");
    setScreenplayElements((prev) => [...prev, newElement]);
    setFocusedElementIndex(screenplayElements.length);
  };

  // Register element ref
  const registerElementRef = useCallback((id: string, ref: HTMLTextAreaElement | null) => {
    if (ref) {
      elementRefs.current.set(id, ref);
    } else {
      elementRefs.current.delete(id);
    }
  }, []);

  // Image generation state
  const [imagePrompt, setImagePrompt] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Image upload state
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Video generation state
  const [videoPrompt, setVideoPrompt] = useState("");
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [pendingVideos, setPendingVideos] = useState<Map<string, string>>(new Map()); // videoId -> operationId

  // Video upload state
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Poll for video completion
  useEffect(() => {
    if (pendingVideos.size === 0) return;

    const pollInterval = setInterval(async () => {
      for (const [videoId, operationId] of pendingVideos.entries()) {
        try {
          const response = await fetch(
            `/api/ai/video-status?operationId=${encodeURIComponent(operationId)}&projectId=${editedScene.projectId}&sceneId=${editedScene.id}&videoId=${videoId}`
          );
          const data = await response.json();

          if (data.success) {
            if (data.status === "completed" && data.videoUrl) {
              // Update the video in the scene
              setEditedScene((prev) => ({
                ...prev,
                generatedVideos: (prev.generatedVideos ?? []).map((v) =>
                  v.id === videoId
                    ? {
                        ...v,
                        status: "completed" as const,
                        videoUrl: data.videoUrl,
                        completedAt: new Date().toISOString(),
                      }
                    : v
                ),
              }));
              // Remove from pending
              setPendingVideos((prev) => {
                const next = new Map(prev);
                next.delete(videoId);
                return next;
              });
              toast.success("Video generation completed!");
            } else if (data.status === "failed") {
              // Update the video status to failed
              setEditedScene((prev) => ({
                ...prev,
                generatedVideos: (prev.generatedVideos ?? []).map((v) =>
                  v.id === videoId ? { ...v, status: "failed" as const, error: data.error } : v
                ),
              }));
              // Remove from pending
              setPendingVideos((prev) => {
                const next = new Map(prev);
                next.delete(videoId);
                return next;
              });
              toast.error("Video generation failed");
            }
          }
        } catch (error) {
          console.error(
            "[SceneEditor] Error polling video status:",
            JSON.stringify({ videoId, error }, null, 2)
          );
        }
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [pendingVideos, editedScene.projectId, editedScene.id]);

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) {
      toast.error("Please enter a prompt for image generation");
      return;
    }

    setIsGeneratingImage(true);
    const loadingToast = toast.loading("Generating image...");

    try {
      const response = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: imagePrompt,
          projectId: editedScene.projectId,
          sceneId: editedScene.id,
          aspectRatio: "16:9",
        }),
      });

      const data = await response.json();

      if (data.success && data.image) {
        setEditedScene((prev) => ({
          ...prev,
          generatedImages: [...(prev.generatedImages ?? []), data.image as GeneratedImage],
        }));
        setImagePrompt("");
        toast.success("Image generated successfully!", { id: loadingToast });
      } else {
        toast.error(data.error || "Failed to generate image", { id: loadingToast });
      }
    } catch (error) {
      console.error("[SceneEditor] Error generating image:", JSON.stringify({ error }, null, 2));
      toast.error("Failed to generate image", { id: loadingToast });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!videoPrompt.trim()) {
      toast.error("Please enter a prompt for video generation");
      return;
    }

    setIsGeneratingVideo(true);
    const loadingToast = toast.loading("Starting video generation...");

    try {
      const response = await fetch("/api/ai/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: videoPrompt,
          projectId: editedScene.projectId,
          sceneId: editedScene.id,
          aspectRatio: "16:9",
          durationSeconds: 5,
        }),
      });

      const data = await response.json();

      if (data.success && data.video) {
        const newVideo: GeneratedVideo = {
          id: data.video.id,
          prompt: videoPrompt,
          videoUrl: "",
          model: "veo-2",
          status: "processing",
          createdAt: new Date().toISOString(),
        };

        setEditedScene((prev) => ({
          ...prev,
          generatedVideos: [...(prev.generatedVideos ?? []), newVideo],
        }));

        // Add to pending videos for polling
        setPendingVideos((prev) => {
          const next = new Map(prev);
          next.set(data.video.id, data.video.operationId);
          return next;
        });

        setVideoPrompt("");
        toast.success("Video generation started! This may take a few minutes.", {
          id: loadingToast,
        });
      } else {
        toast.error(data.error || "Failed to start video generation", { id: loadingToast });
      }
    } catch (error) {
      console.error("[SceneEditor] Error generating video:", JSON.stringify({ error }, null, 2));
      toast.error("Failed to start video generation", { id: loadingToast });
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    const loadingToast = toast.loading("Uploading image...");

    try {
      const result = await uploadFile(file, {
        projectId: editedScene.projectId,
        sceneId: editedScene.id,
        mediaType: "image",
      });

      if (result.success && result.url) {
        const newImage: GeneratedImage = {
          id: result.mediaId || `uploaded-${Date.now()}`,
          prompt: `Uploaded: ${file.name}`,
          imageUrl: result.url,
          model: "other",
          createdAt: new Date().toISOString(),
        };
        setEditedScene((prev) => ({
          ...prev,
          generatedImages: [...(prev.generatedImages ?? []), newImage],
        }));
        toast.success("Image uploaded successfully!", { id: loadingToast });
      } else {
        toast.error(result.error || "Failed to upload image", { id: loadingToast });
      }
    } catch (error) {
      console.error("[SceneEditor] Error uploading image:", JSON.stringify({ error }, null, 2));
      toast.error("Failed to upload image", { id: loadingToast });
    } finally {
      setIsUploadingImage(false);
      if (e.target) {
        e.target.value = "";
      }
    }
  };

  const handleUploadVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingVideo(true);
    const loadingToast = toast.loading("Uploading video...");

    try {
      const result = await uploadFile(file, {
        projectId: editedScene.projectId,
        sceneId: editedScene.id,
        mediaType: "video",
        onProgress: (percent) => {
          // Update toast with progress for large files
          if (file.size > 5 * 1024 * 1024) {
            toast.loading(`Uploading video... ${percent}%`, { id: loadingToast });
          }
        },
      });

      if (result.success && result.url) {
        const newVideo: GeneratedVideo = {
          id: result.mediaId || `uploaded-${Date.now()}`,
          prompt: `Uploaded: ${file.name}`,
          videoUrl: result.url,
          model: "other",
          status: "completed",
          createdAt: new Date().toISOString(),
        };
        setEditedScene((prev) => ({
          ...prev,
          generatedVideos: [...(prev.generatedVideos ?? []), newVideo],
        }));
        toast.success("Video uploaded successfully!", { id: loadingToast });
      } else {
        toast.error(result.error || "Failed to upload video", { id: loadingToast });
      }
    } catch (error) {
      console.error("[SceneEditor] Error uploading video:", JSON.stringify({ error }, null, 2));
      toast.error("Failed to upload video", { id: loadingToast });
    } finally {
      setIsUploadingVideo(false);
      if (e.target) {
        e.target.value = "";
      }
    }
  };

  const handleSave = async () => {
    if (!editedScene.title.trim()) {
      toast.error("Scene title is required");
      return;
    }

    setIsSaving(true);
    try {
      const updatedScene = {
        ...editedScene,
        updatedAt: new Date().toISOString(),
      };
      onSave(updatedScene);
    } finally {
      setIsSaving(false);
    }
  };

  const _toggleCharacter = (characterName: string) => {
    const currentCharacters = editedScene.characters || [];
    const isSelected = currentCharacters.includes(characterName);

    setEditedScene({
      ...editedScene,
      characters: isSelected
        ? currentCharacters.filter((c) => c !== characterName)
        : [...currentCharacters, characterName],
    });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Film className="h-5 w-5 text-primary" />
          {scene.id ? "Edit Scene" : "New Scene"}
        </CardTitle>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Scene Title */}
        <div className="space-y-2">
          <Label htmlFor="scene-title">Scene Title *</Label>
          <Input
            id="scene-title"
            placeholder="Enter scene title (e.g., 'Opening - City Street')"
            value={editedScene.title}
            onChange={(e) => setEditedScene({ ...editedScene, title: e.target.value })}
            className="bg-background"
          />
        </div>

        {/* Screenplay Text */}
        <div className="space-y-2">
          <Label htmlFor="scene-screenplay">Screenplay</Label>

          {isEditingScreenplay ? (
            <div className="space-y-3">
              {/* Structured Element Editor */}
              <div className="rounded-md border border-input bg-background overflow-hidden">
                {/* Elements */}
                <div className="py-2 font-mono text-sm leading-relaxed max-h-[400px] overflow-y-auto">
                  {screenplayElements.map((element, index) => {
                    const prevElement = index > 0 ? screenplayElements[index - 1] : null;
                    const needsExtraSpacing =
                      element.type === "action" && prevElement?.type === "dialogue";

                    return (
                      <ScreenplayElementComponent
                        key={element.id}
                        element={element}
                        index={index}
                        isFocused={focusedElementIndex === index}
                        onFocus={setFocusedElementIndex}
                        onChange={handleElementChange}
                        onTypeChange={handleElementTypeChange}
                        onKeyDown={handleElementKeyDown}
                        onDelete={handleElementDelete}
                        onInsertAfter={handleElementInsertAfter}
                        extraTopSpacing={needsExtraSpacing}
                        ref={(ref) => registerElementRef(element.id, ref)}
                      />
                    );
                  })}
                </div>

                {/* Add element buttons */}
                <div className="border-t border-border p-2 flex flex-wrap gap-1.5 bg-muted/30">
                  <span className="text-xs text-muted-foreground self-center mr-1">Add:</span>
                  {(
                    [
                      "scene_heading",
                      "action",
                      "character",
                      "dialogue",
                      "parenthetical",
                      "transition",
                    ] as ScreenplayElementType[]
                  ).map((type) => (
                    <Button
                      key={type}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAddElement(type)}
                      className="h-6 px-2 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {ELEMENT_TYPE_LABELS[type]}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Enter for new line • Tab to change type • Click type label to change
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleScreenplayCancel}
                    className="bg-transparent"
                  >
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={handleScreenplaySave}>
                    Done
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleScreenplayEdit}
              className="w-full rounded-md border border-input bg-background px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors group text-left"
            >
              {editedScene.screenplay ? (
                <div className="flex items-start gap-2">
                  <p
                    className="flex-1 font-mono text-sm text-muted-foreground line-clamp-2"
                    style={{
                      fontFamily:
                        "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
                    }}
                  >
                    {editedScene.screenplay.replace(/\n+/g, " ").trim()}
                  </p>
                  <Edit className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                </div>
              ) : (
                <div className="flex items-center gap-2 py-1">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    Add screenplay text...
                  </p>
                </div>
              )}
            </button>
          )}
        </div>

        {/* Characters in Scene */}
        {characters.length > 0 && editedScene.characters.length > 0 && (
          <div className="space-y-2">
            <Label>Characters in this Scene</Label>
            <div className="flex flex-wrap gap-2">
              {characters
                .filter((character) => editedScene.characters.includes(character.name))
                .map((character) => {
                  return (
                    <div
                      key={character.name}
                      className="px-3 py-1.5 rounded-md text-sm font-medium bg-muted text-muted-foreground"
                    >
                      {character.name}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Image Generation & Upload */}
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            <Label className="text-base font-semibold">Images</Label>
          </div>

          {/* Upload Image */}
          <div className="flex gap-2">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleUploadImage}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => imageInputRef.current?.click()}
              disabled={isUploadingImage}
              className="flex-1 bg-transparent"
            >
              {isUploadingImage ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Image
                </>
              )}
            </Button>
          </div>

          {/* Generate Image */}
          <div className="space-y-2">
            <Textarea
              placeholder="Or describe an image to generate..."
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              rows={2}
              className="bg-background resize-none"
              disabled={isGeneratingImage}
            />
            <Button
              type="button"
              onClick={handleGenerateImage}
              disabled={isGeneratingImage || !imagePrompt.trim()}
              className="w-full"
            >
              {isGeneratingImage ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Generate Image
                </>
              )}
            </Button>
          </div>

          {/* Images Preview */}
          {(editedScene.generatedImages?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Images ({editedScene.generatedImages?.length ?? 0})
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {(editedScene.generatedImages ?? []).map((image) => (
                  <div
                    key={image.id}
                    className="relative aspect-video rounded-lg overflow-hidden border border-border bg-muted/30 group"
                  >
                    <Image src={image.imageUrl} alt={image.prompt} fill className="object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                      <p className="text-xs text-white line-clamp-2">{image.prompt}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Video Generation & Upload */}
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            <Label className="text-base font-semibold">Videos</Label>
          </div>

          {/* Upload Video */}
          <div className="flex gap-2">
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
              onChange={handleUploadVideo}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => videoInputRef.current?.click()}
              disabled={isUploadingVideo}
              className="flex-1 bg-transparent"
            >
              {isUploadingVideo ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Video
                </>
              )}
            </Button>
          </div>

          {/* Generate Video */}
          <div className="space-y-2">
            <Textarea
              placeholder="Or describe a video to generate..."
              value={videoPrompt}
              onChange={(e) => setVideoPrompt(e.target.value)}
              rows={2}
              className="bg-background resize-none"
              disabled={isGeneratingVideo}
            />
            <Button
              type="button"
              onClick={handleGenerateVideo}
              disabled={isGeneratingVideo || !videoPrompt.trim()}
              className="w-full"
            >
              {isGeneratingVideo ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Video className="h-4 w-4 mr-2" />
                  Generate Video
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Video generation may take several minutes to complete.
            </p>
          </div>

          {/* Videos Preview */}
          {(editedScene.generatedVideos?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Videos ({editedScene.generatedVideos?.length ?? 0})
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(editedScene.generatedVideos ?? []).map((video) => (
                  <div
                    key={video.id}
                    className="relative aspect-video rounded-lg overflow-hidden border border-border bg-muted/30"
                  >
                    {video.status === "completed" && video.videoUrl ? (
                      <video src={video.videoUrl} className="w-full h-full object-cover" controls>
                        <track kind="captions" />
                      </video>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-2">
                        {video.status === "processing" && (
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        )}
                        <span className="text-sm text-muted-foreground">
                          {video.status === "pending" && "Pending..."}
                          {video.status === "processing" && "Processing..."}
                          {video.status === "failed" && `Failed: ${video.error || "Unknown error"}`}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-border">
          <Button type="button" onClick={handleSave} disabled={isSaving} className="flex-1">
            {isSaving ? "Saving..." : "Save Scene"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 bg-transparent"
          >
            Cancel
          </Button>
          {onDelete && (
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              disabled={isSaving}
              className="shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface SceneListProps {
  projectId: string;
  scenes: Scene[];
  characters: Character[];
  locations?: Location[];
  screenplayText?: string;
  onScenesChange: (scenes: Scene[]) => void;
}

export function SceneList({
  projectId,
  scenes,
  characters,
  locations,
  screenplayText,
  onScenesChange,
}: SceneListProps) {
  const router = useRouter();
  const [isExtracting, setIsExtracting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const performExtraction = async () => {
    if (!screenplayText || screenplayText.trim().length === 0) {
      toast.error("No screenplay text to extract scenes from. Please add a screenplay first.");
      return;
    }

    setIsExtracting(true);
    const loadingToast = toast.loading("Extracting scenes from screenplay...");

    try {
      // Get location and character names for automatic matching
      const locationNames = locations?.map((loc) => loc.name).filter(Boolean) || [];
      const characterNames = characters?.map((char) => char.name).filter(Boolean) || [];

      const response = await fetch("/api/scenes/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screenplayText,
          projectId,
          locationNames,
          characterNames,
        }),
      });

      const data = await response.json();

      if (data.success && data.scenes) {
        // Replace all scenes with extracted scenes
        onScenesChange(data.scenes);
        toast.success(`Extracted ${data.scenes.length} scenes from screenplay`, {
          id: loadingToast,
        });
      } else {
        toast.error(data.error || "Failed to extract scenes", { id: loadingToast });
      }
    } catch (error) {
      console.error("[SceneList] Error extracting scenes:", JSON.stringify({ error }, null, 2));
      toast.error("Failed to extract scenes", { id: loadingToast });
    } finally {
      setIsExtracting(false);
      setShowConfirmDialog(false);
    }
  };

  const handleExtractScenes = () => {
    if (!screenplayText || screenplayText.trim().length === 0) {
      toast.error("No screenplay text to extract scenes from. Please add a screenplay first.");
      return;
    }

    // If there are existing scenes, show confirmation dialog
    if (scenes.length > 0) {
      setShowConfirmDialog(true);
    } else {
      // No existing scenes, proceed directly
      performExtraction();
    }
  };

  const handleAddScene = async () => {
    const newSceneNumber = scenes.length + 1;
    const now = new Date().toISOString();
    const newScene: Scene = {
      id: `scene-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      projectId,
      sceneNumber: newSceneNumber,
      title: "New Scene",
      screenplay: "",
      characters: [],
      generatedImages: [],
      generatedVideos: [],
      createdAt: now,
      updatedAt: now,
    };

    // Save the new scene first, then navigate to edit page
    const loadingToast = toast.loading("Creating scene...");
    try {
      const response = await fetch(`/api/scenes/${newScene.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          scene: newScene,
        }),
      });

      const data = await response.json();

      if (data.success) {
        onScenesChange([...scenes, newScene]);
        toast.success("Scene created", { id: loadingToast });
        router.push(`/dashboard/projects/${projectId}/scenes/${newScene.id}/edit`);
      } else {
        toast.error(data.error || "Failed to create scene", { id: loadingToast });
      }
    } catch (error) {
      console.error("[SceneList] Error creating scene:", JSON.stringify({ error }, null, 2));
      toast.error("Failed to create scene", { id: loadingToast });
    }
  };

  return (
    <div className="space-y-4">
      {/* Scene List */}
      {scenes.length > 0 ? (
        <div className="flex flex-col gap-2">
          {scenes.map((scene) => (
            <Link key={scene.id} href={`/dashboard/projects/${projectId}/scenes/${scene.id}/edit`}>
              <Card className="group bg-muted/30 border-border hover:bg-muted/50 py-2 transition-colors cursor-pointer">
                <CardContent className="pl-4 py-0 flex items-center gap-4">
                  <div className="pt-0.5 shrink-0">
                    <Edit className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-all duration-500" />
                  </div>
                  <span className="text-sm text-muted-foreground font-medium shrink-0 w-8">
                    #{scene.sceneNumber}
                  </span>
                  <h4 className="font-medium truncate min-w-0">{scene.title}</h4>
                  {scene.screenplay && (
                    <div className="flex-1 min-w-0 hidden sm:block">
                      <p className="font-mono text-xs text-muted-foreground truncate">
                        {scene.screenplay.substring(0, 200)}...
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
                    {scene.generatedImages.length > 0 && (
                      <span>{scene.generatedImages.length} images</span>
                    )}
                    {scene.generatedVideos.length > 0 && (
                      <span>{scene.generatedVideos.length} videos</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Film className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No scenes yet. Add your first scene to get started.</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={handleAddScene} className="bg-transparent">
          <Plus className="h-4 w-4 mr-2" />
          Add Scene
        </Button>
        {screenplayText && screenplayText.trim().length > 0 && (
          <Button
            type="button"
            variant="secondary"
            onClick={handleExtractScenes}
            disabled={isExtracting}
            className="flex-1"
          >
            {isExtracting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <Film className="h-4 w-4 mr-2" />
                Extract from Screenplay
              </>
            )}
          </Button>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ExtractConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="Replace All Scenes?"
        description={`This will replace all ${scenes.length} existing scene${scenes.length !== 1 ? "s" : ""} with scenes extracted from the screenplay. This action cannot be undone.`}
        confirmLabel="Replace All Scenes"
        isLoading={isExtracting}
        onConfirm={performExtraction}
      />
    </div>
  );
}
