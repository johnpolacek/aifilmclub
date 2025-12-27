import type { TransitionType, Transition, Shot } from "./scenes";

/**
 * Transition utility functions
 * Provides helpers for working with transitions between shots
 */

// ============================================================================
// TRANSITION METADATA
// ============================================================================

export interface TransitionMetadata {
  type: TransitionType;
  label: string;
  icon: string;
  description: string;
  cssClass?: string;
  cssKeyframes?: string;
}

export const TRANSITION_METADATA: Record<TransitionType, TransitionMetadata> = {
  none: {
    type: "none",
    label: "Cut",
    icon: "→",
    description: "Direct cut with no transition effect",
  },
  "cross-dissolve": {
    type: "cross-dissolve",
    label: "Cross Dissolve",
    icon: "⨉",
    description: "Blend between shots with a dissolve effect",
    cssClass: "transition-cross-dissolve",
    cssKeyframes: `
      @keyframes crossDissolve {
        0% { opacity: 1; }
        100% { opacity: 0; }
      }
    `,
  },
  "fade-to-black": {
    type: "fade-to-black",
    label: "Fade to Black",
    icon: "●→",
    description: "Fade out to black",
    cssClass: "transition-fade-to-black",
    cssKeyframes: `
      @keyframes fadeToBlack {
        0% { filter: brightness(1); }
        100% { filter: brightness(0); }
      }
    `,
  },
  "fade-from-black": {
    type: "fade-from-black",
    label: "Fade from Black",
    icon: "→●",
    description: "Fade in from black",
    cssClass: "transition-fade-from-black",
    cssKeyframes: `
      @keyframes fadeFromBlack {
        0% { filter: brightness(0); }
        100% { filter: brightness(1); }
      }
    `,
  },
  "fade-to-white": {
    type: "fade-to-white",
    label: "Fade to White",
    icon: "○→",
    description: "Fade out to white",
    cssClass: "transition-fade-to-white",
    cssKeyframes: `
      @keyframes fadeToWhite {
        0% { filter: brightness(1); }
        100% { filter: brightness(2); }
      }
    `,
  },
  "fade-from-white": {
    type: "fade-from-white",
    label: "Fade from White",
    icon: "→○",
    description: "Fade in from white",
    cssClass: "transition-fade-from-white",
    cssKeyframes: `
      @keyframes fadeFromWhite {
        0% { filter: brightness(2); }
        100% { filter: brightness(1); }
      }
    `,
  },
};

// ============================================================================
// TRANSITION HELPERS
// ============================================================================

/**
 * Get the default transition
 */
export function getDefaultTransition(): Transition {
  return {
    type: "none",
    durationMs: 0,
  };
}

/**
 * Create a transition with the specified type and duration
 */
export function createTransition(
  type: TransitionType,
  durationMs: number = 1000
): Transition {
  return {
    type,
    durationMs: type === "none" ? 0 : durationMs,
  };
}

/**
 * Get all available transition types
 */
export function getTransitionTypes(): TransitionType[] {
  return Object.keys(TRANSITION_METADATA) as TransitionType[];
}

/**
 * Get transition metadata by type
 */
export function getTransitionMetadata(type: TransitionType): TransitionMetadata {
  return TRANSITION_METADATA[type];
}

// ============================================================================
// TRANSITION TIMING
// ============================================================================

/**
 * Calculate when a transition starts and ends within the timeline
 */
export function getTransitionTiming(
  shot: Shot,
  shotStartTimeMs: number
): { transitionStartMs: number; transitionEndMs: number } | null {
  if (shot.transitionOut.type === "none") {
    return null;
  }

  const videoDurationMs = shot.video?.durationMs || 5000;
  const transitionStartMs = shotStartTimeMs + videoDurationMs;
  const transitionEndMs = transitionStartMs + shot.transitionOut.durationMs;

  return {
    transitionStartMs,
    transitionEndMs,
  };
}

/**
 * Check if a specific time is within a transition
 */
export function isInTransition(
  shots: Shot[],
  currentTimeMs: number
): { inTransition: boolean; shot: Shot | null; progress: number } {
  let accumulatedTimeMs = 0;

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const videoDurationMs = shot.video?.durationMs || 5000;
    const videoEndMs = accumulatedTimeMs + videoDurationMs;

    // Check if we're past this shot's video
    if (currentTimeMs >= videoEndMs) {
      // Check if we're in this shot's transition
      if (shot.transitionOut.type !== "none" && i < shots.length - 1) {
        const transitionEndMs = videoEndMs + shot.transitionOut.durationMs;
        if (currentTimeMs < transitionEndMs) {
          const progress = (currentTimeMs - videoEndMs) / shot.transitionOut.durationMs;
          return {
            inTransition: true,
            shot,
            progress: Math.min(1, Math.max(0, progress)),
          };
        }
        accumulatedTimeMs = transitionEndMs;
      } else {
        accumulatedTimeMs = videoEndMs;
      }
    } else {
      break;
    }
  }

  return { inTransition: false, shot: null, progress: 0 };
}

// ============================================================================
// CSS GENERATION FOR TRANSITIONS
// ============================================================================

/**
 * Generate CSS for all transition keyframes
 */
export function generateTransitionCSS(): string {
  let css = "/* Auto-generated transition keyframes */\n";

  for (const metadata of Object.values(TRANSITION_METADATA)) {
    if (metadata.cssKeyframes) {
      css += metadata.cssKeyframes + "\n";
    }
  }

  // Add utility classes for transitions
  css += `
.transition-cross-dissolve-out {
  animation: crossDissolve var(--transition-duration, 1s) ease-in-out forwards;
}

.transition-cross-dissolve-in {
  animation: crossDissolve var(--transition-duration, 1s) ease-in-out reverse forwards;
}

.transition-fade-to-black-out {
  animation: fadeToBlack var(--transition-duration, 1s) ease-in-out forwards;
}

.transition-fade-from-black-in {
  animation: fadeFromBlack var(--transition-duration, 1s) ease-in-out forwards;
}

.transition-fade-to-white-out {
  animation: fadeToWhite var(--transition-duration, 1s) ease-in-out forwards;
}

.transition-fade-from-white-in {
  animation: fadeFromWhite var(--transition-duration, 1s) ease-in-out forwards;
}
`;

  return css;
}

/**
 * Get the CSS class for a transition effect
 */
export function getTransitionClass(
  type: TransitionType,
  direction: "in" | "out"
): string {
  if (type === "none") return "";
  
  const metadata = TRANSITION_METADATA[type];
  if (!metadata.cssClass) return "";
  
  return `${metadata.cssClass}-${direction}`;
}

// ============================================================================
// TRANSITION PREVIEW
// ============================================================================

/**
 * Calculate the visual state during a transition for preview purposes
 * Returns opacity and filter values for the outgoing and incoming shots
 */
export function calculateTransitionState(
  type: TransitionType,
  progress: number // 0 to 1
): {
  outgoing: { opacity: number; filter: string };
  incoming: { opacity: number; filter: string };
} {
  switch (type) {
    case "cross-dissolve":
      return {
        outgoing: { opacity: 1 - progress, filter: "none" },
        incoming: { opacity: progress, filter: "none" },
      };

    case "fade-to-black":
      if (progress < 0.5) {
        // First half: fade outgoing to black
        return {
          outgoing: { opacity: 1, filter: `brightness(${1 - progress * 2})` },
          incoming: { opacity: 0, filter: "brightness(0)" },
        };
      } else {
        // Second half: fade incoming from black
        return {
          outgoing: { opacity: 0, filter: "brightness(0)" },
          incoming: { opacity: 1, filter: `brightness(${(progress - 0.5) * 2})` },
        };
      }

    case "fade-from-black":
      // Same as fade-to-black but reversed
      return calculateTransitionState("fade-to-black", 1 - progress);

    case "fade-to-white":
      if (progress < 0.5) {
        return {
          outgoing: { opacity: 1, filter: `brightness(${1 + progress * 2})` },
          incoming: { opacity: 0, filter: "brightness(2)" },
        };
      } else {
        return {
          outgoing: { opacity: 0, filter: "brightness(2)" },
          incoming: { opacity: 1, filter: `brightness(${2 - (progress - 0.5) * 2})` },
        };
      }

    case "fade-from-white":
      return calculateTransitionState("fade-to-white", 1 - progress);

    case "none":
    default:
      return {
        outgoing: { opacity: progress < 0.5 ? 1 : 0, filter: "none" },
        incoming: { opacity: progress >= 0.5 ? 1 : 0, filter: "none" },
      };
  }
}

