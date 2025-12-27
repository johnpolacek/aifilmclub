import { google } from "@ai-sdk/google";
import { experimental_generateImage } from "ai";
import type { GenerationMode } from "@/lib/scenes";

/**
 * Google Gemini AI Service
 * Uses Vercel AI SDK for image and video generation
 * Supports Veo 3.1 for advanced video generation
 */

// ============================================================================
// IMAGE GENERATION TYPES
// ============================================================================

/**
 * Image generation options
 */
export interface ImageGenerationOptions {
  prompt: string;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  numberOfImages?: number;
}

/**
 * Image generation result
 */
export interface ImageGenerationResult {
  success: boolean;
  images?: Array<{
    base64: string;
    mimeType: string;
  }>;
  error?: string;
}

// ============================================================================
// VIDEO GENERATION TYPES (Veo 3.1)
// ============================================================================

/**
 * Video generation options for Veo 3.1
 * Supports multiple generation modes:
 * - text-only: Generate from text prompt only
 * - start-frame: Generate from start frame image + prompt
 * - start-end-frame: Generate from start and end frame images + prompt
 * - reference-images: Generate using up to 3 reference images + prompt
 */
export interface VideoGenerationOptions {
  prompt: string;
  aspectRatio?: "16:9" | "9:16";
  durationSeconds?: 5 | 8;

  // Generation mode
  generationMode?: GenerationMode;

  // Image inputs based on mode
  startFrameImage?: string; // Base64 or URL for start frame
  endFrameImage?: string; // Base64 or URL for end frame
  referenceImages?: string[]; // Up to 3 reference images (base64 or URL)
}

/**
 * Video generation result
 */
export interface VideoGenerationResult {
  success: boolean;
  videoId?: string; // Job ID for polling
  videoUrl?: string;
  status?: "pending" | "processing" | "completed" | "failed";
  durationMs?: number;
  error?: string;
}

/**
 * Generate an image using Google Gemini (Imagen 3 / Nano Banana Pro)
 * Uses Vercel AI SDK's experimental_generateImage
 */
export async function generateImage(
  options: ImageGenerationOptions
): Promise<ImageGenerationResult> {
  const { prompt, aspectRatio = "16:9", numberOfImages = 1 } = options;

  if (!prompt) {
    return { success: false, error: "Prompt is required" };
  }

  try {
    // Use Vercel AI SDK with Google provider
    // Note: Using imagen-3.0-generate-002 for image generation
    const result = await experimental_generateImage({
      model: google.image("imagen-3.0-generate-002"),
      prompt,
      n: numberOfImages,
      aspectRatio,
    });

    if (!result.images || result.images.length === 0) {
      return { success: false, error: "No images generated" };
    }

    const images = result.images.map((img) => ({
      base64: img.base64,
      mimeType: "image/png",
    }));

    return {
      success: true,
      images,
    };
  } catch (error) {
    console.error(
      "[generateImage] Error:",
      JSON.stringify(
        {
          error: error instanceof Error ? error.message : String(error),
          prompt: prompt.substring(0, 100),
        },
        null,
        2
      )
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate image",
    };
  }
}

/**
 * Convert image URL or base64 to the format expected by Veo API
 */
async function prepareImageForVeo(
  imageInput: string
): Promise<{ mimeType: string; data: string } | null> {
  try {
    // If it's already base64 data
    if (imageInput.startsWith("data:")) {
      const matches = imageInput.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        return {
          mimeType: matches[1],
          data: matches[2],
        };
      }
    }

    // If it's a URL, fetch and convert to base64
    if (imageInput.startsWith("http://") || imageInput.startsWith("https://")) {
      const response = await fetch(imageInput);
      if (!response.ok) {
        console.error(
          "[prepareImageForVeo] Failed to fetch image:",
          JSON.stringify({ url: imageInput }, null, 2)
        );
        return null;
      }
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const contentType = response.headers.get("content-type") || "image/png";
      return {
        mimeType: contentType,
        data: base64,
      };
    }

    // Assume it's raw base64
    return {
      mimeType: "image/png",
      data: imageInput,
    };
  } catch (error) {
    console.error(
      "[prepareImageForVeo] Error:",
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2)
    );
    return null;
  }
}

/**
 * Generate a video using Google Veo 3.1
 * Supports multiple generation modes:
 * - text-only: Generate from text prompt only
 * - start-frame: Generate from start frame image + prompt
 * - start-end-frame: Generate from start and end frame images + prompt
 * - reference-images: Generate using up to 3 reference images + prompt
 *
 * Note: Video generation is async - this starts the job and returns a job ID
 */
export async function generateVideo(
  options: VideoGenerationOptions
): Promise<VideoGenerationResult> {
  const {
    prompt,
    aspectRatio = "16:9",
    durationSeconds = 8,
    generationMode = "text-only",
    startFrameImage,
    endFrameImage,
    referenceImages,
  } = options;

  if (!prompt) {
    return { success: false, error: "Prompt is required" };
  }

  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      return { success: false, error: "Google API key not configured" };
    }

    // Build the request based on generation mode
    // Using Veo 3.1 model
    const modelId = "veo-3.1-generate-preview";

    // Build instance object based on generation mode
    interface VeoInstance {
      prompt: string;
      image?: { bytesBase64Encoded: string; mimeType: string };
      lastFrame?: { bytesBase64Encoded: string; mimeType: string };
      referenceImages?: Array<{ bytesBase64Encoded: string; mimeType: string }>;
    }

    const instance: VeoInstance = { prompt };

    // Add images based on generation mode
    if (generationMode === "start-frame" && startFrameImage) {
      const preparedImage = await prepareImageForVeo(startFrameImage);
      if (preparedImage) {
        instance.image = {
          bytesBase64Encoded: preparedImage.data,
          mimeType: preparedImage.mimeType,
        };
      }
    } else if (generationMode === "start-end-frame" && startFrameImage) {
      const preparedStartImage = await prepareImageForVeo(startFrameImage);
      if (preparedStartImage) {
        instance.image = {
          bytesBase64Encoded: preparedStartImage.data,
          mimeType: preparedStartImage.mimeType,
        };
      }
      if (endFrameImage) {
        const preparedEndImage = await prepareImageForVeo(endFrameImage);
        if (preparedEndImage) {
          instance.lastFrame = {
            bytesBase64Encoded: preparedEndImage.data,
            mimeType: preparedEndImage.mimeType,
          };
        }
      }
    } else if (
      generationMode === "reference-images" &&
      referenceImages &&
      referenceImages.length > 0
    ) {
      // Up to 3 reference images
      const preparedRefs: Array<{ bytesBase64Encoded: string; mimeType: string }> = [];
      for (const refImage of referenceImages.slice(0, 3)) {
        const prepared = await prepareImageForVeo(refImage);
        if (prepared) {
          preparedRefs.push({
            bytesBase64Encoded: prepared.data,
            mimeType: prepared.mimeType,
          });
        }
      }
      if (preparedRefs.length > 0) {
        instance.referenceImages = preparedRefs;
      }
    }

    console.log(
      "[generateVideo] Starting Veo 3.1 generation:",
      JSON.stringify(
        {
          mode: generationMode,
          promptLength: prompt.length,
          hasStartFrame: !!instance.image,
          hasEndFrame: !!instance.lastFrame,
          referenceCount: instance.referenceImages?.length || 0,
        },
        null,
        2
      )
    );

    // Create a video generation request using Veo 3.1
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:predictLongRunning?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instances: [instance],
          parameters: {
            aspectRatio,
            durationSeconds,
            personGeneration: "allow_adult",
            generateAudio: true, // Veo 3.1 supports native audio
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "[generateVideo] API Error:",
        JSON.stringify({ status: response.status, error: errorText }, null, 2)
      );
      return {
        success: false,
        error: `API Error: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json();

    // The response contains an operation name for polling
    const operationName = data.name;

    if (!operationName) {
      return {
        success: false,
        error: "No operation name returned",
      };
    }

    return {
      success: true,
      videoId: operationName,
      status: "processing",
    };
  } catch (error) {
    console.error(
      "[generateVideo] Error:",
      JSON.stringify(
        {
          error: error instanceof Error ? error.message : String(error),
          prompt: prompt.substring(0, 100),
        },
        null,
        2
      )
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to start video generation",
    };
  }
}

/**
 * Check the status of a video generation job
 */
export async function checkVideoStatus(videoId: string): Promise<VideoGenerationResult> {
  if (!videoId) {
    return { success: false, error: "Video ID is required" };
  }

  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      return { success: false, error: "Google API key not configured" };
    }

    // Poll the operation status
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${videoId}?key=${apiKey}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "[checkVideoStatus] API Error:",
        JSON.stringify({ status: response.status, error: errorText }, null, 2)
      );
      return {
        success: false,
        error: `API Error: ${response.status}`,
      };
    }

    const data = await response.json();

    // Check if operation is done
    if (data.done) {
      if (data.error) {
        return {
          success: false,
          videoId,
          status: "failed",
          error: data.error.message || "Video generation failed",
        };
      }

      // Extract video URL and metadata from response
      const generatedSample = data.response?.generatedSamples?.[0];
      const videoUrl = generatedSample?.video?.uri;

      if (!videoUrl) {
        return {
          success: false,
          videoId,
          status: "failed",
          error: "No video URL in response",
        };
      }

      // Extract duration if available (Veo 3.1 provides this)
      // Duration is typically in seconds, convert to ms
      const durationSeconds = generatedSample?.video?.durationSeconds;
      const durationMs = durationSeconds ? Math.round(durationSeconds * 1000) : undefined;

      return {
        success: true,
        videoId,
        videoUrl,
        status: "completed",
        durationMs,
      };
    }

    // Still processing
    return {
      success: true,
      videoId,
      status: "processing",
    };
  } catch (error) {
    console.error(
      "[checkVideoStatus] Error:",
      JSON.stringify(
        {
          error: error instanceof Error ? error.message : String(error),
          videoId,
        },
        null,
        2
      )
    );

    return {
      success: false,
      videoId,
      error: error instanceof Error ? error.message : "Failed to check video status",
    };
  }
}
