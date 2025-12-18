// Intercept auth token and device ID from requests
(function() {
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const [url, options] = args;
        
        if (options?.headers) {
            Object.keys(options.headers).forEach(key => {
                const lowerKey = key.toLowerCase();
                if (lowerKey.includes('auth')) {
                    window.postMessage({ type: 'SORA_AUTH', token: options.headers[key] }, '*');
                }
                if (lowerKey === 'oai-device-id') {
                    window.postMessage({ type: 'SORA_DEVICE_ID', deviceId: options.headers[key] }, '*');
                }
            });
        }
        
        return originalFetch.apply(this, args);
    };
    
    const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('auth')) {
            window.postMessage({ type: 'SORA_AUTH', token: value }, '*');
        }
        if (lowerName === 'oai-device-id') {
            window.postMessage({ type: 'SORA_DEVICE_ID', deviceId: value }, '*');
        }
        return originalXHRSetRequestHeader.call(this, name, value);
    };
})();
