/**
 * BTechBook.in - Google Ad Manager (GAM) Web Rewarded Video Ads System
 * Compliant with Google Publisher Policies & Google Publisher Tag (GPT) specifications.
 */

(function () {
    // ==========================================
    // 1. CONFIGURATION
    // ==========================================
    const GAM_CONFIG = {
        // Replace with your GAM Network ID and Rewarded Ad Unit Code
        // Format: '/<NETWORK_CODE>/<AD_UNIT_NAME>'
        // Example: '/12345678/btechbook_download_rewarded'
        adUnitPath: '/22639388115/btechbook_web_rewarded',

        // Fallback wait time in seconds if ad is unavailable, blocked, or pending GAM approval
        fallbackCountdownSeconds: 5,

        // Debug logging in browser console
        debug: true
    };

    function log(...args) {
        if (GAM_CONFIG.debug) {
            console.log('[GAM-Rewarded]', ...args);
        }
    }

    // State tracking
    let gptLoaded = false;
    let rewardedSlot = null;
    let isAdReady = false;
    let makeRewardedVisibleFn = null;
    let pendingDownload = null; // { url, fileName, isDownload, buttonEl }

    // ==========================================
    // 2. LOAD GOOGLE PUBLISHER TAG (GPT)
    // ==========================================
    function initGPT() {
        window.googletag = window.googletag || { cmd: [] };

        // Ensure GPT script is loaded
        if (!document.querySelector('script[src*="securepubads.g.doubleclick.net/tag/js/gpt.js"]')) {
            const gptScript = document.createElement('script');
            gptScript.async = true;
            gptScript.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';
            gptScript.onerror = function () {
                log('GPT script failed to load (possibly ad blocker). Fallback mode enabled.');
                gptLoaded = false;
            };
            gptScript.onload = function () {
                log('GPT script loaded successfully.');
                gptLoaded = true;
            };
            document.head.appendChild(gptScript);
        }

        // Register rewarded ad slot
        window.googletag.cmd.push(function () {
            try {
                rewardedSlot = window.googletag.defineOutOfPageSlot(
                    GAM_CONFIG.adUnitPath,
                    window.googletag.enums.OutOfPageFormat.REWARDED
                );

                if (rewardedSlot) {
                    rewardedSlot.addService(window.googletag.pubads());
                    log('Rewarded slot defined for path:', GAM_CONFIG.adUnitPath);

                    // 1. Ad Ready Event
                    window.googletag.pubads().addEventListener('rewardedSlotReady', function (event) {
                        log('Rewarded slot ready to display.');
                        isAdReady = true;
                        makeRewardedVisibleFn = function () {
                            event.makeRewardedVisible();
                        };
                    });

                    // 2. Reward Granted Event (User completed watching the video ad)
                    window.googletag.pubads().addEventListener('rewardedSlotGranted', function (event) {
                        log('Rewarded slot granted! Delivering download payload.');
                        executePendingDownload();
                    });

                    // 3. Ad Closed Event
                    window.googletag.pubads().addEventListener('rewardedSlotClosed', function (event) {
                        log('Rewarded slot closed by user.');
                        if (rewardedSlot) {
                            window.googletag.destroySlots([rewardedSlot]);
                            rewardedSlot = null;
                        }
                        // Re-request slot for next download
                        initGPT();
                    });

                    window.googletag.enableServices();
                    window.googletag.display(rewardedSlot);
                }
            } catch (err) {
                log('Error initializing GPT rewarded slot:', err);
            }
        });
    }

    // ==========================================
    // 3. OPT-IN UI MODAL (GOOGLE POLICY COMPLIANT)
    // ==========================================
    function injectModalUI() {
        if (document.getElementById('gamRewardedModal')) return;

        const modalHTML = `
        <div id="gamRewardedModal" style="display:none; position:fixed; inset:0; z-index:99999; background:rgba(15,23,42,0.65); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); justify-content:center; align-items:center; padding:20px; font-family:'Open Sans',-apple-system,BlinkMacSystemFont,sans-serif;">
            <div style="background:#ffffff; border-radius:18px; max-width:440px; width:100%; padding:32px 26px; text-align:center; box-shadow:0 20px 40px -10px rgba(0,0,0,0.25); position:relative; animation:gamModalIn 0.3s cubic-bezier(0.16,1,0.3,1);">
                <button id="gamModalClose" style="position:absolute; top:12px; right:16px; background:none; border:none; font-size:1.6rem; cursor:pointer; color:#94a3b8; line-height:1;" aria-label="Close">&times;</button>
                
                <div style="width:60px; height:60px; background:#eff6ff; border-radius:16px; display:inline-flex; align-items:center; justify-content:center; margin-bottom:16px; color:#2563eb; font-size:1.8rem;">
                    <i class="fas fa-file-pdf"></i>
                </div>
                
                <h3 id="gamModalDocTitle" style="font-size:1.35rem; color:#0f172a; margin:0 0 10px; font-weight:700;">Ready to Download Notes</h3>
                <p id="gamModalMsg" style="font-size:0.95rem; color:#64748b; line-height:1.6; margin:0 0 22px;">
                    Watch a short sponsor video to keep <strong>BTechBook</strong> 100% free for students and unlock your direct download!
                </p>

                <!-- Action Button: Watch Ad -->
                <button id="gamWatchAdBtn" style="display:block; width:100%; padding:14px 20px; background:#2563eb; color:#ffffff; font-weight:700; font-size:1rem; border-radius:10px; border:none; cursor:pointer; margin-bottom:10px; transition:background 0.2s; box-shadow:0 4px 12px rgba(37,99,235,0.25);">
                    <i class="fas fa-play-circle" style="margin-right:8px;"></i> Watch Short Video to Download
                </button>

                <!-- Secondary Action: Fallback / Wait 5 Seconds -->
                <button id="gamSkipBtn" style="display:block; width:100%; padding:11px 18px; background:#f1f5f9; color:#475569; font-weight:600; font-size:0.9rem; border-radius:10px; border:none; cursor:pointer; transition:background 0.2s;">
                    Wait <span id="gamCountdownTimer">5</span>s for Direct Link
                </button>

                <!-- Countdown Progress Bar -->
                <div id="gamProgressWrap" style="display:none; width:100%; height:6px; background:#e2e8f0; border-radius:4px; margin-top:16px; overflow:hidden;">
                    <div id="gamProgressBar" style="width:0%; height:100%; background:#2563eb; transition:width 1s linear;"></div>
                </div>
            </div>
        </div>
        <style>
            @keyframes gamModalIn {
                from { opacity:0; transform:translateY(24px) scale(0.96); }
                to   { opacity:1; transform:translateY(0) scale(1); }
            }
        </style>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Bind modal event listeners
        document.getElementById('gamModalClose').onclick = closeRewardedModal;
        document.getElementById('gamWatchAdBtn').onclick = onWatchAdClicked;
        document.getElementById('gamSkipBtn').onclick = startCountdownFallback;

        // Click outside closes
        document.getElementById('gamRewardedModal').onclick = function (e) {
            if (e.target === this) {
                closeRewardedModal();
            }
        };
    }

    function openRewardedModal(docTitle) {
        injectModalUI();
        const modal = document.getElementById('gamRewardedModal');
        const titleEl = document.getElementById('gamModalDocTitle');
        const watchBtn = document.getElementById('gamWatchAdBtn');
        const skipBtn = document.getElementById('gamSkipBtn');
        const progressWrap = document.getElementById('gamProgressWrap');
        const countdownTimer = document.getElementById('gamCountdownTimer');

        if (docTitle) {
            titleEl.textContent = 'Download ' + docTitle;
        }

        // Reset states
        progressWrap.style.display = 'none';
        skipBtn.disabled = false;
        countdownTimer.textContent = GAM_CONFIG.fallbackCountdownSeconds;

        if (isAdReady && makeRewardedVisibleFn) {
            watchBtn.style.display = 'block';
            watchBtn.innerHTML = '<i class="fas fa-play-circle" style="margin-right:8px;"></i> Watch Short Video to Download';
        } else {
            // Ad not ready or still loading - present countdown mode
            watchBtn.style.display = 'none';
            startCountdownFallback();
        }

        modal.style.display = 'flex';
    }

    function closeRewardedModal() {
        const modal = document.getElementById('gamRewardedModal');
        if (modal) modal.style.display = 'none';
    }

    function onWatchAdClicked() {
        if (isAdReady && typeof makeRewardedVisibleFn === 'function') {
            log('Displaying GAM rewarded video ad to user.');
            closeRewardedModal();
            try {
                makeRewardedVisibleFn();
            } catch (err) {
                log('Error making rewarded visible, falling back:', err);
                startCountdownFallback();
            }
        } else {
            log('Ad not ready yet, falling back to countdown.');
            startCountdownFallback();
        }
    }

    let countdownInterval = null;
    function startCountdownFallback() {
        const skipBtn = document.getElementById('gamSkipBtn');
        const watchBtn = document.getElementById('gamWatchAdBtn');
        const progressWrap = document.getElementById('gamProgressWrap');
        const progressBar = document.getElementById('gamProgressBar');
        const countdownTimer = document.getElementById('gamCountdownTimer');

        watchBtn.style.display = 'none';
        progressWrap.style.display = 'block';
        skipBtn.disabled = true;

        let secondsRemaining = GAM_CONFIG.fallbackCountdownSeconds;
        countdownTimer.textContent = secondsRemaining;
        progressBar.style.width = '0%';

        if (countdownInterval) clearInterval(countdownInterval);

        countdownInterval = setInterval(function () {
            secondsRemaining--;
            countdownTimer.textContent = secondsRemaining;
            const percent = ((GAM_CONFIG.fallbackCountdownSeconds - secondsRemaining) / GAM_CONFIG.fallbackCountdownSeconds) * 100;
            progressBar.style.width = percent + '%';

            if (secondsRemaining <= 0) {
                clearInterval(countdownInterval);
                closeRewardedModal();
                executePendingDownload();
            }
        }, 1000);
    }

    // ==========================================
    // 4. DOWNLOAD EXECUTION & DISPATCH
    // ==========================================
    function executePendingDownload() {
        if (!pendingDownload) return;

        const { url, fileName, isDownload, buttonEl } = pendingDownload;
        log('Executing download for:', fileName, 'URL:', url);

        // Check if running inside Android WebView with JavascriptInterface
        if (typeof BTechBook !== 'undefined' && BTechBook.downloadPdf) {
            log('Android App detected: invoking BTechBook.downloadPdf');
            const statusId = buttonEl ? buttonEl.dataset.statusId : null;
            BTechBook.downloadPdf(url, fileName, statusId);
            pendingDownload = null;
            return;
        }

        // Web Browser download trigger
        if (isDownload || url.endsWith('.pdf')) {
            const tempLink = document.createElement('a');
            tempLink.href = url;
            tempLink.download = fileName || url.substring(url.lastIndexOf('/') + 1) || 'BTechBook_Document.pdf';
            tempLink.target = '_blank';
            document.body.appendChild(tempLink);
            tempLink.click();
            document.body.removeChild(tempLink);
        } else {
            window.location.href = url;
        }

        pendingDownload = null;
    }

    // ==========================================
    // 5. PUBLIC API & AUTOMATIC INTERCEPTION
    // ==========================================
    window.triggerRewardedDownload = function (url, fileName, buttonEl) {
        pendingDownload = {
            url: url,
            fileName: fileName || 'BTechBook_Notes.pdf',
            isDownload: true,
            buttonEl: buttonEl || null
        };

        openRewardedModal(fileName);
    };

    function bootstrap() {
        initGPT();
        injectModalUI();

        // Attach listeners to all download triggers
        document.body.addEventListener('click', function (e) {
            const btn = e.target.closest('.btn-download, [data-pdf-url], a[download]');
            if (!btn) return;

            // Allow normal click if already marked as downloaded/open
            if (btn.classList && btn.classList.contains('btn-open')) {
                return;
            }

            const url = btn.dataset.pdfUrl || btn.getAttribute('href');
            if (!url || url === '#' || url.startsWith('javascript:')) return;

            e.preventDefault();
            e.stopPropagation();

            const fileName = btn.dataset.pdfName || btn.getAttribute('download') || 'Engineering_Notes.pdf';
            window.triggerRewardedDownload(url, fileName, btn);
        }, true); // Use capture phase so it precedes legacy handlers
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }

})();
