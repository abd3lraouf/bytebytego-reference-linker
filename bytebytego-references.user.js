// ==UserScript==
// @name         ByteByteGo Reference Linker
// @namespace    https://github.com/abd3lraouf
// @version      1.4.0
// @description  Converts [n] reference markers into clickable links on ByteByteGo courses. Click the reference to open the URL, or click the arrow to scroll to the References section.
// @author       abd3lraouf
// @license      MIT
// @match        https://bytebytego.com/*
// @match        https://*.bytebytego.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bytebytego.com
// @grant        none
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

    // Hover card state
    let hoverCard = null;
    let hoverTimeout = null;
    let hideTimeout = null;

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
                border: 1px solid #e5e7eb;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1);
                padding: 16px;
                max-width: 400px;
                min-width: 300px;
                opacity: 0;
                visibility: hidden;
                transform: translateY(8px);
                transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
                pointer-events: none;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .ref-hover-card.visible {
                opacity: 1;
                visibility: visible;
                transform: translateY(0);
                pointer-events: auto;
            }

            .ref-hover-card.above {
                transform: translateY(-8px);
            }

            .ref-hover-card.above.visible {
                transform: translateY(0);
            }

            .ref-card-header {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 12px;
            }

            .ref-card-number {
                background: linear-gradient(135deg, #3b82f6, #2563eb);
                color: white;
                font-size: 12px;
                font-weight: 600;
                padding: 4px 10px;
                border-radius: 6px;
                flex-shrink: 0;
            }

            .ref-card-domain {
                display: flex;
                align-items: center;
                gap: 6px;
                color: #6b7280;
                font-size: 12px;
                overflow: hidden;
            }

            .ref-card-favicon {
                width: 16px;
                height: 16px;
                border-radius: 4px;
                flex-shrink: 0;
            }

            .ref-card-domain-text {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .ref-card-title {
                font-size: 14px;
                font-weight: 600;
                color: #1f2937;
                margin-bottom: 8px;
                line-height: 1.4;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            .ref-card-url {
                font-size: 12px;
                color: #3b82f6;
                word-break: break-all;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
                line-height: 1.4;
                padding: 8px;
                background: #f3f4f6;
                border-radius: 6px;
                margin-bottom: 12px;
            }

            .ref-card-actions {
                display: flex;
                gap: 8px;
            }

            .ref-card-btn {
                flex: 1;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.15s ease;
                text-align: center;
                text-decoration: none;
                border: none;
            }

            .ref-card-btn-primary {
                background: linear-gradient(135deg, #3b82f6, #2563eb);
                color: white;
            }

            .ref-card-btn-primary:hover {
                background: linear-gradient(135deg, #2563eb, #1d4ed8);
                transform: translateY(-1px);
            }

            .ref-card-btn-secondary {
                background: #f3f4f6;
                color: #4b5563;
            }

            .ref-card-btn-secondary:hover {
                background: #e5e7eb;
            }

            /* Dark mode support */
            @media (prefers-color-scheme: dark) {
                .ref-hover-card {
                    background: #1f2937;
                    border-color: #374151;
                }

                .ref-card-title {
                    color: #f3f4f6;
                }

                .ref-card-domain {
                    color: #9ca3af;
                }

                .ref-card-url {
                    background: #374151;
                    color: #60a5fa;
                }

                .ref-card-btn-secondary {
                    background: #374151;
                    color: #d1d5db;
                }

                .ref-card-btn-secondary:hover {
                    background: #4b5563;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Create hover card element
    function createHoverCard() {
        if (hoverCard) return hoverCard;

        hoverCard = document.createElement('div');
        hoverCard.className = 'ref-hover-card';
        hoverCard.innerHTML = `
            <div class="ref-card-header">
                <span class="ref-card-number"></span>
                <div class="ref-card-domain">
                    <img class="ref-card-favicon" src="" alt="" />
                    <span class="ref-card-domain-text"></span>
                </div>
            </div>
            <div class="ref-card-title"></div>
            <div class="ref-card-url"></div>
            <div class="ref-card-actions">
                <a class="ref-card-btn ref-card-btn-primary" target="_blank" rel="noopener noreferrer">Open Link ↗</a>
                <button class="ref-card-btn ref-card-btn-secondary ref-card-scroll-btn">Scroll to Ref ↓</button>
            </div>
        `;

        // Keep card visible when hovering over it
        hoverCard.addEventListener('mouseenter', () => {
            clearTimeout(hideTimeout);
        });

        hoverCard.addEventListener('mouseleave', () => {
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
    function showHoverCard(refNum, anchorElement) {
        const ref = references.get(refNum);
        if (!ref || !ref.url) return;

        clearTimeout(hideTimeout);

        const card = createHoverCard();
        const domain = extractDomain(ref.url);
        const faviconUrl = getFaviconUrl(ref.url);

        // Update card content
        card.querySelector('.ref-card-number').textContent = `[${refNum}]`;
        card.querySelector('.ref-card-favicon').src = faviconUrl;
        card.querySelector('.ref-card-domain-text').textContent = domain;
        card.querySelector('.ref-card-title').textContent = ref.description || `Reference ${refNum}`;
        card.querySelector('.ref-card-url').textContent = ref.url;
        card.querySelector('.ref-card-btn-primary').href = ref.url;

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
        const cardHeight = 200; // Approximate height
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
        const cardWidth = 350;
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
    }

    // Hide hover card
    function hideHoverCard(immediate = false) {
        if (!hoverCard) return;

        if (immediate) {
            hoverCard.classList.remove('visible');
            return;
        }

        hideTimeout = setTimeout(() => {
            hoverCard.classList.remove('visible');
        }, 150);
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

        // Check if element comes after the resources header
        let current = resourcesHeader.nextElementSibling;
        while (current) {
            if (current.contains(element) || current === element) {
                return true;
            }
            current = current.nextElementSibling;
        }
        return false;
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
        const markerPattern = /\[(\d+)\]/g;

        let node;
        while (node = walker.nextNode()) {
            // Skip if already processed or inside a link
            if (node.parentElement.closest('.ref-link-wrapper, a[href]')) continue;
            // Skip reference definitions at the bottom (in Resources section) - both [n] and n. formats
            if (node.textContent.trim().match(/^(?:\[\d+\]:?|\d+\.)\s/)) continue;
            // Skip if inside the Resources/References section
            if (isInResourcesSection(node.parentElement)) continue;

            if (markerPattern.test(node.textContent)) {
                nodesToProcess.push(node);
            }
            markerPattern.lastIndex = 0;
        }

        nodesToProcess.forEach(textNode => {
            const text = textNode.textContent;
            const parent = textNode.parentElement;

            // Don't process if parent is already a link
            if (parent.tagName === 'A') return;

            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            let match;

            markerPattern.lastIndex = 0;
            while ((match = markerPattern.exec(text)) !== null) {
                const num = match[1];
                const ref = references.get(num);

                // Add text before the match
                if (match.index > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
                }

                // Create wrapper span for link + arrow
                const wrapper = document.createElement('span');
                wrapper.className = 'ref-link-wrapper';
                wrapper.style.cssText = 'display: inline-flex; align-items: center; gap: 1px;';

                // Create the main link element
                const link = document.createElement('a');
                link.textContent = match[0];
                link.className = 'ref-link';

                if (ref && ref.url) {
                    link.href = ref.url;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.title = `${ref.description}\n(Click to open link)`;
                } else {
                    link.href = '#';
                    link.title = ref ? ref.description : 'Reference not found';
                    link.addEventListener('click', (e) => e.preventDefault());
                }

                // Apply styles to main link
                link.style.cssText = `
                    color: #3b82f6;
                    text-decoration: none;
                    cursor: pointer;
                    font-weight: 500;
                    padding: 0 2px;
                    border-radius: 2px 0 0 2px;
                    transition: background-color 0.2s;
                `;

                // Hover events for card popup
                link.addEventListener('mouseenter', () => {
                    link.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                    clearTimeout(hoverTimeout);
                    hoverTimeout = setTimeout(() => {
                        showHoverCard(num, wrapper);
                    }, 300); // Delay to prevent flickering
                });
                link.addEventListener('mouseleave', () => {
                    link.style.backgroundColor = '';
                    clearTimeout(hoverTimeout);
                    hideHoverCard();
                });

                // Create down arrow button to scroll to reference
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

                    // First check if we have a stored element for this reference
                    const ref = references.get(num);
                    if (ref && ref.element) {
                        ref.element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                        // Highlight effect
                        const originalBg = ref.element.style.backgroundColor;
                        ref.element.style.backgroundColor = '#fef08a';
                        ref.element.style.transition = 'background-color 0.3s';
                        setTimeout(() => {
                            ref.element.style.backgroundColor = originalBg;
                        }, 2000);
                        return;
                    }

                    // Fallback: Find and scroll to the reference in Resources section
                    const resourcesHeader = getResourcesHeader();
                    if (resourcesHeader) {
                        // First check for <ol> list (numbered list)
                        let sibling = resourcesHeader.nextElementSibling;
                        while (sibling) {
                            if (sibling.tagName === 'OL') {
                                const listItems = sibling.querySelectorAll('li');
                                const targetIndex = parseInt(num) - 1; // 0-indexed
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

                        // Second, look for text patterns in <p> or <div>
                        const resourcesSection = getResourcesSection();
                        if (resourcesSection) {
                            const refPatternBracket = new RegExp(`\\[${num}\\]`);
                            const refPatternDot = new RegExp(`(^|\\s)${num}\\.\\s`);

                            const walker = document.createTreeWalker(
                                resourcesSection,
                                NodeFilter.SHOW_TEXT,
                                null,
                                false
                            );

                            let textNode;
                            while (textNode = walker.nextNode()) {
                                const text = textNode.textContent;
                                if (refPatternBracket.test(text) || refPatternDot.test(text)) {
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

                        // Final fallback: scroll to header
                        resourcesHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });

                wrapper.appendChild(link);
                wrapper.appendChild(arrowBtn);
                fragment.appendChild(wrapper);
                lastIndex = markerPattern.lastIndex;
            }

            // Add remaining text
            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
            }

            // Replace the text node
            if (fragment.childNodes.length > 0) {
                parent.replaceChild(fragment, textNode);
            }
        });
    }

    // Main function
    function processPage() {
        injectStyles();
        parseReferences();
        linkifyReferences();
        console.log(`[ByteByteGo Refs] Found ${references.size} references`);
    }

    // Initial run with delay to ensure page is loaded
    setTimeout(processPage, 1000);

    // Re-run on dynamic content changes
    const observer = new MutationObserver((mutations) => {
        let shouldProcess = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                shouldProcess = true;
                break;
            }
        }
        if (shouldProcess) {
            setTimeout(processPage, 500);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
