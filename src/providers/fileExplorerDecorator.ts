import * as vscode from 'vscode';
import * as path from 'path';
import { LineCountCacheService, CachedLineCount } from '../services/lineCountCache';
import { lineThresholdService } from '../services/lineThresholdService';
import { GlobUtils } from '../utils/globUtils';

export class FileExplorerDecorationProvider implements vscode.FileDecorationProvider {
    private _onDidChangeFileDecorations: vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined> = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[] | undefined> = this._onDidChangeFileDecorations.event;

    private lineCountCache: LineCountCacheService;
    private disposables: vscode.Disposable[] = [];

    constructor() {
        this.lineCountCache = new LineCountCacheService();
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
            // Fire change event for the specific file to refresh its decoration
            // The cache will be automatically invalidated when the decoration is re-rendered
            this._onDidChangeFileDecorations.fire(document.uri);
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

    async provideFileDecoration(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
        // Extension is enabled, so always show decorations based on mode
        console.log('provideFileDecoration called for:', uri.fsPath);

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
        if (this.shouldSkipFile(uri.fsPath)) {
            return undefined;
        }

        try {
            const lineCount = await this.lineCountCache.getLineCount(uri.fsPath);
            if (!lineCount) {
                return undefined;
            }

            // Get the color classification for this line count
            const threshold = lineThresholdService.getColorThreshold(lineCount.lines);
            const coloredTooltip = this.createColoredTooltip(uri.fsPath, lineCount);
            
            // Use different colored icons based on line count thresholds
            let badge = '●';
            let themeColor: vscode.ThemeColor;
            
            // Get custom emojis from configuration
            const emoji = lineThresholdService.getThemeEmoji(threshold);
            
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

    private shouldSkipFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        
        // Skip binary files that don't make sense to count
        const skipExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', 
                               '.mp4', '.avi', '.mov', '.mp3', '.wav', '.pdf', '.zip', 
                               '.tar', '.gz', '.exe', '.dll', '.so', '.dylib'];
        
        if (skipExtensions.includes(ext)) {
            return true;
        }

        // Check against user-configured exclusion patterns
        const config = vscode.workspace.getConfiguration('codeCounter');
        const excludePatterns = config.get<string[]>('excludePatterns', []);
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

            // Get average emoji (left side - folder emojis)
            const avgThreshold = lineThresholdService.getColorThreshold(folderStats.averageLines);
            const avgEmoji = this.getFolderEmoji(avgThreshold);
            
            // Get max emoji (right side - file emojis)  
            const maxThreshold = lineThresholdService.getColorThreshold(folderStats.maxLines);
            const maxEmoji = lineThresholdService.getThemeEmoji(maxThreshold);

            // Use the higher threshold for the overall color
            const overallThreshold = folderStats.maxLines > folderStats.averageLines ? maxThreshold : avgThreshold;
            let themeColor: vscode.ThemeColor;
            switch (overallThreshold) {
                case 'normal':
                    themeColor = new vscode.ThemeColor('terminal.ansiGreen');
                    break;
                case 'warning':
                    themeColor = new vscode.ThemeColor('warningForeground');
                    break;
                case 'danger':
                    themeColor = new vscode.ThemeColor('errorForeground');
                    break;
                default:
                    themeColor = new vscode.ThemeColor('foreground');
            }

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
                color: themeColor,
            };
        } catch (error) {
            console.warn(`Failed to provide folder decoration for ${uri.fsPath}:`, error);
            return undefined;
        }
    }

    private getFolderEmoji(threshold: string): string {
        const config = vscode.workspace.getConfiguration('codeCounter.emojis.folders');
        
        switch (threshold) {
            case 'normal':
                return config.get<string>('normal', '🟩');
            case 'warning':
                return config.get<string>('warning', '🟨');
            case 'danger':
                return config.get<string>('danger', '🟥');
            default:
                return '⬜'; // White square for unknown
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
            const config = vscode.workspace.getConfiguration('codeCounter');
            const excludePatterns = config.get<string[]>('excludePatterns', []);

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
                if (this.shouldSkipFile(filePath)) {
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