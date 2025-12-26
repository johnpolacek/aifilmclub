import { getObjectFromS3, listObjectsInS3, putObjectToS3 } from "./s3";
import { getProject, saveProject } from "./projects";

const SCENES_PREFIX = "scenes/";

/**
 * Scene interface - represents a single scene in a film project
 */
export interface Scene {
  id: string;
  projectId: string;
  sceneNumber: number;
  title: string;
  screenplay: string; // Scene-specific screenplay text
  characters: string[]; // Character IDs present in this scene
  generatedImages: GeneratedImage[];
  generatedVideos: GeneratedVideo[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Generated image from AI
 */
export interface GeneratedImage {
  id: string;
  prompt: string;
  imageUrl: string;
  model: "nano-banana-pro" | "imagen-3" | "other";
  createdAt: string;
}

/**
 * Generated video from AI
 */
export interface GeneratedVideo {
  id: string;
  prompt: string;
  videoUrl: string;
  thumbnailUrl?: string;
  model: "veo-3.1" | "veo-2" | "other";
  status: "pending" | "processing" | "completed" | "failed";
  duration?: number; // Duration in seconds
  createdAt: string;
  completedAt?: string;
  error?: string;
}

/**
 * Get the S3 key for a scene
 */
function getSceneKey(projectId: string, sceneId: string): string {
  return `${SCENES_PREFIX}${projectId}/${sceneId}.json`;
}

/**
 * Get a scene by ID
 * First checks the project's scenes array, then falls back to separate S3 storage
 */
export async function getScene(projectId: string, sceneId: string): Promise<Scene | null> {
  try {
    // First, try to get the scene from the project's scenes array
    const project = await getProject(projectId);
    if (project?.scenes) {
      const sceneFromProject = project.scenes.find((s) => s.id === sceneId);
      if (sceneFromProject) {
        return sceneFromProject;
      }
    }

    // Fallback: try to get from separate S3 storage (for new scenes)
    const key = getSceneKey(projectId, sceneId);
    const data = await getObjectFromS3(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as Scene;
  } catch (error) {
    console.error("Error getting scene:", JSON.stringify({ projectId, sceneId, error }, null, 2));
    return null;
  }
}

/**
 * Save a scene (create or update)
 * If the scene exists in the project's scenes array, update it there
 * Otherwise, save to separate S3 storage
 */
export async function saveScene(projectId: string, sceneData: Scene): Promise<void> {
  try {
    // First, check if this scene exists in the project's scenes array
    const project = await getProject(projectId);
    
    if (project) {
      const scenes = project.scenes || [];
      const existingIndex = scenes.findIndex((s) => s.id === sceneData.id);
      
      if (existingIndex !== -1) {
        // Update existing scene in project
        scenes[existingIndex] = sceneData;
        await saveProject(projectId, { ...project, scenes });
        return;
      } else {
        // Add new scene to project's scenes array
        scenes.push(sceneData);
        // Sort by scene number
        scenes.sort((a, b) => a.sceneNumber - b.sceneNumber);
        await saveProject(projectId, { ...project, scenes });
        return;
      }
    }

    // Fallback: save to separate S3 storage
    const key = getSceneKey(projectId, sceneData.id);
    const body = JSON.stringify(sceneData, null, 2);
    await putObjectToS3(key, body);
  } catch (error) {
    console.error("Error saving scene:", JSON.stringify({ projectId, sceneId: sceneData.id, error }, null, 2));
    throw error;
  }
}

/**
 * List all scenes for a project
 */
export async function listScenesForProject(projectId: string): Promise<Scene[]> {
  try {
    const prefix = `${SCENES_PREFIX}${projectId}/`;
    const keys = await listObjectsInS3(prefix);

    const scenes: Scene[] = [];

    await Promise.all(
      keys
        .filter((key) => key.endsWith(".json"))
        .map(async (key) => {
          try {
            const data = await getObjectFromS3(key);
            if (data) {
              const scene = JSON.parse(data) as Scene;
              scenes.push(scene);
            }
          } catch (error) {
            console.error("Error reading scene:", JSON.stringify({ key, error }, null, 2));
          }
        })
    );

    // Sort by scene number
    return scenes.sort((a, b) => a.sceneNumber - b.sceneNumber);
  } catch (error) {
    console.error("Error listing scenes:", JSON.stringify({ projectId, error }, null, 2));
    return [];
  }
}

/**
 * Delete a scene
 * If the scene exists in the project's scenes array, remove it from there
 * Otherwise, delete from separate S3 storage
 */
export async function deleteScene(projectId: string, sceneId: string): Promise<void> {
  try {
    // First, check if this scene exists in the project's scenes array
    const project = await getProject(projectId);
    
    if (project?.scenes) {
      const existingIndex = project.scenes.findIndex((s) => s.id === sceneId);
      
      if (existingIndex !== -1) {
        // Remove scene from project and renumber remaining scenes
        const updatedScenes = project.scenes.filter((s) => s.id !== sceneId);
        updatedScenes.forEach((scene, index) => {
          scene.sceneNumber = index + 1;
        });
        await saveProject(projectId, { ...project, scenes: updatedScenes });
        return;
      }
    }

    // Fallback: delete from separate S3 storage
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const { s3Client, BUCKET_NAME } = await import("./s3");

    const key = getSceneKey(projectId, sceneId);
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
  } catch (error) {
    console.error("Error deleting scene:", JSON.stringify({ projectId, sceneId, error }, null, 2));
    throw error;
  }
}

/**
 * Create a new scene with default values
 */
export function createNewScene(projectId: string, sceneNumber: number): Scene {
  const now = new Date().toISOString();
  return {
    id: `scene-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    projectId,
    sceneNumber,
    title: `Scene ${sceneNumber}`,
    screenplay: "",
    characters: [],
    generatedImages: [],
    generatedVideos: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update scene numbers after reordering
 */
export async function reorderScenes(projectId: string, sceneIds: string[]): Promise<void> {
  try {
    const scenes = await listScenesForProject(projectId);
    const sceneMap = new Map(scenes.map((s) => [s.id, s]));

    await Promise.all(
      sceneIds.map(async (sceneId, index) => {
        const scene = sceneMap.get(sceneId);
        if (scene && scene.sceneNumber !== index + 1) {
          scene.sceneNumber = index + 1;
          scene.updatedAt = new Date().toISOString();
          await saveScene(projectId, scene);
        }
      })
    );
  } catch (error) {
    console.error("Error reordering scenes:", JSON.stringify({ projectId, error }, null, 2));
    throw error;
  }
}

/**
 * Add a generated image to a scene
 */
export async function addGeneratedImageToScene(
  projectId: string,
  sceneId: string,
  image: GeneratedImage
): Promise<Scene | null> {
  try {
    const scene = await getScene(projectId, sceneId);
    if (!scene) {
      return null;
    }

    scene.generatedImages.push(image);
    scene.updatedAt = new Date().toISOString();

    await saveScene(projectId, scene);
    return scene;
  } catch (error) {
    console.error("Error adding image to scene:", JSON.stringify({ projectId, sceneId, error }, null, 2));
    throw error;
  }
}

/**
 * Add a generated video to a scene
 */
export async function addGeneratedVideoToScene(
  projectId: string,
  sceneId: string,
  video: GeneratedVideo
): Promise<Scene | null> {
  try {
    const scene = await getScene(projectId, sceneId);
    if (!scene) {
      return null;
    }

    scene.generatedVideos.push(video);
    scene.updatedAt = new Date().toISOString();

    await saveScene(projectId, scene);
    return scene;
  } catch (error) {
    console.error("Error adding video to scene:", JSON.stringify({ projectId, sceneId, error }, null, 2));
    throw error;
  }
}

/**
 * Update a generated video's status
 */
export async function updateVideoStatus(
  projectId: string,
  sceneId: string,
  videoId: string,
  status: GeneratedVideo["status"],
  updates?: Partial<GeneratedVideo>
): Promise<Scene | null> {
  try {
    const scene = await getScene(projectId, sceneId);
    if (!scene) {
      return null;
    }

    const videoIndex = scene.generatedVideos.findIndex((v) => v.id === videoId);
    if (videoIndex === -1) {
      return null;
    }

    scene.generatedVideos[videoIndex] = {
      ...scene.generatedVideos[videoIndex],
      ...updates,
      status,
    };
    scene.updatedAt = new Date().toISOString();

    await saveScene(projectId, scene);
    return scene;
  } catch (error) {
    console.error("Error updating video status:", JSON.stringify({ projectId, sceneId, videoId, error }, null, 2));
    throw error;
  }
}


