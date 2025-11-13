/**
 * VS Code Code Counter Extension
 * 
 * Copyright (c) 2025 DelightfulGames
 * Licensed under the MIT License
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 * Repository: https://github.com/DelightfulGames/vscode-code-counter
 * Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { FileInfo, LineCountResult } from '../types';
import { PathBasedSettingsService } from './pathBasedSettingsService';
import { DebugService } from './debugService';
import { BinaryDetectionService } from './binaryDetectionService';

export class LineCounterService {
    private debug = DebugService.getInstance();
    private binaryDetectionService: BinaryDetectionService | null = null;

    /**
     * Initialize binary detection service for the workspace
     */
    private initializeBinaryDetection(workspacePath: string): void {
        if (!this.binaryDetectionService) {
            this.binaryDetectionService = new BinaryDetectionService(workspacePath);
        }
    }
    
    async countLines(workspacePath: string, excludePatterns: string[] = []): Promise<LineCountResult> {
        this.initializeBinaryDetection(workspacePath);
        const files = await this.getFiles(workspacePath, excludePatterns);
        const fileInfos: FileInfo[] = [];
        
        let totalLines = 0;
        let totalFiles = 0;
        const languageStats: { [language: string]: { files: number; lines: number } } = {};

        for (const filePath of files) {
            try {
                const fileInfo = await this.countFileLines(filePath, workspacePath);
                fileInfos.push(fileInfo);
                
                totalLines += fileInfo.lines;
                totalFiles++;
                
                // Update language statistics
                if (!languageStats[fileInfo.language]) {
                    languageStats[fileInfo.language] = { files: 0, lines: 0 };
                }
                languageStats[fileInfo.language].files++;
                languageStats[fileInfo.language].lines += fileInfo.lines;
                
            } catch (error) {
                this.debug.warning(`Failed to count lines in ${filePath}:`, error);
            }
        }

        return {
            workspacePath,
            totalFiles,
            totalLines,
            files: fileInfos,
            languageStats,
            generatedAt: new Date()
        };
    }

    async countLinesWithInclusions(workspacePath: string, excludePatterns: string[] = [], includePatterns: string[] = []): Promise<LineCountResult> {
        const files = await this.getFilesWithInclusions(workspacePath, excludePatterns, includePatterns);
        const fileInfos: FileInfo[] = [];
        
        let totalLines = 0;
        let totalFiles = 0;
        const languageStats: { [language: string]: { files: number; lines: number } } = {};

        for (const filePath of files) {
            try {
                const fileInfo = await this.countFileLines(filePath, workspacePath);
                fileInfos.push(fileInfo);
                
                totalLines += fileInfo.lines;
                totalFiles++;
                
                // Update language statistics
                if (!languageStats[fileInfo.language]) {
                    languageStats[fileInfo.language] = { files: 0, lines: 0 };
                }
                languageStats[fileInfo.language].files++;
                languageStats[fileInfo.language].lines += fileInfo.lines;
                
            } catch (error) {
                this.debug.warning(`Failed to count lines in ${filePath}:`, error);
            }
        }

        return {
            workspacePath,
            totalFiles,
            totalLines,
            files: fileInfos,
            languageStats,
            generatedAt: new Date()
        };
    }

    private async getFiles(workspacePath: string, excludePatterns: string[]): Promise<string[]> {
        this.debug.info('getFiles starting with:', { workspacePath, excludePatterns });
        
        // Use VS Code's workspace API instead of glob
        const includePattern = new vscode.RelativePattern(workspacePath, '**/*');
        const excludePattern = excludePatterns.length > 0 
            ? `{${excludePatterns.join(',')}}` 
            : undefined;
        
        this.debug.info('VS Code findFiles patterns:', { includePattern: includePattern.pattern, excludePattern });
        
        const files = await vscode.workspace.findFiles(includePattern, excludePattern);
        
        this.debug.info('VS Code findFiles results:', { 
            totalFilesFound: files.length,
            sampleFiles: files.slice(0, 5).map(f => f.fsPath)
        });
        
        return files.map(file => file.fsPath);
    }

    /**
     * Fallback method to get files using Node.js file system when VS Code API fails
     */
    private async getFilesWithNodeJS(workspacePath: string): Promise<vscode.Uri[]> {
        const fs = require('fs').promises;
        const path = require('path');
        const files: vscode.Uri[] = [];

        async function walkDir(dir: string): Promise<void> {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    
                    if (entry.isDirectory()) {
                        // Skip common directories that should be ignored
                        if (!entry.name.startsWith('.') && 
                            entry.name !== 'node_modules' && 
                            entry.name !== 'out' && 
                            entry.name !== 'dist') {
                            await walkDir(fullPath);
                        }
                    } else if (entry.isFile()) {
                        // Add file to results
                        files.push(vscode.Uri.file(fullPath));
                    }
                }
            } catch (error) {
                // Skip directories we can't read
                console.warn('Cannot read directory:', dir, error);
            }
        }

        await walkDir(workspacePath);
        return files;
    }

    private async getFilesWithInclusions(workspacePath: string, excludePatterns: string[], includePatterns: string[]): Promise<string[]> {
        this.debug.info('getFilesWithInclusions starting with workspacePath:', workspacePath);
        
        // Get all files first without any filtering
        let allFiles = await vscode.workspace.findFiles(new vscode.RelativePattern(workspacePath, '**/*'));
        const { minimatch } = require('minimatch');
        
        // Configure minimatch options for v10+ compatibility
        const minimatchOptions = {
            dot: true,
            nocase: false,
            flipNegate: false,
            nobrace: false,
            noglobstar: false,
            noext: false,
            nonull: false,
            windowsPathsNoEscape: true
        };
        
        this.debug.info('VS Code file discovery results in getFilesWithInclusions:', {
            workspacePath,
            totalFilesFound: allFiles.length,
            sampleFiles: allFiles.slice(0, 5).map(f => f.fsPath)
        });
        
        // Fallback: If VS Code findFiles returns nothing, use Node.js fallback
        if (allFiles.length === 0) {
            this.debug.warning('VS Code findFiles returned 0 files in getFilesWithInclusions, using Node.js fallback');
            allFiles = await this.getFilesWithNodeJS(workspacePath);
            this.debug.info('Node.js fallback results in getFilesWithInclusions:', {
                totalFilesFound: allFiles.length,
                sampleFiles: allFiles.slice(0, 5).map(f => f.fsPath)
            });
        }
        
        // Convert to file paths
        const filePaths = allFiles.map(file => file.fsPath);
        
        // If no inclusion patterns are specified, fall back to normal exclusion-only behavior
        if (includePatterns.length === 0) {
            return this.getFiles(workspacePath, excludePatterns);
        }
        
        const filteredFiles: string[] = [];
        
        this.debug.verbose('getFilesWithInclusions processing:', {
            workspacePath,
            totalFilesToProcess: filePaths.length,
            excludePatterns,
            includePatterns
        });
        
        let includedViaPattern = 0;
        let excludedCount = 0;
        
        // Normalize patterns by removing leading slashes to fix minimatch compatibility
        const normalizePattern = (pattern: string): string => {
            // Remove leading slash if present, as minimatch works with relative paths
            return pattern.startsWith('/') ? pattern.substring(1) : pattern;
        };

        const normalizedExcludePatterns = excludePatterns.map(normalizePattern);
        const normalizedIncludePatterns = includePatterns.map(normalizePattern);

        for (const filePath of filePaths) {
            const relativePath = path.relative(workspacePath, filePath).replace(/\\/g, '/');
            
            // Check if file matches any exclusion pattern (using normalized patterns)
            const isExcluded = normalizedExcludePatterns.some(pattern => minimatch(relativePath, pattern, minimatchOptions));
            
            // Check if file matches any inclusion pattern (using normalized patterns)
            const isIncluded = normalizedIncludePatterns.some(pattern => minimatch(relativePath, pattern, minimatchOptions));
            
            // Inclusion patterns act as overrides for exclusions:
            // 1. If file matches inclusion pattern -> include (even if also excluded)
            // 2. If file doesn't match inclusion pattern but is excluded -> exclude
            // 3. If file doesn't match inclusion pattern and is not excluded -> include
            if (isIncluded || !isExcluded) {
                filteredFiles.push(filePath);
                if (isIncluded) {
                    includedViaPattern++;
                }
            } else {
                excludedCount++;
            }
            // Only exclude if the file is excluded AND doesn't match any inclusion pattern
        }
        
        this.debug.verbose('getFilesWithInclusions results:', {
            totalProcessed: filePaths.length,
            totalIncluded: filteredFiles.length,
            includedViaPattern,
            excludedCount,
            sampleIncludedFiles: filteredFiles.slice(0, 5).map(f => path.relative(workspacePath, f))
        });
        
        return filteredFiles;
    }

    async countFileLines(filePath: string, workspacePath?: string): Promise<FileInfo> {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        
        let codeLines = 0;
        let commentLines = 0;
        let blankLines = 0;
        
        const language = this.detectLanguage(filePath);
        const commentPatterns = this.getCommentPatterns(language);
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            if (trimmed === '') {
                blankLines++;
            } else if (this.isCommentLine(trimmed, commentPatterns)) {
                commentLines++;
            } else {
                codeLines++;
            }
        }

        const relativePath = workspacePath ? path.relative(workspacePath, filePath) : path.relative(path.dirname(filePath), filePath);
        
        return {
            path: filePath,
            relativePath,
            fullPath: relativePath.replace(/\\/g, '/'), // Use normalized relative path
            language,
            lines: lines.length,
            codeLines,
            commentLines,
            blankLines,
            size: content.length
        };
    }

    private detectLanguage(filePath: string): string {
        const extension = path.extname(filePath).toLowerCase();
        
        const languageMap: { [ext: string]: string } = {
            '.js': 'JavaScript',
            '.ts': 'TypeScript',
            '.jsx': 'JSX',
            '.tsx': 'TSX',
            '.py': 'Python',
            '.java': 'Java',
            '.c': 'C',
            '.cpp': 'C++',
            '.cs': 'C#',
            '.php': 'PHP',
            '.rb': 'Ruby',
            '.go': 'Go',
            '.rs': 'Rust',
            '.swift': 'Swift',
            '.kt': 'Kotlin',
            '.scala': 'Scala',
            '.dart': 'Dart',
            '.lua': 'Lua',
            '.r': 'R',
            '.R': 'R',
            '.m': 'MATLAB',
            '.pl': 'Perl',
            '.pm': 'Perl',
            '.hs': 'Haskell',
            '.erl': 'Erlang',
            '.ex': 'Elixir',
            '.exs': 'Elixir',
            '.clj': 'Clojure',
            '.cljs': 'Clojure',
            '.fs': 'F#',
            '.fsx': 'F#',
            '.asm': 'Assembly',
            '.s': 'Assembly',
            '.cbl': 'COBOL',
            '.cob': 'COBOL',
            '.f': 'Fortran',
            '.f90': 'Fortran',
            '.f95': 'Fortran',
            '.vb': 'Visual Basic',
            '.pas': 'Pascal',
            '.ads': 'Ada',
            '.adb': 'Ada',
            '.groovy': 'Groovy',
            '.jl': 'Julia',
            '.nim': 'Nim',
            '.cr': 'Crystal',
            '.mm': 'Objective-C',
            '.dpr': 'Delphi',
            '.dfm': 'Delphi',
            '.vala': 'Vala',
            '.zig': 'Zig',
            '.v': 'V',
            '.ml': 'OCaml',
            '.mli': 'OCaml',
            '.scm': 'Scheme',
            '.ss': 'Scheme',
            '.rkt': 'Racket',
            '.coffee': 'CoffeeScript',
            '.ls': 'LiveScript',
            // Batch 4: Additional file extensions and config languages
            '.kts': 'Kotlin',
            '.sc': 'Scala',
            '.sbt': 'Scala',
            '.psm1': 'PowerShell',
            '.psd1': 'PowerShell',
            '.bash': 'Bash',
            '.zsh': 'Zsh',
            '.fish': 'Fish',
            '.tcl': 'Tcl',
            '.tk': 'Tcl',
            '.awk': 'AWK',
            '.gawk': 'AWK',
            '.dockerfile': 'Dockerfile',
            '.toml': 'TOML',
            '.ini': 'INI',
            '.cfg': 'Config',
            '.conf': 'Config',
            // Batch 5: Specialized languages and config files
            '.sql': 'SQL',
            '.graphql': 'GraphQL',
            '.gql': 'GraphQL',
            '.proto': 'Protocol Buffers',
            '.g4': 'ANTLR',
            '.cmake': 'CMake',
            '.makefile': 'Makefile',
            '.mk': 'Makefile',
            '.env': 'Environment',
            '.properties': 'Properties',
            '.gitignore': 'GitIgnore',
            '.editorconfig': 'EditorConfig',
            '.html': 'HTML',
            '.css': 'CSS',
            '.scss': 'SCSS',
            '.sass': 'Sass',
            '.less': 'Less',
            '.json': 'JSON',
            '.xml': 'XML',
            '.yaml': 'YAML',
            '.yml': 'YAML',
            '.md': 'Markdown',
            '.txt': 'Text',
            '.text': 'Text',
            '.log': 'Text',
            '.readme': 'Text',
            '.sh': 'Shell',
            '.bat': 'Batch',
            '.ps1': 'PowerShell'
        };

        return languageMap[extension] || 'Unknown';
    }

    /**
     * Enhanced language detection with binary detection for unknown extensions
     */
    async detectLanguageEnhanced(filePath: string): Promise<{ language: string; isUnsupported: boolean; isBinary: boolean }> {
        const language = this.detectLanguage(filePath);
        
        // If language is known, it's supported
        if (language !== 'Unknown') {
            return {
                language,
                isUnsupported: false,
                isBinary: false
            };
        }

        // Check if file is in include patterns - if so, bypass binary detection
        const isInIncludePatterns = await this.isFileInIncludePatterns(filePath);
        if (isInIncludePatterns) {
            const extension = path.extname(filePath);
            return {
                language: `Unsupported${extension}`,
                isUnsupported: true,
                isBinary: false // Treat as text file due to include pattern
            };
        }

        // For unknown extensions, use binary detection
        if (this.binaryDetectionService) {
            try {
                const binaryResult = await this.binaryDetectionService.isBinary(filePath);
                
                if (binaryResult.isBinary) {
                    return {
                        language: 'Binary',
                        isUnsupported: false, // Binary files are excluded, not unsupported
                        isBinary: true
                    };
                } else {
                    // It's a text file with unknown extension - mark as unsupported
                    const extension = path.extname(filePath);
                    return {
                        language: `Unsupported${extension}`,
                        isUnsupported: true,
                        isBinary: false
                    };
                }
            } catch (error) {
                this.debug.error('Binary detection failed for', filePath, ':', error);
                // On error, assume binary for safety
                return {
                    language: 'Binary',
                    isUnsupported: false,
                    isBinary: true
                };
            }
        }

        // Fallback if binary detection service is not available
        return {
            language: 'Unknown',
            isUnsupported: true,
            isBinary: false
        };
    }

    /**
     * Check if file is in include patterns and should bypass binary detection
     */
    private async isFileInIncludePatterns(filePath: string): Promise<boolean> {
        try {
            const config = vscode.workspace.getConfiguration('codeCounter');
            const includePatterns = config.get<string[]>('includePatterns', []);
            
            if (includePatterns.length === 0) {
                return false;
            }

            const relativePath = vscode.workspace.asRelativePath(filePath);
            const { minimatch } = require('minimatch');
            
            for (const pattern of includePatterns) {
                if (minimatch(relativePath, pattern, { dot: true })) {
                    this.debug.verbose('File matches include pattern, bypassing binary detection:', { filePath, pattern });
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            this.debug.error('Error checking include patterns:', error);
            return false;
        }
    }

    private getCommentPatterns(language: string): string[] {
        const commentMap: { [lang: string]: string[] } = {
            'JavaScript': ['//', '/*', '*/'],
            'TypeScript': ['//', '/*', '*/'],
            'JSX': ['//', '/*', '*/'],
            'TSX': ['//', '/*', '*/'],
            'Java': ['//', '/*', '*/'],
            'C': ['//', '/*', '*/'],
            'C++': ['//', '/*', '*/'],
            'C#': ['//', '/*', '*/'],
            'PHP': ['//', '/*', '*/', '#'],
            'Python': ['#', '"""', "'''"],
            'Ruby': ['#'],
            'Go': ['//', '/*', '*/'],
            'Rust': ['//', '/*', '*/'],
            'Swift': ['//', '/*', '*/'],
            'Kotlin': ['//', '/*', '*/'],
            'Scala': ['//', '/*', '*/'],
            'Dart': ['//', '/*', '*/'],
            'Lua': ['--', '--[[', '--]]'],
            'R': ['#'],
            'MATLAB': ['%', '%{', '%}'],
            'Perl': ['#', '=pod', '=cut'],
            'Haskell': ['--', '{-', '-}'],
            'Erlang': ['%'],
            'Elixir': ['#'],
            'Clojure': [';', '#_'],
            'F#': ['//', '(*', '*)'],
            'Assembly': [';', '#', '//'],
            'COBOL': ['*', 'SKIP'],
            'Fortran': ['C', 'c', '!'],
            'Visual Basic': ["'", 'REM'],
            'Pascal': ['//', '{', '}', '(*', '*)'],
            'Ada': ['--'],
            'Groovy': ['//', '/*', '*/'],
            'Julia': ['#', '#=', '=#'],
            'Nim': ['#', '#[', ']#'],
            'Crystal': ['#'],
            'Objective-C': ['//', '/*', '*/'],
            'Delphi': ['//', '{', '}', '(*', '*)'],
            'Vala': ['//', '/*', '*/'],
            'Zig': ['//', '///'],
            'V': ['//', '/*', '*/'],
            'OCaml': ['(*', '*)'],
            'Scheme': [';'],
            'Racket': [';', '#|', '|#'],
            'CoffeeScript': ['#', '###'],
            'LiveScript': ['#'],
            // Batch 4: Additional languages and file types
            'Bash': ['#'],
            'Zsh': ['#'],
            'Fish': ['#'],
            'Tcl': ['#'],
            'AWK': ['#'],
            'Dockerfile': ['#'],
            'TOML': ['#'],
            'INI': [';', '#'],
            'Config': ['#', ';'],
            // Batch 5: Specialized languages and config files
            'SQL': ['--', '/*', '*/'],
            'GraphQL': ['#'],
            'Protocol Buffers': ['//'],
            'ANTLR': ['//', '/*', '*/'],
            'CMake': ['#'],
            'Makefile': ['#'],
            'Environment': ['#'],
            'Properties': ['#', '!'],
            'Text': [], // Text files don't have formal comment syntax
            'GitIgnore': ['#'],
            'EditorConfig': ['#', ';'],
            'HTML': ['<!--', '-->'],
            'XML': ['<!--', '-->'],
            'CSS': ['/*', '*/'],
            'SCSS': ['//', '/*', '*/'],
            'Sass': ['//'],
            'Less': ['//', '/*', '*/'],
            'Shell': ['#'],
            'Batch': ['REM', '::'],
            'PowerShell': ['#', '<#', '#>']
        };

        return commentMap[language] || [];
    }

    private isCommentLine(line: string, commentPatterns: string[]): boolean {
        for (const pattern of commentPatterns) {
            if (line.startsWith(pattern)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Count lines using path-based settings for inclusion/exclusion patterns
     * This method uses PathBasedSettingsService to get patterns per file path,
     * allowing for subworkspace-specific configuration files
     */
    async countLinesWithPathBasedSettings(workspacePath: string): Promise<LineCountResult> {
        const startTime = Date.now();
        const pathBasedSettings = new PathBasedSettingsService();
        
        this.debug.info('countLinesWithPathBasedSettings starting with workspacePath:', workspacePath);
        
        // Debug: Check what patterns are available for the workspace root
        const rootExcludePatterns = await pathBasedSettings.getExcludePatternsForPath(workspacePath);
        const rootIncludePatterns = await pathBasedSettings.getIncludePatternsForPath(workspacePath);
        this.debug.info('Root workspace patterns:', {
            excludePatterns: rootExcludePatterns,
            includePatterns: rootIncludePatterns
        });
        
        // Get all files first without any filtering
        let allFiles = await vscode.workspace.findFiles(new vscode.RelativePattern(workspacePath, '**/*'));
        const { minimatch } = require('minimatch');
        
        // Configure minimatch options for v10+ compatibility
        const minimatchOptions = {
            dot: true,           // Match dotfiles (like .gitignore)
            nocase: false,       // Case sensitive matching
            flipNegate: false,   // Standard negation behavior
            nobrace: false,      // Allow brace expansion
            noglobstar: false,   // Allow ** globstar
            noext: false,        // Allow extglob patterns
            nonull: false,       // Don't return null for non-matches
            windowsPathsNoEscape: true  // Handle Windows paths properly
        };
        
        this.debug.info('VS Code file discovery results:', {
            workspacePath,
            totalFilesFound: allFiles.length,
            sampleFiles: allFiles.slice(0, 5).map(f => f.fsPath)
        });
        
        // Fallback: If VS Code findFiles returns nothing, use Node.js file system
        if (allFiles.length === 0) {
            this.debug.warning('VS Code findFiles returned 0 files, using Node.js fallback');
            allFiles = await this.getFilesWithNodeJS(workspacePath);
            this.debug.info('Node.js fallback file discovery results:', {
                totalFilesFound: allFiles.length,
                sampleFiles: allFiles.slice(0, 5).map(f => f.fsPath || f)
            });
        }
        
        const filteredFiles: string[] = [];
        let includedViaPattern = 0;
        let excludedCount = 0;
        
        /**
         * Filter out problematic patterns and replace with safe alternatives
         */
        const filterProblematicPatterns = (patterns: string[]): string[] => {
            const safePatterns: string[] = [];
            
            for (const pattern of patterns) {
                const trimmed = pattern.trim();
                
                // Remove patterns that would match everything
                const globalMatchers = ['**/*', '*', '**', '**/**', '**.*', '*.*'];
                if (globalMatchers.includes(trimmed)) {
                    this.debug.warning('Filtered out global matcher pattern:', pattern);
                    continue;
                }
                
                // Handle hidden directory patterns - keep them as they work correctly
                if (trimmed === '**/.*/**' || trimmed === '**/.*') {
                    this.debug.verbose('Keeping hidden pattern (works correctly):', pattern);
                    safePatterns.push(pattern);
                    continue;
                }
                
                // Keep other reasonable patterns
                this.debug.verbose('Keeping exclude pattern:', pattern);
                safePatterns.push(pattern);
            }
            
            return safePatterns;
        };
        
        for (const fileUri of allFiles) {
            const filePath = fileUri.fsPath;
            const relativePath = path.relative(workspacePath, filePath).replace(/\\/g, '/');
            
            // Get path-specific patterns for this file (restored hierarchical settings)
            let rawExcludePatterns = await pathBasedSettings.getExcludePatternsForPath(filePath);
            let includePatterns = await pathBasedSettings.getIncludePatternsForPath(filePath);
            
            // Filter out problematic exclude patterns
            const excludePatterns = filterProblematicPatterns(rawExcludePatterns);
            
            // Debug first few files to see what's happening
            if (filteredFiles.length < 10) {
                this.debug.info('File filtering debug:', {
                    filePath,
                    relativePath,
                    rawExcludePatterns,
                    filteredExcludePatterns: excludePatterns,
                    includePatterns,
                    // Test the problematic pattern manually
                    manualTestDotPattern: minimatch(relativePath, '**/.*/**', minimatchOptions),
                    pathParts: relativePath.split('/'),
                    hasHiddenDirInPath: relativePath.split('/').some(part => part.startsWith('.') && part !== '.' && part !== '..')
                });
            }
            
            // Normalize patterns by removing leading slashes to fix minimatch compatibility
            const normalizePattern = (pattern: string): string => {
                return pattern.startsWith('/') ? pattern.substring(1) : pattern;
            };

            const normalizedExcludePatterns = excludePatterns.map(normalizePattern);
            const normalizedIncludePatterns = includePatterns.map(normalizePattern);

            // Check if file matches any exclusion pattern with detailed logging
            let isExcluded = false;
            let excludingPattern = '';
            for (const pattern of normalizedExcludePatterns) {
                if (minimatch(relativePath, pattern, minimatchOptions)) {
                    isExcluded = true;
                    excludingPattern = pattern;
                    break;
                }
            }
            
            // Check if file matches any inclusion pattern (only when include patterns exist)
            const hasIncludePatterns = normalizedIncludePatterns.length > 0;
            const matchesInclusionPattern = hasIncludePatterns && normalizedIncludePatterns.some((pattern: string) => minimatch(relativePath, pattern, minimatchOptions));
            
            // Debug pattern matching results for first few files
            if (filteredFiles.length < 10) {
                this.debug.info('Pattern matching details:', {
                    relativePath,
                    isExcluded,
                    excludingPattern: excludingPattern || 'none',
                    hasIncludePatterns,
                    matchesInclusionPattern,
                    includePatterns,
                    fileExtension: path.extname(relativePath),
                    // Test simple patterns manually
                    testSimple: {
                        matchesNodeModules: minimatch(relativePath, '**/node_modules/**', minimatchOptions),
                        matchesDotGit: minimatch(relativePath, '**/.git/**', minimatchOptions),
                        matchesAnyJs: minimatch(relativePath, '**/*.js', minimatchOptions),
                        matchesAnyTs: minimatch(relativePath, '**/*.ts', minimatchOptions),
                        isRootFile: !relativePath.includes('/') && !relativePath.includes('\\')
                    }
                });
            }
            
            // Apply inclusion/exclusion logic exactly like the decorator:
            // - If include patterns exist and file matches one, include it (overrides exclusion)
            // - If include patterns exist and file doesn't match any, exclude it
            // - If no include patterns exist, include unless excluded
            let shouldIncludeFile: boolean;
            if (hasIncludePatterns) {
                shouldIncludeFile = matchesInclusionPattern; // Only include if explicitly included
            } else {
                shouldIncludeFile = !isExcluded; // Include unless explicitly excluded
            }
            
            if (shouldIncludeFile) {
                filteredFiles.push(filePath);
                if (matchesInclusionPattern) {
                    includedViaPattern++;
                }
                this.debug.verbose('File included:', { 
                    relativePath, 
                    matchesInclusionPattern, 
                    isExcluded,
                    hasIncludePatterns,
                    reason: matchesInclusionPattern ? 'inclusion pattern override' : 'not excluded' 
                });
            } else {
                excludedCount++;
                this.debug.verbose('File excluded:', { 
                    relativePath, 
                    isExcluded, 
                    excludingPattern: excludingPattern || 'none',
                    matchesInclusionPattern,
                    hasIncludePatterns,
                    reason: hasIncludePatterns ? 'no inclusion pattern match' : 'matched exclusion pattern'
                });
            }
        }
        
        // Analyze file extensions in the workspace
        const allExtensions = new Set(allFiles.map(f => path.extname(f.fsPath).toLowerCase()));
        const includedExtensions = new Set(filteredFiles.map(f => path.extname(f).toLowerCase()));
        
        this.debug.info('countLinesWithPathBasedSettings filtering results:', {
            totalProcessed: allFiles.length,
            totalIncluded: filteredFiles.length,
            includedViaPattern,
            excludedCount,
            sampleIncludedFiles: filteredFiles.slice(0, 5),
            allIncludedFiles: filteredFiles.slice(0, 20).map(f => path.relative(workspacePath, f).replace(/\\/g, '/')),
            allExtensionsFound: Array.from(allExtensions).sort(),
            includedExtensions: Array.from(includedExtensions).sort()
        });
        
        this.debug.info('Starting line counting for filtered files...');
        
        // Now count lines for the filtered files
        const fileInfos: FileInfo[] = [];
        let totalLines = 0;
        let totalFiles = 0;
        const languageStats: { [language: string]: { files: number; lines: number } } = {};

        for (const filePath of filteredFiles) {
            try {
                this.debug.verbose(`Counting lines in: ${filePath}`);
                const fileInfo = await this.countFileLines(filePath, workspacePath);
                this.debug.verbose(`Line count result for ${filePath}:`, {
                    lines: fileInfo.lines,
                    language: fileInfo.language,
                    fileSize: fileInfo.size || 'unknown'
                });
                
                fileInfos.push(fileInfo);
                
                totalLines += fileInfo.lines;
                totalFiles++;
                
                // Update language statistics
                if (!languageStats[fileInfo.language]) {
                    languageStats[fileInfo.language] = { files: 0, lines: 0 };
                }
                languageStats[fileInfo.language].files++;
                languageStats[fileInfo.language].lines += fileInfo.lines;
                
            } catch (error) {
                this.debug.error(`Failed to count lines in ${filePath}:`, error);
            }
        }
        
        this.debug.info('Line counting completed:', {
            totalFilesProcessed: filteredFiles.length,
            successfulCounts: fileInfos.length,
            totalLines,
            totalFiles,
            languageStats
        });

        const endTime = Date.now();
        this.debug.info('countLinesWithPathBasedSettings performance baseline:', {
            processingTimeMs: endTime - startTime,
            totalFiles: fileInfos.length,
            totalLines,
            avgTimePerFile: fileInfos.length > 0 ? (endTime - startTime) / fileInfos.length : 0
        });

        return {
            workspacePath,
            totalFiles,
            totalLines,
            files: fileInfos,
            languageStats,
            generatedAt: new Date()
        };
    }
}