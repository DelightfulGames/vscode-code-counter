/**
 * VS Code Code Counter Extension - HTML Generator Helper Functions
 * 
 * Copyright (c) 2025 DelightfulGames
 * Licensed under the MIT License
 * 
 * This file contains helper functions that were previously hardcoded in htmlGenerator.ts.
 * These functions provide utilities for standalone HTML reports.
 */

/**
 * Safe toLocaleString function that handles undefined/null values
 */
function safeToLocaleString(value) {
    if (value === null || value === undefined || isNaN(value)) {
        return '0';
    }
    return Number(value).toLocaleString();
}

/**
 * Wrapper to ensure all embedded functions run in safe context
 */
function runInSafeContext(fn, ...args) {
    try {
        return fn.apply(this, args);
    } catch (error) {
        debug.error('Error in embedded function:', error);
        debug.error('Function name:', fn.name);
        debug.error('Arguments:', args);
        throw error;
    }
}

/**
 * Provide VS Code API fallback for standalone HTML reports
 */
if (typeof vscode === 'undefined') {
    window.vscode = {
        postMessage: function(message) {
            debug.info('📨 VS Code API not available (standalone HTML), message:', message);
            
            // Handle CSV export in standalone mode
            if (message.command === 'saveCSV') {
                const blob = new Blob([message.data], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = message.filename || 'export.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                debug.info('✅ CSV file downloaded in standalone mode');
            }
        }
    };
}

/**
 * Ensure data-manager functions work with HTML template data structure
 */
function initializeReportFromEmbeddedData() {
    debug.info('🎯 Initializing report from embedded data...');
    
    // Try to get embedded JSON data - now it's the actual array object
    const embeddedJsonFiles = {{DATA_FILES}};
    if (embeddedJsonFiles && Array.isArray(embeddedJsonFiles) && embeddedJsonFiles.length > 0) {
        try {
            const files = embeddedJsonFiles; // It's already the parsed array
            
            // Calculate summary statistics like data-manager expects with safe numeric conversion
            const summary = {
                totalFiles: files.length || 0,
                totalLines: files.reduce((sum, file) => sum + (Number(file.lines) || 0), 0),
                totalCodeLines: files.reduce((sum, file) => sum + (Number(file.codeLines) || 0), 0),
                totalCommentLines: files.reduce((sum, file) => sum + (Number(file.commentLines) || 0), 0),
                totalBlankLines: files.reduce((sum, file) => sum + (Number(file.blankLines) || 0), 0),
                languageCount: 0
            };
            
            // Calculate language statistics
            const languageMap = new Map();
            files.forEach(file => {
                const lang = file.language || 'Unknown';
                if (!languageMap.has(lang)) {
                    languageMap.set(lang, { name: lang, files: 0, lines: 0 });
                }
                const langStat = languageMap.get(lang);
                langStat.files++;
                langStat.lines += Number(file.lines) || 0;
            });
            
            const languages = Array.from(languageMap.values()).sort((a, b) => b.lines - a.lines);
            summary.languageCount = languages.length;
            
            const reportData = { summary, languages, files };
            debug.info('✅ Report data prepared:', { 
                files: files.length, 
                languages: languages.length,
                totalLines: summary.totalLines 
            });
            
            return reportData;
        } catch (error) {
            debug.error('❌ Failed to parse embedded data:', error);
            return null;
        }
    }
    
    return null;
}