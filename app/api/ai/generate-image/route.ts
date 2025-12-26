import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateImage } from "@/lib/ai/gemini";
import { uploadImageFromBuffer } from "@/lib/s3";

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
    const { prompt, projectId, sceneId, aspectRatio = "16:9" } = body;

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
      "[generate-image] Starting image generation:",
      JSON.stringify({ prompt: prompt.substring(0, 100), projectId, sceneId, aspectRatio }, null, 2)
    );

    // Generate image using Gemini
    const result = await generateImage({
      prompt,
      aspectRatio,
      numberOfImages: 1,
    });

    if (!result.success || !result.images || result.images.length === 0) {
      console.error(
        "[generate-image] Generation failed:",
        JSON.stringify({ error: result.error }, null, 2)
      );
      return NextResponse.json(
        { success: false, error: result.error || "Failed to generate image" },
        { status: 500 }
      );
    }

    // Upload image to S3
    const imageId = `img-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const imageBuffer = Buffer.from(result.images[0].base64, "base64");
    const imageKey = `generated/images/${projectId}/${sceneId}/${imageId}.png`;

    const imageUrl = await uploadImageFromBuffer(imageBuffer, imageKey);

    console.log(
      "[generate-image] Image uploaded successfully:",
      JSON.stringify({ imageId, imageUrl }, null, 2)
    );

    return NextResponse.json({
      success: true,
      image: {
        id: imageId,
        prompt,
        imageUrl,
        model: "imagen-3" as const,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "[generate-image] Error:",
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

