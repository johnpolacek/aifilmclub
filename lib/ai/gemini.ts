import { google } from "@ai-sdk/google";
import { experimental_generateImage } from "ai";

/**
 * Google Gemini AI Service
 * Uses Vercel AI SDK for image and video generation
 */

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

/**
 * Video generation options
 */
export interface VideoGenerationOptions {
  prompt: string;
  aspectRatio?: "16:9" | "9:16";
  durationSeconds?: 5 | 8;
  image?: string; // Optional reference image URL or base64
}

/**
 * Video generation result
 */
export interface VideoGenerationResult {
  success: boolean;
  videoId?: string; // Job ID for polling
  videoUrl?: string;
  status?: "pending" | "processing" | "completed" | "failed";
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
 * Generate a video using Google Gemini (Veo 2)
 * Note: Video generation is async - this starts the job and returns a job ID
 */
export async function generateVideo(
  options: VideoGenerationOptions
): Promise<VideoGenerationResult> {
  const { prompt, aspectRatio = "16:9", durationSeconds = 5 } = options;

  if (!prompt) {
    return { success: false, error: "Prompt is required" };
  }

  try {
    // Note: As of now, Veo video generation through Vercel AI SDK may require
    // direct API calls or specific setup. This is a placeholder for the implementation.
    // The actual implementation will depend on how Vercel exposes Veo through their SDK.
    
    // For now, we'll use the Google Generative AI API directly for video generation
    // This requires the GOOGLE_GENERATIVE_AI_API_KEY or GOOGLE_GEMINI_API_KEY env var
    
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    
    if (!apiKey) {
      return { success: false, error: "Google API key not configured" };
    }

    // Create a video generation request
    // Note: This is using the Generative Language API for video generation
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instances: [
            {
              prompt,
            },
          ],
          parameters: {
            aspectRatio,
            durationSeconds,
            personGeneration: "allow_adult",
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
        error: `API Error: ${response.status}`,
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
export async function checkVideoStatus(
  videoId: string
): Promise<VideoGenerationResult> {
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

      // Extract video URL from response
      const videoUrl = data.response?.generatedSamples?.[0]?.video?.uri;
      
      if (!videoUrl) {
        return {
          success: false,
          videoId,
          status: "failed",
          error: "No video URL in response",
        };
      }

      return {
        success: true,
        videoId,
        videoUrl,
        status: "completed",
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

