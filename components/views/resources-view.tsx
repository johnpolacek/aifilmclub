import { BookOpen, Code, ExternalLink, Lightbulb, Sparkles, Users, Video } from "lucide-react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ResourcesView() {
  const resourceCategories = [
    {
      icon: Video,
      title: "AI Film Tools",
      description: "Curated list of the best AI tools for filmmaking",
      resources: [
        { name: "Runway Gen-3", description: "Text-to-video generation", link: "#" },
        { name: "Midjourney", description: "AI image generation for storyboards", link: "#" },
        { name: "ElevenLabs", description: "AI voice generation and dubbing", link: "#" },
        { name: "Pika Labs", description: "Video editing and effects", link: "#" },
      ],
    },
    {
      icon: BookOpen,
      title: "Tutorials & Guides",
      description: "Learn the fundamentals of AI filmmaking",
      resources: [
        {
          name: "Getting Started with AI Film",
          description: "Complete beginner's guide",
          link: "#",
        },
        {
          name: "Prompt Engineering for Video",
          description: "Master the art of prompting",
          link: "#",
        },
        { name: "Storyboarding with AI", description: "Plan your film effectively", link: "#" },
        {
          name: "Post-Production Workflow",
          description: "Edit and polish your AI films",
          link: "#",
        },
      ],
    },
    {
      icon: Lightbulb,
      title: "Inspiration",
      description: "Case studies and creative examples",
      resources: [
        { name: "Award-Winning AI Films", description: "Study the best in the field", link: "#" },
        { name: "Behind the Scenes", description: "Creator interviews and breakdowns", link: "#" },
        { name: "Style References", description: "Visual inspiration gallery", link: "#" },
        { name: "Monthly Showcases", description: "Community highlights", link: "#" },
      ],
    },
    {
      icon: Code,
      title: "Technical Resources",
      description: "APIs, workflows, and automation",
      resources: [
        {
          name: "API Documentation",
          description: "Integrate AI tools programmatically",
          link: "#",
        },
        { name: "Workflow Templates", description: "Pre-built production pipelines", link: "#" },
        { name: "Automation Scripts", description: "Speed up your process", link: "#" },
        { name: "GitHub Repositories", description: "Open-source tools and plugins", link: "#" },
      ],
    },
  ];

  const communityResources = [
    {
      icon: Users,
      title: "Discord Community",
      description: "Join 5,000+ AI filmmakers in real-time discussions",
      link: "#",
    },
    {
      icon: Sparkles,
      title: "Weekly Newsletter",
      description: "Latest tools, techniques, and community highlights",
      link: "#",
    },
  ];

  return (
    <main className="min-h-screen">
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-20 lg:pt-40 lg:pb-32 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 text-balance">
              Resources for AI Filmmakers
            </h1>
            <p className="text-lg lg:text-xl text-muted-foreground text-pretty">
              Everything you need to create stunning AI films. Tools, tutorials, inspiration, and
              community support.
            </p>
          </div>
        </div>
      </section>

      {/* Resource Categories */}
      <section className="py-20 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid gap-16">
            {resourceCategories.map((category, index) => {
              const Icon = category.icon;
              return (
                <div key={index}>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-2xl lg:text-3xl font-bold text-balance">
                        {category.title}
                      </h2>
                      <p className="text-muted-foreground">{category.description}</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {category.resources.map((resource, resourceIndex) => (
                      <Card
                        key={resourceIndex}
                        className="p-6 bg-card border-border hover:border-primary/50 transition-all group"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold mb-2 text-balance group-hover:text-primary transition-colors">
                              {resource.name}
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {resource.description}
                            </p>
                          </div>
                          <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Community Resources */}
      <section className="py-20 lg:py-32 bg-muted/30">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-balance">Join the Community</h2>
            <p className="text-lg text-muted-foreground text-pretty max-w-2xl mx-auto">
              Connect with fellow creators and stay updated
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {communityResources.map((resource, index) => {
              const Icon = resource.icon;
              return (
                <Card
                  key={index}
                  className="p-8 bg-card border-border hover:border-primary/50 transition-colors"
                >
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-balance">{resource.title}</h3>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    {resource.description}
                  </p>
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    Join Now
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
