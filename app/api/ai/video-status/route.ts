import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { checkVideoStatus } from "@/lib/ai/gemini";
import { uploadImageFromBuffer } from "@/lib/s3";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Extract a frame from the middle of a video using ffmpeg
 */
async function extractVideoThumbnail(
  videoBuffer: Buffer,
  durationMs: number
): Promise<Buffer | null> {
  console.log(
    "[extractVideoThumbnail] Starting thumbnail extraction:",
    JSON.stringify({ 
      videoBufferSize: videoBuffer.length, 
      durationMs,
      durationSeconds: durationMs / 1000 
    }, null, 2)
  );

  try {
    const ffmpeg = await import("fluent-ffmpeg").catch(() => null);
    if (!ffmpeg) {
      console.log(
        "[extractVideoThumbnail] ffmpeg not available for thumbnail extraction"
      );
      return null;
    }

    console.log("[extractVideoThumbnail] ffmpeg module loaded successfully");

    // Create temporary files
    const tempVideoPath = join(tmpdir(), `video-${Date.now()}.mp4`);
    const tempImagePath = join(tmpdir(), `thumbnail-${Date.now()}.jpg`);

    console.log(
      "[extractVideoThumbnail] Created temp files:",
      JSON.stringify({ tempVideoPath, tempImagePath }, null, 2)
    );

    try {
      // Write video buffer to temp file
      writeFileSync(tempVideoPath, videoBuffer);
      console.log(
        "[extractVideoThumbnail] Video buffer written to temp file:",
        JSON.stringify({ tempVideoPath, bufferSize: videoBuffer.length }, null, 2)
      );

      // Calculate middle timestamp (in seconds)
      const durationSeconds = durationMs / 1000;
      const middleTime = durationSeconds / 2;

      console.log(
        "[extractVideoThumbnail] Extracting frame at middle:",
        JSON.stringify({ durationSeconds, middleTime }, null, 2)
      );

      // Extract frame at middle of video
      await new Promise<void>((resolve, reject) => {
        ffmpeg.default(tempVideoPath)
          .seekInput(middleTime)
          .frames(1)
          .output(tempImagePath)
          .on("end", () => {
            console.log(
              "[extractVideoThumbnail] Frame extraction completed successfully"
            );
            resolve();
          })
          .on("error", (err: Error) => {
            console.error(
              "[extractVideoThumbnail] ffmpeg error:",
              JSON.stringify({ error: err.message, stack: err.stack }, null, 2)
            );
            reject(err);
          })
          .run();
      });

      // Read the thumbnail image
      const thumbnailBuffer = Buffer.from(readFileSync(tempImagePath));
      console.log(
        "[extractVideoThumbnail] Thumbnail extracted successfully:",
        JSON.stringify({ 
          thumbnailBufferSize: thumbnailBuffer.length,
          tempImagePath 
        }, null, 2)
      );

      return thumbnailBuffer;
    } finally {
      // Clean up temp files
      try {
        unlinkSync(tempVideoPath);
        unlinkSync(tempImagePath);
      } catch (cleanupError) {
        console.error(
          "[video-status] Error cleaning up temp files:",
          JSON.stringify({ error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) }, null, 2)
        );
      }
    }
  } catch (error) {
    console.error(
      "[video-status] Error extracting thumbnail:",
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2)
    );
    return null;
  }
}

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
    let thumbnailUrl: string | undefined;
    
    console.log(
      "[video-status] Processing video completion:",
      JSON.stringify({ 
        status: result.status, 
        hasVideoUrl: !!result.videoUrl,
        videoUrl: result.videoUrl?.substring(0, 100),
        projectId, 
        sceneId,
        durationMs: result.durationMs 
      }, null, 2)
    );
    
    if (result.status === "completed" && result.videoUrl && projectId && sceneId) {
      try {
        console.log(
          "[video-status] Downloading video for S3 upload:",
          JSON.stringify({ videoUrl: result.videoUrl.substring(0, 100) }, null, 2)
        );

        // Download video and upload to S3 for permanent storage
        const videoResponse = await fetch(result.videoUrl);
        console.log(
          "[video-status] Video download response:",
          JSON.stringify({ 
            ok: videoResponse.ok, 
            status: videoResponse.status,
            contentType: videoResponse.headers.get("content-type"),
            contentLength: videoResponse.headers.get("content-length")
          }, null, 2)
        );

        if (videoResponse.ok) {
          const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
          const videoKey = `generated/videos/${projectId}/${sceneId}/${videoId || operationId}.mp4`;
          
          console.log(
            "[video-status] Video buffer received:",
            JSON.stringify({ 
              bufferSize: videoBuffer.length,
              videoKey 
            }, null, 2)
          );
          
          // Upload to S3 using the file upload function
          const { uploadFileFromBuffer } = await import("@/lib/s3");
          finalVideoUrl = await uploadFileFromBuffer(videoBuffer, videoKey, "video/mp4");
          
          console.log(
            "[video-status] Video uploaded to S3:",
            JSON.stringify({ videoKey, finalVideoUrl }, null, 2)
          );

          // Generate thumbnail from middle of video
          const durationMs = result.durationMs || 8000; // Default to 8 seconds if not provided
          console.log(
            "[video-status] Starting thumbnail generation:",
            JSON.stringify({ durationMs, videoBufferSize: videoBuffer.length }, null, 2)
          );

          const thumbnailBuffer = await extractVideoThumbnail(videoBuffer, durationMs);
          
          if (thumbnailBuffer) {
            const thumbnailKey = `generated/thumbnails/${projectId}/${sceneId}/${videoId || operationId}.jpg`;
            console.log(
              "[video-status] Uploading thumbnail to S3:",
              JSON.stringify({ thumbnailKey, thumbnailBufferSize: thumbnailBuffer.length }, null, 2)
            );

            thumbnailUrl = await uploadImageFromBuffer(
              thumbnailBuffer,
              thumbnailKey,
              "image/jpeg"
            );
            
            console.log(
              "[video-status] Thumbnail generated and uploaded successfully:",
              JSON.stringify({ thumbnailKey, thumbnailUrl }, null, 2)
            );
          } else {
            console.log(
              "[video-status] Thumbnail generation returned null - no thumbnail created"
            );
          }
        } else {
          console.error(
            "[video-status] Video download failed:",
            JSON.stringify({ 
              status: videoResponse.status, 
              statusText: videoResponse.statusText 
            }, null, 2)
          );
        }
      } catch (uploadError) {
        // Log but don't fail - we still have the original URL
        console.error(
          "[video-status] Failed to upload video to S3:",
          JSON.stringify({ 
            error: uploadError instanceof Error ? uploadError.message : String(uploadError),
            stack: uploadError instanceof Error ? uploadError.stack : undefined
          }, null, 2)
        );
      }
    } else {
      console.log(
        "[video-status] Skipping thumbnail generation:",
        JSON.stringify({ 
          status: result.status,
          hasVideoUrl: !!result.videoUrl,
          hasProjectId: !!projectId,
          hasSceneId: !!sceneId
        }, null, 2)
      );
    }

    const responseData = {
      success: true,
      status: result.status,
      videoUrl: finalVideoUrl,
      thumbnailUrl,
      operationId,
      durationMs: result.durationMs,
    };

    console.log(
      "[video-status] Returning response:",
      JSON.stringify({ 
        ...responseData,
        videoUrl: responseData.videoUrl?.substring(0, 100),
        thumbnailUrl: responseData.thumbnailUrl?.substring(0, 100)
      }, null, 2)
    );

    return NextResponse.json(responseData);
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


