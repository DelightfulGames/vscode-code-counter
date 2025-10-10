import * as vscode from 'vscode';
import * as path from 'path';
import { LineCountCacheService, CachedLineCount } from '../services/lineCountCache';
import { lineThresholdService } from '../services/lineThresholdService';

export class EditorTabDecorationProvider {
    private lineCountCache: LineCountCacheService;
    private disposables: vscode.Disposable[] = [];
    private statusBarItem: vscode.StatusBarItem;
    private currentDocument: vscode.TextDocument | undefined;

    constructor() {
        this.lineCountCache = new LineCountCacheService();
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Listen for configuration changes
        const configWatcher = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('codeCounter.showLineCountsInTabs') ||
                event.affectsConfiguration('codeCounter.lineThresholds') ||
                event.affectsConfiguration('codeCounter.emojis')) {
                this.updateStatusBar();
            }
        });

        // Listen for active editor changes
        const editorWatcher = vscode.window.onDidChangeActiveTextEditor(editor => {
            this.currentDocument = editor?.document;
            this.updateStatusBar();
        });

        // Listen for document saves to update counts (much more efficient)
        const documentSaveWatcher = vscode.workspace.onDidSaveTextDocument(document => {
            if (document === this.currentDocument) {
                this.updateStatusBar();
            }
        });

        this.disposables.push(configWatcher, editorWatcher, documentSaveWatcher);

        // Initialize with current editor
        if (vscode.window.activeTextEditor) {
            this.currentDocument = vscode.window.activeTextEditor.document;
            this.updateStatusBar();
        }
    }

    private async updateStatusBar(): Promise<void> {
        if (!this.currentDocument) {
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
            const { text: formattedCount, emoji } = lineThresholdService.getStatusBarText(lineCount.lines);
            
            // Different display based on mode
            this.statusBarItem.text = `${emoji} ${formattedCount}`;
            this.statusBarItem.tooltip = this.createTooltip(fileName, lineCount);
            this.statusBarItem.show();

        } catch (error) {
            console.warn('Failed to update status bar:', error);
            this.statusBarItem.hide();
        }
    }

    private createTooltip(fileName: string, lineCount: CachedLineCount): string {
        return `Lines: ${lineCount.lines}`;
    }

    // Toggle functionality removed - users can disable the extension if they don't want it

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.statusBarItem.dispose();
        this.lineCountCache.dispose();
    }
}