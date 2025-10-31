/**
 * VS Code Code Counter Extension
 * Emoji and Theme Settings Handler
 * 
 * Handles webview commands related to emoji and theme customization
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WorkspaceDatabaseService } from '../services/workspaceDatabaseService';
import { DebugService } from '../services/debugService';
import { 
    getWorkspaceService, 
    notifySettingsChanged, 
    getCurrentConfiguration, 
    calculateTargetPath, 
    addSourceToSettings,
    refreshFileExplorerDecorator,
    invalidateWorkspaceServiceCache,
    WorkspaceData 
} from '../shared/extensionUtils';
import { getDirectoryTreeFromDatabase } from '../shared/directoryUtils';
import { getEmojiPickerWebviewContent } from '../shared/webviewUtils';

export interface EmojiMessage {
    command: string;
    type?: 'folder' | 'file';
    colorKey?: 'low' | 'medium' | 'high';
    emoji?: string;
    currentDirectory?: string;
    isWorkspaceMode?: boolean;
}

export class EmojiHandler {
    
    /**
     * Handle updateEmoji command
     */
    static async handleUpdateEmoji(
        message: EmojiMessage, 
        panel: vscode.WebviewPanel,
        fileExplorerDecorator: any
    ): Promise<void> {
        // Check if we have workspace folders and determine current mode from the message context
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const workspaceService = getWorkspaceService(workspacePath);
            
            // Determine the current directory and mode from the workspace data in the webview
            // We need to get this info from the message or reconstruct it
            let currentDirectory = '<global>';
            let isWorkspaceMode = false;
            
            // Check if the message contains directory info or if we need to ask the webview
            if (message.currentDirectory) {
                currentDirectory = message.currentDirectory;
                isWorkspaceMode = currentDirectory !== '<global>';
            } else {
                // Fallback: assume global mode if no directory info
                isWorkspaceMode = false;
            }
            
            if (isWorkspaceMode) {
                await this.handleWorkspaceEmojiUpdate(
                    message, 
                    workspacePath, 
                    workspaceService, 
                    currentDirectory, 
                    panel
                );
            } else {
                await this.handleGlobalEmojiUpdate(message, panel);
            }
        }
    }

    /**
     * Handle resetEmoji command
     */
    static async handleResetEmoji(
        message: EmojiMessage, 
        panel: vscode.WebviewPanel,
        fileExplorerDecorator: any
    ): Promise<void> {
        // Check if we're in workspace mode and have the necessary data
        DebugService.getInstance().verbose('Reset emoji command received - Full debug:', { 
            message: message,
            isWorkspaceMode: message.isWorkspaceMode, 
            currentDirectory: message.currentDirectory,
            hasWorkspaceFolders: !!(vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0)
        });
        
        if (message.isWorkspaceMode && message.currentDirectory && message.currentDirectory !== '<global>') {
            await this.handleWorkspaceEmojiReset(message);
        } else {
            await this.handleGlobalEmojiReset(message);
        }
        
        // Refresh the WebView with reset values and preserve workspace context
        await this.refreshWebViewAfterReset(message, panel, fileExplorerDecorator);
    }

    /**
     * Handle workspace emoji update
     */
    private static async handleWorkspaceEmojiUpdate(
        message: EmojiMessage,
        workspacePath: string,
        workspaceService: WorkspaceDatabaseService,
        currentDirectory: string,
        panel: vscode.WebviewPanel
    ): Promise<void> {
        // Handle workspace emoji update - Use safe path calculation
        const targetPath = calculateTargetPath(workspacePath, currentDirectory);
        
        // Check if .code-counter.json exists and get current workspace settings
        const settingsPath = path.join(targetPath, '.code-counter.json');
        let existingWorkspaceSettings: any = {};
        let isNewFile = false;
        
        try {
            if (await fs.promises.access(settingsPath).then(() => true).catch(() => false)) {
                const content = await fs.promises.readFile(settingsPath, 'utf-8');
                existingWorkspaceSettings = JSON.parse(content);
            } else {
                isNewFile = true;
            }
        } catch (error) {
            DebugService.getInstance().verbose('Could not read existing workspace settings, starting with empty settings');
            isNewFile = true;
        }
        
        // Map emoji keys to the standardized workspace settings structure
        let settingKey: string;
        if (message.type === 'folder') {
            const folderKeyMap: { [key: string]: string } = {
                'low': 'codeCounter.emojis.folders.normal',
                'medium': 'codeCounter.emojis.folders.warning', 
                'high': 'codeCounter.emojis.folders.danger'
            };
            settingKey = folderKeyMap[message.colorKey!];
        } else {
            const fileKeyMap: { [key: string]: string } = {
                'low': 'codeCounter.emojis.normal',
                'medium': 'codeCounter.emojis.warning', 
                'high': 'codeCounter.emojis.danger'
            };
            settingKey = fileKeyMap[message.colorKey!];
        }
        
        if (settingKey) {
            // Update the workspace settings using the new flattened structure
            const updatedSettings = {
                ...existingWorkspaceSettings,
                [settingKey]: message.emoji
            };
            
            await workspaceService.saveWorkspaceSettings(targetPath, updatedSettings);
            
            // CRITICAL: Invalidate the workspace service cache after database changes
            invalidateWorkspaceServiceCache(workspacePath);
            
            notifySettingsChanged();
            
            const emojiType = message.type === 'folder' ? 'folder' : 'file';
            const colorName = message.colorKey === 'low' ? 'low' : message.colorKey === 'medium' ? 'medium' : 'high';
            const fileMessage = isNewFile ? 'Created new .code-counter.json and set' : 'Updated';
            vscode.window.showInformationMessage(`${fileMessage} ${colorName} ${emojiType} emoji to ${message.emoji} in workspace settings`);
            
            // Refresh the WebView to show the updated emoji with fresh workspace data
            await this.refreshWebViewAfterWorkspaceUpdate(workspaceService, workspacePath, targetPath, panel);
        }
    }

    /**
     * Handle global emoji update
     */
    private static async handleGlobalEmojiUpdate(
        message: EmojiMessage,
        panel: vscode.WebviewPanel
    ): Promise<void> {
        // Handle global emoji update (original behavior)
        const emojiKeyMap: { [key: string]: string } = {
            'low': 'normal',
            'medium': 'warning', 
            'high': 'danger'
        };
        const configKey = emojiKeyMap[message.colorKey!];
        if (configKey) {
            const configPath = message.type === 'folder' ? 'folders' : '';
            const baseConfig = configPath ? `codeCounter.emojis.${configPath}` : 'codeCounter.emojis';
            const emojiConfig = vscode.workspace.getConfiguration(baseConfig);
            await emojiConfig.update(configKey, message.emoji, vscode.ConfigurationTarget.Global);
            
            const emojiType = message.type === 'folder' ? 'folder' : 'file';
            vscode.window.showInformationMessage(`Updated ${configKey} ${emojiType} emoji to ${message.emoji}`);
            
            // Refresh the WebView to show the updated emoji
            const updatedConfiguration = getCurrentConfiguration();
            panel.webview.html = getEmojiPickerWebviewContent(
                updatedConfiguration.badges, 
                updatedConfiguration.folderBadges, 
                updatedConfiguration.thresholds, 
                updatedConfiguration.excludePatterns, 
                undefined, 
                panel.webview
            );
        }
    }

    /**
     * Handle workspace emoji reset
     */
    private static async handleWorkspaceEmojiReset(message: EmojiMessage): Promise<void> {
        DebugService.getInstance().verbose('Entering workspace mode reset branch');
        // Workspace mode: reset emoji fields in database
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const workspaceService = new WorkspaceDatabaseService(workspacePath);
            
            DebugService.getInstance().verbose('Workspace details:', {
                workspacePath: workspacePath,
                messageCurrentDirectory: message.currentDirectory
            });
            
            try {
                // Determine target directory path
                let targetPath: string;
                if (message.currentDirectory === '<workspace>') {
                    targetPath = workspacePath;
                } else if (message.currentDirectory && path.isAbsolute(message.currentDirectory)) {
                    targetPath = message.currentDirectory;
                } else if (message.currentDirectory) {
                    targetPath = path.join(workspacePath, message.currentDirectory);
                } else {
                    targetPath = workspacePath; // fallback
                }
                
                DebugService.getInstance().verbose('Resetting emoji fields for directory:', targetPath);
                
                // Reset all emoji fields and thresholds using the database service
                await workspaceService.resetField(targetPath, 'emojis.normal');
                await workspaceService.resetField(targetPath, 'emojis.warning');
                await workspaceService.resetField(targetPath, 'emojis.danger');
                await workspaceService.resetField(targetPath, 'emojis.folders.normal');
                await workspaceService.resetField(targetPath, 'emojis.folders.warning');
                await workspaceService.resetField(targetPath, 'emojis.folders.danger');
                await workspaceService.resetField(targetPath, 'lineThresholds.midThreshold');
                await workspaceService.resetField(targetPath, 'lineThresholds.highThreshold');
                
                // CRITICAL: Invalidate the workspace service cache after database changes
                invalidateWorkspaceServiceCache(workspacePath);
                
                // Notify about settings changes and refresh decorators
                notifySettingsChanged();
                refreshFileExplorerDecorator();
                
                vscode.window.showInformationMessage('All emoji settings and thresholds reset to inherit from parent');
                DebugService.getInstance().info('All emoji fields reset successfully');
            } catch (error) {
                DebugService.getInstance().error('Error resetting emoji fields:', error);
                vscode.window.showErrorMessage(`Failed to reset emoji settings: ${error}`);
            }
        } else {
            DebugService.getInstance().verbose('No workspace folders found');
        }
    }

    /**
     * Handle global emoji reset
     */
    private static async handleGlobalEmojiReset(message: EmojiMessage): Promise<void> {
        DebugService.getInstance().verbose('Entering global mode reset branch - Conditions:', {
            isWorkspaceMode: message.isWorkspaceMode,
            currentDirectory: message.currentDirectory,
            currentDirectoryNotGlobal: message.currentDirectory !== '<global>'
        });
        // Global mode: reset global VS Code settings to defaults
        const emojiConfig = vscode.workspace.getConfiguration('codeCounter.emojis');
        await emojiConfig.update('normal', '🟢', vscode.ConfigurationTarget.Global);
        await emojiConfig.update('warning', '🟡', vscode.ConfigurationTarget.Global);
        await emojiConfig.update('danger', '🔴', vscode.ConfigurationTarget.Global);
        
        const folderEmojiConfig = vscode.workspace.getConfiguration('codeCounter.emojis.folders');
        await folderEmojiConfig.update('normal', '🟩', vscode.ConfigurationTarget.Global);
        await folderEmojiConfig.update('warning', '🟨', vscode.ConfigurationTarget.Global);
        await folderEmojiConfig.update('danger', '🟥', vscode.ConfigurationTarget.Global);
        
        const thresholdResetConfig = vscode.workspace.getConfiguration('codeCounter');
        const defaultThresholds = {
            mid: 300,
            high: 1000
        };
        await thresholdResetConfig.update('lineThresholds.midThreshold', defaultThresholds.mid, vscode.ConfigurationTarget.Global);
        await thresholdResetConfig.update('lineThresholds.highThreshold', defaultThresholds.high, vscode.ConfigurationTarget.Global);
        
        vscode.window.showInformationMessage('Emoji indicators and thresholds reset to defaults');
    }

    /**
     * Refresh WebView after workspace update
     */
    private static async refreshWebViewAfterWorkspaceUpdate(
        workspaceService: WorkspaceDatabaseService,
        workspacePath: string,
        targetPath: string,
        panel: vscode.WebviewPanel
    ): Promise<void> {
        const directoryTree = await getDirectoryTreeFromDatabase(workspaceService, workspacePath);
        const resolvedSettings = await workspaceService.getSettingsWithInheritance(targetPath);
        const inheritanceInfo = await workspaceService.getSettingsWithInheritance(targetPath);
        
        DebugService.getInstance().verbose('All resolvedSettings keys:', Object.keys(resolvedSettings));
        DebugService.getInstance().verbose('Folder emoji settings:', {
            'folders.normal': resolvedSettings.resolvedSettings['codeCounter.emojis.folders.normal'],
            'folders.warning': resolvedSettings.resolvedSettings['codeCounter.emojis.folders.warning'],
            'folders.danger': resolvedSettings.resolvedSettings['codeCounter.emojis.folders.danger']
        });
        
        // Use resolved workspace settings instead of global config with fallbacks
        const globalConfig = getCurrentConfiguration();
        const workspaceBadges = {
            low: resolvedSettings.resolvedSettings['codeCounter.emojis.normal'] || globalConfig.badges.low,
            medium: resolvedSettings.resolvedSettings['codeCounter.emojis.warning'] || globalConfig.badges.medium,
            high: resolvedSettings.resolvedSettings['codeCounter.emojis.danger'] || globalConfig.badges.high
        };
        const workspaceFolderBadges = {
            low: resolvedSettings.resolvedSettings['codeCounter.emojis.folders.normal'] || globalConfig.folderBadges.low,
            medium: resolvedSettings.resolvedSettings['codeCounter.emojis.folders.warning'] || globalConfig.folderBadges.medium,
            high: resolvedSettings.resolvedSettings['codeCounter.emojis.folders.danger'] || globalConfig.folderBadges.high
        };
        
        DebugService.getInstance().verbose('Final workspaceFolderBadges:', workspaceFolderBadges);
        const workspaceThresholds = {
            mid: resolvedSettings.resolvedSettings['codeCounter.lineThresholds.midThreshold'] || globalConfig.thresholds.mid,
            high: resolvedSettings.resolvedSettings['codeCounter.lineThresholds.highThreshold'] || globalConfig.thresholds.high
        };
        
        DebugService.getInstance().verbose('Final workspaceThresholds:', workspaceThresholds);
        const workspaceExcludePatterns = resolvedSettings.resolvedSettings['codeCounter.excludePatterns'];
        
        panel.webview.html = getEmojiPickerWebviewContent(
            workspaceBadges, 
            workspaceFolderBadges, 
            workspaceThresholds, 
            workspaceExcludePatterns,
            {
                mode: 'workspace',
                directoryTree,
                currentDirectory: targetPath === workspacePath ? '<workspace>' : 
                                path.relative(workspacePath, targetPath),
                resolvedSettings: addSourceToSettings(inheritanceInfo.resolvedSettings),
                currentSettings: inheritanceInfo.currentSettings,
                parentSettings: addSourceToSettings(inheritanceInfo.parentSettings),
                workspacePath
            },
            panel.webview
        );
    }

    /**
     * Refresh WebView after reset operation
     */
    private static async refreshWebViewAfterReset(
        message: EmojiMessage,
        panel: vscode.WebviewPanel,
        fileExplorerDecorator: any
    ): Promise<void> {
        const updatedConfiguration4 = getCurrentConfiguration();
        let refreshWorkspaceData;
        
        // Regenerate workspace data if we have workspace folders
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const workspaceService = new WorkspaceDatabaseService(workspacePath);
            
            const directoryTree = await getDirectoryTreeFromDatabase(workspaceService, workspacePath);
            
            // Get inheritance info for the specific directory that was reset, not just the workspace root
            let inheritanceTargetDirectory;
            if (!message.currentDirectory || message.currentDirectory === '<workspace>') {
                inheritanceTargetDirectory = workspacePath;
            } else if (path.isAbsolute(message.currentDirectory)) {
                inheritanceTargetDirectory = message.currentDirectory;
            } else {
                // Relative path - join with workspace path
                inheritanceTargetDirectory = path.join(workspacePath, message.currentDirectory);
            }
            
            DebugService.getInstance().verbose('Inheritance path resolution:', {
                messageCurrentDirectory: message.currentDirectory,
                workspacePath: workspacePath,
                resolvedInheritanceTargetDirectory: inheritanceTargetDirectory
            });
            
            const inheritanceInfo = await workspaceService.getSettingsWithInheritance(inheritanceTargetDirectory);
            
            refreshWorkspaceData = {
                mode: 'workspace',
                directoryTree,
                currentDirectory: message.currentDirectory || '<workspace>',
                resolvedSettings: addSourceToSettings(inheritanceInfo.resolvedSettings),
                currentSettings: inheritanceInfo.currentSettings,
                parentSettings: addSourceToSettings(inheritanceInfo.parentSettings),
                workspacePath: workspacePath,
                patternsWithSources: await workspaceService.getExcludePatternsWithSources(inheritanceTargetDirectory),
                includePatternsWithSources: await workspaceService.getIncludePatternsWithSources(inheritanceTargetDirectory)
            };
        }
        
        // Use the resolved settings from the workspace data instead of global configuration
        let resetBadges, resetFolderBadges, resetThresholds, resetExcludePatterns;
        
        if (refreshWorkspaceData && refreshWorkspaceData.resolvedSettings) {
            // Use resolved settings that reflect inheritance after the reset
            resetBadges = {
                low: refreshWorkspaceData.resolvedSettings['codeCounter.emojis.normal'],
                medium: refreshWorkspaceData.resolvedSettings['codeCounter.emojis.warning'],
                high: refreshWorkspaceData.resolvedSettings['codeCounter.emojis.danger']
            };
            resetFolderBadges = {
                low: refreshWorkspaceData.resolvedSettings['codeCounter.emojis.folders.normal'],
                medium: refreshWorkspaceData.resolvedSettings['codeCounter.emojis.folders.warning'],
                high: refreshWorkspaceData.resolvedSettings['codeCounter.emojis.folders.danger']
            };
            resetThresholds = {
                mid: refreshWorkspaceData.resolvedSettings['codeCounter.lineThresholds.midThreshold'],
                high: refreshWorkspaceData.resolvedSettings['codeCounter.lineThresholds.highThreshold']
            };
            resetExcludePatterns = refreshWorkspaceData.resolvedSettings['codeCounter.excludePatterns'];
        } else {
            // Fallback to global configuration
            const updatedConfiguration4 = getCurrentConfiguration();
            resetBadges = updatedConfiguration4.badges;
            resetFolderBadges = updatedConfiguration4.folderBadges;
            resetThresholds = updatedConfiguration4.thresholds;
            resetExcludePatterns = updatedConfiguration4.excludePatterns;
        }
        
        // Refresh decorators to reflect emoji changes
        refreshFileExplorerDecorator();
        notifySettingsChanged();
        
        panel.webview.html = getEmojiPickerWebviewContent(
            resetBadges, 
            resetFolderBadges, 
            resetThresholds, 
            resetExcludePatterns, 
            refreshWorkspaceData, 
            panel.webview
        );
    }
}