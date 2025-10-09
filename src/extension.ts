import * as vscode from 'vscode';
import { CountLinesCommand } from './commands/countLines';
import { FileWatcherProvider } from './providers/fileWatcher';
import { FileExplorerDecorationProvider } from './providers/fileExplorerDecorator';
import { EditorTabDecorationProvider } from './providers/editorTabDecorator';

export function activate(context: vscode.ExtensionContext) {
    console.log('Code Counter extension is now active!');

    // Initialize services
    const fileWatcher = new FileWatcherProvider();
    const countLinesCommand = new CountLinesCommand();
    const fileExplorerDecorator = new FileExplorerDecorationProvider();
    const editorTabDecorator = new EditorTabDecorationProvider();

    // Register file decoration provider for explorer
    const decorationProvider = vscode.window.registerFileDecorationProvider(fileExplorerDecorator);

    // Register commands
    const countLinesDisposable = vscode.commands.registerCommand('codeCounter.countLines', () => {
        countLinesCommand.execute();
    });

    const toggleExplorerDisposable = vscode.commands.registerCommand('codeCounter.toggleExplorerLineCounts', () => {
        fileExplorerDecorator.toggleExplorerLineCounts();
    });

    const toggleTabDisposable = vscode.commands.registerCommand('codeCounter.toggleTabLineCounts', () => {
        editorTabDecorator.toggleTabLineCounts();
    });

    const toggleColorDisposable = vscode.commands.registerCommand('codeCounter.toggleColorThresholds', () => {
        const config = vscode.workspace.getConfiguration('codeCounter.colorThresholds');
        const currentEnabled = config.get<boolean>('enabled', true);
        
        config.update('enabled', !currentEnabled, vscode.ConfigurationTarget.Global);
        
        const status = !currentEnabled ? 'enabled' : 'disabled';
        vscode.window.showInformationMessage(`Color coding for line counts: ${status}`);
    });

    const resetColorsDisposable = vscode.commands.registerCommand('codeCounter.resetColors', async () => {
        const colorConfig = vscode.workspace.getConfiguration('codeCounter.colors');
        
        await colorConfig.update('normal', '#4CAF50', vscode.ConfigurationTarget.Global);
        await colorConfig.update('warning', '#FFC107', vscode.ConfigurationTarget.Global);
        await colorConfig.update('danger', '#F44336', vscode.ConfigurationTarget.Global);
        
        vscode.window.showInformationMessage('Colors reset to defaults: Green, Yellow, Red');
    });

    const openColorSettingsDisposable = vscode.commands.registerCommand('codeCounter.openColorSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'codeCounter.colors');
    });

    // Add all disposables to context
    context.subscriptions.push(
        countLinesDisposable,
        toggleExplorerDisposable,
        toggleTabDisposable,
        toggleColorDisposable,
        resetColorsDisposable,
        openColorSettingsDisposable,
        decorationProvider,
        fileWatcher,
        fileExplorerDecorator,
        editorTabDecorator
    );
}

export function deactivate() {}