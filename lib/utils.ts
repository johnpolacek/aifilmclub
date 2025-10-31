import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get the public URL for an S3 object (using CloudFront if available, otherwise S3)
 * Can be used on both server and client side - this is client-safe (no server-only imports)
 */
export function getPublicUrl(key: string): string {
  // Client-side: use NEXT_PUBLIC_ prefixed env var
  // Server-side: use regular env var (fallback to NEXT_PUBLIC_)
  const cloudfrontDomain = 
    typeof window === 'undefined' 
      ? process.env.AWS_CLOUDFRONT_DOMAIN || process.env.NEXT_PUBLIC_AWS_CLOUDFRONT_DOMAIN
      : process.env.NEXT_PUBLIC_AWS_CLOUDFRONT_DOMAIN
  
  if (cloudfrontDomain) {
    return `https://${cloudfrontDomain}/${key}`
  }
  
  // Fallback to S3 URL (need bucket name from env)
  const bucketName = 
    typeof window === 'undefined'
      ? process.env.AWS_S3_BUCKET_NAME || process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME
      : process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME
  
  if (bucketName) {
    return `https://${bucketName}.s3.amazonaws.com/${key}`
  }
  
  // If neither is available, return the key as-is (shouldn't happen in production)
  return key
}

/**
 * Get the thumbnail URL for a project
 * Thumbnail should be just the filename (e.g., "1761873619145.jpg")
 * Username is required to construct the full path
 */
export function getThumbnailUrl(thumbnail: string | undefined, username: string | undefined): string {
  if (!thumbnail || !username) return ''
  
  const key = `thumbnails/${username}/${thumbnail}`
  return getPublicUrl(key)
}

/**
 * Get the character image URL
 * Character image should be just the filename (e.g., "1761873619145.jpg")
 * Username is required to construct the full path
 */
export function getCharacterImageUrl(image: string | undefined, username: string | undefined): string {
  if (!image || !username) return ''
  
  const key = `characters/${username}/${image}`
  return getPublicUrl(key)
}

/**
 * Get the location image URL
 * Location image should be just the filename (e.g., "1761873619145.jpg")
 * Username is required to construct the full path
 */
export function getLocationImageUrl(image: string | undefined, username: string | undefined): string {
  if (!image || !username) return ''
  
  const key = `locations/${username}/${image}`
  return getPublicUrl(key)
}

/**
 * Get the post image URL
 * Post image should be just the filename (e.g., "1761873619145.jpg")
 * Username is required to construct the full path
 */
export function getPostImageUrl(image: string | undefined, username: string | undefined): string {
  if (!image || !username) return ''
  
  const key = `posts/${username}/${image}`
  return getPublicUrl(key)
}
