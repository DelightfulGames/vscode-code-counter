/**
 * VS Code Code Counter Extension - UI Handlers Module (STANDALONE VERSION)
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
function generateCSVFromTable_Standalone() {
    debug.info('STANDALONE: 📊 Starting manual CSV generation from table data...');
    
    if (!window.filesTable) {
        throw new Error('No table data available');
    }
    
    // Get all table data
    const data = window.filesTable.getData();
    debug.info(`STANDALONE: 📊 Found ${data.length} rows of data`);
    
    if (data.length === 0) {
        throw new Error('No data available in table');
    }
    
    // CSV Headers
    const headers = [
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
    let csv = headers.map(escapeCSVField_Standalone).join(',') + '\n';
    
    // Add data rows
    data.forEach((row, index) => {
        try {
            const csvRow = [
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
            
            csv += csvRow.map(escapeCSVField_Standalone).join(',') + '\n';
        } catch (rowError) {
            debug.error(`STANDALONE: ❌ Error processing row ${index}:`, rowError);
        }
    });
    
    debug.info(`STANDALONE: ✅ Generated CSV with ${data.length} rows`);
    return csv;
}

/**
 * Escape a field for CSV format (standalone version)
 */
function escapeCSVField_Standalone(field) {
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
 * Download CSV data as file (standalone version)
 */
function downloadCSV_Standalone() {
    try {
        debug.info('STANDALONE: 📊 Starting CSV download...');
        const csvData = generateCSVFromTable_Standalone();
        
        // Create blob and download
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', 'code-counter-report.csv');
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        debug.info('STANDALONE: ✅ CSV download completed');
    } catch (error) {
        debug.error('STANDALONE: ❌ CSV download failed:', error);
        alert('Failed to download CSV: ' + error.message);
    }
}

/**
 * Setup all button event handlers (standalone version)
 */
function setupUIHandlers_Standalone() {
    debug.info('STANDALONE: 🎮 Setting up UI handlers...');
    
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshBtn2 = document.getElementById('refresh-btn2');
    const exportBtn = document.getElementById('export-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const allExportCsvBtns = document.querySelectorAll('#export-csv-btn');
    const groupLanguageBtn = document.getElementById('group-language-btn');
    const groupDirectoryBtn = document.getElementById('group-directory-btn');
    const clearGroupBtn = document.getElementById('clear-group-btn');
    const clearAllFiltersBtn = document.getElementById('clear-all-filters-btn');
    
    // Clear All Filters button
    if (clearAllFiltersBtn) {
        clearAllFiltersBtn.addEventListener('click', () => {
            debug.info('STANDALONE: 🔄 Clear All Filters clicked');
            clearAllFilters_Standalone();
        });
    }
    
    // Refresh buttons - disabled in standalone
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            debug.info('STANDALONE: 🔄 Refresh button clicked (disabled in standalone)');
            alert('Refresh is not available in standalone reports. Please regenerate the report from VS Code.');
        });
    }
    
    if (refreshBtn2) {
        refreshBtn2.addEventListener('click', () => {
            debug.info('STANDALONE: 🔄 Refresh button clicked (disabled in standalone)');
            alert('Refresh is not available in standalone reports. Please regenerate the report from VS Code.');
        });
    }

    // Export buttons - disabled in standalone
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            debug.info('STANDALONE: 📄 Export HTML button clicked (disabled in standalone)');
            alert('HTML export is not available in standalone reports. This is already an exported HTML report.');
        });
    }

    // CSV Export - works in standalone via browser download
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            debug.info('STANDALONE: 📊 Export CSV button clicked');
            downloadCSV_Standalone();
        });
    } else {
        debug.warn('STANDALONE: ⚠️ Export CSV button not found in DOM');
    }

    // Handle all CSV export buttons (in case there are multiple)
    debug.info(`STANDALONE: 🔍 Found ${allExportCsvBtns.length} CSV export buttons`);
    allExportCsvBtns.forEach((btn, index) => {
        if (btn && btn !== exportCsvBtn) { // Avoid double-binding the main button
            btn.addEventListener('click', () => {
                debug.info(`STANDALONE: 📊 Export CSV button ${index + 1} clicked`);
                downloadCSV_Standalone();
            });
        }
    });

    // Grouping buttons
    if (groupLanguageBtn) {
        groupLanguageBtn.addEventListener('click', () => {
            debug.info('STANDALONE: 📂 Group by Language clicked');
            if (window.filesTable) {
                window.filesTable.setGroupBy("language");
                debug.info('STANDALONE: ✅ Grouped by language');
            }
        });
    }

    if (groupDirectoryBtn) {
        groupDirectoryBtn.addEventListener('click', () => {
            debug.info('STANDALONE: 📁 Group by Directory clicked');
            if (window.filesTable) {
                window.filesTable.setGroupBy("directory");
                debug.info('STANDALONE: ✅ Grouped by directory');
            }
        });
    }

    if (clearGroupBtn) {
        clearGroupBtn.addEventListener('click', () => {
            debug.info('STANDALONE: 📋 Clear Groups clicked');
            if (window.filesTable) {
                window.filesTable.setGroupBy(false);
                debug.info('STANDALONE: ✅ Groups cleared');
            }
        });
    }
    
    debug.info('STANDALONE: ✅ UI handlers setup completed');
}

/**
 * Clear all table filters and reset UI controls (standalone version)
 */
function clearAllFilters_Standalone() {
    // Clear all table filters
    if (window.filesTable) {
        window.filesTable.clearFilter();
        debug.info('STANDALONE: ✅ All table filters cleared');
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
    
    debug.info('STANDALONE: ✅ All UI filter controls reset');
}

/**
 * Handle file opening - disabled in standalone
 */
function openFileInVSCode_Standalone(filePath) {
    debug.info('STANDALONE: 🔗 File open requested (disabled in standalone):', filePath);
    alert('File opening is not available in standalone reports. Please use this report from within VS Code to open files.');
}

/**
 * Handle messages from VS Code extension - disabled in standalone
 */
function handleExtensionMessages_Standalone() {
    debug.info('STANDALONE: 📨 Extension message handling disabled in standalone mode');
    // No message handling needed for standalone reports
}

/**
 * Utility function to format file sizes (standalone version)
 */
function formatFileSize_Standalone(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Alias standalone functions to match expected names for compatibility
const generateCSVFromTable = generateCSVFromTable_Standalone;
const escapeCSVField = escapeCSVField_Standalone;
const setupUIHandlers = setupUIHandlers_Standalone;
const clearAllFilters = clearAllFilters_Standalone;
const openFileInVSCode = openFileInVSCode_Standalone;
const handleExtensionMessages = handleExtensionMessages_Standalone;
const formatFileSize = formatFileSize_Standalone;

//# sourceURL=ui-handlers-standalone.js