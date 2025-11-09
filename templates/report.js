/**
 * VS Code Code Counter Extension - Report JavaScript
 * 
 * Copyright (c) 2025 DelightfulGames
 * Licensed under the MIT License
 * 
 * Repository: https://github.com/DelightfulGames/vscode-code-counter
 * Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
 *
 * This file contains report-specific JavaScript functionality for standalone HTML reports.
 * It handles theme management, data parsing, and report initialization.
 */

// Debug wrapper that sends messages to VS Code extension debugService
const debug = {
    verbose: (...args) => {
        console.debug("[HTML REPORT VIEW] - "
             + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
        );
    },
    info: (...args) => {
        console.info("[HTML REPORT VIEW] - "
             + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
        );
    },
    warning: (...args) => {
        console.warn("[HTML REPORT VIEW] - "
             + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
        );
    },
    error: (...args) => {
        console.error("[HTML REPORT VIEW] - "
             + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
        );
    }
};

// Theme detection and application
let currentTheme = localStorage.getItem('theme') || 'auto';

// Debug: Log initial state
debug.verbose('Initial theme state:', {
    storedTheme: localStorage.getItem('theme'),
    currentTheme: currentTheme,
    systemPrefersDark: window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : 'unknown'
});

function updateThemeToggle() {
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');
    
    debug.verbose('updateThemeToggle called:', {
        currentTheme,
        themeIconExists: !!themeIcon,
        themeTextExists: !!themeText,
        domReadyState: document.readyState
    });
    
    // Check if elements exist (might be called before DOM ready)
    if (!themeIcon || !themeText) {
        debug.verbose('Theme toggle elements not found, skipping update');
        return;
    }
    
    const prefersDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false;
    const actuallyDark = currentTheme === 'dark' || (currentTheme === 'auto' && prefersDark);
    
    debug.verbose('Theme toggle update details:', {
        prefersDark,
        actuallyDark,
        currentTheme
    });
    
    if (currentTheme === 'auto') {
        themeIcon.textContent = actuallyDark ? '🌙' : '☀️';
        themeText.textContent = 'Auto';
    } else if (currentTheme === 'dark') {
        themeIcon.textContent = '🌙';
        themeText.textContent = 'Dark';
    } else {
        themeIcon.textContent = '☀️';
        themeText.textContent = 'Light';
    }
    
    debug.verbose('Updated button to:', {
        icon: themeIcon.textContent,
        text: themeText.textContent
    });
}

// Apply theme styles to document
function applyThemeStyles() {
    const prefersDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false;
    
    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else if (currentTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    } else if (currentTheme === 'auto') {
        // For auto mode, use system preference
        if (prefersDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme'); // Use default light theme
        }
    } else {
        // Fallback: remove attribute to use default light theme
        document.documentElement.removeAttribute('data-theme');
    }
    
    debug.verbose('Applied theme:', {
        currentTheme,
        prefersDark,
        dataTheme: document.documentElement.getAttribute('data-theme')
    });
}

// Apply theme and update UI
function applyTheme() {
    applyThemeStyles();
    updateThemeToggle();
}

function toggleTheme() {
    const themes = ['auto', 'light', 'dark'];
    const currentIndex = themes.indexOf(currentTheme);
    const newTheme = themes[(currentIndex + 1) % themes.length];
    
    debug.verbose('Theme toggle:', {
        from: currentTheme,
        to: newTheme,
        systemPrefersDark: window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : 'unknown'
    });
    
    currentTheme = newTheme;
    localStorage.setItem('theme', currentTheme);
    applyTheme();
}

// Listen for theme changes
if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', applyTheme);
    } else if (mediaQuery.addListener) {
        // Fallback for older browsers
        mediaQuery.addListener(applyTheme);
    }
}

// Apply theme styles immediately (before DOM ready)
applyThemeStyles();

// Setup theme toggle button and full theme application after DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
        // Now that DOM is ready, update the toggle UI
        updateThemeToggle();
    }
});

// Template-specific functionality for exported HTML files

// Path display toggle functionality
let showFullPaths = false;

// Embedded data (populated by HTML generator)
const embeddedXmlData = '{{XML_DATA_FALLBACK}}';
const embeddedJsonFiles = {{DATA_FILES}};

// Parse JSON data (preferred format)
function parseJSON() {
    try {
        debug.info('🔍 parseJSON called with embeddedJsonFiles:', {
            defined: !!embeddedJsonFiles,
            type: typeof embeddedJsonFiles,
            isArray: Array.isArray(embeddedJsonFiles),
            length: embeddedJsonFiles ? embeddedJsonFiles.length : 0,
            preview: embeddedJsonFiles ? JSON.stringify(embeddedJsonFiles).substring(0, 100) + '...' : 'undefined'
        });
        
        // Now embeddedJsonFiles should be the actual array, not a string
        if (!embeddedJsonFiles || !Array.isArray(embeddedJsonFiles) || embeddedJsonFiles.length === 0) {
            debug.warning('❌ No valid JSON data found - not an array or empty');
            return null;
        }
        
        debug.info('✅ JSON validation passed, processing array directly...');
        const files = embeddedJsonFiles; // It's already the parsed array
        debug.info('✅ Using embedded files array directly, file count:', files.length);
        
        // Calculate language statistics first
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
        
        const languages = Array.from(languageMap.values())
            .sort((a, b) => b.lines - a.lines); // Sort by lines descending
        
        // Calculate summary from files with safe numeric conversion
        const summary = {
            totalFiles: files.length || 0,
            totalLines: files.reduce((sum, file) => sum + (Number(file.lines) || 0), 0),
            totalCodeLines: files.reduce((sum, file) => sum + (Number(file.codeLines) || 0), 0),
            totalCommentLines: files.reduce((sum, file) => sum + (Number(file.commentLines) || 0), 0),
            totalBlankLines: files.reduce((sum, file) => sum + (Number(file.blankLines) || 0), 0),
            languageCount: languages.length
        };
        
        return { summary, languages, files };
    } catch (error) {
        debug.error('❌ Error in parseJSON function:', {
            message: error.message,
            name: error.name,
            stack: error.stack,
            dataLength: embeddedJsonFiles ? embeddedJsonFiles.length : 'undefined',
            dataType: typeof embeddedJsonFiles,
            dataStart: embeddedJsonFiles ? embeddedJsonFiles.substring(0, 50) : 'undefined'
        });
        return null;
    }
}

// Parse XML data (fallback)
function parseXML(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    
    const codeCounter = xmlDoc.querySelector('codeCounter');
    
    const files = Array.from(codeCounter.querySelectorAll('files file')).map(file => ({
        path: file.getAttribute('path'),
        relativePath: file.getAttribute('relativePath'),
        fullPath: file.getAttribute('fullPath') || file.getAttribute('relativePath'),
        language: file.getAttribute('language'),
        lines: parseInt(file.getAttribute('lines')) || 0,
        codeLines: parseInt(file.getAttribute('codeLines')) || 0,
        commentLines: parseInt(file.getAttribute('commentLines')) || 0,
        blankLines: parseInt(file.getAttribute('blankLines')) || 0,
        size: parseInt(file.getAttribute('size')) || 0
    }));
    
    const languages = Array.from(codeCounter.querySelectorAll('languageStats language')).map(lang => ({
        name: lang.getAttribute('name'),
        files: parseInt(lang.getAttribute('files')) || 0,
        lines: parseInt(lang.getAttribute('lines')) || 0
    }));
    
    // Calculate complete summary from files data
    const summary = {
        totalFiles: files.length || 0,
        totalLines: files.reduce((sum, file) => sum + (file.lines || 0), 0),
        totalCodeLines: files.reduce((sum, file) => sum + (file.codeLines || 0), 0),
        totalCommentLines: files.reduce((sum, file) => sum + (file.commentLines || 0), 0),
        totalBlankLines: files.reduce((sum, file) => sum + (file.blankLines || 0), 0),
        languageCount: languages.length
    };
    
    return { summary, languages, files };
}

// Format numbers with commas - safe version
function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) {
        return '0';
    }
    return Number(num).toLocaleString();
}

// Populate the report content
function populateReport() {
    try {
        // Use the embedded data parser from data-manager.js
        let data = null;
        
        if (typeof parseEmbeddedData === 'function') {
            debug.info('📥 Using embedded data parser from webview modules');
            data = parseEmbeddedData();
        }
        
        // Fall back to local parsing if embedded parser not available
        if (!data) {
            debug.info('📥 Falling back to local JSON parsing');
            data = parseJSON();
        }
        
        // Fall back to XML data if JSON not available
        if (!data) {
            if (!embeddedXmlData || embeddedXmlData === '{{XML_DATA_FALLBACK}}') {
                throw new Error('No embedded report data found');
            }
            debug.info('Using XML data as fallback');
            data = parseXML(embeddedXmlData);
        } else {
            debug.info('Using parsed data (preferred format)');
        }
        
        // Debug the data structure before passing to embedded functions
        debug.info('Report data structure check:', {
            hasData: !!data,
            hasSummary: !!(data && data.summary),
            summaryKeys: data && data.summary ? Object.keys(data.summary) : 'no summary',
            hasFiles: !!(data && data.files),
            filesCount: data && data.files ? data.files.length : 'no files',
            hasLanguages: !!(data && data.languages),
            languagesCount: data && data.languages ? data.languages.length : 'no languages'
        });
        
        // Use the embedded data-manager function to populate the report
        if (typeof populateReportFromData === 'function') {
            debug.info('Using embedded populateReportFromData function');
            try {
                populateReportFromData(data);
            } catch (error) {
                debug.error('Error in populateReportFromData:', error);
                debug.error('Falling back to basic population');
                populateFilesTable(data.files);
            }
        } else {
            debug.warning('populateReportFromData not available, using fallback');
            // Fallback to basic population
            populateFilesTable(data.files);
        }
        
        // Show report content
        const loadingIndicator = document.getElementById('loading-indicator');
        const reportContent = document.getElementById('report-content');
        
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
        if (reportContent) reportContent.classList.remove('hidden');               
        
    } catch (error) {
        debug.error('Error parsing report data:', error);
        const loadingIndicator = document.getElementById('loading-indicator');
        const errorMessage = document.getElementById('error-message');
        const errorText = document.getElementById('error-text');
        
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
        if (errorText) errorText.textContent = 'Error loading report data: ' + error.message;
        if (errorMessage) errorMessage.classList.remove('hidden');
    }
}

// Initialize the report when page loads (for exported HTML files)
document.addEventListener('DOMContentLoaded', () => {
    // Only populate if we have the expected template structure
    if (document.getElementById('summary-stats')) {
        populateReport();
    }
});

// Minimal Report-specific JavaScript using webview modules
let filesTable;

// Initialize Tabulator table using standalone functions
function initializeTabulatorTable(files) {
    debug.info('🚀 Initializing Tabulator table using standalone functions');
    
    // Check if the function exists before calling it
    if (typeof initializeAdvancedTable_Standalone === 'undefined') {
        debug.error('❌ initializeAdvancedTable_Standalone function is not defined!');
        debug.error('Available functions:', Object.getOwnPropertyNames(window).filter(name => name.includes('initialize') || name.includes('Table')));
        throw new Error('initializeAdvancedTable_Standalone function is not available');
    }
    
    debug.info('✅ initializeAdvancedTable_Standalone function found');
    
    // Use the standalone initializeAdvancedTable function specifically for report.html
    // This handles the different positioning requirements for standalone reports
    filesTable = initializeAdvancedTable_Standalone(files);
    window.filesTable = filesTable;
    
    debug.info('✅ Tabulator table initialized using standalone functions');
}

// Main table population function
function populateFilesTable(files) {
    if (typeof Tabulator !== 'undefined') {
        // Use Tabulator with standalone functionality
        initializeTabulatorTable(files);
        
        // Setup UI handlers from standalone module
        setupUIHandlers_Standalone();
        
        // Ensure language filter is populated if the function is available
        if (typeof populateLanguageFilter === 'function') {
            populateLanguageFilter(files);
            debug.info('✅ Language filter populated in fallback');
        } else {
            debug.warning('⚠️ populateLanguageFilter function not available');
        }
        
        // Ensure advanced filtering is set up if the function is available
        if (typeof setupAdvancedFiltering === 'function') {
            // Add a small delay to ensure table is fully ready
            setTimeout(() => {
                if (window.filesTable) {
                    setupAdvancedFiltering(files);
                    debug.info('✅ Advanced filtering set up in fallback');
                } else {
                    debug.error('❌ window.filesTable not available for filter setup');
                }
            }, 1000);
        } else {
            debug.warning('⚠️ setupAdvancedFiltering function not available');
        }
        
        debug.info('✅ Report initialized with standalone modules');
    } else {
        // Fallback to basic table
        populateBasicFilesTable(files);
    }
}

// Backup function for basic table (fallback when Tabulator isn't available)
function populateBasicFilesTable(files) {
    const tbody = document.getElementById('files-tbody');
    if (!tbody) return;
    
    const sortedFiles = [...files].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    
    tbody.innerHTML = sortedFiles.map(file => {
        const sizeKB = (file.size / 1024).toFixed(1);
        const commentRatio = file.lines > 0 ? (file.commentLines / file.lines * 100).toFixed(1) : 0;
        
        return `
            <tr>
                <td class="file-path">${escapeHtml(file.relativePath)}</td>
                <td>${escapeHtml(file.language)}</td>
                <td>${file.lines.toLocaleString()}</td>
                <td>${file.codeLines.toLocaleString()}</td>
                <td>${file.commentLines.toLocaleString()}</td>
                <td>${file.blankLines.toLocaleString()}</td>
                <td>${sizeKB} KB</td>
            </tr>
        `;
    }).join('');
}

// Setup group control handlers
function setupGroupControls() {
    const groupLanguageBtn = document.getElementById('group-language-btn');
    const groupDirectoryBtn = document.getElementById('group-directory-btn');
    const clearGroupBtn = document.getElementById('clear-group-btn');
    
    if (groupLanguageBtn) {
        groupLanguageBtn.addEventListener('click', () => {
            if (filesTable) {
                filesTable.setGroupBy("language");
                updateGroupButtonStates('language');
            }
        });
    }
    
    if (groupDirectoryBtn) {
        groupDirectoryBtn.addEventListener('click', () => {
            if (filesTable) {
                filesTable.setGroupBy("directory");
                updateGroupButtonStates('directory');
            }
        });
    }
    
    if (clearGroupBtn) {
        clearGroupBtn.addEventListener('click', () => {
            if (filesTable) {
                filesTable.setGroupBy(false);
                updateGroupButtonStates(null);
            }
        });
    }
}

// Update button states for grouping
function updateGroupButtonStates(activeGroup) {
    document.querySelectorAll('#group-language-btn, #group-directory-btn, #clear-group-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (activeGroup === 'language') {
        document.getElementById('group-language-btn')?.classList.add('active');
    } else if (activeGroup === 'directory') {
        document.getElementById('group-directory-btn')?.classList.add('active');
    } else if (activeGroup === null) {
        document.getElementById('clear-group-btn')?.classList.add('active');
    }
}

// HTML escaping utility function
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}