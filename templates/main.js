/**
 * VS Code Code Counter Extension - Main Entry Point
 * 
 * Copyright (c) 2025 DelightfulGames
 * Licensed under the MIT License
 * 
 * Repository: https://github.com/DelightfulGames/vscode-code-counter
 * Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
 */

document.addEventListener('DOMContentLoaded', function() {
    const newPatternInput = document.getElementById('newPattern');
    if (newPatternInput) {
        newPatternInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addPattern();
            }
        });
    }
    
    // Initialize workspace mode (with small delay to ensure DOM is fully updated)
    setTimeout(initializeWorkspaceMode, 500);
    
    // Initialize debug service dropdowns
    initializeDebugService();
    
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
        } else if (message.command === 'updateOutputDirectoryField') {
            // Update the output directory input field
            const outputDirectoryInput = document.getElementById('outputDirectory');
            if (outputDirectoryInput) {
                outputDirectoryInput.value = message.directory;
            }
        }
    });
});

//# sourceURL=main.js