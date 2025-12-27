/**
 * Client-safe scene utilities
 * These functions and types can be used in client components
 * without importing server-side dependencies (S3, etc.)
 */

// ============================================================================
// TRANSITION TYPES
// ============================================================================

/**
 * Transition types between shots
 */
export type TransitionType =
  | "none" // Hard cut
  | "cross-dissolve" // Blend between shots
  | "fade-to-black" // Fade out to black
  | "fade-from-black" // Fade in from black
  | "fade-to-white" // Fade out to white
  | "fade-from-white"; // Fade in from white

/**
 * Transition configuration
 */
export interface Transition {
  type: TransitionType;
  durationMs: number; // 500-2000ms typically
}

// ============================================================================
// SHOT TYPES
// ============================================================================

/**
 * Video generation modes for Veo 3.1
 */
export type GenerationMode =
  | "text-only" // Generate from text prompt only
  | "start-frame" // Generate from start frame image + prompt
  | "start-end-frame" // Generate from start and end frame images + prompt
  | "reference-images"; // Generate using up to 3 reference images + prompt

/**
 * Video source type
 */
export type VideoSourceType = "uploaded" | "generated";

/**
 * Video status in a shot
 */
export interface ShotVideo {
  url: string;
  status: "pending" | "processing" | "completed" | "failed";
  operationId?: string; // For polling Veo status
  durationMs?: number; // Video duration for timeline
  error?: string;
}

/**
 * Shot interface - represents a single shot/clip in a scene's timeline
 */
export interface Shot {
  id: string;
  order: number; // Position in timeline
  title: string;
  prompt: string; // Text prompt for generation

  // Video source configuration
  sourceType: VideoSourceType;
  generationMode?: GenerationMode;

  // Images for generation
  startFrameImage?: string; // URL for start frame
  endFrameImage?: string; // URL for end frame
  referenceImages?: string[]; // Up to 3 reference/ingredient images

  // Final video
  video?: ShotVideo;

  // Transition to next shot
  transitionOut: Transition;

  // Timeline position (calculated from order + durations)
  startTimeMs?: number;

  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// AUDIO TRACK TYPES
// ============================================================================

/**
 * Audio source type
 */
export type AudioSourceType = "imported" | "extracted";

/**
 * Audio track interface - represents an audio layer in the timeline
 */
export interface AudioTrack {
  id: string;
  name: string;
  sourceType: AudioSourceType;
  sourceUrl: string; // URL to audio file
  sourceVideoShotId?: string; // If extracted, which shot it came from

  // Timeline positioning
  startTimeMs: number; // Where audio starts on timeline
  durationMs: number; // Audio duration
  trimStartMs?: number; // Trim from beginning of source
  trimEndMs?: number; // Trim from end of source

  // Audio settings
  volume: number; // 0.0 to 1.0
  muted: boolean;

  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// SCENE INTERFACE
// ============================================================================

/**
 * Generated image from AI (legacy - used for reference images)
 */
export interface GeneratedImage {
  id: string;
  prompt: string;
  imageUrl: string;
  model: "nano-banana-pro" | "imagen-3" | "other";
  createdAt: string;
}

/**
 * Generated video from AI (legacy - migrated to Shot)
 */
export interface GeneratedVideo {
  id: string;
  prompt: string;
  videoUrl: string;
  thumbnailUrl?: string;
  model: "veo-3.1" | "veo-2" | "other";
  status: "pending" | "processing" | "completed" | "failed";
  duration?: number; // Duration in seconds
  createdAt: string;
  completedAt?: string;
  error?: string;
}

/**
 * Scene interface - represents a single scene in a film project
 */
export interface Scene {
  id: string;
  projectId: string;
  sceneNumber: number;
  title: string;
  screenplay: string; // Scene-specific screenplay text
  characters: string[]; // Character IDs present in this scene
  locationId?: string; // Reference to a project location by name

  // Timeline content (new shot-based architecture)
  shots: Shot[]; // Ordered video timeline
  audioTracks: AudioTrack[]; // Multiple audio layers

  // Legacy fields (kept for migration compatibility)
  generatedImages?: GeneratedImage[];
  generatedVideos?: GeneratedVideo[];

  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// CLIENT-SAFE HELPER FUNCTIONS
// ============================================================================

/**
 * Create a new shot with default values
 */
export function createNewShot(order: number, title?: string): Shot {
  const now = new Date().toISOString();
  return {
    id: `shot-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    order,
    title: title || `Shot ${order + 1}`,
    prompt: "",
    sourceType: "generated",
    generationMode: "text-only",
    transitionOut: {
      type: "none",
      durationMs: 0,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a new audio track
 */
export function createNewAudioTrack(
  name: string,
  sourceType: AudioSourceType,
  sourceUrl: string,
  startTimeMs: number = 0,
  durationMs: number = 0
): AudioTrack {
  const now = new Date().toISOString();
  return {
    id: `audio-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    name,
    sourceType,
    sourceUrl,
    startTimeMs,
    durationMs,
    volume: 1.0,
    muted: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Calculate timeline positions for all shots in a scene
 * Based on video durations and transition durations
 */
export function calculateTimelinePositions(shots: Shot[]): Shot[] {
  let currentTimeMs = 0;

  return shots.map((shot, index) => {
    const updatedShot = {
      ...shot,
      startTimeMs: currentTimeMs,
    };

    // Add video duration (default to 5 seconds if not set)
    const videoDurationMs = shot.video?.durationMs || 5000;
    currentTimeMs += videoDurationMs;

    // Add transition duration (if not the last shot)
    if (index < shots.length - 1) {
      currentTimeMs += shot.transitionOut.durationMs;
    }

    return updatedShot;
  });
}

/**
 * Get total timeline duration for a scene
 */
export function getSceneDuration(scene: Scene): number {
  if (!scene.shots || scene.shots.length === 0) {
    return 0;
  }

  let totalMs = 0;
  scene.shots.forEach((shot, index) => {
    // Add video duration (default to 5 seconds if not set)
    totalMs += shot.video?.durationMs || 5000;
    // Add transition duration (except for last shot)
    if (index < scene.shots.length - 1) {
      totalMs += shot.transitionOut.durationMs;
    }
  });

  return totalMs;
}

