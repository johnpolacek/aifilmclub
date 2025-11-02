import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Re-export image utilities for backward compatibility
export {
  getPublicUrl,
  getImageUrl,
  getThumbnailUrl,
  getCharacterImageUrl,
  getLocationImageUrl,
  getPostImageUrl,
  getProjectFileUrl,
} from "./image-utils";
