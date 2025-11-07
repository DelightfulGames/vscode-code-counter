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

/**
 * Update group header structure after column reordering
 * Smoothly reorders group header cells to match new column positions without disrupting grouping
 */
function updateGroupHeaderStructure() {
    if (!window.filesTable) {
        debug.warning('⚠️ updateGroupHeaderStructure: window.filesTable not available');
        return;
    }
    
    debug.info('🔄 [updateGroupHeaderStructure] Starting smooth group header reordering...');
    
    try {
        const columns = window.filesTable.getColumns();
        debug.info('🔄 [updateGroupHeaderStructure] Current columns:', columns.map(col => col.getField()));
        
        // Find all group header elements in the DOM
        const groupHeaders = document.querySelectorAll('.native-group-header');
        
        if (groupHeaders.length === 0) {
            debug.warning('⚠️ [updateGroupHeaderStructure] No group headers found in DOM');
            return;
        }
        
        debug.info(`🔄 [updateGroupHeaderStructure] Found ${groupHeaders.length} group headers to update`);
        
        // Update each group header to match the new column order
        groupHeaders.forEach((groupHeader, groupIndex) => {
            try {
                // Get existing cells in the group header
                const existingCells = Array.from(groupHeader.children);
                debug.verbose(`🔄 [updateGroupHeaderStructure] Group ${groupIndex}: Found ${existingCells.length} existing cells`);
                
                // Create a map of field -> cell element for quick lookup
                const cellMap = new Map();
                existingCells.forEach(cell => {
                    const field = cell.getAttribute('data-field');
                    if (field) {
                        cellMap.set(field, cell);
                    }
                });
                
                // Build new cell order based on current column order
                const newCellOrder = [];
                let combinedCellProcessed = false;
                
                columns.forEach((column, index) => {
                    const field = column.getField();
                    
                    // Handle the combined first cell (spans first two columns)
                    if (index === 0 && !combinedCellProcessed) {
                        const combinedCell = cellMap.get('directory-fileName');
                        if (combinedCell) {
                            // Update combined cell width to match first two columns
                            const firstColumn = columns[0];
                            const secondColumn = columns[1];
                            if (firstColumn && secondColumn) {
                                const combinedWidth = firstColumn.getWidth() + secondColumn.getWidth();
                                combinedCell.style.width = `${combinedWidth}px`;
                                combinedCell.style.minWidth = `${combinedWidth}px`;
                                combinedCell.style.flex = `0 0 ${combinedWidth}px`;
                            }
                            newCellOrder.push(combinedCell);
                        }
                        combinedCellProcessed = true;
                        return;
                    }
                    
                    // Skip second column (already handled in combined cell)
                    if (index === 1) {
                        return;
                    }
                    
                    // Add remaining columns in their new order
                    const cell = cellMap.get(field);
                    if (cell) {
                        // Update cell width to match column width
                        const width = column.getWidth();
                        cell.style.width = `${width}px`;
                        cell.style.minWidth = `${width}px`;
                        cell.style.flex = `0 0 ${width}px`;
                        newCellOrder.push(cell);
                    }
                });
                
                // Smoothly reorder the cells in the DOM
                // Remove all cells first
                existingCells.forEach(cell => cell.remove());
                
                // Add them back in the new order
                newCellOrder.forEach(cell => {
                    if (cell) {
                        groupHeader.appendChild(cell);
                    }
                });
                
                debug.verbose(`✅ [updateGroupHeaderStructure] Group ${groupIndex}: Reordered ${newCellOrder.length} cells`);
                
            } catch (headerError) {
                debug.error(`❌ [updateGroupHeaderStructure] Error updating group header ${groupIndex}:`, headerError);
            }
        });
        
        debug.info('✅ [updateGroupHeaderStructure] Group headers smoothly reordered without disrupting grouping');
        
        // Update widths after reordering
        setTimeout(() => {
            if (typeof updateGroupHeaderWidths === 'function') {
                debug.info('🔄 [updateGroupHeaderStructure] Calling updateGroupHeaderWidths after reordering');
                updateGroupHeaderWidths();
            }
        }, 10);
        
    } catch (error) {
        debug.error('❌ [updateGroupHeaderStructure] Error during smooth group header update:', error);
        debug.warning('🔄 [updateGroupHeaderStructure] Falling back to basic width update only');
        
        // Fallback to just updating widths without reordering
        if (typeof updateGroupHeaderWidths === 'function') {
            updateGroupHeaderWidths();
        }
    }
}

// Make functions globally accessible
window.escapeForJavaScript = escapeForJavaScript;
window.escapeForHTMLAttribute = escapeForHTMLAttribute;
window.formatSizeKB = formatSizeKB;
window.calculateGroupStats = calculateGroupStats;
window.updateGroupHeaderStructure = updateGroupHeaderStructure;

//# sourceURL=tabulator-manager-common.js