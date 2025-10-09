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

            // Get the color classification for this line count
            const threshold = ColorThresholdService.getColorThreshold(lineCount.lines);
            const coloredTooltip = this.createColoredTooltip(lineCount);
            
            // Use different colored icons based on line count thresholds
            let badge = '●';
            let themeColor: vscode.ThemeColor;
            
            switch (threshold) {
                case 'normal':
                    badge = '🟢'; // Green circle
                    themeColor = new vscode.ThemeColor('terminal.ansiGreen');
                    break;
                case 'warning':
                    badge = '🟡'; // Yellow circle  
                    themeColor = new vscode.ThemeColor('warningForeground');
                    break;
                case 'danger':
                    badge = '🔴'; // Red circle
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
        const skipExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', 
                               '.mp4', '.avi', '.mov', '.mp3', '.wav', '.pdf', '.zip', 
                               '.tar', '.gz', '.exe', '.dll', '.so', '.dylib'];
        
        return skipExtensions.includes(ext) || 
               path.basename(filePath).startsWith('.') ||
               filePath.includes('node_modules') ||
               filePath.includes('.git');
    }



    private createColoredTooltip(lineCount: CachedLineCount): string {
        // Simple tooltip: "Lines: X" - VS Code will handle the tooltip styling
        return `Lines: ${lineCount.lines}`;
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