/**
 * VS Code Code Counter Extension - Filter Manager Module
 * 
 * Copyright (c) 2025 DelightfulGames
 * Licensed under the MIT License
 * 
 * Repository: https://github.com/DelightfulGames/vscode-code-counter
 * Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
 */

/**
 * Setup advanced filtering functionality for the table
 */
function setupAdvancedFiltering(files) {
    debug.info('🔧 Setting up advanced filtering...');
    
    // Populate language filter dropdown
    populateLanguageFilter(files);
    
    // Setup individual filter handlers
    setupFileSearchFilter();
    setupLanguageFilter();
    setupRangeFilters();
    setupQuickFilters();
    
    debug.info('✅ Advanced filtering setup completed');
}

/**
 * Populate the language filter dropdown with unique values
 */
function populateLanguageFilter(files) {
    const languageFilter = document.getElementById('language-filter-tabulator');
    if (languageFilter) {
        const languages = [...new Set(files.map(f => f.language))].sort();
        languageFilter.innerHTML = '<option value="">All Languages</option>' + 
            languages.map(lang => `<option value="${lang}">${lang}</option>`).join('');
    }
}

/**
 * Setup file name search filter
 */
function setupFileSearchFilter() {
    const fileSearch = document.getElementById('file-search-tabulator');
    if (fileSearch) {
        fileSearch.addEventListener('input', function() {
            if (this.value) {
                window.filesTable.setFilter("fileName", "like", this.value);
                debug.info('🔍 File search applied:', this.value);
            } else {
                window.filesTable.clearFilter("fileName");
                debug.info('🔄 File search cleared');
            }
        });
    }
}

/**
 * Setup language dropdown filter
 */
function setupLanguageFilter() {
    const languageFilter = document.getElementById('language-filter-tabulator');
    if (languageFilter) {
        languageFilter.addEventListener('change', function() {
            if (this.value) {
                window.filesTable.setFilter("language", "=", this.value);
                debug.info('🔍 Language filter applied:', this.value);
            } else {
                // Clear all language filters when "All Languages" is selected
                window.filesTable.clearFilter("language");
                debug.info('🔄 Language filter cleared - showing all languages');
            }
        });
    }
}

/**
 * Setup range filters for lines and size
 */
function setupRangeFilters() {
    setupLinesRangeFilter();
    setupSizeRangeFilter();
}

/**
 * Setup lines range filter (min/max)
 */
function setupLinesRangeFilter() {
    const linesMin = document.getElementById('lines-min');
    const linesMax = document.getElementById('lines-max');
    
    function applyLinesFilter() {
        // Clear existing lines filters
        window.filesTable.clearFilter("lines");
        
        if (linesMin && linesMin.value) {
            window.filesTable.addFilter("lines", ">=", parseInt(linesMin.value));
        }
        if (linesMax && linesMax.value) {
            window.filesTable.addFilter("lines", "<=", parseInt(linesMax.value));
        }
        debug.info('🔍 Lines filter applied:', {min: linesMin?.value, max: linesMax?.value});
    }

    if (linesMin) linesMin.addEventListener('input', applyLinesFilter);
    if (linesMax) linesMax.addEventListener('input', applyLinesFilter);
}

/**
 * Setup size range filter (min/max)
 */
function setupSizeRangeFilter() {
    const sizeMin = document.getElementById('size-min');
    const sizeMax = document.getElementById('size-max');
    
    function applySizeFilter() {
        // Clear existing size filters
        window.filesTable.clearFilter("sizeKB");
        
        if (sizeMin && sizeMin.value) {
            window.filesTable.addFilter("sizeKB", ">=", parseFloat(sizeMin.value));
        }
        if (sizeMax && sizeMax.value) {
            window.filesTable.addFilter("sizeKB", "<=", parseFloat(sizeMax.value));
        }
        debug.info('🔍 Size filter applied:', {min: sizeMin?.value, max: sizeMax?.value});
    }

    if (sizeMin) sizeMin.addEventListener('input', applySizeFilter);
    if (sizeMax) sizeMax.addEventListener('input', applySizeFilter);
}

/**
 * Setup quick filter buttons
 */
function setupQuickFilters() {
    const quickFilterBtns = document.querySelectorAll('.quick-filter-btn');
    quickFilterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all buttons
            quickFilterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Clear all filters first
            window.filesTable.clearFilter();
            
            const filter = this.dataset.filter;
            applyQuickFilter(filter);
        });
    });
}

/**
 * Apply specific quick filter
 */
function applyQuickFilter(filterType) {
    switch(filterType) {
        case 'large':
            window.filesTable.setFilter("lines", ">", 500);
            debug.info('🔍 Quick filter applied: Large files (>500 lines)');
            break;
        case 'small':
            window.filesTable.setFilter("lines", "<", 50);
            debug.info('🔍 Quick filter applied: Small files (<50 lines)');
            break;
        case 'no-comments':
            window.filesTable.setFilter("commentLines", "=", 0);
            debug.info('🔍 Quick filter applied: Files with no comments');
            break;
        case 'comment-heavy':
            window.filesTable.setFilter([
                {field: "commentLines", type: ">", value: 0},
                function(data) {
                    const ratio = data.lines > 0 ? (data.commentLines / data.lines * 100) : 0;
                    return ratio > 20;
                }
            ]);
            debug.info('🔍 Quick filter applied: Comment-heavy files (>20%)');
            break;
        case 'all':
        default:
            // No additional filters for 'all'
            debug.info('🔍 Quick filter applied: Show all files');
            break;
    }
}

//# sourceURL=filter-manager.js