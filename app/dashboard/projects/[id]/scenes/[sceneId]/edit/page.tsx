import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditSceneView } from "@/components/views/edit-scene-view";
import { getProject } from "@/lib/projects";
import { getScene } from "@/lib/scenes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; sceneId: string }>;
}): Promise<Metadata> {
  const { id, sceneId } = await params;
  const scene = await getScene(id, sceneId);

  return {
    title: scene ? `Edit: ${scene.title} - AI Film Camp` : "Edit Scene - AI Film Camp",
    description: "Edit your scene",
  };
}

export default async function EditScenePage({
  params,
}: {
  params: Promise<{ id: string; sceneId: string }>;
}) {
  const { id: projectId, sceneId } = await params;

  // Get project data (for characters)
  const projectData = await getProject(projectId);

  if (!projectData) {
    notFound();
  }

  // Get scene data
  const scene = await getScene(projectId, sceneId);

  if (!scene) {
    notFound();
  }

  return (
    <EditSceneView
      scene={scene}
      projectId={projectId}
      projectTitle={projectData.title}
      characters={projectData.characters || []}
    />
  );
}

