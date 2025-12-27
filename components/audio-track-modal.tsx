"use client";

import { useCallback, useRef, useState } from "react";
import {
  Loader2,
  Music,
  Trash2,
  Upload,
  Video,
  Volume2,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { AudioTrack, AudioSourceType, Shot } from "@/lib/scenes-client";
import { createNewAudioTrack } from "@/lib/scenes-client";

// ============================================================================
// TYPES
// ============================================================================

interface AudioTrackModalProps {
  track: AudioTrack | null;
  shots: Shot[]; // Available shots for extraction
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (track: AudioTrack) => void;
  onDelete?: (trackId: string) => void;
  projectId: string;
  sceneId: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AudioTrackModal({
  track,
  shots,
  open,
  onOpenChange,
  onSave,
  onDelete,
  projectId,
  sceneId,
}: AudioTrackModalProps) {
  // Local state
  const [name, setName] = useState(track?.name || "");
  const [sourceType, setSourceType] = useState<AudioSourceType>(
    track?.sourceType || "imported"
  );
  const [sourceUrl, setSourceUrl] = useState(track?.sourceUrl || "");
  const [selectedShotId, setSelectedShotId] = useState(track?.sourceVideoShotId || "");
  const [startTimeMs, setStartTimeMs] = useState(track?.startTimeMs || 0);
  const [volume, setVolume] = useState(track?.volume || 1);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  const audioInputRef = useRef<HTMLInputElement>(null);

  // Handle audio file upload
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);
      formData.append("sceneId", sceneId);
      formData.append("mediaType", "audio");

      const response = await fetch("/api/scenes/upload-media", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setSourceUrl(data.url);
        setName(name || file.name.replace(/\.[^/.]+$/, ""));
        toast.success("Audio uploaded");
      } else {
        toast.error(data.error || "Failed to upload audio");
      }
    } catch (error) {
      console.error("[AudioTrackModal] Upload error:", JSON.stringify({ error }, null, 2));
      toast.error("Failed to upload audio");
    } finally {
      setIsUploading(false);
      if (e.target) {
        e.target.value = "";
      }
    }
  };

  // Handle audio extraction from video
  const handleExtractAudio = async () => {
    if (!selectedShotId) {
      toast.error("Please select a shot to extract audio from");
      return;
    }

    const selectedShot = shots.find((s) => s.id === selectedShotId);
    if (!selectedShot?.video?.url) {
      toast.error("Selected shot has no video");
      return;
    }

    setIsExtracting(true);
    try {
      const response = await fetch("/api/audio/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sceneId,
          shotId: selectedShotId,
          videoUrl: selectedShot.video.url,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSourceUrl(data.audioUrl);
        setName(name || `Audio from Shot ${selectedShot.order + 1}`);
        toast.success("Audio extracted successfully");
      } else {
        toast.error(data.error || "Failed to extract audio");
      }
    } catch (error) {
      console.error("[AudioTrackModal] Extract error:", JSON.stringify({ error }, null, 2));
      toast.error("Failed to extract audio");
    } finally {
      setIsExtracting(false);
    }
  };

  // Handle save
  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Please enter a track name");
      return;
    }

    if (!sourceUrl) {
      toast.error("Please upload or extract audio");
      return;
    }

    const audioTrack: AudioTrack = track
      ? {
          ...track,
          name,
          sourceType,
          sourceUrl,
          sourceVideoShotId: sourceType === "extracted" ? selectedShotId : undefined,
          startTimeMs,
          volume,
          updatedAt: new Date().toISOString(),
        }
      : createNewAudioTrack(name, sourceType, sourceUrl, startTimeMs, 5000);

    // Add additional fields if new
    if (!track) {
      audioTrack.volume = volume;
      if (sourceType === "extracted") {
        audioTrack.sourceVideoShotId = selectedShotId;
      }
    }

    onSave(audioTrack);
    onOpenChange(false);
  };

  // Handle delete
  const handleDelete = () => {
    if (!track || !onDelete) return;
    onDelete(track.id);
    onOpenChange(false);
  };

  // Get shots with completed videos
  const shotsWithVideos = shots.filter((s) => s.video?.url && s.video.status === "completed");

  const isNew = !track;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            {isNew ? "Add Audio Track" : "Edit Audio Track"}
          </DialogTitle>
          <DialogDescription>
            Import an audio file or extract audio from a video clip.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Track Name */}
          <div className="space-y-2">
            <Label htmlFor="track-name">Track Name</Label>
            <Input
              id="track-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Background Music"
            />
          </div>

          {/* Source Type Toggle */}
          <div className="space-y-2">
            <Label>Source</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={sourceType === "imported" ? "default" : "outline"}
                onClick={() => setSourceType("imported")}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Audio
              </Button>
              <Button
                type="button"
                variant={sourceType === "extracted" ? "default" : "outline"}
                onClick={() => setSourceType("extracted")}
                className="flex-1"
                disabled={shotsWithVideos.length === 0}
              >
                <Video className="h-4 w-4 mr-2" />
                Extract from Video
              </Button>
            </div>
          </div>

          {sourceType === "imported" ? (
            /* Import Audio */
            <div className="space-y-2">
              <Label>Audio File</Label>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/mp3,audio/wav,audio/ogg,audio/aac,audio/m4a"
                onChange={handleAudioUpload}
                className="hidden"
              />
              {sourceUrl ? (
                <div className="p-4 rounded-lg border border-border bg-muted/30 flex items-center gap-3">
                  <Music className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{name || "Audio file"}</p>
                    <audio src={sourceUrl} controls className="w-full mt-2" />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full h-24 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 flex flex-col items-center justify-center gap-2 transition-colors"
                >
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Click to upload audio file
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            /* Extract from Video */
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Shot</Label>
                <Select value={selectedShotId} onValueChange={setSelectedShotId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a shot..." />
                  </SelectTrigger>
                  <SelectContent>
                    {shotsWithVideos.map((shot) => (
                      <SelectItem key={shot.id} value={shot.id}>
                        Shot {shot.order + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedShotId && !sourceUrl && (
                <Button
                  type="button"
                  onClick={handleExtractAudio}
                  disabled={isExtracting}
                  className="w-full"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <Music className="h-4 w-4 mr-2" />
                      Extract Audio
                    </>
                  )}
                </Button>
              )}

              {sourceUrl && (
                <div className="p-4 rounded-lg border border-border bg-muted/30 flex items-center gap-3">
                  <Music className="h-8 w-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Extracted audio</p>
                    <audio src={sourceUrl} controls className="w-full mt-2" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                Volume
              </Label>
              <span className="text-sm text-muted-foreground">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <Slider
              value={[volume * 100]}
              onValueChange={([v]) => setVolume(v / 100)}
              max={100}
              step={1}
            />
          </div>

          {/* Start Time (simplified) */}
          <div className="space-y-2">
            <Label htmlFor="start-time">Start Time (seconds)</Label>
            <Input
              id="start-time"
              type="number"
              min="0"
              step="0.1"
              value={startTimeMs / 1000}
              onChange={(e) => setStartTimeMs(Number(e.target.value) * 1000)}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {onDelete && track && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              className="w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Track
            </Button>
          )}
          <div className="flex-1" />
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || !sourceUrl}
          >
            {isNew ? "Add Track" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AudioTrackModal;

