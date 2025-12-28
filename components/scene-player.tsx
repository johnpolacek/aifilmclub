"use client";

import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { AudioTrack, Shot } from "@/lib/scenes-client";
import { cn } from "@/lib/utils";

interface ScenePlayerProps {
  shots: Shot[];
  audioTracks?: AudioTrack[];
  className?: string;
}

export function ScenePlayer({ shots, audioTracks = [], className }: ScenePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentShotIndex, setCurrentShotIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Track actual video durations as they load
  const [actualDurations, setActualDurations] = useState<Map<string, number>>(new Map());

  // Filter to only completed shots with videos that have a URL
  const playableShots = useMemo(() => {
    const filtered = shots
      .filter((shot) => shot.video?.status === "completed" && shot.video?.url)
      .sort((a, b) => a.order - b.order);
    
    return filtered;
  }, [shots]);

  // Calculate timeline positions for shots (using actual durations if available)
  const shotTimeline = useMemo(() => {
    let currentTimeMs = 0;
    return playableShots.map((shot) => {
      const startTime = currentTimeMs;
      // Use actual measured duration if available, otherwise stored duration or default
      const duration = actualDurations.get(shot.id) || shot.video?.durationMs || 5000;
      currentTimeMs += duration;
      return {
        shot,
        startTimeMs: startTime,
        endTimeMs: currentTimeMs,
        durationMs: duration,
      };
    });
  }, [playableShots, actualDurations]);

  // Total duration of all shots (using actual durations if available)
  const totalDurationMs = useMemo(() => {
    return shotTimeline.reduce((acc, item) => {
      const actualDuration = actualDurations.get(item.shot.id);
      return acc + (actualDuration || item.durationMs);
    }, 0);
  }, [shotTimeline, actualDurations]);

  const currentShot = playableShots[currentShotIndex];
  const hasVideos = playableShots.length > 0;
  const hasNext = currentShotIndex < playableShots.length - 1;
  const hasPrev = currentShotIndex > 0;

  // Calculate global time from current shot and video time
  const globalTimeMs = useMemo(() => {
    if (shotTimeline.length === 0) return 0;
    const shotInfo = shotTimeline[currentShotIndex];
    if (!shotInfo) return 0;
    return shotInfo.startTimeMs + currentTime * 1000;
  }, [shotTimeline, currentShotIndex, currentTime]);

  // Sync audio tracks with video playback
  const syncAudioTracks = useCallback(
    (globalTime: number, playing: boolean) => {
      audioTracks.forEach((track) => {
        const audioEl = audioRefs.current.get(track.id);
        if (!audioEl) return;

        const trackStartMs = track.startTimeMs;
        const trackEndMs = track.startTimeMs + track.durationMs;
        const trimStartMs = track.trimStartMs || 0;

        // Check if this track should be playing at the current time
        if (globalTime >= trackStartMs && globalTime < trackEndMs) {
          const trackTime = (globalTime - trackStartMs + trimStartMs) / 1000;

          // Only update if significantly different to avoid constant seeking
          if (Math.abs(audioEl.currentTime - trackTime) > 0.1) {
            audioEl.currentTime = trackTime;
          }

          audioEl.volume = track.muted ? 0 : track.volume * volume;
          audioEl.muted = isMuted || track.muted;

          if (playing && audioEl.paused) {
            audioEl.play().catch(() => {});
          } else if (!playing && !audioEl.paused) {
            audioEl.pause();
          }
        } else {
          // Track not in range, pause it
          if (!audioEl.paused) {
            audioEl.pause();
          }
        }
      });
    },
    [audioTracks, isMuted, volume]
  );

  // Play video
  const playVideo = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
      syncAudioTracks(globalTimeMs, true);
    }
  }, [globalTimeMs, syncAudioTracks]);

  // Pause video
  const pauseVideo = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
      syncAudioTracks(globalTimeMs, false);
    }
  }, [globalTimeMs, syncAudioTracks]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pauseVideo();
    } else {
      playVideo();
    }
  }, [isPlaying, pauseVideo, playVideo]);

  // Go to next shot
  const goToNextShot = useCallback(() => {
    if (hasNext) {
      setCurrentShotIndex((prev) => prev + 1);
      setCurrentTime(0);
      setVideoError(null);
    }
  }, [hasNext]);

  // Go to previous shot
  const goToPrevShot = useCallback(() => {
    // If we're more than 2 seconds into current shot, restart it
    if (currentTime > 2) {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        setCurrentTime(0);
      }
    } else if (hasPrev) {
      setCurrentShotIndex((prev) => prev - 1);
      setCurrentTime(0);
      setVideoError(null);
    }
  }, [hasPrev, currentTime]);

  // Go to specific shot
  const goToShot = useCallback(
    (index: number) => {
      if (index >= 0 && index < playableShots.length) {
        setCurrentShotIndex(index);
        setCurrentTime(0);
        setVideoError(null);
        // If we were playing, continue playing
        if (isPlaying) {
          setTimeout(() => {
            videoRef.current?.play();
          }, 50);
        }
      }
    },
    [playableShots.length, isPlaying]
  );

  // Handle video ended
  const handleVideoEnded = useCallback(() => {
    if (hasNext) {
      goToNextShot();
      // Auto-play next shot
      setTimeout(() => {
        playVideo();
      }, 50);
    } else {
      // End of scene
      setIsPlaying(false);
      syncAudioTracks(totalDurationMs, false);
    }
  }, [hasNext, goToNextShot, playVideo, syncAudioTracks, totalDurationMs]);

  // Handle video time update
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  // Sync audio when global time changes
  useEffect(() => {
    syncAudioTracks(globalTimeMs, isPlaying);
  }, [globalTimeMs, isPlaying, syncAudioTracks]);

  // Handle seeking on the progress bar
  const handleSeek = useCallback(
    (value: number[]) => {
      const seekTimeMs = value[0];

      // Find which shot this time belongs to
      const targetShot = shotTimeline.find(
        (item) => seekTimeMs >= item.startTimeMs && seekTimeMs < item.endTimeMs
      );

      if (targetShot) {
        const shotIndex = playableShots.findIndex((s) => s.id === targetShot.shot.id);
        const videoTime = (seekTimeMs - targetShot.startTimeMs) / 1000;

        if (shotIndex !== currentShotIndex) {
          setCurrentShotIndex(shotIndex);
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.currentTime = videoTime;
              if (isPlaying) {
                videoRef.current.play();
              }
            }
          }, 50);
        } else if (videoRef.current) {
          videoRef.current.currentTime = videoTime;
        }
      }
    },
    [shotTimeline, playableShots, currentShotIndex, isPlaying]
  );

  // Toggle mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  }, [isMuted]);

  // Handle volume change
  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  }, []);

  // Format time as MM:SS
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!hasVideos) {
    return (
      <div
        className={cn(
          "relative aspect-video bg-muted/30 rounded-lg border border-border flex items-center justify-center",
          className
        )}
      >
        <p className="text-muted-foreground text-sm text-center px-4 italic">
          Add shots and generate videos to preview the scene.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Video Player */}
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        {currentShot && currentShot.video?.url && (
          <video
            ref={videoRef}
            src={currentShot.video.url}
            className="w-full h-full object-contain cursor-pointer"
            onEnded={handleVideoEnded}
            onTimeUpdate={handleTimeUpdate}
            onClick={togglePlay}
            onPlay={() => {
              setIsPlaying(true);
              setVideoError(null);
            }}
            onPause={() => setIsPlaying(false)}
            onError={(e) => {
              const video = e.currentTarget;
              const error = video.error;
              const errorMessage = error ? `${error.code}: ${error.message}` : "Unknown error";
              console.error("[ScenePlayer] Video error:", JSON.stringify({
                src: video.src,
                error: errorMessage,
                networkState: video.networkState,
                readyState: video.readyState
              }, null, 2));
              setVideoError(`Failed to load video: ${errorMessage}`);
            }}
            onLoadedData={() => {
              setVideoError(null);
            }}
            onLoadedMetadata={(e) => {
              const video = e.currentTarget;
              if (video.duration && isFinite(video.duration) && currentShot) {
                const durationMs = Math.round(video.duration * 1000);
                // Only update if different from stored/default duration
                const storedDuration = currentShot.video?.durationMs || 5000;
                if (Math.abs(durationMs - storedDuration) > 100) {
                  setActualDurations(prev => {
                    const next = new Map(prev);
                    next.set(currentShot.id, durationMs);
                    return next;
                  });
                }
              }
            }}
            muted={isMuted}
            playsInline
          >
            <track kind="captions" />
          </video>
        )}

        {/* Video error state */}
        {videoError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <p className="text-red-400 text-sm text-center px-4">{videoError}</p>
          </div>
        )}

        {/* Play overlay (when paused) */}
        {!isPlaying && (
          <button
            type="button"
            onClick={playVideo}
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
          >
            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <Play className="h-8 w-8 text-black ml-1" />
            </div>
          </button>
        )}

        {/* Shot indicator */}
        <div className="absolute top-3 left-3 bg-black/60 text-white text-xs font-medium px-2 py-1 rounded">
          Shot {currentShotIndex + 1} of {playableShots.length}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <Slider
          value={[globalTimeMs]}
          min={0}
          max={totalDurationMs}
          step={100}
          onValueChange={handleSeek}
          className="cursor-pointer"
        />
        <div className="flex justify-between text-xs text-muted-foreground pt-2">
          <span>{formatTime(globalTimeMs)}</span>
          <span>{formatTime(totalDurationMs)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={goToPrevShot}
            className="bg-transparent h-8 w-8"
            title="Previous shot"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={togglePlay}
            className="bg-transparent h-9 w-9"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={goToNextShot}
            disabled={!hasNext}
            className="bg-transparent h-8 w-8"
            title="Next shot"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="h-8 w-8"
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            min={0}
            max={1}
            step={0.1}
            onValueChange={handleVolumeChange}
            className="w-20"
          />
        </div>
      </div>

      {/* Shot Timeline */}
      {playableShots.length > 1 && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {shotTimeline.map((item, index) => {
            const widthPercent = Math.max((item.durationMs / totalDurationMs) * 100, 10);
            const isActive = index === currentShotIndex;
            const isPlayed = index < currentShotIndex;

            return (
              <button
                key={item.shot.id}
                type="button"
                onClick={() => goToShot(index)}
                className={cn(
                  "shrink-0 py-1.5 px-2 rounded text-xs font-medium transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                    : isPlayed
                      ? "bg-primary/20 text-primary hover:bg-primary/30"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
                style={{ minWidth: `${widthPercent}%`, maxWidth: "150px" }}
                title={item.shot.prompt || `Shot ${index + 1}`}
              >
                Shot {index + 1}
              </button>
            );
          })}
        </div>
      )}

      {/* Hidden audio elements for audio tracks */}
      {audioTracks.map((track) => (
        <audio
          key={track.id}
          ref={(el) => {
            if (el) {
              audioRefs.current.set(track.id, el);
            } else {
              audioRefs.current.delete(track.id);
            }
          }}
          src={track.sourceUrl}
          preload="auto"
        />
      ))}
    </div>
  );
}

