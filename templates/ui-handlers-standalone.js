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
    
    // Get generation timestamp from global report data
    const generatedAt = reportData && reportData.generatedDate ? reportData.generatedDate : new Date().toISOString();
    debug.info(`STANDALONE: 📅 Using generated date: ${generatedAt}`);
    
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
    let csv = headers.map(escapeCSVField_Standalone).join(',') + '\n';
    
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
 * Generate JSON from table data (standalone version)
 */
function generateJSONFromTable_Standalone() {
    debug.info('STANDALONE: 📄 Starting JSON generation from table data...');
    
    if (!window.filesTable) {
        throw new Error('No table data available');
    }
    
    // Get all table data
    const data = window.filesTable.getData();
    debug.info(`STANDALONE: 📄 Found ${data.length} rows of data`);
    
    if (data.length === 0) {
        throw new Error('No data available in table');
    }
    
    // Get generation timestamp from global report data
    const generatedAt = reportData && reportData.generatedDate ? reportData.generatedDate : new Date().toISOString();
    
    // Create simplified JSON structure
    const jsonData = {
        metadata: {
            generatedAt: generatedAt,
            version: "1.0.0",
            description: "Code Counter Report Export"
        },
        files: data.map(row => ({
            directory: row.directory || '',
            fileName: row.fileName || '',
            language: row.language || '',
            lines: row.lines || 0,
            codeLines: row.codeLines || 0,
            commentLines: row.commentLines || 0,
            blankLines: row.blankLines || 0,
            commentRatio: row.commentRatio || 0,
            sizeKB: row.sizeKB || 0
        }))
    };
    
    debug.info(`STANDALONE: ✅ Generated JSON with ${data.length} files`);
    return JSON.stringify(jsonData, null, 2);
}

/**
 * Generate XML from table data (standalone version)
 */
function generateXMLFromTable_Standalone() {
    debug.info('STANDALONE: 📄 Starting XML generation from table data...');
    
    if (!window.filesTable) {
        throw new Error('No table data available');
    }
    
    // Get all table data
    const data = window.filesTable.getData();
    debug.info(`STANDALONE: 📄 Found ${data.length} rows of data`);
    
    if (data.length === 0) {
        throw new Error('No data available in table');
    }
    
    // Get generation timestamp from global report data
    const generatedAt = reportData && reportData.generatedDate ? reportData.generatedDate : new Date().toISOString();
    
    // Create XML structure
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<codeCounterReport>\n';
    xml += '  <metadata>\n';
    xml += `    <generatedAt>${escapeXML_Standalone(generatedAt)}</generatedAt>\n`;
    xml += '    <version>1.0.0</version>\n';
    xml += '    <description>Code Counter Report Export</description>\n';
    xml += '  </metadata>\n';
    xml += '  <files>\n';
    
    data.forEach(row => {
        xml += '    <file>\n';
        xml += `      <directory>${escapeXML_Standalone(row.directory || '')}</directory>\n`;
        xml += `      <fileName>${escapeXML_Standalone(row.fileName || '')}</fileName>\n`;
        xml += `      <language>${escapeXML_Standalone(row.language || '')}</language>\n`;
        xml += `      <lines>${row.lines || 0}</lines>\n`;
        xml += `      <codeLines>${row.codeLines || 0}</codeLines>\n`;
        xml += `      <commentLines>${row.commentLines || 0}</commentLines>\n`;
        xml += `      <blankLines>${row.blankLines || 0}</blankLines>\n`;
        xml += `      <commentRatio>${row.commentRatio || 0}</commentRatio>\n`;
        xml += `      <sizeKB>${row.sizeKB || 0}</sizeKB>\n`;
        xml += '    </file>\n';
    });
    
    xml += '  </files>\n';
    xml += '</codeCounterReport>\n';
    
    debug.info(`STANDALONE: ✅ Generated XML with ${data.length} files`);
    return xml;
}

/**
 * Escape XML special characters (standalone version)
 */
function escapeXML_Standalone(text) {
    if (text === null || text === undefined) {
        return '';
    }
    
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
 * Download JSON report (standalone version)
 */
function downloadJSON_Standalone() {
    try {
        debug.info('STANDALONE: 📄 Starting JSON download...');
        const jsonData = generateJSONFromTable_Standalone();
        
        // Create blob and download
        const blob = new Blob([jsonData], { type: 'application/json;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', 'code-counter-report.json');
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        debug.info('STANDALONE: ✅ JSON download completed');
    } catch (error) {
        debug.error('STANDALONE: ❌ JSON download failed:', error);
        alert('Failed to download JSON: ' + error.message);
    }
}

/**
 * Download XML report (standalone version)
 */
function downloadXML_Standalone() {
    try {
        debug.info('STANDALONE: 📄 Starting XML download...');
        const xmlData = generateXMLFromTable_Standalone();
        
        // Create blob and download
        const blob = new Blob([xmlData], { type: 'application/xml;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', 'code-counter-report.xml');
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        debug.info('STANDALONE: ✅ XML download completed');
    } catch (error) {
        debug.error('STANDALONE: ❌ XML download failed:', error);
        alert('Failed to download XML: ' + error.message);
    }
}

/**
 * Download all formats (standalone version)
 */
function downloadAll_Standalone() {
    try {
        debug.info('STANDALONE: 📦 Starting download of all formats...');
        
        // Download each format with a small delay
        downloadCSV_Standalone();
        
        setTimeout(() => {
            downloadJSON_Standalone();
        }, 500);
        
        setTimeout(() => {
            downloadXML_Standalone();
        }, 1000);
        
        debug.info('STANDALONE: ✅ All formats download initiated');
    } catch (error) {
        debug.error('STANDALONE: ❌ Download all formats failed:', error);
        alert('Failed to download all formats: ' + error.message);
    }
}

// Guard variable to prevent multiple initializations
let dropdownsInitialized = false;
let uiHandlersInitialized = false;

/**
 * Setup export dropdown functionality (standalone version)
 */
function setupExportDropdowns_Standalone() {
    console.log('STANDALONE: setupExportDropdowns_Standalone called!');
    
    // Prevent multiple initializations
    if (dropdownsInitialized) {
        debug.info('STANDALONE: 🔒 Export dropdowns already initialized, skipping...');
        return;
    }
    
    debug.info('STANDALONE: 🎮 Setting up export dropdown handlers...');
    
    // Setup dropdown toggle functionality
    const dropdownBtns = document.querySelectorAll('.export-dropdown-btn');
    debug.info(`STANDALONE: 🔍 Found ${dropdownBtns.length} dropdown buttons`);
    dropdownBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            debug.info('STANDALONE: 🖱️ Export dropdown button clicked!');
            e.stopPropagation();
            const dropdown = this.parentElement;
            const dropdownContent = dropdown.querySelector('.export-dropdown-content');
            
            // Toggle current dropdown
            if (dropdownContent.classList.contains('show')) {
                console.log('STANDALONE: Hiding dropdown');
                dropdownContent.classList.remove('show');
            } else {
                console.log('STANDALONE: Showing dropdown');
                dropdownContent.classList.add('show');
                console.log('STANDALONE: Dropdown classes:', dropdownContent.className);
            }
        });
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function() {
        document.querySelectorAll('.export-dropdown-content').forEach(content => {
            content.classList.remove('show');
        });
    });
    
    // Setup export option handlers
    const exportOptions = document.querySelectorAll('.export-dropdown-content a');
    debug.info(`STANDALONE: 🔍 Found ${exportOptions.length} export options`);
    exportOptions.forEach(option => {
        option.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const format = this.getAttribute('data-export');
            debug.info(`STANDALONE: 🖱️ Export option clicked: ${format}`);
            handleExport_Standalone(format);
            
            // Close dropdown
            const dropdownContent = this.closest('.export-dropdown-content');
            if (dropdownContent) {
                dropdownContent.classList.remove('show');
            }
        });
    });
    
    debug.info('STANDALONE: ✅ Export dropdown handlers setup completed');
    dropdownsInitialized = true;
}

/**
 * Handle export based on format (standalone version)
 */
function handleExport_Standalone(format) {
    debug.info(`STANDALONE: 📄 Export ${format} requested`);
    
    try {
        switch (format) {
            case 'csv':
                downloadCSV_Standalone();
                break;
            case 'json':
                downloadJSON_Standalone();
                break;
            case 'xml':
                downloadXML_Standalone();
                break;
            case 'all':
                downloadAll_Standalone();
                break;
            default:
                debug.error(`STANDALONE: ❌ Unknown export format: ${format}`);
                alert(`Unknown export format: ${format}`);
        }
    } catch (error) {
        debug.error(`STANDALONE: ❌ Export ${format} failed:`, error);
        alert(`Failed to export ${format}: ${error.message}`);
    }
}

/**
 * Setup all button event handlers (standalone version)
 */
function setupUIHandlers_Standalone() {
    console.log('STANDALONE: setupUIHandlers_Standalone called!');
    
    // Prevent multiple initializations
    if (uiHandlersInitialized) {
        debug.info('STANDALONE: 🔒 UI handlers already initialized, skipping...');
        return;
    }
    
    debug.info('STANDALONE: 🎮 Setting up UI handlers...');
    
    // Setup export dropdowns first
    setupExportDropdowns_Standalone();
    
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
        debug.warning('STANDALONE: ⚠️ Export CSV button not found in DOM');
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
    uiHandlersInitialized = true;
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