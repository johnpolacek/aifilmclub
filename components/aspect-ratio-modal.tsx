interface AspectRatioModalProps {
  onSelectRatio: (ratio: string) => void;
}

export default function AspectRatioModal({ onSelectRatio }: AspectRatioModalProps) {
  const ratios = [
    { value: "16:9", label: "Widescreen", desc: "16:9" },
    { value: "9:16", label: "Vertical", desc: "9:16" },
    { value: "1:1", label: "Square", desc: "1:1" },
  ];

  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center dark z-50">
      <div className="bg-card rounded-lg p-8 w-96 shadow-2xl border border-border">
        <h2 className="text-2xl font-bold mb-2">Start Your Project</h2>
        <p className="text-muted-foreground mb-6">Select your video aspect ratio</p>

        <div className="space-y-3">
          {ratios.map((ratio) => (
            <button
              type="button"
              key={ratio.value}
              onClick={() => onSelectRatio(ratio.value)}
              className="w-full p-4 border border-border rounded-lg hover:border-primary hover:bg-primary/10 transition-all cursor-pointer text-left group"
            >
              <p className="font-medium group-hover:text-primary transition">{ratio.label}</p>
              <p className="text-sm text-muted-foreground">{ratio.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
