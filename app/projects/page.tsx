import type { Metadata } from "next"
import { ProjectsView } from "@/components/views/projects-view"

export const metadata: Metadata = {
  title: "Community Projects - AI Film Camp",
  description: "Explore groundbreaking AI films from creators around the world. Get inspired, learn, and collaborate.",
}

export default function ProjectsPage() {
  return <ProjectsView />
}

