// VS Code Code Counter Extension - WebView Report JavaScript

// Acquire VS Code API for webview communication
const vscode = acquireVsCodeApi();

// Debug wrapper that sends messages to VS Code extension debugService
const debug = {
    verbose: (...args) => {
        vscode.postMessage({
            command: 'debugLog',
            level: 'verbose',
            message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
        });
    },
    info: (...args) => {
        vscode.postMessage({
            command: 'debugLog',
            level: 'info',
            message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
        });
    },
    warning: (...args) => {
        vscode.postMessage({
            command: 'debugLog',
            level: 'warning',
            message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
        });
    },
    error: (...args) => {
        vscode.postMessage({
            command: 'debugLog',
            level: 'error',
            message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
        });
    }
};

// Embedded JSON data (direct format)
const embeddedJsonData = '{{JSON_DATA}}';

debug.info('🌐 WebView script loaded');
debug.info('📊 Embedded JSON data available:', !!embeddedJsonData && embeddedJsonData !== '{{JSON_DATA}}');

// Parse JSON data directly
let reportData = null;

try {
    if (embeddedJsonData && embeddedJsonData !== '{{JSON_DATA}}') {
        debug.info('📥 Parsing JSON data...');
        reportData = JSON.parse(embeddedJsonData);
        debug.info('✅ JSON parsed successfully');
    } else {
        debug.warning('⚠️ No embedded JSON data found');
    }
} catch (error) {
    debug.error('❌ Error parsing JSON data:', error);
}

// Initialize report when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    debug.info('🚀 DOM ready, initializing report...');
    
    if (reportData) {
        debug.info('📊 Report data available, initializing...');
        initializeReport(reportData);
    } else {
        debug.error('❌ No report data available');
        showError('No report data available');
    }
});

// Setup button handlers
document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshBtn2 = document.getElementById('refresh-btn2');
    const exportBtn = document.getElementById('export-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const groupLanguageBtn = document.getElementById('group-language-btn');
    const groupDirectoryBtn = document.getElementById('group-directory-btn');
    const clearGroupBtn = document.getElementById('clear-group-btn');
    const clearAllFiltersBtn = document.getElementById('clear-all-filters-btn');
    
    if (clearAllFiltersBtn) {
        clearAllFiltersBtn.addEventListener('click', () => {
            debug.info('🔄 Clear All Filters clicked');
            // Clear all table filters
            if (filesTable) {
                filesTable.clearFilter();
                debug.info('✅ All table filters cleared');
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
            
            debug.info('✅ All UI filter controls reset');
        });
    }
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            debug.info('🔄 Refresh button clicked');
            vscode.postMessage({ command: 'refresh' });
        });
    }
    
    if (refreshBtn2) {
        refreshBtn2.addEventListener('click', () => {
            debug.info('🔄 Refresh button clicked');
            vscode.postMessage({ command: 'refresh' });
        });
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            debug.info('📄 Export HTML button clicked');
            vscode.postMessage({ command: 'export' });
        });
    }

    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            debug.info('📊 Export CSV button clicked');
            if (filesTable) {
                filesTable.download("csv", "code-counter-report.csv");
                debug.info('✅ CSV download initiated');
            }
        });
    }

    if (groupLanguageBtn) {
        groupLanguageBtn.addEventListener('click', () => {
            debug.info('📂 Group by Language clicked');
            if (filesTable) {
                filesTable.setGroupBy("language");
                debug.info('✅ Grouped by language');
            }
        });
    }

    if (groupDirectoryBtn) {
        groupDirectoryBtn.addEventListener('click', () => {
            debug.info('📁 Group by Directory clicked');
            if (filesTable) {
                filesTable.setGroupBy("directory");
                debug.info('✅ Grouped by directory');
            }
        });
    }

    if (clearGroupBtn) {
        clearGroupBtn.addEventListener('click', () => {
            debug.info('📋 Clear Groups clicked');
            if (filesTable) {
                filesTable.setGroupBy(false);
                debug.info('✅ Groups cleared');
            }
        });
    }
});

// Function to open file in VS Code
function openFileInVSCode(filePath) {
    debug.info('🔗 Opening file in VS Code:', filePath);
    try {
        vscode.postMessage({
            command: 'openFile',
            filePath: filePath
        });
        debug.info('✅ Open file command sent to VS Code');
    } catch (error) {
        debug.error('❌ Failed to send open file command:', error);
    }
}

// Handle messages from VS Code extension
window.addEventListener('message', event => {
    const message = event.data;
    debug.info('📨 Received message from extension:', message);
    
    switch (message.command) {
        case 'updateData':
            debug.info('🔄 Updating report data...');
            if (message.data) {
                reportData = message.data;
                initializeReport(reportData);
                debug.info('✅ Report data updated successfully');
            } else {
                debug.error('❌ No data in updateData message');
            }
            break;
        default:
            debug.info('ℹ️ Unknown message command:', message.command);
    }
});

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

let filesTable = null;

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
        sizeKB: Math.round(file.size / 1024 * 10) / 10
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

    filesTable = new Tabulator("#files-table-tabulator", {
        data: processedFiles,
        layout: "fitColumns",
        height: "900px",
        pagination: false,
        paginationCounter: "rows",
        movableColumns: true,
        resizableRows: false,
        groupBy: "directory", // Default to directory grouping on load
        groupStartOpen: true,
        freezeColumn: 1,
        freeseRow: 1,
        groupHeader: function(value, count, data, group) {
            // Calculate totals and averages for numeric columns
            const rows = group.getRows();
            const totals = {
                totalLines: 0,
                codeLines: 0,
                commentLines: 0,
                blankLines: 0,
                size: 0
            };
            
            rows.forEach(row => {
                const data = row.getData();
                totals.totalLines += data.totalLines || 0;
                totals.codeLines += data.codeLines || 0;
                totals.commentLines += data.commentLines || 0;
                totals.blankLines += data.blankLines || 0;
                totals.size += data.size || 0;
            });
            
            const averages = {
                totalLines: Math.round(totals.totalLines / count),
                codeLines: Math.round(totals.codeLines / count),
                commentLines: Math.round(totals.commentLines / count),
                blankLines: Math.round(totals.blankLines / count),
                size: Math.round(totals.size / count)
            };
            
            function formatSize(bytes) {
                if (bytes === 0) return '0 B';
                const k = 1024;
                const sizes = ['B', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
            }
            
            function formatSizeKB(kb) {
                if (kb < 1) return `${Math.round(kb * 1024)} B`;
                if ((kb < 1024)) return `${kb.toFixed(1)} KB`;
                return `${(kb / 1024).toFixed(1)} MB`;
            }
            
            const avgCommentRatio = count > 0 ? Math.round((totals.commentLines / totals.totalLines) * 100) || 0 : 0;
            
            // Create a table-like structure aligned with columns
            return `
                <div style="display: flex; width: 100%; align-items: center; font-weight: bold;">
                    <div style="min-width: 150px;">
                        <strong>${value ?? ""}</strong>
                    </div>
                    <div style="min-width: 150px; flex-grow: 1;">
                        <span style="opacity: 0.8; font-weight: bold; color: #222;">(${count} files)</span>
                    </div>
                    <div style="width: 100px; text-align: right; font-size: 0.85em; font-weight: bold; opacity: 0.9; color: #222;">
                        <div>Lines: ${totals.totalLines.toLocaleString()}</div>
                        <div>Avg: ${averages.totalLines.toLocaleString()}</div>
                    </div>
                    <div style="width: 100px; text-align: right; font-size: 0.85em; font-weight: bold; opacity: 0.9; color: #222;">
                        <div>Code: ${totals.codeLines.toLocaleString()}</div>
                        <div>Avg: ${averages.codeLines.toLocaleString()}</div>
                    </div>
                    <div style="width: 100px; text-align: right; font-size: 0.85em; font-weight: bold; opacity: 0.9; color: #222;">
                        <div>Comments: ${totals.commentLines.toLocaleString()}</div>
                        <div>Avg: ${averages.commentLines.toLocaleString()}</div>
                    </div>
                    <div style="width: 100px; text-align: right; font-size: 0.85em; font-weight: bold; opacity: 0.9; color: #222;">
                        <div>Blanks: ${totals.blankLines.toLocaleString()}</div>
                        <div>Avg: ${averages.blankLines.toLocaleString()}</div>
                    </div>
                    <div style="width: 100px; text-align: right; font-size: 0.85em; font-weight: bold; opacity: 0.9; color: #222;">
                        ${avgCommentRatio}%
                    </div>
                    <div style="width: 100px; text-align: right; font-size: 0.85em; font-weight: bold; opacity: 0.9; color: #222;">
                        <div>Size: ${formatSizeKB(totals.size / 1024)}</div>
                        <div>Avg: ${formatSizeKB(averages.size / 1024)}</div>
                    </div>
                </div>
            `;
        },
        columns: [
            {
                title: "📁 Directory", 
                field: "directory", 
                minWidth: 150,
                sorter: "string",
                headerFilter: "select",
                headerFilterParams: {
                    values: true,
                    sortValuesList: "asc"
                },
                formatter: function(cell, formatterParams) {
                    const directory = cell.getValue();
                    const displayDir = directory === '' || directory === '.' ? '(root)' : directory;
                    return `<span title="${directory || '(root)'}" style="font-family: var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace); font-size: 0.9em; color: var(--vscode-textLink-foreground);">${displayDir === '(root)' ? '.' : displayDir}</span>`;
                }
            },
            {
                title: "📄 File", 
                field: "fileName", 
                minWidth: 150,
                sorter: "string",
                headerFilter: true,
                formatter: function(cell, formatterParams) {
                    const fileName = cell.getValue();
                    const fullPath = cell.getRow().getData().relativePath;
                    const absolutePath = cell.getRow().getData().path;
                    return `<a href="#" 
                               class="file-link" 
                               data-file-path="${absolutePath || fullPath}"
                               title="Click to open ${fullPath} in VS Code" 
                               style="font-family: var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace); 
                                      font-size: 0.9em; 
                                      color: var(--vscode-textLink-foreground); 
                                      text-decoration: none;
                                      cursor: pointer;"
                               onmouseover="this.style.textDecoration='underline'" 
                               onmouseout="this.style.textDecoration='none'"
                               onclick="openFileInVSCode('${(absolutePath || fullPath).replace(/'/g, "\\'")}'); return false;">${fileName}</a>`;
                }
            },
            {
                title: "💻 Language", 
                field: "language", 
                width: 120,
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
                    return `<span style="color: ${color};">${value}%</span>`;
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
                    if (kb < 1) return `${Math.round(kb * 1024)} B`;
                    if (kb < 1024) return `${kb} KB`;
                    return `${(kb / 1024).toFixed(1)} MB`;
                }
            }
        ],
        initialSort: [
            {column: "lines", dir: "desc"}
        ]
    });

    debug.info('✅ Tabulator table initialized successfully');
    return filesTable;
}

function setupAdvancedFiltering(files) {
    debug.info('🔧 Setting up advanced filtering...');
    
    // Populate language filter dropdown
    const languageFilter = document.getElementById('language-filter-tabulator');
    if (languageFilter) {
        const languages = [...new Set(files.map(f => f.language))].sort();
        languageFilter.innerHTML = '<option value="">All Languages</option>' + 
            languages.map(lang => `<option value="${lang}">${lang}</option>`).join('');
    }

    // File name search
    const fileSearch = document.getElementById('file-search-tabulator');
    if (fileSearch) {
        fileSearch.addEventListener('input', function() {
            if (this.value) {
                filesTable.setFilter("fileName", "like", this.value);
                debug.info('🔍 File search applied:', this.value);
            } else {
                filesTable.clearFilter("fileName");
                debug.info('🔄 File search cleared');
            }
        });
    }

    // Language filter
    if (languageFilter) {
        languageFilter.addEventListener('change', function() {
            if (this.value) {
                filesTable.setFilter("language", "=", this.value);
                debug.info('🔍 Language filter applied:', this.value);
            } else {
                // Clear all language filters when "All Languages" is selected
                filesTable.clearFilter("language");
                debug.info('🔄 Language filter cleared - showing all languages');
            }
        });
    }

    // Lines range filter
    const linesMin = document.getElementById('lines-min');
    const linesMax = document.getElementById('lines-max');
    
    function applyLinesFilter() {
        // Clear existing lines filters
        filesTable.clearFilter("lines");
        
        if (linesMin && linesMin.value) {
            filesTable.addFilter("lines", ">=", parseInt(linesMin.value));
        }
        if (linesMax && linesMax.value) {
            filesTable.addFilter("lines", "<=", parseInt(linesMax.value));
        }
        debug.info('🔍 Lines filter applied:', {min: linesMin?.value, max: linesMax?.value});
    }

    if (linesMin) linesMin.addEventListener('input', applyLinesFilter);
    if (linesMax) linesMax.addEventListener('input', applyLinesFilter);

    // Size range filter
    const sizeMin = document.getElementById('size-min');
    const sizeMax = document.getElementById('size-max');
    
    function applySizeFilter() {
        // Clear existing size filters
        filesTable.clearFilter("sizeKB");
        
        if (sizeMin && sizeMin.value) {
            filesTable.addFilter("sizeKB", ">=", parseFloat(sizeMin.value));
        }
        if (sizeMax && sizeMax.value) {
            filesTable.addFilter("sizeKB", "<=", parseFloat(sizeMax.value));
        }
        debug.info('🔍 Size filter applied:', {min: sizeMin?.value, max: sizeMax?.value});
    }

    if (sizeMin) sizeMin.addEventListener('input', applySizeFilter);
    if (sizeMax) sizeMax.addEventListener('input', applySizeFilter);

    // Quick filter buttons
    const quickFilterBtns = document.querySelectorAll('.quick-filter-btn');
    quickFilterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all buttons
            quickFilterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Clear all filters first
            filesTable.clearFilter();
            
            const filter = this.dataset.filter;
            switch(filter) {
                case 'large':
                    filesTable.setFilter("lines", ">", 500);
                    break;
                case 'small':
                    filesTable.setFilter("lines", "<", 50);
                    break;
                case 'no-comments':
                    filesTable.setFilter("commentLines", "=", 0);
                    break;
                case 'comment-heavy':
                    filesTable.setFilter([
                        {field: "commentLines", type: ">", value: 0},
                        function(data) {
                            const ratio = data.lines > 0 ? (data.commentLines / data.lines * 100) : 0;
                            return ratio > 20;
                        }
                    ]);
                    break;
                case 'all':
                default:
                    // No additional filters for 'all'
                    break;
            }
        });
    });

    debug.info('✅ Advanced filtering setup completed');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    if (errorDiv && errorText) {
        errorText.textContent = message;
        errorDiv.classList.remove('hidden');
    }
}

//# sourceURL=webview-report.js