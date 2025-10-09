import * as vscode from 'vscode';
import * as path from 'path';
import { CountLinesCommand } from '../commands/countLines';

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
        // Simple glob pattern matching (could be enhanced with a proper glob library)
        const regexPattern = pattern
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '[^/]');
        
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(filePath);
    }

    private regenerateTimeout?: NodeJS.Timeout;
    
    private debounceRegenerate(): void {
        if (this.regenerateTimeout) {
            clearTimeout(this.regenerateTimeout);
        }
        
        this.regenerateTimeout = setTimeout(() => {
            this.countLinesCommand.execute();
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