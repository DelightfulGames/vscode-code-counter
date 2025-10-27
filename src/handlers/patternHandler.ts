/**
 * VS Code Code Counter Extension
 * Pattern Settings Handler
 * 
 * Handles webview commands related to exclude/include pattern management
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspaceDatabaseService, WorkspaceSettings } from '../services/workspaceDatabaseService';
import { 
    getWorkspaceService,
    notifySettingsChanged,
    getCurrentConfiguration,
    addSourceToSettings,
    refreshFileExplorerDecorator
} from '../shared/extensionUtils';
import { WorkspaceData } from '../services/workspaceSettingsService';
import { getDirectoryTreeFromDatabase } from '../shared/directoryUtils';
import { getEmojiPickerWebviewContent } from '../shared/webviewUtils';

export interface PatternMessage {
    command: string;
    pattern?: string;
    index?: number;
    currentDirectory?: string;
    isWorkspaceMode?: boolean;
}

export class PatternHandler {
    
    /**
     * Handle addGlobPattern command
     */
    static async handleAddGlobPattern(
        message: PatternMessage,
        panel: vscode.WebviewPanel,
        workspaceData: WorkspaceData | undefined,
        badges: any,
        folderBadges: any,
        thresholds: any
    ): Promise<void> {
        // Check if we should add to global settings regardless of workspace
        if (message.currentDirectory === '<global>') {
            await this.addGlobalExcludePattern(message, panel);
        } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            await this.addWorkspaceExcludePattern(message, panel, workspaceData, badges, folderBadges, thresholds);
        } else {
            // Fallback to global configuration if no workspace
            await this.addGlobalExcludePattern(message, panel);
        }
    }

    /**
     * Handle removeGlobPattern command
     */
    static async handleRemoveGlobPattern(
        message: PatternMessage,
        panel: vscode.WebviewPanel,
        workspaceData: WorkspaceData | undefined,
        badges: any,
        folderBadges: any,
        thresholds: any
    ): Promise<void> {
        if (message.currentDirectory === '<global>') {
            await this.removeGlobalExcludePattern(message, panel);
        } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            await this.removeWorkspaceExcludePattern(message, panel, workspaceData, badges, folderBadges, thresholds);
        } else {
            await this.removeGlobalExcludePattern(message, panel);
        }
    }

    /**
     * Handle resetGlobPatterns command
     */
    static async handleResetGlobPatterns(
        message: PatternMessage & { isWorkspaceMode?: boolean },
        panel: vscode.WebviewPanel,
        workspaceData: WorkspaceData | undefined,
        badges: any,
        folderBadges: any,
        thresholds: any
    ): Promise<void> {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 && message.isWorkspaceMode) {
            await this.resetWorkspaceExcludePatterns(message, panel, workspaceData, badges, folderBadges, thresholds);
        } else {
            await this.resetGlobalExcludePatterns(panel);
        }
    }

    /**
     * Handle addIncludeGlobPattern command
     */
    static async handleAddIncludeGlobPattern(
        message: PatternMessage,
        panel: vscode.WebviewPanel,
        workspaceData: WorkspaceData | undefined,
        badges: any,
        folderBadges: any,
        thresholds: any
    ): Promise<void> {
        if (message.currentDirectory === '<global>') {
            await this.addGlobalIncludePattern(message, panel);
        } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            await this.addWorkspaceIncludePattern(message, panel, workspaceData, badges, folderBadges, thresholds);
        } else {
            await this.addGlobalIncludePattern(message, panel);
        }
    }

    /**
     * Handle removeIncludeGlobPattern command
     */
    static async handleRemoveIncludeGlobPattern(
        message: PatternMessage,
        panel: vscode.WebviewPanel,
        workspaceData: WorkspaceData | undefined,
        badges: any,
        folderBadges: any,
        thresholds: any
    ): Promise<void> {
        if (message.currentDirectory === '<global>') {
            await this.removeGlobalIncludePattern(message, panel);
        } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            await this.removeWorkspaceIncludePattern(message, panel, workspaceData, badges, folderBadges, thresholds);
        } else {
            await this.removeGlobalIncludePattern(message, panel);
        }
    }

    /**
     * Handle resetIncludeGlobPatterns command
     */
    static async handleResetIncludeGlobPatterns(
        message: PatternMessage & { isWorkspaceMode?: boolean },
        panel: vscode.WebviewPanel,
        workspaceData: WorkspaceData | undefined,
        badges: any,
        folderBadges: any,
        thresholds: any
    ): Promise<void> {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 && message.isWorkspaceMode) {
            await this.resetWorkspaceIncludePatterns(message, panel, workspaceData, badges, folderBadges, thresholds);
        } else {
            await this.resetGlobalIncludePatterns(panel);
        }
    }

    // Private helper methods for exclude patterns

    private static async addGlobalExcludePattern(
        message: PatternMessage,
        panel: vscode.WebviewPanel
    ): Promise<void> {
        const patternConfig = vscode.workspace.getConfiguration('codeCounter');
        const currentPatterns = patternConfig.get<string[]>('excludePatterns', []);
        if (message.pattern && !currentPatterns.includes(message.pattern)) {
            const updatedPatterns = [...currentPatterns, message.pattern];
            await patternConfig.update('excludePatterns', updatedPatterns, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Added exclude pattern to global settings: ${message.pattern}`);
            
            refreshFileExplorerDecorator();
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

    private static async addWorkspaceExcludePattern(
        message: PatternMessage,
        panel: vscode.WebviewPanel,
        workspaceData: WorkspaceData | undefined,
        badges: any,
        folderBadges: any,
        thresholds: any
    ): Promise<void> {
        const workspacePath = vscode.workspace.workspaceFolders![0].uri.fsPath;
        const workspaceService = new WorkspaceDatabaseService(workspacePath);
        const currentDirectory = message.currentDirectory || workspaceData?.currentDirectory || '<workspace>';
        const targetPath = currentDirectory === '<workspace>' ? workspacePath : 
                         path.join(workspacePath, currentDirectory);
        
        // Get current settings for this directory
        const settingsWithInheritance = await workspaceService.getSettingsWithInheritance(targetPath);
        let currentPatterns: string[] = [];
        
        // If patterns exist in current directory, use them
        if (settingsWithInheritance.currentSettings?.['codeCounter.excludePatterns']) {
            currentPatterns = [...settingsWithInheritance.currentSettings['codeCounter.excludePatterns']];
        } else {
            // If no patterns defined in current directory, create a copy from ancestors
            const inheritedPatterns = settingsWithInheritance.resolvedSettings['codeCounter.excludePatterns'] || [];
            currentPatterns = [...inheritedPatterns]; // Explicit copy to avoid reference sharing
        }
        
        if (message.pattern && !currentPatterns.includes(message.pattern)) {
            const updatedPatterns = [...currentPatterns, message.pattern];
            
            // Merge with existing settings in the current directory
            const updatedSettings: WorkspaceSettings = {
                ...settingsWithInheritance.currentSettings,
                'codeCounter.excludePatterns': updatedPatterns
            };
            
            await workspaceService.saveWorkspaceSettings(targetPath, updatedSettings);
            notifySettingsChanged();
            
            vscode.window.showInformationMessage(`Added exclude pattern: ${message.pattern}`);
            
            // Refresh decorations and webview
            refreshFileExplorerDecorator();
            await this.refreshWebviewWithUpdatedPatterns(
                workspaceService, workspacePath, targetPath, currentDirectory,
                workspaceData, badges, folderBadges, thresholds, panel
            );
        }
    }

    private static async removeGlobalExcludePattern(
        message: PatternMessage,
        panel: vscode.WebviewPanel
    ): Promise<void> {
        const patternConfig = vscode.workspace.getConfiguration('codeCounter');
        const currentPatterns = patternConfig.get<string[]>('excludePatterns', []);
        
        let updatedPatterns: string[];
        let removedPattern: string;
        
        // Support both removal by index and by pattern string
        if (typeof message.index === 'number' && message.index >= 0 && message.index < currentPatterns.length) {
            removedPattern = currentPatterns[message.index];
            updatedPatterns = currentPatterns.filter((_, i) => i !== message.index);
        } else if (message.pattern) {
            removedPattern = message.pattern;
            updatedPatterns = currentPatterns.filter((p: string) => p !== message.pattern);
        } else {
            return; // No valid removal criteria
        }
        
        await patternConfig.update('excludePatterns', updatedPatterns, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Removed exclude pattern from global settings: ${removedPattern}`);
        
        refreshFileExplorerDecorator();
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

    private static async removeWorkspaceExcludePattern(
        message: PatternMessage,
        panel: vscode.WebviewPanel,
        workspaceData: WorkspaceData | undefined,
        badges: any,
        folderBadges: any,
        thresholds: any
    ): Promise<void> {
        const workspacePath = vscode.workspace.workspaceFolders![0].uri.fsPath;
        const workspaceService = new WorkspaceDatabaseService(workspacePath);
        const currentDirectory = message.currentDirectory || workspaceData?.currentDirectory || '<workspace>';
        const targetPath = currentDirectory === '<workspace>' ? workspacePath : 
                         path.join(workspacePath, currentDirectory);
        
        const settingsWithInheritance = await workspaceService.getSettingsWithInheritance(targetPath);
        let currentPatterns: string[] = [];
        
        // Get current patterns for this directory
        if (settingsWithInheritance.currentSettings?.['codeCounter.excludePatterns']) {
            currentPatterns = [...settingsWithInheritance.currentSettings['codeCounter.excludePatterns']];
        } else {
            // If no patterns defined in current directory, create a copy from ancestors
            const inheritedPatterns = settingsWithInheritance.resolvedSettings['codeCounter.excludePatterns'] || [];
            currentPatterns = [...inheritedPatterns]; // Explicit copy to avoid reference sharing
        }
        
        let updatedPatterns: string[];
        let removedPattern: string;
        
        // Support both removal by index and by pattern string
        if (typeof message.index === 'number' && message.index >= 0 && message.index < currentPatterns.length) {
            removedPattern = currentPatterns[message.index];
            updatedPatterns = currentPatterns.filter((_, i) => i !== message.index);
        } else if (message.pattern) {
            removedPattern = message.pattern;
            updatedPatterns = currentPatterns.filter((p: string) => p !== message.pattern);
        } else {
            return; // No valid removal criteria
        }
        
        const updatedSettings: WorkspaceSettings = {
            ...settingsWithInheritance.currentSettings,
            'codeCounter.excludePatterns': updatedPatterns
        };
        
        await workspaceService.saveWorkspaceSettings(targetPath, updatedSettings);
        notifySettingsChanged();
        
        vscode.window.showInformationMessage(`Removed exclude pattern: ${removedPattern}`);
        
        refreshFileExplorerDecorator();
        await this.refreshWebviewWithUpdatedPatterns(
            workspaceService, workspacePath, targetPath, currentDirectory,
            workspaceData, badges, folderBadges, thresholds, panel
        );
    }

    private static async resetGlobalExcludePatterns(panel: vscode.WebviewPanel): Promise<void> {
        const patternConfig = vscode.workspace.getConfiguration('codeCounter');
        const defaultPatterns = [
            '**/node_modules/**',
            '**/out/**',
            '**/bin/**',
            '**/dist/**',
            '**/.git/**',
            '**/.*/**',
            '**/.*',
            '**/**-lock.json'
        ];
        
        await patternConfig.update('excludePatterns', defaultPatterns, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('Reset exclude patterns to defaults in global settings');
        
        refreshFileExplorerDecorator();
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

    private static async resetWorkspaceExcludePatterns(
        message: PatternMessage,
        panel: vscode.WebviewPanel,
        workspaceData: WorkspaceData | undefined,
        badges: any,
        folderBadges: any,
        thresholds: any
    ): Promise<void> {
        const workspacePath = vscode.workspace.workspaceFolders![0].uri.fsPath;
        const workspaceService = getWorkspaceService(workspacePath);
        const currentDirectory = message.currentDirectory || workspaceData?.currentDirectory || '<workspace>';
        const targetPath = currentDirectory === '<workspace>' ? workspacePath : 
                         path.join(workspacePath, currentDirectory);
        
        // Reset the excludePatterns field to inherit from parent
        await workspaceService.resetField(targetPath, 'excludePatterns');
        notifySettingsChanged();
        
        vscode.window.showInformationMessage('Reset exclude patterns to inherit from parent');
        
        refreshFileExplorerDecorator();
        
        // Get fresh data after reset
        const inheritanceInfo = await workspaceService.getSettingsWithInheritance(targetPath);
        const refreshedWorkspaceData = {
            ...workspaceData,
            currentDirectory: currentDirectory,
            mode: workspaceData?.mode || 'light',
            workspacePath: workspaceData?.workspacePath || workspacePath,
            directoryTree: await getDirectoryTreeFromDatabase(workspaceService, workspacePath),
            patternsWithSources: await workspaceService.getExcludePatternsWithSources(targetPath),
            includePatternsWithSources: await workspaceService.getIncludePatternsWithSources(targetPath),
            resolvedSettings: addSourceToSettings(inheritanceInfo.resolvedSettings),
            currentSettings: addSourceToSettings(inheritanceInfo.currentSettings),
            parentSettings: addSourceToSettings(inheritanceInfo.parentSettings)
        };
        
        const updatedExcludePatterns = refreshedWorkspaceData.resolvedSettings['codeCounter.excludePatterns'];
        panel.webview.html = getEmojiPickerWebviewContent(
            badges, 
            folderBadges, 
            thresholds, 
            updatedExcludePatterns, 
            refreshedWorkspaceData, 
            panel.webview
        );
    }

    // Private helper methods for include patterns

    private static async addGlobalIncludePattern(
        message: PatternMessage,
        panel: vscode.WebviewPanel
    ): Promise<void> {
        const patternConfig = vscode.workspace.getConfiguration('codeCounter');
        const currentPatterns = patternConfig.get<string[]>('includePatterns', []);
        if (message.pattern && !currentPatterns.includes(message.pattern)) {
            const updatedPatterns = [...currentPatterns, message.pattern];
            await patternConfig.update('includePatterns', updatedPatterns, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Added include pattern to global settings: ${message.pattern}`);
            
            refreshFileExplorerDecorator();
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

    private static async addWorkspaceIncludePattern(
        message: PatternMessage,
        panel: vscode.WebviewPanel,
        workspaceData: WorkspaceData | undefined,
        badges: any,
        folderBadges: any,
        thresholds: any
    ): Promise<void> {
        const workspacePath = vscode.workspace.workspaceFolders![0].uri.fsPath;
        const workspaceService = new WorkspaceDatabaseService(workspacePath);
        const currentDirectory = message.currentDirectory || workspaceData?.currentDirectory || '<workspace>';
        const targetPath = currentDirectory === '<workspace>' ? workspacePath : 
                         path.join(workspacePath, currentDirectory);
        
        const settingsWithInheritance = await workspaceService.getSettingsWithInheritance(targetPath);
        let currentPatterns: string[] = [];
        
        if (settingsWithInheritance.currentSettings?.['codeCounter.includePatterns']) {
            currentPatterns = [...settingsWithInheritance.currentSettings['codeCounter.includePatterns']];
        } else {
            const inheritedPatterns = settingsWithInheritance.resolvedSettings['codeCounter.includePatterns'] || [];
            currentPatterns = [...inheritedPatterns];
        }
        
        if (message.pattern && !currentPatterns.includes(message.pattern)) {
            const updatedPatterns = [...currentPatterns, message.pattern];
            
            const updatedSettings: WorkspaceSettings = {
                ...settingsWithInheritance.currentSettings,
                'codeCounter.includePatterns': updatedPatterns
            };
            
            await workspaceService.saveWorkspaceSettings(targetPath, updatedSettings);
            notifySettingsChanged();
            
            vscode.window.showInformationMessage(`Added include pattern: ${message.pattern}`);
            
            refreshFileExplorerDecorator();
            await this.refreshWebviewWithUpdatedPatterns(
                workspaceService, workspacePath, targetPath, currentDirectory,
                workspaceData, badges, folderBadges, thresholds, panel
            );
        }
    }

    private static async removeGlobalIncludePattern(
        message: PatternMessage,
        panel: vscode.WebviewPanel
    ): Promise<void> {
        const patternConfig = vscode.workspace.getConfiguration('codeCounter');
        const currentPatterns = patternConfig.get<string[]>('includePatterns', []);
        
        let updatedPatterns: string[];
        let removedPattern: string;
        
        // Support both removal by index and by pattern string
        if (typeof message.index === 'number' && message.index >= 0 && message.index < currentPatterns.length) {
            removedPattern = currentPatterns[message.index];
            updatedPatterns = currentPatterns.filter((_, i) => i !== message.index);
        } else if (message.pattern) {
            removedPattern = message.pattern;
            updatedPatterns = currentPatterns.filter((p: string) => p !== message.pattern);
        } else {
            return; // No valid removal criteria
        }
        
        await patternConfig.update('includePatterns', updatedPatterns, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Removed include pattern from global settings: ${removedPattern}`);
        
        refreshFileExplorerDecorator();
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

    private static async removeWorkspaceIncludePattern(
        message: PatternMessage,
        panel: vscode.WebviewPanel,
        workspaceData: WorkspaceData | undefined,
        badges: any,
        folderBadges: any,
        thresholds: any
    ): Promise<void> {
        const workspacePath = vscode.workspace.workspaceFolders![0].uri.fsPath;
        const workspaceService = new WorkspaceDatabaseService(workspacePath);
        const currentDirectory = message.currentDirectory || workspaceData?.currentDirectory || '<workspace>';
        const targetPath = currentDirectory === '<workspace>' ? workspacePath : 
                         path.join(workspacePath, currentDirectory);
        
        const settingsWithInheritance = await workspaceService.getSettingsWithInheritance(targetPath);
        let currentPatterns: string[] = [];
        
        // Get current patterns for this directory
        if (settingsWithInheritance.currentSettings?.['codeCounter.includePatterns']) {
            currentPatterns = [...settingsWithInheritance.currentSettings['codeCounter.includePatterns']];
        } else {
            // If no patterns defined in current directory, create a copy from ancestors
            const inheritedPatterns = settingsWithInheritance.resolvedSettings['codeCounter.includePatterns'] || [];
            currentPatterns = [...inheritedPatterns]; // Explicit copy to avoid reference sharing
        }
        
        let updatedPatterns: string[];
        let removedPattern: string;
        
        // Support both removal by index and by pattern string
        if (typeof message.index === 'number' && message.index >= 0 && message.index < currentPatterns.length) {
            removedPattern = currentPatterns[message.index];
            updatedPatterns = currentPatterns.filter((_, i) => i !== message.index);
        } else if (message.pattern) {
            removedPattern = message.pattern;
            updatedPatterns = currentPatterns.filter((p: string) => p !== message.pattern);
        } else {
            return; // No valid removal criteria
        }
        
        const updatedSettings: WorkspaceSettings = {
            ...settingsWithInheritance.currentSettings,
            'codeCounter.includePatterns': updatedPatterns
        };
        
        await workspaceService.saveWorkspaceSettings(targetPath, updatedSettings);
        notifySettingsChanged();
        
        vscode.window.showInformationMessage(`Removed include pattern: ${removedPattern}`);
        
        refreshFileExplorerDecorator();
        await this.refreshWebviewWithUpdatedPatterns(
            workspaceService, workspacePath, targetPath, currentDirectory,
            workspaceData, badges, folderBadges, thresholds, panel
        );
    }

    private static async resetGlobalIncludePatterns(panel: vscode.WebviewPanel): Promise<void> {
        const patternConfig = vscode.workspace.getConfiguration('codeCounter');
        await patternConfig.update('includePatterns', [], vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('Reset include patterns to empty in global settings');
        
        refreshFileExplorerDecorator();
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

    private static async resetWorkspaceIncludePatterns(
        message: PatternMessage,
        panel: vscode.WebviewPanel,
        workspaceData: WorkspaceData | undefined,
        badges: any,
        folderBadges: any,
        thresholds: any
    ): Promise<void> {
        const workspacePath = vscode.workspace.workspaceFolders![0].uri.fsPath;
        const workspaceService = getWorkspaceService(workspacePath);
        const currentDirectory = message.currentDirectory || workspaceData?.currentDirectory || '<workspace>';
        const targetPath = currentDirectory === '<workspace>' ? workspacePath : 
                         path.join(workspacePath, currentDirectory);
        
        // Reset the includePatterns field to inherit from parent
        await workspaceService.resetField(targetPath, 'includePatterns');
        notifySettingsChanged();
        
        vscode.window.showInformationMessage('Reset include patterns to inherit from parent');
        
        refreshFileExplorerDecorator();
        
        // Get fresh data after reset
        const inheritanceInfo = await workspaceService.getSettingsWithInheritance(targetPath);
        const refreshedWorkspaceData = {
            ...workspaceData,
            currentDirectory: currentDirectory,
            mode: workspaceData?.mode || 'light',
            workspacePath: workspaceData?.workspacePath || workspacePath,
            directoryTree: await getDirectoryTreeFromDatabase(workspaceService, workspacePath),
            patternsWithSources: await workspaceService.getExcludePatternsWithSources(targetPath),
            includePatternsWithSources: await workspaceService.getIncludePatternsWithSources(targetPath),
            resolvedSettings: addSourceToSettings(inheritanceInfo.resolvedSettings),
            currentSettings: addSourceToSettings(inheritanceInfo.currentSettings),
            parentSettings: addSourceToSettings(inheritanceInfo.parentSettings)
        };
        
        const updatedExcludePatterns = refreshedWorkspaceData.resolvedSettings['codeCounter.excludePatterns'];
        panel.webview.html = getEmojiPickerWebviewContent(
            badges, 
            folderBadges, 
            thresholds, 
            updatedExcludePatterns, 
            refreshedWorkspaceData, 
            panel.webview
        );
    }

    // Common helper method to refresh webview with updated patterns
    private static async refreshWebviewWithUpdatedPatterns(
        workspaceService: WorkspaceDatabaseService,
        workspacePath: string,
        targetPath: string,
        currentDirectory: string,
        workspaceData: WorkspaceData | undefined,
        badges: any,
        folderBadges: any,
        thresholds: any,
        panel: vscode.WebviewPanel
    ): Promise<void> {
        const inheritanceInfo = await workspaceService.getSettingsWithInheritance(targetPath);
        const refreshedWorkspaceData = {
            ...workspaceData,
            currentDirectory: currentDirectory,
            mode: workspaceData?.mode || 'light',
            workspacePath: workspaceData?.workspacePath || workspacePath,
            directoryTree: await getDirectoryTreeFromDatabase(workspaceService, workspacePath),
            patternsWithSources: await workspaceService.getExcludePatternsWithSources(targetPath),
            includePatternsWithSources: await workspaceService.getIncludePatternsWithSources(targetPath),
            resolvedSettings: addSourceToSettings(inheritanceInfo.resolvedSettings),
            currentSettings: addSourceToSettings(inheritanceInfo.currentSettings),
            parentSettings: addSourceToSettings(inheritanceInfo.parentSettings)
        };
        
        const updatedExcludePatterns = refreshedWorkspaceData.resolvedSettings['codeCounter.excludePatterns'];
        panel.webview.html = getEmojiPickerWebviewContent(
            badges, 
            folderBadges, 
            thresholds, 
            updatedExcludePatterns, 
            refreshedWorkspaceData, 
            panel.webview
        );
    }
}