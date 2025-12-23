// Content script for communication between page and extension
let authToken = null;
let deviceId = null;

// Caches
const postCache = new Map();  // postId → generationId
const genCache = new Map();   // generationId → video info
let oldestCursor = null;
let historyFullyLoaded = false;
let newestCachedId = null;

// Listen for messages from inject.js
window.addEventListener('message', (event) => {
    if (event.origin !== 'https://sora.chatgpt.com') return;
    
    if (event.data.type === 'SORA_AUTH') {
        authToken = event.data.token;
    }
    if (event.data.type === 'SORA_DEVICE_ID') {
        deviceId = event.data.deviceId;
    }
});

// Inject script into page context
function injectScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectScript);
} else {
    injectScript();
}

// API for popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getVideoInfo') {
        getVideoInfo().then(sendResponse);
        return true;
    }
});

const headers = () => ({
    'Authorization': authToken,
    'OAI-Device-Id': deviceId,
    'OAI-Language': 'en-US'
});

// Parse generation and save to cache
function cacheGeneration(item, gen) {
    const source = gen.encodings?.source;
    if (!source?.path) return;
    
    genCache.set(gen.id, {
        videoUrl: source.path,
        prompt: item.payload?.prompt || 'sora_video',
        width: source.width,
        height: source.height,
        size: source.size,
        duration: source.duration_secs,
        thumbnail: gen.encodings?.thumbnail?.path
    });
}

// Fetch notif page
async function fetchNotifPage(cursor = null, limit = 100, direction = 'after') {
    let url = `https://sora.chatgpt.com/backend/notif?limit=${limit}`;
    if (cursor) url += `&${direction}=${cursor}`;
    
    const response = await fetch(url, { headers: headers() });
    if (response.status === 401) throw new Error('TOKEN_EXPIRED');
    if (!response.ok) throw new Error(`Notif API HTTP ${response.status}`);
    
    return response.json();
}

// Process batch and cache, return first id
function processBatch(data) {
    let firstId = null;
    for (const item of data.data || []) {
        for (const gen of item.payload?.generations || []) {
            if (!firstId) firstId = gen.id;
            cacheGeneration(item, gen);
        }
    }
    return firstId;
}

// Load old history (one batch)
async function loadOldBatch() {
    const data = await fetchNotifPage(oldestCursor, 100, 'after');
    const firstId = processBatch(data);
    
    // Remember newest id if this is first batch
    if (!newestCachedId && firstId) {
        newestCachedId = firstId;
    }
    
    oldestCursor = data.last_id;
    historyFullyLoaded = !data.has_more;
}

// Load fresh until we catch up with cache
async function loadFreshUntilCached() {
    let cursor = null;
    let limit = 10;
    
    while (true) {
        const data = await fetchNotifPage(cursor, limit, 'before');
        let caughtUp = false;
        
        for (const item of data.data || []) {
            for (const gen of item.payload?.generations || []) {
                // If we reached already cached - caught up
                if (newestCachedId && gen.id === newestCachedId) {
                    caughtUp = true;
                }
                cacheGeneration(item, gen);
            }
        }
        
        // Update newestCachedId to the freshest
        const firstId = data.data?.[0]?.payload?.generations?.[0]?.id;
        if (firstId && !cursor) {
            newestCachedId = firstId;
        }
        
        // Stop if: caught up OR history ended
        if (caughtUp || !data.has_more) break;
        
        cursor = data.last_id;
        limit = 100;
    }
}

async function getVideoInfo() {
    if (!authToken || !deviceId) {
        return {success: false, error: 'TOKEN_MISSING'};
    }
    
    const path = window.location.pathname;
    let generationId = null;
    let postId = null;
    
    // Draft /d/gen_* - generationId directly in URL
    const draftMatch = path.match(/\/d\/(gen_[^/?]+)/);
    if (draftMatch) {
        generationId = draftMatch[1];
    }
    
    // Post /p/* - need API request
    const postMatch = path.match(/\/p\/([^/?]+)/);
    if (postMatch) {
        postId = postMatch[1];
    }
    
    if (!generationId && !postId) {
        return {success: false, error: 'Open a video page (/p/... or /d/...)'};
    }
    
    try {
        // If postId - get generationId
        if (postId && !generationId) {
            generationId = postCache.get(postId);
            
            if (!generationId) {
                const postResponse = await fetch(`https://sora.chatgpt.com/backend/project_y/post/${postId}`, {
                    headers: headers()
                });
                
                if (postResponse.status === 401) {
                    return {success: false, error: 'TOKEN_EXPIRED'};
                }
                if (!postResponse.ok) {
                    return {success: false, error: `Post API HTTP ${postResponse.status}`};
                }
                
                const postData = await postResponse.json();
                
                // Check owner
                if (!postData.post?.is_owner) {
                    return {success: false, error: 'NOT_OWNER'};
                }
                
                generationId = postData.post?.attachments?.[0]?.generation_id;
                
                if (!generationId) {
                    return {success: false, error: 'Generation ID not found'};
                }
                
                postCache.set(postId, generationId);
            }
        }
        
        // 1. Check cache
        if (genCache.has(generationId)) {
            return { success: true, generationId, ...genCache.get(generationId) };
        }
        
        // 2. If history not fully loaded - load old
        while (!genCache.has(generationId) && !historyFullyLoaded) {
            await loadOldBatch();
        }
        
        if (genCache.has(generationId)) {
            return { success: true, generationId, ...genCache.get(generationId) };
        }
        
        // 3. History loaded but not found - load fresh
        await loadFreshUntilCached();
        
        if (genCache.has(generationId)) {
            return { success: true, generationId, ...genCache.get(generationId) };
        }
        
        return {success: false, error: 'Generation not found in history'};
        
    } catch (error) {
        if (error.message === 'TOKEN_EXPIRED') {
            return {success: false, error: 'TOKEN_EXPIRED'};
        }
        return {success: false, error: error.message};
    }
}
