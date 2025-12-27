import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { checkVideoStatus } from "@/lib/ai/gemini";
import { uploadImageFromBuffer } from "@/lib/s3";

export async function GET(request: Request) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const operationId = searchParams.get("operationId");
    const projectId = searchParams.get("projectId");
    const sceneId = searchParams.get("sceneId");
    const videoId = searchParams.get("videoId");

    if (!operationId) {
      return NextResponse.json(
        { success: false, error: "Operation ID is required" },
        { status: 400 }
      );
    }

    console.log(
      "[video-status] Checking status:",
      JSON.stringify({ operationId, projectId, sceneId, videoId }, null, 2)
    );

    // Check video status
    const result = await checkVideoStatus(operationId);

    if (!result.success) {
      console.error(
        "[video-status] Check failed:",
        JSON.stringify({ error: result.error }, null, 2)
      );
      return NextResponse.json(
        { success: false, error: result.error || "Failed to check video status" },
        { status: 500 }
      );
    }

    // If video is completed and we have a URL, optionally download and store in S3
    let finalVideoUrl = result.videoUrl;
    
    if (result.status === "completed" && result.videoUrl && projectId && sceneId) {
      try {
        // Download video and upload to S3 for permanent storage
        const videoResponse = await fetch(result.videoUrl);
        if (videoResponse.ok) {
          const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
          const videoKey = `generated/videos/${projectId}/${sceneId}/${videoId || operationId}.mp4`;
          
          // Upload to S3 using the file upload function
          const { uploadFileFromBuffer } = await import("@/lib/s3");
          finalVideoUrl = await uploadFileFromBuffer(videoBuffer, videoKey, "video/mp4");
          
          console.log(
            "[video-status] Video uploaded to S3:",
            JSON.stringify({ videoKey, finalVideoUrl }, null, 2)
          );
        }
      } catch (uploadError) {
        // Log but don't fail - we still have the original URL
        console.error(
          "[video-status] Failed to upload video to S3:",
          JSON.stringify({ error: uploadError instanceof Error ? uploadError.message : String(uploadError) }, null, 2)
        );
      }
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      videoUrl: finalVideoUrl,
      operationId,
      durationMs: result.durationMs, // Video duration in milliseconds (from Veo 3.1)
    });
  } catch (error) {
    console.error(
      "[video-status] Error:",
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


