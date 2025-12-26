"use client";

import { Edit, Film, Image as ImageIcon, Loader2, Plus, Trash2, Video, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Character } from "@/components/project-form";
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

  // Image generation state
  const [imagePrompt, setImagePrompt] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Video generation state
  const [videoPrompt, setVideoPrompt] = useState("");
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [pendingVideos, setPendingVideos] = useState<Map<string, string>>(new Map()); // videoId -> operationId

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
                generatedVideos: prev.generatedVideos.map((v) =>
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
          generatedImages: [...prev.generatedImages, data.image as GeneratedImage],
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
          generatedVideos: [...prev.generatedVideos, newVideo],
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

  const toggleCharacter = (characterName: string) => {
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
          <Textarea
            id="scene-screenplay"
            placeholder="Enter the screenplay text for this scene..."
            value={editedScene.screenplay}
            onChange={(e) => setEditedScene({ ...editedScene, screenplay: e.target.value })}
            rows={10}
            className="bg-background resize-none font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Write the scene description, dialogue, and action for this scene
          </p>
        </div>

        {/* Characters in Scene */}
        {characters.length > 0 && (
          <div className="space-y-2">
            <Label>Characters in this Scene</Label>
            <div className="flex flex-wrap gap-2">
              {characters.map((character) => {
                const isSelected = editedScene.characters.includes(character.name);
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
          </div>
        )}

        {/* Image Generation */}
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            <Label className="text-base font-semibold">Generate Image</Label>
          </div>
          <div className="space-y-2">
            <Textarea
              placeholder="Describe the image you want to generate for this scene..."
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              rows={3}
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

          {/* Generated Images Preview */}
          {editedScene.generatedImages.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Generated Images ({editedScene.generatedImages.length})
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {editedScene.generatedImages.map((image) => (
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
        </div>

        {/* Video Generation */}
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            <Label className="text-base font-semibold">Generate Video</Label>
          </div>
          <div className="space-y-2">
            <Textarea
              placeholder="Describe the video you want to generate for this scene..."
              value={videoPrompt}
              onChange={(e) => setVideoPrompt(e.target.value)}
              rows={3}
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

          {/* Generated Videos Preview */}
          {editedScene.generatedVideos.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Generated Videos ({editedScene.generatedVideos.length})
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {editedScene.generatedVideos.map((video) => (
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
  screenplayText?: string;
  onScenesChange: (scenes: Scene[]) => void;
}

export function SceneList({
  projectId,
  scenes,
  characters,
  screenplayText,
  onScenesChange,
}: SceneListProps) {
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [isCreating, setIsCreating] = useState(false);
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
      const response = await fetch("/api/scenes/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screenplayText,
          projectId,
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

  const handleAddScene = () => {
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
    setEditingScene(newScene);
    setIsCreating(true);
  };

  const handleSaveScene = (scene: Scene) => {
    if (isCreating) {
      onScenesChange([...scenes, scene]);
    } else {
      onScenesChange(scenes.map((s) => (s.id === scene.id ? scene : s)));
    }
    setEditingScene(null);
    setIsCreating(false);
    toast.success(isCreating ? "Scene created" : "Scene updated");
  };

  const handleDeleteScene = (sceneId: string) => {
    onScenesChange(scenes.filter((s) => s.id !== sceneId));
    setEditingScene(null);
    toast.success("Scene deleted");
  };

  const handleCancelEdit = () => {
    setEditingScene(null);
    setIsCreating(false);
  };

  // If editing a scene, show the editor
  if (editingScene) {
    return (
      <SceneEditor
        scene={editingScene}
        characters={characters}
        onSave={handleSaveScene}
        onCancel={handleCancelEdit}
        onDelete={!isCreating ? () => handleDeleteScene(editingScene.id) : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Scene List */}
      {scenes.length > 0 ? (
        <div className="space-y-2">
          {scenes.map((scene) => (
            <Card
              key={scene.id}
              className="group bg-muted/30 border-border hover:bg-muted/50 py-2 transition-colors cursor-pointer"
              onClick={() => setEditingScene(scene)}
            >
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
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace All Scenes?</DialogTitle>
            <DialogDescription>
              This will replace all {scenes.length} existing scene{scenes.length !== 1 ? "s" : ""}{" "}
              with scenes extracted from the screenplay. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isExtracting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={performExtraction}
              disabled={isExtracting}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting...
                </>
              ) : (
                "Replace All Scenes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
