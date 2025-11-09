/**
 * VS Code Code Counter Extension - UI Handlers Module (CLEAN MINIMAL VERSION)
 * 
 * Copyright (c) 2025 DelightfulGames
 * Licensed under the MIT License
 * 
 * Repository: https://github.com/DelightfulGames/vscode-code-counter
 * Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
 */

// Wrap in IIFE to prevent variable conflicts with other modules
(function() {
    'use strict';

    // Guard variables to prevent multiple initializations
    let uiHandlersInitialized = false;
    let dropdownsInitialized = false;

    /**
     * Generate CSV data from table
     */
    function generateCSVFromTable_Standalone() {
        console.log('STANDALONE: Generating CSV from table...');
        
        if (!window.filesTable) {
            throw new Error('No table data available');
        }

        const data = window.filesTable.getData();
        if (data.length === 0) {
            throw new Error('No data available for export');
        }

        // Create CSV header
        let csv = 'Directory,File,Language,Lines,Code Lines,Comment Lines,Blank Lines,Size\n';
        
        // Add data rows
        data.forEach(row => {
            const csvRow = [
                row.directory || '',
                row.fileName || '',
                row.language || '',
                row.lines || 0,
                row.codeLines || 0,
                row.commentLines || 0,
                row.blankLines || 0,
                row.size || 0
            ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
            
            csv += csvRow + '\n';
        });

        return csv;
    }

    /**
     * Download CSV file
     */
    function downloadCSV_Standalone() {
        try {
            const csvData = generateCSVFromTable_Standalone();
            const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `code-counter-report-${new Date().toISOString().slice(0,10)}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                console.log('STANDALONE: ✅ CSV download completed');
            }
        } catch (error) {
            console.error('STANDALONE: ❌ CSV download failed:', error);
            alert('Failed to download CSV: ' + error.message);
        }
    }

    /**
     * Generate JSON data from table
     */
    function generateJSONFromTable_Standalone() {
        console.log('STANDALONE: Generating JSON from table...');
        
        if (!window.filesTable) {
            throw new Error('No table data available');
        }

        const data = window.filesTable.getData();
        if (data.length === 0) {
            throw new Error('No data available for export');
        }

        // Create structured JSON with metadata
        const jsonData = {
            metadata: {
                generated: new Date().toISOString(),
                generator: 'VS Code Code Counter Extension',
                version: '1.0.0',
                totalFiles: data.length
            },
            summary: {
                totalLines: data.reduce((sum, row) => sum + (parseInt(row.lines) || 0), 0),
                totalCodeLines: data.reduce((sum, row) => sum + (parseInt(row.codeLines) || 0), 0),
                totalCommentLines: data.reduce((sum, row) => sum + (parseInt(row.commentLines) || 0), 0),
                totalBlankLines: data.reduce((sum, row) => sum + (parseInt(row.blankLines) || 0), 0),
                totalSize: data.reduce((sum, row) => sum + (parseInt(row.size) || 0), 0)
            },
            files: data.map(row => ({
                directory: row.directory || '',
                fileName: row.fileName || '',
                language: row.language || '',
                lines: parseInt(row.lines) || 0,
                codeLines: parseInt(row.codeLines) || 0,
                commentLines: parseInt(row.commentLines) || 0,
                blankLines: parseInt(row.blankLines) || 0,
                size: parseInt(row.size) || 0
            }))
        };

        return JSON.stringify(jsonData, null, 2);
    }

    /**
     * Download JSON file
     */
    function downloadJSON_Standalone() {
        try {
            const jsonData = generateJSONFromTable_Standalone();
            const blob = new Blob([jsonData], { type: 'application/json;charset=utf-8;' });
            const link = document.createElement('a');
            
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `code-counter-report-${new Date().toISOString().slice(0,10)}.json`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                console.log('STANDALONE: ✅ JSON download completed');
            }
        } catch (error) {
            console.error('STANDALONE: ❌ JSON download failed:', error);
            alert('Failed to download JSON: ' + error.message);
        }
    }

    /**
     * Handle export based on format
     */
    function handleExport_Standalone(format) {
        console.log(`STANDALONE: Handling export for format: ${format}`);
        
        try {
            switch (format) {
                case 'csv':
                    downloadCSV_Standalone();
                    break;
                case 'json':
                    downloadJSON_Standalone();
                    break;
                case 'xml':
                    alert('XML export temporarily disabled');
                    break;
                default:
                    throw new Error(`Unknown export format: ${format}`);
            }
        } catch (error) {
            console.error('STANDALONE: ❌ Export failed:', error);
            alert('Export failed: ' + error.message);
        }
    }

    /**
     * Setup export dropdown functionality
     */
    function setupExportDropdowns_Standalone() {
        console.log('STANDALONE: setupExportDropdowns_Standalone called!');
        
        if (dropdownsInitialized) {
            console.log('STANDALONE: Export dropdowns already initialized, skipping...');
            return;
        }

        try {
            // Setup dropdown button toggle functionality
            const dropdownBtns = document.querySelectorAll('.export-dropdown-btn');
            console.log('STANDALONE: Found dropdown buttons:', dropdownBtns.length);
            
            dropdownBtns.forEach((btn, index) => {
                console.log(`STANDALONE: Setting up dropdown button ${index}: ${btn.id}`);
                
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    console.log(`STANDALONE: Dropdown button clicked: ${btn.id}`);
                    
                    // Find the associated dropdown content
                    const dropdown = btn.parentElement;
                    const dropdownContent = dropdown.querySelector('.export-dropdown-content');
                    
                    if (dropdownContent) {
                        // Toggle dropdown visibility
                        const isVisible = dropdownContent.style.display === 'block';
                        dropdownContent.style.display = isVisible ? 'none' : 'block';
                        console.log(`STANDALONE: Dropdown ${isVisible ? 'hidden' : 'shown'}`);
                        
                        // Close other dropdowns
                        document.querySelectorAll('.export-dropdown-content').forEach(content => {
                            if (content !== dropdownContent) {
                                content.style.display = 'none';
                            }
                        });
                    }
                });
            });

            // Setup export link handlers
            const exportLinks = document.querySelectorAll('[data-export]');
            console.log('STANDALONE: Found export links:', exportLinks.length);
            
            exportLinks.forEach((link, index) => {
                const format = link.getAttribute('data-export');
                console.log(`STANDALONE: Setting up export link ${index}: ${format}`);
                
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    console.log(`STANDALONE: Export clicked for format: ${format}`);
                    
                    // Close the dropdown
                    const dropdownContent = link.closest('.export-dropdown-content');
                    if (dropdownContent) {
                        dropdownContent.style.display = 'none';
                    }
                    
                    handleExport_Standalone(format);
                });
            });

            // Close dropdowns when clicking outside
            document.addEventListener('click', function(e) {
                if (!e.target.closest('.export-dropdown')) {
                    document.querySelectorAll('.export-dropdown-content').forEach(content => {
                        content.style.display = 'none';
                    });
                }
            });

            dropdownsInitialized = true;
            console.log('STANDALONE: ✅ Export dropdowns initialized successfully');
            
        } catch (error) {
            dropdownsInitialized = false;
            console.error('STANDALONE: ❌ Failed to initialize export dropdowns:', error);
            throw error;
        }
    }

    /**
     * Setup group button functionality
     */
    function setupGroupButtons_Standalone() {
        console.log('STANDALONE: Setting up group buttons...');
        
        try {
            // Find specific group buttons by ID (matching actual HTML)
            const groupLanguageBtn = document.getElementById('group-language-btn');
            const groupDirectoryBtn = document.getElementById('group-directory-btn');
            const clearGroupBtn = document.getElementById('clear-group-btn');
            
            const groupButtons = [groupLanguageBtn, groupDirectoryBtn, clearGroupBtn].filter(btn => btn);
            console.log(`STANDALONE: Found ${groupButtons.length} group buttons`);
            
            // Setup group by language button
            if (groupLanguageBtn) {
                console.log('STANDALONE: Setting up group by language button');
                groupLanguageBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    console.log('STANDALONE: Group by language clicked');
                    
                    // Remove active class from other group buttons
                    groupButtons.forEach(b => b.classList.remove('active', 'selected'));
                    groupLanguageBtn.classList.add('active');
                    
                    // Apply grouping if table is available
                    if (window.filesTable && typeof window.filesTable.setGroupBy === 'function') {
                        console.log('STANDALONE: Applying group by language');
                        window.filesTable.setGroupBy('language');
                    } else {
                        console.log('STANDALONE: Table grouping not available');
                        manualGrouping_Standalone('language');
                    }
                });
            }
            
            // Setup group by directory button
            if (groupDirectoryBtn) {
                console.log('STANDALONE: Setting up group by directory button');
                groupDirectoryBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    console.log('STANDALONE: Group by directory clicked');
                    
                    // Remove active class from other group buttons
                    groupButtons.forEach(b => b.classList.remove('active', 'selected'));
                    groupDirectoryBtn.classList.add('active');
                    
                    // Apply grouping if table is available
                    if (window.filesTable && typeof window.filesTable.setGroupBy === 'function') {
                        console.log('STANDALONE: Applying group by directory');
                        window.filesTable.setGroupBy('directory');
                    } else {
                        console.log('STANDALONE: Table grouping not available');
                        manualGrouping_Standalone('directory');
                    }
                });
            }
            
            // Setup clear grouping button
            if (clearGroupBtn) {
                console.log('STANDALONE: Setting up clear grouping button');
                clearGroupBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    console.log('STANDALONE: Clear grouping clicked');
                    
                    // Remove active class from all group buttons
                    groupButtons.forEach(b => b.classList.remove('active', 'selected'));
                    
                    // Clear grouping if table is available
                    if (window.filesTable && typeof window.filesTable.setGroupBy === 'function') {
                        console.log('STANDALONE: Clearing table grouping');
                        window.filesTable.setGroupBy(false);
                    } else {
                        console.log('STANDALONE: Table grouping clear not available');
                    }
                });
            }
            
            console.log('STANDALONE: ✅ Group buttons setup completed');
            
        } catch (error) {
            console.error('STANDALONE: ❌ Failed to setup group buttons:', error);
        }
    }

    /**
     * Manual grouping fallback when table API not available
     */
    function manualGrouping_Standalone(groupType) {
        console.log(`STANDALONE: Attempting manual grouping by: ${groupType}`);
        
        // This is a fallback - in practice, the table library should handle grouping
        // But we can add basic sorting/organization here if needed
        if (window.filesTable && typeof window.filesTable.getData === 'function') {
            const data = window.filesTable.getData();
            console.log(`STANDALONE: Manual grouping data available: ${data.length} rows`);
            
            // Basic sorting by group field
            if (groupType === 'language' || groupType === 'extension') {
                data.sort((a, b) => (a.language || '').localeCompare(b.language || ''));
            } else if (groupType === 'directory' || groupType === 'folder') {
                data.sort((a, b) => (a.directory || '').localeCompare(b.directory || ''));
            }
            
            // Redraw table if possible
            if (typeof window.filesTable.setData === 'function') {
                window.filesTable.setData(data);
            }
        }
    }

    /**
     * Setup filter UI functionality
     */
    function setupFilterUI_Standalone() {
        console.log('STANDALONE: Setting up filter UI...');
        
        try {
            // Setup language filter dropdown (specific ID from HTML)
            const languageFilter = document.getElementById('language-filter-tabulator');
            if (languageFilter) {
                console.log('STANDALONE: Setting up language filter dropdown');
                
                languageFilter.addEventListener('change', function(e) {
                    const filterValue = e.target.value;
                    console.log(`STANDALONE: Language filter changed: "${filterValue}"`);
                    
                    if (window.filesTable && typeof window.filesTable.setFilter === 'function') {
                        if (filterValue && filterValue !== 'all' && filterValue !== '') {
                            window.filesTable.setFilter('language', '=', filterValue);
                        } else {
                            window.filesTable.clearFilter('language');
                        }
                    }
                });
            }
            
            // Setup numeric range filters (lines and size)
            const rangeFilters = [
                { min: 'lines-min', max: 'lines-max', field: 'lines' },
                { min: 'size-min', max: 'size-max', field: 'fileSize' }
            ];
            
            rangeFilters.forEach(filter => {
                const minInput = document.getElementById(filter.min);
                const maxInput = document.getElementById(filter.max);
                
                if (minInput && maxInput) {
                    console.log(`STANDALONE: Setting up range filter for ${filter.field}`);
                    
                    const applyRangeFilter = () => {
                        const minValue = parseFloat(minInput.value) || null;
                        const maxValue = parseFloat(maxInput.value) || null;
                        
                        console.log(`STANDALONE: Range filter ${filter.field}: ${minValue} - ${maxValue}`);
                        
                        if (window.filesTable && typeof window.filesTable.setFilter === 'function') {
                            // Clear existing filters for this field
                            window.filesTable.clearFilter(filter.field);
                            
                            // Apply new range filters
                            if (minValue !== null) {
                                window.filesTable.addFilter(filter.field, '>=', minValue);
                            }
                            if (maxValue !== null) {
                                window.filesTable.addFilter(filter.field, '<=', maxValue);
                            }
                        }
                    };
                    
                    minInput.addEventListener('input', applyRangeFilter);
                    maxInput.addEventListener('input', applyRangeFilter);
                }
            });
            
            // Setup any additional search inputs (generic fallback)
            const additionalSearchInputs = document.querySelectorAll('input[type="search"], .search-input[type="text"]');
            console.log(`STANDALONE: Found ${additionalSearchInputs.length} additional search inputs`);
            
            additionalSearchInputs.forEach((input, index) => {
                if (!input.id || !['lines-min', 'lines-max', 'size-min', 'size-max'].includes(input.id)) {
                    console.log(`STANDALONE: Setting up additional search input ${index}`);
                    
                    input.addEventListener('input', function(e) {
                        const filterValue = e.target.value.toLowerCase().trim();
                        console.log(`STANDALONE: Additional search input changed: "${filterValue}"`);
                        
                        if (window.filesTable && typeof window.filesTable.setFilter === 'function') {
                            if (filterValue) {
                                // Filter by multiple fields
                                window.filesTable.setFilter([
                                    {field: "fileName", type: "like", value: filterValue},
                                    {field: "directory", type: "like", value: filterValue},
                                    {field: "language", type: "like", value: filterValue}
                                ], "or");
                            } else {
                                window.filesTable.clearFilter();
                            }
                        }
                    });
                    
                    // Add placeholder if not set
                    if (!input.placeholder) {
                        input.placeholder = 'Filter files...';
                    }
                }
            });
            
            console.log('STANDALONE: ✅ Filter UI setup completed');
            
        } catch (error) {
            console.error('STANDALONE: ❌ Failed to setup filter UI:', error);
        }
    }

    /**
     * Setup clear filters functionality
     */
    function setupClearFilters_Standalone() {
        console.log('STANDALONE: Setting up clear filters...');
        
        try {
            // Find the specific clear filters button by ID (matching actual HTML)
            const clearFiltersBtn = document.getElementById('clear-all-filters-btn');
            
            if (clearFiltersBtn) {
                console.log('STANDALONE: Setting up clear all filters button');
                
                clearFiltersBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    console.log('STANDALONE: Clear all filters clicked');
                    
                    // Clear table filters
                    if (window.filesTable && typeof window.filesTable.clearFilter === 'function') {
                        window.filesTable.clearFilter();
                        console.log('STANDALONE: Table filters cleared');
                    }
                    
                    // Clear specific filter inputs by ID (matching actual HTML)
                    const filterInputs = [
                        'language-filter-tabulator',
                        'lines-min',
                        'lines-max', 
                        'size-min',
                        'size-max'
                    ];
                    
                    filterInputs.forEach(inputId => {
                        const input = document.getElementById(inputId);
                        if (input) {
                            input.value = '';
                            console.log(`STANDALONE: Cleared input: ${inputId}`);
                        }
                    });
                    
                    // Clear any generic search inputs as fallback
                    document.querySelectorAll('input[type="search"], .filter-input, .search-input[type="text"]').forEach(input => {
                        if (input.value) {
                            input.value = '';
                            console.log('STANDALONE: Cleared additional search input');
                        }
                    });
                    
                    // Remove active states from group buttons
                    const groupButtons = [
                        document.getElementById('group-language-btn'),
                        document.getElementById('group-directory-btn'),
                        document.getElementById('clear-group-btn')
                    ].filter(btn => btn);
                    
                    groupButtons.forEach(btn => {
                        btn.classList.remove('active', 'selected');
                    });
                    
                    // Clear grouping
                    if (window.filesTable && typeof window.filesTable.setGroupBy === 'function') {
                        window.filesTable.setGroupBy(false);
                        console.log('STANDALONE: Table grouping cleared');
                    }
                    
                    console.log('STANDALONE: ✅ All filters and grouping cleared');
                });
            } else {
                console.log('STANDALONE: Clear all filters button not found');
            }
            
            console.log('STANDALONE: ✅ Clear filters setup completed');
            
        } catch (error) {
            console.error('STANDALONE: ❌ Failed to setup clear filters:', error);
        }
    }

    /**
     * Setup additional UI controls
     */
    function setupAdditionalControls_Standalone() {
        console.log('STANDALONE: Setting up additional controls...');
        
        try {
            // Setup column toggle buttons
            const columnToggles = document.querySelectorAll('[data-column], .column-toggle');
            console.log(`STANDALONE: Found ${columnToggles.length} column toggle controls`);
            
            columnToggles.forEach((toggle, index) => {
                const columnName = toggle.getAttribute('data-column') || toggle.textContent.toLowerCase().trim();
                console.log(`STANDALONE: Setting up column toggle ${index}: ${columnName}`);
                
                toggle.addEventListener('click', function(e) {
                    e.preventDefault();
                    console.log(`STANDALONE: Column toggle clicked: ${columnName}`);
                    
                    toggle.classList.toggle('active');
                    const isVisible = toggle.classList.contains('active');
                    
                    // Toggle column visibility if table supports it
                    if (window.filesTable && typeof window.filesTable.toggleColumn === 'function') {
                        window.filesTable.toggleColumn(columnName);
                    } else if (window.filesTable && typeof window.filesTable.hideColumn === 'function') {
                        if (isVisible) {
                            window.filesTable.showColumn(columnName);
                        } else {
                            window.filesTable.hideColumn(columnName);
                        }
                    } else {
                        console.log('STANDALONE: Column toggle not supported by table');
                    }
                });
            });
            
            // Setup sort buttons
            const sortBtns = document.querySelectorAll('[data-sort], .sort-btn');
            console.log(`STANDALONE: Found ${sortBtns.length} sort buttons`);
            
            sortBtns.forEach((btn, index) => {
                const sortField = btn.getAttribute('data-sort') || btn.textContent.toLowerCase().trim();
                console.log(`STANDALONE: Setting up sort button ${index}: ${sortField}`);
                
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    console.log(`STANDALONE: Sort button clicked: ${sortField}`);
                    
                    // Toggle sort direction
                    const currentDirection = btn.getAttribute('data-direction') || 'asc';
                    const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
                    btn.setAttribute('data-direction', newDirection);
                    
                    // Update button appearance
                    document.querySelectorAll('[data-sort]').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    // Apply sort if table supports it
                    if (window.filesTable && typeof window.filesTable.setSort === 'function') {
                        window.filesTable.setSort(sortField, newDirection);
                    } else {
                        console.log('STANDALONE: Table sorting not supported');
                    }
                });
            });
            
            console.log('STANDALONE: ✅ Additional controls setup completed');
            
        } catch (error) {
            console.error('STANDALONE: ❌ Failed to setup additional controls:', error);
        }
    }

    /**
     * Setup UI handlers for standalone reports
     */
    function setupUIHandlers_Standalone() {
        console.log('STANDALONE: setupUIHandlers_Standalone called!');
        console.log('STANDALONE: Document ready state:', document.readyState);
        
        // Prevent multiple initializations
        if (uiHandlersInitialized) {
            console.log('STANDALONE: UI handlers already initialized, skipping...');
            return;
        }

        try {
            // Mark as initialized
            uiHandlersInitialized = true;
            
            // Setup theme toggle
            const themeToggle = document.getElementById('theme-toggle');
            if (themeToggle) {
                console.log('STANDALONE: Theme toggle found and configured');
                themeToggle.addEventListener('click', function() {
                    console.log('STANDALONE: Theme toggle clicked');
                    if (typeof toggleTheme === 'function') {
                        toggleTheme();
                    }
                });
            } else {
                console.log('STANDALONE: Theme toggle button not found');
            }

            // Setup group buttons
            setupGroupButtons_Standalone();
            
            // Setup filter functionality
            setupFilterUI_Standalone();
            
            // Setup clear filters button
            setupClearFilters_Standalone();
            
            // Setup additional UI controls
            setupAdditionalControls_Standalone();

            // Setup export functionality - delay if DOM not ready
            if (document.readyState === 'loading') {
                console.log('STANDALONE: DOM still loading, waiting...');
                document.addEventListener('DOMContentLoaded', function() {
                    console.log('STANDALONE: DOM loaded, setting up exports now');
                    setupExportDropdowns_Standalone();
                });
            } else {
                console.log('STANDALONE: DOM ready, setting up exports immediately');
                setupExportDropdowns_Standalone();
            }

            console.log('STANDALONE: ✅ UI handlers initialized successfully');
            
        } catch (error) {
            uiHandlersInitialized = false;
            console.error('STANDALONE: ❌ Failed to initialize UI handlers:', error);
            throw error;
        }
    }

    // Ensure functions are globally accessible
    window.setupUIHandlers_Standalone = setupUIHandlers_Standalone;
    window.setupUIHandlers = setupUIHandlers_Standalone;
    window.generateCSVFromTable_Standalone = generateCSVFromTable_Standalone;
    window.generateJSONFromTable_Standalone = generateJSONFromTable_Standalone;
    window.handleExport_Standalone = handleExport_Standalone;

})(); // Close IIFE

//# sourceURL=ui-handlers-minimal.js