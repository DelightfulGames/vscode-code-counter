/**
 * VS Code Code Counter Extension - Common Utilities Module
 * 
 * Copyright (c) 2025 DelightfulGames
 * Licensed under the MIT License
 * 
 * Repository: https://github.com/DelightfulGames/vscode-code-counter
 * Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
 * 
 * This module contains utility functions shared between webview and standalone contexts.
 */

/**
 * Escape string for use in JavaScript string literals
 */
function escapeForJavaScript(str) {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\\\')     // Escape backslashes first
        .replace(/'/g, "\\'")       // Escape single quotes  
        .replace(/"/g, '\\"')       // Escape double quotes
        .replace(/\r?\n/g, '\\n')   // Escape newlines
        .replace(/\r/g, '\\r')      // Escape carriage returns
        .replace(/\t/g, '\\t')      // Escape tabs
        .replace(/\0/g, '\\0');     // Escape null characters
}

/**
 * Escape string for use in HTML attributes
 */
function escapeForHTMLAttribute(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')     // Escape ampersands first
        .replace(/"/g, '&quot;')    // Escape double quotes
        .replace(/'/g, '&#39;')     // Escape single quotes
        .replace(/</g, '&lt;')      // Escape less than
        .replace(/>/g, '&gt;')      // Escape greater than
        .replace(/\r?\n/g, '&#10;') // Escape newlines
        .replace(/\r/g, '&#13;');   // Escape carriage returns
}

/**
 * Format file size in KB with appropriate units
 */
function formatSizeKB(kb) {
    if (kb < 1) return `${(kb * 1024).toLocaleString()} B`;
    if ((kb < 1024)) return `${kb.toFixed(2)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
}

/**
 * Calculate group statistics from rows
 */
function calculateGroupStats(group, count) {
    const rows = group.getRows();
    const totals = {
        totalLines: 0,
        codeLines: 0,
        commentLines: 0,
        blankLines: 0,
        size: 0
    };
    
    // Track unique languages in this group
    const uniqueLanguages = new Set();
    
    rows.forEach(row => {
        const data = row.getData();
        totals.totalLines += data.lines || 0;
        totals.codeLines += data.codeLines || 0;
        totals.commentLines += data.commentLines || 0;
        totals.blankLines += data.blankLines || 0;
        totals.size += data.size || 0;
        
        // Add language to set (automatically handles duplicates)
        if (data.language && data.language.trim() !== '') {
            uniqueLanguages.add(data.language);
        }
    });
    
    const avgCommentRatio = (totals.totalLines > 0) ? 
        Math.round((totals.commentLines / totals.totalLines) * 100) : 0;
    
    return {
        ...totals,
        avgCommentRatio,
        languageCount: uniqueLanguages.size,
        languages: Array.from(uniqueLanguages).sort(),
        count
    };
}

// Make functions globally accessible
window.escapeForJavaScript = escapeForJavaScript;
window.escapeForHTMLAttribute = escapeForHTMLAttribute;
window.formatSizeKB = formatSizeKB;
window.calculateGroupStats = calculateGroupStats;

//# sourceURL=tabulator-manager-common.js