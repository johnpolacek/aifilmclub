# Video Composer Service

A Node.js service that uses FFmpeg to compose scene videos from multiple shots and audio tracks.

## Overview

This service:
1. Receives composition requests from the Next.js app
2. Downloads source video and audio files
3. Uses FFmpeg to composite them with proper timing, trimming, and audio mixing
4. Uploads the final video to S3
5. Reports completion via webhook

## Local Development

### Prerequisites

- Node.js 20+
- FFmpeg installed (`brew install ffmpeg` on macOS)
- AWS credentials with S3 access

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Test the health endpoint:
   ```bash
   curl http://localhost:3001/health
   ```

## Deploy to Render

### 1. Create a Render Account

Sign up at [render.com](https://render.com) if you haven't already.

### 2. Create a New Web Service

1. Go to Dashboard → New → Web Service
2. Connect your GitHub repository
3. If using a monorepo, set the **Root Directory** to `video-composer`

### 3. Configure the Service

| Setting | Value |
|---------|-------|
| **Name** | `aifilmcamp-video-composer` |
| **Environment** | Docker |
| **Region** | Same as your S3 bucket (e.g., US East) |
| **Instance Type** | Starter ($7/month) or Standard ($25/month) |
| **Health Check Path** | `/health` |

### 4. Add Environment Variables

In the Render dashboard, add these environment variables:

```
API_SECRET=<generate-a-random-secret>
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-aws-access-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret-key>
S3_BUCKET=aifilmcamp-public
CLOUDFRONT_URL=https://your-cloudfront-domain.cloudfront.net
```

To generate a random secret:
```bash
openssl rand -base64 32
```

### 5. Deploy

Click "Create Web Service" and wait for the build to complete.

### 6. Note Your Service URL

After deployment, note your service URL, e.g.:
```
https://aifilmcamp-video-composer.onrender.com
```

## Configure Next.js App

Add these environment variables to your Vercel project:

```
VIDEO_COMPOSER_URL=https://aifilmcamp-video-composer.onrender.com
VIDEO_COMPOSER_SECRET=<same-secret-as-render>
```

## API Endpoints

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### POST /compose

Start a video composition job.

**Headers:**
- `Authorization: Bearer <API_SECRET>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "jobId": "uuid",
  "projectId": "project-id",
  "sceneId": "scene-id",
  "webhookUrl": "https://your-app.com/api/scenes/scene-id/compose/webhook",
  "shots": [
    {
      "id": "shot-1",
      "order": 0,
      "videoUrl": "https://...",
      "durationMs": 8000,
      "trimStartMs": 0,
      "trimEndMs": 0,
      "audioMuted": false
    }
  ],
  "audioTracks": [
    {
      "id": "audio-1",
      "sourceUrl": "https://...",
      "startTimeMs": 0,
      "durationMs": 5000,
      "trimStartMs": 0,
      "volume": 1.0,
      "muted": false
    }
  ]
}
```

**Response:**
```json
{
  "jobId": "uuid",
  "status": "processing"
}
```

## Webhook Callback

When composition completes, the service calls the webhook URL with:

**Success:**
```json
{
  "jobId": "uuid",
  "status": "completed",
  "videoUrl": "https://s3.../composite-123.mp4",
  "thumbnailUrl": "https://s3.../composite-thumb-123.jpg",
  "durationMs": 15000
}
```

**Failure:**
```json
{
  "jobId": "uuid",
  "status": "failed",
  "error": "Error message"
}
```

## Cost Estimate

| Item | Cost |
|------|------|
| Render Starter | $7/month |
| Render Standard | $25/month |
| S3 Storage | ~$0.023/GB/month |
| CloudFront Transfer | ~$0.085/GB |

## Troubleshooting

### FFmpeg Not Found

Ensure FFmpeg is installed in the Docker image. The Dockerfile includes:
```dockerfile
RUN apt-get update && apt-get install -y ffmpeg
```

### Timeout Issues

For long videos, Render's default timeout may not be sufficient. The service responds immediately and processes in the background, so this shouldn't be an issue.

### S3 Upload Failures

Check that:
1. AWS credentials are correct
2. The bucket exists and is accessible
3. The IAM user has `s3:PutObject` permission

