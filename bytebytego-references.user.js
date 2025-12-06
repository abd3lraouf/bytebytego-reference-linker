// ==UserScript==
// @name         ByteByteGo Reference Linker
// @namespace    https://github.com/abd3lraouf
// @version      1.7.3
// @description  Converts [n] reference markers into clickable links on ByteByteGo courses. Click the reference to open the URL, or click the arrow to scroll to the References section.
// @author       abd3lraouf
// @license      MIT
// @match        https://bytebytego.com/*
// @match        https://*.bytebytego.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bytebytego.com
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @connect      *
// @run-at       document-idle
// @homepage     https://github.com/abd3lraouf/bytebytego-reference-linker
// @supportURL   https://github.com/abd3lraouf/bytebytego-reference-linker/issues
// @updateURL    https://raw.githubusercontent.com/abd3lraouf/bytebytego-reference-linker/main/bytebytego-references.user.js
// @downloadURL  https://raw.githubusercontent.com/abd3lraouf/bytebytego-reference-linker/main/bytebytego-references.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Store parsed references
    const references = new Map();
    // Store reference link elements in article for up-arrow navigation
    const referenceLinkLocations = new Map();

    // Script version for update notifications
    const SCRIPT_VERSION = '1.7.3';
    const VERSION_KEY = 'bytebytego-refs-version';
    const LAST_UPDATE_CHECK_KEY = 'bytebytego-refs-last-update-check';
    const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const SCRIPT_UPDATE_URL = 'https://raw.githubusercontent.com/abd3lraouf/bytebytego-reference-linker/main/bytebytego-references.user.js';
    const CHANGELOG_URL = 'https://raw.githubusercontent.com/abd3lraouf/bytebytego-reference-linker/main/changelog.json';

    // Hover card state
    let hoverCard = null;
    let hoverTimeout = null;
    let hideTimeout = null;
    let currentHoveredLink = null;
    let isHoveringCard = false;

    const CLASS_REF_WRAPPER = 'bbg-ref-wrapper';
    const CLASS_UP_ARROW = 'bbg-ref-up-arrow';
    const WRAPPER_PROCESSED_ATTR = 'data-bbg-ref-processed';

    const debouncedProcessPage = debounce(processPage, 400);

    function debounce(fn, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn(...args), delay);
        };
    }

    function clearUpArrows() {
        document.querySelectorAll(`.${CLASS_UP_ARROW}`).forEach(el => el.remove());
    }

    function scrollToRefLink(num, allowRetry = true) {
        const refLinkWrapper = document.querySelector(`[data-ref-link="${num}"]`);
        if (refLinkWrapper) {
            refLinkWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });

            const link = refLinkWrapper.querySelector('.ref-link');
            if (link) {
                const originalBg = link.style.backgroundColor;
                link.style.backgroundColor = 'rgba(99, 102, 241, 0.2)';
                link.style.transition = 'background-color 0.3s';
                setTimeout(() => {
                    link.style.backgroundColor = originalBg;
                }, 1500);
            }
            return true;
        }

        if (allowRetry) {
            processPage();
            setTimeout(() => scrollToRefLink(num, false), 150);
        } else {
            console.warn(`[ByteByteGo Refs] Could not find reference [${num}] in article after retry`);
        }
        return false;
    }

    function findNextHeaderAfter(element) {
        let sibling = element.nextElementSibling;
        while (sibling) {
            if (sibling.tagName && sibling.tagName.match(/^H[1-6]$/)) {
                return sibling;
            }
            sibling = sibling.nextElementSibling;
        }
        return null;
    }

    function isAfter(target, marker) {
        return !!(marker.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING);
    }

    function isBefore(target, marker) {
        return !!(target.compareDocumentPosition(marker) & Node.DOCUMENT_POSITION_FOLLOWING);
    }

    // Inject styles for hover card
    function injectStyles() {
        if (document.getElementById('bytebytego-ref-styles')) return;

        const style = document.createElement('style');
        style.id = 'bytebytego-ref-styles';
        style.textContent = `
            .ref-hover-card {
                position: fixed;
                z-index: 10000;
                background: #ffffff;
                border: 1px solid #e1e4e8;
                border-radius: 8px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
                overflow: hidden;
                max-width: 400px;
                opacity: 0;
                visibility: hidden;
                transform: translateY(4px);
                transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s;
                pointer-events: none;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            }

            .ref-hover-card.visible {
                opacity: 1;
                visibility: visible;
                transform: translateY(0);
                pointer-events: auto;
            }

            .ref-hover-card.above {
                transform: translateY(-4px);
            }

            .ref-hover-card.above.visible {
                transform: translateY(0);
            }

            /* Card with image */
            .ref-card-image-container {
                position: relative;
                width: 100%;
                height: 200px;
                background: #f6f8fa;
                border-bottom: 1px solid #e1e4e8;
                display: none;
            }

            .ref-card-image-container.has-image {
                display: block;
            }

            .ref-card-image {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            }

            .ref-card-badge {
                position: absolute;
                top: 8px;
                right: 8px;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(4px);
                color: white;
                font-size: 10px;
                font-weight: 600;
                padding: 3px 8px;
                border-radius: 4px;
            }

            .ref-card-content {
                padding: 12px;
            }

            .ref-hover-card.has-image .ref-card-content {
                padding: 10px 12px 12px;
            }

            .ref-card-header {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                margin-bottom: 8px;
            }

            .ref-card-icon {
                width: 32px;
                height: 32px;
                border-radius: 6px;
                flex-shrink: 0;
                object-fit: cover;
                background: #f6f8fa;
            }

            .ref-card-header-text {
                flex: 1;
                min-width: 0;
            }

            .ref-card-domain {
                font-size: 11px;
                font-weight: 500;
                color: #6b7280;
                margin-bottom: 2px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .ref-card-badge-inline {
                display: inline-block;
                background: #6366f1;
                color: white;
                font-size: 9px;
                font-weight: 600;
                padding: 2px 6px;
                border-radius: 3px;
                margin-left: 6px;
                vertical-align: middle;
            }

            .ref-card-title {
                font-size: 13px;
                font-weight: 600;
                color: #1f2937;
                line-height: 1.4;
                margin-bottom: 6px;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            .ref-card-url {
                font-size: 11px;
                font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace;
                color: #6366f1;
                background: #f6f8fa;
                padding: 6px 8px;
                border-radius: 4px;
                margin-bottom: 10px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .ref-card-actions {
                display: flex;
                gap: 6px;
            }

            .ref-card-btn {
                flex: 1;
                padding: 7px 12px;
                border-radius: 5px;
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.12s ease;
                text-align: center;
                text-decoration: none;
                border: none;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
            }

            .ref-card-btn-primary {
                background: #6366f1;
                color: white;
            }

            .ref-card-btn-primary:hover {
                background: #4f46e5;
            }

            .ref-card-btn-secondary {
                background: #f3f4f6;
                color: #4b5563;
                border: 1px solid #e5e7eb;
            }

            .ref-card-btn-secondary:hover {
                background: #e5e7eb;
            }

            /* Dark mode */
            @media (prefers-color-scheme: dark) {
                .ref-hover-card {
                    background: #1f2937;
                    border-color: #374151;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
                }

                .ref-card-image-container {
                    background: #111827;
                    border-bottom-color: #374151;
                }

                .ref-card-icon {
                    background: #111827;
                }

                .ref-card-domain {
                    color: #9ca3af;
                }

                .ref-card-title {
                    color: #f9fafb;
                }

                .ref-card-url {
                    background: #374151;
                    color: #818cf8;
                }

                .ref-card-btn-secondary {
                    background: #374151;
                    color: #d1d5db;
                    border-color: #4b5563;
                }

                .ref-card-btn-secondary:hover {
                    background: #4b5563;
                }
            }

            /* Update notification toast */
            .bytebytego-update-toast {
                position: fixed;
                bottom: 24px;
                right: 24px;
                z-index: 100000;
                background: #ffffff;
                border: 1px solid #e1e4e8;
                border-radius: 8px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                padding: 16px 20px;
                max-width: 420px;
                opacity: 0;
                transform: translateY(20px);
                transition: opacity 0.3s ease, transform 0.3s ease;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .bytebytego-update-toast.show {
                opacity: 1;
                transform: translateY(0);
            }

            .update-toast-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 12px;
            }

            .update-toast-title {
                font-size: 14px;
                font-weight: 600;
                color: #1f2937;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .update-toast-badge {
                background: #10b981;
                color: white;
                font-size: 10px;
                font-weight: 600;
                padding: 3px 8px;
                border-radius: 4px;
            }

            .update-toast-close {
                background: none;
                border: none;
                color: #6b7280;
                cursor: pointer;
                font-size: 20px;
                line-height: 1;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                transition: background 0.15s;
            }

            .update-toast-close:hover {
                background: #f3f4f6;
            }

            .update-toast-content {
                font-size: 12px;
                color: #4b5563;
                line-height: 1.6;
            }

            .update-toast-content ul {
                margin: 8px 0;
                padding-left: 20px;
            }

            .update-toast-content li {
                margin: 4px 0;
            }

            .update-toast-actions {
                display: flex;
                gap: 8px;
                margin-top: 12px;
            }

            .update-toast-btn {
                flex: 1;
                border: none;
                padding: 9px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.15s, color 0.15s, box-shadow 0.15s;
            }

            .update-toast-btn.primary {
                background: #10b981;
                color: #ffffff;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08), 0 1px 8px rgba(16, 185, 129, 0.3);
            }

            .update-toast-btn.primary:hover {
                background: #0ea371;
            }

            .update-toast-btn.secondary {
                background: #f3f4f6;
                color: #374151;
                border: 1px solid #e5e7eb;
            }

            .update-toast-btn.secondary:hover {
                background: #e5e7eb;
            }

            .update-toast-footer {
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid #e5e7eb;
                font-size: 11px;
                color: #6b7280;
            }

            @media (prefers-color-scheme: dark) {
                .bytebytego-update-toast {
                    background: #1f2937;
                    border-color: #374151;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
                }

                .update-toast-title {
                    color: #f9fafb;
                }

                .update-toast-close {
                    color: #9ca3af;
                }

                .update-toast-close:hover {
                    background: #374151;
                }

                .update-toast-content {
                    color: #d1d5db;
                }

                .update-toast-btn.secondary {
                    background: #374151;
                    border-color: #4b5563;
                    color: #e5e7eb;
                }

                .update-toast-btn.secondary:hover {
                    background: #4b5563;
                }

                .update-toast-footer {
                    border-top-color: #374151;
                    color: #9ca3af;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Fetch OG image from URL
    async function fetchOGImage(url) {
        try {
            // Check if GM_xmlhttpRequest is available
            if (typeof GM_xmlhttpRequest === 'undefined') {
                return null;
            }

            return new Promise((resolve) => {
                // Set timeout to avoid hanging
                const timeout = setTimeout(() => resolve(null), 3000);

                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    timeout: 3000,
                    onload: (response) => {
                        clearTimeout(timeout);
                        const html = response.responseText;

                        // Try to find og:image meta tag
                        const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                                           html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);

                        if (ogImageMatch && ogImageMatch[1]) {
                            const imageUrl = ogImageMatch[1];
                            // Make sure it's a full URL
                            if (imageUrl.startsWith('http')) {
                                resolve(imageUrl);
                            } else if (imageUrl.startsWith('//')) {
                                resolve('https:' + imageUrl);
                            } else {
                                const urlObj = new URL(url);
                                resolve(urlObj.origin + (imageUrl.startsWith('/') ? '' : '/') + imageUrl);
                            }
                        } else {
                            resolve(null);
                        }
                    },
                    onerror: () => {
                        clearTimeout(timeout);
                        resolve(null);
                    },
                    ontimeout: () => {
                        clearTimeout(timeout);
                        resolve(null);
                    }
                });
            });
        } catch (error) {
            return null;
        }
    }

    // Get better quality icon
    function getIconUrl(url) {
        try {
            const urlObj = new URL(url);
            // Use icon.horse for better quality icons
            return `https://icon.horse/icon/${urlObj.hostname}`;
        } catch {
            return '';
        }
    }

    // Create hover card element
    function createHoverCard() {
        if (hoverCard) return hoverCard;

        hoverCard = document.createElement('div');
        hoverCard.className = 'ref-hover-card';
        hoverCard.innerHTML = `
            <div class="ref-card-image-container">
                <img class="ref-card-image" src="" alt="" />
                <span class="ref-card-badge"></span>
            </div>
            <div class="ref-card-content">
                <div class="ref-card-header">
                    <img class="ref-card-icon" src="" alt="" />
                    <div class="ref-card-header-text">
                        <div class="ref-card-domain">
                            <span class="ref-card-domain-text"></span>
                            <span class="ref-card-badge-inline"></span>
                        </div>
                        <div class="ref-card-title"></div>
                    </div>
                </div>
                <div class="ref-card-url"></div>
                <div class="ref-card-actions">
                    <a class="ref-card-btn ref-card-btn-primary" target="_blank" rel="noopener noreferrer">
                        <span>Open</span>
                        <span>↗</span>
                    </a>
                    <button class="ref-card-btn ref-card-btn-secondary ref-card-scroll-btn">
                        <span>Scroll</span>
                        <span>↓</span>
                    </button>
                </div>
            </div>
        `;

        // Keep card visible when hovering over it
        hoverCard.addEventListener('mouseenter', () => {
            isHoveringCard = true;
            clearTimeout(hideTimeout);
        });

        hoverCard.addEventListener('mouseleave', () => {
            isHoveringCard = false;
            hideHoverCard();
        });

        document.body.appendChild(hoverCard);
        return hoverCard;
    }

    // Extract domain from URL
    function extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace('www.', '');
        } catch {
            return url;
        }
    }

    // Get favicon URL for domain
    function getFaviconUrl(url) {
        try {
            const urlObj = new URL(url);
            return `https://www.google.com/s2/favicons?sz=32&domain=${urlObj.hostname}`;
        } catch {
            return '';
        }
    }

    // Show hover card for a reference
    async function showHoverCard(refNum, anchorElement) {
        const ref = references.get(refNum);
        if (!ref || !ref.url) return;

        clearTimeout(hideTimeout);

        const card = createHoverCard();
        const domain = extractDomain(ref.url);
        const iconUrl = getIconUrl(ref.url);

        // Update card content immediately (without image)
        card.querySelector('.ref-card-badge').textContent = `[${refNum}]`;
        card.querySelector('.ref-card-badge-inline').textContent = `[${refNum}]`;
        card.querySelector('.ref-card-icon').src = iconUrl;
        card.querySelector('.ref-card-domain-text').textContent = domain;
        card.querySelector('.ref-card-title').textContent = ref.description || `Reference ${refNum}`;
        card.querySelector('.ref-card-url').textContent = ref.url;
        card.querySelector('.ref-card-btn-primary').href = ref.url;

        // Remove has-image class initially
        card.classList.remove('has-image');
        card.querySelector('.ref-card-image-container').classList.remove('has-image');

        // Setup scroll button
        const scrollBtn = card.querySelector('.ref-card-scroll-btn');
        scrollBtn.onclick = () => {
            hideHoverCard(true);
            if (ref.element) {
                ref.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const originalBg = ref.element.style.backgroundColor;
                ref.element.style.backgroundColor = '#fef08a';
                ref.element.style.transition = 'background-color 0.3s';
                setTimeout(() => {
                    ref.element.style.backgroundColor = originalBg;
                }, 2000);
            }
        };

        // Position the card
        const rect = anchorElement.getBoundingClientRect();
        const cardHeight = 240; // Approximate height
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        card.classList.remove('above');

        let top, left;

        // Determine vertical position
        if (spaceBelow >= cardHeight || spaceBelow >= spaceAbove) {
            // Position below
            top = rect.bottom + 8;
        } else {
            // Position above
            top = rect.top - cardHeight - 8;
            card.classList.add('above');
        }

        // Determine horizontal position
        left = rect.left;

        // Ensure card doesn't go off-screen horizontally
        const cardWidth = 400;
        if (left + cardWidth > window.innerWidth - 16) {
            left = window.innerWidth - cardWidth - 16;
        }
        if (left < 16) {
            left = 16;
        }

        card.style.top = `${top}px`;
        card.style.left = `${left}px`;

        // Show with animation
        requestAnimationFrame(() => {
            card.classList.add('visible');
        });

        // Try to fetch OG image asynchronously (don't wait for it)
        fetchOGImage(ref.url).then(ogImageUrl => {
            if (ogImageUrl && card.classList.contains('visible')) {
                const imgElement = card.querySelector('.ref-card-image');
                const imgContainer = card.querySelector('.ref-card-image-container');

                // Preload image to check if it loads successfully
                const img = new Image();
                img.onload = () => {
                    if (card.classList.contains('visible')) {
                        imgElement.src = ogImageUrl;
                        imgContainer.classList.add('has-image');
                        card.classList.add('has-image');
                    }
                };
                img.onerror = () => {
                    // Image failed to load, keep compact version
                };
                img.src = ogImageUrl;
            }
        }).catch(() => {
            // Failed to fetch OG image, keep compact version
        });
    }

    // Hide hover card
    function hideHoverCard(immediate = false) {
        if (!hoverCard) return;

        if (immediate) {
            hoverCard.classList.remove('visible');
            currentHoveredLink = null;
            return;
        }

        // Delay hiding to allow mouse movement to card
        hideTimeout = setTimeout(() => {
            // Only hide if not hovering over card or link
            if (!isHoveringCard && !currentHoveredLink) {
                hoverCard.classList.remove('visible');
            }
        }, 200);
    }

    // Wrap each reference line in Resources section with a span for precise highlighting
    function wrapReferencesWithSpans() {
        const resourcesHeader = getResourcesHeader();
        if (!resourcesHeader) return;

        let sibling = resourcesHeader.nextElementSibling;
        while (sibling) {
            // Stop if we hit another header
            if (sibling.tagName && sibling.tagName.match(/^H[1-6]$/)) break;

            // Check if this element contains multiple references separated by <br>
            if ((sibling.tagName === 'P' || sibling.tagName === 'DIV') && sibling.innerHTML.includes('<br>')) {
                const html = sibling.innerHTML;
                // Check if it has reference patterns
                if (/\[\d+\]/.test(html) || /^\d+\./.test(html)) {
                    // Split by <br> and wrap each reference line
                    const newHtml = html.replace(
                        /(\[(\d+)\][^<]*<a[^>]*>[^<]*<\/a>[^<]*?)(<br\s*\/?>|$)/gi,
                        (match, content, num, br) => {
                            return `<span class="ref-line" data-ref="${num}">${content}</span>${br}`;
                        }
                    ).replace(
                        /((?:^|>)(\d+)\.[^<]*<a[^>]*>[^<]*<\/a>[^<]*?)(<br\s*\/?>|$)/gi,
                        (match, content, num, br) => {
                            return `<span class="ref-line" data-ref="${num}">${content}</span>${br}`;
                        }
                    );
                    sibling.innerHTML = newHtml;
                }
            }

            sibling = sibling.nextElementSibling;
        }
    }

    // Parse references from the bottom of the page
    function parseReferences() {
        references.clear();
        // Note: Don't clear referenceLinkLocations here as it's populated by linkifyReferences
        // and needs to persist for up-arrow navigation

        // First, wrap references with spans for precise targeting
        wrapReferencesWithSpans();

        // Check for wrapped spans first (most precise)
        document.querySelectorAll('.ref-line[data-ref]').forEach(span => {
            const num = span.dataset.ref;
            if (!references.has(num)) {
                const linkElement = span.querySelector('a[href]');
                const url = linkElement ? linkElement.href : null;

                // Get description (text before the link)
                let description = '';
                const textContent = span.textContent;
                const match = textContent.match(/^\[?\d+\]?:?\s*(.+?)(?:https?:|$)/);
                if (match) {
                    description = match[1].trim().replace(/:?\s*$/, '');
                }

                references.set(num, {
                    description: description || `Reference ${num}`,
                    url: url,
                    element: span
                });
            }
        });

        // Find all text nodes that start with [n], [n]:, or n. pattern
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        // Pattern matches [n], [n]:, or n. at the start of text
        // Group 1: number from [n] format, Group 2: number from n. format, Group 3: description
        const refStartPattern = /^(?:\[(\d+)\]:?|(\d+)\.)\s*(.*)$/;

        let node;
        while (node = walker.nextNode()) {
            const text = node.textContent.trim();
            const match = text.match(refStartPattern);

            if (match) {
                const num = match[1] || match[2]; // Get number from either format
                if (references.has(num)) continue; // Skip if already found

                let description = (match[3] || '').trim();
                let url = null;

                // First priority: check immediate next sibling for <a> tag
                // This is the most accurate method when [n] text is followed by <a>
                let sibling = node.nextSibling;
                while (sibling) {
                    if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === 'A') {
                        url = sibling.href;
                        description = description.replace(/:?\s*$/, '');
                        break;
                    }
                    // Stop if we hit a <br> or another reference pattern
                    if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === 'BR') break;
                    if (sibling.nodeType === Node.TEXT_NODE && sibling.textContent.trim().match(/^(?:\[\d+\]|\d+\.)/)) break;
                    sibling = sibling.nextSibling;
                }

                // If still no URL, check if the description itself contains a URL
                if (!url) {
                    const urlMatch = description.match(/(https?:\/\/[^\s]+)/);
                    if (urlMatch) {
                        url = urlMatch[1];
                        description = description.replace(/:?\s*https?:\/\/[^\s]+/, '').trim();
                    }
                }

                if (description || url) {
                    const parent = node.parentElement;
                    references.set(num, {
                        description: description || `Reference ${num}`,
                        url: url,
                        element: parent
                    });
                }
            }
        }

        // Additional pass: parse from innerHTML for elements containing multiple references
        // This handles cases not caught above
        document.querySelectorAll('p, div').forEach(container => {
            const html = container.innerHTML;

            // Pattern 1: [n] or [n]: followed by description, then <a href="url">
            const bracketRefPattern = /\[(\d+)\]:?\s*([^<]*?)\s*<a[^>]+href=["']([^"']+)["'][^>]*>/g;

            let match;
            while ((match = bracketRefPattern.exec(html)) !== null) {
                const num = match[1];
                if (!references.has(num)) {
                    let description = match[2].trim().replace(/:?\s*$/, '');
                    const url = match[3];

                    // Try to find a specific span for this reference
                    let element = container.querySelector(`.ref-line[data-ref="${num}"]`) || container;

                    references.set(num, {
                        description: description || `Reference ${num}`,
                        url: url,
                        element: element
                    });
                }
            }

            // Pattern 2: n. followed by description, then <a href="url">
            const dotRefPattern = /(?:^|<br\s*\/?>|[\n\r])(\d+)\.\s*([^<]*?)\s*<a[^>]+href=["']([^"']+)["'][^>]*>/g;

            while ((match = dotRefPattern.exec(html)) !== null) {
                const num = match[1];
                if (!references.has(num)) {
                    let description = match[2].trim().replace(/:?\s*$/, '');
                    const url = match[3];

                    // Try to find a specific span for this reference
                    let element = container.querySelector(`.ref-line[data-ref="${num}"]`) || container;

                    references.set(num, {
                        description: description || `Reference ${num}`,
                        url: url,
                        element: element
                    });
                }
            }
        });

        // Third pass: handle <ol> lists where reference number is implicit from list position
        // Find <ol> elements that come after a References/Resources header
        const resourcesHeader = getResourcesHeader();
        if (resourcesHeader) {
            let sibling = resourcesHeader.nextElementSibling;
            while (sibling) {
                if (sibling.tagName === 'OL') {
                    const listItems = sibling.querySelectorAll('li');
                    listItems.forEach((li, index) => {
                        const num = String(index + 1); // 1-indexed
                        if (!references.has(num)) {
                            const linkElement = li.querySelector('a[href]');
                            const url = linkElement ? linkElement.href : null;

                            // Get description: text content before the link
                            let description = '';
                            for (const node of li.childNodes) {
                                if (node.nodeType === Node.TEXT_NODE) {
                                    description += node.textContent;
                                } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'A') {
                                    description += node.textContent;
                                } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'A') {
                                    break; // Stop at the link
                                }
                            }
                            description = description.trim().replace(/[.:]\s*$/, '');

                            if (url || description) {
                                references.set(num, {
                                    description: description || `Reference ${num}`,
                                    url: url,
                                    element: li
                                });
                            }
                        }
                    });
                    break; // Found the references list
                }
                // Stop if we hit another header
                if (sibling.tagName && sibling.tagName.match(/^H[1-6]$/)) break;
                sibling = sibling.nextElementSibling;
            }
        }
    }

    // Find the Resources/References section header
    function getResourcesHeader() {
        // Try both "resources" and "references" IDs, and both h2 and h3 tags
        return document.querySelector('h2#resources, h2#references, h3#resources, h3#references') ||
               // Fallback: find by text content
               Array.from(document.querySelectorAll('h2, h3')).find(h =>
                   /^(resources|references)$/i.test(h.textContent.trim())
               );
    }

    // Find the Resources/References section element
    function getResourcesSection() {
        const resourcesHeader = getResourcesHeader();
        if (resourcesHeader) {
            // Return the parent container or next sibling that contains the references
            let sibling = resourcesHeader.nextElementSibling;
            while (sibling) {
                if (sibling.tagName === 'P' || sibling.tagName === 'DIV') {
                    return sibling;
                }
                sibling = sibling.nextElementSibling;
            }
        }
        return null;
    }

    // Check if an element is inside the Resources/References section
    function isInResourcesSection(element) {
        const resourcesHeader = getResourcesHeader();
        if (!resourcesHeader) return false;

        if (!isAfter(element, resourcesHeader)) return false;

        const nextHeader = findNextHeaderAfter(resourcesHeader);
        if (nextHeader && !isBefore(element, nextHeader)) return false;

        return true;
    }

    // Find and linkify [n] markers in the content
    function linkifyReferences() {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const nodesToProcess = [];
        const seenTargets = new Set();
        const markerPattern = /\[(\d+)\]/g;

        let node;
        while (node = walker.nextNode()) {
            if (!node.parentElement) continue;
            if (node.parentElement.closest(`[data-ref-link]`)) continue;
            if (isInResourcesSection(node.parentElement)) continue;
            if (node.textContent.trim().match(/^(?:\[\d+\]:?|\d+\.)\s/)) continue;

            const parentLink = node.parentElement.closest('a[href]');
            const target = parentLink && parentLink.contains(node) ? parentLink : node;

            if (seenTargets.has(target)) continue;

            if (markerPattern.test(target.textContent)) {
                nodesToProcess.push({ target, parentLink });
                seenTargets.add(target);
            }
            markerPattern.lastIndex = 0;
        }

        nodesToProcess.forEach(({ target, parentLink }) => {
            const text = target.textContent;
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            let match;

            markerPattern.lastIndex = 0;
            while ((match = markerPattern.exec(text)) !== null) {
                const num = match[1];
                const ref = references.get(num);
                const existingHref = parentLink ? parentLink.href : null;

                if (match.index > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
                }

                const wrapper = document.createElement('span');
                wrapper.className = `ref-link-wrapper ${CLASS_REF_WRAPPER}`;
                wrapper.setAttribute('data-ref-link', num);
                wrapper.setAttribute(WRAPPER_PROCESSED_ATTR, 'true');
                wrapper.style.cssText = 'display: inline-flex; align-items: center; gap: 1px;';

                const link = document.createElement('a');
                link.textContent = match[0];
                link.className = 'ref-link';

                if (ref && ref.url) {
                    link.href = ref.url;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.title = `${ref.description}\n(Click to open link)`;
                } else if (existingHref) {
                    link.href = existingHref;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.title = ref ? ref.description : 'Reference link';
                } else {
                    link.href = '#';
                    link.title = ref ? ref.description : 'Reference not found';
                    link.addEventListener('click', (e) => e.preventDefault());
                }

                link.style.cssText = `
                    color: #3b82f6;
                    text-decoration: none;
                    cursor: pointer;
                    font-weight: 500;
                    padding: 0 2px;
                    border-radius: 2px 0 0 2px;
                    transition: background-color 0.2s;
                `;

                link.addEventListener('mouseenter', () => {
                    currentHoveredLink = link;
                    link.style.backgroundColor = 'rgba(99, 102, 241, 0.08)';
                    clearTimeout(hoverTimeout);
                    clearTimeout(hideTimeout);
                    hoverTimeout = setTimeout(() => {
                        if (currentHoveredLink === link) {
                            showHoverCard(num, wrapper);
                        }
                    }, 250);
                });
                link.addEventListener('mouseleave', () => {
                    link.style.backgroundColor = '';
                    currentHoveredLink = null;
                    clearTimeout(hoverTimeout);
                    setTimeout(() => {
                        if (!isHoveringCard && currentHoveredLink === null) {
                            hideHoverCard();
                        }
                    }, 100);
                });

                const arrowBtn = document.createElement('span');
                arrowBtn.textContent = '↓';
                arrowBtn.className = 'ref-scroll-btn';
                arrowBtn.title = 'Scroll to reference';
                arrowBtn.style.cssText = `
                    color: #3b82f6;
                    cursor: pointer;
                    font-size: 0.75em;
                    padding: 0 3px;
                    border-radius: 0 2px 2px 0;
                    transition: background-color 0.2s;
                    user-select: none;
                `;

                arrowBtn.addEventListener('mouseenter', () => {
                    arrowBtn.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
                });
                arrowBtn.addEventListener('mouseleave', () => {
                    arrowBtn.style.backgroundColor = '';
                });

                arrowBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const refData = references.get(num);
                    if (refData && refData.element) {
                        refData.element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                        const originalBg = refData.element.style.backgroundColor;
                        refData.element.style.backgroundColor = '#fef08a';
                        refData.element.style.transition = 'background-color 0.3s';
                        setTimeout(() => {
                            refData.element.style.backgroundColor = originalBg;
                        }, 2000);
                        return;
                    }

                    const resourcesHeader = getResourcesHeader();
                    if (resourcesHeader) {
                        let sibling = resourcesHeader.nextElementSibling;
                        while (sibling) {
                            if (sibling.tagName === 'OL') {
                                const listItems = sibling.querySelectorAll('li');
                                const targetIndex = parseInt(num, 10) - 1;
                                if (listItems[targetIndex]) {
                                    const targetElement = listItems[targetIndex];
                                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

                                    const originalBg = targetElement.style.backgroundColor;
                                    targetElement.style.backgroundColor = '#fef08a';
                                    targetElement.style.transition = 'background-color 0.3s';
                                    setTimeout(() => {
                                        targetElement.style.backgroundColor = originalBg;
                                    }, 2000);
                                    return;
                                }
                            }
                            if (sibling.tagName && sibling.tagName.match(/^H[1-6]$/)) break;
                            sibling = sibling.nextElementSibling;
                        }

                        const resourcesSection = getResourcesSection();
                        if (resourcesSection) {
                            const refPatternBracket = new RegExp(`\\[${num}\\]`);
                            const refPatternDot = new RegExp(`(^|\\s)${num}\\.\\s`);

                            const sectionWalker = document.createTreeWalker(
                                resourcesSection,
                                NodeFilter.SHOW_TEXT,
                                null,
                                false
                            );

                            let textNode;
                            while (textNode = sectionWalker.nextNode()) {
                                const textContent = textNode.textContent;
                                if (refPatternBracket.test(textContent) || refPatternDot.test(textContent)) {
                                    const targetElement = textNode.parentElement;
                                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

                                    const originalBg = targetElement.style.backgroundColor;
                                    targetElement.style.backgroundColor = '#fef08a';
                                    targetElement.style.transition = 'background-color 0.3s';
                                    setTimeout(() => {
                                        targetElement.style.backgroundColor = originalBg;
                                    }, 2000);
                                    return;
                                }
                            }
                        }

                        resourcesHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });

                wrapper.appendChild(link);
                wrapper.appendChild(arrowBtn);
                fragment.appendChild(wrapper);

                lastIndex = markerPattern.lastIndex;
            }

            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
            }

            if (fragment.childNodes.length > 0) {
                const replacementTarget = parentLink || target;
                replacementTarget.replaceWith(fragment);
            }
        });
    }

    // Add up arrows to references in Resources section
    function addUpArrowsToReferences() {
        clearUpArrows();

        const appendArrow = (num, container) => {
            const refLinkExists = document.querySelector(`[data-ref-link="${num}"]`);
            if (!refLinkExists) return;

            const upArrow = document.createElement('span');
            upArrow.className = CLASS_UP_ARROW;
            upArrow.textContent = ' ↑';
            upArrow.title = 'Go back to reference in article';
            upArrow.style.cssText = `
                color: #6366f1;
                cursor: pointer;
                font-size: 0.9em;
                margin-left: 6px;
                padding: 2px 4px;
                border-radius: 3px;
                transition: all 0.2s;
                user-select: none;
                display: inline-block;
            `;

            upArrow.addEventListener('mouseenter', () => {
                upArrow.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
                upArrow.style.transform = 'translateY(-1px)';
            });

            upArrow.addEventListener('mouseleave', () => {
                upArrow.style.backgroundColor = '';
                upArrow.style.transform = 'translateY(0)';
            });

            upArrow.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                scrollToRefLink(num, true);
            });

            container.appendChild(upArrow);
        };

        document.querySelectorAll('.ref-line[data-ref]').forEach(span => {
            const num = span.dataset.ref;
            appendArrow(num, span);
        });

        const resourcesHeader = getResourcesHeader();
        if (resourcesHeader) {
            let sibling = resourcesHeader.nextElementSibling;
            while (sibling) {
                if (sibling.tagName === 'OL') {
                    const listItems = sibling.querySelectorAll('li');
                    listItems.forEach((li, index) => {
                        const num = String(index + 1);
                        appendArrow(num, li);
                    });
                    break;
                }
                if (sibling.tagName && sibling.tagName.match(/^H[1-6]$/)) break;
                sibling = sibling.nextElementSibling;
            }
        }
    }

    function compareVersions(versionA, versionB) {
        const toParts = (version) => version.split('.').map((part) => parseInt(part, 10) || 0);
        const partsA = toParts(versionA);
        const partsB = toParts(versionB);
        const maxLength = Math.max(partsA.length, partsB.length);

        for (let i = 0; i < maxLength; i++) {
            const a = partsA[i] || 0;
            const b = partsB[i] || 0;

            if (a > b) return 1;
            if (a < b) return -1;
        }

        return 0;
    }

    function extractVersionFromScript(scriptText) {
        const match = scriptText.match(/@version\s+([0-9.]+)/);
        return match ? match[1] : null;
    }

    function fetchLatestVersion() {
        return new Promise((resolve) => {
            // If we cannot make the cross-origin request, bail early
            if (typeof GM_xmlhttpRequest === 'undefined') {
                resolve(null);
                return;
            }

            GM_xmlhttpRequest({
                method: 'GET',
                url: SCRIPT_UPDATE_URL,
                timeout: 6000,
                onload: (response) => {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(extractVersionFromScript(response.responseText));
                    } else {
                        resolve(null);
                    }
                },
                onerror: () => resolve(null),
                ontimeout: () => resolve(null)
            });
        });
    }

    function openUpdatePage() {
        if (typeof GM_openInTab !== 'undefined') {
            GM_openInTab(SCRIPT_UPDATE_URL, { active: true, insert: true });
        } else {
            window.open(SCRIPT_UPDATE_URL, '_blank');
        }
    }

    function showUpdatePrompt(latestVersion) {
        if (document.querySelector('.bytebytego-update-toast.update-available')) {
            return;
        }

        const toast = document.createElement('div');
        toast.className = 'bytebytego-update-toast update-available';

        toast.innerHTML = `
            <div class="update-toast-header">
                <div class="update-toast-title">
                    <span>New version available</span>
                    <span class="update-toast-badge">v${latestVersion}</span>
                </div>
                <button class="update-toast-close" aria-label="Close">×</button>
            </div>
            <div class="update-toast-content">
                <strong>Update ByteByteGo Reference Linker</strong>
                <p>Tap update to install the latest improvements without leaving the page.</p>
            </div>
            <div class="update-toast-actions">
                <button class="update-toast-btn secondary" type="button">Later</button>
                <button class="update-toast-btn primary" type="button">Update</button>
            </div>
            <div class="update-toast-footer">
                Current: v${SCRIPT_VERSION} · Latest: v${latestVersion}
            </div>
        `;

        document.body.appendChild(toast);

        const [laterBtn, updateBtn] = toast.querySelectorAll('.update-toast-btn');

        const closeToast = () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 250);
        };

        toast.querySelector('.update-toast-close').onclick = closeToast;
        laterBtn.onclick = closeToast;

        updateBtn.onclick = () => {
            updateBtn.textContent = 'Updating...';
            updateBtn.disabled = true;
            laterBtn.disabled = true;
            openUpdatePage();
            setTimeout(closeToast, 600);
        };

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
    }

    async function checkForScriptUpdate() {
        try {
            const lastCheck = parseInt(localStorage.getItem(LAST_UPDATE_CHECK_KEY) || '0', 10);
            const now = Date.now();

            if (lastCheck && now - lastCheck < UPDATE_CHECK_INTERVAL) {
                return;
            }

            const latestVersion = await fetchLatestVersion();
            localStorage.setItem(LAST_UPDATE_CHECK_KEY, String(now));

            if (latestVersion && compareVersions(latestVersion, SCRIPT_VERSION) > 0) {
                showUpdatePrompt(latestVersion);
            }
        } catch (error) {
            console.error('[ByteByteGo Refs] Error checking for remote updates:', error);
        }
    }

    // Changelog helper
    async function fetchChangelog(version) {
        if (!version || typeof GM_xmlhttpRequest === 'undefined') {
            return null;
        }

        return new Promise((resolve) => {
            const timeoutMs = 5000;
            const fallbackResolve = () => resolve(null);
            const timeout = setTimeout(fallbackResolve, timeoutMs);

            try {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: CHANGELOG_URL,
                    timeout: timeoutMs,
                    onload: (response) => {
                        clearTimeout(timeout);
                        if (response.status < 200 || response.status >= 300) {
                            resolve(null);
                            return;
                        }
                        try {
                            const data = JSON.parse(response.responseText);
                            let entry = null;

                            if (Array.isArray(data)) {
                                entry = data.find(item => item && item.version === version) || null;
                            } else if (data && typeof data === 'object') {
                                if (Array.isArray(data.entries)) {
                                    entry = data.entries.find(item => item && item.version === version) || null;
                                } else if (data[version]) {
                                    const raw = data[version];
                                    entry = { ...raw, version: raw.version || version };
                                }
                            }

                            resolve(entry || null);
                        } catch (err) {
                            console.error('[ByteByteGo Refs] Error parsing changelog JSON:', err);
                            resolve(null);
                        }
                    },
                    onerror: () => {
                        clearTimeout(timeout);
                        resolve(null);
                    },
                    ontimeout: () => {
                        clearTimeout(timeout);
                        resolve(null);
                    }
                });
            } catch (err) {
                clearTimeout(timeout);
                console.error('[ByteByteGo Refs] Failed to fetch changelog:', err);
                resolve(null);
            }
        });
    }

    // Show update notification toast
    function showUpdateNotification() {
        const fallbackChangelog = {
            '1.7.0': {
                title: 'One-Tap Script Updates',
                changes: [
                    'New toast prompts you to install updates immediately',
                    'Automatic once-daily checks for newer script versions',
                    'Update button opens the latest improvements without leaving the page'
                ]
            }
        };

        (async () => {
            let entry = null;

            try {
                entry = await fetchChangelog(SCRIPT_VERSION);
            } catch (err) {
                console.error('[ByteByteGo Refs] Error loading changelog:', err);
            }

            if (!entry) {
                entry = fallbackChangelog[SCRIPT_VERSION] || null;
            }

            if (!entry || !entry.title || !Array.isArray(entry.changes) || entry.changes.length === 0) {
                console.info(`[ByteByteGo Refs] No changelog entry available for v${SCRIPT_VERSION}`);
                return;
            }

            const toast = document.createElement('div');
            toast.className = 'bytebytego-update-toast';

            toast.innerHTML = `
                <div class="update-toast-header">
                    <div class="update-toast-title">
                        <span>ByteByteGo Reference Linker</span>
                        <span class="update-toast-badge">v${SCRIPT_VERSION}</span>
                    </div>
                    <button class="update-toast-close" aria-label="Close">×</button>
                </div>
                <div class="update-toast-content">
                    <strong>${entry.title}</strong>
                    <ul>
                        ${entry.changes.map(change => `<li>${change}</li>`).join('')}
                    </ul>
                </div>
                <div class="update-toast-footer">
                    Hover over references to see preview cards, click ↑ arrows to jump back!
                </div>
            `;

            document.body.appendChild(toast);

            toast.querySelector('.update-toast-close').onclick = () => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            };

            requestAnimationFrame(() => {
                toast.classList.add('show');
            });

            setTimeout(() => {
                if (toast.classList.contains('show')) {
                    toast.classList.remove('show');
                    setTimeout(() => toast.remove(), 300);
                }
            }, 10000);
        })();
    }

    // Check for updates
    function checkForUpdates() {
        try {
            const lastVersion = localStorage.getItem(VERSION_KEY);

            if (!lastVersion) {
                // First install
                localStorage.setItem(VERSION_KEY, SCRIPT_VERSION);
            } else if (lastVersion !== SCRIPT_VERSION) {
                // Update detected
                localStorage.setItem(VERSION_KEY, SCRIPT_VERSION);
                // Show notification after a short delay to ensure page is ready
                setTimeout(showUpdateNotification, 2000);
            }
        } catch (error) {
            console.error('[ByteByteGo Refs] Error checking for updates:', error);
        }
    }

    // Main function
    function processPage() {
        injectStyles();
        parseReferences();
        linkifyReferences();
        addUpArrowsToReferences();
        console.log(`[ByteByteGo Refs] Found ${references.size} references`);
    }

    // Check for updates on load
    checkForUpdates();
    checkForScriptUpdate();

    // Initial run with delay to ensure page is loaded
    setTimeout(() => debouncedProcessPage(), 1000);

    // Re-run on dynamic content changes
    const observer = new MutationObserver((mutations) => {
        let shouldProcess = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0 || mutation.type === 'characterData') {
                shouldProcess = true;
                break;
            }
        }
        if (shouldProcess) {
            debouncedProcessPage();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });

})();
