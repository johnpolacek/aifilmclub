"use client";

import {
  ArrowLeft,
  Edit,
  Film,
  Image as ImageIcon,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Character } from "@/components/project-form";
import { ScreenplayElementComponent } from "@/components/screenplay-element";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { GeneratedImage, GeneratedVideo, Scene } from "@/lib/scenes";
import { elementsToText, parseScreenplayToElements } from "@/lib/screenplay-parser";
import type { ScreenplayElement, ScreenplayElementType } from "@/lib/types/screenplay";
import { createScreenplayElement, ELEMENT_TYPE_LABELS } from "@/lib/types/screenplay";

interface EditSceneViewProps {
  scene: Scene;
  projectId: string;
  projectTitle: string;
  characters: Character[];
}

export function EditSceneView({
  scene: initialScene,
  projectId,
  projectTitle,
  characters,
}: EditSceneViewProps) {
  const router = useRouter();
  const [scene, setScene] = useState<Scene>(initialScene);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Screenplay editing state - structured elements
  const [isEditingScreenplay, setIsEditingScreenplay] = useState(false);
  const [screenplayElements, setScreenplayElements] = useState<ScreenplayElement[]>([]);
  const [focusedElementIndex, setFocusedElementIndex] = useState(0);
  const elementRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  // Image state
  const [imagePrompt, setImagePrompt] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Video state
  const [videoPrompt, setVideoPrompt] = useState("");
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [pendingVideos, setPendingVideos] = useState<Map<string, string>>(new Map());

  // Poll for video completion
  useEffect(() => {
    if (pendingVideos.size === 0) return;

    const pollInterval = setInterval(async () => {
      for (const [videoId, operationId] of pendingVideos.entries()) {
        try {
          const response = await fetch(
            `/api/ai/video-status?operationId=${encodeURIComponent(operationId)}&projectId=${projectId}&sceneId=${scene.id}&videoId=${videoId}`
          );
          const data = await response.json();

          if (data.success) {
            if (data.status === "completed" && data.videoUrl) {
              setScene((prev) => ({
                ...prev,
                generatedVideos: prev.generatedVideos.map((v) =>
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
              setPendingVideos((prev) => {
                const next = new Map(prev);
                next.delete(videoId);
                return next;
              });
              toast.success("Video generation completed!");
              setHasChanges(true);
            } else if (data.status === "failed") {
              setScene((prev) => ({
                ...prev,
                generatedVideos: prev.generatedVideos.map((v) =>
                  v.id === videoId ? { ...v, status: "failed" as const, error: data.error } : v
                ),
              }));
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
            "[EditSceneView] Error polling video status:",
            JSON.stringify({ videoId, error }, null, 2)
          );
        }
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [pendingVideos, projectId, scene.id]);

  // Screenplay editing handlers
  const handleScreenplayEdit = () => {
    const elements = scene.screenplay
      ? parseScreenplayToElements(scene.screenplay)
      : [createScreenplayElement("action", "")];
    setScreenplayElements(elements.length > 0 ? elements : [createScreenplayElement("action", "")]);
    setFocusedElementIndex(0);
    setIsEditingScreenplay(true);
  };

  const handleScreenplaySave = () => {
    const plainText = elementsToText(screenplayElements);
    setScene({ ...scene, screenplay: plainText });
    setIsEditingScreenplay(false);
    setHasChanges(true);
  };

  const handleScreenplayCancel = () => {
    setScreenplayElements([]);
    setIsEditingScreenplay(false);
  };

  const handleElementChange = useCallback((id: string, content: string) => {
    setScreenplayElements((prev) => prev.map((el) => (el.id === id ? { ...el, content } : el)));
  }, []);

  const handleElementTypeChange = useCallback((id: string, type: ScreenplayElementType) => {
    setScreenplayElements((prev) => prev.map((el) => (el.id === id ? { ...el, type } : el)));
  }, []);

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

  const handleElementInsertAfter = useCallback((index: number, type: ScreenplayElementType) => {
    const newElement = createScreenplayElement(type, "");
    setScreenplayElements((prev) => {
      const updated = [...prev];
      updated.splice(index + 1, 0, newElement);
      return updated;
    });
    setFocusedElementIndex(index + 1);
  }, []);

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

  const handleElementKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const currentElement = screenplayElements[index];
      const target = e.target as HTMLTextAreaElement;
      const cursorAtStart = target.selectionStart === 0 && target.selectionEnd === 0;
      const cursorAtEnd = target.selectionStart === currentElement.content.length;

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const nextType = getNextType(currentElement.type);
        handleElementInsertAfter(index, nextType);
        return;
      }

      if (e.key === "Backspace" && currentElement.content === "" && screenplayElements.length > 1) {
        e.preventDefault();
        handleElementDelete(currentElement.id);
        return;
      }

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

      if (e.key === "Tab" && !e.shiftKey && currentElement.content !== "") {
        if (index < screenplayElements.length - 1) {
          e.preventDefault();
          setFocusedElementIndex(index + 1);
        }
        return;
      }

      if (e.key === "Tab" && e.shiftKey) {
        if (index > 0) {
          e.preventDefault();
          setFocusedElementIndex(index - 1);
        }
        return;
      }

      if (e.key === "ArrowDown" && cursorAtEnd) {
        if (index < screenplayElements.length - 1) {
          e.preventDefault();
          setFocusedElementIndex(index + 1);
        }
        return;
      }

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

  const handleAddElement = (type: ScreenplayElementType) => {
    const newElement = createScreenplayElement(type, "");
    setScreenplayElements((prev) => [...prev, newElement]);
    setFocusedElementIndex(screenplayElements.length);
  };

  const registerElementRef = useCallback((id: string, ref: HTMLTextAreaElement | null) => {
    if (ref) {
      elementRefs.current.set(id, ref);
    } else {
      elementRefs.current.delete(id);
    }
  }, []);

  // Image handlers
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
          projectId,
          sceneId: scene.id,
          aspectRatio: "16:9",
        }),
      });

      const data = await response.json();

      if (data.success && data.image) {
        setScene((prev) => ({
          ...prev,
          generatedImages: [...prev.generatedImages, data.image as GeneratedImage],
        }));
        setImagePrompt("");
        setHasChanges(true);
        toast.success("Image generated successfully!", { id: loadingToast });
      } else {
        toast.error(data.error || "Failed to generate image", { id: loadingToast });
      }
    } catch (error) {
      console.error("[EditSceneView] Error generating image:", JSON.stringify({ error }, null, 2));
      toast.error("Failed to generate image", { id: loadingToast });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    const loadingToast = toast.loading("Uploading image...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);
      formData.append("sceneId", scene.id);
      formData.append("mediaType", "image");

      const response = await fetch("/api/scenes/upload-media", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        const newImage: GeneratedImage = {
          id: data.id,
          prompt: `Uploaded: ${file.name}`,
          imageUrl: data.url,
          model: "other",
          createdAt: new Date().toISOString(),
        };
        setScene((prev) => ({
          ...prev,
          generatedImages: [...prev.generatedImages, newImage],
        }));
        setHasChanges(true);
        toast.success("Image uploaded successfully!", { id: loadingToast });
      } else {
        toast.error(data.error || "Failed to upload image", { id: loadingToast });
      }
    } catch (error) {
      console.error("[EditSceneView] Error uploading image:", JSON.stringify({ error }, null, 2));
      toast.error("Failed to upload image", { id: loadingToast });
    } finally {
      setIsUploadingImage(false);
      if (e.target) {
        e.target.value = "";
      }
    }
  };

  // Video handlers
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
          projectId,
          sceneId: scene.id,
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

        setScene((prev) => ({
          ...prev,
          generatedVideos: [...prev.generatedVideos, newVideo],
        }));

        setPendingVideos((prev) => {
          const next = new Map(prev);
          next.set(data.video.id, data.video.operationId);
          return next;
        });

        setVideoPrompt("");
        setHasChanges(true);
        toast.success("Video generation started! This may take a few minutes.", {
          id: loadingToast,
        });
      } else {
        toast.error(data.error || "Failed to start video generation", { id: loadingToast });
      }
    } catch (error) {
      console.error("[EditSceneView] Error generating video:", JSON.stringify({ error }, null, 2));
      toast.error("Failed to start video generation", { id: loadingToast });
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleUploadVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingVideo(true);
    const loadingToast = toast.loading("Uploading video...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);
      formData.append("sceneId", scene.id);
      formData.append("mediaType", "video");

      const response = await fetch("/api/scenes/upload-media", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        const newVideo: GeneratedVideo = {
          id: data.id,
          prompt: `Uploaded: ${file.name}`,
          videoUrl: data.url,
          model: "other",
          status: "completed",
          createdAt: new Date().toISOString(),
        };
        setScene((prev) => ({
          ...prev,
          generatedVideos: [...prev.generatedVideos, newVideo],
        }));
        setHasChanges(true);
        toast.success("Video uploaded successfully!", { id: loadingToast });
      } else {
        toast.error(data.error || "Failed to upload video", { id: loadingToast });
      }
    } catch (error) {
      console.error("[EditSceneView] Error uploading video:", JSON.stringify({ error }, null, 2));
      toast.error("Failed to upload video", { id: loadingToast });
    } finally {
      setIsUploadingVideo(false);
      if (e.target) {
        e.target.value = "";
      }
    }
  };

  // Save scene
  const handleSave = async () => {
    if (!scene.title.trim()) {
      toast.error("Scene title is required");
      return;
    }

    setIsSaving(true);
    const loadingToast = toast.loading("Saving scene...");

    try {
      const updatedScene = {
        ...scene,
        updatedAt: new Date().toISOString(),
      };

      const response = await fetch(`/api/scenes/${scene.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          scene: updatedScene,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setHasChanges(false);
        toast.success("Scene saved successfully!", { id: loadingToast });
      } else {
        toast.error(data.error || "Failed to save scene", { id: loadingToast });
      }
    } catch (error) {
      console.error("[EditSceneView] Error saving scene:", JSON.stringify({ error }, null, 2));
      toast.error("Failed to save scene", { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete scene
  const handleDelete = async () => {
    setIsDeleting(true);
    const loadingToast = toast.loading("Deleting scene...");

    try {
      const response = await fetch(`/api/scenes/${scene.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Scene deleted", { id: loadingToast });
        router.push(`/dashboard/projects/${projectId}/edit`);
      } else {
        toast.error(data.error || "Failed to delete scene", { id: loadingToast });
      }
    } catch (error) {
      console.error("[EditSceneView] Error deleting scene:", JSON.stringify({ error }, null, 2));
      toast.error("Failed to delete scene", { id: loadingToast });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const toggleCharacter = (characterName: string) => {
    const currentCharacters = scene.characters || [];
    const isSelected = currentCharacters.includes(characterName);

    setScene({
      ...scene,
      characters: isSelected
        ? currentCharacters.filter((c) => c !== characterName)
        : [...currentCharacters, characterName],
    });
    setHasChanges(true);
  };

  return (
    <div className="min-h-screen bg-background pt-20">
      {/* Header */}
      <div className="sticky top-0 z-10 border-t border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/dashboard/projects/${projectId}/edit`}
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm font-medium">Back to Project</span>
              </Link>
              <div className="h-6 w-px bg-border" />
              <div>
                <h1 className="text-lg font-bold flex items-center gap-2">
                  <Film className="h-5 w-5 text-primary" />
                  Scene {scene.sceneNumber}: {scene.title}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
              <Button type="button" onClick={handleSave} disabled={isSaving || !hasChanges}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 lg:px-8 py-12">
        <div className="max-w-8xl mx-auto space-y-6 grid lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="space-y-6 pr-6">
            <div className="space-y-2">
              <Label htmlFor="scene-title">Scene Title *</Label>
              <Input
                id="scene-title"
                placeholder="Enter scene title (e.g., 'Opening - City Street')"
                value={scene.title}
                onChange={(e) => {
                  setScene({ ...scene, title: e.target.value });
                  setHasChanges(true);
                }}
                className="bg-background"
              />
            </div>
            <div className="mb-2">Screenplay</div>
            <button
              type="button"
              onClick={handleScreenplayEdit}
              className="w-full rounded-md border border-input bg-background cursor-pointer hover:bg-muted/30 transition-colors group text-left overflow-hidden"
            >
              {scene.screenplay ? (
                <div className="relative p-3">
                  <pre
                    className="font-mono text-xs text-muted-foreground whitespace-pre-wrap text-left max-h-[120px] overflow-hidden"
                    style={{
                      fontFamily:
                        "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
                    }}
                  >
                    {scene.screenplay}
                  </pre>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Edit className="h-4 w-4 text-primary" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 py-3 px-3">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    Add screenplay text...
                  </p>
                </div>
              )}
            </button>
            <div>Characters</div>
            {characters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {characters.map((character) => {
                  const isSelected = scene.characters.includes(character.name);
                  return (
                    <button
                      key={character.name}
                      type="button"
                      onClick={() => toggleCharacter(character.name)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {character.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* Right Column */}
          <div className="col-span-2">
            {/* Images */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  Images
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                {scene.generatedImages.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      Images ({scene.generatedImages.length})
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {scene.generatedImages.map((image) => (
                        <div
                          key={image.id}
                          className="relative aspect-video rounded-lg overflow-hidden border border-border bg-muted/30 group"
                        >
                          <img
                            src={image.imageUrl}
                            alt={image.prompt}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                            <p className="text-xs text-white line-clamp-2">{image.prompt}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Videos */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Video className="h-5 w-5 text-primary" />
                  Videos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                {scene.generatedVideos.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      Videos ({scene.generatedVideos.length})
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {scene.generatedVideos.map((video) => (
                        <div
                          key={video.id}
                          className="relative aspect-video rounded-lg overflow-hidden border border-border bg-muted/30"
                        >
                          {video.status === "completed" && video.videoUrl ? (
                            <video
                              src={video.videoUrl}
                              className="w-full h-full object-cover"
                              controls
                            >
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
                                {video.status === "failed" &&
                                  `Failed: ${video.error || "Unknown error"}`}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Unsaved changes indicator */}
      {hasChanges && (
        <div className="fixed bottom-4 right-4 bg-yellow-500/20 text-yellow-500 px-3 py-1.5 rounded-full text-sm font-medium">
          Unsaved changes
        </div>
      )}

      {/* Screenplay Edit Dialog */}
      <Dialog
        open={isEditingScreenplay}
        onOpenChange={(open) => {
          if (!open) {
            handleScreenplayCancel();
          }
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-[960px] w-full max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Screenplay</DialogTitle>
            <DialogDescription>
              Use structured screenplay format with scene headings, action, dialogue, and more.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="rounded-md border border-input bg-background overflow-hidden flex-1 flex flex-col min-h-0">
              <div className="py-2 font-mono text-sm leading-relaxed overflow-y-auto flex-1">
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

              <div className="border-t border-border p-2 flex flex-wrap gap-1.5 bg-muted/30 shrink-0">
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
            <p className="text-xs text-muted-foreground mt-2 shrink-0">
              Enter for new line • Tab to change type • Click type label to change
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleScreenplayCancel}
              className="bg-transparent"
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleScreenplaySave}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Scene?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{scene.title}&quot;? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Scene"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
