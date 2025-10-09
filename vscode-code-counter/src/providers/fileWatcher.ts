import * as vscode from 'vscode';
import { LineCounter } from '../services/lineCounter';

export class FileWatcher {
    private watcher: vscode.FileSystemWatcher;
    private lineCounter: LineCounter;

    constructor(lineCounter: LineCounter) {
        this.lineCounter = lineCounter;
        this.watcher = vscode.workspace.createFileSystemWatcher('**/*');

        this.watcher.onDidChange(this.onFileChange.bind(this));
        this.watcher.onDidCreate(this.onFileChange.bind(this));
        this.watcher.onDidDelete(this.onFileDelete.bind(this));
    }

    private onFileChange(uri: vscode.Uri) {
        this.lineCounter.countLinesInProject();
    }

    private onFileDelete(uri: vscode.Uri) {
        // Handle file deletion if necessary
    }

    public dispose() {
        this.watcher.dispose();
    }
}