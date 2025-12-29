"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Music, Trash2, Upload, Volume2, X } from "lucide-react";
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
import { Slider } from "@/components/ui/slider";
import type { AudioTrack } from "@/lib/scenes-client";
import { createNewAudioTrack } from "@/lib/scenes-client";
import { uploadFile } from "@/lib/upload-utils";

// ============================================================================
// TYPES
// ============================================================================

interface AudioTrackModalProps {
  track: AudioTrack | null;
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
  open,
  onOpenChange,
  onSave,
  onDelete,
  projectId,
  sceneId,
}: AudioTrackModalProps) {
  // Local state
  const [sourceUrl, setSourceUrl] = useState(track?.sourceUrl || "");
  const [volume, setVolume] = useState(track?.volume || 1);
  const [isUploading, setIsUploading] = useState(false);

  const audioInputRef = useRef<HTMLInputElement>(null);

  // Sync state when track changes or modal opens
  useEffect(() => {
    if (open) {
      setSourceUrl(track?.sourceUrl || "");
      setVolume(track?.volume || 1);
    }
  }, [open, track]);

  // Handle audio file upload - uses presigned URLs for large audio files
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await uploadFile(file, {
        projectId,
        sceneId,
        mediaType: "audio",
        onProgress: (percent) => {
          console.log(`[AudioTrackModal] Upload progress: ${percent}%`);
        },
      });

      if (result.success && result.url) {
        setSourceUrl(result.url);
        toast.success("Audio uploaded");
      } else {
        toast.error(result.error || "Failed to upload audio");
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

  // Handle save
  const handleSave = () => {
    if (!sourceUrl) {
      toast.error("Please upload an audio file");
      return;
    }

    const audioTrack: AudioTrack = track
      ? {
          ...track,
          name: "",
          sourceType: track.sourceType,
          sourceUrl,
          volume,
          updatedAt: new Date().toISOString(),
        }
      : createNewAudioTrack("", "imported", sourceUrl, 0, 5000);

    // Set volume for new tracks
    if (!track) {
      audioTrack.volume = volume;
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

  // Handle replacing audio file
  const handleReplaceAudio = () => {
    audioInputRef.current?.click();
  };

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
            {isNew 
              ? "Import an audio file. Drag on the timeline to position it."
              : "Adjust audio settings. Drag on the timeline to reposition."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Audio Player & Replace */}
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/mp3,audio/wav,audio/ogg,audio/aac,audio/m4a"
            onChange={handleAudioUpload}
            className="hidden"
          />
          {sourceUrl ? (
            <div className="space-y-2">
              <div>
                <audio 
                  src={sourceUrl} 
                  controls 
                  className="w-full"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              <button
                type="button"
                onClick={handleReplaceAudio}
                disabled={isUploading}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
              >
                {isUploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
                {isUploading ? "Uploading..." : "Replace audio"}
              </button>
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
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {onDelete && track && (
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1 sm:w-auto text-xs text-destructive hover:text-destructive"
            >
              <X className="h-3 w-3" />
              Delete Track
            </button>
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
            disabled={!sourceUrl}
          >
            {isNew ? "Add Track" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AudioTrackModal;
