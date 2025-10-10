import * as vscode from 'vscode';
import * as path from 'path';
import { LineCountCacheService, CachedLineCount } from '../services/lineCountCache';
import { lineThresholdservice } from '../services/lineThresholdservice';

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
                event.affectsConfiguration('codeCounter.emojis')) {
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
    }

    async provideFileDecoration(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
        // Extension is enabled, so always show decorations based on mode

        // Only decorate files, not directories
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat.type === vscode.FileType.Directory) {
                return undefined;
            }
        } catch {
            return undefined;
        }

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
            const threshold = lineThresholdservice.getColorThreshold(lineCount.lines);
            const coloredTooltip = this.createColoredTooltip(uri.fsPath, lineCount);
            
            // Use different colored icons based on line count thresholds
            let badge = '●';
            let themeColor: vscode.ThemeColor;
            
            // Get custom emojis from configuration
            const emoji = lineThresholdservice.getThemeEmoji(threshold);
            
            switch (threshold) {
                case 'normal':
                    badge = emoji;
                    themeColor = new vscode.ThemeColor('terminal.ansiGreen');
                    break;
                case 'warning':
                    badge = emoji;
                    themeColor = new vscode.ThemeColor('warningForeground');
                    break;
                case 'danger':
                    badge = emoji;
                    themeColor = new vscode.ThemeColor('errorForeground');
                    break;
                default:
                    badge = '⚪'; // White circle for unknown
                    themeColor = new vscode.ThemeColor('foreground');
            }
            
            return {
                badge: badge,
                tooltip: coloredTooltip,
                color: themeColor,
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

    private matchesPattern(filePath: string, pattern: string): boolean {
        // Simple glob pattern matching (could be enhanced with a proper glob library)
        const regexPattern = pattern
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '[^/]');
        
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(filePath);
    }

    private createColoredTooltip(filePath: string, lineCount: CachedLineCount): string {
        const fileName = path.basename(filePath);
        return lineThresholdservice.createColoredTooltip(
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