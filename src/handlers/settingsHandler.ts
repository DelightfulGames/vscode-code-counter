/**
 * VS Code Code Counter Extension
 * Settings Configuration Handler
 * 
 * Handles webview commands related to general extension settings and configuration
 */

import * as vscode from 'vscode';
import * as path from 'path';

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
}