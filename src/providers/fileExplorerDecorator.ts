import * as vscode from 'vscode';
import * as path from 'path';
import { LineCountCacheService, CachedLineCount } from '../services/lineCountCache';
import { lineThresholdService } from '../services/lineThresholdService';
import { PathBasedSettingsService } from '../services/pathBasedSettingsService';
import { WorkspaceSettingsService } from '../services/workspaceSettingsService';
import { GlobUtils } from '../utils/globUtils';

export class FileExplorerDecorationProvider implements vscode.FileDecorationProvider {
    private _onDidChangeFileDecorations: vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined> = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[] | undefined> = this._onDidChangeFileDecorations.event;

    private lineCountCache: LineCountCacheService;
    private pathBasedSettings: PathBasedSettingsService;
    private disposables: vscode.Disposable[] = [];

    constructor() {
        this.lineCountCache = new LineCountCacheService();
        this.pathBasedSettings = new PathBasedSettingsService();
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
                    console.log('Exclude patterns changed - invalidating all caches and refreshing decorations');
                    this.lineCountCache.clearCache();
                }
                this._onDidChangeFileDecorations.fire(undefined);
            }
        });
        this.disposables.push(configWatcher);

        // Listen for file saves to refresh decorations
        const saveWatcher = vscode.workspace.onDidSaveTextDocument(document => {
            console.log('File saved:', document.uri.fsPath);
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
            console.log('File created:', uri.fsPath);
            // Invalidate cache for parent folders since their statistics changed
            this.lineCountCache.invalidateFolderCache(uri.fsPath);
            // Refresh the parent folder decoration
            this.refreshParentFolders(uri);
            // Also refresh the file itself if it's a file
            this._onDidChangeFileDecorations.fire(uri);
        });
        
        const onFileDelete = fileWatcher.onDidDelete(uri => {
            console.log('File deleted:', uri.fsPath);
            // Invalidate cache for parent folders since their statistics changed
            this.lineCountCache.invalidateFolderCache(uri.fsPath);
            // Refresh the parent folder decoration
            this.refreshParentFolders(uri);
        });

        this.disposables.push(fileWatcher, onFileCreate, onFileDelete);

        // Listen for workspace settings changes (.code-counter.json file saves)
        const workspaceSettingsWatcher = WorkspaceSettingsService.onDidChangeSettings((event) => {
            console.log('Workspace settings changed:', event.configFilePath);
            // Clear cache since settings (emojis, thresholds, excludes) may have changed
            // Settings changes can affect inheritance throughout the directory tree
            this.lineCountCache.clearCache();
            
            // Refresh the specific directory that changed
            const changedDirectoryUri = vscode.Uri.file(event.directoryPath);
            this._onDidChangeFileDecorations.fire(changedDirectoryUri);
            
            // Also refresh all parent directories up to workspace root since inheritance affects them
            this.refreshParentDirectoriesForWorkspaceChange(changedDirectoryUri);
            
            // Refresh immediate files in the changed directory
            this.refreshImmediateChildrenForWorkspaceChange(changedDirectoryUri);
            
            // Additionally refresh all subdirectories and their contents since they inherit from this directory
            this.refreshSubdirectoriesForWorkspaceChange(changedDirectoryUri);
        });
        this.disposables.push(workspaceSettingsWatcher);
    }

    private refreshParentFolders(uri: vscode.Uri): void {
        // Get the parent directory and refresh its decoration
        const parent = vscode.Uri.file(path.dirname(uri.fsPath));
        
        // Only refresh if parent is within workspace
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(parent);
        if (workspaceFolder) {
            console.log('Refreshing parent folder:', parent.fsPath);
            this._onDidChangeFileDecorations.fire(parent);
            
            // Also refresh grandparent folders up to workspace root
            let currentParent = parent;
            while (currentParent.fsPath !== workspaceFolder.uri.fsPath && 
                   currentParent.fsPath !== path.dirname(currentParent.fsPath)) {
                currentParent = vscode.Uri.file(path.dirname(currentParent.fsPath));
                console.log('Refreshing ancestor folder:', currentParent.fsPath);
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
            console.log('Refreshing parent directory for workspace change:', parent.fsPath);
            this._onDidChangeFileDecorations.fire(parent);
            
            // Recursively refresh parent directories up to workspace root
            let currentParent = parent;
            while (currentParent.fsPath !== workspaceFolder.uri.fsPath && 
                   currentParent.fsPath !== path.dirname(currentParent.fsPath)) {
                currentParent = vscode.Uri.file(path.dirname(currentParent.fsPath));
                if (currentParent.fsPath !== workspaceFolder.uri.fsPath) {
                    console.log('Refreshing ancestor directory for workspace change:', currentParent.fsPath);
                    this._onDidChangeFileDecorations.fire(currentParent);
                }
            }
            
            // Also refresh the workspace root itself
            console.log('Refreshing workspace root for workspace change:', workspaceFolder.uri.fsPath);
            this._onDidChangeFileDecorations.fire(workspaceFolder.uri);
        }
    }

    private async refreshImmediateChildrenForWorkspaceChange(changedDirectoryUri: vscode.Uri): Promise<void> {
        try {
            console.log('Refreshing immediate children for workspace settings change:', changedDirectoryUri.fsPath);
            
            // Check if directory exists before trying to read it
            try {
                const stat = await vscode.workspace.fs.stat(changedDirectoryUri);
                if (stat.type !== vscode.FileType.Directory) {
                    console.log('Path is not a directory, skipping refresh:', changedDirectoryUri.fsPath);
                    return;
                }
            } catch (error) {
                console.log('Directory does not exist, skipping refresh:', changedDirectoryUri.fsPath);
                return;
            }
            
            // Read the immediate children of the changed directory
            const entries = await vscode.workspace.fs.readDirectory(changedDirectoryUri);
            
            for (const [name, type] of entries) {
                const childUri = vscode.Uri.joinPath(changedDirectoryUri, name);
                console.log('Refreshing immediate child:', childUri.fsPath, type === vscode.FileType.Directory ? '(directory)' : '(file)');
                this._onDidChangeFileDecorations.fire(childUri);
            }
        } catch (error) {
            console.warn('Error refreshing immediate children for workspace change:', error);
        }
    }

    private async refreshSubdirectoriesForWorkspaceChange(changedDirectoryUri: vscode.Uri): Promise<void> {
        try {
            console.log('Refreshing all children for workspace settings change:', changedDirectoryUri.fsPath);
            
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
                console.log('Refreshing file for workspace change:', fileUri.fsPath);
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
                console.log('Refreshing directory for workspace change:', dirPath);
                this._onDidChangeFileDecorations.fire(vscode.Uri.file(dirPath));
            }

            // Also explicitly refresh the immediate children of the changed directory
            // This catches empty directories that might not have files
            try {
                const entries = await vscode.workspace.fs.readDirectory(changedDirectoryUri);
                for (const [name, type] of entries) {
                    const childUri = vscode.Uri.joinPath(changedDirectoryUri, name);
                    console.log('Refreshing immediate child for workspace change:', childUri.fsPath);
                    this._onDidChangeFileDecorations.fire(childUri);
                }
            } catch (readDirError) {
                console.warn('Could not read directory for immediate children refresh:', readDirError);
            }

        } catch (error) {
            console.warn('Error refreshing subdirectories for workspace change:', error);
        }
    }

    async provideFileDecoration(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
        // Extension is enabled, so always show decorations based on mode
        console.log('provideFileDecoration called for:', uri.toString());

        // Skip decorations for non-file URIs to prevent filesystem errors
        if (uri.scheme !== 'file') {
            console.log('Skipping decoration for non-file URI scheme:', uri.scheme);
            return undefined;
        }

        try {
            const stat = await vscode.workspace.fs.stat(uri);
            console.log('File type:', stat.type === vscode.FileType.Directory ? 'Directory' : 'File');
            
            if (stat.type === vscode.FileType.Directory) {
                // Handle folder decoration
                console.log('Calling provideFolderDecoration for:', uri.fsPath);
                return await this.provideFolderDecoration(uri);
            } else {
                // Handle file decoration
                return await this.provideFileDecorationForFile(uri);
            }
        } catch (error) {
            console.log('Error in provideFileDecoration:', error);
            return undefined;
        }
    }

    private async provideFileDecorationForFile(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {

        // Skip certain file types
        if (await this.shouldSkipFile(uri.fsPath)) {
            return undefined;
        }

        try {
            const lineCount = await this.lineCountCache.getLineCount(uri.fsPath);
            if (!lineCount) {
                return undefined;
            }

            // Get the color classification for this line count using path-based settings
            const threshold = await this.pathBasedSettings.getColorThresholdForPath(lineCount.lines, uri.fsPath);
            const coloredTooltip = this.createColoredTooltip(uri.fsPath, lineCount);
            
            // Use different colored icons based on line count thresholds
            let badge = '●';
            
            // Get custom emojis from path-based configuration
            const emoji = await this.pathBasedSettings.getThemeEmojiForPath(threshold, uri.fsPath);
            
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
            console.warn(`Failed to provide decoration for ${uri.fsPath}:`, error);
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

        // Check against path-based exclusion patterns
        const excludePatterns = await this.pathBasedSettings.getExcludePatternsForPath(filePath);
        const relativePath = vscode.workspace.asRelativePath(filePath);
        
        for (const pattern of excludePatterns) {
            if (this.matchesPattern(relativePath, pattern)) {
                return true;
            }
        }

        return false;
    }

    private async provideFolderDecoration(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
        try {
            console.log('Providing folder decoration for:', uri.fsPath);
            const folderStats = await this.calculateFolderStats(uri.fsPath);
            console.log('Folder stats:', folderStats);
            
            if (!folderStats) {
                console.log('No folder stats found for:', uri.fsPath);
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
            console.log('Returning dual badge decoration:', { badge: dualBadge, avgEmoji, maxEmoji, tooltip });
            
            return {
                badge: dualBadge,
                tooltip: tooltip,
            };
        } catch (error) {
            console.warn(`Failed to provide folder decoration for ${uri.fsPath}:`, error);
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
            console.log('Calculating folder stats for:', folderPath);
            
            // Check if directory exists before trying to read it
            try {
                const stat = await vscode.workspace.fs.stat(vscode.Uri.file(folderPath));
                if (stat.type !== vscode.FileType.Directory) {
                    console.log('Path is not a directory:', folderPath);
                    return undefined;
                }
            } catch (error) {
                console.log('Directory does not exist:', folderPath);
                return undefined;
            }
            
            const excludePatterns = await this.pathBasedSettings.getExcludePatternsForPath(folderPath);

            // Get all files in folder (limit depth to prevent timeout)
            const files = await this.getAllFilesInFolder(folderPath, excludePatterns, 2); // Max 2 levels deep
            console.log(`Found ${files.length} files in folder ${folderPath}`);
            
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

            console.log('Calculated folder stats:', result);
            return result;
        } catch (error) {
            console.warn(`Error calculating folder stats for ${folderPath}:`, error);
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
            console.warn(`Error reading directory ${folderPath}:`, error);
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

    refresh(): void {
        this._onDidChangeFileDecorations.fire(undefined);
    }

    // Toggle functionality removed - users can disable the extension if they don't want it

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.lineCountCache.dispose();
        this._onDidChangeFileDecorations.dispose();
    }
}