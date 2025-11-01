import { MessageSquare, Trophy, Users } from "lucide-react";
import { Card } from "@/components/ui/card";

const features = [
  {
    icon: Users,
    title: "Collaborative Workspace",
    description: "Share your work-in-progress and get feedback from fellow creators",
  },
  {
    icon: Trophy,
    title: "Showcase Gallery",
    description: "Feature your completed projects in our curated gallery",
  },
  {
    icon: MessageSquare,
    title: "Resource Library",
    description: "Access a library of resources to help you learn and grow as an AI film creator",
  },
];

export function CommunityFeatures() {
  return (
    <section id="community" className="py-20 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold mb-4 text-balance">
            Why Join AI Film Camp?
          </h2>
          <p className="text-lg text-muted-foreground text-pretty max-w-2xl mx-auto">
            Everything you need to grow as an AI film creator
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                className="p-6 bg-card space-y-0! border-border hover:border-primary/50 transition-colors"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center ">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-balance">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed -mt-2">
                  {feature.description}
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
