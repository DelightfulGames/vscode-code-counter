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
import * as path from 'path';
import { LineCountCacheService, CachedLineCount } from '../services/lineCountCache';
import { lineThresholdService } from '../services/lineThresholdService';
import { PathBasedSettingsService } from '../services/pathBasedSettingsService';
import { WorkspaceDatabaseService } from '../services/workspaceDatabaseService';
import { GlobUtils } from '../utils/globUtils';
import { DebugService } from '../services/debugService';

export class FileExplorerDecorationProvider implements vscode.FileDecorationProvider {
    private _onDidChangeFileDecorations: vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined> = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[] | undefined> = this._onDidChangeFileDecorations.event;

    private lineCountCache: LineCountCacheService;
    private pathBasedSettings: PathBasedSettingsService;
    private disposables: vscode.Disposable[] = [];
    private debug: DebugService;

    constructor(pathBasedSettings?: PathBasedSettingsService) {
        this.lineCountCache = new LineCountCacheService();
        this.pathBasedSettings = pathBasedSettings || new PathBasedSettingsService();
        this.debug = DebugService.getInstance();
        this.setupConfigurationWatcher();
    }

    private setupConfigurationWatcher(): void {
        const configWatcher = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('codeCounter.showLineCountsInExplorer') ||
                event.affectsConfiguration('codeCounter.lineThresholds') ||
                event.affectsConfiguration('codeCounter.emojis') ||
                event.affectsConfiguration('codeCounter.emojis.folders') ||
                event.affectsConfiguration('codeCounter.excludePatterns')) {
                // When exclude patterns change, invalidate all caches and refresh all decorations
                if (event.affectsConfiguration('codeCounter.excludePatterns')) {
                    this.debug.info('Exclude patterns changed - invalidating all caches and refreshing decorations');
                    this.lineCountCache.clearCache();
                }
                this._onDidChangeFileDecorations.fire(undefined);
            }
        });
        this.disposables.push(configWatcher);

        // Listen for file saves to refresh decorations
        const saveWatcher = vscode.workspace.onDidSaveTextDocument(document => {
            this.debug.verbose('File saved:', document.uri.fsPath);
            // Invalidate cache for the specific file that was saved
            this.lineCountCache.invalidateFileCache(document.uri.fsPath);
            // Invalidate cache for parent folders since their statistics may have changed
            this.lineCountCache.invalidateFolderCache(document.uri.fsPath);
            // Fire change event for the specific file to refresh its decoration
            this._onDidChangeFileDecorations.fire(document.uri);
            // Also refresh parent folders since their totals may have changed
            this.refreshParentFolders(document.uri);
        });
        this.disposables.push(saveWatcher);

        // Watch for file creation and deletion to update folder decorations
        const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
        
        const onFileCreate = fileWatcher.onDidCreate(uri => {
            this.debug.verbose('File created:', uri.fsPath);
            // Invalidate cache for parent folders since their statistics changed
            this.lineCountCache.invalidateFolderCache(uri.fsPath);
            // Refresh the parent folder decoration
            this.refreshParentFolders(uri);
            // Also refresh the file itself if it's a file
            this._onDidChangeFileDecorations.fire(uri);
        });
        
        const onFileDelete = fileWatcher.onDidDelete(uri => {
            this.debug.verbose('File deleted:', uri.fsPath);
            // Invalidate cache for parent folders since their statistics changed
            this.lineCountCache.invalidateFolderCache(uri.fsPath);
            // Refresh the parent folder decoration
            this.refreshParentFolders(uri);
        });

        this.disposables.push(fileWatcher, onFileCreate, onFileDelete);

        // Note: Database service handles settings changes internally
        // Settings changes will trigger cache invalidation through file watchers
        // Listen for database settings changes
        const dbSettingsWatcher = this.pathBasedSettings.onDidChangeSettings(() => {
            this.debug.info('Database settings changed - refreshing all decorations');
            this.lineCountCache.clearCache();
            this._onDidChangeFileDecorations.fire(undefined);
        });
        this.disposables.push(dbSettingsWatcher);
    }

    private refreshParentFolders(uri: vscode.Uri): void {
        // Get the parent directory and refresh its decoration
        const parent = vscode.Uri.file(path.dirname(uri.fsPath));
        
        // Only refresh if parent is within workspace
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(parent);
        if (workspaceFolder) {
            this.debug.verbose('Refreshing parent folder:', parent.fsPath);
            this._onDidChangeFileDecorations.fire(parent);
            
            // Also refresh grandparent folders up to workspace root
            let currentParent = parent;
            while (currentParent.fsPath !== workspaceFolder.uri.fsPath && 
                   currentParent.fsPath !== path.dirname(currentParent.fsPath)) {
                currentParent = vscode.Uri.file(path.dirname(currentParent.fsPath));
                this.debug.verbose('Refreshing ancestor folder:', currentParent.fsPath);
                this._onDidChangeFileDecorations.fire(currentParent);
            }
        }
    }

    private refreshParentDirectoriesForWorkspaceChange(changedDirectoryUri: vscode.Uri): void {
        // Get the parent directory and refresh its decoration
        const parent = vscode.Uri.file(path.dirname(changedDirectoryUri.fsPath));
        
        // Only refresh if parent is within workspace
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(parent);
        if (workspaceFolder && parent.fsPath !== changedDirectoryUri.fsPath) {
            this.debug.verbose('Refreshing parent directory for workspace change:', parent.fsPath);
            this._onDidChangeFileDecorations.fire(parent);
            
            // Recursively refresh parent directories up to workspace root
            let currentParent = parent;
            while (currentParent.fsPath !== workspaceFolder.uri.fsPath && 
                   currentParent.fsPath !== path.dirname(currentParent.fsPath)) {
                currentParent = vscode.Uri.file(path.dirname(currentParent.fsPath));
                if (currentParent.fsPath !== workspaceFolder.uri.fsPath) {
                    this.debug.verbose('Refreshing ancestor directory for workspace change:', currentParent.fsPath);
                    this._onDidChangeFileDecorations.fire(currentParent);
                }
            }
            
            // Also refresh the workspace root itself
            this.debug.verbose('Refreshing workspace root for workspace change:', workspaceFolder.uri.fsPath);
            this._onDidChangeFileDecorations.fire(workspaceFolder.uri);
        }
    }

    private async refreshImmediateChildrenForWorkspaceChange(changedDirectoryUri: vscode.Uri): Promise<void> {
        try {
            this.debug.verbose('Refreshing immediate children for workspace settings change:', changedDirectoryUri.fsPath);
            
            // Check if directory exists before trying to read it
            try {
                const stat = await vscode.workspace.fs.stat(changedDirectoryUri);
                if (stat.type !== vscode.FileType.Directory) {
                    this.debug.verbose('Path is not a directory, skipping refresh:', changedDirectoryUri.fsPath);
                    return;
                }
            } catch (error) {
                this.debug.verbose('Directory does not exist, skipping refresh:', changedDirectoryUri.fsPath);
                return;
            }
            
            // Read the immediate children of the changed directory
            const entries = await vscode.workspace.fs.readDirectory(changedDirectoryUri);
            
            for (const [name, type] of entries) {
                const childUri = vscode.Uri.joinPath(changedDirectoryUri, name);
                this.debug.verbose('Refreshing immediate child:', childUri.fsPath, type === vscode.FileType.Directory ? '(directory)' : '(file)');
                this._onDidChangeFileDecorations.fire(childUri);
            }
        } catch (error) {
            this.debug.warning('Error refreshing immediate children for workspace change:', error);
        }
    }

    private async refreshSubdirectoriesForWorkspaceChange(changedDirectoryUri: vscode.Uri): Promise<void> {
        try {
            this.debug.verbose('Refreshing all children for workspace settings change:', changedDirectoryUri.fsPath);
            
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(changedDirectoryUri);
            if (!workspaceFolder) {
                return;
            }

            // Find ALL files under the changed directory (not just directories)
            const pattern = new vscode.RelativePattern(changedDirectoryUri, '**/*');
            const allFiles = await vscode.workspace.findFiles(pattern, null, 1000); // Increased limit for better coverage

            // Track unique directories to avoid duplicate refreshes
            const uniqueDirectories = new Set<string>();
            
            // Refresh all files found
            for (const fileUri of allFiles) {
                this.debug.verbose('Refreshing file for workspace change:', fileUri.fsPath);
                this._onDidChangeFileDecorations.fire(fileUri);
                
                // Also collect unique parent directories of these files
                let currentDir = path.dirname(fileUri.fsPath);
                while (currentDir !== changedDirectoryUri.fsPath && 
                       currentDir.startsWith(changedDirectoryUri.fsPath) && 
                       currentDir !== path.dirname(currentDir)) {
                    uniqueDirectories.add(currentDir);
                    currentDir = path.dirname(currentDir);
                }
            }

            // Refresh all unique directories found
            for (const dirPath of uniqueDirectories) {
                this.debug.verbose('Refreshing directory for workspace change:', dirPath);
                this._onDidChangeFileDecorations.fire(vscode.Uri.file(dirPath));
            }

            // Also explicitly refresh the immediate children of the changed directory
            // This catches empty directories that might not have files
            try {
                const entries = await vscode.workspace.fs.readDirectory(changedDirectoryUri);
                for (const [name, type] of entries) {
                    const childUri = vscode.Uri.joinPath(changedDirectoryUri, name);
                    this.debug.verbose('Refreshing immediate child for workspace change:', childUri.fsPath);
                    this._onDidChangeFileDecorations.fire(childUri);
                }
            } catch (readDirError) {
                this.debug.warning('Could not read directory for immediate children refresh:', readDirError);
            }

        } catch (error) {
            this.debug.warning('Error refreshing subdirectories for workspace change:', error);
        }
    }

    async provideFileDecoration(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
        this.debug.verbose('**************** DECORATOR METHOD CALLED ****************', uri.fsPath);
        try {
            // Extension is enabled, so always show decorations based on mode
            this.debug.verbose('provideFileDecoration called for URI', { uri: uri.toString(), scheme: uri.scheme });

            // Skip decorations for non-file URIs to prevent filesystem errors
            if (uri.scheme !== 'file') {
                this.debug.verbose('Skipping decoration for non-file URI scheme', { scheme: uri.scheme });
                return undefined;
            }

            this.debug.verbose('About to call vscode.workspace.fs.stat', { fsPath: uri.fsPath });
            const stat = await vscode.workspace.fs.stat(uri);
            const fileType = stat.type === vscode.FileType.Directory ? 'Directory' : 'File';
            this.debug.verbose('File stat result', { fileType, fsPath: uri.fsPath });
            
            if (stat.type === vscode.FileType.Directory) {
                // Handle folder decoration
                this.debug.verbose('Calling provideFolderDecoration', { fsPath: uri.fsPath });
                return await this.provideFolderDecoration(uri);
            } else {
                // Handle file decoration
                    this.debug.verbose('Calling provideFileDecorationForFile', { fsPath: uri.fsPath });
                return await this.provideFileDecorationForFile(uri);
            }
        } catch (error) {
            this.debug.error('Error in provideFileDecoration', { error: error, fsPath: uri.fsPath });
            return undefined;
        }
    }

    private async provideFileDecorationForFile(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
        this.debug.verbose('provideFileDecorationForFile called for:', uri.fsPath);

        // Skip certain file types
        const shouldSkip = await this.shouldSkipFile(uri.fsPath);
        this.debug.verbose('provideFileDecorationForFile - shouldSkipFile result:', shouldSkip, 'for file:', uri.fsPath);
        if (shouldSkip) {
            this.debug.verbose('provideFileDecorationForFile - shouldSkipFile returned true, skipping');
            return undefined;
        }

        try {
            this.debug.verbose('provideFileDecorationForFile - getting line count for:', uri.fsPath);
            this.debug.verbose('About to call this.lineCountCache.getLineCount');
            const lineCount = await this.lineCountCache.getLineCount(uri.fsPath);
            this.debug.verbose('getLineCount returned:', lineCount);
            if (!lineCount) {
                this.debug.verbose('provideFileDecorationForFile - lineCount is null, returning undefined');
                return undefined;
            }
            this.debug.verbose('provideFileDecorationForFile - lineCount:', JSON.stringify(lineCount));

            // Get the color classification for this line count using path-based settings
            const threshold = await this.pathBasedSettings.getColorThresholdForPath(lineCount.lines, uri.fsPath);
            this.debug.verbose('FileExplorerDecorationProvider threshold calculation', { 
                fsPath: uri.fsPath, 
                lines: lineCount.lines, 
                threshold: threshold 
            });
            // Get custom emojis from path-based configuration
            const emoji = await this.pathBasedSettings.getThemeEmojiForPath(threshold, uri.fsPath);
            
            // Create path-aware tooltip
            const coloredTooltip = await this.createPathAwareTooltip(uri.fsPath, lineCount, threshold, emoji);
            
            // Use different colored icons based on line count thresholds
            let badge = '●';
            this.debug.verbose('FileExplorerDecorationProvider emoji retrieved', { 
                emoji: emoji, 
                threshold: threshold, 
                fsPath: uri.fsPath 
            });
            
            switch (threshold) {
                case 'normal':
                    badge = emoji;
                    break;
                case 'warning':
                    badge = emoji;
                    break;
                case 'danger':
                    badge = emoji;
                    break;
                default:
                    badge = '⚪'; // White circle for unknown
            }
            
            return {
                badge: badge,
                tooltip: coloredTooltip,
            };

        } catch (error) {
            this.debug.warning(`Failed to provide decoration for ${uri.fsPath}:`, error);
            return undefined;
        }
    }

    private async shouldSkipFile(filePath: string): Promise<boolean> {
        const ext = path.extname(filePath).toLowerCase();
        
        // Skip binary files that don't make sense to count
        const skipExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', 
                               '.mp4', '.avi', '.mov', '.mp3', '.wav', '.pdf', '.zip', 
                               '.tar', '.gz', '.exe', '.dll', '.so', '.dylib'];
        
        if (skipExtensions.includes(ext)) {
            return true;
        }

        // Check against path-based exclusion and inclusion patterns
        const excludePatterns = await this.pathBasedSettings.getExcludePatternsForPath(filePath);
        const includePatterns = await this.pathBasedSettings.getIncludePatternsForPath(filePath);
        const relativePath = vscode.workspace.asRelativePath(filePath);
        
        // Check if file matches any exclusion pattern
        let isExcluded = false;
        for (const pattern of excludePatterns) {
            if (this.matchesPattern(relativePath, pattern)) {
                isExcluded = true;
                break;
            }
        }
        
        // Check if file matches any inclusion pattern (overrides exclusion)
        let isIncluded = false;
        for (const pattern of includePatterns) {
            if (this.matchesPattern(relativePath, pattern)) {
                isIncluded = true;
                break;
            }
        }
        
        // Apply inclusion override logic:
        // - If file matches inclusion pattern, never skip (even if excluded)
        // - If file doesn't match inclusion pattern but is excluded, skip
        // - If file doesn't match inclusion pattern and is not excluded, don't skip
        if (isIncluded) {
            this.debug.verbose('File included by inclusion pattern', { filePath, relativePath });
            return false; // Don't skip - inclusion pattern overrides exclusion
        }
        
        if (isExcluded) {
            this.debug.verbose('File excluded by exclusion pattern', { filePath, relativePath });
            return true; // Skip - file is excluded and no inclusion pattern matches
        }
        
        return false; // Don't skip - file is neither excluded nor specifically included
    }

    private async provideFolderDecoration(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
        try {
            this.debug.verbose('Providing folder decoration for:', uri.fsPath);
            const folderStats = await this.calculateFolderStats(uri.fsPath);
            this.debug.verbose('Folder stats:', folderStats);
            
            if (!folderStats) {
                this.debug.verbose('No folder stats found for:', uri.fsPath);
                return undefined;
            }

            // Get average emoji (left side - folder emojis) using path-based settings
            const avgThreshold = await this.pathBasedSettings.getColorThresholdForPath(folderStats.averageLines, uri.fsPath);
            const avgEmoji = await this.pathBasedSettings.getFolderEmojiForPath(avgThreshold, uri.fsPath);
            
            // Get max emoji (right side - file emojis) using path-based settings 
            const maxThreshold = await this.pathBasedSettings.getColorThresholdForPath(folderStats.maxLines, folderStats.maxFilePath);
            const maxEmoji = await this.pathBasedSettings.getThemeEmojiForPath(maxThreshold, folderStats.maxFilePath);

            // Use the higher threshold for the overall color
            const overallThreshold = folderStats.maxLines > folderStats.averageLines ? maxThreshold : avgThreshold;
            const relativePath = vscode.workspace.asRelativePath(folderStats.maxFilePath);
            const fileName = path.basename(folderStats.maxFilePath);
            
            const tooltip = `📁 Folder: ${folderStats.fileCount} files\n` +
                           `📊 Average: ${folderStats.averageLines.toLocaleString()} lines (${avgEmoji})\n` +
                           `📈 Maximum: ${folderStats.maxLines.toLocaleString()} lines (${maxEmoji})\n` +
                           `🔥 Largest: ${fileName}`;

            const dualBadge = avgEmoji + maxEmoji;
            this.debug.verbose('Returning dual badge decoration:', { badge: dualBadge, avgEmoji, maxEmoji, tooltip });
            
            return {
                badge: dualBadge,
                tooltip: tooltip,
            };
        } catch (error) {
            this.debug.warning(`Failed to provide folder decoration for ${uri.fsPath}:`, error);
            return undefined;
        }
    }



    private async calculateFolderStats(folderPath: string): Promise<{
        fileCount: number;
        averageLines: number;
        maxLines: number;
        maxFilePath: string;
    } | undefined> {
        try {
            this.debug.verbose('Calculating folder stats for:', folderPath);
            
            // Check if directory exists before trying to read it
            try {
                const stat = await vscode.workspace.fs.stat(vscode.Uri.file(folderPath));
                if (stat.type !== vscode.FileType.Directory) {
                    this.debug.verbose('Path is not a directory:', folderPath);
                    return undefined;
                }
            } catch (error) {
                this.debug.verbose('Directory does not exist:', folderPath);
                return undefined;
            }
            
            const excludePatterns = await this.pathBasedSettings.getExcludePatternsForPath(folderPath);

            // Get all files in folder (limit depth to prevent timeout)
            const files = await this.getAllFilesInFolder(folderPath, excludePatterns, 2); // Max 2 levels deep
            this.debug.verbose(`Found ${files.length} files in folder ${folderPath}`);
            
            if (files.length === 0) {
                return undefined;
            }

            // Limit to first 30 files to prevent timeout
            const limitedFiles = files.slice(0, 30);
            const lineCounts: number[] = [];
            let maxLines = 0;
            let maxFilePath = '';

            for (const filePath of limitedFiles) {
                if (await this.shouldSkipFile(filePath)) {
                    continue;
                }

                const lineCount = await this.lineCountCache.getLineCount(filePath);
                if (lineCount && lineCount.lines > 0) {
                    lineCounts.push(lineCount.lines);
                    
                    if (lineCount.lines > maxLines) {
                        maxLines = lineCount.lines;
                        maxFilePath = filePath;
                    }
                }
            }

            if (lineCounts.length === 0) {
                return undefined;
            }

            const averageLines = Math.round(lineCounts.reduce((sum, count) => sum + count, 0) / lineCounts.length);
            
            const result = {
                fileCount: lineCounts.length,
                averageLines,
                maxLines,
                maxFilePath
            };

            this.debug.verbose('Calculated folder stats:', result);
            return result;
        } catch (error) {
            this.debug.warning(`Error calculating folder stats for ${folderPath}:`, error);
            return undefined;
        }
    }

    private async getAllFilesInFolder(folderPath: string, excludePatterns: string[], maxDepth: number = 10, currentDepth: number = 0): Promise<string[]> {
        const files: string[] = [];
        
        // Prevent infinite recursion
        if (currentDepth >= maxDepth) {
            return files;
        }
        
        const folderUri = vscode.Uri.file(folderPath);

        try {
            const entries = await vscode.workspace.fs.readDirectory(folderUri);
            
            for (const [name, type] of entries) {
                const fullPath = path.join(folderPath, name);
                const relativePath = vscode.workspace.asRelativePath(fullPath);
                
                // Check if this path matches any exclude pattern
                const isExcluded = excludePatterns.some(pattern => this.matchesPattern(relativePath, pattern));
                if (isExcluded) {
                    continue;
                }

                if (type === vscode.FileType.File) {
                    files.push(fullPath);
                } else if (type === vscode.FileType.Directory) {
                    // Recursively get files from subdirectories
                    const subFiles = await this.getAllFilesInFolder(fullPath, excludePatterns, maxDepth, currentDepth + 1);
                    files.push(...subFiles);
                }
            }
        } catch (error) {
            this.debug.warning(`Error reading directory ${folderPath}:`, error);
        }

        return files;
    }

    private matchesPattern(filePath: string, pattern: string): boolean {
        // Use robust glob matching from GlobUtils
        return GlobUtils.matchesPattern(filePath.replace(/\\/g, '/'), pattern);
    }

    private createColoredTooltip(filePath: string, lineCount: CachedLineCount): string {
        const fileName = path.basename(filePath);
        return lineThresholdService.createColoredTooltip(
            fileName,
            lineCount.lines,
            lineCount.codeLines,
            lineCount.commentLines,
            lineCount.blankLines,
            lineCount.size
        );
    }

    private async createPathAwareTooltip(filePath: string, lineCount: CachedLineCount, threshold: string, emoji: string): Promise<string> {
        const fileName = path.basename(filePath);
        
        // Get path-based thresholds
        const thresholdConfig = await this.pathBasedSettings.getThresholdConfigForPath(filePath);
        
        let thresholdInfo = '';
        if (thresholdConfig.enabled) {
            switch (threshold) {
                case 'normal':
                    thresholdInfo = ` (${emoji} Below ${thresholdConfig.midThreshold} lines)`;
                    break;
                case 'warning':
                    thresholdInfo = ` (${emoji} Above ${thresholdConfig.midThreshold} lines)`;
                    break;
                case 'danger':
                    thresholdInfo = ` (${emoji} Above ${thresholdConfig.highThreshold} lines)`;
                    break;
            }
        }
        
        return `${fileName}${thresholdInfo}\n` +
               `──────────────────\n` +
               `Total Lines: ${lineCount.lines.toLocaleString()}\n` +
               `Code Lines: ${lineCount.codeLines.toLocaleString()}\n` +
               `Comment Lines: ${lineCount.commentLines.toLocaleString()}\n` +
               `Blank Lines: ${lineCount.blankLines.toLocaleString()}\n` +
               `File Size: ${this.formatFileSize(lineCount.size)}`;
    }

    private formatFileSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    refresh(): void {
        // Clear cache to ensure fresh data is loaded
        this.lineCountCache.clearCache();
        // Fire event to refresh all decorations
        this._onDidChangeFileDecorations.fire(undefined);
    }

    // Toggle functionality removed - users can disable the extension if they don't want it

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.lineCountCache.dispose();
        this.pathBasedSettings.dispose();
        this._onDidChangeFileDecorations.dispose();
    }
}