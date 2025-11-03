/**
 * VS Code Code Counter Extension - WebView Report Main Module
 * 
 * Copyright (c) 2025 DelightfulGames
 * Licensed under the MIT License
 * 
 * Repository: https://github.com/DelightfulGames/vscode-code-counter
 * Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
 */

// Note: This file requires the following modules to be loaded in order:
// 1. core.js (VS Code API and debug functionality)
// 2. data-manager.js (Data parsing and management)
// 3. ui-handlers.js (UI event handlers)
// 4. tabulator-manager.js (Table initialization)
// 5. filter-manager.js (Advanced filtering)

// Embedded JSON data placeholder (replaced by template engine)
const embeddedJsonData = '{{JSON_DATA}}';

// Main initialization
debug.info('🌐 WebView modular script loaded');
debug.info('📊 Embedded JSON data available:', !!embeddedJsonData && embeddedJsonData !== '{{JSON_DATA}}');

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    debug.info('🚀 DOM ready, starting modular initialization...');
    
    try {
        // Parse embedded data
        const reportData = parseEmbeddedData();
        
        if (reportData) {
            debug.info('📊 Report data available, initializing modules...');
            
            // Initialize all modules
            initializeReport(reportData);
            setupUIHandlers();
            handleExtensionMessages();
            
            debug.info('🎉 Modular webview initialization completed successfully');
        } else {
            debug.error('❌ No report data available');
            showError('No report data available');
        }
    } catch (error) {
        debug.error('❌ Failed to initialize modular webview:', error);
        showError('Failed to initialize report: ' + error.message);
    }
});

//# sourceURL=webview-report.js