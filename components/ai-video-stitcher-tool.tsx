"use client";

import { GripVertical, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import AspectRatioModal from "@/components/aspect-ratio-modal";
import ExportModal from "@/components/export-modal";
import { Button } from "./ui/button";

interface Clip {
  id: string;
  platform: string;
  thumbnail?: string;
}

export default function AIVideoStitcherTool() {
  const [aspectRatio, setAspectRatio] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [clips, setClips] = useState<Clip[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isExportComplete, setIsExportComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileInputClipId, setFileInputClipId] = useState<string | null>(null);

  const handleAspectRatioSelect = (ratio: string) => {
    setAspectRatio(ratio);
  };

  const handleAddClip = () => {
    const newClip: Clip = {
      id: `clip-${Date.now()}`,
      platform: "",
    };
    setClips([...clips, newClip]);
  };

  const handleDeleteClip = (id: string) => {
    setClips(clips.filter((clip) => clip.id !== id));
  };

  const handleUpdatePlatform = (id: string, platform: string) => {
    setClips(clips.map((clip) => (clip.id === id ? { ...clip, platform } : clip)));
  };

  const handleUploadClick = (clipId: string) => {
    setFileInputClipId(clipId);
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file || !fileInputClipId) return;

    const thumbnail = URL.createObjectURL(file);
    setClips(clips.map((clip) => (clip.id === fileInputClipId ? { ...clip, thumbnail } : clip)));
    setFileInputClipId(null);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("dragIndex", index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData("dragIndex"), 10);
    if (dragIndex === dropIndex) return;

    const newClips = [...clips];
    const [draggedClip] = newClips.splice(dragIndex, 1);
    newClips.splice(dropIndex, 0, draggedClip);
    setClips(newClips);
  };

  const handleExport = () => {
    setIsExporting(true);
    setExportProgress(0);

    const interval = setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsExportComplete(true);
          return 100;
        }
        return prev + Math.random() * 35;
      });
    }, 300);
  };

  const handleDownload = () => {
    setIsExporting(false);
    setExportProgress(0);
    setIsExportComplete(false);
  };

  if (!aspectRatio) {
    return (
      <div className="relative min-h-[calc(100vh-4rem)] pt-16 z-10">
        <AspectRatioModal onSelectRatio={handleAspectRatioSelect} />
      </div>
    );
  }

  // Calculate aspect ratio dimensions for preview
  const getPreviewDimensions = () => {
    const maxHeight = 400;
    if (aspectRatio === "16:9") {
      return { width: (maxHeight * 16) / 9, height: maxHeight };
    } else if (aspectRatio === "9:16") {
      return { width: (maxHeight * 9) / 16, height: maxHeight };
    } else {
      // 1:1
      return { width: maxHeight, height: maxHeight };
    }
  };

  const previewDimensions = getPreviewDimensions();

  return (
    <div className="relative z-0 min-h-[calc(100vh-4rem)] pt-16 flex flex-col bg-background text-foreground dark">
      {/* Tool Header */}
      <div className="sticky top-16 z-10 border-b border-border px-6 py-4 flex items-center justify-between bg-background">
        <h1 className="text-2xl font-bold">AI Video Stitcher</h1>
        <Button onClick={handleExport}>Export Video</Button>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Left Panel - Workspace (1/3 width) */}
        <div className="w-1/3 flex flex-col border border-border rounded-lg bg-card overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Project Prompt Section */}
            <div className="space-y-2">
              <label htmlFor="global-prompt" className="block text-sm font-medium">
                Global Prompt
              </label>
              <textarea
                id="global-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                placeholder="Paste the prompt you used for all your AI models..."
                className="text-sm w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>

            {/* Clips Section */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Clips</h3>
              <div className="space-y-2">
                {clips.map((clip, index) => (
                  // biome-ignore lint/a11y/noStaticElementInteractions: div is required for drag and drop functionality
                  <div
                    key={clip.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className="bg-secondary p-3 rounded-lg space-y-2 cursor-move hover:bg-opacity-80 transition"
                  >
                    {/* Drag Handle + Platform Input + Delete */}
                    <div className="flex items-center gap-2">
                      <GripVertical size={16} className="text-muted-foreground shrink-0" />
                      <input
                        type="text"
                        value={clip.platform}
                        onChange={(e) => handleUpdatePlatform(clip.id, e.target.value)}
                        placeholder="e.g., Veo, Grok, Midjourney"
                        className="flex-1 px-2 py-1 bg-input border border-border rounded text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteClip(clip.id)}
                        className="p-1 hover:bg-destructive hover:text-destructive-foreground rounded transition shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Upload Button or Thumbnail */}
                    {clip.thumbnail ? (
                      <div className="relative w-full h-24">
                        <Image
                          src={clip.thumbnail}
                          alt={clip.platform || "Uploaded video"}
                          fill
                          unoptimized
                          className="object-cover rounded"
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUploadClick(clip.id)}
                        className="w-full py-6 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition"
                      >
                        Upload Video
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Clip Button */}
              <button
                type="button"
                onClick={handleAddClip}
                className="w-full cursor-pointer py-2 px-3 border border-dashed border-border rounded-lg text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition"
              >
                + Add Clip
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Video Preview (2/3 width) */}
        <div className="flex-1 flex flex-col items-center justify-center border border-border rounded-lg bg-card p-6">
          <div
            style={{
              width: previewDimensions.width,
              height: previewDimensions.height,
            }}
            className="bg-black rounded-lg border border-border flex items-center justify-center"
          >
            <div className="text-center">
              <p className="text-muted-foreground text-sm mb-2">Video Preview</p>
              <p className="text-xs text-muted-foreground">
                {aspectRatio} • {previewDimensions.width.toFixed(0)}×
                {previewDimensions.height.toFixed(0)}px
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {isExporting && (
        <ExportModal
          isComplete={isExportComplete}
          progress={exportProgress}
          onDownload={handleDownload}
        />
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
