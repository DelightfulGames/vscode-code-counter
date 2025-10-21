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
import { WorkspaceSettingsService } from '../services/workspaceSettingsService';

export class EditorTabDecorationProvider {
    private lineCountCache: LineCountCacheService;
    private pathBasedSettings: PathBasedSettingsService;
    private disposables: vscode.Disposable[] = [];
    private statusBarItem: vscode.StatusBarItem;
    private currentDocument: vscode.TextDocument | undefined;

    constructor() {
        this.lineCountCache = new LineCountCacheService();
        this.pathBasedSettings = new PathBasedSettingsService();
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

        // Listen for workspace settings changes (.code-counter.json file saves)
        const workspaceSettingsWatcher = WorkspaceSettingsService.onDidChangeSettings((event) => {
            console.log('Workspace settings changed - updating status bar:', event.configFilePath);
            this.updateStatusBar();
        });

        this.disposables.push(configWatcher, editorWatcher, documentSaveWatcher, workspaceSettingsWatcher);

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
            const { text: formattedCount, emoji } = await this.pathBasedSettings.getStatusBarTextForPath(lineCount.lines, this.currentDocument.uri.fsPath);
            
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