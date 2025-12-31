import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getScene, saveScene } from "@/lib/scenes";

const COMPOSER_URL = process.env.VIDEO_COMPOSER_URL;
const COMPOSER_SECRET = process.env.VIDEO_COMPOSER_SECRET;

/**
 * POST /api/scenes/[sceneId]/compose
 * Start a video composition job for a scene
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sceneId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sceneId } = await params;

    // Get projectId from request body
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    // Check if composer is configured
    if (!COMPOSER_URL || !COMPOSER_SECRET) {
      console.error(
        "[compose] Video composer not configured:",
        JSON.stringify({ hasUrl: !!COMPOSER_URL, hasSecret: !!COMPOSER_SECRET }, null, 2)
      );
      return NextResponse.json(
        { error: "Video composer service not configured" },
        { status: 503 }
      );
    }

    const scene = await getScene(projectId, sceneId);

    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    // Check if there are any completed shots
    const completedShots = scene.shots.filter(
      (s) => s.video?.status === "completed" && s.video?.url
    );

    if (completedShots.length === 0) {
      return NextResponse.json(
        { error: "No completed shots to render" },
        { status: 400 }
      );
    }

    // Generate job ID
    const jobId = uuid();

    // Build webhook URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const webhookUrl = `${appUrl}/api/scenes/${sceneId}/compose/webhook?projectId=${projectId}`;

    // Prepare composition request
    const compositionRequest = {
      jobId,
      projectId: scene.projectId,
      sceneId: scene.id,
      webhookUrl,
      shots: completedShots.map((s) => ({
        id: s.id,
        order: s.order,
        videoUrl: s.video!.url,
        durationMs: s.video!.durationMs || 5000,
        // If originalVideo exists, trim is already baked in
        trimStartMs: s.originalVideo ? 0 : s.trimStartMs || 0,
        trimEndMs: s.originalVideo ? 0 : s.trimEndMs || 0,
        audioMuted: s.audioMuted || false,
      })),
      audioTracks: (scene.audioTracks || [])
        .filter((t) => !t.muted)
        .map((t) => ({
          id: t.id,
          sourceUrl: t.sourceUrl,
          startTimeMs: t.startTimeMs,
          durationMs: t.durationMs,
          // If originalSourceUrl exists, trim is already baked in
          trimStartMs: t.originalSourceUrl ? 0 : t.trimStartMs || 0,
          volume: t.volume,
          muted: t.muted,
        })),
    };

    console.log(
      "[compose] Sending composition request:",
      JSON.stringify(
        {
          jobId,
          projectId,
          sceneId,
          shotCount: compositionRequest.shots.length,
          audioTrackCount: compositionRequest.audioTracks.length,
          webhookUrl,
        },
        null,
        2
      )
    );

    // Send to Render worker
    const response = await fetch(`${COMPOSER_URL}/compose`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${COMPOSER_SECRET}`,
      },
      body: JSON.stringify(compositionRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "[compose] Composer error:",
        JSON.stringify({ status: response.status, error: errorText }, null, 2)
      );
      throw new Error(`Composer returned ${response.status}: ${errorText}`);
    }

    // Update scene status
    await saveScene(projectId, {
      ...scene,
      compositeStatus: "processing",
      compositeVideo: {
        ...(scene.compositeVideo || { url: "", durationMs: 0, renderedAt: "" }),
        jobId,
      },
      compositeError: undefined,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      jobId,
      status: "processing",
    });
  } catch (error) {
    console.error(
      "[compose] Error:",
      JSON.stringify(
        { error: error instanceof Error ? error.message : String(error) },
        null,
        2
      )
    );
    return NextResponse.json(
      { error: "Failed to start composition" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/scenes/[sceneId]/compose
 * Get the composition status for a scene
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sceneId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sceneId } = await params;
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId query param is required" },
        { status: 400 }
      );
    }

    const scene = await getScene(projectId, sceneId);

    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    return NextResponse.json({
      status: scene.compositeStatus || null,
      compositeVideo: scene.compositeVideo || null,
      error: scene.compositeError || null,
    });
  } catch (error) {
    console.error(
      "[compose-status] Error:",
      JSON.stringify(
        { error: error instanceof Error ? error.message : String(error) },
        null,
        2
      )
    );
    return NextResponse.json(
      { error: "Failed to get composition status" },
      { status: 500 }
    );
  }
}

