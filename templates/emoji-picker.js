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
    }
    
    // Send update to VS Code
    vscode.postMessage({
        command: 'updateEmoji',
        colorKey: currentColorKey,
        type: currentEmojiType,
        emoji: emoji
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
        vscode.postMessage({
            command: 'addGlobPattern',
            pattern: pattern
        });
        input.value = '';
    }
}

function removePattern(pattern) {
    vscode.postMessage({
        command: 'removeGlobPattern',
        pattern: pattern
    });
}

function resetPatterns() {
    vscode.postMessage({
        command: 'resetGlobPatterns'
    });
}

function resetEmojis() {
    vscode.postMessage({
        command: 'resetEmoji'
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
    
    vscode.postMessage({
        command: 'updateThreshold',
        thresholdKey: thresholdKey,
        value: numValue
    });
}

document.addEventListener('DOMContentLoaded', function() {
    const newPatternInput = document.getElementById('newPattern');
    newPatternInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addPattern();
        }
    });
    
    // Initialize workspace mode
    initializeWorkspaceMode();
    
    // Listen for messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        
        if (message.command === 'emptySettingsCheckResult') {
            // if (message.hasEmptySettings) {
            //     showEmptySettingsWarning(message.targetDirectory);
            // } else {
            proceedWithDirectoryChange(message.targetDirectory);
            //}
        }
    });
});

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
    if (!window.workspaceData || !window.workspaceData.currentSettings || !window.workspaceData.parentSettings) {
        return;
    }
    
    const currentSettings = window.workspaceData.currentSettings;
    const parentSettings = window.workspaceData.parentSettings;
    
    // Initialize emoji fields
    const lowEmojiEl = document.querySelector('[data-color-key="low"][data-type="file"]');
    const mediumEmojiEl = document.querySelector('[data-color-key="medium"][data-type="file"]');
    const highEmojiEl = document.querySelector('[data-color-key="high"][data-type="file"]');
    
    if (lowEmojiEl) {
        if (currentSettings.emojis && currentSettings.emojis.normal !== undefined) {
            lowEmojiEl.textContent = currentSettings.emojis.normal;
        } else {
            lowEmojiEl.textContent = parentSettings.emojis.normal;
            lowEmojiEl.style.opacity = '0.6';
            lowEmojiEl.title = 'Inherited from parent settings';
        }
    }
    
    if (mediumEmojiEl) {
        if (currentSettings.emojis && currentSettings.emojis.warning !== undefined) {
            mediumEmojiEl.textContent = currentSettings.emojis.warning;
        } else {
            mediumEmojiEl.textContent = parentSettings.emojis.warning;
            mediumEmojiEl.style.opacity = '0.6';
            mediumEmojiEl.title = 'Inherited from parent settings';
        }
    }
    
    if (highEmojiEl) {
        if (currentSettings.emojis && currentSettings.emojis.danger !== undefined) {
            highEmojiEl.textContent = currentSettings.emojis.danger;
        } else {
            highEmojiEl.textContent = parentSettings.emojis.danger;
            highEmojiEl.style.opacity = '0.6';
            highEmojiEl.title = 'Inherited from parent settings';
        }
    }
    
    // Initialize threshold fields
    const warningThresholdEl = document.getElementById('midThreshold');
    const dangerThresholdEl = document.getElementById('highThreshold');
    
    if (warningThresholdEl) {
        if (currentSettings.lineThresholds && currentSettings.lineThresholds.warning !== undefined) {
            warningThresholdEl.value = currentSettings.lineThresholds.warning;
        } else {
            warningThresholdEl.value = '';
            warningThresholdEl.placeholder = `${parentSettings.lineThresholds.warning} (inherited)`;
        }
    }
    
    if (dangerThresholdEl) {
        if (currentSettings.lineThresholds && currentSettings.lineThresholds.danger !== undefined) {
            dangerThresholdEl.value = currentSettings.lineThresholds.danger;
        } else {
            dangerThresholdEl.value = '';
            dangerThresholdEl.placeholder = `${parentSettings.lineThresholds.danger} (inherited)`;
        }
    }
}

// Update visual styling based on workspace vs sub-workspace
function updateWorkspaceVisualMode() {
    const emojiContainer = document.getElementById('emojiSectionsContainer');
    if (!emojiContainer || !window.workspaceData) return;
    
    // Remove existing classes
    emojiContainer.classList.remove('workspace-root', 'sub-workspace');
    
    const currentDir = window.workspaceData.currentDirectory;
    const workspacePath = window.workspaceData.workspacePath;
    
    if (currentDir === '<workspace>' || currentDir === workspacePath) {
        // Root workspace settings
        emojiContainer.classList.add('workspace-root');
    } else {
        // Sub-workspace settings
        emojiContainer.classList.add('sub-workspace');
    }
}

// Reset visual styling when not in workspace mode
function resetWorkspaceVisualMode() {
    const emojiContainer = document.getElementById('emojiSectionsContainer');
    if (emojiContainer) {
        emojiContainer.classList.remove('workspace-root', 'sub-workspace');
    }
}

// Reset field to parent value
function resetField(fieldPath) {
    if (!window.workspaceData) return;
    
    vscode.postMessage({
        command: 'resetWorkspaceField',
        field: fieldPath,
        directory: window.workspaceData.currentDirectory
    });
}

// Workspace settings functions
function createWorkspaceSettings() {
    vscode.postMessage({
        command: 'createWorkspaceSettings'
    });
}

function selectDirectory(directoryPath) {
    // Check if current directory has empty settings before changing
    if (window.workspaceData && window.workspaceData.currentDirectory !== '<global>' && window.workspaceData.currentDirectory !== directoryPath) {
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
        if (window.workspaceData && previousDirectory === '<workspace>') {
            document.body.classList.remove('workspace-mode');
            if (workspaceModeIndicator) {
                workspaceModeIndicator.style.display = 'none';
            }
            resetWorkspaceVisualMode();
            selectDirectory('<global>');
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

function resetField(fieldType, fieldKey) {
    // Reset a specific field to inherit from parent
    if (window.workspaceData && window.workspaceData.currentDirectory !== '<global>') {
        const settings = {};
        
        if (fieldType === 'threshold') {
            settings.lineThresholds = {};
            if (fieldKey === 'warning') {
                // Remove warning threshold to inherit
                const input = document.getElementById('midThreshold');
                if (input) {
                    input.value = '';
                    input.placeholder = 'Inherited';
                }
            } else if (fieldKey === 'danger') {
                // Remove danger threshold to inherit
                const input = document.getElementById('highThreshold');
                if (input) {
                    input.value = '';
                    input.placeholder = 'Inherited';
                }
            }
        } else if (fieldType === 'emoji') {
            settings.emojis = {};
            const emojiDisplay = document.querySelector(`[data-color-key="${fieldKey}"][data-type="file"]`);
            if (emojiDisplay) {
                emojiDisplay.textContent = '?'; // Show as unset
            }
        }
        
        // Save the settings with the removed field
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
}

//# sourceURL=emoji-picker.js