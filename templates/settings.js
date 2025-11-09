/**
 * VS Code Code Counter Extension - Settings Module
 * 
 * Copyright (c) 2025 DelightfulGames
 * Licensed under the MIT License
 * 
 * Repository: https://github.com/DelightfulGames/vscode-code-counter
 * Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
 */

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
    if (isEnabled === null || isEnabled === undefined) {
        debug.warning('updateNotificationSetting called with null/undefined parameter:', isEnabled);
        isEnabled = false; // Default to false if null/undefined
    }
    vscode.postMessage({
        command: 'updateNotificationSetting',
        enabled: Boolean(isEnabled)
    });
}

function updateDebugService() {
    const backendSelect = document.getElementById('debugBackend');
    
    if (!backendSelect) {
        debug.error('Debug service control not found');
        return;
    }
    
    const backend = backendSelect.value;
    
    // Show/hide file link based on selection
    const fileLinkContainer = document.getElementById('debugFileLink');
    if (fileLinkContainer) {
        fileLinkContainer.style.display = backend === 'file' ? 'block' : 'none';
    }

    // Show/hide instructions based on backend
    const developerToolsInstructions = document.getElementById('backend-developer-tools');
    const fileInstructions = document.getElementById('backend-file');

    if (developerToolsInstructions) {
        developerToolsInstructions.style.display = backend === 'console' ? 'inline' : 'none';
    }
    if (fileInstructions) {
        fileInstructions.style.display = backend === 'file' ? 'inline' : 'none';
    }

    vscode.postMessage({
        command: 'configureDebugService',
        backend: backend,
    });
}

function openDebugLogFile() {
    vscode.postMessage({
        command: 'openDebugLogFile'
    });
}

function initializeDebugService() {
    const backendSelect = document.getElementById('debugBackend');
    
    if (backendSelect) {
        // Note: Initial value is set from VS Code configuration via template replacement
        // Set up automatic saving when changed
        backendSelect.addEventListener('change', updateDebugService);
        
        // Set initial display state for file link
        const fileLinkContainer = document.getElementById('debugFileLink');
        if (fileLinkContainer) {
            fileLinkContainer.style.display = backendSelect.value === 'file' ? 'block' : 'none';
        }
    }
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

// Update output directory setting
function updateOutputDirectory(value) {
    vscode.postMessage({
        command: 'updateOutputDirectory',
        directory: value || '.vscode/code-counter/reports'
    });
}

// Browse for output directory
function browseOutputDirectory() {
    vscode.postMessage({
        command: 'browseOutputDirectory'
    });
}

// Update auto-generate setting
function updateAutoGenerate(enabled) {
    vscode.postMessage({
        command: 'updateAutoGenerate',
        enabled: enabled
    });
}

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

/**
 * Filter directories based on the dropdown selection
 */
function filterDirectories(filterType) {
    const containers = document.querySelectorAll('.directory-container');
    
    containers.forEach(container => {
        const isHidden = container.classList.contains('hidden-directory');
        const isActive = container.getAttribute('data-has-settings') === 'true';
        
        let shouldShow = false;
        
        switch (filterType) {
            case 'all':
                shouldShow = !isHidden;
                break;
            case 'all-hidden':
                shouldShow = true;
                break;
            case 'active':
                shouldShow = isActive || hasActiveChildren(container);
                break;
        }
        
        container.style.display = shouldShow ? 'block' : 'none';
        
        // Also hide/show parent directories if needed for active filter
        if (filterType === 'active' && isActive) {
            showParentDirectories(container);
        }
    });
}

/**
 * Check if a directory container has any children with settings
 */
function hasActiveChildren(container) {
    const childContainers = container.querySelectorAll('.directory-container');
    return Array.from(childContainers).some(child => 
        child.getAttribute('data-has-settings') === 'true'
    );
}

/**
 * Show parent directories for active filter
 */
function showParentDirectories(container) {
    let parent = container.parentElement;
    while (parent && parent.classList.contains('directory-children')) {
        const parentContainer = parent.parentElement;
        if (parentContainer && parentContainer.classList.contains('directory-container')) {
            parentContainer.style.display = 'block';
            parent = parentContainer.parentElement;
        } else {
            break;
        }
    }
}

/**
 * Toggle directory expansion/collapse
 */
function toggleDirectory(event, glyph) {
    event.stopPropagation();
    
    const container = glyph.closest('.directory-container');
    const childrenDiv = container.querySelector('.directory-children');
    
    if (childrenDiv) {
        const isExpanded = childrenDiv.style.display !== 'none';
        childrenDiv.style.display = isExpanded ? 'none' : 'block';
        glyph.textContent = isExpanded ? '▶' : '▼';
    }
}

/**
 * Expand all directories
 */
function expandAllDirectories() {
    const glyphs = document.querySelectorAll('.expand-glyph');
    const childrenDivs = document.querySelectorAll('.directory-children');
    
    glyphs.forEach(glyph => {
        glyph.textContent = '▼';
    });
    
    childrenDivs.forEach(div => {
        div.style.display = 'block';
    });
}

/**
 * Collapse all directories
 */
function collapseAllDirectories() {
    const glyphs = document.querySelectorAll('.expand-glyph');
    const childrenDivs = document.querySelectorAll('.directory-children');
    
    glyphs.forEach(glyph => {
        glyph.textContent = '▶';
    });
    
    childrenDivs.forEach(div => {
        div.style.display = 'none';
    });
}

/**
 * Initialize directory tree with default settings
 */
function initializeDirectoryTree() {
    // Set default filter to "All" and apply it
    const filterDropdown = document.getElementById('directoryFilter');
    if (filterDropdown) {
        filterDropdown.value = 'all';
        filterDirectories('all');
    }
    
    // Initialize with all directories collapsed
    collapseAllDirectories();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeDirectoryTree();
});

// Also initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
    // Do nothing, DOMContentLoaded will handle it
} else {
    // DOM is already loaded
    initializeDirectoryTree();
}

//# sourceURL=settings.js