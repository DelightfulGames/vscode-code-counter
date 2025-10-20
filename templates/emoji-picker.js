const vscode = acquireVsCodeApi();
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
        console.error('Error initializing emoji picker:', error);
    }
}

function displayEmojiCategory(category, emojiData) {
    const grid = document.getElementById('emojiGrid');
    if (!grid) {
        console.log('Emoji grid not found');
        return;
    }
    
    grid.innerHTML = '';
    
    let emojisToShow = [];
    if (category === 'all') {
        emojisToShow = Object.values(emojiData).flat();
    } else if (emojiData[category]) {
        emojisToShow = emojiData[category];
    }
    
    console.log(`Displaying ${emojisToShow.length} emojis for category: ${category}`);
    
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

function addPattern() {
    const input = document.getElementById('newPattern');
    const pattern = input.value.trim();
    if (pattern) {
        // Check if we're in workspace mode
        const currentDirectory = window.workspaceData ? window.workspaceData.currentDirectory : '<global>';
        const isWorkspaceMode = currentDirectory !== '<global>';
        
        vscode.postMessage({
            command: 'addGlobPattern',
            pattern: pattern,
            currentDirectory: currentDirectory,
            isWorkspaceMode: isWorkspaceMode
        });
        input.value = '';
    }
}

function removePattern(pattern) {
    // Check if we're in workspace mode
    const currentDirectory = window.workspaceData ? window.workspaceData.currentDirectory : '<global>';
    const isWorkspaceMode = currentDirectory !== '<global>';
    
    vscode.postMessage({
        command: 'removeGlobPattern',
        pattern: pattern,
        currentDirectory: currentDirectory,
        isWorkspaceMode: isWorkspaceMode
    });
}

function resetPatterns() {
    // Check if we're in workspace mode
    const currentDirectory = window.workspaceData ? window.workspaceData.currentDirectory : '<global>';
    const isWorkspaceMode = currentDirectory !== '<global>';
    
    vscode.postMessage({
        command: 'resetGlobPatterns',
        currentDirectory: currentDirectory,
        isWorkspaceMode: isWorkspaceMode
    });
}

function resetEmojis() {
    // Check if we're in workspace mode by looking at the current context
    const currentDirectory = window.workspaceData ? window.workspaceData.currentDirectory : '<global>';
    const isWorkspaceMode = currentDirectory !== '<global>';
    
    vscode.postMessage({
        command: 'resetEmoji',
        currentDirectory: currentDirectory,
        isWorkspaceMode: isWorkspaceMode
    });
}

function updateNotificationSetting(isEnabled) {
    vscode.postMessage({
        command: 'updateNotificationSetting',
        enabled: isEnabled
    });
}

function updateThreshold(thresholdKey, value) {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 1) {
        return; // Invalid value, don't save
    }
    
    // Show the reset button for this threshold since we're setting a custom value
    if (thresholdKey === 'mid') {
        const resetBtn = document.querySelector('button[onclick*="resetField(event, \'threshold\', \'warning\')"]');
        if (resetBtn) resetBtn.style.display = 'flex';
    } else if (thresholdKey === 'high') {
        const resetBtn = document.querySelector('button[onclick*="resetField(event, \'threshold\', \'danger\')"]');
        if (resetBtn) resetBtn.style.display = 'flex';
    }
    
    vscode.postMessage({
        command: 'updateThreshold',
        thresholdKey: thresholdKey,
        value: numValue,
        currentDirectory: window.workspaceData ? window.workspaceData.currentDirectory : '<global>'
    });
}

document.addEventListener('DOMContentLoaded', function() {
    const newPatternInput = document.getElementById('newPattern');
    newPatternInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addPattern();
        }
    });
    
    // Initialize workspace mode (with small delay to ensure DOM is fully updated)
    setTimeout(initializeWorkspaceMode, 500);
    
    // Listen for messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        
        if (message.command === 'emptySettingsCheckResult') {
            // if (message.hasEmptySettings) {
            //     showEmptySettingsWarning(message.targetDirectory);
            // } else {
            proceedWithDirectoryChange(message.targetDirectory);
            //}
        } else if (message.command === 'fieldReset') {
            // Handle individual field reset - update the UI without full refresh
            handleFieldReset(message.field, message.directory, message.resolvedSettings);
        }
    });
});

function handleFieldReset(field, directory, resolvedSettings) {
    // Update the specific field display and keep the reset button hidden
    const currentDirectoryPath = window.workspaceData ? window.workspaceData.currentDirectory : '<global>';
    if (currentDirectoryPath === directory) {
        // Update the resolved settings for the current directory
        if (window.resolvedSettings) {
            window.resolvedSettings = resolvedSettings;
        }
        
        // Update the field display based on the reset field
        updateFieldDisplay(field, resolvedSettings);
        
        // The reset button should already be hidden from the resetField function
        // No need to run full initializeWorkspaceSettings which would show all buttons
    }
}

function updateFieldDisplay(field, resolvedSettings) {
    // Update emoji displays
    if (field.startsWith('codeCounter.emojis.')) {
        const emojiType = field.replace('codeCounter.emojis.', '');
        const colorKey = emojiType === 'normal' ? 'low' : 
                        emojiType === 'warning' ? 'medium' : 'high';
        
        // Check if field is folders or files
        const isFolder = field.includes('folders.');
        const emojiSelector = `[data-color-key="${colorKey}"][data-type="${isFolder ? 'folder' : 'file'}"]`;
        const fileEmojiEl = document.querySelector(emojiSelector);
        
        if (fileEmojiEl) {
            // Field was reset, so display resolved value (inherited) with grayed styling
            fileEmojiEl.textContent = resolvedSettings[field] || '❓';
            fileEmojiEl.style.opacity = '0.6';
            fileEmojiEl.title = 'Inherited from parent settings';
            
            // Reset button should be hidden since we're inheriting
            const resetBtn = fileEmojiEl.querySelector('.emoji-reset-btn');
            if (resetBtn) resetBtn.style.display = 'none';
        }
    }
    
    // Update threshold displays
    if (field.startsWith('codeCounter.lineThresholds.')) {
        const thresholdType = field.replace('codeCounter.lineThresholds.', '').replace('Threshold', '');
        const thresholdEl = document.getElementById(`${thresholdType}Threshold`);
        
        if (thresholdEl) {
            // Field was reset, so show as inherited
            thresholdEl.value = '';
            thresholdEl.placeholder = `${resolvedSettings[field]} (inherited)`;
            
            // Hide reset button since we're inheriting
            const resetBtnPattern = thresholdType === 'mid' ? 'warning' : 'danger';
            const resetBtn = document.querySelector(`button[onclick*="resetField"][onclick*="'${resetBtnPattern}'"]`);
            if (resetBtn) resetBtn.style.display = 'none';
        }
    }
    
    // Update exclude patterns display
    if (field === 'codeCounter.excludePatterns') {
        // Clear the current patterns container
        const patternsContainer = document.querySelector('.glob-patterns-container');
        if (patternsContainer) {
            patternsContainer.innerHTML = '';
        }
        
        // Hide reset button since we're now inheriting
        const resetBtn = document.querySelector('button[onclick*="resetField"][onclick*="excludePatterns"]');
        if (resetBtn) resetBtn.style.display = 'none';
        
        // Note: The extension will refresh the entire webview to show updated patterns
        // with proper inheritance styling, so we don't need to manually rebuild the HTML here
    }
}

// function showEmptySettingsWarning(targetDirectory) {
//     const modal = document.createElement('div');
//     modal.style.cssText = `
//         position: fixed;
//         top: 0;
//         left: 0;
//         width: 100%;
//         height: 100%;
//         background: rgba(0, 0, 0, 0.8);
//         z-index: 10000;
//         display: flex;
//         align-items: center;
//         justify-content: center;
//     `;
    
//     const dialog = document.createElement('div');
//     dialog.style.cssText = `
//         background: var(--vscode-editor-background);
//         border: 2px solid var(--vscode-inputValidation-warningBorder);
//         border-radius: 8px;
//         width: 90%;
//         max-width: 500px;
//         padding: 20px;
//         box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
//     `;
    
//     dialog.innerHTML = `
//         <h3 style="margin: 0 0 15px 0; color: var(--vscode-inputValidation-warningForeground);">
//             ⚠️ Empty Settings File Warning
//         </h3>
//         <p style="margin: 0 0 20px 0; color: var(--vscode-editor-foreground); line-height: 1.5;">
//             The current directory contains an empty <code>.code-counter.json</code> file that will be automatically removed when you change directories. 
//             <br><br>
//             <strong>Would you like to continue?</strong>
//         </p>
//         <div style="display: flex; gap: 10px; justify-content: flex-end;">
//             <button id="warningCancel" style="
//                 background: var(--vscode-button-secondaryBackground);
//                 color: var(--vscode-button-secondaryForeground);
//                 border: none;
//                 padding: 8px 16px;
//                 border-radius: 4px;
//                 cursor: pointer;
//             ">Cancel</button>
//             <button id="warningProceed" style="
//                 background: var(--vscode-inputValidation-warningBackground);
//                 color: var(--vscode-inputValidation-warningForeground);
//                 border: none;
//                 padding: 8px 16px;
//                 border-radius: 4px;
//                 cursor: pointer;
//             ">Continue & Remove File</button>
//         </div>
//     `;
    
//     modal.appendChild(dialog);
//     document.body.appendChild(modal);
    
//     // Handle button clicks
//     document.getElementById('warningCancel').onclick = () => {
//         document.body.removeChild(modal);
//     };
    
//     document.getElementById('warningProceed').onclick = () => {
//         document.body.removeChild(modal);
//         proceedWithDirectoryChange(targetDirectory);
//     };
    
//     // Close on background click
//     modal.onclick = (e) => {
//         if (e.target === modal) {
//             document.body.removeChild(modal);
//         }
//     };
// }


// Initialize workspace mode
function initializeWorkspaceMode() {
    const workspaceModeIndicator = document.getElementById('workspaceModeIndicator');
    
    if (window.workspaceData && window.workspaceData.currentDirectory !== '<global>') {
        document.body.classList.add('workspace-mode');
        if (workspaceModeIndicator) {
            workspaceModeIndicator.style.display = 'block';
        }
        updateWorkspaceVisualMode();
        initializeWorkspaceSettings();
    } else {
        document.body.classList.remove('workspace-mode');
        if (workspaceModeIndicator) {
            workspaceModeIndicator.style.display = 'none';
        }
        resetWorkspaceVisualMode();
    }
}

// Initialize workspace settings UI with current vs inherited values
function initializeWorkspaceSettings() {
    if (!window.workspaceData || !window.workspaceData.parentSettings) {
        return;
    }
    
    const currentSettings = window.workspaceData.currentSettings;
    const parentSettings = window.workspaceData.parentSettings;
    
    // Initialize emoji fields
    const lowEmojiEl = document.querySelector('[data-color-key="low"][data-type="file"]');
    const mediumEmojiEl = document.querySelector('[data-color-key="medium"][data-type="file"]');
    const highEmojiEl = document.querySelector('[data-color-key="high"][data-type="file"]');
    
    if (lowEmojiEl) {
        const resetBtn = lowEmojiEl.querySelector('.emoji-reset-btn');
        const currentEmojiValue = lowEmojiEl.textContent ? lowEmojiEl.textContent.trim() : '';
        const parentEmojiValue = parentSettings['codeCounter.emojis.normal'];
        
        // Only show reset button if this emoji is actually set in the current directory
        const isSetInCurrentDirectory = currentSettings && currentSettings['codeCounter.emojis.normal'] !== undefined;
        
        if (isSetInCurrentDirectory) {
            // Don't change the emoji if it's already set in DOM (user just selected it)
            if (!currentEmojiValue || currentEmojiValue === '?' || currentEmojiValue === parentEmojiValue) {
                lowEmojiEl.textContent = currentSettings['codeCounter.emojis.normal'];
            }
            lowEmojiEl.style.opacity = '1';
            lowEmojiEl.title = 'Custom value for this directory';
            if (resetBtn) resetBtn.style.display = 'flex';
        } else {
            lowEmojiEl.textContent = parentEmojiValue;
            lowEmojiEl.style.opacity = '0.6';
            lowEmojiEl.title = 'Inherited from parent settings';
            if (resetBtn) resetBtn.style.display = 'none';
        }
    }
    
    if (mediumEmojiEl) {
        const resetBtn = mediumEmojiEl.querySelector('.emoji-reset-btn');
        const currentEmojiValue = mediumEmojiEl.textContent ? mediumEmojiEl.textContent.trim() : '';
        const parentEmojiValue = parentSettings['codeCounter.emojis.warning'];
        
        // Only show reset button if this emoji is actually set in the current directory
        const isSetInCurrentDirectory = currentSettings && currentSettings['codeCounter.emojis.warning'] !== undefined;
        
        if (isSetInCurrentDirectory) {
            // Don't change the emoji if it's already set in DOM (user just selected it)
            if (!currentEmojiValue || currentEmojiValue === '?' || currentEmojiValue === parentEmojiValue) {
                mediumEmojiEl.textContent = currentSettings['codeCounter.emojis.warning'];
            }
            mediumEmojiEl.style.opacity = '1';
            mediumEmojiEl.title = 'Custom value for this directory';
            if (resetBtn) resetBtn.style.display = 'flex';
        } else {
            mediumEmojiEl.textContent = parentEmojiValue;
            mediumEmojiEl.style.opacity = '0.6';
            mediumEmojiEl.title = 'Inherited from parent settings';
            if (resetBtn) resetBtn.style.display = 'none';
        }
    }
    
    if (highEmojiEl) {
        const resetBtn = highEmojiEl.querySelector('.emoji-reset-btn');
        const currentEmojiValue = highEmojiEl.textContent ? highEmojiEl.textContent.trim() : '';
        const parentEmojiValue = parentSettings['codeCounter.emojis.danger'];
        
        // Only show reset button if this emoji is actually set in the current directory
        const isSetInCurrentDirectory = currentSettings && currentSettings['codeCounter.emojis.danger'] !== undefined;
        
        if (isSetInCurrentDirectory) {
            // Don't change the emoji if it's already set in DOM (user just selected it)
            if (!currentEmojiValue || currentEmojiValue === '?' || currentEmojiValue === parentEmojiValue) {
                highEmojiEl.textContent = currentSettings['codeCounter.emojis.danger'];
            }
            highEmojiEl.style.opacity = '1';
            highEmojiEl.title = 'Custom value for this directory';
            if (resetBtn) resetBtn.style.display = 'flex';
        } else {
            highEmojiEl.textContent = parentEmojiValue;
            highEmojiEl.style.opacity = '0.6';
            highEmojiEl.title = 'Inherited from parent settings';
            if (resetBtn) resetBtn.style.display = 'none';
        }
    }
    
    // Initialize folder emoji fields
    const lowFolderEmojiEl = document.querySelector('[data-color-key="low"][data-type="folder"]');
    const mediumFolderEmojiEl = document.querySelector('[data-color-key="medium"][data-type="folder"]');
    const highFolderEmojiEl = document.querySelector('[data-color-key="high"][data-type="folder"]');
    
    if (lowFolderEmojiEl) {
        const resetBtn = lowFolderEmojiEl.querySelector('.emoji-reset-btn');
        const currentEmojiValue = lowFolderEmojiEl.textContent ? lowFolderEmojiEl.textContent.trim() : '';
        const parentEmojiValue = parentSettings['codeCounter.emojis.folders.normal'];
        
        // Only show reset button if this emoji is actually set in the current directory
        const isSetInCurrentDirectory = currentSettings && currentSettings['codeCounter.emojis.folders.normal'] !== undefined;
        
        if (isSetInCurrentDirectory) {
            // Don't change the emoji if it's already set in DOM (user just selected it)
            if (!currentEmojiValue || currentEmojiValue === '?' || currentEmojiValue === parentEmojiValue) {
                lowFolderEmojiEl.textContent = currentSettings['codeCounter.emojis.folders.normal'];
            }
            lowFolderEmojiEl.style.opacity = '1';
            lowFolderEmojiEl.title = 'Custom value for this directory';
            if (resetBtn) resetBtn.style.display = 'flex';
        } else {
            lowFolderEmojiEl.textContent = parentEmojiValue;
            lowFolderEmojiEl.style.opacity = '0.6';
            lowFolderEmojiEl.title = 'Inherited from parent settings';
            if (resetBtn) resetBtn.style.display = 'none';
        }
    }
    
    if (mediumFolderEmojiEl) {
        const resetBtn = mediumFolderEmojiEl.querySelector('.emoji-reset-btn');
        const currentEmojiValue = mediumFolderEmojiEl.textContent ? mediumFolderEmojiEl.textContent.trim() : '';
        const parentEmojiValue = parentSettings['codeCounter.emojis.folders.warning'];
        
        // Only show reset button if this emoji is actually set in the current directory
        const isSetInCurrentDirectory = currentSettings && currentSettings['codeCounter.emojis.folders.warning'] !== undefined;
        
        if (isSetInCurrentDirectory) {
            // Don't change the emoji if it's already set in DOM (user just selected it)
            if (!currentEmojiValue || currentEmojiValue === '?' || currentEmojiValue === parentEmojiValue) {
                mediumFolderEmojiEl.textContent = currentSettings['codeCounter.emojis.folders.warning'];
            }
            mediumFolderEmojiEl.style.opacity = '1';
            mediumFolderEmojiEl.title = 'Custom value for this directory';
            if (resetBtn) resetBtn.style.display = 'flex';
        } else {
            mediumFolderEmojiEl.textContent = parentEmojiValue;
            mediumFolderEmojiEl.style.opacity = '0.6';
            mediumFolderEmojiEl.title = 'Inherited from parent settings';
            if (resetBtn) resetBtn.style.display = 'none';
        }
    }
    
    if (highFolderEmojiEl) {
        const resetBtn = highFolderEmojiEl.querySelector('.emoji-reset-btn');
        const currentEmojiValue = highFolderEmojiEl.textContent ? highFolderEmojiEl.textContent.trim() : '';
        const parentEmojiValue = parentSettings['codeCounter.emojis.folders.danger'];
        
        // Only show reset button if this emoji is actually set in the current directory
        const isSetInCurrentDirectory = currentSettings && currentSettings['codeCounter.emojis.folders.danger'] !== undefined;
        
        if (isSetInCurrentDirectory) {
            // Don't change the emoji if it's already set in DOM (user just selected it)
            if (!currentEmojiValue || currentEmojiValue === '?' || currentEmojiValue === parentEmojiValue) {
                highFolderEmojiEl.textContent = currentSettings['codeCounter.emojis.folders.danger'];
            }
            highFolderEmojiEl.style.opacity = '1';
            highFolderEmojiEl.title = 'Custom value for this directory';
            if (resetBtn) resetBtn.style.display = 'flex';
        } else {
            highFolderEmojiEl.textContent = parentEmojiValue;
            highFolderEmojiEl.style.opacity = '0.6';
            highFolderEmojiEl.title = 'Inherited from parent settings';
            if (resetBtn) resetBtn.style.display = 'none';
        }
    }
    
    // Initialize threshold fields
    const warningThresholdEl = document.getElementById('midThreshold');
    const dangerThresholdEl = document.getElementById('highThreshold');
    
    if (warningThresholdEl) {
        const resetBtn = document.querySelector('button[onclick*="resetField(event, \'threshold\', \'warning\')"]');
        const currentValue = warningThresholdEl.value;
        const parentValue = parentSettings['codeCounter.lineThresholds.midThreshold'];
        
        // Only show reset button if this threshold is actually set in the current directory
        const isSetInCurrentDirectory = currentSettings && currentSettings['codeCounter.lineThresholds.midThreshold'] !== undefined;
        
        if (isSetInCurrentDirectory) {
            // Don't change the value if it's already set in DOM (user just typed it)
            if (!currentValue || currentValue.trim() === '') {
                warningThresholdEl.value = currentSettings['codeCounter.lineThresholds.midThreshold'];
            }
            if (resetBtn) resetBtn.style.display = 'flex';
        } else {
            warningThresholdEl.value = '';
            warningThresholdEl.placeholder = `${parentValue}`;
            if (resetBtn) resetBtn.style.display = 'none';
        }
    }
    
    if (dangerThresholdEl) {
        const resetBtn = document.querySelector('button[onclick*="resetField(event, \'threshold\', \'danger\')"]');
        const currentValue = dangerThresholdEl.value;
        const parentValue = parentSettings['codeCounter.lineThresholds.highThreshold'];
        
        // Only show reset button if this threshold is actually set in the current directory
        const isSetInCurrentDirectory = currentSettings && currentSettings['codeCounter.lineThresholds.highThreshold'] !== undefined;
        
        if (isSetInCurrentDirectory) {
            // Don't change the value if it's already set in DOM (user just typed it)
            if (!currentValue || currentValue.trim() === '') {
                dangerThresholdEl.value = currentSettings['codeCounter.lineThresholds.highThreshold'];
            }
            if (resetBtn) resetBtn.style.display = 'flex';
        } else {
            dangerThresholdEl.value = '';
            dangerThresholdEl.placeholder = `${parentValue}`;
            if (resetBtn) resetBtn.style.display = 'none';
        }
    }
    
    // Initialize exclude patterns reset button visibility
    if (window.workspaceData && window.workspaceData.currentSettings && window.workspaceData.parentSettings) {
        const currentSettings = window.workspaceData.currentSettings;
        const parentSettings = window.workspaceData.parentSettings;
        
        // Check if exclude patterns are set in current directory
        const isSetInCurrentDirectory = currentSettings && currentSettings['codeCounter.excludePatterns'] !== undefined;
        const resetBtn = document.querySelector('button[onclick*="resetField"][onclick*="excludePatterns"]');
        
        if (resetBtn) {
            if (isSetInCurrentDirectory) {
                resetBtn.style.display = 'flex';
            } else {
                resetBtn.style.display = 'none';
            }
        }
    }
}

// Update visual styling based on workspace vs sub-workspace
function updateWorkspaceVisualMode() {
    const emojiContainer = document.getElementById('emojiSectionsContainer');
    const dynamicHeader = document.getElementById('dynamicWorkspaceHeader');
    
    if (!emojiContainer || !dynamicHeader || !window.workspaceData) return;
    
    // Remove existing classes
    emojiContainer.classList.remove('workspace-root', 'sub-workspace');
    dynamicHeader.classList.remove('workspace-root', 'sub-workspace');
    
    const currentDir = window.workspaceData.currentDirectory;
    const workspacePath = window.workspaceData.workspacePath;
    
    if (currentDir === '<workspace>' || currentDir === workspacePath) {
        // Root workspace settings
        emojiContainer.classList.add('workspace-root');
        dynamicHeader.classList.add('workspace-root');
        dynamicHeader.textContent = '📁 Workspace Root Settings';
        dynamicHeader.style.display = 'flex';
    } else {
        // Sub-workspace settings - show relative path
        emojiContainer.classList.add('sub-workspace');
        dynamicHeader.classList.add('sub-workspace');
        
        // Calculate relative path from workspace root
        let relativePath = currentDir;
        if (workspacePath && currentDir.startsWith(workspacePath)) {
            // Remove workspace path prefix and leading slash/backslash
            relativePath = currentDir.substring(workspacePath.length).replace(/^[\\\/]/, '');
        }
        
        dynamicHeader.textContent = `📂 Sub-workspace Settings: ${relativePath}`;
        dynamicHeader.style.display = 'flex';
    }
}

// Reset visual styling when not in workspace mode
function resetWorkspaceVisualMode() {
    const emojiContainer = document.getElementById('emojiSectionsContainer');
    const dynamicHeader = document.getElementById('dynamicWorkspaceHeader');
    
    if (emojiContainer) {
        emojiContainer.classList.remove('workspace-root', 'sub-workspace');
    }
    
    if (dynamicHeader) {
        dynamicHeader.classList.remove('workspace-root', 'sub-workspace');
        dynamicHeader.style.display = 'none';
        dynamicHeader.textContent = '';
    }
}

// Workspace settings functions
function createWorkspaceSettings() {
    vscode.postMessage({
        command: 'createWorkspaceSettings'
    });
}

function selectDirectory(directoryPath) {
    // Check if current directory has empty settings before changing
    // Skip empty settings check when switching TO global mode
    if (window.workspaceData && 
        window.workspaceData.currentDirectory !== '<global>' && 
        window.workspaceData.currentDirectory !== directoryPath &&
        directoryPath !== '<global>') {
        checkEmptySettingsBeforeChange(directoryPath);
    } else {
        // No need to check, proceed with directory change
        proceedWithDirectoryChange(directoryPath);
    }
}

function checkEmptySettingsBeforeChange(targetDirectory) {
    vscode.postMessage({
        command: 'checkEmptySettingsBeforeChange',
        currentDirectory: window.workspaceData ? window.workspaceData.currentDirectory : '<global>',
        targetDirectory: targetDirectory
    });
}

function proceedWithDirectoryChange(directoryPath) {
    const previousDirectory = window.workspaceData ? window.workspaceData.currentDirectory : '<global>';
    
    vscode.postMessage({
        command: 'selectDirectory',
        directoryPath: directoryPath,
        previousDirectory: previousDirectory
    });
    
    // Update visual mode immediately if workspaceData is available
    if (window.workspaceData) {
        window.workspaceData.currentDirectory = directoryPath;
        
        const workspaceModeIndicator = document.getElementById('workspaceModeIndicator');
        if (directoryPath === '<global>') {
            document.body.classList.remove('workspace-mode');
            if (workspaceModeIndicator) {
                workspaceModeIndicator.style.display = 'none';
            }
            resetWorkspaceVisualMode();
        } else {
            document.body.classList.add('workspace-mode');
            if (workspaceModeIndicator) {
                workspaceModeIndicator.style.display = 'block';
            }
            updateWorkspaceVisualMode();
        }
    }
}

function createSubWorkspace() {
    // Get the currently selected directory from workspaceData
    if (window.workspaceData && window.workspaceData.currentDirectory) {
        let relativePath = window.workspaceData.currentDirectory;
        if (relativePath === window.workspaceData.workspacePath) {
            // If workspace root is selected, we can't create sub-workspace here
            alert('Please select a subdirectory to create a sub-workspace');
            return;
        }
        
        // Convert absolute path to relative path
        relativePath = relativePath.replace(window.workspaceData.workspacePath, '').replace(/^[\\\/]/, '');
        
        vscode.postMessage({
            command: 'createSubWorkspace',
            directoryPath: relativePath
        });
    }
}

function saveWorkspaceSettings() {
    if (!window.workspaceData) return;
    
    // Collect current settings from the form
    const settings = {};
    
    // Get threshold values if they exist
    const warningThreshold = document.getElementById('midThreshold');
    const dangerThreshold = document.getElementById('highThreshold');
    
    if (warningThreshold && warningThreshold.value) {
        if (!settings.lineThresholds) settings.lineThresholds = {};
        settings.lineThresholds.warning = parseInt(warningThreshold.value, 10);
    }
    
    if (dangerThreshold && dangerThreshold.value) {
        if (!settings.lineThresholds) settings.lineThresholds = {};
        settings.lineThresholds.danger = parseInt(dangerThreshold.value, 10);
    }
    
    // Get emoji values if they're set
    const normalEmoji = document.querySelector('[data-color-key="low"][data-type="file"]');
    const warningEmoji = document.querySelector('[data-color-key="medium"][data-type="file"]');
    const dangerEmoji = document.querySelector('[data-color-key="high"][data-type="file"]');
    
    if (normalEmoji && normalEmoji.textContent) {
        if (!settings.emojis) settings.emojis = {};
        settings.emojis.normal = normalEmoji.textContent.trim();
    }
    
    if (warningEmoji && warningEmoji.textContent) {
        if (!settings.emojis) settings.emojis = {};
        settings.emojis.warning = warningEmoji.textContent.trim();
    }
    
    if (dangerEmoji && dangerEmoji.textContent) {
        if (!settings.emojis) settings.emojis = {};
        settings.emojis.danger = dangerEmoji.textContent.trim();
    }
    
    let directoryPath = window.workspaceData.currentDirectory;
    if (directoryPath === window.workspaceData.workspacePath) {
        directoryPath = '<workspace>';
    } else if (directoryPath !== '<global>') {
        directoryPath = directoryPath.replace(window.workspaceData.workspacePath, '').replace(/^[\\\/]/, '');
    }
    
    vscode.postMessage({
        command: 'saveWorkspaceSettings',
        directoryPath: directoryPath,
        settings: settings
    });
}

function resetField(event, fieldType, fieldKey) {
    // Prevent the click from bubbling up to the parent emoji container
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    // Reset a specific field to inherit from parent
    if (window.workspaceData && window.workspaceData.currentDirectory !== '<global>') {
        let fieldPath;
        
        if (fieldType === 'threshold') {
            if (fieldKey === 'warning') {
                fieldPath = 'lineThresholds.midThreshold';
                // Update UI to show it's been reset
                const input = document.getElementById('midThreshold');
                if (input && window.workspaceData && window.workspaceData.parentSettings) {
                    const parentValue = window.workspaceData.parentSettings['codeCounter.lineThresholds.midThreshold'];
                    input.value = '';
                    input.placeholder = `${parentValue}`;
                }
                // Hide the reset button since we're now inheriting
                const resetBtn = document.querySelector('button[onclick*="resetField(event, \'threshold\', \'warning\')"]');
                if (resetBtn) resetBtn.style.display = 'none';
            } else if (fieldKey === 'danger') {
                fieldPath = 'lineThresholds.highThreshold';
                // Update UI to show it's been reset
                const input = document.getElementById('highThreshold');
                if (input && window.workspaceData && window.workspaceData.parentSettings) {
                    const parentValue = window.workspaceData.parentSettings['codeCounter.lineThresholds.highThreshold'];
                    input.value = '';
                    input.placeholder = `${parentValue}`;
                }
                // Hide the reset button since we're now inheriting
                const resetBtn = document.querySelector('button[onclick*="resetField(event, \'threshold\', \'danger\')"]');
                if (resetBtn) resetBtn.style.display = 'none';
            }
        } else if (fieldType === 'emoji') {
            // Map field keys to config paths
            const emojiKeyMap = {
                'low': 'normal',
                'medium': 'warning',
                'high': 'danger'
            };
            fieldPath = `emojis.${emojiKeyMap[fieldKey]}`;
            
            // Update UI to show it's been reset to inherited state
            const fileEmojiDisplay = document.querySelector(`[data-color-key="${fieldKey}"][data-type="file"]`);
            if (fileEmojiDisplay && window.workspaceData && window.workspaceData.parentSettings) {
                const parentEmojiValue = window.workspaceData.parentSettings[`codeCounter.emojis.${emojiKeyMap[fieldKey]}`];
                
                // Display parent emoji with inherited styling
                fileEmojiDisplay.textContent = parentEmojiValue || '❓';
                fileEmojiDisplay.style.opacity = '0.6';
                fileEmojiDisplay.title = 'Inherited from parent settings';
                
                // Hide the reset button since we're now inheriting
                const resetBtn = fileEmojiDisplay.querySelector('.emoji-reset-btn');
                if (resetBtn) resetBtn.style.display = 'none';
            }
        } else if (fieldType === 'folderEmoji') {
            // Map field keys to config paths for folder emojis
            const emojiKeyMap = {
                'low': 'normal',
                'medium': 'warning', 
                'high': 'danger'
            };
            fieldPath = `emojis.folders.${emojiKeyMap[fieldKey]}`;
            
            // Update UI to show it's been reset to inherited state
            const folderEmojiDisplay = document.querySelector(`[data-color-key="${fieldKey}"][data-type="folder"]`);
            if (folderEmojiDisplay && window.workspaceData && window.workspaceData.parentSettings) {
                const parentEmojiValue = window.workspaceData.parentSettings[`codeCounter.emojis.folders.${emojiKeyMap[fieldKey]}`];
                
                // Display parent emoji with inherited styling
                folderEmojiDisplay.textContent = parentEmojiValue || '❓';
                folderEmojiDisplay.style.opacity = '0.6';
                folderEmojiDisplay.title = 'Inherited from parent settings';
                
                // Hide the reset button since we're now inheriting
                const resetBtn = folderEmojiDisplay.querySelector('.emoji-reset-btn');
                if (resetBtn) resetBtn.style.display = 'none';
            }
        } else if (fieldType === 'excludePatterns') {
            fieldPath = 'excludePatterns';
            
            // Clear the exclude patterns UI and hide reset button
            const patternsContainer = document.querySelector('.glob-patterns-container');
            if (patternsContainer) {
                patternsContainer.innerHTML = '';
            }
            
            // Hide the reset button since we're now inheriting
            const resetBtn = document.querySelector('button[onclick*="resetField"][title*="Reset to parent settings"]');
            if (resetBtn) resetBtn.style.display = 'none';
        }
        
        if (fieldPath) {
            // Use the resetWorkspaceField command to remove just this field
            vscode.postMessage({
                command: 'resetWorkspaceField',
                field: fieldPath,
                directory: window.workspaceData.currentDirectory
            });
        }
    }
}

//# sourceURL=emoji-picker.js