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
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AudioTrackModal } from "@/components/audio-track-modal";
import type { Character } from "@/components/project-form";
import { ScreenplayElementComponent } from "@/components/screenplay-element";
import { ShotEditorModal } from "@/components/shot-editor-modal";
import Timeline from "@/components/timeline";
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
import type { AudioTrack, Scene, Shot, ShotVideo, TransitionType } from "@/lib/scenes-client";
import { createNewShot } from "@/lib/scenes-client";
import { elementsToText, parseScreenplayToElements } from "@/lib/screenplay-parser";
import type { ScreenplayElement, ScreenplayElementType } from "@/lib/types/screenplay";
import { createScreenplayElement, ELEMENT_TYPE_LABELS } from "@/lib/types/screenplay";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface EditSceneViewProps {
  scene: Scene;
  projectId: string;
  projectTitle: string;
  characters: Character[];
}

// ============================================================================
// SCREENPLAY FORMATTING HELPERS
// ============================================================================

/**
 * Get CSS classes for element type styling (read-only view)
 */
function getElementStyles(type: ScreenplayElement["type"]): string {
  switch (type) {
    case "scene_heading":
      return "font-bold uppercase tracking-wide text-primary pt-4";
    case "action":
      return "font-normal";
    case "character":
      return "uppercase font-semibold mt-6 text-center";
    case "parenthetical":
      return "italic text-muted-foreground text-sm text-center";
    case "dialogue":
      return "text-left";
    case "transition":
      return "uppercase text-right font-semibold text-muted-foreground mt-4";
    default:
      return "";
  }
}

/**
 * Get wrapper classes for centering blocks
 */
function getWrapperStyles(type: ScreenplayElement["type"]): string {
  switch (type) {
    case "character":
      return "flex justify-center";
    case "parenthetical":
      return "flex justify-center";
    case "dialogue":
      return "flex justify-center";
    default:
      return "";
  }
}

/**
 * Get max-width for element types
 */
function getMaxWidth(type: ScreenplayElement["type"]): string {
  switch (type) {
    case "dialogue":
      return "w-full max-w-[35ch]";
    case "parenthetical":
      return "w-full max-w-[35ch]";
    case "character":
      return "w-full max-w-[35ch]";
    default:
      return "w-full";
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function EditSceneView({ scene: initialScene, projectId, characters }: EditSceneViewProps) {
  const router = useRouter();
  const [scene, setScene] = useState<Scene>(() => ({
    ...initialScene,
    shots: initialScene.shots || [],
    audioTracks: initialScene.audioTracks || [],
    generatedImages: initialScene.generatedImages || [],
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Screenplay editing state
  const [isEditingScreenplay, setIsEditingScreenplay] = useState(false);
  const [screenplayElements, setScreenplayElements] = useState<ScreenplayElement[]>([]);
  const [focusedElementIndex, setFocusedElementIndex] = useState(0);
  const elementRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  // Shot editing state
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const [showShotEditor, setShowShotEditor] = useState(false);
  const [pendingShots, setPendingShots] = useState<Map<string, string>>(new Map()); // shotId -> operationId

  // Audio track editing state
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<AudioTrack | null>(null);
  const [showAudioTrackEditor, setShowAudioTrackEditor] = useState(false);

  // ============================================================================
  // POLLING FOR SHOT VIDEO COMPLETION
  // ============================================================================

  useEffect(() => {
    if (pendingShots.size === 0) return;

    const pollInterval = setInterval(async () => {
      for (const [shotId, operationId] of pendingShots.entries()) {
        try {
          const response = await fetch(
            `/api/ai/video-status?operationId=${encodeURIComponent(operationId)}&projectId=${projectId}&sceneId=${scene.id}&videoId=${shotId}`
          );
          const data = await response.json();

          if (data.success) {
            if (data.status === "completed" && data.videoUrl) {
              setScene((prev) => ({
                ...prev,
                shots: prev.shots.map((s) =>
                  s.id === shotId
                    ? {
                        ...s,
                        video: {
                          ...s.video,
                          url: data.videoUrl,
                          status: "completed" as const,
                          durationMs: data.durationMs || 5000,
                        },
                        updatedAt: new Date().toISOString(),
                      }
                    : s
                ),
              }));
              setPendingShots((prev) => {
                const next = new Map(prev);
                next.delete(shotId);
                return next;
              });
              toast.success("Video generation completed!");
              setHasChanges(true);
            } else if (data.status === "failed") {
              setScene((prev) => ({
                ...prev,
                shots: prev.shots.map((s) =>
                  s.id === shotId
                    ? {
                        ...s,
                        video: {
                          url: s.video?.url || "",
                          status: "failed" as const,
                          operationId: s.video?.operationId,
                          error: data.error,
                        } as ShotVideo,
                      }
                    : s
                ),
              }));
              setPendingShots((prev) => {
                const next = new Map(prev);
                next.delete(shotId);
                return next;
              });
              toast.error("Video generation failed");
            }
          }
        } catch (error) {
          console.error(
            "[EditSceneView] Error polling video status:",
            JSON.stringify({ shotId, error }, null, 2)
          );
        }
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [pendingShots, projectId, scene.id]);

  // ============================================================================
  // SCREENPLAY EDITING HANDLERS
  // ============================================================================

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

  // ============================================================================
  // SHOT HANDLERS
  // ============================================================================

  const handleAddShot = () => {
    const newShot = createNewShot(scene.shots.length);
    setSelectedShot(newShot);
    setShowShotEditor(true);
  };

  const handleShotClick = (shot: Shot) => {
    setSelectedShot(shot);
    setShowShotEditor(true);
  };

  const handleShotSave = (updatedShot: Shot) => {
    setScene((prev) => {
      const existingIndex = prev.shots.findIndex((s) => s.id === updatedShot.id);
      if (existingIndex >= 0) {
        // Update existing shot
        const newShots = [...prev.shots];
        newShots[existingIndex] = updatedShot;
        return { ...prev, shots: newShots };
      } else {
        // Add new shot
        return { ...prev, shots: [...prev.shots, updatedShot] };
      }
    });
    setHasChanges(true);
    setShowShotEditor(false);
    setSelectedShot(null);
  };

  const handleShotDelete = (shotId: string) => {
    setScene((prev) => ({
      ...prev,
      shots: prev.shots.filter((s) => s.id !== shotId).map((s, i) => ({ ...s, order: i })),
    }));
    setHasChanges(true);
    setShowShotEditor(false);
    setSelectedShot(null);
  };

  const handleShotReorder = (shotIds: string[]) => {
    setScene((prev) => {
      const shotMap = new Map(prev.shots.map((s) => [s.id, s]));
      const reorderedShots = shotIds
        .map((id, index) => {
          const shot = shotMap.get(id);
          if (shot) {
            return { ...shot, order: index };
          }
          return null;
        })
        .filter((s): s is Shot => s !== null);
      return { ...prev, shots: reorderedShots };
    });
    setHasChanges(true);
  };

  const handleTransitionChange = (shotId: string, transitionType: TransitionType) => {
    setScene((prev) => ({
      ...prev,
      shots: prev.shots.map((s) =>
        s.id === shotId
          ? {
              ...s,
              transitionOut: {
                type: transitionType,
                durationMs: transitionType === "none" ? 0 : 1000,
              },
            }
          : s
      ),
    }));
    setHasChanges(true);
  };

  const handleGenerateVideo = async (shot: Shot) => {
    const loadingToast = toast.loading("Starting video generation...");

    try {
      const response = await fetch("/api/ai/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: shot.prompt,
          projectId,
          sceneId: scene.id,
          shotId: shot.id,
          aspectRatio: "16:9",
          durationSeconds: 8,
          generationMode: shot.generationMode,
          startFrameImage: shot.startFrameImage,
          endFrameImage: shot.endFrameImage,
          referenceImages: shot.referenceImages,
        }),
      });

      const data = await response.json();

      if (data.success && data.video) {
        // Update the shot with the pending video info
        setScene((prev) => ({
          ...prev,
          shots: prev.shots.map((s) =>
            s.id === shot.id
              ? {
                  ...shot,
                  video: {
                    url: "",
                    status: "processing" as const,
                    operationId: data.video.operationId,
                  },
                }
              : s
          ),
        }));

        // Add to pending shots for polling
        setPendingShots((prev) => {
          const next = new Map(prev);
          next.set(shot.id, data.video.operationId);
          return next;
        });

        setHasChanges(true);
        toast.success("Video generation started!", { id: loadingToast });
        setShowShotEditor(false);
        setSelectedShot(null);
      } else {
        toast.error(data.error || "Failed to start video generation", { id: loadingToast });
      }
    } catch (error) {
      console.error("[EditSceneView] Error generating video:", JSON.stringify({ error }, null, 2));
      toast.error("Failed to start video generation", { id: loadingToast });
    }
  };

  // ============================================================================
  // AUDIO TRACK HANDLERS
  // ============================================================================

  const handleAddAudioTrack = () => {
    setSelectedAudioTrack(null);
    setShowAudioTrackEditor(true);
  };

  const handleAudioTrackClick = (track: AudioTrack) => {
    setSelectedAudioTrack(track);
    setShowAudioTrackEditor(true);
  };

  const handleAudioTrackSave = (track: AudioTrack) => {
    setScene((prev) => {
      const existingIndex = prev.audioTracks.findIndex((t) => t.id === track.id);
      if (existingIndex >= 0) {
        const newTracks = [...prev.audioTracks];
        newTracks[existingIndex] = track;
        return { ...prev, audioTracks: newTracks };
      } else {
        return { ...prev, audioTracks: [...prev.audioTracks, track] };
      }
    });
    setHasChanges(true);
    setShowAudioTrackEditor(false);
    setSelectedAudioTrack(null);
  };

  const handleAudioTrackDelete = (trackId: string) => {
    setScene((prev) => ({
      ...prev,
      audioTracks: prev.audioTracks.filter((t) => t.id !== trackId),
    }));
    setHasChanges(true);
    setShowAudioTrackEditor(false);
    setSelectedAudioTrack(null);
  };

  const handleAudioTrackVolumeChange = (trackId: string, volume: number) => {
    setScene((prev) => ({
      ...prev,
      audioTracks: prev.audioTracks.map((t) => (t.id === trackId ? { ...t, volume } : t)),
    }));
    setHasChanges(true);
  };

  const handleAudioTrackMuteToggle = (trackId: string) => {
    setScene((prev) => ({
      ...prev,
      audioTracks: prev.audioTracks.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t)),
    }));
    setHasChanges(true);
  };

  // ============================================================================
  // SAVE / DELETE SCENE
  // ============================================================================

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
    <div className="min-h-screen bg-background flex flex-col pt-20">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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

      {/* Main Content */}
      <div className="flex-1 container mx-auto px-4 lg:px-8 py-6">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Scene Info */}
          <div className="space-y-6 pr-6">
            {/* Scene Title */}
            <div className="space-y-2">
              <Label htmlFor="scene-title">Scene Title *</Label>
              <Input
                id="scene-title"
                placeholder="Enter scene title"
                value={scene.title}
                onChange={(e) => {
                  setScene({ ...scene, title: e.target.value });
                  setHasChanges(true);
                }}
                className="bg-background"
              />
            </div>

            {/* Screenplay */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Screenplay</Label>
                <button
                  type="button"
                  onClick={handleScreenplayEdit}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Edit className="h-3.5 w-3.5" />
                  <span>{scene.screenplay ? "Edit" : "Add"}</span>
                </button>
              </div>
              {scene.screenplay ? (
                <div className="rounded-md border border-input bg-background overflow-hidden max-h-[600px] overflow-y-auto">
                  <div className="px-4 pb-4 font-mono text-sm leading-relaxed space-y-1">
                    {(() => {
                      const elements = parseScreenplayToElements(scene.screenplay);
                      return elements.map((element, index) => {
                        // Add extra spacing when action follows dialogue
                        const prevElement = index > 0 ? elements[index - 1] : null;
                        const needsExtraSpacing =
                          element.type === "action" && prevElement?.type === "dialogue";

                        return (
                          <div
                            key={element.id || index}
                            className={cn(
                              "py-0.5",
                              getWrapperStyles(element.type),
                              needsExtraSpacing && "pt-4"
                            )}
                          >
                            <p
                              className={cn(
                                "whitespace-pre-wrap",
                                getMaxWidth(element.type),
                                getElementStyles(element.type)
                              )}
                            >
                              {element.content || "\u00A0"}
                            </p>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleScreenplayEdit}
                  className="w-full rounded-md border border-input bg-background cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2 py-3 px-3">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                      Add screenplay...
                    </p>
                  </div>
                </button>
              )}
            </div>

            {/* Characters */}
            {characters.length > 0 && (
              <div className="space-y-2">
                <Label>Characters</Label>
                <div className="flex flex-wrap gap-2">
                  {characters.map((character) => {
                    const isSelected = scene.characters.includes(character.name);
                    return (
                      <button
                        key={character.name}
                        type="button"
                        onClick={() => toggleCharacter(character.name)}
                        className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
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

            {/* Reference Images */}
            {scene.generatedImages && scene.generatedImages.length > 0 && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    Reference Images
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-2">
                    {scene.generatedImages.slice(0, 4).map((image) => (
                      <div
                        key={image.id}
                        className="relative aspect-video rounded-lg overflow-hidden border border-border bg-muted/30"
                      >
                        <Image
                          src={image.imageUrl}
                          alt={image.prompt}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main Area - Timeline */}
          <div className="lg:col-span-3 space-y-4">
            {/* Timeline Component */}
            <div className="overflow-hidden">
              <Timeline
                shots={scene.shots}
                audioTracks={scene.audioTracks}
                selectedShotId={selectedShot?.id}
                selectedAudioTrackId={selectedAudioTrack?.id}
                onShotClick={handleShotClick}
                onShotReorder={handleShotReorder}
                onTransitionChange={handleTransitionChange}
                onAudioTrackClick={handleAudioTrackClick}
                onAudioTrackVolumeChange={handleAudioTrackVolumeChange}
                onAudioTrackMuteToggle={handleAudioTrackMuteToggle}
                onAudioTrackDelete={handleAudioTrackDelete}
                onAddShot={handleAddShot}
                onAddAudioTrack={handleAddAudioTrack}
              />
            </div>

            {/* Instructions */}
            <p className="text-xs text-muted-foreground text-center">
              Click a shot to edit • Drag to reorder • Click transition icons to change effect
            </p>
          </div>
        </div>
      </div>

      {/* Unsaved changes indicator */}
      {hasChanges && (
        <div className="fixed bottom-4 right-4 bg-yellow-500/20 text-yellow-500 px-3 py-1.5 rounded-full text-sm font-medium">
          Unsaved changes
        </div>
      )}

      {/* Shot Editor Modal */}
      <ShotEditorModal
        shot={selectedShot}
        open={showShotEditor}
        onOpenChange={setShowShotEditor}
        onSave={handleShotSave}
        onDelete={
          selectedShot && scene.shots.some((s) => s.id === selectedShot.id)
            ? handleShotDelete
            : undefined
        }
        onGenerateVideo={handleGenerateVideo}
        projectId={projectId}
        sceneId={scene.id}
      />

      {/* Audio Track Modal */}
      <AudioTrackModal
        track={selectedAudioTrack}
        shots={scene.shots}
        open={showAudioTrackEditor}
        onOpenChange={setShowAudioTrackEditor}
        onSave={handleAudioTrackSave}
        onDelete={
          selectedAudioTrack ? () => handleAudioTrackDelete(selectedAudioTrack.id) : undefined
        }
        projectId={projectId}
        sceneId={scene.id}
      />

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
