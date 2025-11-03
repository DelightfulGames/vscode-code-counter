/**
 * VS Code Code Counter Extension - UI Handlers Module
 * 
 * Copyright (c) 2025 DelightfulGames
 * Licensed under the MIT License
 * 
 * Repository: https://github.com/DelightfulGames/vscode-code-counter
 * Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
 */

/**
 * Setup all button event handlers
 */
function setupUIHandlers() {
    debug.info('🎮 Setting up UI handlers...');
    
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshBtn2 = document.getElementById('refresh-btn2');
    const exportBtn = document.getElementById('export-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const groupLanguageBtn = document.getElementById('group-language-btn');
    const groupDirectoryBtn = document.getElementById('group-directory-btn');
    const clearGroupBtn = document.getElementById('clear-group-btn');
    const clearAllFiltersBtn = document.getElementById('clear-all-filters-btn');
    
    // Clear All Filters button
    if (clearAllFiltersBtn) {
        clearAllFiltersBtn.addEventListener('click', () => {
            debug.info('🔄 Clear All Filters clicked');
            clearAllFilters();
        });
    }
    
    // Refresh buttons
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            debug.info('🔄 Refresh button clicked');
            vscode.postMessage({ command: 'refresh' });
        });
    }
    
    if (refreshBtn2) {
        refreshBtn2.addEventListener('click', () => {
            debug.info('🔄 Refresh button clicked');
            vscode.postMessage({ command: 'refresh' });
        });
    }

    // Export buttons
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            debug.info('📄 Export HTML button clicked');
            vscode.postMessage({ command: 'export' });
        });
    }

    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            debug.info('📊 Export CSV button clicked');
            if (window.filesTable) {
                window.filesTable.download("csv", "code-counter-report.csv");
                debug.info('✅ CSV download initiated');
            }
        });
    }

    // Grouping buttons
    if (groupLanguageBtn) {
        groupLanguageBtn.addEventListener('click', () => {
            debug.info('📂 Group by Language clicked');
            if (window.filesTable) {
                window.filesTable.setGroupBy("language");
                debug.info('✅ Grouped by language');
            }
        });
    }

    if (groupDirectoryBtn) {
        groupDirectoryBtn.addEventListener('click', () => {
            debug.info('📁 Group by Directory clicked');
            if (window.filesTable) {
                window.filesTable.setGroupBy("directory");
                debug.info('✅ Grouped by directory');
            }
        });
    }

    if (clearGroupBtn) {
        clearGroupBtn.addEventListener('click', () => {
            debug.info('📋 Clear Groups clicked');
            if (window.filesTable) {
                window.filesTable.setGroupBy(false);
                debug.info('✅ Groups cleared');
            }
        });
    }
    
    debug.info('✅ UI handlers setup completed');
}

/**
 * Clear all table filters and reset UI controls
 */
function clearAllFilters() {
    // Clear all table filters
    if (window.filesTable) {
        window.filesTable.clearFilter();
        debug.info('✅ All table filters cleared');
    }
    
    // Reset UI filter controls
    const fileSearch = document.getElementById('file-search-tabulator');
    const languageFilter = document.getElementById('language-filter-tabulator');
    const linesMin = document.getElementById('lines-min');
    const linesMax = document.getElementById('lines-max');
    const sizeMin = document.getElementById('size-min');
    const sizeMax = document.getElementById('size-max');
    
    if (fileSearch) fileSearch.value = '';
    if (languageFilter) languageFilter.value = '';
    if (linesMin) linesMin.value = '';
    if (linesMax) linesMax.value = '';
    if (sizeMin) sizeMin.value = '';
    if (sizeMax) sizeMax.value = '';
    
    debug.info('✅ All UI filter controls reset');
}

/**
 * Handle file opening in VS Code
 */
function openFileInVSCode(filePath) {
    debug.info('🔗 Opening file in VS Code:', filePath);
    try {
        vscode.postMessage({
            command: 'openFile',
            filePath: filePath
        });
        debug.info('✅ Open file command sent to VS Code');
    } catch (error) {
        debug.error('❌ Failed to send open file command:', error);
    }
}

/**
 * Handle messages from VS Code extension
 */
function handleExtensionMessages() {
    window.addEventListener('message', event => {
        const message = event.data;
        debug.info('📨 Received message from extension:', message);
        
        switch (message.command) {
            case 'updateData':
                updateReportData(message.data);
                break;
            default:
                debug.info('ℹ️ Unknown message command:', message.command);
        }
    });
}

/**
 * Utility function to format file sizes
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

//# sourceURL=ui-handlers.js