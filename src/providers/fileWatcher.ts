import * as vscode from 'vscode';
import * as path from 'path';
import { CountLinesCommand } from '../commands/countLines';

export class FileWatcherProvider implements vscode.Disposable {
    private fileWatcher: vscode.FileSystemWatcher;
    private countLinesCommand: CountLinesCommand;

    constructor() {
        this.countLinesCommand = new CountLinesCommand();
        
        // Watch for file changes
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
        
        // Set up event listeners
        this.fileWatcher.onDidChange(this.onFileChange.bind(this));
        this.fileWatcher.onDidCreate(this.onFileChange.bind(this));
        this.fileWatcher.onDidDelete(this.onFileChange.bind(this));
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
    }
}