/**
 * VS Code Code Counter Extension
 * Settings Configuration Handler
 * 
 * Handles webview commands related to general extension settings and configuration
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { DebugService } from '../services/debugService';
import { 
    getWorkspaceService,
    setGlobalCurrentDirectory,
    getCurrentConfiguration,
    addSourceToSettings
} from '../shared/extensionUtils';
import { getDirectoryTreeFromDatabase } from '../shared/directoryUtils';
import { getEmojiPickerWebviewContent } from '../shared/webviewUtils';

export interface NotificationSettingMessage {
    command: 'updateNotificationSetting';
    enabled: boolean | null | undefined;
}

export interface OutputDirectoryMessage {
    command: 'updateOutputDirectory' | 'browseOutputDirectory';
    directory?: string;
}

export interface AutoGenerateMessage {
    command: 'updateAutoGenerate';
    enabled: boolean;
}

export type SettingsMessage = NotificationSettingMessage | OutputDirectoryMessage | AutoGenerateMessage;

// Initialize debug service
const debug = DebugService.getInstance();

export class SettingsHandler {
    
    /**
     * Handle updateNotificationSetting command
     */
    static async handleUpdateNotificationSetting(
        message: NotificationSettingMessage
    ): Promise<void> {
        const notificationConfig = vscode.workspace.getConfiguration('codeCounter');
        const enabledValue = message.enabled === null || message.enabled === undefined ? false : Boolean(message.enabled);
        await notificationConfig.update('showNotificationOnAutoGenerate', enabledValue, vscode.ConfigurationTarget.Global);
        const statusText = enabledValue ? 'enabled' : 'disabled';
        vscode.window.showInformationMessage(`Popup notifications on auto-generate ${statusText}`);
    }

    /**
     * Handle updateOutputDirectory command
     */
    static async handleUpdateOutputDirectory(
        message: OutputDirectoryMessage
    ): Promise<void> {
        const outputConfig = vscode.workspace.getConfiguration('codeCounter');
        await outputConfig.update('outputDirectory', message.directory, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Output directory updated to: ${message.directory}`);
    }

    /**
     * Handle browseOutputDirectory command
     */
    static async handleBrowseOutputDirectory(
        panel: vscode.WebviewPanel
    ): Promise<void> {
        const selectedFolder = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Output Directory'
        });
        
        if (selectedFolder && selectedFolder[0]) {
            const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            let relativePath = selectedFolder[0].fsPath;
            
            // Make path relative to workspace if possible
            if (workspacePath && relativePath.startsWith(workspacePath)) {
                relativePath = './' + path.relative(workspacePath, relativePath).replace(/\\/g, '/');
            }
            
            const browseOutputConfig = vscode.workspace.getConfiguration('codeCounter');
            await browseOutputConfig.update('outputDirectory', relativePath, vscode.ConfigurationTarget.Global);
            
            // Update the input field in the webview
            panel.webview.postMessage({
                command: 'updateOutputDirectoryField',
                directory: relativePath
            });
            
            vscode.window.showInformationMessage(`Output directory updated to: ${relativePath}`);
        }
    }

    /**
     * Handle updateAutoGenerate command
     */
    static async handleUpdateAutoGenerate(
        message: AutoGenerateMessage
    ): Promise<void> {
        const autoGenerateConfig = vscode.workspace.getConfiguration('codeCounter');
        await autoGenerateConfig.update('autoGenerate', message.enabled, vscode.ConfigurationTarget.Global);
        const autoGenerateStatusText = message.enabled ? 'enabled' : 'disabled';
        vscode.window.showInformationMessage(`Auto-generation ${autoGenerateStatusText}`);
    }

    /**
     * Handle resetEmoji command
     */
    static async handleResetEmoji(
        message: any,
        panel: vscode.WebviewPanel,
        fileExplorerDecorator: any,
        badges: any,
        folderBadges: any,
        thresholds: any
    ): Promise<void> {
        // This is a complex handler that will be implemented based on the original function
        // For now, return a placeholder
        vscode.window.showInformationMessage('Reset emoji functionality needs to be implemented');
    }

    /**
     * Handle createWorkspaceSettings command
     */
    static async handleCreateWorkspaceSettings(
        message: any,
        context: vscode.ExtensionContext,
        panel: vscode.WebviewPanel,
        badges: any,
        folderBadges: any,
        thresholds: any
    ): Promise<void> {
        // This handler will create workspace settings
        vscode.window.showInformationMessage('Create workspace settings functionality needs to be implemented');
    }

    /**
     * Handle checkEmptySettingsBeforeChange command
     */
    static async handleCheckEmptySettingsBeforeChange(
        message: any,
        panel: vscode.WebviewPanel
    ): Promise<void> {
        // This handler checks for empty settings
        panel.webview.postMessage({
            command: 'emptySettingsCheckResult',
            hasEmptySettings: false,
            targetDirectory: message.targetDirectory
        });
    }

    /**
     * Handle selectDirectory command
     */
    static async handleSelectDirectory(
        message: any,
        context: vscode.ExtensionContext,
        panel: vscode.WebviewPanel,
        badges: any,
        folderBadges: any,
        thresholds: any
    ): Promise<void> {
        debug.info('handleSelectDirectory called with:', { 
            directoryPath: message.directoryPath,
            previousDirectory: message.previousDirectory 
        });

        // Store the selected directory in extension state
        if (message.directoryPath !== '<global>') {
            await context.globalState.update('codeCounter.lastViewedDirectory', message.directoryPath);
        }

        // Set global current directory for other functions to use
        setGlobalCurrentDirectory(message.directoryPath);

        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            // No workspace - handle global mode
            const globalConfig = getCurrentConfiguration();
            panel.webview.html = getEmojiPickerWebviewContent(
                globalConfig.badges,
                globalConfig.folderBadges, 
                globalConfig.thresholds,
                globalConfig.excludePatterns,
                undefined, // No workspace data
                panel.webview
            );
            return;
        }

        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const workspaceService = getWorkspaceService(workspacePath);

        // Calculate target directory path
        let targetPath: string;
        let currentDirectory: string = message.directoryPath;

        if (message.directoryPath === '<global>') {
            // Global mode - use workspace path but show global settings
            targetPath = workspacePath;
            currentDirectory = '<global>';
        } else if (message.directoryPath === '<workspace>') {
            // Workspace root
            targetPath = workspacePath;
            currentDirectory = '<workspace>';
        } else {
            // Subdirectory
            targetPath = path.join(workspacePath, message.directoryPath);
            currentDirectory = message.directoryPath;
        }

        debug.info('Switching to directory:', { targetPath, currentDirectory });

        try {
            // Get settings with inheritance for the new directory
            const inheritanceInfo = await workspaceService.getSettingsWithInheritance(targetPath);
            const directoriesWithSettings = await workspaceService.getDirectoriesWithSettings();
            
            // Get directory tree
            const directoryTree = await getDirectoryTreeFromDatabase(workspaceService, workspacePath);
            
            // Get exclusion patterns with sources for this directory
            const patternsWithSources = await workspaceService.getExcludePatternsWithSources(targetPath);

            // Check if workspace has settings
            const hasWorkspaceSettings = directoriesWithSettings.includes(workspacePath);
            
            // Prepare workspace data for the selected directory
            const workspaceData = {
                mode: currentDirectory === '<global>' ? 'global' : 'workspace',
                directoryTree,
                currentDirectory,
                resolvedSettings: {
                    ...inheritanceInfo.resolvedSettings,
                    source: 'database'
                },
                currentSettings: {
                    ...inheritanceInfo.currentSettings,
                    source: 'database'
                },
                parentSettings: addSourceToSettings(inheritanceInfo.parentSettings),
                workspacePath,
                patternsWithSources,
                hasWorkspaceSettings
            };

            // Get badges and settings for this directory
            const globalConfig = getCurrentConfiguration();
            const resolvedSettings = inheritanceInfo.resolvedSettings;
            
            const directoryBadges = {
                low: resolvedSettings['codeCounter.emojis.normal'] || globalConfig.badges.low,
                medium: resolvedSettings['codeCounter.emojis.warning'] || globalConfig.badges.medium,
                high: resolvedSettings['codeCounter.emojis.danger'] || globalConfig.badges.high
            };
            
            const directoryFolderBadges = {
                low: resolvedSettings['codeCounter.emojis.folders.normal'] || globalConfig.folderBadges.low,
                medium: resolvedSettings['codeCounter.emojis.folders.warning'] || globalConfig.folderBadges.medium,
                high: resolvedSettings['codeCounter.emojis.folders.danger'] || globalConfig.folderBadges.high
            };
            
            const directoryThresholds = {
                mid: resolvedSettings['codeCounter.lineThresholds.midThreshold'] || globalConfig.thresholds.mid,
                high: resolvedSettings['codeCounter.lineThresholds.highThreshold'] || globalConfig.thresholds.high
            };

            const directoryExcludePatterns = resolvedSettings['codeCounter.excludePatterns'] || globalConfig.excludePatterns;

            debug.info('Refreshing webview with new directory settings');

            // Update the webview with the new directory's settings
            panel.webview.html = getEmojiPickerWebviewContent(
                directoryBadges,
                directoryFolderBadges,
                directoryThresholds,
                directoryExcludePatterns,
                workspaceData,
                panel.webview
            );

            debug.info(`Successfully switched to directory: ${currentDirectory}`);

        } catch (error) {
            debug.error('Error selecting directory:', error);
            vscode.window.showErrorMessage(`Failed to switch to directory: ${error}`);
        }
    }

    /**
     * Handle createSubWorkspace command
     */
    static async handleCreateSubWorkspace(
        message: any,
        context: vscode.ExtensionContext,
        panel: vscode.WebviewPanel
    ): Promise<void> {
        // This handler creates a sub-workspace
        vscode.window.showInformationMessage('Create sub-workspace functionality needs to be implemented');
    }

    /**
     * Handle saveWorkspaceSettings command
     */
    static async handleSaveWorkspaceSettings(
        message: any,
        pathBasedSettings: any,
        panel: vscode.WebviewPanel
    ): Promise<void> {
        // This handler saves workspace settings
        vscode.window.showInformationMessage('Save workspace settings functionality needs to be implemented');
    }

    /**
     * Handle resetWorkspaceField command
     */
    static async handleResetWorkspaceField(
        message: any,
        panel: vscode.WebviewPanel,
        fileExplorerDecorator: any
    ): Promise<void> {
        // This handler resets workspace field
        vscode.window.showInformationMessage('Reset workspace field functionality needs to be implemented');
    }

    /**
     * Handle configureDebugService command
     */
    static async handleConfigureDebugService(
        message: any
    ): Promise<void> {
        const backend = message.backend as 'none' | 'console' | 'file';
        
        // Update VS Code configuration - this will trigger automatic update via configuration listener
        const debugConfig = vscode.workspace.getConfiguration('codeCounter');
        await debugConfig.update('debug', backend, vscode.ConfigurationTarget.Global);
        
        let statusMessage = 'Disabled';
        if (backend === 'console') {
            statusMessage = 'Developer Tools';
        } else if (backend === 'file') {
            statusMessage = 'File Log (.vscode/code-counter/debug.log)';
        }
        vscode.window.showInformationMessage(`Debug service updated: ${statusMessage}`);
    }

    /**
     * Handle openDebugLogFile command
     */
    static async handleOpenDebugLogFile(): Promise<void> {
        try {
            const { DebugService } = await import('../services/debugService');
            const debugService = DebugService.getInstance();
            const logFilePath = debugService.getLogFilePath();
            
            if (logFilePath && require('fs').existsSync(logFilePath)) {
                // Open the debug log file in VS Code
                const document = await vscode.workspace.openTextDocument(logFilePath);
                await vscode.window.showTextDocument(document);
            } else {
                vscode.window.showWarningMessage('Debug log file not found. Make sure File Log is enabled and extension activity has generated logs.');
            }
        } catch (error) {
            vscode.window.showErrorMessage('Failed to open debug log file: ' + (error as Error).message);
        }
    }
}