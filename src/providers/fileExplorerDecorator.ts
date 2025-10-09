import * as vscode from 'vscode';
import * as path from 'path';
import { LineCountCacheService, CachedLineCount } from '../services/lineCountCache';
import { ColorThresholdService } from '../services/colorThresholdService';

export class FileExplorerDecorationProvider implements vscode.FileDecorationProvider {
    private _onDidChangeFileDecorations: vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined> = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[] | undefined> = this._onDidChangeFileDecorations.event;

    private lineCountCache: LineCountCacheService;
    private displayMode: 'always' | 'hover' | 'off' = 'hover';
    private disposables: vscode.Disposable[] = [];

    constructor() {
        this.lineCountCache = new LineCountCacheService();
        this.updateDisplayMode();
        this.setupConfigurationWatcher();
    }

    private setupConfigurationWatcher(): void {
        const configWatcher = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('codeCounter.showLineCountsInExplorer') ||
                event.affectsConfiguration('codeCounter.colorThresholds') ||
                event.affectsConfiguration('codeCounter.colors')) {
                this.updateDisplayMode();
                this._onDidChangeFileDecorations.fire(undefined);
            }
        });
        this.disposables.push(configWatcher);
    }

    private updateDisplayMode(): void {
        const config = vscode.workspace.getConfiguration('codeCounter');
        this.displayMode = config.get('showLineCountsInExplorer', 'hover');
    }

    async provideFileDecoration(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
        if (this.displayMode === 'off') {
            return undefined;
        }

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

            const { text: suffix, color } = ColorThresholdService.formatLineCountWithColor(lineCount.lines);
            
            // For file decorations, we need to use ThemeColor, not hex strings
            // If custom color is used, we'll fall back to a generic theme color
            const themeColor = typeof color === 'string' 
                ? this.getThemeColorFromHex(color)
                : color;
            
            return {
                badge: this.displayMode === 'always' ? suffix : undefined,
                tooltip: this.createTooltip(uri.fsPath, lineCount),
                color: themeColor
            };

        } catch (error) {
            console.warn(`Failed to provide decoration for ${uri.fsPath}:`, error);
            return undefined;
        }
    }

    private shouldSkipFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        const skipExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', 
                               '.mp4', '.avi', '.mov', '.mp3', '.wav', '.pdf', '.zip', 
                               '.tar', '.gz', '.exe', '.dll', '.so', '.dylib'];
        
        return skipExtensions.includes(ext) || 
               path.basename(filePath).startsWith('.') ||
               filePath.includes('node_modules') ||
               filePath.includes('.git');
    }

    private getThemeColorFromHex(hexColor: string): vscode.ThemeColor {
        // Map hex colors to appropriate theme colors based on brightness
        // This is a simplified approach - for custom colors, we'll use generic theme colors
        const brightness = this.getColorBrightness(hexColor);
        
        if (brightness < 0.4) {
            return new vscode.ThemeColor('errorForeground'); // Red-ish
        } else if (brightness < 0.7) {
            return new vscode.ThemeColor('warningForeground'); // Yellow-ish  
        } else {
            return new vscode.ThemeColor('terminal.ansiGreen'); // Green-ish
        }
    }

    private getColorBrightness(hexColor: string): number {
        // Remove # if present
        const hex = hexColor.replace('#', '');
        
        // Convert to RGB
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        // Calculate perceived brightness (0-1)
        return (r * 299 + g * 587 + b * 114) / 1000 / 255;
    }

    private createTooltip(filePath: string, lineCount: CachedLineCount): string {
        const fileName = path.basename(filePath);
        return ColorThresholdService.createColoredTooltip(
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

    toggleExplorerLineCounts(): void {
        const config = vscode.workspace.getConfiguration('codeCounter');
        const currentMode = config.get<'always' | 'hover' | 'off'>('showLineCountsInExplorer', 'hover');
        
        let newMode: 'always' | 'hover' | 'off';
        switch (currentMode) {
            case 'always':
                newMode = 'hover';
                break;
            case 'hover':
                newMode = 'off';
                break;
            case 'off':
                newMode = 'always';
                break;
            default:
                newMode = 'hover';
        }

        config.update('showLineCountsInExplorer', newMode, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Explorer line counts: ${newMode}`);
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.lineCountCache.dispose();
        this._onDidChangeFileDecorations.dispose();
    }
}