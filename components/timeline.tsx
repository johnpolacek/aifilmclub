"use client";

import {
  ChevronRight,
  GripVertical,
  ImageIcon,
  Loader2,
  Music,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Video,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import type { AudioTrack, Shot, TransitionType } from "@/lib/scenes-client";

// ============================================================================
// TYPES
// ============================================================================

interface TimelineProps {
  shots: Shot[];
  audioTracks: AudioTrack[];
  selectedShotId?: string;
  selectedAudioTrackId?: string;
  onShotClick: (shot: Shot) => void;
  onShotReorder: (shotIds: string[]) => void;
  onTransitionChange: (shotId: string, transition: TransitionType) => void;
  onAudioTrackClick: (track: AudioTrack) => void;
  onAudioTrackVolumeChange: (trackId: string, volume: number) => void;
  onAudioTrackMuteToggle: (trackId: string) => void;
  onAudioTrackDelete: (trackId: string) => void;
  onGenerateVideo: () => void;
  onUploadVideo: () => void;
  onAddAudioTrack: () => void;
  pixelsPerSecond?: number;
}

// ============================================================================
// TRANSITION ICON COMPONENT
// ============================================================================

const TRANSITION_ICONS: Record<TransitionType, string> = {
  none: "→",
  "cross-dissolve": "⨉",
  "fade-to-black": "●→",
  "fade-from-black": "→●",
  "fade-to-white": "○→",
  "fade-from-white": "→○",
};

const TRANSITION_LABELS: Record<TransitionType, string> = {
  none: "Cut",
  "cross-dissolve": "Cross Dissolve",
  "fade-to-black": "Fade to Black",
  "fade-from-black": "Fade from Black",
  "fade-to-white": "Fade to White",
  "fade-from-white": "Fade from White",
};

interface TransitionIconProps {
  transition: TransitionType;
  onTransitionChange: (type: TransitionType) => void;
}

function TransitionIcon({ transition, onTransitionChange }: TransitionIconProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex-shrink-0 w-6 h-6 rounded-full bg-muted hover:bg-muted/80 border border-border flex items-center justify-center text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
          title={TRANSITION_LABELS[transition]}
        >
          {transition === "none" ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <span className="text-[10px]">{TRANSITION_ICONS[transition]}</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-40">
        {(Object.keys(TRANSITION_LABELS) as TransitionType[]).map((type) => (
          <DropdownMenuItem
            key={type}
            onClick={() => onTransitionChange(type)}
            className={transition === type ? "bg-accent" : ""}
          >
            <span className="w-6 text-center mr-2">{TRANSITION_ICONS[type]}</span>
            {TRANSITION_LABELS[type]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// SHOT CARD COMPONENT
// ============================================================================

interface ShotCardProps {
  shot: Shot;
  isSelected: boolean;
  isDragging: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  pixelsPerSecond: number;
}

function ShotCard({
  shot,
  isSelected,
  isDragging,
  onClick,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  pixelsPerSecond,
}: ShotCardProps) {
  // Calculate width based on duration (default 5 seconds if not set)
  const durationMs = shot.video?.durationMs || 5000;
  const width = Math.max(80, (durationMs / 1000) * pixelsPerSecond);

  // Get thumbnail or placeholder
  const thumbnail = shot.startFrameImage || shot.video?.url;

  // Get status indicator
  const getStatusIcon = () => {
    if (!shot.video) {
      return <ImageIcon className="h-4 w-4 text-muted-foreground" />;
    }
    switch (shot.video.status) {
      case "pending":
        return <Sparkles className="h-4 w-4 text-muted-foreground" />;
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case "completed":
        return <Video className="h-4 w-4 text-green-500" />;
      case "failed":
        return <span className="text-red-500 text-xs">!</span>;
      default:
        return null;
    }
  };

  // Generation mode indicator
  const getModeIndicator = () => {
    switch (shot.generationMode) {
      case "start-frame":
        return "SF";
      case "start-end-frame":
        return "SE";
      case "reference-images":
        return "RF";
      default:
        return "T";
    }
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{ width: `${width}px` }}
      className={`
        flex-shrink-0 h-16 rounded-lg border-2 cursor-pointer transition-all relative overflow-hidden
        ${isSelected ? "border-primary shadow-lg ring-2 ring-primary/20" : "border-border hover:border-primary/50"}
        ${isDragging ? "opacity-50 scale-95" : ""}
      `}
    >
      {/* Thumbnail or placeholder */}
      {thumbnail ? (
        shot.video?.url ? (
          <video src={shot.video.url} className="w-full h-full object-cover" muted playsInline />
        ) : (
          <img src={thumbnail} alt={shot.title} className="w-full h-full object-cover" />
        )
      ) : (
        <div className="w-full h-full bg-muted/50 flex items-center justify-center">
          <Video className="h-6 w-6 text-muted-foreground" />
        </div>
      )}

      {/* Overlay with info */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

      {/* Top-left: Drag handle */}
      <div className="absolute top-1 left-1 p-0.5 rounded bg-black/40 cursor-grab active:cursor-grabbing">
        <GripVertical className="h-3 w-3 text-white/70" />
      </div>

      {/* Top-right: Status */}
      <div className="absolute top-1 right-1 p-0.5 rounded bg-black/40">{getStatusIcon()}</div>

      {/* Bottom: Title and mode */}
      <div className="absolute bottom-0 left-0 right-0 p-1 flex items-center justify-between">
        <span className="text-[10px] text-white font-medium truncate max-w-[60%]">
          {shot.title}
        </span>
        <span className="text-[8px] bg-primary/80 text-primary-foreground px-1 rounded">
          {getModeIndicator()}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// AUDIO TRACK ROW COMPONENT
// ============================================================================

interface AudioTrackRowProps {
  track: AudioTrack;
  isSelected: boolean;
  onClick: () => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onDelete: () => void;
  pixelsPerSecond: number;
  totalDurationMs: number;
}

function AudioTrackRow({
  track,
  isSelected,
  onClick,
  onVolumeChange,
  onMuteToggle,
  onDelete,
  pixelsPerSecond,
  totalDurationMs,
}: AudioTrackRowProps) {
  // Calculate position and width
  const left = (track.startTimeMs / 1000) * pixelsPerSecond;
  const width = Math.max(40, (track.durationMs / 1000) * pixelsPerSecond);
  const totalWidth = Math.max(width + left, (totalDurationMs / 1000) * pixelsPerSecond);

  return (
    <div className="flex items-center gap-2 h-10">
      {/* Track controls */}
      <div className="flex-shrink-0 w-32 flex items-center gap-1 px-2">
        <button
          type="button"
          onClick={onMuteToggle}
          className="p-1 rounded hover:bg-muted"
          title={track.muted ? "Unmute" : "Mute"}
        >
          {track.muted ? (
            <VolumeX className="h-3 w-3 text-muted-foreground" />
          ) : (
            <Volume2 className="h-3 w-3 text-foreground" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <Slider
            value={[track.volume * 100]}
            onValueChange={([v]) => onVolumeChange(v / 100)}
            max={100}
            step={1}
            className="w-full"
            disabled={track.muted}
          />
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="p-1 rounded hover:bg-destructive/20 hover:text-destructive"
          title="Delete track"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Track visualization */}
      <div
        className="flex-1 h-8 bg-muted/30 rounded relative overflow-hidden"
        style={{ minWidth: `${totalWidth}px` }}
        onClick={onClick}
      >
        {/* Audio clip */}
        <div
          className={`absolute h-full rounded cursor-pointer transition-all ${
            isSelected ? "ring-2 ring-primary" : ""
          } ${track.muted ? "opacity-50" : ""}`}
          style={{
            left: `${left}px`,
            width: `${width}px`,
            background:
              track.sourceType === "extracted"
                ? "linear-gradient(to right, #3b82f6, #1d4ed8)"
                : "linear-gradient(to right, #10b981, #059669)",
          }}
        >
          {/* Waveform placeholder */}
          <div className="h-full flex items-center justify-center">
            <Music className="h-3 w-3 text-white/70" />
            <span className="text-[10px] text-white/70 ml-1 truncate max-w-[80%]">
              {track.name}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN TIMELINE COMPONENT
// ============================================================================

export default function Timeline({
  shots,
  audioTracks,
  selectedShotId,
  selectedAudioTrackId,
  onShotClick,
  onShotReorder,
  onTransitionChange,
  onAudioTrackClick,
  onAudioTrackVolumeChange,
  onAudioTrackMuteToggle,
  onAudioTrackDelete,
  onGenerateVideo,
  onUploadVideo,
  onAddAudioTrack,
  pixelsPerSecond = 20,
}: TimelineProps) {
  const [draggedShotId, setDraggedShotId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Calculate total timeline duration
  const totalDurationMs = shots.reduce((total, shot, index) => {
    const videoDuration = shot.video?.durationMs || 5000;
    const transitionDuration = index < shots.length - 1 ? shot.transitionOut.durationMs : 0;
    return total + videoDuration + transitionDuration;
  }, 0);

  // Handle shot reordering
  const handleDragStart = useCallback((shotId: string) => {
    setDraggedShotId(shotId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (targetShotId: string) => {
      if (!draggedShotId || draggedShotId === targetShotId) return;

      const draggedIndex = shots.findIndex((s) => s.id === draggedShotId);
      const targetIndex = shots.findIndex((s) => s.id === targetShotId);

      if (draggedIndex === -1 || targetIndex === -1) return;

      const newOrder = shots.map((s) => s.id);
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedShotId);

      onShotReorder(newOrder);
      setDraggedShotId(null);
    },
    [draggedShotId, shots, onShotReorder]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedShotId(null);
  }, []);

  // Time markers
  const timeMarkers = [];
  const totalSeconds = Math.ceil(totalDurationMs / 1000) || 10;
  for (let i = 0; i <= totalSeconds; i += 5) {
    timeMarkers.push(i);
  }

  return (
    <div className="border-t border-border bg-card/50 backdrop-blur">
      {/* Timeline header with time markers */}
      <div className="flex items-center border-b border-border px-2 py-1">
        <div className="flex-shrink-0 w-32 text-xs text-muted-foreground font-medium">Timeline</div>
        <div
          className="flex-1 overflow-x-auto"
          style={{ minWidth: `${totalSeconds * pixelsPerSecond}px` }}
        >
          <div className="flex">
            {timeMarkers.map((sec) => (
              <div
                key={sec}
                className="text-[10px] text-muted-foreground"
                style={{ width: `${5 * pixelsPerSecond}px` }}
              >
                {Math.floor(sec / 60)}:{(sec % 60).toString().padStart(2, "0")}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Video track */}
      <div className="flex items-center gap-2 px-2 py-2 border-b border-border">
        <div ref={timelineRef} className="flex-1 flex items-center gap-1 overflow-x-auto py-1">
          {shots.map((shot, index) => (
            <div key={shot.id} className="flex items-center gap-1">
              <ShotCard
                shot={shot}
                isSelected={selectedShotId === shot.id}
                isDragging={draggedShotId === shot.id}
                onClick={() => onShotClick(shot)}
                onDragStart={() => handleDragStart(shot.id)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(shot.id)}
                onDragEnd={handleDragEnd}
                pixelsPerSecond={pixelsPerSecond}
              />
              {/* Transition icon (not after last shot) */}
              {index < shots.length - 1 && (
                <TransitionIcon
                  transition={shot.transitionOut.type}
                  onTransitionChange={(type) => onTransitionChange(shot.id, type)}
                />
              )}
            </div>
          ))}
          {/* Generate Video and Upload Video buttons */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onGenerateVideo}
              className="w-42 px-3 border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-medium">Generate Video</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onUploadVideo}
              className="w-42 px-3 border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              <span className="text-xs font-medium">Upload Video</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Audio tracks */}
      <div className="px-2 py-2 space-y-1">
        {audioTracks.map((track) => (
          <AudioTrackRow
            key={track.id}
            track={track}
            isSelected={selectedAudioTrackId === track.id}
            onClick={() => onAudioTrackClick(track)}
            onVolumeChange={(v) => onAudioTrackVolumeChange(track.id, v)}
            onMuteToggle={() => onAudioTrackMuteToggle(track.id)}
            onDelete={() => onAudioTrackDelete(track.id)}
            pixelsPerSecond={pixelsPerSecond}
            totalDurationMs={totalDurationMs}
          />
        ))}

        {/* Add audio track button */}
        <button
          type="button"
          onClick={onAddAudioTrack}
          className="w-42 h-8 border-2 border-dashed border-muted-foreground/30 rounded flex items-center justify-center gap-2 text-xs hover:border-primary/50 hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Audio Track
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export { TransitionIcon, ShotCard, AudioTrackRow };
export type { TimelineProps };
