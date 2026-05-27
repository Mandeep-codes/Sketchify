/**
 * video-agent.ts
 *
 * The server writes pending reel jobs to /tmp/reel-video-queue.json.
 * The Runable agent (external) polls this file, composites all images into
 * ONE unified scene using image_refine, then generates a single AI video
 * from that composite using video_generate, and PATCHes /reel/:id/complete.
 *
 * This file only exports a no-op stub — actual AI video generation
 * is handled by the agent who has access to image_refine + video_generate tools.
 */

export function startVideoAgent() {
  console.log('[video-agent] Queue-based. Agent handles AI video generation externally.');
}
