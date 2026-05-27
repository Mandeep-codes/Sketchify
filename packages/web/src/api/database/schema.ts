import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Async reel generation jobs.
 * - POST /reel creates a row with status="pending"
 * - Agent monitors pending rows, generates AI video, sets status="done" + videoUrl
 * - GET /reel/:jobId returns current status (polled by mobile)
 */
export const reelJobs = sqliteTable("reel_jobs", {
  id: text("id").primaryKey(), // nanoid
  albumName: text("album_name").notNull(),
  imageUrls: text("image_urls").notNull(), // JSON array string
  cinematicPrompt: text("cinematic_prompt"), // set by Gemini in Phase 2
  status: text("status").notNull().default("pending"), // pending | processing | done | error
  videoUrl: text("video_url"), // set when done
  videoType: text("video_type"), // "ai" | "ffmpeg"
  errorMsg: text("error_msg"),
  createdAt: integer("created_at").notNull(), // unix ms
  updatedAt: integer("updated_at").notNull(), // unix ms
});
