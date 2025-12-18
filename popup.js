document.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loaderText');
    const errorDiv = document.getElementById('error');
    const resultDiv = document.getElementById('result');
    const thumbWrap = document.getElementById('thumbWrap');
    const thumb = document.getElementById('thumb');
    const promptDiv = document.getElementById('prompt');
    const metaDiv = document.getElementById('meta');
    const downloadBtn = document.getElementById('downloadBtn');
    
    let videoData = null;
    
    const setBtn = (icon, text) => {
        downloadBtn.innerHTML = `${icons[icon]}<span>${text}</span>`;
    };
    
    const showError = (msg, linkUrl, linkText) => {
        loader.style.display = 'none';
        errorDiv.style.display = 'flex';
        if (linkUrl) {
            errorDiv.innerHTML = `<span>${msg}</span><a href="${linkUrl}" target="_blank" class="error-link">${icons.arrow}${linkText}</a>`;
        } else {
            errorDiv.textContent = msg;
        }
    };
    
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    if (!tab.url.includes('sora.chatgpt.com')) {
        showError(i18n.openSora, 'https://sora.chatgpt.com/profile', i18n.openSoraLink);
        return;
    }
    
    const postId = tab.url.match(/\/p\/([^/?]+)/)?.[1];
    const draftId = tab.url.match(/\/d\/(gen_[^/?]+)/)?.[1];
    if (!postId && !draftId) {
        showError(i18n.openVideoPage, 'https://sora.chatgpt.com/profile', i18n.openVideoPageHint);
        return;
    }
    
    loaderText.textContent = i18n.loadingData;
    
    // Show hint if loading takes too long
    const slowTimer = setTimeout(() => {
        loaderText.textContent = i18n.slowLoading;
    }, 10000);
    
    chrome.tabs.sendMessage(tab.id, {action: 'getVideoInfo'}, (response) => {
        clearTimeout(slowTimer);
        if (chrome.runtime.lastError) {
            showError(i18n.refreshAndRetry);
            return;
        }
        
        if (!response?.success) {
            const err = response?.error;
            if (err === 'NOT_OWNER') {
                showError(i18n.notOwner, 'https://sora.chatgpt.com/profile', i18n.openProfile);
            } else if (err === 'TOKEN_MISSING' || err === 'TOKEN_EXPIRED') {
                showError(i18n.refreshAndRetry);
            } else {
                showError(err || i18n.videoNotFound);
            }
            return;
        }
        
        videoData = response;
        
        loader.style.display = 'none';
        resultDiv.style.display = 'flex';
        
        const contentHeight = 224 - 54 - 28;
        const thumbWidth = Math.round(contentHeight * response.width / response.height);
        thumbWrap.style.width = thumbWidth + 'px';
        
        if (response.thumbnail) {
            thumb.src = response.thumbnail;
        } else {
            thumbWrap.style.display = 'none';
        }
        
        const shortPrompt = response.prompt.length > 60 ? response.prompt.slice(0, 60) + '...' : response.prompt;
        promptDiv.textContent = shortPrompt;
        
        const sizeMB = response.size ? (response.size / 1024 / 1024).toFixed(1) + ' MB' : '';
        const duration = response.duration ? response.duration + 's' : '';
        const meta = [`${response.width}×${response.height}`, sizeMB, duration].filter(Boolean);
        metaDiv.innerHTML = meta.map(m => `<span class="meta-tag">${m}</span>`).join('');
    });
    
    downloadBtn.addEventListener('click', () => {
        if (!videoData) return;
        
        const safeName = videoData.prompt
            .slice(0, 40)
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, '_')
            .trim() || 'sora_video';
        
        downloadBtn.disabled = true;
        setBtn('spinner', i18n.downloading);
        
        chrome.downloads.download({
            url: videoData.videoUrl,
            filename: `${safeName}.mp4`
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                setBtn('cross', i18n.error);
            } else {
                setBtn('check', i18n.done);
            }
            setTimeout(() => {
                downloadBtn.disabled = false;
                setBtn('download', i18n.downloadOriginal);
            }, 1500);
        });
    });
});
