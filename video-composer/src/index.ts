import express, { type Request, type Response } from "express";
import { processComposition } from "./composer.js";
import type { CompositionRequest } from "./types.js";

const app = express();
app.use(express.json({ limit: "50mb" }));

const API_SECRET = process.env.API_SECRET;

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Composition endpoint
app.post("/compose", async (req: Request, res: Response) => {
  // Verify shared secret
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${API_SECRET}`) {
    console.log(
      "[compose] Unauthorized request:",
      JSON.stringify({ authHeader: authHeader?.substring(0, 20) }, null, 2)
    );
    return res.status(401).json({ error: "Unauthorized" });
  }

  const request: CompositionRequest = req.body;

  // Validate request
  if (!request.jobId || !request.projectId || !request.sceneId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!request.shots || request.shots.length === 0) {
    return res.status(400).json({ error: "No shots provided" });
  }

  console.log(
    "[compose] Starting composition job:",
    JSON.stringify(
      {
        jobId: request.jobId,
        projectId: request.projectId,
        sceneId: request.sceneId,
        shotCount: request.shots.length,
        audioTrackCount: request.audioTracks?.length || 0,
      },
      null,
      2
    )
  );

  // Return immediately, process in background
  res.json({
    jobId: request.jobId,
    status: "processing",
  });

  // Process asynchronously
  processComposition(request).catch((error) => {
    console.error(
      "[compose] Unhandled error:",
      JSON.stringify(
        { error: error instanceof Error ? error.message : String(error) },
        null,
        2
      )
    );
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Video composer listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

