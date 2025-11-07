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
    
    // Check if table is ready, retry if not
    if (!window.filesTable) {
        debug.warning('⚠️ Tabulator table not ready for filtering setup, retrying in 200ms...');
        setTimeout(() => setupAdvancedFiltering(files), 1000);
        return;
    }
    
    // Populate language filter dropdown
    populateLanguageFilter(files);
    
    // Setup individual filter handlers
    setupLanguageFilter();
    setupRangeFilters();
    
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

//# sourceURL=filter-manager.js