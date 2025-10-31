import type { Metadata } from "next"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { getProjectsByUsername } from "@/lib/projects"
import { getPostsForProjects } from "@/lib/posts"
import { getOrCreateUserProfile } from "@/lib/actions/profiles"
import { DashboardPageView } from "@/components/views/dashboard-page-view"

export const metadata: Metadata = {
  title: "Dashboard - AI Film Camp",
  description: "Manage and showcase your AI film projects",
}

export default async function DashboardPage() {
  // Check authentication
  const { userId } = await auth()
  
  if (!userId) {
    redirect("/signin")
  }

  // Get or create user profile from S3
  const userProfile = await getOrCreateUserProfile()

  // Redirect to profile page if about field is not filled out
  if (!userProfile.about || userProfile.about.trim() === "") {
    redirect("/dashboard/profile")
  }

  // Fetch user's projects
  const projects = await getProjectsByUsername(userProfile.username)
  
  // Fetch posts for all projects
  const projectIds = projects.map(p => p.id)
  const postsByProject = await getPostsForProjects(projectIds)

  return <DashboardPageView userProfile={userProfile} projects={projects} postsByProject={postsByProject} />
}
