/**
 * VS Code Code Counter Extension
 * Threshold Settings Handler
 * 
 * Handles webview commands related to line count threshold management
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WorkspaceDatabaseService, WorkspaceSettings } from '../services/workspaceDatabaseService';
import { DebugService } from '../services/debugService';
import { 
    getCurrentConfiguration,
    calculateTargetPath,
    notifySettingsChanged,
    addSourceToSettings,
    getResolvedSettingsFromDatabase
} from '../shared/extensionUtils';
import { getDirectoryTreeFromDatabase } from '../shared/directoryUtils';
import { getEmojiPickerWebviewContent } from '../shared/webviewUtils';

export interface ThresholdMessage {
    command: string;
    thresholdKey: 'mid' | 'high';
    value: number;
    currentDirectory?: string;
}

export class ThresholdHandler {
    
    /**
     * Handle updateThreshold command
     */
    static async handleUpdateThreshold(
        message: ThresholdMessage,
        panel: vscode.WebviewPanel
    ): Promise<void> {
        // Check if we have workspace folders and determine current mode from the message context
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const workspaceService = new WorkspaceDatabaseService(workspacePath);
            
            // Determine the current directory and mode from the message
            let currentDirectory = '<global>';
            let isWorkspaceMode = false;
            
            if (message.currentDirectory) {
                currentDirectory = message.currentDirectory;
                isWorkspaceMode = currentDirectory !== '<global>';
            } else {
                // Fallback: assume global mode if no directory info
                isWorkspaceMode = false;
            }
            
            if (isWorkspaceMode) {
                await this.handleWorkspaceThresholdUpdate(
                    message, panel, workspaceService, workspacePath, currentDirectory
                );
            } else {
                await this.handleGlobalThresholdUpdate(message, panel);
            }
        }
    }

    /**
     * Handle workspace threshold update
     */
    private static async handleWorkspaceThresholdUpdate(
        message: ThresholdMessage,
        panel: vscode.WebviewPanel,
        workspaceService: WorkspaceDatabaseService,
        workspacePath: string,
        currentDirectory: string
    ): Promise<void> {
        // Handle workspace threshold update - Use safe path calculation
        const targetPath = calculateTargetPath(workspacePath, currentDirectory);
        
        // Check if .code-counter.json exists and get existing workspace settings  
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
        
        // Map threshold keys to the standardized workspace settings structure
        const thresholdKeyMap: { [key: string]: string } = {
            'mid': 'codeCounter.lineThresholds.midThreshold',
            'high': 'codeCounter.lineThresholds.highThreshold'
        };
        const settingKey = thresholdKeyMap[message.thresholdKey];
        
        if (settingKey) {
            // Update the workspace settings using the new flattened structure
            const updatedSettings = {
                ...existingWorkspaceSettings,
                [settingKey]: message.value
            };
            
            await workspaceService.saveWorkspaceSettings(targetPath, updatedSettings);
            notifySettingsChanged();
            const fileMessage = isNewFile ? 'Created new .code-counter.json and set' : 'Updated';
            vscode.window.showInformationMessage(`${fileMessage} ${message.thresholdKey} threshold to ${message.value} lines in workspace settings`);
            
            // Refresh the WebView to show updated values with fresh workspace data
            await this.refreshWebviewAfterWorkspaceUpdate(
                panel, workspaceService, workspacePath, targetPath
            );
        }
    }

    /**
     * Handle global threshold update
     */
    private static async handleGlobalThresholdUpdate(
        message: ThresholdMessage,
        panel: vscode.WebviewPanel
    ): Promise<void> {
        // Handle global threshold update (original behavior)
        const thresholdConfig = vscode.workspace.getConfiguration('codeCounter');
        await thresholdConfig.update(`lineThresholds.${message.thresholdKey}Threshold`, message.value, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Updated ${message.thresholdKey} threshold to ${message.value} lines`);
        
        // Refresh the WebView to show updated preview values
        const updatedConfigurationThreshold = getCurrentConfiguration();
        panel.webview.html = getEmojiPickerWebviewContent(
            updatedConfigurationThreshold.badges, 
            updatedConfigurationThreshold.folderBadges, 
            updatedConfigurationThreshold.thresholds, 
            updatedConfigurationThreshold.excludePatterns, 
            undefined, 
            panel.webview
        );
    }

    /**
     * Refresh webview after workspace threshold update
     */
    private static async refreshWebviewAfterWorkspaceUpdate(
        panel: vscode.WebviewPanel,
        workspaceService: WorkspaceDatabaseService,
        workspacePath: string,
        targetPath: string
    ): Promise<void> {
        const directoryTree = await getDirectoryTreeFromDatabase(workspaceService, workspacePath);
        const resolvedSettings = await getResolvedSettingsFromDatabase(workspaceService, targetPath);
        const inheritanceInfo = await workspaceService.getSettingsWithInheritance(targetPath);
        
        // Use resolved workspace settings instead of global config with fallbacks
        const globalConfig = getCurrentConfiguration();
        const workspaceBadges = {
            low: resolvedSettings['codeCounter.emojis.normal'] || globalConfig.badges.low,
            medium: resolvedSettings['codeCounter.emojis.warning'] || globalConfig.badges.medium,
            high: resolvedSettings['codeCounter.emojis.danger'] || globalConfig.badges.high
        };
        const workspaceFolderBadges = {
            low: resolvedSettings['codeCounter.emojis.folders.normal'] || globalConfig.folderBadges.low,
            medium: resolvedSettings['codeCounter.emojis.folders.warning'] || globalConfig.folderBadges.medium,
            high: resolvedSettings['codeCounter.emojis.folders.danger'] || globalConfig.folderBadges.high
        };
        const workspaceThresholds = {
            mid: resolvedSettings['codeCounter.lineThresholds.midThreshold'] || globalConfig.thresholds.mid,
            high: resolvedSettings['codeCounter.lineThresholds.highThreshold'] || globalConfig.thresholds.high
        };
        const workspaceExcludePatterns = resolvedSettings['codeCounter.excludePatterns'];
        
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
}