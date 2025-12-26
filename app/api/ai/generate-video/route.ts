import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateVideo } from "@/lib/ai/gemini";

export async function POST(request: Request) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { prompt, projectId, sceneId, aspectRatio = "16:9", durationSeconds = 5 } = body;

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: "Prompt is required" },
        { status: 400 }
      );
    }

    if (!projectId || !sceneId) {
      return NextResponse.json(
        { success: false, error: "Project ID and Scene ID are required" },
        { status: 400 }
      );
    }

    console.log(
      "[generate-video] Starting video generation:",
      JSON.stringify({ prompt: prompt.substring(0, 100), projectId, sceneId, aspectRatio, durationSeconds }, null, 2)
    );

    // Start video generation (async - returns job ID)
    const result = await generateVideo({
      prompt,
      aspectRatio,
      durationSeconds,
    });

    if (!result.success) {
      console.error(
        "[generate-video] Generation failed:",
        JSON.stringify({ error: result.error }, null, 2)
      );
      return NextResponse.json(
        { success: false, error: result.error || "Failed to start video generation" },
        { status: 500 }
      );
    }

    // Create video record
    const videoId = `vid-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    console.log(
      "[generate-video] Video generation started:",
      JSON.stringify({ videoId, operationId: result.videoId }, null, 2)
    );

    return NextResponse.json({
      success: true,
      video: {
        id: videoId,
        prompt,
        operationId: result.videoId, // The operation ID for polling
        model: "veo-2" as const,
        status: "processing" as const,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "[generate-video] Error:",
      JSON.stringify(
        { error: error instanceof Error ? error.message : String(error) },
        null,
        2
      )
    );

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

