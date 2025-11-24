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
import { BinaryClassificationService } from './binaryClassificationService';

export class LineCounterService {
    private debug = DebugService.getInstance();
    private binaryDetectionService: BinaryDetectionService | null = null;
    private binaryClassificationService: BinaryClassificationService | null = null;

    /**
     * Initialize binary detection service for the workspace
     */
    private initializeBinaryDetection(workspacePath: string): void {
        if (!this.binaryDetectionService) {
            this.binaryDetectionService = new BinaryDetectionService(workspacePath);
            this.binaryClassificationService = new BinaryClassificationService(this.binaryDetectionService);
        }
    }

    /**
     * Calculate optimal chunk size for file processing based on workspace size
     */
    private calculateOptimalChunkSize(totalFiles: number): number {
        if (totalFiles < 100) {
            return 20; // Small workspaces - process in small chunks for responsiveness
        } else if (totalFiles < 1000) {
            return 50; // Medium workspaces - balanced approach
        } else if (totalFiles < 5000) {
            return 100; // Large workspaces - bigger chunks for efficiency
        } else {
            return 200; // Very large workspaces - maximize efficiency with 200 file batches
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

    async countLinesWithInclusions(
        workspacePath: string, 
        excludePatterns: string[] = [], 
        includePatterns: string[] = [],
        progressCallback?: (processed: number, total: number, remaining: number) => void,
        cancellationToken?: vscode.CancellationToken
    ): Promise<LineCountResult> {
        // Check for cancellation early
        if (cancellationToken?.isCancellationRequested) {
            throw new Error('Operation was cancelled by user');
        }
        
        const files = await this.getFilesWithInclusions(workspacePath, excludePatterns, includePatterns, cancellationToken);
        const fileInfos: FileInfo[] = [];
        
        let totalLines = 0;
        let totalFiles = 0;
        const languageStats: { [language: string]: { files: number; lines: number } } = {};

        // Process files with frequent cancellation checks and yielding
        const CHUNK_SIZE = 5; // Much smaller chunks for better responsiveness
        let processedCount = 0;
        
        for (let i = 0; i < files.length; i++) {
            // Check cancellation before each file
            if (cancellationToken?.isCancellationRequested) {
                throw new Error('Operation was cancelled by user');
            }
            
            const filePath = files[i];
            
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
            
            processedCount++;
            
            // Yield control and update progress frequently
            if (i % CHUNK_SIZE === 0 || i === files.length - 1) {
                if (progressCallback) {
                    const remaining = files.length - processedCount;
                    progressCallback(processedCount, files.length, remaining);
                }
                
                // Yield to event loop after every chunk
                await new Promise(resolve => setImmediate(resolve));
                
                // Check cancellation after yielding
                if (cancellationToken?.isCancellationRequested) {
                    throw new Error('Operation was cancelled by user');
                }
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
        
        // Filter out binary files
        const filePaths = files.map(file => file.fsPath);
        return await this.filterBinaryFiles(filePaths);
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

    private async getFilesWithInclusions(workspacePath: string, excludePatterns: string[], includePatterns: string[], cancellationToken?: vscode.CancellationToken): Promise<string[]> {
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

        // Process files in small chunks with frequent cancellation checks
        const FILTER_CHUNK_SIZE = 25; // Smaller chunks for better responsiveness
        for (let i = 0; i < filePaths.length; i += FILTER_CHUNK_SIZE) {
            // Check cancellation before each chunk
            if (cancellationToken?.isCancellationRequested) {
                this.debug.info('Cancellation detected during file filtering');
                throw new Error('Operation was cancelled by user');
            }
            
            const chunk = filePaths.slice(i, i + FILTER_CHUNK_SIZE);
            
            for (const filePath of chunk) {
                const relativePath = path.relative(workspacePath, filePath).replace(/\\/g, '/');
                
                // Check if file matches any exclusion pattern (using normalized patterns)
                const isExcluded = normalizedExcludePatterns.some(pattern => minimatch(relativePath, pattern, minimatchOptions));
                
                // Check if file matches any inclusion pattern (using normalized patterns)
                const isIncluded = normalizedIncludePatterns.some(pattern => minimatch(relativePath, pattern, minimatchOptions));
                
                // Inclusion patterns act as overrides for exclusions:
                // 1. If file matches inclusion pattern -> include (even if also excluded or binary)
                // 2. If file doesn't match inclusion pattern but is excluded -> exclude
                // 3. If file doesn't match inclusion pattern and is not excluded -> include only if not binary
                if (isIncluded) {
                    // Include files that match inclusion patterns regardless of binary status
                    filteredFiles.push(filePath);
                    includedViaPattern++;
                } else if (!isExcluded) {
                    // For files not matching inclusion patterns and not excluded, check if binary
                    if (!(await this.isFileBinary(filePath))) {
                        filteredFiles.push(filePath);
                    } else {
                        excludedCount++; // Count binary files as excluded
                    }
                } else {
                    excludedCount++;
                }
            }
            
            // Yield after each chunk
            await new Promise(resolve => setImmediate(resolve));
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
        // Optimized timeout for better responsiveness
        const FILE_TIMEOUT_MS = 3000; // 3 second timeout per file (increased for parallel processing)
        
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`File processing timeout (${FILE_TIMEOUT_MS}ms): ${filePath}`));
            }, FILE_TIMEOUT_MS);
            
            try {
                // Use streaming for very large files to improve memory usage
                const stats = await fs.promises.stat(filePath);
                const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB
                
                let content: string;
                if (stats.size > LARGE_FILE_THRESHOLD) {
                    // For large files, use streaming with early termination for performance
                    const chunks: Buffer[] = [];
                    const stream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 64 * 1024 });
                    
                    for await (const chunk of stream) {
                        chunks.push(Buffer.from(chunk, 'utf8'));
                        // If file is extremely large, consider sampling instead of reading entirely
                        if (chunks.length * 64 * 1024 > 50 * 1024 * 1024) { // 50MB limit
                            stream.destroy();
                            break;
                        }
                    }
                    content = Buffer.concat(chunks).toString('utf8');
                } else {
                    content = await fs.promises.readFile(filePath, 'utf8');
                }
                
                const lines = content.split('\n');
                
                let codeLines = 0;
                let commentLines = 0;
                let blankLines = 0;
                
                const language = this.detectLanguage(filePath);
                const commentPatterns = this.getCommentPatterns(language);
                
                // Process lines in optimized batches
                const LINE_BATCH_SIZE = 50000; // Smaller batches for better responsiveness
                for (let i = 0; i < lines.length; i += LINE_BATCH_SIZE) {
                    const batch = lines.slice(i, i + LINE_BATCH_SIZE);
                    
                    for (const line of batch) {
                        const trimmed = line.trim();
                        
                        if (trimmed === '') {
                            blankLines++;
                        } else if (this.isCommentLine(trimmed, commentPatterns)) {
                            commentLines++;
                        } else {
                            codeLines++;
                        }
                    }
                    
                    // Yield less frequently for better performance
                    if (i + LINE_BATCH_SIZE < lines.length && i % (LINE_BATCH_SIZE * 4) === 0) {
                        await new Promise(resolve => setImmediate(resolve));
                    }
                }

                const relativePath = workspacePath ? path.relative(workspacePath, filePath) : path.relative(path.dirname(filePath), filePath);
                
                clearTimeout(timeout);
                resolve({
                    path: filePath,
                    relativePath,
                    fullPath: relativePath.replace(/\\/g, '/'), // Use normalized relative path
                    language,
                    lines: lines.length,
                    codeLines,
                    commentLines,
                    blankLines,
                    size: content.length
                });
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
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
            '.csv': 'CSV',
            '.sh': 'Shell',
            '.bat': 'Batch',
            '.ps1': 'PowerShell'
        };
        
        // Check if it's a known language
        if (languageMap[extension]) {
            return languageMap[extension];
        }
        
        // For unknown extensions that are being scanned (inclusion patterns),
        // categorize by extension (e.g., ".xyz" instead of "Unknown")
        if (extension) {
            return extension; // Return the extension itself as the language
        }
        
        return 'Unknown';
    }    /**
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
     * Filter out binary files from an array of file paths with parallel processing
     * Uses the same binary-first priority order as FileExplorerDecorationProvider:
     * 1. Check known binary extensions FIRST → exclude immediately
     * 2. Check known text extensions → apply binary detection
     * 3. Handle unknown extensions → exclude unless inclusion pattern
     */
    private async filterBinaryFiles(filePaths: string[], cancellationToken?: vscode.CancellationToken): Promise<string[]> {
        const textFiles: string[] = [];
        let binaryCount = 0;
        
        // Process in much smaller batches for better UI responsiveness
        const BINARY_BATCH_SIZE = 10; // Much smaller for faster cancellation
        const startTime = Date.now();
        
        this.debug.info('Starting binary file filtering for', filePaths.length, 'files');
        
        // Check for cancellation early
        if (cancellationToken?.isCancellationRequested) {
            throw new Error('Operation was cancelled by user');
        }
        
        for (let i = 0; i < filePaths.length; i += BINARY_BATCH_SIZE) {
            // Check cancellation before each batch
            if (cancellationToken?.isCancellationRequested) {
                throw new Error('Operation was cancelled by user');
            }
            
            const batch = filePaths.slice(i, i + BINARY_BATCH_SIZE);
            
            // Process batch with extension-based priority filtering
            const binaryChecks = await Promise.allSettled(
                batch.map(async (filePath) => {
                    try {
                        if (!this.binaryClassificationService) {
                            // Fallback to simple binary detection if classification service not available
                            const isBinary = await this.isFileBinary(filePath);
                            return { filePath, shouldInclude: !isBinary };
                        }
                        
                        const result = await this.binaryClassificationService.classifyFile(filePath);
                        return { filePath, shouldInclude: result.shouldInclude };
                    } catch (error) {
                        this.debug.warning('Binary classification error for', filePath, '- assuming binary');
                        return { filePath, shouldInclude: false };
                    }
                })
            );
            
            // Process results
            for (const check of binaryChecks) {
                if (check.status === 'fulfilled') {
                    const { filePath, shouldInclude } = check.value;
                    if (shouldInclude) {
                        textFiles.push(filePath);
                    } else {
                        binaryCount++;
                    }
                } else {
                    // On error, assume binary for safety
                    binaryCount++;
                }
            }
            
            // Yield to event loop after each batch
            await new Promise(resolve => setImmediate(resolve));
            
            // Check cancellation after yielding
            if (cancellationToken?.isCancellationRequested) {
                throw new Error('Operation was cancelled by user');
            }
            
            // Progress logging every 50 files (more frequent)
            if (i > 0 && i % 50 === 0) {
                const elapsed = Date.now() - startTime;
                const progress = Math.round((i / filePaths.length) * 100);
                this.debug.info(`Binary filtering progress: ${progress}% (${i}/${filePaths.length}) - ${elapsed}ms elapsed`);
            }
        }
        
        const totalTime = Date.now() - startTime;
        this.debug.info('Binary file filtering completed:', {
            totalFiles: filePaths.length,
            textFiles: textFiles.length,
            binaryFilesFiltered: binaryCount,
            processingTimeMs: totalTime,
            avgTimePerFile: Math.round(totalTime / filePaths.length * 100) / 100
        });
        
        return textFiles;
    }

    /**
     * Check if a file is binary
     */
    private async isFileBinary(filePath: string): Promise<boolean> {
        if (this.binaryDetectionService) {
            try {
                const result = await this.binaryDetectionService.isBinary(filePath);
                return result.isBinary;
            } catch (error) {
                this.debug.warning('Binary detection failed for', filePath, '- assuming binary for safety');
                return true; // Assume binary if detection fails
            }
        }
        return false; // No binary detection service available
    }

    /**
     * Determine if file should be included using binary-first priority order
     * Matches the logic from FileExplorerDecorationProvider.analyzeFileStatus:
     * 1. Check known binary extensions FIRST → exclude
     * 2. Check known text extensions → apply binary detection
     * 3. Unknown extensions → exclude (unless inclusion pattern)
     */
    private async shouldIncludeFileWithBinaryFirst(filePath: string): Promise<boolean> {
        const ext = path.extname(filePath).toLowerCase();
        
        // Get known extensions using same logic as decorator
        const knownTextExtensions = this.getKnownTextExtensions();
        const knownBinaryExtensions = this.getKnownBinaryExtensions();
        
        // Step 1: Check known BINARY extensions FIRST (prevents images from being processed as text)
        if (knownBinaryExtensions.has(ext)) {
            this.debug.verbose('File excluded as known binary extension:', { filePath, ext });
            return false; // Exclude known binary files
        }
        
        // Step 2: Check known TEXT extensions with binary detection
        if (knownTextExtensions.has(ext)) {
            if (this.binaryDetectionService) {
                try {
                    const binaryResult = await this.binaryDetectionService.isBinary(filePath);
                    const shouldInclude = !binaryResult.isBinary;
                    this.debug.verbose('Binary detection result for known text file:', { 
                        filePath, ext, 
                        isBinary: binaryResult.isBinary, 
                        detectionMethod: binaryResult.detectionMethod, 
                        shouldInclude 
                    });
                    return shouldInclude;
                } catch (error) {
                    this.debug.warning('Binary detection failed for known text file - assuming text:', { filePath, error });
                    return true; // Assume text for known extensions on error
                }
            }
            return true; // If no binary detection service, include known text files
        }
        
        // Step 3: Unknown extensions - exclude by default
        this.debug.verbose('File excluded as unknown extension:', { filePath, ext });
        return false;
    }

    /**
     * Get comprehensive set of known text file extensions (same as decorator)
     */
    private getKnownTextExtensions(): Set<string> {
        return new Set([
            // Programming languages
            '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx',
            '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.kts', '.scala', '.sc', '.sbt',
            '.dart', '.lua', '.r', '.R', '.m', '.pl', '.pm', '.hs', '.erl', '.ex', '.exs',
            '.clj', '.cljs', '.cljc', '.fs', '.fsx', '.fsi', '.ml', '.mli', '.asm', '.s',
            '.cbl', '.cob', '.cpy', '.f', '.f90', '.f95', '.f03', '.f08', '.vb', '.bas',
            '.pas', '.pp', '.ads', '.adb', '.groovy', '.gradle', '.jl', '.nim', '.cr',
            '.mm', '.dpr', '.dfm', '.vala', '.zig', '.v', '.scm', '.ss', '.rkt',
            '.coffee', '.ls', '.elm', '.purs', '.tcl', '.tk', '.awk', '.gawk',
            
            // Shell and scripting
            '.sh', '.bash', '.zsh', '.fish', '.csh', '.ksh', '.bat', '.cmd', '.ps1', '.psm1', '.psd1',
            
            // Web technologies
            '.html', '.htm', '.xhtml', '.css', '.scss', '.sass', '.less', '.stylus',
            '.vue', '.svelte', '.astro',
            
            // Data and config
            '.json', '.jsonc', '.json5', '.xml', '.xsd', '.xsl', '.xslt', '.yaml', '.yml',
            '.toml', '.ini', '.cfg', '.conf', '.config', '.properties', '.env',
            '.htaccess', '.gitignore', '.gitattributes', '.editorconfig',
            
            // Documentation and text
            '.md', '.markdown', '.mdown', '.mkd', '.rst', '.txt', '.text', '.rtf',
            '.tex', '.latex', '.org', '.adoc', '.asciidoc',
            
            // Database and query
            '.sql', '.psql', '.mysql', '.sqlite', '.cypher', '.sparql',
            '.graphql', '.gql',
            
            // Build and project files
            '.dockerfile', '.dockerignore', '.makefile', '.make', '.mk', '.cmake',
            '.gradle', '.sbt', '.maven', '.ant', '.rake', '.gemfile',
            
            // Log and data files
            '.log', '.logs', '.out', '.err', '.trace', '.csv', '.tsv', '.tab',
            
            // Specialized formats
            '.proto', '.g4', '.bnf', '.ebnf', '.lex', '.yacc', '.bison'
        ]);
    }

    /**
     * Get comprehensive set of known binary file extensions (same as decorator)
     */
    private getKnownBinaryExtensions(): Set<string> {
        return new Set([
            // Images
            '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.tiff', '.tif', '.webp',
            '.svg', '.psd', '.ai', '.eps', '.raw', '.cr2', '.nef', '.orf', '.sr2',
            '.dng', '.heic', '.heif', '.avif', '.jxl',
            
            // Video
            '.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm', '.m4v',
            '.mpg', '.mpeg', '.3gp', '.ogv', '.asf', '.rm', '.rmvb',
            
            // Audio
            '.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a', '.opus',
            '.ape', '.ac3', '.dts', '.amr',
            
            // Archives and compression
            '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.lzma',
            '.cab', '.iso', '.dmg', '.pkg', '.deb', '.rpm',
            
            // Documents
            '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
            '.odt', '.ods', '.odp', '.pages', '.numbers', '.key',
            
            // Executables and libraries
            '.exe', '.dll', '.so', '.dylib', '.app', '.msi', '.appx',
            '.bin', '.run', '.snap', '.flatpak',
            
            // Database files
            '.db', '.sqlite', '.sqlite3', '.mdb', '.accdb', '.dbf',
            
            // System and temporary
            '.tmp', '.temp', '.cache', '.lock', '.pid', '.swap',
            '.bak', '.backup', '.old', '.orig',
            
            // Fonts
            '.ttf', '.otf', '.woff', '.woff2', '.eot',
            
            // CAD and 3D
            '.dwg', '.dxf', '.step', '.iges', '.stl', '.obj', '.3ds',
            
            // Virtual machines
            '.vmdk', '.vdi', '.qcow2', '.vhd', '.vhdx',
            
            // Game assets
            '.unity', '.unitypackage', '.asset', '.prefab'
        ]);
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
            'CSV': [], // CSV files don't have formal comment syntax
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
     * Count lines using path-based settings for inclusion/exclusion patterns with progress tracking
     * This method uses PathBasedSettingsService to get patterns per file path,
     * allowing for subworkspace-specific configuration files
     */
    async countLinesWithPathBasedSettings(workspacePath: string, progressCallback?: (processed: number, total: number, remaining: number) => void, cancellationToken?: vscode.CancellationToken): Promise<LineCountResult> {
        const startTime = Date.now();
        const pathBasedSettings = new PathBasedSettingsService();
        
        // Initialize binary detection and classification services
        this.initializeBinaryDetection(workspacePath);
        
        this.debug.info('countLinesWithPathBasedSettings starting with workspacePath:', workspacePath);
        
        // Check for cancellation early
        if (cancellationToken?.isCancellationRequested) {
            throw new Error('Operation was cancelled by user');
        }
        
        // Immediate progress feedback to show we're starting
        if (progressCallback) {
            progressCallback(0, 1, 1);
        }
        
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
        
        // Report initial file count to progress
        if (progressCallback) {
            progressCallback(0, allFiles.length, allFiles.length);
        }
        
        // Check for cancellation before processing
        if (cancellationToken?.isCancellationRequested) {
            throw new Error('Operation was cancelled by user');
        }
        
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
        
        // Cache settings by directory to avoid repeated lookups
        const settingsCache = new Map<string, {exclude: string[], include: string[]}>();
        
        for (const fileUri of allFiles) {
            const filePath = fileUri.fsPath;
            const relativePath = path.relative(workspacePath, filePath).replace(/\\/g, '/');
            
            // Get path-specific patterns for this file using directory-based caching
            const dirPath = path.dirname(filePath);
            let cachedSettings = settingsCache.get(dirPath);
            
            if (!cachedSettings) {
                const rawExcludePatterns = await pathBasedSettings.getExcludePatternsForPath(filePath);
                const includePatterns = await pathBasedSettings.getIncludePatternsForPath(filePath);
                cachedSettings = { exclude: rawExcludePatterns, include: includePatterns };
                settingsCache.set(dirPath, cachedSettings);
            }
            
            let rawExcludePatterns = cachedSettings.exclude;
            let includePatterns = cachedSettings.include;
            
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
            // - If include patterns exist and file matches one, include it (overrides exclusion and binary detection)
            // - If include patterns exist and file doesn't match any, exclude it
            // - If no include patterns exist, include unless excluded or binary
            let shouldIncludeFile: boolean;
            if (hasIncludePatterns) {
                shouldIncludeFile = matchesInclusionPattern; // Only include if explicitly included (bypasses binary detection)
            } else {
                shouldIncludeFile = !isExcluded; // Include unless explicitly excluded, but still need to check for binary
            }
            
            // For files not explicitly included via patterns, also check if they're binary
            if (shouldIncludeFile && !matchesInclusionPattern) {
                // Check if file is binary using centralized classification service
                if (this.binaryClassificationService) {
                    try {
                        const result = await this.binaryClassificationService.classifyFile(filePath);
                        if (!result.shouldInclude) {
                            shouldIncludeFile = false;
                            excludedCount++; // Count binary files as excluded
                        }
                    } catch (error) {
                        this.debug.warning('Binary classification error for', filePath, '- assuming binary');
                        shouldIncludeFile = false;
                        excludedCount++;
                    }
                } else {
                    // Fallback to simple binary detection if classification service not available
                    if (await this.isFileBinary(filePath)) {
                        shouldIncludeFile = false;
                        excludedCount++; // Count binary files as excluded
                    }
                }
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
                    reason: matchesInclusionPattern ? 'inclusion pattern override' : 'not excluded and not binary' 
                });
            } else {
                excludedCount++;
                this.debug.verbose('File excluded:', { 
                    relativePath, 
                    isExcluded, 
                    excludingPattern: excludingPattern || 'none',
                    matchesInclusionPattern,
                    hasIncludePatterns,
                    reason: hasIncludePatterns ? 'no inclusion pattern match' : (isExcluded ? 'matched exclusion pattern' : 'binary file')
                });
            }
            
            // Yield periodically during file filtering to prevent UI blocking
            if (filteredFiles.length % 100 === 0) {
                await new Promise(resolve => setImmediate(resolve));
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
        
        this.debug.info('Starting line counting for filtered files...', {
            totalFilteredFiles: filteredFiles.length,
            sampleFiles: filteredFiles.slice(0, 3)
        });
        
        // Now count lines for the filtered files using adaptive chunked processing
        const fileInfos: FileInfo[] = [];
        let totalLines = 0;
        let totalFiles = 0;
        const languageStats: { [language: string]: { files: number; lines: number } } = {};

        // Adaptive chunk size based on workspace size for optimal performance
        const adaptiveChunkSize = this.calculateOptimalChunkSize(filteredFiles.length);
        const CHUNK_SIZE = adaptiveChunkSize;
        const YIELD_INTERVAL = 50; // Slightly longer interval for better throughput
        let lastYieldTime = Date.now();
        
        this.debug.info('Performance optimization settings:', {
            totalFilesToProcess: filteredFiles.length,
            adaptiveChunkSize: CHUNK_SIZE,
            yieldInterval: YIELD_INTERVAL
        });
        
        const progressIncrement = Math.max(1, Math.floor(filteredFiles.length / 50)); // Update progress more frequently
        let processedCount = 0;

        // Process files in batches for better performance
        for (let batchStart = 0; batchStart < filteredFiles.length; batchStart += CHUNK_SIZE) {
            // IMMEDIATE cancellation check before each batch
            if (cancellationToken?.isCancellationRequested) {
                this.debug.info('Cancellation detected before processing batch at:', batchStart);
                throw new Error('Operation was cancelled by user');
            }
            
            const batchEnd = Math.min(batchStart + CHUNK_SIZE, filteredFiles.length);
            const batch = filteredFiles.slice(batchStart, batchEnd);
            
            // Process the batch concurrently for better I/O efficiency
            const batchPromises = batch.map(async (filePath) => {
                try {
                    this.debug.verbose(`Counting lines in: ${filePath}`);
                    const fileInfo = await this.countFileLines(filePath, workspacePath);
                    this.debug.verbose(`Line count result for ${filePath}:`, {
                        lines: fileInfo.lines,
                        language: fileInfo.language,
                        fileSize: fileInfo.size || 'unknown'
                    });
                    
                    return { success: true, fileInfo, filePath };
                } catch (error) {
                    this.debug.error(`Failed to count lines in ${filePath}:`, error);
                    return { success: false, error, filePath };
                }
            });
            
            // Wait for all files in the batch to complete
            const batchResults = await Promise.all(batchPromises);
            
            // Process results and update statistics
            for (const result of batchResults) {
                if (result.success && result.fileInfo) {
                    fileInfos.push(result.fileInfo);
                    totalLines += result.fileInfo.lines;
                    totalFiles++;
                    
                    // Update language statistics
                    if (!languageStats[result.fileInfo.language]) {
                        languageStats[result.fileInfo.language] = { files: 0, lines: 0 };
                    }
                    languageStats[result.fileInfo.language].files++;
                    languageStats[result.fileInfo.language].lines += result.fileInfo.lines;
                }
                processedCount++; // Count both successful and failed files for progress tracking
            }
            
            // Update progress and yield after each batch
            const currentTime = Date.now();
            if (currentTime - lastYieldTime > YIELD_INTERVAL || batchStart === 0 || batchEnd >= filteredFiles.length) {
                const progressPercent = Math.round((processedCount / filteredFiles.length) * 100);
                const filesRemaining = filteredFiles.length - processedCount;
                this.debug.info(`Progress: ${progressPercent}% (${processedCount}/${filteredFiles.length} files) - ${filesRemaining} files remaining`);
                
                // Call progress callback if provided
                if (progressCallback) {
                    progressCallback(processedCount, filteredFiles.length, filesRemaining);
                }
                
                // Yield to event loop to keep VS Code responsive
                await new Promise(resolve => setImmediate(resolve));
                lastYieldTime = currentTime;
                
                // IMMEDIATE cancellation check after yielding
                if (cancellationToken?.isCancellationRequested) {
                    this.debug.info('Cancellation detected after yield in batch processing');
                    throw new Error('Operation was cancelled by user');
                }
            }
        }
        
        this.debug.info('Line counting completed:', {
            totalFilesProcessed: filteredFiles.length,
            successfulCounts: fileInfos.length,
            totalLines,
            totalFiles,
            languageStats
        });

        // Final progress callback to show completion
        if (progressCallback) {
            progressCallback(filteredFiles.length, filteredFiles.length, 0);
        }

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