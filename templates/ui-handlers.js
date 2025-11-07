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
 * Generate CSV data from table without using Tabulator's download method
 */
function generateCSVFromTable() {
    debug.info('📊 Starting manual CSV generation from table data...');
    
    if (!window.filesTable) {
        throw new Error('No table data available');
    }
    
    // Get all table data
    const data = window.filesTable.getData();
    debug.info(`📊 Found ${data.length} rows of data`);
    
    if (data.length === 0) {
        throw new Error('No data available in table');
    }
    
    // Get generation timestamp from global report data
    const generatedAt = reportData && reportData.generatedDate ? reportData.generatedDate : new Date().toISOString();
    debug.info(`📅 Using generated date: ${generatedAt}`);
    
    // CSV Headers
    const headers = [
        'Generated At',
        'Directory',
        'File Name', 
        'Language',
        'Total Lines',
        'Code Lines',
        'Comment Lines',
        'Blank Lines',
        'Comment Ratio (%)',
        'Size (KB)'
    ];
    
    // Start building CSV
    let csv = headers.map(escapeCSVField).join(',') + '\n';
    
    // Add data rows
    data.forEach((row, index) => {
        try {
            const csvRow = [
                generatedAt,
                row.directory || '',
                row.fileName || '',
                row.language || '',
                row.lines || 0,
                row.codeLines || 0,
                row.commentLines || 0,
                row.blankLines || 0,
                row.commentRatio || 0,
                row.sizeKB || 0
            ];
            
            csv += csvRow.map(escapeCSVField).join(',') + '\n';
        } catch (rowError) {
            debug.error(`❌ Error processing row ${index}:`, rowError);
        }
    });
    
    debug.info(`✅ Generated CSV with ${data.length} rows`);
    return csv;
}

/**
 * Escape a field for CSV format
 */
function escapeCSVField(field) {
    if (field === null || field === undefined) {
        return '';
    }
    
    const stringField = String(field);
    
    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n') || stringField.includes('\r')) {
        return '"' + stringField.replace(/"/g, '""') + '"';
    }
    
    return stringField;
}

/**
 * Setup all button event handlers
 */
function setupUIHandlers() {
    debug.info('🎮 Setting up UI handlers...');
    
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshBtn2 = document.getElementById('refresh-btn2');
    const exportBtn = document.getElementById('export-btn');
    const groupLanguageBtn = document.getElementById('group-language-btn');
    const groupDirectoryBtn = document.getElementById('group-directory-btn');
    const clearGroupBtn = document.getElementById('clear-group-btn');
    const clearAllFiltersBtn = document.getElementById('clear-all-filters-btn');
    
    // Setup export dropdowns
    setupExportDropdowns();
    
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
 * Setup export dropdown functionality
 */
function setupExportDropdowns() {
    debug.info('📊 Setting up export dropdown handlers...');
    
    // Get all export dropdown buttons
    const dropdownBtns = document.querySelectorAll('.export-dropdown-btn');
    const dropdowns = document.querySelectorAll('.export-dropdown');
    
    // Setup dropdown toggle behavior
    dropdownBtns.forEach((btn, index) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = btn.closest('.export-dropdown');
            
            // Close all other dropdowns
            dropdowns.forEach(dd => {
                if (dd !== dropdown) {
                    dd.classList.remove('show');
                }
            });
            
            // Toggle current dropdown
            dropdown.classList.toggle('show');
            debug.info(`📊 Export dropdown ${index + 1} toggled`);
        });
    });
    
    // Setup export option handlers
    const exportOptions = document.querySelectorAll('.export-dropdown-content a');
    exportOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const exportType = option.getAttribute('data-export');
            const dropdown = option.closest('.export-dropdown');
            
            // Close dropdown
            dropdown.classList.remove('show');
            
            // Handle export
            handleExport(exportType);
        });
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        dropdowns.forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    });
    
    debug.info(`✅ Export dropdowns setup complete: ${dropdownBtns.length} buttons, ${exportOptions.length} options`);
}

/**
 * Handle export actions
 */
function handleExport(exportType) {
    debug.info(`📊 Export ${exportType} requested`);
    
    switch (exportType) {
        case 'csv':
            // Use the existing CSV export logic
            vscode.postMessage({ command: 'saveCSV' });
            break;
        case 'json':
            vscode.postMessage({ command: 'exportJSON' });
            break;
        case 'xml':
            vscode.postMessage({ command: 'exportXML' });
            break;
        case 'all':
            vscode.postMessage({ command: 'exportAll' });
            break;
        default:
            debug.error('❌ Unknown export type:', exportType);
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