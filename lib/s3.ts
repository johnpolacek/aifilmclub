import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3"
import { optimizeImage, optimizeAvatar, optimizeThumbnail } from "./image-optimization"

// Initialize S3 Client
export const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!
export const CLOUDFRONT_DOMAIN = process.env.AWS_CLOUDFRONT_DOMAIN!

/**
 * Get the public URL for an S3 object (using CloudFront if available, otherwise S3)
 * Server-side only - use getPublicUrl from lib/utils.ts for client-side
 */
function getPublicUrlServer(key: string): string {
  if (CLOUDFRONT_DOMAIN) {
    return `https://${CLOUDFRONT_DOMAIN}/${key}`
  }
  return `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`
}

/**
 * Get an object from S3
 */
export async function getObjectFromS3(key: string): Promise<string | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })

    const response = await s3Client.send(command)
    const str = await response.Body?.transformToString()
    return str || null
  } catch (error) {
    const awsError = error as { name?: string; message?: string; Code?: string; $metadata?: { httpStatusCode?: number }; stack?: string }
    
    if (awsError.name === "NoSuchKey") {
      return null
    }
    throw error
  }
}

/**
 * Put an object to S3
 */
export async function putObjectToS3(key: string, body: string, contentType = "application/json"): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  })

  await s3Client.send(command)
}

/**
 * List objects in S3 with a given prefix
 */
export async function listObjectsInS3(prefix: string): Promise<string[]> {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: prefix,
  })

  const response = await s3Client.send(command)
  return response.Contents?.map((item) => item.Key!).filter(Boolean) || []
}

/**
 * Upload image from a URL to S3 (optimized)
 */
export async function uploadImageFromUrl(
  url: string,
  key: string,
  options?: { isAvatar?: boolean; isThumbnail?: boolean }
): Promise<string> {
  try {
    // Fetch the image from the URL
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Optimize the image before uploading
    let optimizedBuffer: Buffer
    let contentType: string

    if (options?.isAvatar) {
      const result = await optimizeAvatar(buffer)
      optimizedBuffer = result.buffer
      contentType = result.contentType
    } else if (options?.isThumbnail) {
      const result = await optimizeThumbnail(buffer)
      optimizedBuffer = result.buffer
      contentType = result.contentType
    } else {
      const result = await optimizeImage(buffer)
      optimizedBuffer = result.buffer
      contentType = result.contentType
    }

    // Upload optimized image to S3
    // Note: Bucket should be configured with public read access via bucket policy
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: optimizedBuffer,
      ContentType: contentType,
    })

    await s3Client.send(command)

    // Return the public URL (using CloudFront if configured)
    return getPublicUrlServer(key)
  } catch (error) {
    console.error("Error uploading image from URL:", error)
    throw error
  }
}

/**
 * Upload image from buffer to S3 (optimized)
 */
export async function uploadImageFromBuffer(
  buffer: Buffer,
  key: string,
  contentType?: string,
  options?: { isAvatar?: boolean; isThumbnail?: boolean }
): Promise<string> {
  try {
    // Optimize the image before uploading
    let optimizedBuffer: Buffer
    let optimizedContentType: string

    if (options?.isAvatar) {
      const result = await optimizeAvatar(buffer)
      optimizedBuffer = result.buffer
      optimizedContentType = result.contentType
    } else if (options?.isThumbnail) {
      const result = await optimizeThumbnail(buffer)
      optimizedBuffer = result.buffer
      optimizedContentType = result.contentType
    } else {
      const result = await optimizeImage(buffer)
      optimizedBuffer = result.buffer
      optimizedContentType = result.contentType
    }

    // Note: Bucket should be configured with public read access via bucket policy
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: optimizedBuffer,
      ContentType: optimizedContentType,
    })

    await s3Client.send(command)

    // Return the public URL (using CloudFront if configured)
    return getPublicUrlServer(key)
  } catch (error) {
    console.error("Error uploading image from buffer:", error)
    throw error
  }
}

/**
 * Upload a file to S3 (non-image files like PDFs, documents, etc.)
 */
export async function uploadFileFromBuffer(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })

    await s3Client.send(command)

    // Return the public URL (using CloudFront if configured)
    return getPublicUrlServer(key)
  } catch (error) {
    console.error("Error uploading file:", error)
    throw error
  }
}

