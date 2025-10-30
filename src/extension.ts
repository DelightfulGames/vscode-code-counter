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
import * as fs from 'fs';
import { CountLinesCommand } from './commands/countLines';
import { FileWatcherProvider } from './providers/fileWatcher';
import { FileExplorerDecorationProvider } from './providers/fileExplorerDecorator';
import { EditorTabDecorationProvider } from './providers/editorTabDecorator';
import { PathBasedSettingsService } from './services/pathBasedSettingsService';
import { DebugService } from './services/debugService';
import { WorkspaceDatabaseService, WorkspaceSettings, ResolvedSettings } from './services/workspaceDatabaseService';

// Import utilities to replace large inline functions
import { showCodeCounterSettings } from './utils/webviewManager';
import { 
    findNearestConfigDirectory, 
    addExclusionPattern, 
    handleExcludeRelativePath,
    handleExcludeFilePattern,
    handleExcludeExtension
} from './utils/exclusionUtils';

// Import shared utilities - comprehensive refactoring
import { 
    getWorkspaceService,
    invalidateWorkspaceServiceCache,
    clearServiceCache,
    setGlobalPathBasedSettings, 
    setGlobalFileExplorerDecorator,
    setGlobalEmojiPickerPanel,
    setGlobalCurrentDirectory,
    getGlobalCurrentDirectory,
    getCurrentConfiguration,
    addSourceToSettings,
    getResolvedSettingsFromDatabase,
    validateAndSanitizeDirectory,
    calculateTargetPath,
    notifySettingsChanged,
    refreshFileExplorerDecorator,
    refreshEmojiPickerWebviewWithService,
    WorkspaceData
} from './shared/extensionUtils';
import { getDirectoryTreeFromDatabase } from './shared/directoryUtils';
import { 
    getEmojiPickerWebviewContent,
    escapeHtml
} from './shared/webviewUtils';

// Initialize debug service
const debug = DebugService.getInstance();

export function activate(context: vscode.ExtensionContext) {
    // Initialize debug service with configuration monitoring
    const debug = DebugService.getInstance();
    debug.initialize(context);
    debug.info('Code Counter extension activated');

    // Auto-migrate from .code-counter.json files to database on startup
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const workspaceService = new WorkspaceDatabaseService(workspacePath);
        
        // Trigger migration and cleanup asynchronously 
        workspaceService.migrateAndCleanupJsonFiles().then(migrationResult => {
            if (migrationResult.migrated > 0) {
                debug.info(`VS Code Code Counter: Migrated ${migrationResult.migrated} settings files and deleted ${migrationResult.deleted} JSON files`);
                
                let message = `Code Counter: Successfully migrated ${migrationResult.migrated} settings files to new database format!`;
                if (migrationResult.deleted > 0) {
                    message += ` Cleaned up ${migrationResult.deleted} legacy JSON files.`;
                }
                
                vscode.window.showInformationMessage(message);
            }
            if (migrationResult.errors.length > 0) {
                debug.warning('Migration errors:', migrationResult.errors);
                vscode.window.showWarningMessage(
                    `Code Counter: Migration completed with ${migrationResult.errors.length} errors. Check output for details.`
                );
            }
        }).catch(error => {
            debug.error('Migration and cleanup failed:', error);
            vscode.window.showWarningMessage('Code Counter: Failed to migrate legacy settings files. Extension will still work with default settings.');
        });
    }

    // Initialize services
    const fileWatcher = new FileWatcherProvider();
    const countLinesCommand = new CountLinesCommand();
    
    // Create a shared PathBasedSettingsService instance for both decorators
    const pathBasedSettings = new PathBasedSettingsService();
    setGlobalPathBasedSettings(pathBasedSettings); // Set global reference for settings notifications
    const fileExplorerDecorator = new FileExplorerDecorationProvider(pathBasedSettings);
    setGlobalFileExplorerDecorator(fileExplorerDecorator); // Set global reference for decorator refresh
    const editorTabDecorator = new EditorTabDecorationProvider(pathBasedSettings);

    // Create a dedicated file system watcher for .code-counter.json files
    // This ensures decorators refresh when configuration files are modified/deleted externally
    const configFileWatcher = vscode.workspace.createFileSystemWatcher('**/.code-counter.json');
    
    // Handle .code-counter.json file changes (creation, modification, deletion)
    const onConfigFileChange = configFileWatcher.onDidChange(async (uri) => {
        debug.verbose('Configuration file changed:', uri.fsPath);
        // Refresh decorators when config files are modified
        fileExplorerDecorator.refresh();
        // EditorTabDecorator will refresh automatically through workspace settings events
    });
    
    const onConfigFileCreate = configFileWatcher.onDidCreate(async (uri) => {
        debug.verbose('Configuration file created:', uri.fsPath);
        // Refresh decorators when new config files are created
        fileExplorerDecorator.refresh();
        // EditorTabDecorator will refresh automatically through workspace settings events
    });
    
    const onConfigFileDelete = configFileWatcher.onDidDelete(async (uri) => {
        debug.verbose('Configuration file deleted:', uri.fsPath);
        // Refresh decorators when config files are deleted
        fileExplorerDecorator.refresh();
        // EditorTabDecorator will refresh automatically through workspace settings events
    });

    // Register file decoration provider for explorer
    const decorationProvider = vscode.window.registerFileDecorationProvider(fileExplorerDecorator);

    // Register commands
    const countLinesDisposable = vscode.commands.registerCommand('codeCounter.countLines', () => {
        countLinesCommand.execute();
    });

    // Internal command for refreshing decorations
    const refreshDecorationsDisposable = vscode.commands.registerCommand('codeCounter.internal.refreshDecorations', () => {
        refreshFileExplorerDecorator();
    });

    // Removed toggle commands - users can simply disable the extension if they don't want it

    const resetColorsDisposable = vscode.commands.registerCommand('codeCounter.resetBadgeSettings', async () => {
        const emojiConfig = vscode.workspace.getConfiguration('codeCounter.emojis');
        
        await emojiConfig.update('normal', '🟢', vscode.ConfigurationTarget.Global);
        await emojiConfig.update('warning', '🟡', vscode.ConfigurationTarget.Global);
        await emojiConfig.update('danger', '🔴', vscode.ConfigurationTarget.Global);
        
        vscode.window.showInformationMessage('Emoji indicators reset to defaults: 🟢 🟡 🔴');
    });

    const openColorSettingsDisposable = vscode.commands.registerCommand('codeCounter.openSettings', async () => {
        try {
            debug.info('Opening Code Counter settings...');
            await showCodeCounterSettings(fileExplorerDecorator, context, pathBasedSettings);
            debug.info('Code Counter settings opened successfully');
        } catch (error) {
            debug.error('Failed to open Code Counter settings:', error);
            vscode.window.showErrorMessage(`Failed to open Code Counter settings: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    const showReportPanelDisposable = vscode.commands.registerCommand('codeCounter.showReportPanel', async () => {
        await countLinesCommand.executeAndShowPanel();
    });

    // Context menu exclusion commands
    const excludeRelativePathDisposable = vscode.commands.registerCommand('codeCounter.excludeRelativePath', async (resource: vscode.Uri) => {
        await handleExcludeRelativePath(resource);
    });

    const excludeFilePatternDisposable = vscode.commands.registerCommand('codeCounter.excludeFileFolderPattern', async (resource: vscode.Uri) => {
        await handleExcludeFilePattern(resource);
    });

    const excludeExtensionDisposable = vscode.commands.registerCommand('codeCounter.excludeExtension', async (resource: vscode.Uri) => {
        await handleExcludeExtension(resource);
    });

    // Add all disposables to context
    context.subscriptions.push(
        countLinesDisposable,
        refreshDecorationsDisposable,
        resetColorsDisposable,
        openColorSettingsDisposable,
        showReportPanelDisposable,
        excludeRelativePathDisposable,
        excludeFilePatternDisposable,
        excludeExtensionDisposable,
        decorationProvider,
        fileWatcher,
        fileExplorerDecorator,
        editorTabDecorator,
        configFileWatcher,
        onConfigFileChange,
        onConfigFileCreate,
        onConfigFileDelete
    );
}

export function deactivate() {
    // Clean up debug service
    const debug = DebugService.getInstance();
    debug.dispose();
    
    // Clean up service cache
    clearServiceCache();
}

