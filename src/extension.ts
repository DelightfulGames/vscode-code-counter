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
import { WebViewReportService } from './services/webViewReportService';
import { WorkspaceDatabaseService, ResolvedSettings, WorkspaceSettings, SettingsWithInheritance } from './services/workspaceDatabaseService';
import { PathBasedSettingsService } from './services/pathBasedSettingsService';
// Keep old service for migration purposes
import { DirectoryNode, WorkspaceData } from './services/workspaceSettingsService';

// Helper functions to bridge API differences between old and new service
async function getDirectoryTreeFromDatabase(workspaceService: WorkspaceDatabaseService, workspacePath: string): Promise<DirectoryNode[]> {
    const directoriesWithSettings = await workspaceService.getDirectoriesWithSettings();
    return directoriesWithSettings.map(dirPath => {
        const relativePath = path.relative(workspacePath, dirPath);
        const dirName = relativePath === '' ? '<workspace>' : path.basename(dirPath);
        return {
            name: dirName,
            path: dirPath,
            relativePath: relativePath === '' ? '<workspace>' : relativePath,
            hasSettings: true,
            children: []
        };
    });
}

async function getResolvedSettingsFromDatabase(workspaceService: WorkspaceDatabaseService, targetPath: string): Promise<ResolvedSettings & { source: string }> {
    const inheritance = await workspaceService.getSettingsWithInheritance(targetPath);
    return {
        ...inheritance.resolvedSettings,
        source: 'database'
    } as ResolvedSettings & { source: string };
}

function addSourceToSettings(settings: any): any {
    // Get current configuration for default values
    const config = getCurrentConfiguration();
    
    return {
        ...settings,
        // Ensure parent settings always have default values for JavaScript placeholders
        'codeCounter.lineThresholds.midThreshold': settings['codeCounter.lineThresholds.midThreshold'] ?? config.thresholds.mid,
        'codeCounter.lineThresholds.highThreshold': settings['codeCounter.lineThresholds.highThreshold'] ?? config.thresholds.high,
        'codeCounter.emojis.normal': settings['codeCounter.emojis.normal'] ?? config.badges.low,
        'codeCounter.emojis.warning': settings['codeCounter.emojis.warning'] ?? config.badges.medium,
        'codeCounter.emojis.danger': settings['codeCounter.emojis.danger'] ?? config.badges.high,
        'codeCounter.emojis.folders.normal': settings['codeCounter.emojis.folders.normal'] ?? config.folderBadges.low,
        'codeCounter.emojis.folders.warning': settings['codeCounter.emojis.folders.warning'] ?? config.folderBadges.medium,
        'codeCounter.emojis.folders.danger': settings['codeCounter.emojis.folders.danger'] ?? config.folderBadges.high,
        source: 'database'
    };
}

function getCurrentConfiguration() {
    const config = vscode.workspace.getConfiguration('codeCounter');
    const emojiConfig = vscode.workspace.getConfiguration('codeCounter.emojis');
    const folderEmojiConfig = vscode.workspace.getConfiguration('codeCounter.emojis.folders');
    
    return {
        badges: {
            low: emojiConfig.get('normal', '🟢'),
            medium: emojiConfig.get('warning', '🟡'), 
            high: emojiConfig.get('danger', '🔴')
        },
        folderBadges: {
            low: folderEmojiConfig.get('normal', '🟩'),
            medium: folderEmojiConfig.get('warning', '🟨'),
            high: folderEmojiConfig.get('danger', '🟥')
        },
        thresholds: {
            mid: config.get('lineThresholds.midThreshold', 300),
            high: config.get('lineThresholds.highThreshold', 1000)
        },
        excludePatterns: config.get<string[]>('excludePatterns', [
            '**/node_modules/**',
            '**/out/**',
            '**/bin/**', 
            '**/dist/**',
            '**/.git/**',
            '**/.*/**',
            '**/.*',
            '**/**-lock.json'            
        ])
    };
}

// Global reference to pathBasedSettings for settings change notifications
let globalPathBasedSettings: PathBasedSettingsService | null = null;

// Global reference to file explorer decorator for refresh operations
let globalFileExplorerDecorator: FileExplorerDecorationProvider | null = null;

function notifySettingsChanged(): void {
    if (globalPathBasedSettings) {
        globalPathBasedSettings.notifySettingsChanged();
    } else {
        console.warn('notifySettingsChanged called but globalPathBasedSettings is null');
    }
}

async function showCodeCounterSettings(fileExplorerDecorator: FileExplorerDecorationProvider, context: vscode.ExtensionContext, pathBasedSettings: PathBasedSettingsService): Promise<void> {
    // Create a webview panel for the emoji picker
    const panel = vscode.window.createWebviewPanel(
        'emojiPicker',
        'Code Counter - Emoji Settings',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    // Auto-detect workspace settings and use resolved settings for initial display
    let workspaceData: WorkspaceData | undefined = undefined;
    let badges, folderBadges, thresholds, excludePatterns;

    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;

        const workspaceService = new WorkspaceDatabaseService(workspacePath);
        
        // Migrate from old .code-counter.json files if needed
        try {
            const migrationResult = await workspaceService.migrateFromJsonFiles();
            if (migrationResult.migrated > 0) {
                console.log(`Migrated ${migrationResult.migrated} settings files to database`);
            }
        } catch (error) {
            console.log('Migration check completed');
        }
        
        const directoriesWithSettings = await workspaceService.getDirectoriesWithSettings();
        
        // Get inheritance info for the initial directory first (before we determine what it should be)
        let inheritanceInfo = await workspaceService.getSettingsWithInheritance(workspacePath);
        
        // Use resolved workspace settings for initial display (workspace + global merged)
        const resolvedSettings = inheritanceInfo.resolvedSettings;
        const globalConfig = getCurrentConfiguration();
        badges = {
            low: resolvedSettings['codeCounter.emojis.normal'] || globalConfig.badges.low,
            medium: resolvedSettings['codeCounter.emojis.warning'] || globalConfig.badges.medium,
            high: resolvedSettings['codeCounter.emojis.danger'] || globalConfig.badges.high
        };
        folderBadges = {
            low: resolvedSettings['codeCounter.emojis.folders.normal'] || globalConfig.folderBadges.low,
            medium: resolvedSettings['codeCounter.emojis.folders.warning'] || globalConfig.folderBadges.medium,
            high: resolvedSettings['codeCounter.emojis.folders.danger'] || globalConfig.folderBadges.high
        };
        thresholds = {
            mid: resolvedSettings['codeCounter.lineThresholds.midThreshold'] || globalConfig.thresholds.mid,
            high: resolvedSettings['codeCounter.lineThresholds.highThreshold'] || globalConfig.thresholds.high
        };
        excludePatterns = resolvedSettings['codeCounter.excludePatterns'];
        
        // Determine the initial directory based on workspace configuration
        const hasAnySubdirectorySettings = directoriesWithSettings.length > 0;
        const hasWorkspaceSettings = directoriesWithSettings.includes(workspacePath);
        
        // Get last viewed directory from extension state (if available)
        const lastViewedDirectory = context.globalState.get<string>('codeCounter.lastViewedDirectory');
        
        let initialDirectory = '<global>'; // Default to global
        let initialMode = 'global';
        
        if (hasWorkspaceSettings || hasAnySubdirectorySettings) {
            // If workspace or subdirectory settings exist, prefer last viewed or default to workspace
            if (lastViewedDirectory && lastViewedDirectory !== '<global>') {
                // Validate that the last viewed directory still exists or has settings
                if (lastViewedDirectory === '<workspace>' && hasWorkspaceSettings) {
                    initialDirectory = '<workspace>';
                    initialMode = 'workspace';
                } else if (lastViewedDirectory !== '<workspace>') {
                    // Check if the subdirectory still exists and has settings
                    const lastViewedPath = path.join(workspacePath, lastViewedDirectory);
                    const lastViewedHasSettings = directoriesWithSettings.includes(lastViewedPath);
                    
                    if (lastViewedHasSettings) {
                        initialDirectory = lastViewedDirectory;
                        initialMode = 'workspace';
                    } else {
                        // Fall back to workspace if it has settings, otherwise global
                        initialDirectory = hasWorkspaceSettings ? '<workspace>' : '<global>';
                        initialMode = hasWorkspaceSettings ? 'workspace' : 'global';
                    }
                }
            } else {
                // Default to workspace if no last viewed or last viewed was global
                initialDirectory = hasWorkspaceSettings ? '<workspace>' : '<global>';
                initialMode = hasWorkspaceSettings ? 'workspace' : 'global';
            }
        }

        // Update inheritance info to match the initial directory
        if (initialDirectory !== '<workspace>' && initialDirectory !== '<global>') {
            const initialDirectoryPath = path.join(workspacePath, initialDirectory);
            inheritanceInfo = await workspaceService.getSettingsWithInheritance(initialDirectoryPath);
        }
        
        // Get patterns with source information for the initial directory
        const initialDirectoryPath = initialDirectory === '<workspace>' ? workspacePath : 
                                   initialDirectory === '<global>' ? workspacePath :
                                   path.join(workspacePath, initialDirectory);
        const patternsWithSources = await workspaceService.getExcludePatternsWithSources(initialDirectoryPath);

        // Create directory tree structure from directories with settings
        const directoryTree = await getDirectoryTreeFromDatabase(workspaceService, workspacePath);

        workspaceData = {
            mode: initialMode,
            directoryTree,
            currentDirectory: initialDirectory,
            resolvedSettings: {
                ...inheritanceInfo.resolvedSettings,
                source: 'database'
            } as any,
            currentSettings: {
                ...inheritanceInfo.currentSettings,
                source: 'database'
            } as any,
            parentSettings: addSourceToSettings(inheritanceInfo.parentSettings),
            workspacePath,
            patternsWithSources
        };
    } else {
        // Fallback to global settings if no workspace
        const config = getCurrentConfiguration();
        badges = config.badges;
        folderBadges = config.folderBadges;
        thresholds = config.thresholds;
        excludePatterns = config.excludePatterns;
    }

    // Debug: Log final values before webview creation
    console.log('Debug - Final values before webview creation:', {
        badges: badges,
        folderBadges: folderBadges,
        thresholds: thresholds,
        workspaceData: !!workspaceData
    });

    // HTML content with emoji picker
    panel.webview.html = getEmojiPickerWebviewContent(badges, folderBadges, thresholds, excludePatterns, workspaceData, panel.webview);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
        async (message) => {
            switch (message.command) {
                case 'updateEmoji':
                    // Check if we have workspace folders and determine current mode from the message context
                    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                        const workspaceService = new WorkspaceDatabaseService(workspacePath);
                        
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
                            // Handle workspace emoji update
                            const targetPath = currentDirectory === '<workspace>' ? workspacePath : 
                                             path.join(workspacePath, currentDirectory);
                            
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
                                console.log('Could not read existing workspace settings, starting with empty settings');
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
                                settingKey = folderKeyMap[message.colorKey];
                            } else {
                                const fileKeyMap: { [key: string]: string } = {
                                    'low': 'codeCounter.emojis.normal',
                                    'medium': 'codeCounter.emojis.warning', 
                                    'high': 'codeCounter.emojis.danger'
                                };
                                settingKey = fileKeyMap[message.colorKey];
                            }
                            
                            if (settingKey) {
                                // Update the workspace settings using the new flattened structure
                                const updatedSettings = {
                                    ...existingWorkspaceSettings,
                                    [settingKey]: message.emoji
                                };
                                
                                await workspaceService.saveWorkspaceSettings(targetPath, updatedSettings);
                                notifySettingsChanged();
                                
                                const emojiType = message.type === 'folder' ? 'folder' : 'file';
                                const colorName = message.colorKey === 'low' ? 'low' : message.colorKey === 'medium' ? 'medium' : 'high';
                                const fileMessage = isNewFile ? 'Created new .code-counter.json and set' : 'Updated';
                                vscode.window.showInformationMessage(`${fileMessage} ${colorName} ${emojiType} emoji to ${message.emoji} in workspace settings`);
                                
                                // Refresh the WebView to show the updated emoji with fresh workspace data
                                const directoryTree = await getDirectoryTreeFromDatabase(workspaceService, workspacePath);
                                const resolvedSettings = await getResolvedSettingsFromDatabase(workspaceService, targetPath);
                                const inheritanceInfo = await workspaceService.getSettingsWithInheritance(targetPath);
                                
                                console.log('Debug - All resolvedSettings keys:', Object.keys(resolvedSettings));
                                console.log('Debug - Folder emoji settings:', {
                                    'folders.normal': resolvedSettings['codeCounter.emojis.folders.normal'],
                                    'folders.warning': resolvedSettings['codeCounter.emojis.folders.warning'],
                                    'folders.danger': resolvedSettings['codeCounter.emojis.folders.danger']
                                });
                                
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
                                
                                console.log('Debug - Final workspaceFolderBadges:', workspaceFolderBadges);
                                const workspaceThresholds = {
                                    mid: resolvedSettings['codeCounter.lineThresholds.midThreshold'] || globalConfig.thresholds.mid,
                                    high: resolvedSettings['codeCounter.lineThresholds.highThreshold'] || globalConfig.thresholds.high
                                };
                                
                                console.log('Debug - Final workspaceThresholds:', workspaceThresholds);
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
                        } else {
                            // Handle global emoji update (original behavior)
                            const emojiKeyMap: { [key: string]: string } = {
                                'low': 'normal',
                                'medium': 'warning', 
                                'high': 'danger'
                            };
                            const configKey = emojiKeyMap[message.colorKey];
                            if (configKey) {
                                const configPath = message.type === 'folder' ? 'folders' : '';
                                const baseConfig = configPath ? `codeCounter.emojis.${configPath}` : 'codeCounter.emojis';
                                const emojiConfig = vscode.workspace.getConfiguration(baseConfig);
                                await emojiConfig.update(configKey, message.emoji, vscode.ConfigurationTarget.Global);
                                
                                const emojiType = message.type === 'folder' ? 'folder' : 'file';
                                vscode.window.showInformationMessage(`Updated ${configKey} ${emojiType} emoji to ${message.emoji}`);
                                
                                // Refresh the WebView to show the updated emoji
                                const updatedConfiguration = getCurrentConfiguration();
                                panel.webview.html = getEmojiPickerWebviewContent(updatedConfiguration.badges, updatedConfiguration.folderBadges, updatedConfiguration.thresholds, updatedConfiguration.excludePatterns, undefined, panel.webview);
                            }
                        }
                    }
                    break;
                case 'updateThreshold':
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
                            // Handle workspace threshold update
                            const targetPath = currentDirectory === '<workspace>' ? workspacePath : 
                                             path.join(workspacePath, currentDirectory);
                            
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
                                console.log('Could not read existing workspace settings, starting with empty settings');
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
                                const directoryTree = await getDirectoryTreeFromDatabase(workspaceService, workspacePath);
                                const resolvedSettings = await getResolvedSettingsFromDatabase(workspaceService, targetPath);
                                const inheritanceInfo = await workspaceService.getSettingsWithInheritance(targetPath);
                                const currentConfig = getCurrentConfiguration();
                                
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
                        } else {
                            // Handle global threshold update (original behavior)
                            const thresholdConfig = vscode.workspace.getConfiguration('codeCounter');
                            await thresholdConfig.update(`lineThresholds.${message.thresholdKey}Threshold`, message.value, vscode.ConfigurationTarget.Global);
                            vscode.window.showInformationMessage(`Updated ${message.thresholdKey} threshold to ${message.value} lines`);
                            
                            // Refresh the WebView to show updated preview values
                            const updatedConfigurationThreshold = getCurrentConfiguration();
                            panel.webview.html = getEmojiPickerWebviewContent(updatedConfigurationThreshold.badges, updatedConfigurationThreshold.folderBadges, updatedConfigurationThreshold.thresholds, updatedConfigurationThreshold.excludePatterns, undefined, panel.webview);
                        }
                    }
                    break;
                case 'addGlobPattern':
                    // Check if we should add to global settings regardless of workspace
                    if (message.currentDirectory === '<global>') {
                        // Add to global configuration
                        const patternConfig = vscode.workspace.getConfiguration('codeCounter');
                        const currentPatterns = patternConfig.get<string[]>('excludePatterns', []);
                        if (message.pattern && !currentPatterns.includes(message.pattern)) {
                            const updatedPatterns = [...currentPatterns, message.pattern];
                            await patternConfig.update('excludePatterns', updatedPatterns, vscode.ConfigurationTarget.Global);
                            vscode.window.showInformationMessage(`Added exclude pattern to global settings: ${message.pattern}`);
                            
                            fileExplorerDecorator.refresh();
                            const updatedConfiguration = getCurrentConfiguration();
                            panel.webview.html = getEmojiPickerWebviewContent(updatedConfiguration.badges, updatedConfiguration.folderBadges, updatedConfiguration.thresholds, updatedConfiguration.excludePatterns, workspaceData, panel.webview);
                        }
                    } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
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
                            fileExplorerDecorator.refresh();
                            
                            const inheritanceInfo = await workspaceService.getSettingsWithInheritance(targetPath);
                            const refreshedWorkspaceData = {
                                ...workspaceData,
                                currentDirectory: currentDirectory,
                                directoryTree: await getDirectoryTreeFromDatabase(workspaceService, workspacePath),
                                patternsWithSources: await workspaceService.getExcludePatternsWithSources(targetPath),
                                resolvedSettings: addSourceToSettings(inheritanceInfo.resolvedSettings),
                                currentSettings: addSourceToSettings(inheritanceInfo.currentSettings),
                                parentSettings: addSourceToSettings(inheritanceInfo.parentSettings)
                            };
                            
                            const updatedExcludePatterns = refreshedWorkspaceData.resolvedSettings['codeCounter.excludePatterns'];
                            panel.webview.html = getEmojiPickerWebviewContent(
                                badges, folderBadges, thresholds, updatedExcludePatterns, 
                                refreshedWorkspaceData, panel.webview
                            );
                        }
                    } else {
                        // Fallback to global configuration if no workspace
                        const patternConfig = vscode.workspace.getConfiguration('codeCounter');
                        const currentPatterns = patternConfig.get<string[]>('excludePatterns', []);
                        if (message.pattern && !currentPatterns.includes(message.pattern)) {
                            const updatedPatterns = [...currentPatterns, message.pattern];
                            await patternConfig.update('excludePatterns', updatedPatterns, vscode.ConfigurationTarget.Global);
                            vscode.window.showInformationMessage(`Added exclude pattern: ${message.pattern}`);
                            
                            fileExplorerDecorator.refresh();
                            const updatedConfiguration = getCurrentConfiguration();
                            panel.webview.html = getEmojiPickerWebviewContent(updatedConfiguration.badges, updatedConfiguration.folderBadges, updatedConfiguration.thresholds, updatedConfiguration.excludePatterns);
                        }
                    }
                    break;
                case 'removeGlobPattern':
                    // Check if we should remove from global settings regardless of workspace
                    if (message.currentDirectory === '<global>') {
                        // Remove from global configuration
                        const removeConfig = vscode.workspace.getConfiguration('codeCounter');
                        const currentPatterns = removeConfig.get<string[]>('excludePatterns', []);
                        const filteredPatterns = currentPatterns.filter((p: string) => p !== message.pattern);
                        await removeConfig.update('excludePatterns', filteredPatterns, vscode.ConfigurationTarget.Global);
                        vscode.window.showInformationMessage(`Removed exclude pattern from global settings: ${message.pattern}`);
                        
                        fileExplorerDecorator.refresh();
                        const updatedConfiguration = getCurrentConfiguration();
                        panel.webview.html = getEmojiPickerWebviewContent(updatedConfiguration.badges, updatedConfiguration.folderBadges, updatedConfiguration.thresholds, updatedConfiguration.excludePatterns, workspaceData, panel.webview);
                    } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
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
                        
                        const filteredPatterns = currentPatterns.filter((p: string) => p !== message.pattern);
                        
                        // Merge with existing settings in the current directory
                        const updatedSettings: WorkspaceSettings = {
                            ...settingsWithInheritance.currentSettings,
                            'codeCounter.excludePatterns': filteredPatterns
                        };
                        
                        await workspaceService.saveWorkspaceSettings(targetPath, updatedSettings);
                        notifySettingsChanged();
                        
                        vscode.window.showInformationMessage(`Removed exclude pattern: ${message.pattern}`);
                        
                        // Refresh decorations and webview
                        fileExplorerDecorator.refresh();
                        
                        const inheritanceInfo2 = await workspaceService.getSettingsWithInheritance(targetPath);
                        const refreshedWorkspaceData = {
                            ...workspaceData,
                            currentDirectory: currentDirectory,
                            directoryTree: await getDirectoryTreeFromDatabase(workspaceService, workspacePath),
                            patternsWithSources: await workspaceService.getExcludePatternsWithSources(targetPath),
                            resolvedSettings: addSourceToSettings(inheritanceInfo2.resolvedSettings),
                            currentSettings: addSourceToSettings(inheritanceInfo2.currentSettings),
                            parentSettings: addSourceToSettings(inheritanceInfo2.parentSettings)
                        };
                        
                        const updatedExcludePatterns = refreshedWorkspaceData.resolvedSettings['codeCounter.excludePatterns'];
                        panel.webview.html = getEmojiPickerWebviewContent(
                            badges, folderBadges, thresholds, updatedExcludePatterns,
                            refreshedWorkspaceData, panel.webview
                        );
                    } else {
                        // Fallback to global configuration if no workspace
                        const removeConfig = vscode.workspace.getConfiguration('codeCounter');
                        const currentPatterns2 = removeConfig.get<string[]>('excludePatterns', []);
                        const filteredPatterns = currentPatterns2.filter((p: string) => p !== message.pattern);
                        await removeConfig.update('excludePatterns', filteredPatterns, vscode.ConfigurationTarget.Global);
                        vscode.window.showInformationMessage(`Removed exclude pattern: ${message.pattern}`);
                        
                        fileExplorerDecorator.refresh();
                        const updatedConfiguration2 = getCurrentConfiguration();
                        panel.webview.html = getEmojiPickerWebviewContent(updatedConfiguration2.badges, updatedConfiguration2.folderBadges, updatedConfiguration2.thresholds, updatedConfiguration2.excludePatterns);
                    }
                    break;
                case 'resetGlobPatterns':
                    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 && message.isWorkspaceMode) {
                        // In workspace mode: remove patterns from current directory to inherit from ancestors
                        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                        const workspaceService = new WorkspaceDatabaseService(workspacePath);
                        const currentDirectory = message.currentDirectory || '<workspace>';
                        const targetPath = currentDirectory === '<workspace>' ? workspacePath : 
                                         path.join(workspacePath, currentDirectory);
                        
                        // Reset the excludePatterns field to inherit from parent
                        await workspaceService.resetField(targetPath, 'excludePatterns');
                        
                        vscode.window.showInformationMessage('Exclude patterns reset - now inheriting from parent');
                        
                        // Refresh decorations and webview
                        fileExplorerDecorator.refresh();
                        notifySettingsChanged();
                        
                        const inheritanceInfo3 = await workspaceService.getSettingsWithInheritance(targetPath);
                        const refreshedWorkspaceData = {
                            ...workspaceData,
                            currentDirectory: currentDirectory,
                            directoryTree: await getDirectoryTreeFromDatabase(workspaceService, workspacePath),
                            patternsWithSources: await workspaceService.getExcludePatternsWithSources(targetPath),
                            resolvedSettings: addSourceToSettings(inheritanceInfo3.resolvedSettings),
                            currentSettings: addSourceToSettings(inheritanceInfo3.currentSettings),
                            parentSettings: addSourceToSettings(inheritanceInfo3.parentSettings)
                        };
                        
                        const updatedExcludePatterns = refreshedWorkspaceData.resolvedSettings['codeCounter.excludePatterns'];
                        panel.webview.html = getEmojiPickerWebviewContent(
                            badges, folderBadges, thresholds, updatedExcludePatterns,
                            refreshedWorkspaceData, panel.webview
                        );
                    } else {
                        // Fallback to global configuration reset if not in workspace mode
                        const resetConfig = vscode.workspace.getConfiguration('codeCounter');
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
                        await resetConfig.update('excludePatterns', defaultPatterns, vscode.ConfigurationTarget.Global);
                        vscode.window.showInformationMessage('Exclude patterns reset to defaults');
                        
                        fileExplorerDecorator.refresh();
                        notifySettingsChanged();
                        const updatedConfiguration3 = getCurrentConfiguration();
                        panel.webview.html = getEmojiPickerWebviewContent(updatedConfiguration3.badges, updatedConfiguration3.folderBadges, updatedConfiguration3.thresholds, updatedConfiguration3.excludePatterns);
                    }
                    break;
                case 'resetEmoji':
                    // Check if we're in workspace mode and have the necessary data
                    console.log('Reset emoji command received - Full debug:', { 
                        message: message,
                        isWorkspaceMode: message.isWorkspaceMode, 
                        currentDirectory: message.currentDirectory,
                        hasWorkspaceFolders: !!(vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0)
                    });
                    
                    if (message.isWorkspaceMode && message.currentDirectory && message.currentDirectory !== '<global>') {
                        console.log('Entering workspace mode reset branch');
                        // Workspace mode: reset emoji fields in database
                        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                            const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                            const workspaceService = new WorkspaceDatabaseService(workspacePath);
                            
                            console.log('Workspace details:', {
                                workspacePath: workspacePath,
                                messageCurrentDirectory: message.currentDirectory
                            });
                            
                            try {
                                // Determine target directory path
                                let targetPath;
                                if (message.currentDirectory === '<workspace>') {
                                    targetPath = workspacePath;
                                } else if (path.isAbsolute(message.currentDirectory)) {
                                    targetPath = message.currentDirectory;
                                } else {
                                    targetPath = path.join(workspacePath, message.currentDirectory);
                                }
                                
                                console.log('Resetting emoji fields for directory:', targetPath);
                                
                                // Reset all emoji fields and thresholds using the database service
                                await workspaceService.resetField(targetPath, 'emojis.normal');
                                await workspaceService.resetField(targetPath, 'emojis.warning');
                                await workspaceService.resetField(targetPath, 'emojis.danger');
                                await workspaceService.resetField(targetPath, 'emojis.folders.normal');
                                await workspaceService.resetField(targetPath, 'emojis.folders.warning');
                                await workspaceService.resetField(targetPath, 'emojis.folders.danger');
                                await workspaceService.resetField(targetPath, 'lineThresholds.midThreshold');
                                await workspaceService.resetField(targetPath, 'lineThresholds.highThreshold');
                                
                                vscode.window.showInformationMessage('All emoji settings and thresholds reset to inherit from parent');
                                console.log('All emoji fields reset successfully');
                            } catch (error) {
                                console.error('Error resetting emoji fields:', error);
                                vscode.window.showErrorMessage(`Failed to reset emoji settings: ${error}`);
                            }
                        } else {
                            console.log('No workspace folders found');
                        }
                    } else {
                        console.log('Entering global mode reset branch - Conditions:', {
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
                    
                    // Refresh the WebView with reset values and preserve workspace context
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
                        
                        console.log('Inheritance path resolution:', {
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
                            patternsWithSources: await workspaceService.getExcludePatternsWithSources(inheritanceTargetDirectory)
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
                    fileExplorerDecorator.refresh();
                    notifySettingsChanged();
                    
                    panel.webview.html = getEmojiPickerWebviewContent(resetBadges, resetFolderBadges, resetThresholds, resetExcludePatterns, refreshWorkspaceData, panel.webview);
                    break;
                case 'updateNotificationSetting':
                    const notificationConfig = vscode.workspace.getConfiguration('codeCounter');
                    const enabledValue = message.enabled === null || message.enabled === undefined ? false : Boolean(message.enabled);
                    await notificationConfig.update('showNotificationOnAutoGenerate', enabledValue, vscode.ConfigurationTarget.Global);
                    const statusText = enabledValue ? 'enabled' : 'disabled';
                    vscode.window.showInformationMessage(`Popup notifications on auto-generate ${statusText}`);
                    break;
                case 'updateOutputDirectory':
                    const outputConfig = vscode.workspace.getConfiguration('codeCounter');
                    await outputConfig.update('outputDirectory', message.directory, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage(`Output directory updated to: ${message.directory}`);
                    break;
                case 'browseOutputDirectory':
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
                    break;
                case 'updateAutoGenerate':
                    const autoGenerateConfig = vscode.workspace.getConfiguration('codeCounter');
                    await autoGenerateConfig.update('autoGenerate', message.enabled, vscode.ConfigurationTarget.Global);
                    const autoGenerateStatusText = message.enabled ? 'enabled' : 'disabled';
                    vscode.window.showInformationMessage(`Auto-generation ${autoGenerateStatusText}`);
                    break;
                case 'createWorkspaceSettings':
                    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                        const workspaceService = new WorkspaceDatabaseService(workspacePath);
                        
                        // Create empty workspace settings file to enable workspace mode
                        await workspaceService.saveWorkspaceSettings(workspacePath, {});
                        notifySettingsChanged();
                        
                        // Store workspace as the last viewed directory
                        await context.globalState.update('codeCounter.lastViewedDirectory', '<workspace>');

                        // Get directory tree and workspace data
                        const directoryTree = await getDirectoryTreeFromDatabase(workspaceService, workspacePath);
                        const inheritanceInfo = await workspaceService.getSettingsWithInheritance(workspacePath);

                        // Refresh webview with workspace mode
                        const currentConfig = getCurrentConfiguration();
                        workspaceData = {
                            mode: 'workspace',
                            directoryTree,
                            currentDirectory: '<workspace>',
                            resolvedSettings: addSourceToSettings(inheritanceInfo.resolvedSettings),
                            currentSettings: inheritanceInfo.currentSettings,
                            parentSettings: addSourceToSettings(inheritanceInfo.parentSettings),
                            workspacePath,
                            patternsWithSources: await workspaceService.getExcludePatternsWithSources(workspacePath)
                        };

                        panel.webview.html = getEmojiPickerWebviewContent(
                            currentConfig.badges, 
                            currentConfig.folderBadges, 
                            currentConfig.thresholds, 
                            currentConfig.excludePatterns,
                            workspaceData
                        );
                        
                        vscode.window.showInformationMessage('Workspace settings created');
                    } else {
                        vscode.window.showWarningMessage('Please open a workspace or folder in VS Code before creating workspace settings.');
                    }
                    break;
                case 'checkEmptySettingsBeforeChange':
                    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                        const workspaceService = new WorkspaceDatabaseService(workspacePath);
                        
                        const currentPath = message.currentDirectory === '<global>' ? null : 
                                          message.currentDirectory === '<workspace>' ? workspacePath : 
                                          path.join(workspacePath, message.currentDirectory);
                        
                        let hasEmptySettings = false;
                        if (currentPath) {
                            hasEmptySettings = false // hasEmptySettings not implemented in database service;
                        }
                        
                        // Send response back to webview
                        panel.webview.postMessage({
                            command: 'emptySettingsCheckResult',
                            hasEmptySettings,
                            targetDirectory: message.targetDirectory
                        });
                    }
                    break;
                case 'selectDirectory':
                    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                        const workspaceService = new WorkspaceDatabaseService(workspacePath);
                        
                        // Store the selected directory as the last viewed directory
                        await context.globalState.update('codeCounter.lastViewedDirectory', message.directoryPath);
                        
                        // Get the previous directory path if it exists and track if cleanup happened
                        const previousDirectory = message.previousDirectory;
                        let cleanupHappened = false;
                        
                        if (previousDirectory && previousDirectory !== '<global>') {
                            const previousPath = previousDirectory === '<workspace>' ? workspacePath : 
                                               path.join(workspacePath, previousDirectory);
                            
                            // Check if previous directory has empty settings and clean them up
                            const hasEmptySettings = false; // hasEmptySettings not implemented in database service
                            if (hasEmptySettings) {
                                // deleteSettingsFile not needed in database service
                                cleanupHappened = true;
                            }
                        }
                        
                        const selectedPath = message.directoryPath === '<global>' ? null : 
                                           message.directoryPath === '<workspace>' ? workspacePath : 
                                           path.join(workspacePath, message.directoryPath);
                        
                        const directoryTree = await getDirectoryTreeFromDatabase(workspaceService, workspacePath);
                        const currentConfig = getCurrentConfiguration();
                        
                        let finalSelectedPath = selectedPath;
                        let finalResolvedSettings;
                        let finalMode;
                        let inheritanceInfo = null;
                        
                        // Determine mode based on directoryPath
                        const messageMode = message.directoryPath === '<global>' ? 'global' : 'workspace';
                        
                        if (messageMode === 'global') {
                            finalMode = 'global';
                            finalSelectedPath = null;
                            finalResolvedSettings = {
                                'codeCounter.lineThresholds.midThreshold': currentConfig.thresholds.mid,
                                'codeCounter.lineThresholds.highThreshold': currentConfig.thresholds.high,
                                'codeCounter.emojis.normal': currentConfig.badges.low,
                                'codeCounter.emojis.warning': currentConfig.badges.medium,
                                'codeCounter.emojis.danger': currentConfig.badges.high,
                                'codeCounter.emojis.folders.normal': currentConfig.folderBadges.low,
                                'codeCounter.emojis.folders.warning': currentConfig.folderBadges.medium,
                                'codeCounter.emojis.folders.danger': currentConfig.folderBadges.high,
                                'codeCounter.excludePatterns': currentConfig.excludePatterns,
                                'codeCounter.showNotificationOnAutoGenerate': false, // Default for global
                                source: 'global'
                            };
                        } else {
                            // Workspace/subdirectory mode
                            finalMode = 'workspace';
                            if (finalSelectedPath) {
                                // Get inheritance information for workspace/subdirectory
                                inheritanceInfo = await workspaceService.getSettingsWithInheritance(finalSelectedPath);
                                finalResolvedSettings = inheritanceInfo.resolvedSettings;
                            } else {
                                // Fallback - shouldn't happen, but handle gracefully
                                finalSelectedPath = workspacePath;
                                inheritanceInfo = await workspaceService.getSettingsWithInheritance(finalSelectedPath);
                                finalResolvedSettings = inheritanceInfo.resolvedSettings;
                            }
                        }
                        
                        // Use resolved settings for display (type assertion to handle union type)
                        const settings = finalResolvedSettings as ResolvedSettings;
                        const displayBadges = {
                            low: settings['codeCounter.emojis.normal'],
                            medium: settings['codeCounter.emojis.warning'],
                            high: settings['codeCounter.emojis.danger']
                        };
                        const displayFolderBadges = {
                            low: settings['codeCounter.emojis.folders.normal'],
                            medium: settings['codeCounter.emojis.folders.warning'],
                            high: settings['codeCounter.emojis.folders.danger']
                        };
                        const displayThresholds = {
                            mid: settings['codeCounter.lineThresholds.midThreshold'],
                            high: settings['codeCounter.lineThresholds.highThreshold']
                        };
                        
                        if (finalMode === 'global')
                        {                            
                            panel.webview.html = getEmojiPickerWebviewContent(
                                displayBadges, 
                                displayFolderBadges, 
                                displayThresholds, 
                                currentConfig.excludePatterns,
                                {
                                    mode: 'global',
                                    directoryTree,
                                    currentDirectory: '<global>',
                                    resolvedSettings: addSourceToSettings(finalResolvedSettings), // Use consistent global settings
                                    currentSettings: undefined, // No current settings in global mode
                                    parentSettings: undefined, // No parent settings in global mode
                                    workspacePath
                                },
                                panel.webview
                            );
                        } else {
                            panel.webview.html = getEmojiPickerWebviewContent(
                                displayBadges, 
                                displayFolderBadges, 
                                displayThresholds, 
                                currentConfig.excludePatterns,
                                {
                                    mode: finalMode,
                                    directoryTree,
                                    currentDirectory: finalSelectedPath === null ? '<global>' : 
                                                    finalSelectedPath === workspacePath ? '<workspace>' : 
                                                    path.relative(workspacePath, finalSelectedPath),
                                    resolvedSettings: addSourceToSettings(settings),
                                    currentSettings: inheritanceInfo?.currentSettings,
                                    parentSettings: addSourceToSettings(inheritanceInfo?.parentSettings || {}),
                                    workspacePath,
                                    patternsWithSources: await workspaceService.getExcludePatternsWithSources(finalSelectedPath || workspacePath)
                                },
                                panel.webview
                            );
                        }
                    }
                    break;
                case 'createSubWorkspace':
                    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                        const workspaceService = new WorkspaceDatabaseService(workspacePath);
                        const targetPath = path.join(workspacePath, message.directoryPath);
                        
                        // Create empty settings file in subdirectory
                        await workspaceService.saveWorkspaceSettings(targetPath, {});
                        notifySettingsChanged();
                        
                        // Store the subdirectory as the last viewed directory
                        await context.globalState.update('codeCounter.lastViewedDirectory', message.directoryPath);
                        
                        // Refresh with updated tree
                        const directoryTree = await getDirectoryTreeFromDatabase(workspaceService, workspacePath);
                        const resolvedSettings = await getResolvedSettingsFromDatabase(workspaceService, targetPath);
                        const currentConfig = getCurrentConfiguration();
                        
                        // Use resolved workspace settings instead of global config
                        const workspaceBadges = {
                            low: resolvedSettings['codeCounter.emojis.normal'],
                            medium: resolvedSettings['codeCounter.emojis.warning'],
                            high: resolvedSettings['codeCounter.emojis.danger']
                        };
                        const workspaceFolderBadges = {
                            low: resolvedSettings['codeCounter.emojis.normal'], // For now, use same as file badges
                            medium: resolvedSettings['codeCounter.emojis.warning'],
                            high: resolvedSettings['codeCounter.emojis.danger']
                        };
                        const workspaceThresholds = {
                            mid: resolvedSettings['codeCounter.lineThresholds.midThreshold'],
                            high: resolvedSettings['codeCounter.lineThresholds.highThreshold']
                        };
                        
                        panel.webview.html = getEmojiPickerWebviewContent(
                            workspaceBadges, 
                            workspaceFolderBadges, 
                            workspaceThresholds, 
                            currentConfig.excludePatterns,
                            {
                                mode: 'workspace',
                                directoryTree,
                                currentDirectory: targetPath === workspacePath ? '<workspace>' : 
                                                path.relative(workspacePath, targetPath),
                                resolvedSettings,
                                workspacePath
                            }
                        );
                        
                        vscode.window.showInformationMessage(`Sub-workspace settings created in ${message.directoryPath}`);
                    }
                    break;
                case 'saveWorkspaceSettings':
                    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                        const workspaceService = new WorkspaceDatabaseService(workspacePath);
                        
                        const targetPath = message.directoryPath === '<workspace>' ? workspacePath : 
                                         path.join(workspacePath, message.directoryPath);
                        
                        await workspaceService.saveWorkspaceSettings(targetPath, message.settings);
                        
                        // Notify PathBasedSettingsService about changes to refresh decorators
                        pathBasedSettings.notifySettingsChanged();
                        
                        // Refresh to show updated settings
                        const directoryTree = await getDirectoryTreeFromDatabase(workspaceService, workspacePath);
                        const resolvedSettings = await getResolvedSettingsFromDatabase(workspaceService, targetPath);
                        const currentConfig = getCurrentConfiguration();
                        
                        // Use resolved workspace settings instead of global config
                        const workspaceBadges = {
                            low: resolvedSettings['codeCounter.emojis.normal'],
                            medium: resolvedSettings['codeCounter.emojis.warning'],
                            high: resolvedSettings['codeCounter.emojis.danger']
                        };
                        const workspaceFolderBadges = {
                            low: resolvedSettings['codeCounter.emojis.folders.normal'],
                            medium: resolvedSettings['codeCounter.emojis.folders.warning'],
                            high: resolvedSettings['codeCounter.emojis.folders.danger']
                        };
                        const workspaceThresholds = {
                            mid: resolvedSettings['codeCounter.lineThresholds.midThreshold'],
                            high: resolvedSettings['codeCounter.lineThresholds.highThreshold']
                        };
                        
                        const finalInheritanceInfo = await workspaceService.getSettingsWithInheritance(targetPath);
                        panel.webview.html = getEmojiPickerWebviewContent(
                            workspaceBadges, 
                            workspaceFolderBadges, 
                            workspaceThresholds, 
                            currentConfig.excludePatterns,
                            {
                                mode: 'workspace',
                                directoryTree,
                                currentDirectory: targetPath === workspacePath ? '<workspace>' : 
                                                path.relative(workspacePath, targetPath),
                                workspacePath,
                                patternsWithSources: await workspaceService.getExcludePatternsWithSources(targetPath),
                                resolvedSettings: addSourceToSettings(finalInheritanceInfo.resolvedSettings),
                                currentSettings: addSourceToSettings(finalInheritanceInfo.currentSettings),
                                parentSettings: addSourceToSettings(finalInheritanceInfo.parentSettings)
                            },
                            panel.webview
                        );
                        
                        vscode.window.showInformationMessage('Workspace settings saved');
                    }
                    break;
                case 'resetWorkspaceField':
                    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                        const workspaceService = new WorkspaceDatabaseService(workspacePath);
                        
                        const targetPath = message.directory === '<workspace>' ? workspacePath : 
                                         path.join(workspacePath, message.directory);
                        
                        // Reset the specific field in the database
                        await workspaceService.resetField(targetPath, message.field);
                        
                        // Refresh decorators to reflect updated settings
                        fileExplorerDecorator.refresh();
                        notifySettingsChanged();
                        
                        // Get updated resolved settings to send back to webview
                        const resolvedSettings = await getResolvedSettingsFromDatabase(workspaceService, targetPath);
                        
                        // Send targeted update to webview instead of refreshing entire HTML
                        panel.webview.postMessage({
                            command: 'fieldReset',
                            field: message.field,
                            directory: message.directory,
                            resolvedSettings: resolvedSettings
                        });
                        
                        vscode.window.showInformationMessage(`Field ${message.field} reset to parent value`);
                    }
                    break;
            }
        },
        undefined
    );

    // Handle webview disposal
    panel.onDidDispose(() => {
        // Database service handles cleanup automatically - no action needed
        console.log('Code Counter settings panel disposed');
    });
}

function getEmojiPickerWebviewContent(badges: any, 
        folderBadges: any, 
        thresholds: any,
        excludePatterns: string[] = [],
        workspaceData?: WorkspaceData,
        webview?: vscode.Webview): string {
    try {
        console.log('Debug - getEmojiPickerWebviewContent called with:', {
            badges: badges,
            folderBadges: folderBadges,
            thresholds: thresholds,
            excludePatterns: excludePatterns?.length || 0,
            workspaceData: !!workspaceData
        });
        const templatePath = path.join(__dirname, '..', 'templates', 'emoji-picker.html');
        let htmlContent = fs.readFileSync(templatePath, 'utf8');
        
        // Get current notification setting
        const config = vscode.workspace.getConfiguration('codeCounter');
        const showNotificationOnAutoGenerate = config.get<boolean>('showNotificationOnAutoGenerate', false);
        const showNotificationChecked = showNotificationOnAutoGenerate ? 'checked' : '';
        
        const lowPreviewLines = Math.floor(thresholds.mid / 2);
        const mediumPreviewLines = Math.floor((thresholds.mid + thresholds.high) / 2);
        const highPreviewLines = thresholds.high + 500;
        const lowFolderAvg = Math.floor(thresholds.mid / 2);
        const mediumFolderAvg = Math.floor((thresholds.mid + thresholds.high) / 2);
        const highFolderAvg = thresholds.high + 200;
        const highFolderMax = thresholds.high + 500;
        
        // Generate exclude patterns HTML with inheritance information
        let excludePatternsHtml = '';
        if (workspaceData && workspaceData.mode === 'workspace' && workspaceData.resolvedSettings && workspaceData.patternsWithSources) {
            // In workspace mode, show detailed inheritance information
            const currentSettings = workspaceData.currentSettings?.['codeCounter.excludePatterns'] || [];
            const hasLocalPatterns = workspaceData.currentSettings?.['codeCounter.excludePatterns'] !== undefined;
            
            const patternItems = workspaceData.patternsWithSources.map((item) => {
                const isCurrentSetting = currentSettings.includes(item.pattern);
                const levelClass = item.level === 'global' ? 'global-setting' : 
                                 item.level === 'workspace' ? 'workspace-setting' : 'directory-setting';
                const borderClass = isCurrentSetting ? 'current-setting' : 'inherited-setting';
                
                if (isCurrentSetting) {
                    // Current directory pattern - show as local setting
                    return `
                        <div class="glob-pattern-item ${borderClass} ${levelClass}" data-pattern="${item.pattern}">
                            <code>${item.pattern}</code>
                            <span class="pattern-source" title="Set in current directory">📍</span>
                            <button onclick="removePattern('${item.pattern}')" class="remove-btn">❌</button>
                        </div>
                    `;
                } else {
                    // Inherited pattern - show source and inheritance info
                    const opacity = item.level === 'global' ? '0.7' : '0.8';
                    let sourceLabel = '<global>';
                    
                    if (item.level === 'global') {
                        sourceLabel = '<global>';
                    } else if (item.level === 'workspace') {
                        sourceLabel = '<workspace>';
                    } else if (item.level === 'directory') {
                        // For directory level, show relative path
                        const workspacePath = workspaceData.workspacePath || '';
                        const relativePath = path.relative(workspacePath, item.source);
                        sourceLabel = relativePath || item.source;
                    }
                    
                    // Show delete button only if no local patterns exist (copy-all-then-modify behavior)
                    const deleteButton = !hasLocalPatterns ? 
                        `<button onclick="removePattern('${item.pattern}')" class="remove-btn" title="Remove (will copy all patterns to local first)">❌</button>` : 
                        '';
                    
                    return `
                        <div class="glob-pattern-item ${borderClass} ${levelClass}" data-pattern="${item.pattern}">
                            <code style="opacity: ${opacity};">${item.pattern}</code>
                            <span class="pattern-path" title="Inherited from ${item.source}">${item.source === '<global>' ? '&lt;global&gt;' : '&lt;workspace&gt;\\'}${item.source}${item.source === '<global>' ? '' : '\.code-counter.json'}</span>
                            <span class="pattern-source" title="Inherited from ${item.source}">🔗</span>
                            ${deleteButton}
                        </div>
                    `;
                }
            });
            
            excludePatternsHtml = patternItems.join('');
        } else {
            // Global mode - simple list
            excludePatternsHtml = excludePatterns.map((pattern) => `
                <div class="glob-pattern-item" data-pattern="${pattern}">
                    <code>${pattern}</code>
                    <button onclick="removePattern('${pattern}')" class="remove-btn">❌</button>
                </div>
            `).join('');
        }

        //Load the JavaScript content, CSS and JSON data
        const scriptPath = path.join(__dirname, '..', 'templates', 'emoji-picker.js');
        const cssPath = path.join(__dirname, '..', 'templates', 'emoji-picker.css');
        const emojiDataPath = path.join(__dirname, '..', 'templates', 'emoji-data.json');
        const emojiSearchDataPath = path.join(__dirname, '..', 'templates', 'emoji-search-data.json');
        
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        const cssContent = fs.readFileSync(cssPath, 'utf8');
        const emojiData = fs.readFileSync(emojiDataPath, 'utf8');
        const emojiSearchData = fs.readFileSync(emojiSearchDataPath, 'utf8');
        
        // Create webview URIs for the JavaScript and CSS files
        const scriptUri = webview ? webview.asWebviewUri(vscode.Uri.file(scriptPath)) : null;
        const cssUri = webview ? webview.asWebviewUri(vscode.Uri.file(cssPath)) : null;
        
        // Fallback: if no webview provided, embed the script and CSS inline (backward compatibility)
        let useInlineScript = !webview || !scriptUri;
        
        console.log('Debug: useInlineScript =', useInlineScript, 'webview =', !!webview, 'scriptUri =', !!scriptUri);
        
        // Cleanup metadata entries from emoji search data
        let emojiDB = JSON.parse(emojiData);
        let emojiSearchDB = JSON.parse(emojiSearchData);
        Object.keys(emojiSearchDB).forEach(key => {
            if (key.startsWith('_'))
                delete emojiSearchDB[key];            
        });

        Object.keys(emojiDB).forEach(key => {
            if (key.startsWith('_'))
                delete emojiDB[key];
        });

        // We'll embed only the data, not the script content
        let embeddedData;
        
        // Debug workspaceData before embedding
        console.log('Debug - workspaceData structure before embedding:', {
            workspaceDataExists: !!workspaceData,
            currentSettingsKeys: workspaceData?.currentSettings ? Object.keys(workspaceData.currentSettings) : [],
            parentSettingsKeys: workspaceData?.parentSettings ? Object.keys(workspaceData.parentSettings) : [],
        });
        console.log('Debug - Parent threshold values in parentSettings:', {
            'midThreshold': workspaceData?.parentSettings?.['codeCounter.lineThresholds.midThreshold'],
            'highThreshold': workspaceData?.parentSettings?.['codeCounter.lineThresholds.highThreshold'],
            'allParentSettings': workspaceData?.parentSettings
        });
        
        try {
            embeddedData = {
                emojiData: emojiDB,
                emojiSearchData: emojiSearchDB,
                workspaceData: workspaceData || null
            };
        } catch (parseError) {
            console.error('Error parsing emoji data:', parseError);
            // Fallback to safe empty data
            embeddedData = {
                emojiData: [],
                emojiSearchData: [],
                workspaceData: workspaceData || null
            };
        }
        
        // For backward compatibility, create full script content as fallback
        const fullScriptContent = `
            // Embedded emoji data
            window.emojiData = ${JSON.stringify(embeddedData.emojiData)};
            window.emojiSearchData = ${JSON.stringify(embeddedData.emojiSearchData)};
            
            // Workspace settings data
            window.workspaceData = ${JSON.stringify(embeddedData.workspaceData)};
            
            ${scriptContent}
        `;
        
        console.log('Debug - About to replace placeholders with:', {
            'badges.low': badges.low,
            'badges.medium': badges.medium,
            'badges.high': badges.high,
            'folderBadges.low': folderBadges.low,
            'folderBadges.medium': folderBadges.medium,
            'folderBadges.high': folderBadges.high,
            'thresholds.mid': thresholds.mid,
            'thresholds.high': thresholds.high
        });
        
        // Test if badges object exists and has the expected structure
        console.log('Debug - badges object detailed:', badges);
        console.log('Debug - folderBadges object detailed:', folderBadges);
        console.log('Debug - thresholds object detailed:', thresholds);
        
        // Test if placeholders exist in HTML before replacement
        const hasBadgesLow = htmlContent.includes('{{badges.low}}');
        const hasThresholdsMid = htmlContent.includes('{{thresholds.mid}}');
        console.log('Debug - Placeholders found in HTML:', {
            '{{badges.low}}': hasBadgesLow,
            '{{thresholds.mid}}': hasThresholdsMid
        });
        
        // Debug emoji values before replacement
        const lowBadge = badges.low || '🟢';
        const mediumBadge = badges.medium || '🟡';
        const highBadge = badges.high || '🔴';
        console.log('Debug - Emoji replacement values:', {
            lowBadge: `"${lowBadge}"`,
            mediumBadge: `"${mediumBadge}"`,
            highBadge: `"${highBadge}"`,
            lowBadgeLength: lowBadge.length,
            mediumBadgeLength: mediumBadge.length,
            highBadgeLength: highBadge.length
        });
        
        htmlContent = htmlContent.replace(/{{badges\.low}}/g, lowBadge);
        htmlContent = htmlContent.replace(/{{badges\.medium}}/g, mediumBadge);
        htmlContent = htmlContent.replace(/{{badges\.high}}/g, highBadge);
        htmlContent = htmlContent.replace(/{{folderBadges\.low}}/g, folderBadges.low || '🟩');
        htmlContent = htmlContent.replace(/{{folderBadges\.medium}}/g, folderBadges.medium || '🟨');
        htmlContent = htmlContent.replace(/{{folderBadges\.high}}/g, folderBadges.high || '🟥');
        // Debug threshold values before replacement
        console.log('Debug - Threshold values before replacement:', {
            'thresholds.mid': thresholds.mid,
            'thresholds.mid type': typeof thresholds.mid,
            'thresholds.mid?.toString()': thresholds.mid?.toString(),
            'thresholds.high': thresholds.high,
            'thresholds.high type': typeof thresholds.high,
            'thresholds.high?.toString()': thresholds.high?.toString()
        });
        
        const midValue = thresholds.mid?.toString() || '300';
        const highValue = thresholds.high?.toString() || '1000';
        console.log('Debug - Final threshold replacement values:', { midValue, highValue });
        
        htmlContent = htmlContent.replace(/{{thresholds\.mid}}/g, midValue);
        htmlContent = htmlContent.replace(/{{thresholds\.high}}/g, highValue);
        htmlContent = htmlContent.replace(/{{lowPreviewLines}}/g, lowPreviewLines.toString());
        htmlContent = htmlContent.replace(/{{mediumPreviewLines}}/g, mediumPreviewLines.toString());
        htmlContent = htmlContent.replace(/{{highPreviewLines}}/g, highPreviewLines.toString());
        htmlContent = htmlContent.replace(/{{lowFolderAvg}}/g, lowFolderAvg.toString());
        htmlContent = htmlContent.replace(/{{mediumFolderAvg}}/g, mediumFolderAvg.toString());
        htmlContent = htmlContent.replace(/{{highFolderAvg}}/g, highFolderAvg.toString());
        htmlContent = htmlContent.replace(/{{highFolderMax}}/g, highFolderMax.toString());
        htmlContent = htmlContent.replace(/{{excludePatterns}}/g, excludePatternsHtml);
        htmlContent = htmlContent.replace(/{{showNotificationChecked}}/g, showNotificationChecked);
        
        // Debug - Check for any remaining unreplaced placeholders
        const remainingPlaceholders = htmlContent.match(/{{[^}]+}}/g) || [];
        console.log('Debug - Remaining unreplaced placeholders after replacement:', remainingPlaceholders);
        
        // Debug - Sample of final HTML content around badge areas
        const badgesSample = htmlContent.substring(htmlContent.indexOf('current-emoji') - 100, htmlContent.indexOf('current-emoji') + 200);
        console.log('Debug - Sample HTML around badges area after replacement:', badgesSample);
       
        // Output Directory and Auto-Generate settings
        const settingsConfig = vscode.workspace.getConfiguration('codeCounter');
        const outputDirectory = settingsConfig.get<string>('outputDirectory', './.cc/reports');
        const autoGenerate = settingsConfig.get<boolean>('autoGenerate', true);
        const autoGenerateChecked = autoGenerate ? 'checked' : '';
        
        htmlContent = htmlContent.replace(/{{outputDirectory}}/g, outputDirectory);
        htmlContent = htmlContent.replace(/{{autoGenerateChecked}}/g, autoGenerateChecked);
        
        // Inheritance information placeholders
        let parentFileNormal = 'N/A';
        let parentFileWarning = 'N/A';
        let parentFileDanger = 'N/A';
        let parentFolderNormal = 'N/A';
        let parentFolderWarning = 'N/A';
        let parentFolderDanger = 'N/A';
        let parentWarningThreshold = 'N/A';
        let parentDangerThreshold = 'N/A';
        
        // Source information for inheritance
        let parentFileNormalSource = 'N/A';
        let parentFileWarningSource = 'N/A';
        let parentFileDangerSource = 'N/A';
        let parentFolderNormalSource = 'N/A';
        let parentFolderWarningSource = 'N/A';
        let parentFolderDangerSource = 'N/A';
        let parentWarningThresholdSource = 'N/A';
        let parentDangerThresholdSource = 'N/A';
        
        if (workspaceData && workspaceData.parentSettings) {
            // Use actual parent settings if available, with fallbacks for undefined values
            const globalConfig = getCurrentConfiguration();
            
            // Determine the source of inheritance based on current directory
            let parentSource = '<global>';
            if (workspaceData.currentDirectory === '<workspace>') {
                parentSource = '<global>';
            } else if (workspaceData.currentDirectory && workspaceData.workspacePath) {
                // We're in a subdirectory, so parent is either workspace root or another parent directory
                const currentPath = path.join(workspaceData.workspacePath, workspaceData.currentDirectory);
                const parentPath = path.dirname(currentPath);
                if (parentPath === workspaceData.workspacePath) {
                    parentSource = '<workspace>';
                } else {
                    parentSource = path.relative(workspaceData.workspacePath, parentPath);
                }
            }
            
            parentFileNormal = workspaceData.parentSettings['codeCounter.emojis.normal'] || globalConfig.badges.low || '🟢';
            parentFileWarning = workspaceData.parentSettings['codeCounter.emojis.warning'] || globalConfig.badges.medium || '🟡';
            parentFileDanger = workspaceData.parentSettings['codeCounter.emojis.danger'] || globalConfig.badges.high || '🔴';
            parentFolderNormal = workspaceData.parentSettings['codeCounter.emojis.folders.normal'] || globalConfig.folderBadges.low || '🟩';
            parentFolderWarning = workspaceData.parentSettings['codeCounter.emojis.folders.warning'] || globalConfig.folderBadges.medium || '🟨';
            parentFolderDanger = workspaceData.parentSettings['codeCounter.emojis.folders.danger'] || globalConfig.folderBadges.high || '🟥';
            parentWarningThreshold = (workspaceData.parentSettings['codeCounter.lineThresholds.midThreshold'] || globalConfig.thresholds.mid || 300).toString();
            parentDangerThreshold = (workspaceData.parentSettings['codeCounter.lineThresholds.highThreshold'] || globalConfig.thresholds.high || 1000).toString();
            
            // Set source labels
            parentFileNormalSource = parentSource;
            parentFileWarningSource = parentSource;
            parentFileDangerSource = parentSource;
            parentFolderNormalSource = parentSource;
            parentFolderWarningSource = parentSource;
            parentFolderDangerSource = parentSource;
            parentWarningThresholdSource = parentSource;
            parentDangerThresholdSource = parentSource;
        } else if (workspaceData && workspaceData.mode === 'workspace') {
            // Fallback to global configuration values when no parent settings (e.g., at workspace root)
            console.log('Getting global config for parent fallback');
            const globalConfig = getCurrentConfiguration();
            console.log('Global config retrieved:', globalConfig);
            
            parentFileNormal = globalConfig.badges.low || '🟢';
            parentFileWarning = globalConfig.badges.medium || '🟡';
            parentFileDanger = globalConfig.badges.high || '🔴';
            parentFolderNormal = globalConfig.folderBadges.low || '🟩';
            parentFolderWarning = globalConfig.folderBadges.medium || '🟨';
            parentFolderDanger = globalConfig.folderBadges.high || '🟥';
            parentWarningThreshold = (globalConfig.thresholds.mid || 300).toString();
            parentDangerThreshold = (globalConfig.thresholds.high || 1000).toString();
            
            // At workspace root, parent is always global
            parentFileNormalSource = '<global>';
            parentFileWarningSource = '<global>';
            parentFileDangerSource = '<global>';
            parentFolderNormalSource = '<global>';
            parentFolderWarningSource = '<global>';
            parentFolderDangerSource = '<global>';
            parentWarningThresholdSource = '<global>';
            parentDangerThresholdSource = '<global>';
            
            console.log('Parent values set:', {
                parentFileNormal, parentFileWarning, parentFileDanger,
                parentFolderNormal, parentFolderWarning, parentFolderDanger,
                parentWarningThreshold, parentDangerThreshold
            });
        }
        
        htmlContent = htmlContent.replace(/{{parentFileNormal}}/g, parentFileNormal);
        htmlContent = htmlContent.replace(/{{parentFileWarning}}/g, parentFileWarning);
        htmlContent = htmlContent.replace(/{{parentFileDanger}}/g, parentFileDanger);
        htmlContent = htmlContent.replace(/{{parentFolderNormal}}/g, parentFolderNormal);
        htmlContent = htmlContent.replace(/{{parentFileNormalSource}}/g, parentFileNormalSource);
        htmlContent = htmlContent.replace(/{{parentFileWarningSource}}/g, parentFileWarningSource);
        htmlContent = htmlContent.replace(/{{parentFileDangerSource}}/g, parentFileDangerSource);
        htmlContent = htmlContent.replace(/{{parentFolderNormalSource}}/g, parentFolderNormalSource);
        htmlContent = htmlContent.replace(/{{parentFolderWarning}}/g, parentFolderWarning);
        htmlContent = htmlContent.replace(/{{parentFolderDanger}}/g, parentFolderDanger);
        htmlContent = htmlContent.replace(/{{parentFolderWarningSource}}/g, parentFolderWarningSource);
        htmlContent = htmlContent.replace(/{{parentFolderDangerSource}}/g, parentFolderDangerSource);
        htmlContent = htmlContent.replace(/{{parentWarningThresholdSource}}/g, parentWarningThresholdSource);
        htmlContent = htmlContent.replace(/{{parentDangerThresholdSource}}/g, parentDangerThresholdSource);
        htmlContent = htmlContent.replace(/{{parentWarningThreshold}}/g, parentWarningThreshold);
        htmlContent = htmlContent.replace(/{{parentDangerThreshold}}/g, parentDangerThreshold);
        
        // Workspace settings placeholders
        //const workspaceSettingsHtml = workspaceData ? generateWorkspaceSettingsHtml(workspaceData) : '';
        const workspaceSettingsHtml = generateWorkspaceSettingsHtml(workspaceData);
        
        // Check if workspace is available (separate from whether it has existing settings)
        const hasWorkspace = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0;
        
        let createWorkspaceButtonHtml = '';
        if (!workspaceData || !workspaceData.directoryTree || workspaceData.directoryTree.length === 0) {
            if (hasWorkspace) {
                // Workspace available but no workspace settings, show active button
                // createWorkspaceButtonHtml = '<button onclick="createWorkspaceSettings()" class="create-workspace-button">Create Workspace Settings</button>';
            } else {
                // No workspace, show disabled button with informative text
                createWorkspaceButtonHtml = '<button disabled class="create-workspace-button button-secondary" title="Open a workspace or folder first">Select Workspace First</button>';
            }
        }
        
        htmlContent = htmlContent.replace(/{{workspaceSettings}}/g, workspaceSettingsHtml);
        htmlContent = htmlContent.replace(/{{createWorkspaceButton}}/g, createWorkspaceButtonHtml);
        
        if (useInlineScript) {
            // Fallback: embed script and CSS inline for backward compatibility
            htmlContent = htmlContent.replace(/{{emojiData}}/g, 'null');
            htmlContent = htmlContent.replace(/{{emojiSearchData}}/g, 'null');
            htmlContent = htmlContent.replace(/{{workspaceData}}/g, 'null');
            htmlContent = htmlContent.replace(/{{scriptUri}}/g, '');
            htmlContent = htmlContent.replace(/{{cssUri}}/g, '');
            // Add fallback style and script tags with inline content
            htmlContent = htmlContent.replace('</head>', `<style>${cssContent}</style></head>`);
            htmlContent = htmlContent.replace('</body>', `<script>${fullScriptContent}</script></body>`);
        } else {
            // Modern approach: separate JS and CSS files with embedded data
            htmlContent = htmlContent.replace(/{{emojiData}}/g, JSON.stringify(embeddedData.emojiData));
            htmlContent = htmlContent.replace(/{{emojiSearchData}}/g, JSON.stringify(embeddedData.emojiSearchData));
            htmlContent = htmlContent.replace(/{{workspaceData}}/g, JSON.stringify(embeddedData.workspaceData));
            htmlContent = htmlContent.replace(/{{scriptUri}}/g, scriptUri ? scriptUri.toString() : '');
            htmlContent = htmlContent.replace(/{{cssUri}}/g, cssUri ? cssUri.toString() : '');
        }
        
        return htmlContent;
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : String(error);
        
        console.error('Error loading emoji picker template:', error);
        console.error('Error details:', {
            message: errorMessage,
            stack: errorStack,
            workspaceData: workspaceData
        });
        return `<!DOCTYPE html>
            <html>
            <head><title>Code Counter Settings</title></head>
            <body>
                <h1>Error Loading Settings</h1>
                <p>Could not load template: ${errorMessage}</p>
                <details>
                    <summary>Error Details</summary>
                    <pre>${errorStack}</pre>
                </details>
            </body>
            </html>`;
    }
}

function generateWorkspaceSettingsHtml(workspaceData: any): string {
    if (!workspaceData) 
        return `
            <div class="workspace-settings-container">
                <h3>📁 Directory Settings</h3>
                <div class="current-scope">
                    Currently editing: <strong>&lt;global&gt;</strong>
                </div>
                <div class="directory-tree">
                    Select a workspace directory to view or edit its settings.
                </div>
            </div>
        `;
    
    const directoryTreeHtml = generateDirectoryTreeHtml(workspaceData.directoryTree, workspaceData.currentDirectory);
    const currentScope = workspaceData.currentDirectory === '<global>' ? '<global>' : 
                        workspaceData.currentDirectory === workspaceData.workspacePath ? '<workspace>' :
                        workspaceData.currentDirectory.replace(workspaceData.workspacePath, '').replace(/^[\\\/]/, '');
    
    return `
        <div class="workspace-settings-container">
            <h3>📁 Directory Settings</h3>
            <div class="current-scope">
                Currently editing: <strong>${currentScope}</strong>
            </div>
            <div class="directory-tree">
                <div class="directory-item ${workspaceData.currentDirectory === '<global>' ? 'selected' : ''}" 
                     onclick="selectDirectory('<global>')">
                    <span class="directory-icon">🌐</span>
                    &lt;global&gt;
                </div>
                <div class="directory-item ${fs.existsSync(workspaceData.workspacePath + '/.code-counter.json') ? 'has-workspace-settings' : ''} ${workspaceData.currentDirectory === '<workspace>' ? 'selected' : ''}" 
                     onclick="selectDirectory('<workspace>')">
                    <span class="directory-icon">📁</span>
                    &lt;workspace&gt;
                </div>
                ${directoryTreeHtml}
            </div>
        </div>
    `;
}

function generateDirectoryTreeHtml(directories: any[], currentDirectory: string, level: number = 1): string {
    if (!directories || directories.length === 0) return '';
    
    return directories.map(dir => {
        const isSelected = currentDirectory === dir.relativePath;
        const hasSettingsClass = dir.hasSettings ? 'has-settings' : '';
        const selectedClass = isSelected ? 'selected' : '';
        
        const childrenHtml = dir.children && dir.children.length > 0 ? 
            generateDirectoryTreeHtml(dir.children, currentDirectory, level + 1) : '';
        
        return `
            <div class="directory-item ${selectedClass} ${hasSettingsClass}" 
                 style="margin-left: ${level * 15}px"
                 onclick="selectDirectory('${dir.relativePath.replace(/\\/g, '\\\\')}')">
                <span class="directory-icon">📁</span>
                ${dir.name}
            </div>
            ${childrenHtml}
        `;
    }).join('');
}

/**
 * Find the nearest directory to a file path for adding exclusion patterns
 */
async function findNearestConfigDirectory(filePath: string): Promise<string> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder is open');
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    console.log('DEBUG findNearestConfigDirectory: workspacePath =', workspacePath);
    console.log('DEBUG findNearestConfigDirectory: filePath =', filePath);
    
    const workspaceService = new WorkspaceDatabaseService(workspacePath);
    
    // For files, use the directory; for directories, use the directory itself
    const stats = await fs.promises.stat(filePath);
    let currentDir = stats.isFile() ? path.dirname(filePath) : filePath;
    console.log('DEBUG findNearestConfigDirectory: currentDir =', currentDir);

    // Ensure the directory is within the workspace
    if (!currentDir.startsWith(workspacePath)) {
        console.log('DEBUG findNearestConfigDirectory: currentDir not in workspace, returning workspacePath');
        return workspacePath;
    }

    // Get all directories with settings
    const dirsWithSettings = await workspaceService.getDirectoriesWithSettings();
    console.log('DEBUG findNearestConfigDirectory: dirsWithSettings =', dirsWithSettings);
    
    // If no directories have settings, use workspace root
    if (dirsWithSettings.length === 0) {
        console.log('DEBUG findNearestConfigDirectory: no dirs with settings, returning workspacePath');
        return workspacePath;
    }

    // Traverse up the directory tree to find the nearest parent with settings
    let searchDir = currentDir;
    while (searchDir.length >= workspacePath.length) {
        console.log('DEBUG findNearestConfigDirectory: checking searchDir =', searchDir);
        // Check if current directory has settings
        if (dirsWithSettings.includes(searchDir)) {
            console.log('DEBUG findNearestConfigDirectory: found settings in searchDir, returning', searchDir);
            return searchDir;
        }
        
        // Move up one directory level
        const parentDir = path.dirname(searchDir);
        if (parentDir === searchDir) {
            // Reached filesystem root, break to avoid infinite loop
            console.log('DEBUG findNearestConfigDirectory: reached filesystem root');
            break;
        }
        searchDir = parentDir;
    }

    // No parent directory with settings found, use workspace root
    console.log('DEBUG findNearestConfigDirectory: no parent found, returning workspacePath');
    return workspacePath;
}

/**
 * Add an exclusion pattern to the nearest appropriate directory's settings,
 * properly inheriting from parent directories
 */
async function addExclusionPattern(filePath: string, pattern: string): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder is open');
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const workspaceService = new WorkspaceDatabaseService(workspacePath);
    
    // Find the appropriate directory for this file
    const targetDirectory = await findNearestConfigDirectory(filePath);
    
    // Validate pattern is not null/undefined/empty
    if (!pattern || pattern.trim() === '') {
        vscode.window.showErrorMessage('Cannot add empty exclusion pattern');
        return;
    }

    // Get the relative path for the target directory
    // Normalize paths to ensure consistent format
    const normalizedWorkspacePath = path.normalize(workspacePath);
    const normalizedTargetDirectory = path.normalize(targetDirectory);
    
    console.log('DEBUG addExclusionPattern: NORMALIZED workspacePath =', normalizedWorkspacePath);
    console.log('DEBUG addExclusionPattern: NORMALIZED targetDirectory =', normalizedTargetDirectory);
    
    const relativePath = path.relative(normalizedWorkspacePath, normalizedTargetDirectory);
    
    console.log('DEBUG addExclusionPattern: CALCULATED relativePath =', relativePath);
    
    const directoryPath = relativePath || '';
    console.log('DEBUG addExclusionPattern: workspacePath =', workspacePath);
    console.log('DEBUG addExclusionPattern: targetDirectory =', targetDirectory);
    console.log('DEBUG addExclusionPattern: relativePath =', relativePath);
    console.log('DEBUG addExclusionPattern: directoryPath =', directoryPath);
    
    // Get current settings with inheritance for this directory
    const settingsWithInheritance = await workspaceService.getSettingsWithInheritance(directoryPath);
    const inheritedPatterns = settingsWithInheritance.resolvedSettings['codeCounter.excludePatterns'] || [];
    
    // Check if pattern already exists in inherited patterns
    if (inheritedPatterns.includes(pattern)) {
        vscode.window.showInformationMessage(`Pattern "${pattern}" is already excluded (inherited or local)`);
        return;
    }
    
    // Get current local settings for this directory (not inherited)
    const localSettings = settingsWithInheritance.currentSettings || {};
    
    // Copy all inherited patterns plus add the new one
    // This ensures we maintain all existing exclusions when creating local settings
    const newExcludePatterns = [...inheritedPatterns, pattern];
    
    // Update only the excludePatterns in local settings
    const updatedLocalSettings: WorkspaceSettings = { 
        ...localSettings, 
        'codeCounter.excludePatterns': newExcludePatterns 
    };

    // Save the updated settings
    await workspaceService.saveWorkspaceSettings(directoryPath, updatedLocalSettings);
    notifySettingsChanged();
    
    // Show confirmation
    const displayPath = directoryPath || '<workspace>';
    vscode.window.showInformationMessage(`Added exclusion pattern "${pattern}" to ${displayPath} settings`);
}

/**
 * Handle excluding a file/folder by relative path
 */
async function handleExcludeRelativePath(resource: vscode.Uri): Promise<void> {
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder is open');
            return;
        }

        const workspacePath = workspaceFolders[0].uri.fsPath;
        const filePath = resource.fsPath;
        
        console.log('DEBUG handleExcludeRelativePath: resource =', resource);
        console.log('DEBUG handleExcludeRelativePath: resource.fsPath =', resource.fsPath);
        console.log('DEBUG handleExcludeRelativePath: workspacePath =', workspacePath);
        
        if (!filePath) {
            vscode.window.showErrorMessage('Invalid file path for exclusion');
            return;
        }
        
        const stats = await fs.promises.stat(filePath);
        
        // Create relative path pattern
        let relativePath = path.relative(workspacePath, filePath);
        if (!relativePath) {
            vscode.window.showErrorMessage('Could not determine relative path for exclusion');
            return;
        }
        relativePath = stats.isDirectory() ? relativePath + '/**' : relativePath;
        const pattern = relativePath.replace(/\\/g, '/'); // Use forward slashes for consistency        
        
        if (!pattern) {
            vscode.window.showErrorMessage('Could not create exclusion pattern');
            return;
        }
        
        await addExclusionPattern(filePath, pattern);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to exclude path: ${error}`);
    }
}

/**
 * Handle excluding files by name pattern (basename)
 */
async function handleExcludeFilePattern(resource: vscode.Uri): Promise<void> {
    try {
        const filePath = resource.fsPath;
        
        console.log('DEBUG handleExcludeFilePattern: resource =', resource);
        console.log('DEBUG handleExcludeFilePattern: resource.fsPath =', resource.fsPath);
        
        if (!filePath) {
            vscode.window.showErrorMessage('Invalid file path for exclusion');
            return;
        }
        
        const fileName = path.basename(filePath);
        
        if (!fileName) {
            vscode.window.showErrorMessage('Could not determine file name for exclusion');
            return;
        }
        
        const stats = await fs.promises.stat(filePath);
        let directoryPath = stats.isFile() ? path.dirname(filePath) : filePath;

        // Create a global pattern for this filename
        let pattern = `**/${fileName}`;
        if (stats.isDirectory())
            pattern += '/**';
        
        if (!pattern || pattern === '**/') {
            vscode.window.showErrorMessage('Could not create valid exclusion pattern');
            return;
        }
        
        await addExclusionPattern(filePath, pattern);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to exclude file pattern: ${error}`);
    }
}

/**
 * Handle excluding files by extension
 */
async function handleExcludeExtension(resource: vscode.Uri): Promise<void> {
    try {
        const filePath = resource.fsPath;
        
        console.log('DEBUG handleExcludeExtension: resource =', resource);
        console.log('DEBUG handleExcludeExtension: resource.fsPath =', resource.fsPath);
        
        if (!filePath) {
            vscode.window.showErrorMessage('Invalid file path for exclusion');
            return;
        }
        
        const extension = path.extname(filePath);
        
        if (!extension) {
            vscode.window.showWarningMessage('Selected file has no extension to exclude');
            return;
        }
        
        // Create a global pattern for this extension
        const pattern = `**/*${extension}`;
        
        if (!pattern || pattern === '**/*') {
            vscode.window.showErrorMessage('Could not create valid extension exclusion pattern');
            return;
        }
        
        await addExclusionPattern(filePath, pattern);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to exclude extension: ${error}`);
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Code Counter extension is now active!');

    // Auto-migrate from .code-counter.json files to database on startup
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const workspaceService = new WorkspaceDatabaseService(workspacePath);
        
        // Trigger migration asynchronously 
        workspaceService.migrateFromJsonFiles().then(migrationResult => {
            if (migrationResult.migrated > 0) {
                console.log(`VS Code Code Counter: Migrated ${migrationResult.migrated} settings files to database`);
                vscode.window.showInformationMessage(
                    `Code Counter: Successfully migrated ${migrationResult.migrated} settings files to new database format!`
                );
            }
            if (migrationResult.errors.length > 0) {
                console.warn('Migration errors:', migrationResult.errors);
            }
        }).catch(error => {
            console.log('Migration check completed:', error);
        });
    }

    // Initialize services
    const fileWatcher = new FileWatcherProvider();
    const countLinesCommand = new CountLinesCommand();
    
    // Create a shared PathBasedSettingsService instance for both decorators
    const pathBasedSettings = new PathBasedSettingsService();
    globalPathBasedSettings = pathBasedSettings; // Set global reference for settings notifications
    const fileExplorerDecorator = new FileExplorerDecorationProvider(pathBasedSettings);
    globalFileExplorerDecorator = fileExplorerDecorator; // Set global reference for decorator refresh
    const editorTabDecorator = new EditorTabDecorationProvider(pathBasedSettings);

    // Create a dedicated file system watcher for .code-counter.json files
    // This ensures decorators refresh when configuration files are modified/deleted externally
    const configFileWatcher = vscode.workspace.createFileSystemWatcher('**/.code-counter.json');
    
    // Handle .code-counter.json file changes (creation, modification, deletion)
    const onConfigFileChange = configFileWatcher.onDidChange(async (uri) => {
        console.log('Configuration file changed:', uri.fsPath);
        // Refresh decorators when config files are modified
        fileExplorerDecorator.refresh();
        // EditorTabDecorator will refresh automatically through workspace settings events
    });
    
    const onConfigFileCreate = configFileWatcher.onDidCreate(async (uri) => {
        console.log('Configuration file created:', uri.fsPath);
        // Refresh decorators when new config files are created
        fileExplorerDecorator.refresh();
        // EditorTabDecorator will refresh automatically through workspace settings events
    });
    
    const onConfigFileDelete = configFileWatcher.onDidDelete(async (uri) => {
        console.log('Configuration file deleted:', uri.fsPath);
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

    // Removed toggle commands - users can simply disable the extension if they don't want it

    const resetColorsDisposable = vscode.commands.registerCommand('codeCounter.resetBadgeSettings', async () => {
        const emojiConfig = vscode.workspace.getConfiguration('codeCounter.emojis');
        
        await emojiConfig.update('normal', '🟢', vscode.ConfigurationTarget.Global);
        await emojiConfig.update('warning', '🟡', vscode.ConfigurationTarget.Global);
        await emojiConfig.update('danger', '🔴', vscode.ConfigurationTarget.Global);
        
        vscode.window.showInformationMessage('Emoji indicators reset to defaults: 🟢 🟡 🔴');
    });

    const openColorSettingsDisposable = vscode.commands.registerCommand('codeCounter.openSettings', async () => {
        await showCodeCounterSettings(fileExplorerDecorator, context, pathBasedSettings);
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

export function deactivate() {}
