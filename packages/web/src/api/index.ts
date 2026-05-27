import { Hono } from 'hono';
import { cors } from "hono/cors";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { generateText } from "ai";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { gateway } from "./lib/gateway";
import { s3 } from "./lib/s3";
import { db, withRetry } from "./database";
import { reelJobs } from "./database/schema";
import { eq, and } from "drizzle-orm";
import sharp from "sharp";
import { spawnSync } from "child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// ── nanoid-lite (no dependency) ────────────────────────────────────────────────
const nanoid = () => Math.random().toString(36).slice(2, 11) + Date.now().toString(36);

const stylePrompts: Record<string, string> = {
  'Realistic':     'photorealistic DSLR photograph, natural lighting, sharp focus, high dynamic range, lifelike textures and materials',
  'Anime':         'anime illustration, cel-shaded, vibrant saturated colors, clean outlines, Studio Ghibli / makoto shinkai aesthetic',
  'Oil Painting':  'oil painting on canvas, impressionist brush strokes, rich deep colors, painterly texture, museum quality fine art',
  'Cyberpunk':     'cyberpunk digital art, neon-lit rain-soaked streets, holographic signs, dark moody atmosphere, Blade Runner 2049 aesthetic',
  'Watercolor':    'loose watercolor illustration, soft wet-on-wet washes, white paper showing through, delicate translucent colors',
  'Pencil Sketch': 'detailed graphite pencil drawing, fine hatching and cross-hatching for shading, crisp pencil lines, textured paper grain, black and white tonal values',
  'Comic Book':    'bold comic book illustration, thick ink outlines, halftone dot shading, flat vivid colors, dynamic action composition, Marvel/DC style',
  'Pixel Art':     '16-bit retro pixel art, limited color palette, visible square pixels, crisp blocky forms, SNES/Game Boy Advance era video game aesthetic',
  '3D Render':     'high-quality 3D CGI render, smooth subsurface scattering, physically-based materials, cinematic studio lighting, Blender/Unreal Engine quality',
  'Fantasy Art':   'epic fantasy digital painting, dramatic atmospheric lighting, lush painterly details, heroic composition, Dungeons & Dragons / Magic the Gathering illustration style',
};

// Path to bundled lo-fi music
const MUSIC_PATH = join(process.cwd(), 'public', 'reel-music.mp3');

// ── Helper: fetch any URL or data-URI → normalized PNG base64 ─────────────────
const toBase64Png = async (url: string): Promise<string> => {
  let imgBuffer: Buffer;
  if (url.startsWith('data:')) {
    const b64 = url.replace(/^data:image\/[a-z+]+;base64,/, '');
    imgBuffer = Buffer.from(b64, 'base64');
  } else {
    const resp = await fetch(url);
    if (!resp.ok) {
      if (resp.status === 403 || resp.status === 401) {
        throw new Error('Image link expired. Please re-generate your images and try again.');
      }
      throw new Error(`Failed to fetch image: ${resp.status}`);
    }
    imgBuffer = Buffer.from(await resp.arrayBuffer());
  }
  return (await sharp(imgBuffer)
    .resize(1080, 1080, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer()).toString('base64');
};

// ── Cinematic ffmpeg reel (Ken Burns zoom/pan + cinematic grade + crossfade, 9:16) ──
const buildCinematicReel = async (base64Images: string[]): Promise<{ videoUrl: string; duration: number }> => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'reel-'));
  try {
    const imgFiles: string[] = [];
    for (let i = 0; i < base64Images.length; i++) {
      const raw = Buffer.from(base64Images[i]!, 'base64');
      const outPath = join(tmpDir, `img${String(i).padStart(3, '0')}.png`);
      await sharp(raw)
        .resize(1350, 2400, { fit: 'cover', position: 'centre' })
        .png()
        .toFile(outPath);
      imgFiles.push(outPath);
    }

    const n = imgFiles.length;
    const FPS = 30;
    const PER_IMAGE_SEC = 4.0;
    const FADE_SEC = 0.8;
    const SEGMENT_SEC = PER_IMAGE_SEC + FADE_SEC;
    const ZOOM_FRAMES = Math.round(SEGMENT_SEC * FPS);
    const outVideo = join(tmpDir, 'reel.mp4');
    const hasMusic = existsSync(MUSIC_PATH);

    const ZOOM_SPEED = (0.25 / ZOOM_FRAMES).toFixed(6);
    const kenBurnsPatterns = [
      `scale=1350:2400,zoompan=z='min(zoom+${ZOOM_SPEED},1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${ZOOM_FRAMES}:s=1350x2400:fps=${FPS},crop=1080:1920`,
      `scale=1350:2400,zoompan=z='min(zoom+${ZOOM_SPEED},1.25)':x='iw/2-(iw/zoom/2)+(iw/zoom)*0.1*(zoom-1)':y='ih/2-(ih/zoom/2)':d=${ZOOM_FRAMES}:s=1350x2400:fps=${FPS},crop=1080:1920`,
      `scale=1350:2400,zoompan=z='if(lte(on,1),1.25,max(1.0,zoom-${ZOOM_SPEED}))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${ZOOM_FRAMES}:s=1350x2400:fps=${FPS},crop=1080:1920`,
      `scale=1350:2400,zoompan=z='min(zoom+${ZOOM_SPEED},1.25)':x='iw/2-(iw/zoom/2)-(iw/zoom)*0.08*(zoom-1)':y='ih/2-(ih/zoom/2)-(ih/zoom)*0.06*(zoom-1)':d=${ZOOM_FRAMES}:s=1350x2400:fps=${FPS},crop=1080:1920`,
    ];

    const colorGrade = `curves=r='0/0 0.25/0.22 0.75/0.8 1/1':g='0/0 0.25/0.22 0.75/0.78 1/0.97':b='0/0 0.25/0.28 0.75/0.74 1/0.95',eq=contrast=1.1:saturation=1.05:brightness=-0.02`;
    const BAR_H = 112;
    const cineBars = `drawbox=x=0:y=0:w=1080:h=${BAR_H}:color=black:t=fill,drawbox=x=0:y=${1920 - BAR_H}:w=1080:h=${BAR_H}:color=black:t=fill`;

    let inputs = '';
    for (const f of imgFiles) inputs += `-loop 1 -t ${SEGMENT_SEC} -i "${f}" `;

    const kbParts: string[] = [];
    for (let i = 0; i < n; i++) {
      const kb = kenBurnsPatterns[i % kenBurnsPatterns.length]!;
      kbParts.push(`[${i}:v]${kb},${colorGrade},${cineBars}[kb${i}]`);
    }

    const transitions = ['fade', 'wipeleft', 'circleopen', 'fadeblack'];
    const xfadeParts: string[] = [];
    let prev = `[kb0]`;
    const totalDur = PER_IMAGE_SEC * n;
    for (let i = 1; i < n; i++) {
      const offset = (i * (PER_IMAGE_SEC - FADE_SEC)).toFixed(2);
      const transition = transitions[(i - 1) % transitions.length]!;
      const out = i === n - 1 ? '[vout]' : `[xf${i}]`;
      xfadeParts.push(`${prev}[kb${i}]xfade=transition=${transition}:duration=${FADE_SEC}:offset=${offset}${out}`);
      prev = `[xf${i}]`;
    }

    const filterComplex = n === 1
      ? `[0:v]${kenBurnsPatterns[0]!},${colorGrade},${cineBars}[vout]`
      : [...kbParts, ...xfadeParts].join(';');

    const audioDur = totalDur - FADE_SEC;
    const audioFade = hasMusic ? `-af "afade=t=in:st=0:d=1.5,afade=t=out:st=${Math.max(0, audioDur - 2.5)}:d=2.5"` : '';
    const ffmpegCmd = hasMusic
      ? `ffmpeg -y ${inputs} -stream_loop -1 -t ${audioDur} -i "${MUSIC_PATH}" -filter_complex "${filterComplex}" -map "[vout]" -map ${n}:a -t ${audioDur} -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -r ${FPS} -c:a aac -b:a 192k ${audioFade} "${outVideo}"`
      : `ffmpeg -y ${inputs} -filter_complex "${filterComplex}" -map "[vout]" -t ${audioDur} -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -r ${FPS} "${outVideo}"`;

    const result = spawnSync('bash', ['-c', ffmpegCmd], { timeout: 300_000 });
    if (result.status !== 0) {
      console.error('[reel] ffmpeg stderr:', result.stderr?.toString().slice(-800));
      throw new Error('ffmpeg failed: ' + result.stderr?.toString().slice(-200));
    }

    const videoBuffer = readFileSync(outVideo);
    const s3Key = `reels/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
    await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: s3Key, Body: videoBuffer, ContentType: 'video/mp4' }));
    const videoUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: s3Key }), { expiresIn: 86400 });
    return { videoUrl, duration: totalDur };
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
};

const app = new Hono()
  .basePath('api')
  .use(cors({ origin: (origin) => origin ?? "*", credentials: true }))
  .get('/ping', (c) => c.json({ message: `Pong! ${Date.now()}` }))
  .get('/health', (c) => c.json({ status: 'ok' }))

  // ── Generate image from sketch ──────────────────────────────────────────────
  .post(
    '/generate',
    zValidator('json', z.object({
      imageBase64: z.string(),
      style: z.enum(['Realistic', 'Anime', 'Oil Painting', 'Cyberpunk', 'Watercolor', 'Pencil Sketch', 'Comic Book', 'Pixel Art', '3D Render', 'Fantasy Art']).default('Realistic'),
      userHint: z.string().max(300).optional(),
    })),
    async (c) => {
      const { imageBase64, style, userHint } = c.req.valid('json');

      const styleDesc = stylePrompts[style] ?? stylePrompts['Realistic'];
      const hintLine = userHint?.trim() ? `\n7. Additional direction from the artist: "${userHint.trim()}" — incorporate this into the scene.` : '';
      const prompt = `You are a sketch-to-image converter. Your ONLY job is to render the provided hand-drawn sketch into a finished ${style} image.

CRITICAL RULES — follow exactly:
1. Preserve the sketch EXACTLY — every shape, object, character, composition, spatial layout, and proportions must match the sketch faithfully.
2. Do NOT add, remove, or move any elements. If the sketch shows a cat on the left, the cat is on the left. If it shows 3 objects, render 3 objects.
3. Use the sketch as a strict structural template — trace its outlines and fill them with the target style.
4. Style to apply: ${styleDesc}
5. Output a single square image with no borders, no text, no watermarks, no UI elements.
6. Make it look stunning and professional within the chosen style.${hintLine}`;

      try {
        const mimeMatch = imageBase64.match(/^data:(image\/[a-z+]+);base64,/);
        const mimeType = mimeMatch?.[1] ?? 'image/png';
        const rawBase64 = imageBase64.replace(/^data:image\/[a-z+]+;base64,/, '');

        let base64Data: string;
        if (mimeType === 'image/svg+xml') {
          const svgBuffer = Buffer.from(rawBase64, 'base64');
          const pngBuffer = await sharp(svgBuffer, { density: 150 })
            .resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .negate({ alpha: false })
            .png()
            .toBuffer();
          base64Data = pngBuffer.toString('base64');
        } else {
          base64Data = rawBase64;
        }

        const { files } = await generateText({
          model: gateway("google/gemini-3-pro-image"),
          providerOptions: {
            google: { responseModalities: ["TEXT", "IMAGE"] },
          },
          messages: [
            {
              role: "user",
              content: [
                { type: "image", image: base64Data, mimeType: "image/png" } as any,
                { type: "text", text: prompt },
              ],
            },
          ],
        });

        if (!files || files.length === 0) {
          return c.json({ error: 'No image returned from AI gateway' }, 500);
        }

        const file = files[0]!;
        const key = `generated/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
        await s3.send(new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          Body: Buffer.from(file.uint8Array),
          ContentType: file.mediaType ?? 'image/png',
        }));

        const imageUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
          { expiresIn: 3600 }
        );

        // Also return base64 so the app can store pixel data (avoids expiring S3 URL issue)
        const resultBase64 = `data:${file.mediaType ?? 'image/png'};base64,${Buffer.from(file.uint8Array).toString('base64')}`;
        return c.json({ imageUrl, imageBase64: resultBase64, style }, 200);
      } catch (err: any) {
        console.error('AI generation error:', err?.message ?? err);
        return c.json({ error: err?.message ?? 'Generation failed' }, 500);
      }
    }
  )

  // ── Try It On — sketch-on-photo AI rendering ────────────────────────────────
  .post(
    '/try-it-on',
    zValidator('json', z.object({
      photoBase64:  z.string(),   // full data-uri of the real photo
      sketchBase64: z.string(),   // SVG data-uri of the sketch overlay
      category:     z.enum(['tattoo', 'room', 'hair', 'outfit']),
    })),
    async (c) => {
      const { photoBase64, sketchBase64, category } = c.req.valid('json');

      const categoryPrompts: Record<string, string> = {
        tattoo: `This is a real photo of a person with a sketch overlay drawn on top. The sketch indicates a tattoo design and its exact placement on the body.

Your task: Render a photorealistic version of the photo where the sketch has been applied as a real tattoo. Rules:
- Apply the sketched design as a freshly done, professional tattoo exactly where it is drawn
- Match the skin tone, body lighting, and texture perfectly — the tattoo must look physically real
- Preserve EVERYTHING else in the photo exactly — background, clothing, face, other body parts
- The tattoo lines should follow the natural contours and curvature of the skin
- No other changes. Output a single image.`,

        room: `This is a real photo of a room with a sketch overlay indicating desired decor/furniture changes.

Your task: Render a photorealistic version of the room with the sketched changes applied. Rules:
- Apply the furniture, wall colors, decor, and layout changes exactly as sketched
- Use realistic materials, lighting, and shadows that match the existing room's light sources
- Preserve unchanged parts of the room exactly — flooring, windows, architecture
- Make it look like an actual interior design photo, not a render or concept art
- No other changes. Output a single image.`,

        hair: `This is a real photo of a person with a sketch overlay showing a desired new hairstyle or hair color.

Your task: Render a photorealistic version of the photo where the person has the sketched hairstyle. Rules:
- Apply the new haircut, length, or color exactly as indicated in the sketch
- Match the natural lighting on the hair — use the existing light sources in the photo
- Preserve the face, skin, clothing, and background EXACTLY — no other changes
- The hair must look real: natural texture, proper volume, realistic strands
- No other changes. Output a single image.`,

        outfit: `This is a real photo of a person with a sketch overlay showing a desired outfit or clothing change.

Your task: Render a photorealistic version of the photo where the person is wearing the sketched outfit. Rules:
- Dress the person in the sketched clothing with realistic fabric texture, drape, and fit
- Match the lighting and shadows to the existing photo — the clothing must look physically present
- Preserve the person's face, body, and the background EXACTLY — no other changes
- Fabric should have natural wrinkles, folds, and material properties (denim looks like denim, etc.)
- No other changes. Output a single image.`,
      };

      const prompt = categoryPrompts[category] ?? categoryPrompts['room'];

      try {
        // Normalize photo to PNG
        const photoMime = photoBase64.match(/^data:(image\/[a-z+]+);base64,/)?.[1] ?? 'image/jpeg';
        const rawPhoto = photoBase64.replace(/^data:image\/[a-z+]+;base64,/, '');
        const photoBuffer = Buffer.from(rawPhoto, 'base64');
        const photoPng = await sharp(photoBuffer)
          .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
          .png()
          .toBuffer();
        const photoPngB64 = photoPng.toString('base64');

        // Normalize sketch (SVG → PNG)
        const sketchMime = sketchBase64.match(/^data:(image\/[a-z+]+);base64,/)?.[1] ?? 'image/svg+xml';
        const rawSketch = sketchBase64.replace(/^data:image\/[a-z+]+;base64,/, '');
        let sketchPngB64: string;
        if (sketchMime === 'image/svg+xml') {
          const svgBuffer = Buffer.from(rawSketch, 'base64');
          const pngBuf = await sharp(svgBuffer, { density: 150 })
            .resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
            .png()
            .toBuffer();
          sketchPngB64 = pngBuf.toString('base64');
        } else {
          const pngBuf = await sharp(Buffer.from(rawSketch, 'base64'))
            .resize(1024, 1024, { fit: 'contain' })
            .png()
            .toBuffer();
          sketchPngB64 = pngBuf.toString('base64');
        }

        // Composite: sketch overlay on top of photo (semi-transparent sketch lines)
        // This gives Gemini ONE image with full spatial context
        const photoImg = sharp(photoPng).resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } });
        const sketchOverlay = await sharp(Buffer.from(sketchPngB64, 'base64'))
          .resize(1024, 1024, { fit: 'fill' })
          .png()
          .toBuffer();

        // Tint sketch strokes red so they're clearly visible as overlay
        const compositePng = await photoImg
          .composite([{
            input: sketchOverlay,
            blend: 'over',
          }])
          .png()
          .toBuffer();
        const compositePngB64 = compositePng.toString('base64');

        const { files } = await generateText({
          model: gateway('google/gemini-3-pro-image'),
          providerOptions: {
            google: { responseModalities: ['TEXT', 'IMAGE'] },
          },
          messages: [
            {
              role: 'user',
              content: [
                // Image 1: composite (photo + sketch overlay)
                { type: 'image', image: compositePngB64, mimeType: 'image/png' } as any,
                // Image 2: original photo (no sketch) for reference
                { type: 'image', image: photoPngB64, mimeType: 'image/png' } as any,
                { type: 'text', text: prompt },
              ],
            },
          ],
        });

        if (!files || files.length === 0) {
          return c.json({ error: 'No image returned from AI' }, 500);
        }

        const file = files[0]!;
        const key = `try-it-on/${Date.now()}-${nanoid()}.png`;
        await s3.send(new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          Body: Buffer.from(file.uint8Array),
          ContentType: file.mediaType ?? 'image/png',
        }));

        const imageUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
          { expiresIn: 3600 }
        );

        const resultBase64 = `data:${file.mediaType ?? 'image/png'};base64,${Buffer.from(file.uint8Array).toString('base64')}`;
        return c.json({ imageUrl, imageBase64: resultBase64, category }, 200);
      } catch (err: any) {
        console.error('[try-it-on] error:', err?.message ?? err);
        return c.json({ error: err?.message ?? 'Try It On failed' }, 500);
      }
    }
  )

  // ── POST /reel — queue a cinematic reel job ─────────────────────────────────
  // Returns jobId immediately; mobile polls GET /reel/:jobId for status.
  // Phase 1+2 run synchronously (fast). Phase 3 (ffmpeg) runs async in background.
  // If an AI video was already generated by the agent, it's set in the DB and returned.
  .post(
    '/reel',
    zValidator('json', z.object({
      imageUrls: z.array(z.string()).min(2),
      albumName: z.string().default('Reel'),
      modeId: z.string().optional(),
      modeLabel: z.string().optional(),
      promptSuffix: z.string().optional(),
      aspectRatio: z.string().optional(),
    })),
    async (c) => {
      const { imageUrls, albumName, modeId, modeLabel, promptSuffix, aspectRatio } = c.req.valid('json');
      const jobId = nanoid();
      const now = Date.now();

      // Create job row immediately so mobile can start polling
      // Store a seed cinematic prompt from modeLabel + promptSuffix — AI will refine it later
      const seedPrompt = [modeLabel, promptSuffix].filter(Boolean).join(' — ') || null;

      await db.insert(reelJobs).values({
        id: jobId,
        albumName,
        imageUrls: JSON.stringify(imageUrls),
        cinematicPrompt: seedPrompt,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });

      // Run the heavy work in background (don't await)
      (async () => {
        try {
          // Phase 1: normalize images
          const base64Images: string[] = await Promise.all(imageUrls.map(toBase64Png));
          console.log(`[reel:${jobId}] Phase 1 done`);

          // Phase 2: Gemini writes a mode-specific video prompt
          const modeVideoInstructions: Record<string, string> = {
            cinematic: `Write a CINEMATIC video prompt. Style: dramatic film look, anamorphic lens, sweeping dolly or crane camera movement, golden hour or moody blue-hour lighting, film grain, letterbox aspect. The subjects should feel like they are in a Hollywood movie scene. Focus on atmosphere, tension, or beauty. Camera moves slowly and purposefully.`,
            story: `Write a SOCIAL MEDIA STORY video prompt. Style: vertical, fast-paced, energetic, bright vivid colors, close-ups and quick cuts implied in motion, trendy Instagram/TikTok reel feel. The subject should feel vibrant and eye-catching. Camera is close and personal.`,
            ad: `Write a PRODUCT ADVERTISEMENT video prompt. Style: clean, commercial, polished. The subject/product is the hero — place it center-frame on a clean or minimal background. Camera does a slow, smooth push-in or orbit around the product. Studio or natural product lighting. No clutter. Feels like a premium brand TV commercial or Apple/Nike ad. Show the product clearly. If there is a character or mascot, they should react to or endorse the product — NOT dominate it.`,
            portrait: `Write a PORTRAIT PHOTOGRAPHY video prompt. Style: professional headshot / editorial portrait. Soft bokeh background, studio or window lighting, the person/character is sharp and well-lit. Camera slowly racks focus or gently pans across the face. Intimate, personal, polished.`,
            concept: `Write a CONCEPT ART video prompt. Style: fantasy or sci-fi digital painting brought to life. Epic scale, dramatic sky, atmospheric depth, magical or technological elements. Camera pulls back to reveal the world, or slowly floats through a detailed environment. Painterly and awe-inspiring.`,
            logo: `Write a LOGO / BRAND REVEAL video prompt. Style: clean, minimal, professional. The logo or icon appears from nothing — fade in, particle build, or light sweep. Clean white or dark background. Subtle elegant camera move. Feels like a brand identity reveal or app launch screen.`,
            interior: `Write an INTERIOR DESIGN video prompt. Style: architectural visualization, warm ambient lighting, cozy and inviting atmosphere. Camera slowly pans or dollies through the space, revealing furniture and details. Photorealistic render quality.`,
            architecture: `Write an ARCHITECTURE video prompt. Style: photorealistic exterior shot, golden hour or blue hour lighting, dramatic sky, ultra detailed surfaces. Camera slowly pushes toward the building or orbits it majestically. Feels like an architectural firm's portfolio film.`,
            fashion: `Write a FASHION EDITORIAL video prompt. Style: high fashion magazine, dramatic lighting, the outfit/subject is styled impeccably. Camera slowly circles or tracks alongside the subject. Feels like a Vogue or runway film. Bold composition.`,
            anime: `Write an ANIME / ANIMATION video prompt. Style: vibrant cel-shaded anime aesthetic, expressive character movement, dynamic action or emotional moment, Studio Ghibli or Makoto Shinkai inspired. Wind in the hair, sparkle effects, rich colored backgrounds. Feels like an anime opening sequence.`,
          };

          const modeInstruction = modeVideoInstructions[modeId ?? ''] ?? modeVideoInstructions['cinematic'];

          let cinematicPrompt = `A dramatic cinematic scene — ${albumName}. Epic lighting, sweeping camera movement, emotional atmosphere.`;
          try {
            const storyMessages: any[] = [{
              role: 'user',
              content: [
                ...base64Images.map((b64) => ({ type: 'image', image: b64, mimeType: 'image/png' })),
                {
                  type: 'text',
                  text: `You are a professional video director writing prompts for AI video generation.

I'm giving you ${base64Images.length} AI-generated image(s). Study the subjects carefully — identify every object, character, or element visible.

YOUR TASK: Write ONE video generation prompt for this specific style:

${modeInstruction}

STRICT RULES:
1. Identify the exact subjects/objects from the images and feature them prominently
2. Follow the style instructions above precisely — do NOT default to "cinematic drama" unless that is the mode
3. Describe: what is in frame, camera movement, lighting, mood, background, any character action
4. Keep it to 2–3 sentences, max 150 words
5. Do NOT mention "sketch", "drawing", "AI image", or "illustration" — treat them as real
6. Output ONLY the video prompt — no preamble, no explanation, no quotes

Album context: "${albumName}"`,
                },
              ],
            }];
            const { text } = await generateText({
              model: gateway('google/gemini-2.5-flash'),
              messages: storyMessages,
              maxTokens: 250,
            });
            cinematicPrompt = text.trim();
          } catch (err: any) {
            console.warn(`[reel:${jobId}] Gemini story failed:`, err?.message);
          }

          // Save prompt to DB
          await db.update(reelJobs)
            .set({ cinematicPrompt, status: 'processing', updatedAt: Date.now() })
            .where(eq(reelJobs.id, jobId));
          console.log(`[reel:${jobId}] Phase 2 done — prompt: ${cinematicPrompt.slice(0, 80)}…`);

          // Write job to queue file for agent polling
          // Agent will: 1) merge all images into one scene, 2) generate ONE video from merged image
          try {
            const queueFile = '/tmp/reel-video-queue.json';
            let queue: any[] = [];
            try { queue = JSON.parse(readFileSync(queueFile, 'utf8')); } catch {}
            if (!queue.find((q: any) => q.id === jobId)) {
              queue.push({
                id: jobId,
                prompt: cinematicPrompt,
                albumName,
                modeId: modeId ?? 'cinematic',
                modeLabel: modeLabel ?? 'Cinematic Reel',
                aspectRatio: aspectRatio ?? '9:16',
                // composite: true means agent MUST merge all images into ONE scene first,
                // then generate a SINGLE video from that composite. Never separate videos per image.
                composite: true,
                imageUrls,
                base64Images,
                ts: Date.now()
              });
              writeFileSync(queueFile, JSON.stringify(queue, null, 2));
            }
          } catch {}

          // Phase 3: Check if agent already completed AI video for this job
          const job = await db.select().from(reelJobs).where(eq(reelJobs.id, jobId)).get();
          if (job?.videoUrl) {
            console.log(`[reel:${jobId}] AI video already set by agent — skipping ffmpeg`);
            return;
          }

          // Phase 3 fallback: ffmpeg Ken Burns cinematic reel
          console.log(`[reel:${jobId}] Phase 3 — building ffmpeg reel…`);
          const { videoUrl, duration } = await buildCinematicReel(base64Images);

          await db.update(reelJobs)
            .set({ status: 'done', videoUrl, videoType: 'ffmpeg', updatedAt: Date.now() })
            .where(and(eq(reelJobs.id, jobId), eq(reelJobs.status, 'processing')));
          console.log(`[reel:${jobId}] done — ffmpeg reel, ${duration}s`);
        } catch (err: any) {
          console.error(`[reel:${jobId}] error:`, err?.message);
          await db.update(reelJobs)
            .set({ status: 'error', errorMsg: err?.message ?? 'Unknown error', updatedAt: Date.now() })
            .where(eq(reelJobs.id, jobId));
        }
      })();

      return c.json({ jobId, status: 'pending' }, 202);
    }
  )

  // ── GET /reel/pending — agent polling endpoint ─────────────────────────────
  // Returns jobs that need AI video generation (status = pending or processing, no videoUrl yet)
  .get('/reel/pending', async (c) => {
    const jobs = await db.select({
      id: reelJobs.id,
      albumName: reelJobs.albumName,
      imageUrls: reelJobs.imageUrls,
      cinematicPrompt: reelJobs.cinematicPrompt,
      status: reelJobs.status,
      videoType: reelJobs.videoType,
      createdAt: reelJobs.createdAt,
    })
    .from(reelJobs)
    .all();

    // Return jobs where AI video not yet provided
    const pending = jobs.filter(j =>
      (j.status === 'pending' || j.status === 'processing' || j.status === 'done') &&
      j.videoType !== 'ai'
    );

    return c.json({ jobs: pending });
  })

  // ── GET /reel/:jobId — poll job status ─────────────────────────────────────
  .get('/reel/:jobId', async (c) => {
    const { jobId } = c.req.param();
    const job = await withRetry(() => db.select().from(reelJobs).where(eq(reelJobs.id, jobId)).get());

    if (!job) return c.json({ error: 'Job not found' }, 404);

    return c.json({
      jobId: job.id,
      status: job.status,
      videoUrl: job.videoUrl,
      videoType: job.videoType,
      cinematicPrompt: job.cinematicPrompt,
      errorMsg: job.errorMsg,
      albumName: job.albumName,
    });
  })

  // ── PATCH /reel/:jobId/complete — agent submits AI video ──────────────────
  // Called by agent after video_generate completes.
  // If addMusic=true, the server will mix in the lo-fi background track.
  .patch('/reel/:jobId/complete', zValidator('json', z.object({
    videoUrl: z.string().url(),
    videoType: z.string().default('ai'),
    addMusic: z.boolean().default(true),
  })), async (c) => {
    const { jobId } = c.req.param();
    const { videoUrl, videoType, addMusic } = c.req.valid('json');

    const job = await db.select().from(reelJobs).where(eq(reelJobs.id, jobId)).get();
    if (!job) return c.json({ error: 'Job not found' }, 404);

    let finalUrl = videoUrl;

    // Mix in background music if requested and music file exists
    if (addMusic && existsSync(MUSIC_PATH)) {
      try {
        const tmpDir = mkdtempSync(join(tmpdir(), 'ai-reel-'));
        const rawPath = join(tmpDir, 'raw.mp4');
        const outPath = join(tmpDir, 'final.mp4');

        // Download AI video
        const resp = await fetch(videoUrl);
        if (resp.ok) {
          writeFileSync(rawPath, Buffer.from(await resp.arrayBuffer()));

          // Get video duration
          const probeResult = spawnSync('ffprobe', [
            '-v', 'quiet', '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1', rawPath
          ]);
          const dur = parseFloat(probeResult.stdout?.toString() ?? '5') || 5;

          const mixCmd = `ffmpeg -y -i "${rawPath}" -stream_loop -1 -t ${dur} -i "${MUSIC_PATH}" \
            -c:v copy -c:a aac -b:a 128k \
            -af "afade=t=in:st=0:d=1,afade=t=out:st=${Math.max(0, dur - 1.5)}:d=1.5" \
            -shortest "${outPath}"`;

          const res = spawnSync('bash', ['-c', mixCmd], { timeout: 120_000 });
          if (res.status === 0) {
            const buf = readFileSync(outPath);
            const s3Key = `reels/ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.mp4`;
            await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: s3Key, Body: buf, ContentType: 'video/mp4' }));
            finalUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: s3Key }), { expiresIn: 86400 });
            console.log(`[reel:${jobId}] Music mixed into AI video`);
          }
        }
        try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      } catch (err: any) {
        console.warn(`[reel:${jobId}] Music mix failed, using original:`, err?.message);
      }
    }

    await db.update(reelJobs)
      .set({ videoUrl: finalUrl, videoType, status: 'done', updatedAt: Date.now() })
      .where(eq(reelJobs.id, jobId));

    console.log(`[reel:${jobId}] AI video set by agent — ${videoType}`);
    return c.json({ ok: true, videoUrl: finalUrl });
  });

export type AppType = typeof app;
export default app;
