# Sketch-to-Real: AI Video Generation — DONE

## What was built
- Async job queue for reel generation using libsql DB
- POST /reel → returns jobId immediately (202)
- Background: Phase1 normalize → Phase2 Gemini prompt → Phase3 ffmpeg Ken Burns reel
- GET /reel/:jobId → poll status (pending/processing/done/error)
- GET /reel/pending → agent polls for jobs needing AI upgrade
- PATCH /reel/:jobId/complete → agent submits AI video (with music mixing)
- Mobile reel.tsx polls every 2.5s, shows ffmpeg reel immediately, upgrades to AI when ready
- "✦ AI Video" badge shown when AI video is available
- Cinematic prompt displayed as overlay on the video

## Gateway status
- /video-model → 404 (all routes, all versions confirmed dead)
- video_generate tool: agent-only, works perfectly
- Solution: agent monitors pending jobs, generates AI video, completes via PATCH endpoint

## How to upgrade a job to AI video
1. GET /api/reel/pending — check for jobs
2. Use video_generate tool with cinematicPrompt (9:16, 5-8s, generate_audio=false)  
3. upload /tmp/reel-{jobId}.mp4
4. PATCH /api/reel/{jobId}/complete with videoUrl + videoType=ai + addMusic=true

## Ports
- Web/API: 4200
- Mobile: 4300
