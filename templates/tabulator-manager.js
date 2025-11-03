/**
 * VS Code Code Counter Extension - Tabulator Manager Module
 * 
 * Copyright (c) 2025 DelightfulGames
 * Licensed under the MIT License
 * 
 * Repository: https://github.com/DelightfulGames/vscode-code-counter
 * Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
 */

/**
 * Initialize the advanced Tabulator table with file data
 */
function initializeAdvancedTable(files) {
    debug.info('🚀 Initializing Tabulator table...');
    
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
            debug.verbose(`📊 Creating native group header for: ${value} (${count} files)`);
            
            // Calculate group statistics using the existing function
            const stats = calculateGroupStats(group, count);
            
            // Get current column widths and order
            const columns = window.filesTable ? window.filesTable.getColumns() : [];
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
                                  <div class="stat-value-primary">${stats.totalLines.toLocaleString()}</div>
                                  <div class="stat-label-secondary">Avg: ${(stats.totalLines / count).toFixed(1)}</div>`;
                        classes.push('group-stats');
                        break;
                    case 'codeLines':
                        content = `<div class="stat-label-secondary">📸 code</div>
                                  <div class="stat-value-primary">${stats.codeLines.toLocaleString()}</div>
                                  <div class="stat-label-secondary">Avg: ${(stats.codeLines / count).toFixed(1)}</div>`;
                        classes.push('group-stats');
                        break;
                    case 'commentLines':
                        content = `<div class="stat-label-secondary">💬 comments</div>
                                  <div class="stat-value-primary">${stats.commentLines.toLocaleString()}</div>
                                  <div class="stat-label-secondary">Avg: ${(stats.commentLines / count).toFixed(1)}</div>`;
                        classes.push('group-stats');
                        break;
                    case 'blankLines':
                        content = `<div class="stat-label-secondary">😶 blanks</div>
                                  <div class="stat-value-primary">${stats.blankLines.toLocaleString()}</div>
                                  <div class="stat-label-secondary">Avg: ${(stats.blankLines / count).toFixed(1)}</div>`;
                        classes.push('group-stats');
                        break;
                    case 'commentRatio':
                        content = `<div class="stat-label-secondary">💬%</div>
                                  <div class="stat-value-primary">${stats.avgCommentRatio}%</div>`;
                        classes.push('group-stats');
                        break;
                    case 'sizeKB':
                        content = `<div class="stat-label-secondary">📦 size</div>
                                  <div class="stat-value-primary">${formatSizeKB(stats.size / 1024)}</div>
                                  <div class="stat-label-secondary">Avg: ${formatSizeKB(stats.size / 1024 / count)}</div>`;
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
    debug.info(`✅ Using native Tabulator group headers with built-in frozen column support`);
    
    // Also update when table is rendered
    window.filesTable.on("tableBuilt", function(){
        setTimeout(() => {
            updateGroupHeaderWidths();
            // Initialize frozen overlay positioning
            const tableElement = document.querySelector('#files-table-tabulator .tabulator-tableholder');
            if (tableElement) {
                updateFixedGroupHeaderPositions(tableElement.scrollLeft, tableElement.scrollTop);
                
                // Set up scroll listener now that table is built
                debug.info(`🔍 Setting up scroll listener after table built`);
                tableElement.addEventListener('scroll', function() {
                    const scrollLeft = this.scrollLeft;
                    const scrollTop = this.scrollTop;
                    debug.info(`🚨 SCROLL EVENT TRIGGERED: horizontal=${scrollLeft}px, vertical=${scrollTop}px`);
                    debug.verbose(`📜 Table scrolled to ${scrollLeft}px horizontally, ${scrollTop}px vertically - updating group header fixed positioning`);
                    
                    updateFixedGroupHeaderPositions(scrollLeft, scrollTop);
                    debug.verbose(`✅ updateFixedGroupHeaderPositions completed for scroll event`);
                });
                debug.info(`🎨 Added scroll listener for group header fixed positioning`);
            }
        }, 50);
    });
    
    // Add column resize listener
    window.filesTable.on("columnResized", function(column){
        debug.verbose(`📏 Column resized: ${column.getField()} to ${column.getWidth()}px`);
        updateGroupHeaderWidths();
        // Update frozen overlay after resize
        const tableElement = document.querySelector('#files-table-tabulator .tabulator-tableholder');
        if (tableElement) {
            setTimeout(() => {
                updateFixedGroupHeaderPositions(tableElement.scrollLeft, tableElement.scrollTop);
            }, 10);
        }
    });

    // Add column move listener  
    window.filesTable.on("columnMoved", function(column, columns){
        debug.verbose(`🔄 Column moved: ${column.getField()}`);
        updateGroupHeaderStructure();
        updateGroupHeaderWidths();
        // Update frozen overlay after column move
        const tableElement = document.querySelector('#files-table-tabulator .tabulator-tableholder');
        if (tableElement) {
            setTimeout(() => {
                updateFixedGroupHeaderPositions(tableElement.scrollLeft, tableElement.scrollTop);
            }, 100);
        }
    });

    // Add group toggle listeners for expand/collapse events
    window.filesTable.on("groupToggled", function(group){
        debug.verbose(`🔽 Group toggled: ${group.getKey()}`);
        // Update frozen overlay after group expand/collapse
        const tableElement = document.querySelector('#files-table-tabulator .tabulator-tableholder');
        if (tableElement) {
            setTimeout(() => {
                updateFixedGroupHeaderPositions(tableElement.scrollLeft, tableElement.scrollTop);
            }, 50);
        }
    });

    // Add data sort listener for when columns are sorted
    window.filesTable.on("dataSorted", function(sorters, rows){
        debug.verbose(`🔄 Data sorted by: ${sorters.map(s => s.field + ' ' + s.dir).join(', ')}`);
        // Update frozen overlay after sorting since row positions change
        const tableElement = document.querySelector('#files-table-tabulator .tabulator-tableholder');
        if (tableElement) {
            setTimeout(() => {
                updateFixedGroupHeaderPositions(tableElement.scrollLeft, tableElement.scrollTop);
            }, 100);
        }
    });

    // Scroll listener is now set up in the tableBuilt callback

    // Add resize observer for window/container resize events
    if (window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(() => {
            updateGroupHeaderWidths();
        });
        
        const tableContainer = document.querySelector('#files-table-tabulator');
        if (tableContainer) {
            resizeObserver.observe(tableContainer);
        }
    }

    debug.info('✅ Tabulator table initialized successfully');
    return window.filesTable;
}

/**
 * Create dynamic group header that syncs with table columns
 */
function createGroupHeader(value, count, data, group) {
    // Calculate statistics
    const stats = calculateGroupStats(group, count);
    
    // Create a container with data attributes for easy updating
    return `
        <div class="dynamic-group-header" 
             data-directory="${value || ''}" 
             data-count="${count}"
             data-stats='${JSON.stringify(stats)}'>
            <table class="group-header-table">
                <tr class="group-header-row">
                    ${generateGroupHeaderCells(value, count, stats)}
                </tr>
            </table>
        </div>
    `;
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
 * Generate group header cells based on current column order and widths
 */
function generateGroupHeaderCells(value, count, stats) {
    if (!window.filesTable) {
        // Fallback for initial render
        return generateDefaultGroupHeaderCells(value, count, stats);
    }
    
    const columns = window.filesTable.getColumns();
    let cellsHtml = '';
    
    // Calculate combined width of first two columns for directory cell
    const firstTwoColumnsWidth = columns.length >= 2 ? 
        columns[0].getWidth() + columns[1].getWidth() : 
        columns[0]?.getWidth() || 200;
    
    columns.forEach((column, index) => {
        const field = column.getField();
        const width = column.getWidth();
        const isFrozen = index < 2; // First 2 columns are frozen
        
        let content = '';
        let alignment = 'center';
        
        switch (field) {
            case 'directory':
                content = `📁 ${value || "(root)"}`;
                alignment = 'left';
                break;
            case 'fileName':
                // Skip fileName column since directory spans both directory and fileName columns
                return;
            case 'language':
                content = `<div class="stat-value-primary">📄 ${count} files</div>
                            <div class="stat-label-secondary">🖥️ ${stats.languageCount} languages</div>`;
                alignment = 'center';
                break;
            case 'lines':
                content = `<div class="stat-label-secondary">📈 total</div>
                            <div class="stat-value-primary">${stats.totalLines.toLocaleString()} lines</div>
                            <div class="stat-label-secondary">Avg: ${(stats.totalLines / count).toFixed(2)}</div>`;
                break;
            case 'codeLines':
                content = `<div class="stat-label-secondary">📸 code</div>
                            <div class="stat-value-primary">${stats.codeLines.toLocaleString()} lines</div>
                            <div class="stat-label-secondary">Avg: ${(stats.codeLines / count).toFixed(2)}</div>`;
                break;
            case 'commentLines':
                content = `<div class="stat-label-secondary">💬 comments</div>
                            <div class="stat-value-primary">${stats.commentLines.toLocaleString()} lines</div>
                            <div class="stat-label-secondary">Avg: ${(stats.commentLines / count).toFixed(2)}</div>`;
                break;
            case 'blankLines':
            content = `<div class="stat-label-secondary">😶 blanks</div>
                        <div class="stat-value-primary">${stats.blankLines.toLocaleString()} lines</div>
                        <div class="stat-label-secondary">Avg: ${(stats.blankLines / count).toFixed(2)}</div>`;
                break;
            case 'commentRatio':
                content = `<div class="stat-label-secondary">💬%</div>
                            <div class="stat-value-primary">${stats.avgCommentRatio}%</div>`;
                break;
            case 'sizeKB':
                content = `<div class="stat-label-secondary">📦 size</div>
                            <div class="stat-value-primary">${formatSizeKB(stats.size / 1024)}</div>
                            <div class="stat-label-secondary">Avg: ${formatSizeKB(stats.size / 1024 / count)}</div>`;
                break;
            default:
                content = '';
        }
        
        // Build CSS classes based on column properties
        let cssClasses = [];
        let colspan = '';
        
        if (isFrozen) {
            cssClasses.push('group-cell-frozen');
            if (field === 'directory') {
                cssClasses.push('group-cell-directory');
            } else if (field === 'fileName') {
                cssClasses.push('group-cell-filename');
            }
        } else {
            cssClasses.push('group-cell-normal');
            // Add specific column classes
            if (field === 'language') cssClasses.push('group-cell-language');
            else if (field === 'lines') cssClasses.push('group-cell-lines');
            else if (field === 'codeLines') cssClasses.push('group-cell-lines');
            else if (field === 'commentLines') cssClasses.push('group-cell-lines');
            else if (field === 'blankLines') cssClasses.push('group-cell-lines');
            else if (field === 'commentRatio') cssClasses.push('group-cell-comment-ratio');
            else if (field === 'sizeKB') cssClasses.push('group-cell-size');
        }
        
        if (content !== '') {
            cellsHtml += `
                <td data-field="${field}" ${colspan}
                    class="group-cell ${cssClasses.join(' ')}">
                    ${content}
                </td>
            `;
        }
    });
    
    return cellsHtml;
}

/**
 * Default group header cells for initial render
 */
function generateDefaultGroupHeaderCells(value, count, stats) {
    return `
        <td data-field="directory" class="group-cell group-cell-frozen group-cell-directory group-cell-directory-combined" colspan="2">
            📁 ${value || "(root)"}
        </td>
        <td data-field="language" class="group-cell group-cell-normal group-cell-language">
            <div class="stat-value-primary">📄 ${count} files</div>
            <div class="stat-value-secondary">🖥️ ${stats.languageCount} languages</div>
        </td>
        <td data-field="lines" class="group-cell group-cell-normal group-cell-lines">
            <div class="stat-label-secondary">📈 total</div>
            <div class="stat-value-primary">${stats.totalLines.toLocaleString()} lines</div>
            <div class="stat-label-secondary">Avg: ${stats.totalLines / count}</div>
        </td>
        <td data-field="codeLines" class="group-cell group-cell-normal group-cell-lines">
            <div class="stat-label-secondary">📸 code</div>    
            <div class="stat-value-primary">${stats.codeLines.toLocaleString()} lines</div>
            <div class="stat-label-secondary">Avg: ${stats.codeLines / count}</div>
        </td>
        <td data-field="commentLines" class="group-cell group-cell-normal group-cell-lines">
            <div class="stat-label-secondary">💬 comments</div>    
            <div class="stat-value-primary">${stats.commentLines.toLocaleString()} lines</div>
            <div class="stat-label-secondary">Avg: ${stats.commentLines / count}</div>
        </td>
        <td data-field="blankLines" class="group-cell group-cell-normal group-cell-lines">
            <div class="stat-label-secondary">😶 blanks</div>
            <div class="stat-value-primary">${stats.blankLines.toLocaleString()} lines</div>
            <div class="stat-label-secondary">Avg: ${stats.blankLines / count}</div>
        </td>
        <td data-field="commentRatio" class="group-cell group-cell-normal group-cell-comment-ratio">
            <div class="stat-label-secondary">💬%</div>
            <div class="stat-value-primary">${stats.avgCommentRatio}%</div>
        </td>
        <td data-field="sizeKB" class="group-cell group-cell-normal group-cell-size">
            <div class="stat-label-secondary">📦 size</div>
            <div class="stat-value-primary">${formatSizeKB(stats.size / 1024)}</div>
            <div class="stat-label-secondary">Avg: ${formatSizeKB(stats.size / 1024 / count)}</div>
        </td>
    `;
}

/**
 * Create table column definitions
 */
function createTableColumns() {
    return [
        {
            title: "📁 Directory", 
            field: "directory", 
            minWidth: 150,
            width: 150, // Fixed width for better frozen column appearance
            sorter: "string",
            headerFilter: "select",
            headerFilterParams: {
                values: true,
                sortValuesList: "asc"
            },
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
                return `<a href="#" 
                           class="file-link" 
                           data-file-path="${absolutePath || fullPath}"
                           title="Click to open ${fullPath} in VS Code" 
                           onclick="openFileInVSCode('${(absolutePath || fullPath).replace(/'/g, "\\'")}'); return false;">${fileName}</a>`;
            }
        },
        {
            title: "💻 Language", 
            field: "language", 
            minWidth: 75,
            width: 150,
            sorter: "string",
            headerFilter: "select",
            headerFilterParams: {
                values: true,
                sortValuesList: "asc"
            }
        },
        {
            title: "📊 Lines", 
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
            headerFilter: "number",
            headerFilterPlaceholder: "Min lines..."
        },
        {
            title: "💼 Code", 
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
            title: "📝 Blanks", 
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
                return formatSizeKB(kb);  // Use the consistent formatSizeKB function
            }
        }
    ];
}

/**
 * Attach scroll listener to the correct Tabulator element
 */
function attachScrollListener() {
    debug.verbose(`🔍 Attempting to attach scroll listener...`);
    
    // Try multiple selectors in order of preference
    const selectors = [
        '#files-table-tabulator .tabulator-tableHolder',     // Standard Tabulator structure
        '#files-table-tabulator .tabulator-table .tabulator-tableHolder',  // Nested structure
        '#files-table-tabulator .tabulator-table',           // Alternative structure
        '#files-table-tabulator tbody',                      // Table body
        '#files-table-tabulator'                             // Main container as fallback
    ];
    
    let tableHolder = null;
    let foundSelector = null;
    
    for (const selector of selectors) {
        tableHolder = document.querySelector(selector);
        debug.verbose(`  🔍 Trying ${selector}: ${tableHolder ? 'FOUND' : 'NOT FOUND'}`);
        if (tableHolder) {
            foundSelector = selector;
            debug.verbose(`    Element classes: ${tableHolder.className}`);
            debug.verbose(`    Element tag: ${tableHolder.tagName}`);
            break;
        }
    }
    
    if (tableHolder) {
        debug.info(`✅ Found element: ${foundSelector}`);
        debug.verbose(`    Scroll dimensions: scrollWidth=${tableHolder.scrollWidth}, clientWidth=${tableHolder.clientWidth}`);
        debug.verbose(`    Overflow-x: ${getComputedStyle(tableHolder).overflowX}`);
        
        // Check if this element is actually scrollable
        const isScrollable = tableHolder.scrollWidth > tableHolder.clientWidth;
        debug.verbose(`    Is horizontally scrollable: ${isScrollable}`);
        
        if (isScrollable) {
            debug.info(`✅ Attaching scroll listener to scrollable element: ${foundSelector}`);
            tableHolder.addEventListener('scroll', function() {
                debug.verbose(`📜 SCROLL EVENT: scrollLeft=${this.scrollLeft}, scrollTop=${this.scrollTop}`);
                
                // Synchronize group header scroll position
                syncGroupHeaderScroll(this.scrollLeft);
                
                // Throttled width update to avoid performance issues
                clearTimeout(window.scrollUpdateTimeout);
                window.scrollUpdateTimeout = setTimeout(() => {
                    debug.verbose(`⏱️  Throttled updateGroupHeaderWidths called`);
                    updateGroupHeaderWidths();
                }, 16); // ~60fps
            });
        } else {
            debug.warning(`⚠️  Element found but not scrollable, searching for scrollable child...`);
            
            // Look for scrollable children - exclude individual cells
            const potentialContainers = tableHolder.querySelectorAll('div, table, tbody');
            let scrollableChild = null;
            
            debug.verbose(`    Checking ${potentialContainers.length} potential scrollable containers...`);
            
            for (const child of potentialContainers) {
                // Skip individual cells - we want containers
                if (child.classList.contains('tabulator-cell')) {
                    continue;
                }
                
                const isScrollable = child.scrollWidth > child.clientWidth;
                const hasOverflowX = getComputedStyle(child).overflowX !== 'visible';
                
                debug.verbose(`      ${child.tagName}.${child.className}: scrollable=${isScrollable}, overflow-x=${getComputedStyle(child).overflowX}`);
                
                if (isScrollable && hasOverflowX) {
                    scrollableChild = child;
                    debug.info(`✅ Found scrollable container: ${child.tagName}.${child.className}`);
                    break;
                }
            }
            
            if (scrollableChild) {
                debug.info(`✅ Attaching scroll listener to scrollable child`);
                scrollableChild.addEventListener('scroll', function() {
                    debug.verbose(`📜 SCROLL EVENT (child): scrollLeft=${this.scrollLeft}, scrollTop=${this.scrollTop}`);
                    
                    // Synchronize group header scroll position
                    syncGroupHeaderScroll(this.scrollLeft);
                    
                    // Throttled width update to avoid performance issues
                    clearTimeout(window.scrollUpdateTimeout);
                    window.scrollUpdateTimeout = setTimeout(() => {
                        debug.verbose(`⏱️  Throttled updateGroupHeaderWidths called`);
                        updateGroupHeaderWidths();
                    }, 16); // ~60fps
                });
            } else {
                debug.error(`❌ No scrollable elements found in DOM tree`);
                
                // Try using Tabulator's built-in scroll event
                if (window.filesTable && window.filesTable.on) {
                    debug.info(`🔄 Trying Tabulator's built-in scroll event`);
                    try {
                        window.filesTable.on('scrollHorizontal', function(left) {
                            debug.verbose(`📜 TABULATOR SCROLL EVENT: scrollLeft=${left}`);
                            syncGroupHeaderScroll(left);
                        });
                        debug.info(`✅ Attached to Tabulator scrollHorizontal event`);
                    } catch (e) {
                        debug.error(`❌ Failed to attach Tabulator scroll event: ${e.message}`);
                        
                        // Last resort: manually poll scroll position
                        debug.info(`🔄 Setting up manual scroll polling as fallback`);
                        let lastScrollLeft = 0;
                        setInterval(() => {
                            const tableEl = document.querySelector('#files-table-tabulator');
                            if (tableEl) {
                                const scrollableElements = tableEl.querySelectorAll('*');
                                for (const el of scrollableElements) {
                                    if (el.scrollLeft !== lastScrollLeft && el.scrollWidth > el.clientWidth) {
                                        debug.verbose(`📜 POLLING DETECTED SCROLL: scrollLeft=${el.scrollLeft}`);
                                        syncGroupHeaderScroll(el.scrollLeft);
                                        lastScrollLeft = el.scrollLeft;
                                        break;
                                    }
                                }
                            }
                        }, 100); // Poll every 100ms
                    }
                } else {
                    debug.error(`❌ Tabulator instance not available for event binding`);
                }
            }
        }
    } else {
        debug.error(`❌ Could not find any scrollable element for scroll listener`);
        
        // Log all available elements for debugging
        const allElements = document.querySelectorAll('#files-table-tabulator *');
        debug.verbose(`📊 Total elements in #files-table-tabulator: ${allElements.length}`);
        
        // Show first few elements and their classes
        Array.from(allElements).slice(0, 10).forEach((el, i) => {
            debug.verbose(`    Element ${i}: ${el.tagName}.${el.className} id="${el.id}"`);
        });
    }
}

/**
 * Synchronize group header scroll position with main table
 */
function syncGroupHeaderScroll(scrollLeft) {
    // Aggressive throttling - only allow one execution per animation frame
    if (syncGroupHeaderScroll.isThrottled) {
        debug.verbose(`� syncGroupHeaderScroll throttled, ignoring scrollLeft: ${scrollLeft}`);
        return;
    }
    
    debug.verbose(`🔄 syncGroupHeaderScroll called with scrollLeft: ${scrollLeft}`);
    
    // Set throttle flag
    syncGroupHeaderScroll.isThrottled = true;
    
    // Use requestAnimationFrame for smooth synchronization
    requestAnimationFrame(() => {
        debug.verbose(`⚡ Executing scroll sync for scrollLeft: ${scrollLeft}`);
        
        const groupHeaders = document.querySelectorAll('.dynamic-group-header');
        debug.verbose(`📋 Found ${groupHeaders.length} group headers`);
        
        groupHeaders.forEach((header, index) => {
            debug.verbose(`📂 Processing group header ${index}:`);
            
            // First, ensure frozen columns stay frozen
            const frozenCells = header.querySelectorAll('.group-cell-frozen');
            debug.verbose(`  ❄️  Found ${frozenCells.length} frozen cells`);
            frozenCells.forEach((cell, cellIndex) => {
                debug.verbose(`    Frozen cell ${cellIndex}: ${cell.textContent.substring(0, 30)}...`);
                debug.verbose(`    Current transform: ${cell.style.transform}`);
                debug.verbose(`    Current position: ${getComputedStyle(cell).position}`);
                
                // Explicitly keep frozen cells in place
                cell.style.transform = 'translateX(0px)';
                cell.style.position = 'sticky';
                cell.style.left = '0px';
                cell.style.zIndex = '12';
                
                debug.verbose(`    Frozen cell secured: transform=translateX(0px), position=sticky`);
            });
            
            // Then move non-frozen columns
            const nonFrozenCells = header.querySelectorAll('.group-cell-normal');
            debug.verbose(`  📊 Found ${nonFrozenCells.length} non-frozen cells`);
            
            nonFrozenCells.forEach((cell, cellIndex) => {
                const oldTransform = cell.style.transform;
                // Apply negative translation to simulate scrolling
                cell.style.transform = `translateX(-${scrollLeft}px)`;
                debug.verbose(`    Normal cell ${cellIndex}: ${cell.textContent.substring(0, 20)}...`);
                debug.verbose(`      Transform: ${oldTransform} → ${cell.style.transform}`);
            });
        });
        
        // Release throttle flag after a brief delay
        setTimeout(() => {
            syncGroupHeaderScroll.isThrottled = false;
            debug.verbose(`🟢 syncGroupHeaderScroll throttle released`);
        }, 16); // ~60fps throttling
    });
}

/**
 * Debug function to inspect current group header state
 */
function debugGroupHeaders() {
    debug.info(`🔍 === GROUP HEADER DEBUG REPORT ===`);
    
    const groupHeaders = document.querySelectorAll('.dynamic-group-header');
    debug.info(`📋 Total group headers found: ${groupHeaders.length}`);
    
    groupHeaders.forEach((header, index) => {
        debug.info(`📂 Group Header ${index}:`);
        debug.info(`  Container classes: ${header.className}`);
        debug.info(`  Container scroll: scrollLeft=${header.scrollLeft}`);
        
        const table = header.querySelector('.group-header-table');
        debug.info(`  Table found: ${table ? 'YES' : 'NO'}`);
        
        if (table) {
            const cells = table.querySelectorAll('td');
            debug.info(`  Total cells: ${cells.length}`);
            
            cells.forEach((cell, cellIndex) => {
                const classes = cell.className;
                const field = cell.getAttribute('data-field');
                const isFrozen = classes.includes('group-cell-frozen');
                const isNormal = classes.includes('group-cell-normal');
                
                debug.info(`    Cell ${cellIndex} (${field}):`);
                debug.info(`      Classes: ${classes}`);
                debug.info(`      Is Frozen: ${isFrozen}, Is Normal: ${isNormal}`);
                debug.info(`      Transform: ${cell.style.transform || 'none'}`);
                debug.info(`      Position: ${getComputedStyle(cell).position}`);
                debug.info(`      Width: ${getComputedStyle(cell).width}`);
                debug.info(`      Content: ${cell.textContent.substring(0, 50)}...`);
            });
        }
    });
    
    // Check main table scroll state
    const tableHolder = document.querySelector('#files-table-tabulator .tabulator-tableHolder');
    if (tableHolder) {
        debug.info(`📜 Main table scroll state:`);
        debug.info(`  scrollLeft: ${tableHolder.scrollLeft}`);
        debug.info(`  scrollWidth: ${tableHolder.scrollWidth}`);
        debug.info(`  clientWidth: ${tableHolder.clientWidth}`);
    }
}

// Make debug function available globally
window.debugGroupHeaders = debugGroupHeaders;

/**
 * Update group header column widths to match table columns with colspan support
 */
function updateGroupHeaderWidths() {
    debug.verbose(`🔧 updateGroupHeaderWidths called`);
    
    if (!window.filesTable) {
        debug.error(`❌ No filesTable found`);
        return;
    }
    
    const columns = window.filesTable.getColumns();
    const groupHeaders = document.querySelectorAll('.native-group-header');
    
    debug.verbose(`📊 Table has ${columns.length} columns`);
    debug.verbose(`📋 Found ${groupHeaders.length} group headers`);
    
    groupHeaders.forEach(header => {
        // Update combined directory-fileName cell (colspan="2")
        const combinedCell = header.querySelector('[data-field="directory-fileName"]');
        if (combinedCell) {
            const directoryColumn = columns.find(col => col.getField() === 'directory');
            const fileNameColumn = columns.find(col => col.getField() === 'fileName');
            
            if (directoryColumn && fileNameColumn) {
                const combinedWidth = directoryColumn.getWidth() + fileNameColumn.getWidth();
                combinedCell.style.width = `${combinedWidth}px`;
                combinedCell.style.minWidth = `${combinedWidth}px`;
                combinedCell.style.flex = `0 0 ${combinedWidth}px`;
                
                // Prepare for sticky positioning - JavaScript will handle the positioning
                combinedCell.classList.add('group-header-frozen-column');
                combinedCell.style.backgroundColor = 'var(--vscode-editorGroupHeader-tabsBackground)';
                combinedCell.style.zIndex = '20';
                
                debug.verbose(`📏 Updated combined cell width: ${combinedWidth}px prepared for frozen positioning`);
            }
        }
        
        // Update all other individual column cells
        columns.forEach((column, index) => {
            const field = column.getField();
            const width = column.getWidth();
            
            // Skip directory and fileName as they're handled by the combined cell
            if (field === 'directory' || field === 'fileName') {
                return;
            }
            
            const cell = header.querySelector(`[data-field="${field}"]`);
            if (cell) {
                cell.style.width = `${width}px`;
                cell.style.minWidth = `${width}px`;
                cell.style.flex = `0 0 ${width}px`;
                
                debug.verbose(`📏 Updated ${field} cell width: ${width}px`);
            }
        });
    });
    
    // Get current scroll positions and update fixed group header positions
    const tableElement = document.querySelector('#files-table-tabulator .tabulator-tableholder');
    if (tableElement) {
        const scrollLeft = tableElement.scrollLeft;
        const scrollTop = tableElement.scrollTop;
        updateFixedGroupHeaderPositions(scrollLeft, scrollTop);
    }
    
    debug.info('✅ Group header widths updated with fixed positioning');
}

/**
 * Update group header structure to match column order
 * Note: With native Tabulator group headers, structure is automatically regenerated
 * This function triggers a table redraw to refresh all group headers
 */
function updateGroupHeaderStructure() {
    if (!window.filesTable) return;
    
    debug.verbose('🔄 Triggering table redraw to update native group header structure');
    
    // Force Tabulator to regenerate group headers with current column structure
    window.filesTable.redraw(true);
    
    // Also update widths after structure change
    setTimeout(() => {
        updateGroupHeaderWidths();
    }, 50);
    
    debug.info('✅ Group header structure updated via native Tabulator redraw');
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
 * Update frozen group header positions using overlay approach
 * Creates fixed overlay elements that don't scroll with the table
 */
function updateFixedGroupHeaderPositions(scrollLeft, scrollTop) {
    debug.info(`🚨 updateFixedGroupHeaderPositions CALLED: scrollLeft=${scrollLeft}, scrollTop=${scrollTop}`);
    debug.verbose(`🔧 updateFixedGroupHeaderPositions called with scrollLeft: ${scrollLeft}, scrollTop: ${scrollTop}`);
    
    // Get or create the frozen overlay container
    let frozenOverlay = document.querySelector('.frozen-group-overlay');
    if (!frozenOverlay) {
        frozenOverlay = document.createElement('div');
        frozenOverlay.className = 'frozen-group-overlay';
        frozenOverlay.style.position = 'absolute';
        frozenOverlay.style.pointerEvents = 'none';
        frozenOverlay.style.zIndex = '25';
        
        // Position the overlay relative to the table container (non-scrolling parent)
        const tableContainer = document.querySelector('#files-table-tabulator');
        const tableholder = document.querySelector('#files-table-tabulator .tabulator-tableholder');
        if (tableContainer && tableholder) {
            tableContainer.appendChild(frozenOverlay);
            
            // Position overlay to cover the tableholder area within the container
            const tableholderRect = tableholder.getBoundingClientRect();
            const containerRect = tableContainer.getBoundingClientRect();
            
            frozenOverlay.style.top = `${tableholderRect.top - containerRect.top}px`;
            frozenOverlay.style.left = `${tableholderRect.left - containerRect.left}px`;
            frozenOverlay.style.width = `${tableholder.offsetWidth}px`;
            frozenOverlay.style.height = `${tableholder.offsetHeight}px`;
        } else {
            debug.error('❌ Could not find tableholder');
            return;
        }
    }
    
    // Update overlay container position to account for vertical scrolling
    const tableContainer = document.querySelector('#files-table-tabulator');
    const tableholder = document.querySelector('#files-table-tabulator .tabulator-tableholder');
    if (tableContainer && tableholder) {
        const tableholderRect = tableholder.getBoundingClientRect();
        const containerRect = tableContainer.getBoundingClientRect();
        
        const newTop = tableholderRect.top - containerRect.top;
        debug.verbose(`🔄 Updating overlay position: scrollLeft=${scrollLeft}, scrollTop=${scrollTop}`);
        debug.verbose(`📊 Container top: ${containerRect.top}, Tableholder top: ${tableholderRect.top}, New overlay top: ${newTop}px`);
        
        // Update overlay position - this makes it move with vertical scrolling
        frozenOverlay.style.top = `${newTop}px`;
        debug.verbose(`📍 Overlay style.top set to: ${frozenOverlay.style.top}`);
    }
    
    // Restore moved chevrons to their original positions before clearing overlay
    const movedChevrons = frozenOverlay.querySelectorAll('.tabulator-arrow');
    movedChevrons.forEach(chevron => {
        if (chevron._originalParent) {
            const originalParent = chevron._originalParent;
            const originalNextSibling = chevron._originalNextSibling;
            
            // Restore the chevron to its original position
            if (originalNextSibling && originalNextSibling.parentNode === originalParent) {
                originalParent.insertBefore(chevron, originalNextSibling);
            } else {
                originalParent.appendChild(chevron);
            }
            
            // Clean up stored references
            delete chevron._originalParent;
            delete chevron._originalNextSibling;
            
            debug.verbose(`📍 Restored chevron to original position`);
        }
    });
    
    // Clear existing overlay content
    frozenOverlay.innerHTML = '';
    
    // Find all group header rows and create frozen overlays for them
    const groupRows = document.querySelectorAll('.tabulator-row.tabulator-group');
    debug.info(`🔍 Found ${groupRows.length} group rows to process`);
    
    groupRows.forEach((groupRow, index) => {
        debug.verbose(`📋 Processing group row ${index + 1}/${groupRows.length}`);
        const nativeHeader = groupRow.querySelector('.native-group-header');
        const originalCell = nativeHeader?.querySelector('[data-field="directory-fileName"]');
        
        if (!originalCell || !nativeHeader) return;
        
        // Get row position relative to table container and account for scroll
        const tableContainer = document.querySelector('#files-table-tabulator');
        const tableholder = document.querySelector('#files-table-tabulator .tabulator-tableholder');
        
        if (!tableContainer || !tableholder) return;
        
        // Get positions relative to table container (our overlay parent)
        const containerRect = tableContainer.getBoundingClientRect();
        const tableholderRect = tableholder.getBoundingClientRect();
        const rowRect = groupRow.getBoundingClientRect();
        
        // Calculate position relative to container accounting for tableholder offset
        // Vertical: row position relative to container (already accounts for scrolling naturally)
        // Horizontal: stay at left edge of tableholder (don't change - it's working!)
        const topOffset = rowRect.top - containerRect.top;
        const leftOffset = tableholderRect.left - containerRect.left; // Stay at left edge of tableholder
        
        // Get column widths
        const directoryColumn = window.filesTable?.getColumn('directory');
        const fileNameColumn = window.filesTable?.getColumn('fileName');
        const combinedWidth = (directoryColumn?.getWidth() || 150) + (fileNameColumn?.getWidth() || 200);
        
        // Create the frozen overlay element
        const frozenCell = document.createElement('div');
        frozenCell.className = 'frozen-group-cell';
        frozenCell.innerHTML = originalCell.innerHTML;
        
        // Find and move the expand/collapse chevron from the group row
        const chevron = groupRow.querySelector('.tabulator-arrow');
        if (chevron) {
            // Store original parent and next sibling for restoration
            const originalParent = chevron.parentNode;
            const originalNextSibling = chevron.nextSibling;
            
            // Get the group object from Tabulator to access toggle functionality
            const groupComponent = groupRow._group;
            
            // If _group is not available, try to get it from the table's groups
            let alternativeGroupComponent = null;
            if (!groupComponent) {
                // Get the directory value from the group row
                const directoryValue = groupRow.querySelector('[data-directory]')?.getAttribute('data-directory');
                debug.info(`🔍 Looking for group with directory: "${directoryValue}"`);
                
                if (window.filesTable) {
                    const groups = window.filesTable.getGroups();
                    debug.info(`🔍 Available groups: ${groups.map(g => `"${g.getKey()}"`).join(', ')}`);
                    
                    // Try exact match first
                    alternativeGroupComponent = groups.find(g => g.getKey() === directoryValue);
                    
                    // Special handling for root group - try common root representations
                    if (!alternativeGroupComponent && (directoryValue === '' || directoryValue === null || directoryValue === undefined)) {
                        debug.info(`🔍 Trying to find root group with various key formats`);
                        alternativeGroupComponent = groups.find(g => {
                            const key = g.getKey();
                            return key === '' || key === '.' || key === '/' || key === 'root' || key === null || key === undefined;
                        });
                        if (alternativeGroupComponent) {
                            debug.info(`🔍 Found root group with key: "${alternativeGroupComponent.getKey()}"`);
                        }
                    }
                    
                    debug.info(`🔍 Found alternative group component: ${!!alternativeGroupComponent}`);
                }
            }
            
            // Determine if group is currently expanded
            const isExpanded = groupRow.classList.contains('tabulator-group-visible');
            debug.verbose(`📋 Group ${groupComponent ? groupComponent.key : 'unknown'} is ${isExpanded ? 'expanded' : 'collapsed'}`);
            
            // Update chevron appearance based on current state
            if (isExpanded) {
                chevron.classList.add('tabulator-arrow-down');
                chevron.style.borderTop = '6px solid #ffffff';
                chevron.style.borderLeft = '6px solid transparent';
                chevron.style.borderRight = '6px solid transparent';
                chevron.style.borderBottom = 'none';
            } else {
                chevron.classList.remove('tabulator-arrow-down');
                chevron.style.borderLeft = '6px solid #ffffff';
                chevron.style.borderTop = '6px solid transparent';
                chevron.style.borderBottom = '6px solid transparent';
                chevron.style.borderRight = 'none';
            }
            
            // Move the chevron to our frozen cell
            chevron.style.marginRight = '8px';
            frozenCell.insertBefore(chevron, frozenCell.firstChild);
            
            // Store restoration info on the chevron element
            chevron._originalParent = originalParent;
            chevron._originalNextSibling = originalNextSibling;
            
            // Remove all existing event listeners by cloning the element
            const newChevron = chevron.cloneNode(true);
            chevron.parentNode.replaceChild(newChevron, chevron);
            
            // Add our own click handler that properly toggles the group
            debug.info(`🎯 Setting up chevron click handler for group: ${groupComponent ? groupComponent.key : 'no component'}`);
            
            newChevron.addEventListener('click', function(e) {
                debug.info(`🚨 CHEVRON CLICKED! Event received`);
                e.stopPropagation();
                e.preventDefault();
                
                const activeGroupComponent = groupComponent || alternativeGroupComponent;
                
                debug.info(`🔽 Frozen chevron clicked for group: ${activeGroupComponent ? activeGroupComponent.getKey() : 'unknown'}`);
                debug.info(`🔍 Group component available: ${!!groupComponent}`);
                debug.info(`🔍 Alternative group component available: ${!!alternativeGroupComponent}`);
                debug.info(`🔍 Group row element: ${!!groupRow}`);
                
                if (activeGroupComponent && typeof activeGroupComponent.toggle === 'function') {
                    debug.info(`📞 Calling activeGroupComponent.toggle()`);
                    activeGroupComponent.toggle();
                } else if (groupRow) {
                    debug.info(`📞 Fallback: clicking group row directly`);
                    // Try clicking the original chevron instead of the row
                    const originalChevron = groupRow.querySelector('.tabulator-arrow');
                    if (originalChevron && originalChevron !== newChevron) {
                        debug.info(`📞 Found original chevron, clicking it`);
                        originalChevron.click();
                    } else {
                        debug.info(`📞 No original chevron found, clicking group row`);
                        groupRow.click();
                    }
                } else {
                    debug.error(`❌ No way to toggle group - no component or row available`);
                }
                
                // Update overlay after group expand/collapse
                setTimeout(() => {
                    debug.info(`🔄 Updating overlay positions after group toggle`);
                    updateFixedGroupHeaderPositions(scrollLeft, scrollTop);
                }, 100);
            });
            
            // Also try adding mousedown event as backup
            newChevron.addEventListener('mousedown', function(e) {
                debug.info(`🖱️ CHEVRON MOUSEDOWN detected`);
            });
            
            // Ensure chevron is clickable
            newChevron.style.cursor = 'pointer';
            newChevron.style.pointerEvents = 'auto';
            debug.info(`🎨 Chevron styling: cursor=${newChevron.style.cursor}, pointerEvents=${newChevron.style.pointerEvents}`);
            
            // Store the new chevron reference for restoration
            newChevron._originalParent = originalParent;
            newChevron._originalNextSibling = originalNextSibling;
        }
        
        // Position and style the frozen cell
        frozenCell.style.position = 'absolute';
        frozenCell.style.left = `${leftOffset}px`;
        frozenCell.style.top = `${topOffset}px`;
        frozenCell.style.width = `${combinedWidth}px`;
        frozenCell.style.height = `${rowRect.height}px`;
        frozenCell.style.backgroundColor = 'var(--vscode-editorGroupHeader-tabsBackground)';
        frozenCell.style.border = '1px solid var(--vscode-editorGroup-border)';
        frozenCell.style.borderRight = '2px solid var(--vscode-panel-border)';
        frozenCell.style.boxShadow = '2px 0 8px rgba(0, 0, 0, 0.4)';
        frozenCell.style.display = 'flex';
        frozenCell.style.alignItems = 'center';
        frozenCell.style.padding = '8px 12px';
        frozenCell.style.boxSizing = 'border-box';
        frozenCell.style.pointerEvents = 'auto'; // Allow interactions
        frozenCell.style.zIndex = '30';
        frozenCell.style.fontWeight = '600';
        frozenCell.style.color = '#ffffff';
        
        // Hide the original cell to avoid duplication
        originalCell.style.visibility = 'hidden';
        
        frozenOverlay.appendChild(frozenCell);
        
        debug.verbose(`📍 Created frozen overlay cell at top: ${topOffset}px, width: ${combinedWidth}px with chevron`);
    });
    
    debug.verbose(`✅ Updated frozen group header overlay with ${groupRows.length} cells`);
}

//# sourceURL=tabulator-manager.js