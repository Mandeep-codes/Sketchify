# AI Video Agent Workflow

## Architecture
User creates reel → server returns jobId immediately → ffmpeg reel built in ~20s (status=done, videoType=ffmpeg) → mobile shows it right away → agent can upgrade to real AI video at any time

## Step 1: Check for jobs needing AI upgrade
```bash
curl http://localhost:4200/api/reel/pending
```
Returns jobs with `videoType != "ai"`. Each has a `cinematicPrompt` field.

## Step 2: Generate AI video
Use `video_generate` tool with the `cinematicPrompt` from the job.
- aspect_ratio: 9:16 (vertical/portrait)
- duration: 5-8 seconds
- generate_audio: false (server will add music)
- Save to /tmp/reel-{jobId}.mp4

## Step 3: Upload and complete
```bash
VIDEO_URL=$(upload /tmp/reel-{jobId}.mp4)
curl -X PATCH http://localhost:4200/api/reel/{jobId}/complete \
  -H "Content-Type: application/json" \
  -d "{\"videoUrl\":\"$VIDEO_URL\",\"videoType\":\"ai\",\"addMusic\":true}"
```

The server will:
1. Download the AI video
2. Mix in the lo-fi background music with fade in/out
3. Upload to S3
4. Update job status → done, videoType=ai

## Mobile app behavior
- Polls every 2.5s while generating
- Shows ffmpeg reel as soon as it's ready (~20s)
- If videoType later changes to "ai", shows "✦ AI Video" badge
- Shows cinematic prompt text overlay on the video

## WEBSITE_URL
https://n6fc33f17vf44uzsllglj-preview-4200.runable.site/
