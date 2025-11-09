/**
 * VS Code Code Counter Extension - Common Utilities Module
 * 
 * Copyright (c) 2025 DelightfulGames
 * Licensed under the MIT License
 * 
 * Repository: https://github.com/DelightfulGames/vscode-code-counter
 * Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
 * 
 * STANDALONE TABULATOR MANAGER
 * Specialized functions for standalone HTML report generation (report.html)
 * These functions are isolated from webview functionality to prevent conflicts
 */

// Common utility functions are now loaded from tabulator-manager-common.js

/**
 * Create table column definitions for standalone reports
 * Modified to handle file links appropriately for standalone context
 */
function createTableColumns_Standalone() {
    return [
        {
            title: "📁 Directory", 
            field: "directory", 
            minWidth: 150,
            width: 150, // Fixed width for better frozen column appearance
            sorter: "string",
            frozen: true, // Mark as frozen column
            formatter: function(cell, formatterParams) {
                const directory = cell.getValue();
                const displayDir = directory === '' || directory === '.' ? '(root)' : directory;
                return `<span title="${directory || '(root)'}" class="directory-link">${displayDir === '(root)' ? '.' : displayDir}</span>`;
            }
        },
        {
            title: "📄 File", 
            field: "fileName", 
            minWidth: 150,
            width: 150, // Fixed width for better frozen column appearance
            sorter: "string",
            headerFilter: true,
            frozen: true, // Mark as frozen column
            formatter: function(cell, formatterParams) {
                const fileName = cell.getValue();
                const fullPath = cell.getRow().getData().relativePath;
                const absolutePath = cell.getRow().getData().path;
                const filePath = absolutePath || fullPath;
                // For standalone reports, show file path as tooltip but don't make it clickable
                return `<span title="File: ${filePath}" class="file-name-standalone">${fileName}</span>`;
            }
        },
        {
            title: "🖥️ Language", 
            field: "language", 
            minWidth: 75,
            width: 150,
            sorter: "string"
        },
        {
            title: "📈 Lines", 
            field: "lines", 
            minWidth: 75,
            width: 100,
            sorter: "number",
            hozAlign: "right",
            formatter: "money",
            formatterParams: {
                precision: 0,
                symbol: "",
                symbolAfter: false
            },
            headerFilter: function(headerValue, rowValue, rowData, filterParams){
                // Custom filter: if headerValue is provided, filter for values >= headerValue
                if (headerValue === null || headerValue === undefined || headerValue === '') {
                    return true; // No filter applied
                }
                const minValue = parseInt(headerValue);
                const actualValue = parseInt(rowValue);
                return !isNaN(minValue) && !isNaN(actualValue) && actualValue >= minValue;
            },
            headerFilterPlaceholder: "Min lines..."
        },
        {
            title: "📸 Code", 
            field: "codeLines", 
            minWidth: 75,
            width: 100,
            sorter: "number",
            hozAlign: "right",
            formatter: "money",
            formatterParams: {
                precision: 0,
                symbol: "",
                symbolAfter: false
            }
        },
        {
            title: "💬 Comments", 
            field: "commentLines", 
            minWidth: 75,
            width: 100,
            sorter: "number",
            hozAlign: "right",
            formatter: "money",
            formatterParams: {
                precision: 0,
                symbol: "",
                symbolAfter: false
            }
        },
        {
            title: "😶 Blanks", 
            field: "blankLines", 
            minWidth: 75,
            width: 100,
            sorter: "number",
            hozAlign: "right",
            formatter: "money",
            formatterParams: {
                precision: 0,
                symbol: "",
                symbolAfter: false
            }
        },
        {
            title: "💬%", 
            field: "commentRatio", 
            minWidth: 75,
            width: 80,
            sorter: "number",
            hozAlign: "right",
            formatter: function(cell) {
                const value = parseFloat(cell.getValue());
                const color = value > 20 ? '#28a745' : value > 10 ? '#ffc107' : '#6c757d';
                return `<span class="comment-ratio-colored" style="color: ${color};">${value}%</span>`;
            }
        },
        {
            title: "📦 Size", 
            field: "sizeKB", 
            minWidth: 75,
            width: 100,
            sorter: "number",
            hozAlign: "right",
            formatter: function(cell) {
                const kb = cell.getValue();
                return formatSizeKB(kb);  // Use the common formatSizeKB function
            }
        }
    ];
}

// Alias for compatibility with existing code
const createTableColumns = createTableColumns_Standalone;

// formatSizeKB function is now loaded from tabulator-manager-common.js

// calculateGroupStats function is now loaded from tabulator-manager-common.js

/**
 * Update group header column widths (standalone version - simplified)
 */
function updateGroupHeaderWidths_Standalone() {
    
    if (!window.filesTable) {
        debug.error(`STANDALONE: ❌ No filesTable found`);
        return;
    }
    
    const columns = window.filesTable.getColumns();
    const groupHeaders = document.querySelectorAll('.native-group-header');
    
    groupHeaders.forEach(header => {
        // Update all column cells to match table column widths
        columns.forEach((column, index) => {
            const field = column.getField();
            const width = column.getWidth();
            
            const cell = header.querySelector(`[data-field="${field}"]`);
            if (cell) {
                cell.style.width = `${width}px`;
                cell.style.minWidth = `${width}px`;
                cell.style.flex = `0 0 ${width}px`;
            }
        });
    });
}

// Compatibility aliases for existing code
const updateGroupHeaderWidths = updateGroupHeaderWidths_Standalone;

/**
 * STANDALONE: Simplified positioning for standalone report.html (NO OVERLAY)
 * This version does NOT create any overlay to avoid blocking the table
 */
function updateFixedGroupHeaderPositions_Standalone(scrollLeft, scrollTop) {
    debug.info(`🚨 updateFixedGroupHeaderPositions_Standalone CALLED: scrollLeft=${scrollLeft}, scrollTop=${scrollTop}`);
    debug.info(`🚫 STANDALONE: Overlay creation disabled to prevent table blocking`);
    
    // Remove any existing webview overlays that might be interfering
    const webviewOverlay = document.querySelector('.frozen-group-overlay');
    if (webviewOverlay) {
        debug.info(`🗑️ STANDALONE: Removing interfering webview overlay`);
        webviewOverlay.remove();
    }
    
    // STANDALONE: Do NOT create any overlay - just return early
    debug.info(`✅ STANDALONE: Overlay creation skipped, table remains unblocked`);
    return;
}

/**
 * STANDALONE: Initialize advanced table for standalone report.html
 * This is a complete clone of initializeAdvancedTable with standalone-specific modifications
 */
function initializeAdvancedTable_Standalone(files) {
    debug.info('🚀 Initializing Tabulator table for STANDALONE...');
    debug.info('📊 Files data received:', { 
        fileCount: files ? files.length : 0,
        firstFile: files && files.length > 0 ? files[0] : null,
        dataType: typeof files,
        isArray: Array.isArray(files)
    });
    
    // Add computed fields for better analysis
    const processedFiles = files.map(file => ({
        ...file,
        // Fix path separators - convert backslashes to forward slashes
        relativePath: file.relativePath.replace(/\\/g, '/'),
        // Extract just the filename for the File column
        fileName: (() => {
            const normalizedPath = file.relativePath.replace(/\\/g, '/');
            const lastSlashIndex = normalizedPath.lastIndexOf('/');
            return lastSlashIndex >= 0 ? normalizedPath.substring(lastSlashIndex + 1) : normalizedPath;
        })(),
        // Extract directory path for the Directory column (show full path to parent directory)
        directory: (() => {
            const normalizedPath = file.relativePath.replace(/\\/g, '/');
            const lastSlashIndex = normalizedPath.lastIndexOf('/');
            return lastSlashIndex >= 0 ? normalizedPath.substring(0, lastSlashIndex) : '';
        })(),
        commentRatio: file.lines > 0 ? (file.commentLines / file.lines * 100).toFixed(1) : 0,
        codeRatio: file.lines > 0 ? (file.codeLines / file.lines * 100).toFixed(1) : 0,
        sizeKB: file.size / 1024  // Don't round here, let formatSizeKB handle the formatting
    }))
    // Sort to show directories first, then files within each directory
    .sort((a, b) => {
        // First sort by directory path (directories appear first)
        const dirCompare = a.directory.localeCompare(b.directory);
        if (dirCompare !== 0) {
            return dirCompare;
        }
        // Within the same directory, sort files alphabetically by filename
        return a.fileName.localeCompare(b.fileName);
    });

    window.filesTable = new Tabulator("#files-table-tabulator", {
        data: processedFiles,
        layout: "fitColumns",
        height: "600px",
        pagination: false,
        paginationCounter: "rows",
        movableColumns: true,
        resizableRows: false,
        groupBy: "directory", // Use native Tabulator grouping
        groupStartOpen: true,
        stickyHeaders: true, // Make headers sticky when scrolling
        groupHeader: function(value, count, data, group) {
            debug.verbose(`📊 Creating native group header for STANDALONE: ${value} (${count} files)`);
            
            // Calculate group statistics using the existing function
            const stats = calculateGroupStats(group, count);
            
            // Get current column widths and order
            const columns = window.filesTable ? window.filesTable.getColumns() : [];
            console.log(`🔍 [STANDALONE groupHeader] Current column order:`, columns.map(col => `${col.getField()}(${col.getWidth()}px)`));
            let headerCells = '';
            
            // If table is not ready, use default structure
            if (columns.length === 0) {
                return `
                    <div class="native-group-header" data-directory="${value || ''}" data-count="${count}" data-stats='${JSON.stringify(stats)}'>
                        <div class="group-directory-combined tabulator-cell group-cell-frozen" data-field="directory-fileName" data-colspan="2">
                            <div class="combined-cell-content">
                                <div class="directory-section">📁 ${value || "(root)"}</div>
                                <div class="files-section">
                                    <div>📄 ${count} files</div>
                                    <div class="stat-label-secondary">${stats.languageCount} languages</div>
                                </div>
                            </div>
                        </div>
                        <div class="group-stats tabulator-cell group-cell-normal" data-field="language">📊 Stats</div>
                        <div class="group-stats tabulator-cell" data-field="lines">Lines</div>
                        <div class="group-stats tabulator-cell" data-field="codeLines">Code</div>
                        <div class="group-stats tabulator-cell" data-field="commentLines">Comments</div>
                        <div class="group-stats tabulator-cell" data-field="blankLines">Blanks</div>
                        <div class="group-stats tabulator-cell" data-field="commentRatio">%</div>
                        <div class="group-stats tabulator-cell" data-field="sizeKB">Size</div>
                    </div>
                `;
            }
            
            // Generate cells based on actual column order
            // First cell always spans the first two columns (frozen combined cell) 
            let combinedCellProcessed = false;
            
            columns.forEach((column, index) => {
                const field = column.getField();
                const width = column.getWidth();
                
                let content = '';
                let classes = ['tabulator-cell'];
                
                // Always create the combined first cell for the first two columns (regardless of their fields)
                if (index === 0) {
                    // Get the first two columns to create the combined cell
                    const firstColumn = columns[0];
                    const secondColumn = columns[1];
                    
                    if (firstColumn && secondColumn) {
                        const combinedWidth = firstColumn.getWidth() + secondColumn.getWidth();
                        
                        classes.push('group-cell-frozen', 'group-directory-combined');
                        content = `<div class="combined-cell-content">
                                    <div class="directory-section">📁 ${value || "(root)"}</div>
                                  </div>`;
                        
                        headerCells += `<div class="${classes.join(' ')}" 
                                             data-field="directory-fileName" 
                                             data-colspan="2"
                                             style="width: ${combinedWidth}px; min-width: ${combinedWidth}px; flex: 0 0 ${combinedWidth}px;">
                                            ${content}
                                        </div>`;
                    }
                    combinedCellProcessed = true;
                    return; // Skip to next iteration
                }
                
                // Skip the second column since it's already included in the combined cell
                if (index === 1) {
                    return; // Skip to next iteration
                }
                
                // Handle all remaining columns (index >= 2) normally - they move with their data columns
                classes.push('group-cell-normal');
                
                // Generate content based on the field type (since columns can be reordered)
                switch (field) {
                    case 'language':
                        content = `<div class="stat-value-primary">📄 ${count} files</div>
                                   <div class="stat-label-secondary">🖥️ ${stats.languageCount} languages</div>`;
                        classes.push('group-stats');
                        break;
                    case 'lines':
                        content = `<div class="stat-label-secondary">📈 total</div>
                                  <div class="stat-value-primary">${(stats.totalLines || 0).toLocaleString()}</div>
                                  <div class="stat-label-secondary">Avg: ${count > 0 ? ((stats.totalLines || 0) / count).toFixed(1) : '0'}</div>`;
                        classes.push('group-stats');
                        break;
                    case 'codeLines':
                        content = `<div class="stat-label-secondary">📸 code</div>
                                  <div class="stat-value-primary">${(stats.codeLines || 0).toLocaleString()}</div>
                                  <div class="stat-label-secondary">Avg: ${count > 0 ? ((stats.codeLines || 0) / count).toFixed(1) : '0'}</div>`;
                        classes.push('group-stats');
                        break;
                    case 'commentLines':
                        content = `<div class="stat-label-secondary">💬 comments</div>
                                  <div class="stat-value-primary">${(stats.commentLines || 0).toLocaleString()}</div>
                                  <div class="stat-label-secondary">Avg: ${count > 0 ? ((stats.commentLines || 0) / count).toFixed(1) : '0'}</div>`;
                        classes.push('group-stats');
                        break;
                    case 'blankLines':
                        content = `<div class="stat-label-secondary">😶 blanks</div>
                                  <div class="stat-value-primary">${(stats.blankLines || 0).toLocaleString()}</div>
                                  <div class="stat-label-secondary">Avg: ${count > 0 ? ((stats.blankLines || 0) / count).toFixed(1) : '0'}</div>`;
                        classes.push('group-stats');
                        break;
                    case 'commentRatio':
                        content = `<div class="stat-label-secondary">💬%</div>
                                  <div class="stat-value-primary">${stats.avgCommentRatio || 0}%</div>`;
                        classes.push('group-stats');
                        break;
                    case 'sizeKB':
                        content = `<div class="stat-label-secondary">📦 size</div>
                                  <div class="stat-value-primary">${formatSizeKB((stats.size || 0) / 1024)}</div>
                                  <div class="stat-label-secondary">Avg: ${count > 0 ? formatSizeKB((stats.size || 0) / 1024 / count) : '0 KB'}</div>`;
                        classes.push('group-stats');
                        break;
                    case 'directory':
                        // Directory column moved to position >= 2 (shouldn't normally happen but handle it)
                        content = `<div class="stat-label-secondary">📁 directory</div>
                                  <div class="stat-value-primary">${value || "(root)"}</div>`;
                        classes.push('group-stats');
                        break;
                    case 'fileName':
                        // fileName column moved to position >= 2 (shouldn't normally happen but handle it)
                        content = `<div class="stat-label-secondary">📄 files</div>
                                  <div class="stat-value-primary">${count}</div>`;
                        classes.push('group-stats');
                        break;
                    default:
                        // Handle any unknown column types
                        content = `<div class="stat-label-secondary">${field}</div>
                                  <div class="stat-value-primary">-</div>`;
                        classes.push('group-stats');
                }
                
                // Generate the cell HTML for moveable columns (they follow their data column position)
                headerCells += `<div class="${classes.join(' ')}" 
                                     data-field="${field}" 
                                     style="width: ${width}px; min-width: ${width}px; flex: 0 0 ${width}px;">
                                    ${content}
                                </div>`;
            });
            
            return `
                <div class="native-group-header" 
                     data-directory="${value || ''}" 
                     data-count="${count}" 
                     data-stats='${JSON.stringify(stats)}'>
                    ${headerCells}
                </div>
            `;
        },
        columns: createTableColumns(),
        initialSort: [
            {column: "lines", dir: "desc"}
        ]
    });

    // Native Tabulator handles group headers automatically - no custom synchronization needed
    debug.info(`✅ Using native Tabulator group headers with built-in frozen column support for STANDALONE`);
    
    // Also update when table is rendered - STANDALONE (NO OVERLAY)
    window.filesTable.on("tableBuilt", function(){
        setTimeout(() => {
            updateGroupHeaderWidths();
            // STANDALONE: Skip overlay positioning to prevent table blocking
            debug.info(`🚫 STANDALONE: Skipping overlay setup to keep table unblocked`);
            
            // Clean up any interfering webview overlays
            const webviewOverlay = document.querySelector('.frozen-group-overlay');
            if (webviewOverlay) {
                debug.info(`🗑️ STANDALONE: Removing interfering webview overlay on tableBuilt`);
                webviewOverlay.remove();
            }
        }, 50);
    });
    
    // Add column resize listener for STANDALONE (NO OVERLAY)
    window.filesTable.on("columnResized", function(column){
        debug.verbose(`📏 STANDALONE Column resized: ${column.getField()} to ${column.getWidth()}px`);
        updateGroupHeaderWidths();
        // STANDALONE: Skip overlay updates
        debug.info(`🚫 STANDALONE: Skipping overlay update on column resize`);
    });

    // Add column move listener for STANDALONE (NO OVERLAY)
    window.filesTable.on("columnMoved", function(column, columns){
        debug.info(`🔄 [STANDALONE] Column moved: ${column.getField()}`);
        debug.info(`🔄 [STANDALONE] New column order:`, columns.map(col => col.getField()));
        updateGroupHeaderStructure();
        updateGroupHeaderWidths();
        // STANDALONE: Skip overlay updates
        debug.info(`🚫 STANDALONE: Skipping overlay update on column move`);
    });

    // Add group toggle listeners for expand/collapse events for STANDALONE (NO OVERLAY)
    window.filesTable.on("groupToggled", function(group){
        debug.verbose(`🔽 STANDALONE Group toggled: ${group.getKey()}`);
        // STANDALONE: Skip overlay updates
        debug.info(`🚫 STANDALONE: Skipping overlay update on group toggle`);
    });

    // Add data sort listener for when columns are sorted for STANDALONE (NO OVERLAY)
    window.filesTable.on("dataSorted", function(sorters, rows){
        debug.verbose(`🔄 STANDALONE Data sorted by: ${sorters.map(s => s.field + ' ' + s.dir).join(', ')}`);
        // STANDALONE: Skip overlay updates
        debug.info(`🚫 STANDALONE: Skipping overlay update on data sort`);
    });

    // Scroll listener is now set up in the tableBuilt callback

    // Add resize observer for window/container resize events for STANDALONE
    if (window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(() => {
            updateGroupHeaderWidths();
        });
        
        const tableContainer = document.querySelector('#files-table-tabulator');
        if (tableContainer) {
            resizeObserver.observe(tableContainer);
        }
    }

    debug.info('✅ STANDALONE Tabulator table initialized successfully');
    debug.info('📊 STANDALONE Final table data count:', window.filesTable.getData().length);
    debug.info('📊 STANDALONE Processed files count:', processedFiles.length);
    
    return window.filesTable;
}

// Ensure the function is globally accessible
window.initializeAdvancedTable_Standalone = initializeAdvancedTable_Standalone;

//# sourceURL=tabulator-manager-standalone.js