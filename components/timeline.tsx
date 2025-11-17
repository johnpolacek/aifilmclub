import { useState } from 'react'

interface Clip {
  id: string
  name: string
  thumbnail: string
  label: string
  duration: number
}

interface TimelineProps {
  clips: Clip[]
  selectedClipId: string | undefined
  onClipClick: (clip: Clip) => void
  onReorder: (clips: Clip[]) => void
}

export default function Timeline({
  clips,
  selectedClipId,
  onClipClick,
  onReorder,
}: TimelineProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const handleDragStart = (clip: Clip) => {
    setDraggedId(clip.id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (targetClip: Clip) => {
    if (!draggedId) return

    const draggedIndex = clips.findIndex((c) => c.id === draggedId)
    const targetIndex = clips.findIndex((c) => c.id === targetClip.id)

    if (draggedIndex === -1 || targetIndex === -1) return

    const newClips = [...clips]
    ;[newClips[draggedIndex], newClips[targetIndex]] = [
      newClips[targetIndex],
      newClips[draggedIndex],
    ]
    onReorder(newClips)
    setDraggedId(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
  }

  return (
    <div className="border-t border-border bg-card h-24 px-6 py-3 overflow-x-auto">
      <div className="flex gap-2 h-full">
        {clips.length === 0 ? (
          <p className="text-muted-foreground text-sm self-center">
            Drag clips here to create your timeline
          </p>
        ) : (
          clips.map((clip) => (
            <div
              key={clip.id}
              draggable
              onDragStart={() => handleDragStart(clip)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(clip)}
              onDragEnd={handleDragEnd}
              onClick={() => onClipClick(clip)}
              className={`flex-shrink-0 w-20 h-16 rounded border-2 cursor-pointer transition ${
                selectedClipId === clip.id
                  ? 'border-primary shadow-lg'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <img
                src={clip.thumbnail || "/placeholder.svg"}
                alt={clip.name}
                className="w-full h-full object-cover rounded"
              />
              {clip.label && (
                <div className="absolute bg-primary text-primary-foreground text-xs px-1 rounded bottom-0">
                  {clip.label.substring(0, 3)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
