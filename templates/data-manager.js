/**
 * VS Code Code Counter Extension - Data Manager Module
 * 
 * Copyright (c) 2025 DelightfulGames
 * Licensed under the MIT License
 * 
 * Repository: https://github.com/DelightfulGames/vscode-code-counter
 * Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
 */

/**
 * Safe number conversion for locale strings that might be undefined
 */
function safeToLocaleNumber(value) {
    if (value === undefined || value === null || value === '') {
        return 0;
    }
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number(value.replace(/,/g, ''));
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
}

// Global data state
let reportData = null;

/**
 * Parse embedded JSON data from the template
 * Supports both webview (embeddedJsonData) and standalone HTML (embeddedJsonFiles) formats
 */
function parseEmbeddedData() {
    try {
        // Try webview format first (embeddedJsonData with {{JSON_DATA}} placeholder)
        if (typeof embeddedJsonData !== 'undefined' && embeddedJsonData && embeddedJsonData !== '{{JSON_DATA}}') {
            debug.info('📥 Parsing webview embedded JSON data...');
            reportData = JSON.parse(embeddedJsonData);
            debug.info('✅ Webview JSON parsed successfully');
            debug.info('📊 Report data structure:', {
                hasSummary: !!reportData.summary,
                hasLanguages: !!reportData.languages,
                hasFiles: !!reportData.files,
                fileCount: reportData.files ? reportData.files.length : 0
            });
            return reportData;
        }
        
        // Try standalone HTML format (embeddedJsonFiles with {{DATA_FILES}} placeholder) 
        if (typeof embeddedJsonFiles !== 'undefined' && embeddedJsonFiles && embeddedJsonFiles !== '[{{DATA_FILES}}]') {
            debug.info('📥 Parsing standalone HTML embedded JSON files...');
            const files = JSON.parse(embeddedJsonFiles);
            debug.info('✅ Standalone JSON parsed successfully');
            
            // Calculate summary from files with safe numeric conversion
            const summary = {
                totalFiles: files.length || 0,
                totalLines: files.reduce((sum, file) => sum + safeToLocaleNumber(file.lines), 0),
                totalChars: files.reduce((sum, file) => sum + safeToLocaleNumber(file.characters), 0),
                totalBytes: files.reduce((sum, file) => sum + safeToLocaleNumber(file.bytes), 0)
            };
            
            // Create language groups
            const languages = {};
            files.forEach(file => {
                const lang = file.language || 'Unknown';
                if (!languages[lang]) {
                    languages[lang] = {
                        name: lang,
                        files: 0,
                        lines: 0,
                        characters: 0,
                        bytes: 0
                    };
                }
                languages[lang].files++;
                languages[lang].lines += safeToLocaleNumber(file.lines);
                languages[lang].characters += safeToLocaleNumber(file.characters);
                languages[lang].bytes += safeToLocaleNumber(file.bytes);
            });
            
            reportData = {
                summary: summary,
                languages: Object.values(languages),
                files: files
            };
            
            debug.info('📊 Report data structure:', {
                hasSummary: !!reportData.summary,
                hasLanguages: !!reportData.languages,
                hasFiles: !!reportData.files,
                fileCount: reportData.files ? reportData.files.length : 0
            });
            return reportData;
        } else {
            debug.warning('⚠️ No embedded JSON data found or template not replaced');
            debug.warning('📝 Checked embeddedJsonData:', typeof embeddedJsonData !== 'undefined' ? embeddedJsonData?.substring(0, 50) : 'undefined');
            debug.warning('📝 Checked embeddedJsonFiles:', typeof embeddedJsonFiles !== 'undefined' ? embeddedJsonFiles?.substring(0, 50) : 'undefined');
            return null;
        }
    } catch (error) {
        debug.error('❌ Error parsing JSON data:', error);
        debug.error('📝 embeddedJsonData length:', typeof embeddedJsonData !== 'undefined' ? (embeddedJsonData ? embeddedJsonData.length : 0) : 'undefined');
        debug.error('📝 embeddedJsonFiles length:', typeof embeddedJsonFiles !== 'undefined' ? (embeddedJsonFiles ? embeddedJsonFiles.length : 0) : 'undefined');
        return null;
    }
}

/**
 * Initialize the report with parsed data
 */
function initializeReport(data) {
    debug.info('🎯 Initializing report with data');
    
    try {
        populateReport(data);
        debug.info('✅ Report initialization completed');
    } catch (error) {
        debug.error('❌ Error initializing report:', error);
        showError('Failed to initialize report: ' + error.message);
    }
}

/**
 * Populate all report sections with data
 */
function populateReport(data) {
    debug.info('📊 Populating report sections...');
    
    // Populate summary statistics
    const summaryDiv = document.getElementById('summary-stats');
    if (summaryDiv) {
        summaryDiv.innerHTML = createSummaryHTML(data.summary);
        debug.info('✅ Summary populated');
    }
    
    // Populate language statistics
    const langDiv = document.getElementById('language-stats');
    if (langDiv) {
        langDiv.innerHTML = createLanguageStatsHTML(data.languages);
        debug.info('✅ Languages populated');
    }
    
    // Initialize advanced Tabulator table
    initializeAdvancedTable(data.files);
    debug.info('✅ Advanced table initialized');
    
    // Setup advanced filtering
    setupAdvancedFiltering(data.files);
    debug.info('✅ Advanced filtering setup');
    
    debug.info('🎉 Report population completed');
}

/**
 * Create HTML for summary statistics section
 */
function createSummaryHTML(summary) {
    // Ensure all properties exist with fallback values and safe number formatting
    const safeStats = {
        totalFiles: summary.totalFiles || 0,
        totalLines: summary.totalLines || 0,
        totalCodeLines: summary.totalCodeLines || 0,
        totalCommentLines: summary.totalCommentLines || 0,
        totalBlankLines: summary.totalBlankLines || 0,
        languageCount: summary.languageCount || 0
    };

    // Safe number formatting function
    function formatNumber(num) {
        try {
            return Number(num).toLocaleString();
        } catch (e) {
            return String(num);
        }
    }

    return `
        <div class="stat-card">
            <div class="stat-value">${formatNumber(safeStats.totalFiles)}</div>
            <div class="stat-label">📄 Total Files</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${formatNumber(safeStats.totalLines)}</div>
            <div class="stat-label">📊 Total Lines</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${formatNumber(safeStats.totalCodeLines)}</div>
            <div class="stat-label">💼 Code Lines</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${formatNumber(safeStats.totalCommentLines)}</div>
            <div class="stat-label">💬 Comment Lines</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${formatNumber(safeStats.totalBlankLines)}</div>
            <div class="stat-label">📝 Blank Lines</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${formatNumber(safeStats.languageCount)}</div>
            <div class="stat-label">💻 Languages</div>
        </div>
    `;
}

/**
 * Populate summary statistics section
 */
function populateSummaryStats(summary) {
    debug.info('📊 Populating summary statistics...');
    debug.info('📊 Summary data received:', summary);
    
    try {
        const summaryDiv = document.getElementById('summary-stats');
        if (summaryDiv) {
            const htmlContent = createSummaryHTML(summary);
            debug.info('📊 Generated HTML content length:', htmlContent.length);
            summaryDiv.innerHTML = htmlContent;
            debug.info('✅ Summary statistics populated successfully');
        } else {
            debug.warning('⚠️ Summary stats container not found');
        }
    } catch (error) {
        debug.error('❌ Error in populateSummaryStats:', error);
        throw new Error(`Failed to populate summary stats: ${error.message}`);
    }
}

/**
 * Create HTML for language statistics section
 */
function createLanguageStatsHTML(languages) {
    // Safe number formatting function
    function formatNumber(num) {
        try {
            return Number(num).toLocaleString();
        } catch (e) {
            return String(num);
        }
    }

    return languages
        .sort((a, b) => (Number(b.lines) || 0) - (Number(a.lines) || 0))
        .map(lang => `
            <div class="language-item">
                <span class="language-name">${lang.name || 'Unknown'}</span>
                <div>
                    <span class="language-files">${Number(lang.files) || 0} files</span>
                    <span style="margin-left: 10px; font-weight: 500;">${formatNumber(lang.lines)} lines</span>
                </div>
            </div>
        `).join('');
}

/**
 * Populate language statistics breakdown section
 */
function populateLanguagesBreakdown(languages) {
    debug.info('🖥️ Populating language breakdown...');
    debug.info('🖥️ Languages data received:', languages);
    
    try {
        const langDiv = document.getElementById('language-stats');
        if (langDiv) {
            const htmlContent = createLanguageStatsHTML(languages);
            debug.info('🖥️ Generated language HTML content length:', htmlContent.length);
            langDiv.innerHTML = htmlContent;
            debug.info('✅ Language breakdown populated successfully');
        } else {
            debug.warning('⚠️ Language stats container not found');
        }
    } catch (error) {
        debug.error('❌ Error in populateLanguagesBreakdown:', error);
        throw new Error(`Failed to populate language breakdown: ${error.message}`);
    }
}

/**
 * Update report data from external source
 */
function updateReportData(newData) {
    debug.info('🔄 Updating report data...');
    if (newData) {
        reportData = newData;
        initializeReport(reportData);
        debug.info('✅ Report data updated successfully');
    } else {
        debug.error('❌ No data in update request');
    }
}

/**
 * Get current report data
 */
function getReportData() {
    return reportData;
}

/**
 * Show error message to user
 */
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    if (errorDiv && errorText) {
        errorText.textContent = message;
        errorDiv.classList.remove('hidden');
    }
}

/**
 * Main function to populate the report using embedded data
 */
function populateReportFromData(data) {
    debug.info('📊 Populating report sections...');
    
    if (!data || !data.files) {
        throw new Error('Invalid data structure - no files found');
    }
    
    // Populate summary stats
    if (data.summary) {
        populateSummaryStats(data.summary);
    }
    
    // Populate languages breakdown
    if (data.languages) {
        populateLanguagesBreakdown(data.languages);
    }
    
    // Populate the advanced files table
    if (typeof initializeAdvancedTable === 'function') {
        debug.info('🚀 Initializing Tabulator table using webview modules');
        initializeAdvancedTable(data.files);
    } else {
        // Fallback to basic table
        populateFilesTable(data.files);
    }
    
    // Setup UI handlers if available
    if (typeof setupUIHandlers === 'function') {
        setupUIHandlers();
    }
    
    debug.info('✅ Report sections populated successfully');
}

//# sourceURL=data-manager.js