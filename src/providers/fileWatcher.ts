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
import { CountLinesCommand } from '../commands/countLines';
import { GlobUtils } from '../utils/globUtils';

export class FileWatcherProvider implements vscode.Disposable {
    private fileWatcher: vscode.FileSystemWatcher;
    private countLinesCommand: CountLinesCommand;
    private documentSaveWatcher!: vscode.Disposable;

    constructor() {
        this.countLinesCommand = new CountLinesCommand();
        
        // Watch for file changes - but only for code files, not all files
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{js,ts,jsx,tsx,py,java,c,cpp,cs,php,rb,go,rs,swift,kt,scala,html,css,scss,sass,less,json,xml,yaml,yml,md,txt,sh,bat,ps1}');
        
        // Set up event listeners - only for create and delete, not change (too frequent)
        // this.fileWatcher.onDidChange(this.onFileChange.bind(this)); // Removed - too frequent
        this.fileWatcher.onDidCreate(this.onFileChange.bind(this));
        this.fileWatcher.onDidDelete(this.onFileChange.bind(this));
        
        // Listen for document saves instead of file changes
        this.setupDocumentSaveWatcher();
    }

    private setupDocumentSaveWatcher(): void {
        this.documentSaveWatcher = vscode.workspace.onDidSaveTextDocument((document) => {
            this.onDocumentSave(document.uri);
        });
    }

    private async onDocumentSave(uri: vscode.Uri): Promise<void> {
        // Use the same logic as onFileChange but only for saves
        await this.onFileChange(uri);
    }

    private async onFileChange(uri: vscode.Uri): Promise<void> {
        const config = vscode.workspace.getConfiguration('codeCounter');
        const autoGenerate = config.get<boolean>('autoGenerate', true);

        if (!autoGenerate) {
            return;
        }

        // Skip if file is in excluded patterns
        const excludePatterns = config.get<string[]>('excludePatterns', []);
        const relativePath = vscode.workspace.asRelativePath(uri);
        
        for (const pattern of excludePatterns) {
            if (this.matchesPattern(relativePath, pattern)) {
                return;
            }
        }

        // Debounce the regeneration to avoid too frequent updates
        this.debounceRegenerate();
    }

    private matchesPattern(filePath: string, pattern: string): boolean {
        // Use robust glob matching from GlobUtils
        return GlobUtils.matchesPattern(filePath, pattern);
    }

    private regenerateTimeout?: NodeJS.Timeout;
    
    private debounceRegenerate(): void {
        if (this.regenerateTimeout) {
            clearTimeout(this.regenerateTimeout);
        }
        
        this.regenerateTimeout = setTimeout(() => {
            this.countLinesCommand.executeAndShowNotification();
        }, 2000); // 2 second debounce
    }

    dispose(): void {
        if (this.regenerateTimeout) {
            clearTimeout(this.regenerateTimeout);
        }
        this.fileWatcher.dispose();
        this.documentSaveWatcher.dispose();
    }
}