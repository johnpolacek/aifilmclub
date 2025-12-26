import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { parseScreenplay, parsedScenesToScenes } from "@/lib/screenplay-parser";

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
    const { screenplayText, projectId } = body;

    if (!screenplayText) {
      return NextResponse.json(
        { success: false, error: "Screenplay text is required" },
        { status: 400 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "Project ID is required" },
        { status: 400 }
      );
    }

    console.log(
      "[extract-scenes] Parsing screenplay:",
      JSON.stringify({ projectId, textLength: screenplayText.length }, null, 2)
    );

    // Parse the screenplay
    const parseResult = parseScreenplay(screenplayText);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error || "Failed to parse screenplay" },
        { status: 400 }
      );
    }

    // Convert to Scene objects
    const scenes = parsedScenesToScenes(projectId, parseResult.scenes);

    console.log(
      "[extract-scenes] Extracted scenes:",
      JSON.stringify({ projectId, sceneCount: scenes.length }, null, 2)
    );

    return NextResponse.json({
      success: true,
      scenes,
      count: scenes.length,
    });
  } catch (error) {
    console.error(
      "[extract-scenes] Error:",
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


