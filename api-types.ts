/**
 * Sora API Types
 * GET /backend/notif?limit=100&before={cursor}
 */

interface NotifResponse {
  data: NotifItem[];
  last_id: string;      // cursor for pagination, e.g. "task_01abc..."
  has_more: boolean;
}

interface NotifItem {
  ordering_key: number; // timestamp in ms
  payload: TaskPayload;
}

interface TaskPayload {
  id: string;           // "task_01abc..."
  user: string;         // "user-xxxxx"
  created_at: string;   // ISO date
  status: "succeeded" | "failed" | "pending";
  type: "video_gen";
  prompt: string;
  n_variants: number;
  n_frames: number;
  height: number;
  width: number;
  model: string;        // "sy_8", "turbo"
  operation: string;    // "simple_compose"
  generations: Generation[];
  // ... other fields omitted
}

interface Generation {
  id: string;           // "gen_01abc..." - THIS IS WHAT WE SEARCH FOR
  task_id: string;
  created_at: string;
  url: string;          // watermarked video URL
  seed: number;
  can_download: boolean;
  is_public: boolean;
  encodings: Encodings;
  width: number;
  height: number;
  n_frames: number;
  prompt: string;
  user: {
    id: string;
    username: string;
  };
  // ... other fields omitted
}

interface Encodings {
  source: VideoEncoding | null;      // ⭐ ORIGINAL without watermark
  source_wm: VideoEncoding | null;   // with watermark
  md: VideoEncoding | null;          // medium quality
  md_wm: VideoEncoding | null;
  ld: VideoEncoding | null;          // low quality
  thumbnail: MediaPath | null;
  thumbnail_wm: MediaPath | null;
  spritesheet: MediaPath | null;
  gif: MediaPath | null;
  mp3: MediaPath | null;
  // ... other encodings
}

interface VideoEncoding {
  path: string;         // ⭐ Direct download URL (signed, expires)
  size: number;         // bytes
  width: number;
  height: number;
  duration_secs: number;
  codec: string | null; // "h264", "hevc"
  ssim: number;         // quality metric
}

interface MediaPath {
  path: string;
  size: number | null;
}

/**
 * Example response (anonymized):
 */
const exampleResponse: NotifResponse = {
  data: [
    {
      ordering_key: 1766004036164,
      payload: {
        id: "task_01example123",
        user: "user-XXXXXXXXXXXX",
        created_at: "2025-12-17T20:40:36.207467Z",
        status: "succeeded",
        type: "video_gen",
        prompt: "A cat walking in the park",
        n_variants: 1,
        n_frames: 300,
        height: 640,
        width: 352,
        model: "sy_8",
        operation: "simple_compose",
        generations: [
          {
            id: "gen_01example456",  // ← We search for this ID
            task_id: "task_01example123",
            created_at: "2025-12-17T20:43:23.044571Z",
            url: "https://videos.openai.com/...",
            seed: 1234567890,
            can_download: true,
            is_public: false,
            width: 352,
            height: 640,
            n_frames: 300,
            prompt: "A cat walking in the park",
            user: {
              id: "user-XXXXXXXXXXXX",
              username: "example_user"
            },
            encodings: {
              source: {
                path: "https://videos.openai.com/az/files/...",  // ← Download this!
                size: 10838084,
                width: 704,
                height: 1280,
                duration_secs: 10.1,
                codec: "h264",
                ssim: 0.9889866
              },
              source_wm: {
                path: "https://videos.openai.com/az/files/...",
                size: 10655655,
                width: 704,
                height: 1280,
                duration_secs: 10.1,
                codec: "h264",
                ssim: 0.9914032
              },
              md: { path: "...", size: 1363057, width: 480, height: 872, duration_secs: 10.1, codec: "hevc", ssim: 0.93 },
              md_wm: null,
              ld: null,
              thumbnail: { path: "https://videos.openai.com/...", size: null },
              thumbnail_wm: null,
              spritesheet: null,
              gif: null,
              mp3: null
            }
          }
        ]
      }
    }
  ],
  last_id: "task_01example123",
  has_more: false
};

/**
 * Key points:
 * 
 * 1. We need `generation.id` (gen_*) to find the video
 * 2. `encodings.source.path` is the original video WITHOUT watermark
 * 3. `encodings.source_wm.path` is WITH watermark
 * 4. URLs are signed and expire (check `se=` param in URL)
 * 5. Pagination: use `last_id` as `before` param, check `has_more`
 */
