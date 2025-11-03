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
        height: "900px",
        pagination: false,
        paginationCounter: "rows",
        movableColumns: true,
        resizableRows: false,
        groupBy: "directory", // Default to directory grouping on load
        groupStartOpen: true,
        frozenColumns: 2, // Freeze the first 2 columns (Directory and File)
        stickyHeaders: true, // Make headers sticky when scrolling
        stickyGroupHeaders: true, // Make group headers sticky when scrolling
        groupHeader: createGroupHeader,
        columns: createTableColumns(),
        initialSort: [
            {column: "lines", dir: "desc"}
        ]
    });

    // Add event listeners for dynamic group header updates
    window.filesTable.on("columnResized", function(column){
        debug.info('🔄 Column resized, updating group headers...');
        updateGroupHeaderWidths();
    });

    window.filesTable.on("columnMoved", function(column, columns){
        debug.info('🔄 Column moved, updating group headers...');
        updateGroupHeaderStructure();
    });

    // Initial update after table is fully loaded
    setTimeout(() => {
        updateGroupHeaderWidths();
    }, 100);
    
    // Also update when table is rendered
    window.filesTable.on("tableBuilt", function(){
        setTimeout(() => {
            updateGroupHeaderWidths();
        }, 50);
    });
    
    // Add scroll listener to maintain frozen column positioning
    const tableElement = document.querySelector('#files-table-tabulator');
    if (tableElement) {
        tableElement.addEventListener('scroll', function() {
            // Throttled update to avoid performance issues
            clearTimeout(window.scrollUpdateTimeout);
            window.scrollUpdateTimeout = setTimeout(() => {
                updateGroupHeaderWidths();
            }, 16); // ~60fps
        });
    }

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
                content = `<div>📄 ${count} files</div>
                          <div class="stat-label-secondary">${stats.languageCount} languages</div>`;
                alignment = 'center';
                break;
            case 'lines':
                content = `<div class="stat-label-secondary">total</div>
                            <div class="stat-value-primary">${stats.totalLines.toLocaleString()} lines</div>
                            <div class="stat-label-secondary">Avg: ${(stats.totalLines / count).toFixed(2)}</div>`;
                break;
            case 'codeLines':
                content = `<div class="stat-label-secondary">code lines</div>
                            <div class="stat-value-primary">${stats.codeLines.toLocaleString()} lines</div>
                            <div class="stat-label-secondary">Avg: ${(stats.codeLines / count).toFixed(2)}</div>`;
                break;
            case 'commentLines':
                content = `<div class="stat-label-secondary">comments</div>
                            <div class="stat-value-primary">${stats.commentLines.toLocaleString()} lines</div>
                            <div class="stat-label-secondary">Avg: ${(stats.commentLines / count).toFixed(2)}</div>`;
                break;
            case 'blankLines':
            content = `<div class="stat-label-secondary">blanks</div>
                        <div class="stat-value-primary">${stats.blankLines.toLocaleString()} lines</div>
                        <div class="stat-label-secondary">Avg: ${(stats.blankLines / count).toFixed(2)}</div>`;
                break;
            case 'commentRatio':
                content = `<div class="stat-label-secondary">💬%</div>
                            <div class="stat-value-primary">${stats.avgCommentRatio}%</div>`;
                break;
            case 'sizeKB':
                content = `<div class="stat-label-secondary">size</div>
                            <div class="stat-value-primary">${formatSizeKB(stats.size / 1024)}</div>
                            <div class="stat-label-secondary">Avg: ${formatSizeKB(stats.size / 1024 / count)}</div>`;
                break;
            default:
                content = '--';
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
        
        cellsHtml += `
            <td data-field="${field}" ${colspan}
                class="group-cell ${cssClasses.join(' ')}">
                ${content}
            </td>
        `;
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
            <div>📄 ${count} files</div>
            <div>🖥️ ${stats.languageCount} languages</div>
        </td>
        <td data-field="lines" class="group-cell group-cell-normal group-cell-lines">
            <div class="stat-label-secondary">total</div>
            <div class="stat-value-primary">${stats.totalLines.toLocaleString()} lines</div>
            <div class="stat-label-secondary">Avg: ${stats.totalLines / count}</div>
        </td>
        <td data-field="codeLines" class="group-cell group-cell-normal group-cell-lines">
            <div class="stat-label-secondary">code</div>    
            <div class="stat-value-primary">${stats.codeLines.toLocaleString()} lines</div>
            <div class="stat-label-secondary">Avg: ${stats.codeLines / count}</div>
        </td>
        <td data-field="commentLines" class="group-cell group-cell-normal group-cell-lines">
            <div class="stat-label-secondary">comments</div>    
            <div class="stat-value-primary">${stats.commentLines.toLocaleString()} lines</div>
            <div class="stat-label-secondary">Avg: ${stats.commentLines / count}</div>
        </td>
        <td data-field="blankLines" class="group-cell group-cell-normal group-cell-lines">
            <div class="stat-label-secondary">blanks</div>
            <div class="stat-value-primary">${stats.blankLines.toLocaleString()} lines</div>
            <div class="stat-label-secondary">Avg: ${stats.blankLines / count}</div>
        </td>
        <td data-field="commentRatio" class="group-cell group-cell-normal group-cell-comment-ratio">
            <div class="stat-label-secondary">💬%</div>
            <div class="stat-value-primary">${stats.avgCommentRatio}%</div>
        </td>
        <td data-field="sizeKB" class="group-cell group-cell-normal group-cell-size">
            <div class="stat-label-secondary">size</div>
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
            minWidth: 200,
            width: 200, // Fixed width for better frozen column appearance
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
            minWidth: 200,
            width: 200, // Fixed width for better frozen column appearance
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
 * Update group header column widths to match table columns
 */
function updateGroupHeaderWidths() {
    if (!window.filesTable) return;
    
    const columns = window.filesTable.getColumns();
    const groupHeaders = document.querySelectorAll('.dynamic-group-header');
    
    // Calculate combined width of first two columns for directory cell
    const firstTwoColumnsWidth = columns.length >= 2 ? 
        columns[0].getWidth() + columns[1].getWidth() : 
        columns[0]?.getWidth() || 200;
    
    groupHeaders.forEach(header => {
        // Handle directory cell (spans first 2 columns)
        const directoryCell = header.querySelector('td[data-field="directory"]');
        if (directoryCell) {
            directoryCell.style.width = `${firstTwoColumnsWidth}px`;
            directoryCell.style.minWidth = `${firstTwoColumnsWidth}px`;
            directoryCell.style.borderRight = '3px solid rgba(0, 152, 255, 0.5)';
            directoryCell.style.position = 'sticky';
            directoryCell.style.left = '0px';
            directoryCell.style.zIndex = '13';
        }
        
        // Handle all other cells (non-frozen columns)
        const otherCells = header.querySelectorAll('td[data-field]:not([data-field="directory"]):not([data-field="fileName"])');
        otherCells.forEach(cell => {
            // Remove inline width to let CSS min-width take effect
            cell.style.width = '';
            cell.style.minWidth = '';
            cell.style.borderRight = '';
            cell.style.position = 'static';
            cell.style.left = 'auto';
            cell.style.zIndex = 'auto';
        });
    });
    
    // Let Tabulator handle frozen column positioning automatically
    // Remove any conflicting inline styles that might override Tabulator's positioning
    if (columns.length >= 2) {
        const tableRows = document.querySelectorAll('.tabulator-row:not(.tabulator-group)');
        
        tableRows.forEach(row => {
            const frozenCells = row.querySelectorAll('.tabulator-cell.tabulator-frozen');
            frozenCells.forEach(cell => {
                // Remove any inline left positioning to let Tabulator handle it
                cell.style.left = '';
            });
        });
        
        // Also remove inline positioning from headers
        const headerCells = document.querySelectorAll('.tabulator-col.tabulator-frozen');
        headerCells.forEach(headerCell => {
            headerCell.style.left = '';
        });
        
        // Force Tabulator to recalculate frozen column positions
        if (window.filesTable) {
            window.filesTable.redraw(true);
        }
    }
    
    debug.info('✅ Group header widths updated');
}

/**
 * Update group header structure to match column order
 */
function updateGroupHeaderStructure() {
    if (!window.filesTable) return;
    
    const groupHeaders = document.querySelectorAll('.dynamic-group-header');
    
    groupHeaders.forEach(header => {
        const directory = header.getAttribute('data-directory');
        const count = parseInt(header.getAttribute('data-count'));
        const stats = JSON.parse(header.getAttribute('data-stats'));
        
        // Regenerate cells with current column order
        const newCells = generateGroupHeaderCells(directory, count, stats);
        const row = header.querySelector('.group-header-row');
        if (row) {
            row.innerHTML = newCells;
        }
    });
    
    debug.info('✅ Group header structure updated');
}

/**
 * Format file size in KB with appropriate units
 */
function formatSizeKB(kb) {
    if (kb < 1) return `${(kb * 1024).toLocaleString()} B`;
    if ((kb < 1024)) return `${kb.toFixed(2)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
}

//# sourceURL=tabulator-manager.js