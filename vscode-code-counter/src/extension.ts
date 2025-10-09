import * as vscode from 'vscode';
import { FileWatcher } from './providers/fileWatcher';
import { countLinesCommand } from './commands/countLines';

export function activate(context: vscode.ExtensionContext) {
    const fileWatcher = new FileWatcher(context);
    context.subscriptions.push(fileWatcher);

    const countLines = vscode.commands.registerCommand('extension.countLines', countLinesCommand);
    context.subscriptions.push(countLines);
}

export function deactivate() {
    // Cleanup resources if needed
}