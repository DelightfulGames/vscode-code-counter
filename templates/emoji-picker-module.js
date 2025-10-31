/**
 * VS Code Code Counter Extension - Emoji Picker Module
 * 
 * Copyright (c) 2025 DelightfulGames
 * Licensed under the MIT License
 * 
 * Repository: https://github.com/DelightfulGames/vscode-code-counter
 * Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
 */

// Emoji picker state
let currentColorKey = '';
let currentEmojiType = 'file';

function openEmojiPicker(colorKey, type) {
    currentColorKey = colorKey;
    currentEmojiType = type;
    
    // Show the emoji picker modal
    const modal = document.getElementById('emojiModal');
    if (modal) {
        modal.classList.add('show');
        // Focus the search input
        const searchInput = document.getElementById('emojiSearch');
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 100);
        }
        // Initialize emoji grid if not already done
        if (!window.emojisInitialized) {
            initializeEmojiPicker();
            window.emojisInitialized = true;
        }
    }
}

window.closeEmojiPicker = function() {
    const modal = document.getElementById('emojiModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function getCurrentlyUsedEmojis() {
    const usedEmojis = new Set();
    
    // Get all current emoji displays
    document.querySelectorAll('.current-emoji').forEach(el => {
        const emoji = el.textContent.trim();
        if (emoji) {
            usedEmojis.add(emoji);
        }
    });
    
    return usedEmojis;
}

function selectEmoji(emoji) {
    // Check if emoji is already in use
    const usedEmojis = getCurrentlyUsedEmojis();
    const currentEmojiEl = document.querySelector(`[data-color-key="${currentColorKey}"][data-type="${currentEmojiType}"]`);
    const currentEmoji = currentEmojiEl ? currentEmojiEl.textContent.trim() : '';
    
    // Allow reselecting the same emoji for the same slot
    if (usedEmojis.has(emoji) && emoji !== currentEmoji) {
        // Show validation message
        const validationMsg = document.createElement('div');
        validationMsg.textContent = `Emoji "${emoji}" is already in use. Please choose a different emoji.`;
        validationMsg.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 15px 20px;
            border-radius: 6px;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            max-width: 300px;
            text-align: center;
            font-size: 14px;
        `;
        document.body.appendChild(validationMsg);
        
        // Remove message after 3 seconds
        setTimeout(() => {
            if (validationMsg.parentNode) {
                validationMsg.parentNode.removeChild(validationMsg);
            }
        }, 3000);
        
        return;
    }
    
    // Update the current emoji display
    if (currentEmojiEl) {
        currentEmojiEl.textContent = emoji;
        
        // Show the reset button since we're setting a custom emoji
        const resetBtn = currentEmojiEl.querySelector('.emoji-reset-btn');
        if (resetBtn) {
            resetBtn.style.display = 'flex';
        }
    }
    
    // Send update to VS Code
    vscode.postMessage({
        command: 'updateEmoji',
        colorKey: currentColorKey,
        type: currentEmojiType,
        emoji: emoji,
        currentDirectory: window.workspaceData ? window.workspaceData.currentDirectory : '<global>'
    });
    
    // Close the picker
    closeEmojiPicker();
}

function initializeEmojiPicker() {
    try {
        // Emoji data is now embedded directly into the HTML by the extension
        // Check if data is available
        if (!window.emojiData || !window.emojiSearchData) {
            throw new Error('Emoji data not loaded');
        }
        
        displayEmojiCategory('all', window.emojiData);
        
        // Set up search functionality
        const searchInput = document.getElementById('emojiSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                debounceSearch(e.target.value, window.emojiData);
            });
        }
        
        // Close modal when clicking outside
        const modal = document.getElementById('emojiModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeEmojiPicker();
                }
            });
        }
    } catch (error) {
        debug.error('Error initializing emoji picker:', error);
    }
}

function displayEmojiCategory(category, emojiData) {
    const grid = document.getElementById('emojiGrid');
    if (!grid) {
        debug.warning('Emoji grid not found');
        return;
    }
    
    grid.innerHTML = '';
    
    let emojisToShow = [];
    if (category === 'all') {
        emojisToShow = Object.values(emojiData).flat();
    } else if (emojiData[category]) {
        emojisToShow = emojiData[category];
    }
    
    debug.verbose(`Displaying ${emojisToShow.length} emojis for category: ${category}`);
    
    if (emojisToShow.length === 0) {
        const noEmojiMsg = document.createElement('div');
        noEmojiMsg.textContent = 'No emojis found for this category';
        noEmojiMsg.style.textAlign = 'center';
        noEmojiMsg.style.padding = '20px';
        noEmojiMsg.style.color = 'var(--vscode-descriptionForeground)';
        grid.appendChild(noEmojiMsg);
        return;
    }
    
    const usedEmojis = getCurrentlyUsedEmojis();
    
    emojisToShow.forEach(emoji => {
        const emojiEl = document.createElement('div');
        emojiEl.className = 'emoji-item';
        emojiEl.textContent = emoji;
        emojiEl.onclick = () => selectEmoji(emoji);
        
        // Mark used emojis
        if (usedEmojis.has(emoji)) {
            emojiEl.classList.add('emoji-used');
            emojiEl.title = `${emoji} - Already in use`;
            emojiEl.style.opacity = '0.4';
            emojiEl.style.filter = 'grayscale(50%)';
        } else {
            emojiEl.title = emoji;
        }
        
        grid.appendChild(emojiEl);
    });
}

window.switchCategory = function(category) {
    // Update active tab
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    const targetTab = document.querySelector(`[data-category="${category}"]`);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // Show emojis for this category
    if (window.emojiData) {
        displayEmojiCategory(category, window.emojiData);
    }
}

let searchTimeout;
function debounceSearch(query, emojiData) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        searchEmojis(query, emojiData);
    }, 200);
}

function searchEmojis(query, emojiData) {
    const grid = document.getElementById('emojiGrid');
    const resultsInfo = document.getElementById('searchResultsInfo');
    if (!grid) return;
    
    if (!query.trim()) {
        displayEmojiCategory('all', emojiData);
        if (resultsInfo) resultsInfo.textContent = '';
        return;
    }
    
    const searchTerm = query.toLowerCase().trim();
    const allEmojis = Object.values(emojiData).flat();
    const searchData = window.emojiSearchData || {};
    
    // Search through emojis using metadata
    const filteredEmojis = allEmojis.filter(emoji => {
        const searchTerms = searchData[emoji] || [];
        return searchTerms.some(term => term.toLowerCase().includes(searchTerm));
    });
    
    // Update results info
    if (resultsInfo) {
        if (filteredEmojis.length === 0) {
            resultsInfo.textContent = `No emojis found for "${query}"`;
            resultsInfo.style.color = 'var(--vscode-errorForeground)';
        } else {
            resultsInfo.textContent = `Found ${filteredEmojis.length} emoji${filteredEmojis.length === 1 ? '' : 's'} for "${query}"`;
            resultsInfo.style.color = 'var(--vscode-foreground)';
        }
    }
    
    grid.innerHTML = '';
    
    if (filteredEmojis.length === 0) {
        const noResultsMsg = document.createElement('div');
        noResultsMsg.textContent = 'Try searching for: smile, heart, red, circle, star, fire, etc.';
        noResultsMsg.style.textAlign = 'center';
        noResultsMsg.style.padding = '20px';
        noResultsMsg.style.color = 'var(--vscode-descriptionForeground)';
        grid.appendChild(noResultsMsg);
        return;
    }
    
    const usedEmojis = getCurrentlyUsedEmojis();
    
    filteredEmojis.forEach(emoji => {
        const emojiEl = document.createElement('div');
        emojiEl.className = 'emoji-item';
        emojiEl.textContent = emoji;
        emojiEl.onclick = () => selectEmoji(emoji);
        
        if (usedEmojis.has(emoji)) {
            emojiEl.classList.add('emoji-used');
            emojiEl.title = `${emoji} - Already in use - ${(searchData[emoji] || []).join(', ')}`;
            emojiEl.style.opacity = '0.4';
            emojiEl.style.filter = 'grayscale(50%)';
        } else {
            emojiEl.title = emoji + ' - ' + (searchData[emoji] || []).join(', ');
        }
        
        grid.appendChild(emojiEl);
    });
}

//# sourceURL=emoji-picker.js