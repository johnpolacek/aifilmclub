"use client";

import {
  GripVertical,
  ImageIcon,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Video,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { AudioWaveform } from "@/components/audio-waveform";
import { getEffectiveDuration } from "@/lib/scenes-client";
import type { AudioTrack, Shot } from "@/lib/scenes-client";

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
  onAudioTrackClick: (track: AudioTrack) => void;
  onAudioTrackMove?: (trackId: string, newStartTimeMs: number) => void;
  onAddShot: () => void;
  onAddAudioTrack: () => void;
  pixelsPerSecond?: number;
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
  left: number; // Absolute position in pixels
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
  left,
}: ShotCardProps) {
  // Calculate width based on effective duration (after trimming)
  const effectiveDurationMs = getEffectiveDuration(shot);
  const width = Math.max(80, (effectiveDurationMs / 1000) * pixelsPerSecond);

  // Get thumbnail URL - prioritize video thumbnail, then start frame image, then video URL
  const thumbnailUrl = shot.video?.thumbnailUrl && shot.video.thumbnailUrl.trim() 
    ? shot.video.thumbnailUrl 
    : shot.startFrameImage || null;
  const videoUrl = shot.video?.url || null;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`
        absolute h-16 rounded-lg border-2 cursor-pointer transition-all overflow-hidden
        ${isSelected ? "border-primary shadow-lg ring-2 ring-primary/20" : "border-border hover:border-primary/50"}
        ${isDragging ? "opacity-50 scale-95" : ""}
      `}
      style={{
        left: `${left}px`,
        width: `${width}px`,
      }}
    >
      {/* Thumbnail or placeholder */}
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={`Shot ${shot.order + 1}`}
          className="w-full h-full object-cover"
          style={{ maxWidth: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => {
            if (videoUrl && e.currentTarget.parentElement) {
              const videoEl = document.createElement("video");
              videoEl.src = videoUrl;
              videoEl.className = "w-full h-full object-cover";
              videoEl.style.maxWidth = '100%';
              videoEl.style.height = '100%';
              videoEl.style.objectFit = 'cover';
              videoEl.muted = true;
              videoEl.playsInline = true;
              e.currentTarget.parentElement.replaceChild(videoEl, e.currentTarget);
            }
          }}
        />
      ) : videoUrl ? (
        <video 
          src={videoUrl} 
          className="w-full h-full object-cover" 
          style={{ maxWidth: '100%', height: '100%', objectFit: 'cover' }}
          muted 
          playsInline
        />
      ) : shot.video?.status === "processing" ? (
        <div className="w-full h-full bg-muted/50 flex flex-col items-center justify-center gap-1">
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
          <span className="text-[10px] text-muted-foreground">Generating...</span>
        </div>
      ) : shot.video?.status === "failed" ? (
        <div className="w-full h-full bg-destructive/10 flex flex-col items-center justify-center gap-1">
          <Video className="h-5 w-5 text-destructive" />
          <span className="text-[10px] text-destructive">Failed</span>
        </div>
      ) : (
        <div className="w-full h-full bg-muted/50 flex items-center justify-center">
          <Video className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AUDIO TRACK ROW COMPONENT
// ============================================================================

interface AudioTrackRowProps {
  track: AudioTrack;
  isSelected: boolean;
  isDragging: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  pixelsPerSecond: number;
  left: number; // Absolute position in pixels
}

function AudioTrackRow({
  track,
  isSelected,
  isDragging,
  onClick,
  onDragStart,
  onDragOver,
  onDragEnd,
  onMouseDown,
  pixelsPerSecond,
  left,
}: AudioTrackRowProps) {
  // Calculate width based on duration
  const width = Math.max(40, (track.durationMs / 1000) * pixelsPerSecond);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onMouseDown={onMouseDown}
      className={`absolute h-10 rounded-md cursor-move transition-all overflow-hidden border ${
        isSelected 
          ? "border-primary ring-2 ring-primary/30 bg-primary/5" 
          : "border-border bg-muted/20 hover:border-primary/50"
      } ${track.muted ? "opacity-40" : ""} ${isDragging ? "opacity-50 scale-95" : ""}`}
      style={{
        left: `${left}px`,
        width: `${width}px`,
      }}
      onClick={onClick}
    >
      {/* Waveform visualization */}
      <div className="absolute inset-0">
        <AudioWaveform
          audioUrl={track.sourceUrl}
          width={width}
          height={40}
          color={isSelected ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.5)"}
        />
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
  onAudioTrackClick,
  onAudioTrackMove,
  onAddShot,
  onAddAudioTrack,
  pixelsPerSecond = 20,
}: TimelineProps) {
  const [draggedShotId, setDraggedShotId] = useState<string | null>(null);
  const [draggedAudioTrackId, setDraggedAudioTrackId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const audioTrackDraggedRef = useRef(false); // Track if drag actually occurred

  // Calculate shot positions sequentially based on order and effective durations
  const shotPositions = useMemo(() => {
    const sortedShots = [...shots].sort((a, b) => a.order - b.order);
    let currentTimeMs = 0;
    return sortedShots.map((shot) => {
      const startTimeMs = currentTimeMs;
      const effectiveDurationMs = getEffectiveDuration(shot);
      const left = (startTimeMs / 1000) * pixelsPerSecond;
      currentTimeMs += effectiveDurationMs;
      return {
        shot,
        left,
        startTimeMs,
      };
    });
  }, [shots, pixelsPerSecond]);

  // Calculate total timeline duration using effective (trimmed) durations
  const totalDurationMs = useMemo(() => {
    return shots.reduce((total, shot) => {
      return total + getEffectiveDuration(shot);
    }, 0);
  }, [shots]);

  // Calculate timeline width in pixels
  const timelineWidth = Math.max(400, (totalDurationMs / 1000) * pixelsPerSecond);

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

  // Handle audio track dragging
  const handleAudioTrackMouseDown = useCallback((trackId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const track = audioTracks.find(t => t.id === trackId);
    if (!track || !onAudioTrackMove) return;
    
    const trackRect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - trackRect.left;
    const startX = e.clientX;
    setDraggedAudioTrackId(trackId);
    audioTrackDraggedRef.current = false; // Reset drag flag

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Only consider it a drag if moved more than 3 pixels
      if (Math.abs(moveEvent.clientX - startX) > 3) {
        audioTrackDraggedRef.current = true;
      }
      if (!timelineRef.current) return;
      const timelineRect = timelineRef.current.getBoundingClientRect();
      const newX = moveEvent.clientX - timelineRect.left - offsetX;
      const newStartTimeMs = Math.max(0, (newX / pixelsPerSecond) * 1000);
      onAudioTrackMove(trackId, newStartTimeMs);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      setDraggedAudioTrackId(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [audioTracks, pixelsPerSecond, onAudioTrackMove]);

  const handleAudioTrackDragStart = useCallback((trackId: string) => {
    setDraggedAudioTrackId(trackId);
  }, []);

  const handleAudioTrackDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleAudioTrackDragEnd = useCallback(() => {
    setDraggedAudioTrackId(null);
  }, []);

  // Time markers for ruler
  const timeMarkers = useMemo(() => {
    const markers = [];
    const totalSeconds = Math.ceil(totalDurationMs / 1000) || 10;
    for (let i = 0; i <= totalSeconds; i += 5) {
      markers.push(i);
    }
    return markers;
  }, [totalDurationMs]);

  return (
    <div className="bg-card/50 backdrop-blur w-full">
      {/* Timeline Ruler */}
      <div className="border-b border-border px-2 py-1 overflow-x-auto">
        <div className="relative" style={{ minWidth: `${timelineWidth}px`, height: '24px' }}>
          {timeMarkers.map((seconds) => {
            const left = (seconds * pixelsPerSecond);
            return (
              <div
                key={seconds}
                className="absolute top-0 bottom-0 flex flex-col items-center"
                style={{ left: `${left}px`, transform: 'translateX(-50%)' }}
              >
                <div className="w-px h-2 bg-border" />
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  {seconds}s
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Shots Row */}
      <div className="border-b border-border px-2 py-2">
        <div 
          ref={timelineRef} 
          className="relative overflow-x-auto"
          style={{ height: '64px', minWidth: `${timelineWidth}px` }}
        >
          {shotPositions.map(({ shot, left }) => (
            <ShotCard
              key={shot.id}
              shot={shot}
              isSelected={selectedShotId === shot.id}
              isDragging={draggedShotId === shot.id}
              onClick={() => onShotClick(shot)}
              onDragStart={() => handleDragStart(shot.id)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(shot.id)}
              onDragEnd={handleDragEnd}
              pixelsPerSecond={pixelsPerSecond}
              left={left}
            />
          ))}
        </div>
      </div>

      {/* Audio Tracks */}
      <div className="px-2 py-2 space-y-2">
        {audioTracks.map((track) => {
          const left = (track.startTimeMs / 1000) * pixelsPerSecond;
          return (
            <div
              key={track.id}
              className="relative overflow-x-auto"
              style={{ height: '40px', minWidth: `${timelineWidth}px` }}
            >
              <AudioTrackRow
                track={track}
                isSelected={selectedAudioTrackId === track.id}
                isDragging={draggedAudioTrackId === track.id}
                onClick={() => {
                  // Only open modal if this wasn't a drag
                  if (!audioTrackDraggedRef.current) {
                    onAudioTrackClick(track);
                  }
                  audioTrackDraggedRef.current = false; // Reset for next interaction
                }}
                onDragStart={() => handleAudioTrackDragStart(track.id)}
                onDragOver={handleAudioTrackDragOver}
                onDragEnd={handleAudioTrackDragEnd}
                onMouseDown={(e) => handleAudioTrackMouseDown(track.id, e)}
                pixelsPerSecond={pixelsPerSecond}
                left={left}
              />
            </div>
          );
        })}

        {/* Add buttons */}
        <div className="flex items-center justify-center gap-4 w-full border-t border-border mt-6 pt-4">
          <button
            type="button"
            onClick={onAddShot}
            className="h-8 bg-primary text-primary-foreground rounded inline-flex items-center justify-center gap-2 px-4 text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Shot
          </button>
          <button
            type="button"
            onClick={onAddAudioTrack}
            className="h-8 border-2 border-dashed border-muted-foreground/30 rounded inline-flex items-center justify-center gap-2 px-4 text-xs hover:border-primary/50 hover:text-foreground transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Audio Track
          </button>
        </div>
      </div>
    </div>
  );
}

export { ShotCard, AudioTrackRow };
export type { TimelineProps };
