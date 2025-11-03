/**
 * VS Code Code Counter Extension - Data Manager Module
 * 
 * Copyright (c) 2025 DelightfulGames
 * Licensed under the MIT License
 * 
 * Repository: https://github.com/DelightfulGames/vscode-code-counter
 * Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
 */

// Global data state
let reportData = null;

/**
 * Parse embedded JSON data from the template
 */
function parseEmbeddedData() {
    try {
        if (embeddedJsonData && embeddedJsonData !== '{{JSON_DATA}}') {
            debug.info('📥 Parsing embedded JSON string...');
            reportData = JSON.parse(embeddedJsonData);
            debug.info('✅ JSON parsed successfully');
            debug.info('📊 Report data structure:', {
                hasSummary: !!reportData.summary,
                hasLanguages: !!reportData.languages,
                hasFiles: !!reportData.files,
                fileCount: reportData.files ? reportData.files.length : 0
            });
            return reportData;
        } else {
            debug.warning('⚠️ No embedded JSON data found or template not replaced');
            return null;
        }
    } catch (error) {
        debug.error('❌ Error parsing JSON data:', error);
        debug.error('📝 Raw data length:', embeddedJsonData ? embeddedJsonData.length : 0);
        debug.error('📝 First 200 chars:', embeddedJsonData ? embeddedJsonData.substring(0, 200) : 'null');
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
    return `
        <div class="stat-card">
            <div class="stat-value">${summary.totalFiles.toLocaleString()}</div>
            <div class="stat-label">📄 Total Files</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${summary.totalLines.toLocaleString()}</div>
            <div class="stat-label">📊 Total Lines</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${summary.totalCodeLines.toLocaleString()}</div>
            <div class="stat-label">💼 Code Lines</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${summary.totalCommentLines.toLocaleString()}</div>
            <div class="stat-label">💬 Comment Lines</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${summary.totalBlankLines.toLocaleString()}</div>
            <div class="stat-label">📝 Blank Lines</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${summary.languageCount}</div>
            <div class="stat-label">💻 Languages</div>
        </div>
    `;
}

/**
 * Create HTML for language statistics section
 */
function createLanguageStatsHTML(languages) {
    return languages
        .sort((a, b) => b.lines - a.lines)
        .map(lang => `
            <div class="language-item">
                <span class="language-name">${lang.name}</span>
                <div>
                    <span class="language-files">${lang.files} files</span>
                    <span style="margin-left: 10px; font-weight: 500;">${lang.lines.toLocaleString()} lines</span>
                </div>
            </div>
        `).join('');
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

//# sourceURL=data-manager.js