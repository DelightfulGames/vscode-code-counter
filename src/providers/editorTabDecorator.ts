import * as vscode from 'vscode';
import * as path from 'path';
import { LineCountCacheService, CachedLineCount } from '../services/lineCountCache';
import { ColorThresholdService } from '../services/colorThresholdService';

export class EditorTabDecorationProvider {
    private lineCountCache: LineCountCacheService;
    private displayMode: 'always' | 'hover' | 'off' = 'hover';
    private disposables: vscode.Disposable[] = [];
    private statusBarItem: vscode.StatusBarItem;
    private currentDocument: vscode.TextDocument | undefined;

    constructor() {
        this.lineCountCache = new LineCountCacheService();
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        
        this.updateDisplayMode();
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Listen for configuration changes
        const configWatcher = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('codeCounter.showLineCountsInTabs') ||
                event.affectsConfiguration('codeCounter.colorThresholds') ||
                event.affectsConfiguration('codeCounter.colors')) {
                this.updateDisplayMode();
                this.updateStatusBar();
            }
        });

        // Listen for active editor changes
        const editorWatcher = vscode.window.onDidChangeActiveTextEditor(editor => {
            this.currentDocument = editor?.document;
            this.updateStatusBar();
        });

        // Listen for document changes to update counts
        const documentWatcher = vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document === this.currentDocument) {
                // Debounce updates to avoid too frequent recalculation
                this.debounceUpdateStatusBar();
            }
        });

        this.disposables.push(configWatcher, editorWatcher, documentWatcher);

        // Initialize with current editor
        if (vscode.window.activeTextEditor) {
            this.currentDocument = vscode.window.activeTextEditor.document;
            this.updateStatusBar();
        }
    }

    private updateDisplayMode(): void {
        const config = vscode.workspace.getConfiguration('codeCounter');
        this.displayMode = config.get('showLineCountsInTabs', 'hover');
    }

    private updateTimeout?: NodeJS.Timeout;

    private debounceUpdateStatusBar(): void {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        this.updateTimeout = setTimeout(() => {
            this.updateStatusBar();
        }, 500);
    }

    private async updateStatusBar(): Promise<void> {
        if (this.displayMode === 'off' || !this.currentDocument) {
            this.statusBarItem.hide();
            return;
        }

        try {
            const lineCount = await this.lineCountCache.getLineCountForDocument(this.currentDocument);
            if (!lineCount) {
                this.statusBarItem.hide();
                return;
            }

            const fileName = path.basename(this.currentDocument.uri.fsPath);
            const { text: formattedCount, color } = ColorThresholdService.getStatusBarText(lineCount.lines);
            
            // Different display based on mode
            if (this.displayMode === 'always') {
                this.statusBarItem.text = `$(file-code) ${formattedCount}`;
                this.statusBarItem.tooltip = this.createTooltip(fileName, lineCount);
                this.statusBarItem.color = color;
                this.statusBarItem.show();
            } else if (this.displayMode === 'hover') {
                this.statusBarItem.text = `$(file-code) Lines`;
                this.statusBarItem.tooltip = this.createDetailedTooltip(fileName, lineCount);
                this.statusBarItem.color = color;
                this.statusBarItem.show();
            }

        } catch (error) {
            console.warn('Failed to update status bar:', error);
            this.statusBarItem.hide();
        }
    }

    private createTooltip(fileName: string, lineCount: CachedLineCount): string {
        return `${fileName}: ${lineCount.lines.toLocaleString()} lines`;
    }

    private createDetailedTooltip(fileName: string, lineCount: CachedLineCount): string {
        return ColorThresholdService.createColoredTooltip(
            fileName,
            lineCount.lines,
            lineCount.codeLines,
            lineCount.commentLines,
            lineCount.blankLines,
            lineCount.size
        );
    }

    // Command handlers
    toggleTabLineCounts(): void {
        const config = vscode.workspace.getConfiguration('codeCounter');
        const currentMode = config.get<'always' | 'hover' | 'off'>('showLineCountsInTabs', 'hover');
        
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

        config.update('showLineCountsInTabs', newMode, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Tab line counts: ${newMode}`);
    }

    dispose(): void {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        this.disposables.forEach(d => d.dispose());
        this.statusBarItem.dispose();
        this.lineCountCache.dispose();
    }
}