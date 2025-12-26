/**
 * Screenplay Parser
 * Parses screenplay text into individual scenes
 * Supports standard screenplay format with INT/EXT scene headings
 */

export interface ParsedScene {
  sceneNumber: number;
  title: string;
  heading: string; // Original scene heading (e.g., "INT. COFFEE SHOP - DAY")
  content: string; // Scene content (action, dialogue)
  characters: string[]; // Characters mentioned in dialogue
  startIndex: number; // Character position in original text
  endIndex: number; // Character position in original text
}

export interface ParseResult {
  success: boolean;
  scenes: ParsedScene[];
  error?: string;
}

/**
 * Scene heading patterns
 * Matches standard screenplay format:
 * - INT. LOCATION - TIME
 * - EXT. LOCATION - TIME
 * - INT./EXT. LOCATION - TIME
 * - I/E. LOCATION - TIME
 */
const SCENE_HEADING_PATTERNS = [
  /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|INTERIOR|EXTERIOR)\s+(.+?)(?:\s*[-–—]\s*(.+?))?$/im,
  /^(SCENE\s+\d+[\.:])?\s*(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s+(.+?)(?:\s*[-–—]\s*(.+?))?$/im,
];

/**
 * Character name pattern
 * Matches character names in dialogue (ALL CAPS followed by dialogue)
 */
const CHARACTER_NAME_PATTERN = /^([A-Z][A-Z\s\.']+)(?:\s*\(.*?\))?\s*$/;

/**
 * Check if a line is a scene heading
 */
function isSceneHeading(line: string): boolean {
  const trimmedLine = line.trim().toUpperCase();
  return (
    trimmedLine.startsWith("INT.") ||
    trimmedLine.startsWith("EXT.") ||
    trimmedLine.startsWith("INT/EXT.") ||
    trimmedLine.startsWith("I/E.") ||
    trimmedLine.startsWith("INTERIOR") ||
    trimmedLine.startsWith("EXTERIOR")
  );
}

/**
 * Extract a title from a scene heading
 */
function extractTitle(heading: string): string {
  // Remove the INT./EXT. prefix
  let title = heading
    .replace(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|INTERIOR|EXTERIOR)\s*/i, "")
    .trim();
  
  // Remove time of day suffix if present
  title = title.replace(/\s*[-–—]\s*(DAY|NIGHT|MORNING|EVENING|AFTERNOON|LATER|CONTINUOUS|SAME|MOMENTS LATER).*$/i, "").trim();
  
  // Capitalize properly
  return title
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Extract character names from scene content
 */
function extractCharacters(content: string): string[] {
  const lines = content.split("\n");
  const characters = new Set<string>();
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if this line looks like a character name (all caps, short, followed by dialogue)
    if (
      line.length > 0 &&
      line.length < 40 &&
      line === line.toUpperCase() &&
      !isSceneHeading(line) &&
      !line.startsWith("(") &&
      !line.endsWith(")") &&
      !/^\d+\.?\s*$/.test(line) && // Not just a number
      !/^(FADE|CUT|DISSOLVE|SMASH|MATCH|JUMP|TIME|CONTINUED|MORE|CONT'D)/.test(line)
    ) {
      // This might be a character name
      const match = line.match(CHARACTER_NAME_PATTERN);
      if (match) {
        // Clean up the character name
        let characterName = match[1].trim();
        // Remove parentheticals like (V.O.), (O.S.), etc.
        characterName = characterName.replace(/\s*\(.*?\)\s*/g, "").trim();
        if (characterName.length > 1 && characterName.length < 30) {
          characters.add(characterName);
        }
      }
    }
  }
  
  return Array.from(characters);
}

/**
 * Parse screenplay text into scenes
 */
export function parseScreenplay(text: string): ParseResult {
  if (!text || typeof text !== "string") {
    return {
      success: false,
      scenes: [],
      error: "No screenplay text provided",
    };
  }

  try {
    const lines = text.split("\n");
    const scenes: ParsedScene[] = [];
    let currentScene: Partial<ParsedScene> | null = null;
    let currentContent: string[] = [];
    let sceneNumber = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      if (isSceneHeading(trimmedLine)) {
        // Save the previous scene if exists
        if (currentScene && currentScene.heading) {
          const content = currentContent.join("\n").trim();
          scenes.push({
            sceneNumber: currentScene.sceneNumber || sceneNumber,
            title: currentScene.title || `Scene ${sceneNumber}`,
            heading: currentScene.heading,
            content,
            characters: extractCharacters(content),
            startIndex: currentScene.startIndex || 0,
            endIndex: text.indexOf(trimmedLine, currentScene.startIndex || 0),
          });
        }

        // Start a new scene
        sceneNumber++;
        const startIndex = text.indexOf(trimmedLine, scenes.length > 0 ? scenes[scenes.length - 1].endIndex : 0);
        
        currentScene = {
          sceneNumber,
          heading: trimmedLine,
          title: extractTitle(trimmedLine),
          startIndex,
        };
        currentContent = [];
      } else if (currentScene) {
        // Add to current scene content
        currentContent.push(line);
      }
    }

    // Don't forget the last scene
    if (currentScene && currentScene.heading) {
      const content = currentContent.join("\n").trim();
      scenes.push({
        sceneNumber: currentScene.sceneNumber || sceneNumber,
        title: currentScene.title || `Scene ${sceneNumber}`,
        heading: currentScene.heading,
        content,
        characters: extractCharacters(content),
        startIndex: currentScene.startIndex || 0,
        endIndex: text.length,
      });
    }

    return {
      success: true,
      scenes,
    };
  } catch (error) {
    console.error("[parseScreenplay] Error:", JSON.stringify({ error }, null, 2));
    return {
      success: false,
      scenes: [],
      error: error instanceof Error ? error.message : "Failed to parse screenplay",
    };
  }
}

/**
 * Convert parsed scenes to Scene objects for storage
 */
export function parsedScenesToScenes(
  projectId: string,
  parsedScenes: ParsedScene[]
): Array<{
  id: string;
  projectId: string;
  sceneNumber: number;
  title: string;
  screenplay: string;
  characters: string[];
  generatedImages: [];
  generatedVideos: [];
  createdAt: string;
  updatedAt: string;
}> {
  const now = new Date().toISOString();
  
  return parsedScenes.map((parsed) => ({
    id: `scene-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    projectId,
    sceneNumber: parsed.sceneNumber,
    title: parsed.title,
    screenplay: `${parsed.heading}\n\n${parsed.content}`,
    characters: parsed.characters,
    generatedImages: [],
    generatedVideos: [],
    createdAt: now,
    updatedAt: now,
  }));
}

