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
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LineCounterService } from './lineCounter';

export interface CachedLineCount {
    lines: number;
    codeLines: number;
    commentLines: number;
    blankLines: number;
    lastModified: number;
    size: number;
}

export class LineCountCacheService {
    private cache = new Map<string, CachedLineCount>();
    private lineCounter: LineCounterService;
    private disposables: vscode.Disposable[] = [];

    constructor() {
        console.log('DEBUG: LineCountCacheService constructor called');
        this.lineCounter = new LineCounterService();
        this.setupFileWatcher();
    }

    private setupFileWatcher(): void {
        // Watch for file changes to invalidate cache
        const watcher = vscode.workspace.createFileSystemWatcher('**/*');
        
        watcher.onDidChange((uri) => this.invalidateCache(uri.fsPath));
        watcher.onDidDelete((uri) => this.invalidateCache(uri.fsPath));
        
        this.disposables.push(watcher);
    }

    private invalidateCache(filePath: string): void {
        this.cache.delete(filePath);
    }

    public invalidateFileCache(filePath: string): void {
        this.invalidateCache(filePath);
        console.log('Invalidated file cache for:', filePath);
    }

    public invalidateFolderCache(filePath: string): void {
        // Invalidate all cached entries that are parent directories of this file
        const normalizedPath = path.normalize(filePath);
        const keysToDelete: string[] = [];
        
        for (const [cachedPath] of this.cache) {
            // Check if the cached path is a parent directory of the changed file
            const normalizedCachedPath = path.normalize(cachedPath);
            if (normalizedPath.startsWith(normalizedCachedPath + path.sep) || 
                normalizedPath === normalizedCachedPath) {
                keysToDelete.push(cachedPath);
            }
        }
        
        // Also invalidate parent directories
        let currentDir = path.dirname(normalizedPath);
        const rootDir = path.parse(normalizedPath).root;
        
        while (currentDir !== rootDir && currentDir !== currentDir + path.sep) {
            keysToDelete.push(currentDir);
            currentDir = path.dirname(currentDir);
        }
        
        keysToDelete.forEach(key => this.cache.delete(key));
        console.log('Invalidated folder cache for:', keysToDelete);
    }

    async getLineCount(filePath: string): Promise<CachedLineCount | null> {
        console.log('DEBUG: getLineCount ENTRY called for:', filePath);
        try {
            console.log('DEBUG: getLineCount called for:', filePath);
            console.log('DEBUG: About to call fs.promises.stat for:', filePath);
            const stats = await fs.promises.stat(filePath);
            console.log('DEBUG: file stats:', { size: stats.size, modified: stats.mtimeMs });
            
            // Check if we have a valid cached entry
            const cached = this.cache.get(filePath);
            if (cached && cached.lastModified === stats.mtimeMs && cached.size === stats.size) {
                console.log('DEBUG: returning cached line count:', cached);
                return cached;
            }

            // Count lines and cache the result
            console.log('DEBUG: calling lineCounter.countFileLines for:', filePath);
            const fileInfo = await this.lineCounter.countFileLines(filePath);
            console.log('DEBUG: countFileLines returned:', fileInfo);
            if (!fileInfo) {
                console.log('DEBUG: fileInfo is null/undefined, returning null');
                return null;
            }
            const lineCount: CachedLineCount = {
                lines: fileInfo.lines,
                codeLines: fileInfo.codeLines,
                commentLines: fileInfo.commentLines,
                blankLines: fileInfo.blankLines,
                lastModified: stats.mtimeMs,
                size: stats.size
            };

            this.cache.set(filePath, lineCount);
            console.log('DEBUG: cached and returning line count:', lineCount);
            return lineCount;
            
        } catch (error) {
            console.log('DEBUG: getLineCount CATCH block, error:', error);
            console.warn(`Failed to get line count for ${filePath}:`, error);
            return null;
        }
    }

    async getLineCountForDocument(document: vscode.TextDocument): Promise<CachedLineCount | null> {
        if (document.uri.scheme !== 'file') {
            // For non-file documents, count directly from content
            try {
                const lines = document.getText().split('\n');
                return {
                    lines: lines.length,
                    codeLines: lines.filter(line => line.trim() !== '').length,
                    commentLines: 0, // Would need language-specific logic
                    blankLines: lines.filter(line => line.trim() === '').length,
                    lastModified: Date.now(),
                    size: document.getText().length
                };
            } catch (error) {
                return null;
            }
        }

        return this.getLineCount(document.uri.fsPath);
    }

    clearCache(): void {
        this.cache.clear();
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.clearCache();
    }
}