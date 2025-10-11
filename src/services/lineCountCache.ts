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
        try {
            const stats = await fs.promises.stat(filePath);
            
            // Check if we have a valid cached entry
            const cached = this.cache.get(filePath);
            if (cached && cached.lastModified === stats.mtimeMs && cached.size === stats.size) {
                return cached;
            }

            // Count lines and cache the result
            const fileInfo = await this.lineCounter.countFileLines(filePath);
            const lineCount: CachedLineCount = {
                lines: fileInfo.lines,
                codeLines: fileInfo.codeLines,
                commentLines: fileInfo.commentLines,
                blankLines: fileInfo.blankLines,
                lastModified: stats.mtimeMs,
                size: stats.size
            };

            this.cache.set(filePath, lineCount);
            return lineCount;
            
        } catch (error) {
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