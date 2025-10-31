import type { Metadata } from "next"
import { HomeView } from "@/components/views/home-view"

export const metadata: Metadata = {
  title: "AI Film Camp - A Platform for AI Film Creators",
  description: "A community-driven platform for creators to create, collaborate, and share their work-in-progress AI Film projects.",
}

export default function Home() {
  return <HomeView />
}
