# Sora Remove Watermark

Download Sora videos in original quality without watermark.

# Install Browser Extension
- https://chromewebstore.google.com/detail/sora-remove-watermark/femmbfkejicbihcplfopaiokeagdkjgg


## Features

This Chrome extension lets you download your Sora AI-generated videos without the OpenAI watermark, preserving the original resolution and quality.

- 🎬 Download published videos and unpublished drafts
- 🔒 100% private — no data sent to external servers
- 💻 Runs entirely in your browser
- ⭐ Open source & free forever


## Usage

1. Open any of your video pages on sora.chatgpt.com (drafts or published)
2. Click the extension icon
3. Click "Download Original"

> Note: Only works with your own videos. Cannot download other users' videos.


## The Story Behind This Extension

I wasn't a heavy Sora user, but when I saw people **selling** access to watermark-free videos — and getting results in 1 second — I knew something was off. No ML model removes watermarks that fast. The originals had to be on the servers.

### The Hunt

First stop: Network tab. Poking around, I found that when you open a video, the API returns an `encodings` object with both `source` and `source_wm` fields. The catch? OpenAI was putting the **same watermarked URL** in both. But the existence of `source` meant the original was stored somewhere.

I tried bruteforcing URLs with different `gen_id`/`task_id`/`post_id` combinations — no luck. Every URL has a server-generated signature that can't be guessed.

### The Breakthrough

After hours of dead ends, I remembered: there was an **old Sora site**. Same account, different API.

I checked the old site, tried some requests... nothing direct worked. But then I noticed a weird endpoint loading on page open:

```
/backend/notif?limit=10
```

The **notifications endpoint**. It returns your entire video library — from both old and new Sora — with all encodings. Including the real `source` URL that the main API hides.

Classic case of one endpoint being locked down while another leaks everything.

### The Result

One evening of reverse engineering → one Chrome extension → watermark-free downloads for everyone.

OpenAI stores the originals. They just forgot to hide them everywhere.
