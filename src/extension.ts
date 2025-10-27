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
import { DebugService } from './services/debugService';
// Keep old service for migration purposes
import { DirectoryNode } from './services/workspaceSettingsService';

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

    // Store global reference for refreshing from context menu commands
    setGlobalEmojiPickerPanel(panel);

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
                debug.info(`Migrated ${migrationResult.migrated} settings files to database`);
            }
        } catch (error) {
            debug.verbose('Migration check completed');
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

        // Create directory tree structure from ALL directories in workspace
        const directoryTree = await getDirectoryTreeFromDatabase(workspaceService, workspacePath);
        
        // Debug: Log what we're passing to the webview
        debug.info(`showCodeCounterSettings - Directory tree has ${directoryTree.length} root nodes`);
        const hiddenRootNodes = directoryTree.filter(node => node.name.startsWith('.'));
        debug.info(`showCodeCounterSettings - Hidden root nodes: ${hiddenRootNodes.length}`);
        hiddenRootNodes.forEach(node => debug.info(`  Webview hidden root: ${node.name} (${node.relativePath})`));

        // Track initial directory globally for webview refresh (normalize path separators)
        setGlobalCurrentDirectory(initialDirectory.replace(/\\/g, '/'));

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
    debug.verbose('Final values before webview creation:', {
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
                                mode: workspaceData?.mode || 'workspace',
                                workspacePath: workspacePath || '',
                                currentDirectory: currentDirectory,
                                directoryTree: await getDirectoryTreeFromDatabase(workspaceService, workspacePath),
                                patternsWithSources: await workspaceService.getExcludePatternsWithSources(targetPath),
                                includePatternsWithSources: await workspaceService.getIncludePatternsWithSources(targetPath),
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
                            mode: workspaceData?.mode || 'workspace',
                            workspacePath: workspacePath || '',
                            currentDirectory: currentDirectory,
                            directoryTree: await getDirectoryTreeFromDatabase(workspaceService, workspacePath),
                            patternsWithSources: await workspaceService.getExcludePatternsWithSources(targetPath),
                            includePatternsWithSources: await workspaceService.getIncludePatternsWithSources(targetPath),
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
                        const workspaceService = getWorkspaceService(workspacePath);
                        const currentDirectory = message.currentDirectory || '<workspace>';
                        const targetPath = currentDirectory === '<workspace>' ? workspacePath : 
                                         path.join(workspacePath, currentDirectory);
                        
                        // Reset the excludePatterns field to inherit from parent
                        await workspaceService.resetField(targetPath, 'excludePatterns');
                        
                        // Invalidate cache to ensure fresh data on next access
                        invalidateWorkspaceServiceCache(workspacePath);
                        console.log('Cache invalidated after reset operation');
                        
                        // Get fresh service instance with updated data
                        const freshWorkspaceService = getWorkspaceService(workspacePath);
                        
                        vscode.window.showInformationMessage('Exclude patterns reset - now inheriting from parent');
                        
                        // Refresh decorations and webview
                        fileExplorerDecorator.refresh();
                        notifySettingsChanged();
                        
                        const inheritanceInfo3 = await freshWorkspaceService.getSettingsWithInheritance(targetPath);
                        const refreshedWorkspaceData = { ...workspaceData, mode: workspaceData?.mode || 'workspace', workspacePath: workspacePath || '', currentDirectory: currentDirectory,
                            directoryTree: await getDirectoryTreeFromDatabase(freshWorkspaceService, workspacePath),
                            patternsWithSources: await freshWorkspaceService.getExcludePatternsWithSources(targetPath),
                            includePatternsWithSources: await freshWorkspaceService.getIncludePatternsWithSources(targetPath),
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
                
                // Inclusion pattern handlers
                case 'addIncludeGlobPattern':
                    // Check if we should add to global settings regardless of workspace
                    if (message.currentDirectory === '<global>') {
                        // Add to global configuration
                        const patternConfig = vscode.workspace.getConfiguration('codeCounter');
                        const currentPatterns = patternConfig.get<string[]>('includePatterns', []);
                        if (message.pattern && !currentPatterns.includes(message.pattern)) {
                            const updatedPatterns = [...currentPatterns, message.pattern];
                            await patternConfig.update('includePatterns', updatedPatterns, vscode.ConfigurationTarget.Global);
                            vscode.window.showInformationMessage(`Added include pattern to global settings: ${message.pattern}`);
                            
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
                        if (settingsWithInheritance.currentSettings?.['codeCounter.includePatterns']) {
                            currentPatterns = [...settingsWithInheritance.currentSettings['codeCounter.includePatterns']];
                        } else {
                            // If no patterns defined in current directory, create a copy from ancestors
                            const inheritedPatterns = settingsWithInheritance.resolvedSettings['codeCounter.includePatterns'] || [];
                            currentPatterns = [...inheritedPatterns]; // Explicit copy to avoid reference sharing
                        }
                        
                        if (message.pattern && !currentPatterns.includes(message.pattern)) {
                            const updatedPatterns = [...currentPatterns, message.pattern];
                            
                            // Merge with existing settings in the current directory
                            const updatedSettings: WorkspaceSettings = {
                                ...settingsWithInheritance.currentSettings,
                                'codeCounter.includePatterns': updatedPatterns
                            };
                            
                            await workspaceService.saveWorkspaceSettings(targetPath, updatedSettings);
                            notifySettingsChanged();
                            
                            vscode.window.showInformationMessage(`Added include pattern: ${message.pattern}`);
                            
                            // Refresh decorations and webview
                            fileExplorerDecorator.refresh();
                            
                            const inheritanceInfo = await workspaceService.getSettingsWithInheritance(targetPath);
                            const refreshedWorkspaceData = { ...workspaceData, mode: workspaceData?.mode || 'workspace', workspacePath: workspacePath || '', currentDirectory: currentDirectory,
                                directoryTree: await getDirectoryTreeFromDatabase(workspaceService, workspacePath),
                                patternsWithSources: await workspaceService.getExcludePatternsWithSources(targetPath),
                                includePatternsWithSources: await workspaceService.getIncludePatternsWithSources(targetPath),
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
                        const currentPatterns = patternConfig.get<string[]>('includePatterns', []);
                        if (message.pattern && !currentPatterns.includes(message.pattern)) {
                            const updatedPatterns = [...currentPatterns, message.pattern];
                            await patternConfig.update('includePatterns', updatedPatterns, vscode.ConfigurationTarget.Global);
                            vscode.window.showInformationMessage(`Added include pattern: ${message.pattern}`);
                            
                            fileExplorerDecorator.refresh();
                            const updatedConfiguration = getCurrentConfiguration();
                            panel.webview.html = getEmojiPickerWebviewContent(updatedConfiguration.badges, updatedConfiguration.folderBadges, updatedConfiguration.thresholds, updatedConfiguration.excludePatterns, workspaceData, panel.webview);
                        }
                    }
                    break;
                    
                case 'removeIncludeGlobPattern':
                    // Check if we should remove from global settings regardless of workspace
                    if (message.currentDirectory === '<global>') {
                        // Remove from global configuration
                        const removeConfig = vscode.workspace.getConfiguration('codeCounter');
                        const currentPatterns = removeConfig.get<string[]>('includePatterns', []);
                        const filteredPatterns = currentPatterns.filter((p: string) => p !== message.pattern);
                        await removeConfig.update('includePatterns', filteredPatterns, vscode.ConfigurationTarget.Global);
                        vscode.window.showInformationMessage(`Removed include pattern from global settings: ${message.pattern}`);
                        
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
                        if (settingsWithInheritance.currentSettings?.['codeCounter.includePatterns']) {
                            currentPatterns = [...settingsWithInheritance.currentSettings['codeCounter.includePatterns']];
                        } else {
                            // If no patterns defined in current directory, create a copy from ancestors
                            const inheritedPatterns = settingsWithInheritance.resolvedSettings['codeCounter.includePatterns'] || [];
                            currentPatterns = [...inheritedPatterns]; // Explicit copy to avoid reference sharing
                        }
                        
                        const filteredPatterns = currentPatterns.filter((p: string) => p !== message.pattern);
                        
                        // Merge with existing settings in the current directory
                        const updatedSettings: WorkspaceSettings = {
                            ...settingsWithInheritance.currentSettings,
                            'codeCounter.includePatterns': filteredPatterns
                        };
                        
                        await workspaceService.saveWorkspaceSettings(targetPath, updatedSettings);
                        notifySettingsChanged();
                        
                        vscode.window.showInformationMessage(`Removed include pattern: ${message.pattern}`);
                        
                        // Refresh decorations and webview
                        fileExplorerDecorator.refresh();
                        
                        const inheritanceInfo2 = await workspaceService.getSettingsWithInheritance(targetPath);
                        const refreshedWorkspaceData = { ...workspaceData, mode: workspaceData?.mode || 'workspace', workspacePath: workspacePath || '', currentDirectory: currentDirectory,
                            directoryTree: await getDirectoryTreeFromDatabase(workspaceService, workspacePath),
                            patternsWithSources: await workspaceService.getExcludePatternsWithSources(targetPath),
                            includePatternsWithSources: await workspaceService.getIncludePatternsWithSources(targetPath),
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
                        const currentPatterns2 = removeConfig.get<string[]>('includePatterns', []);
                        const filteredPatterns = currentPatterns2.filter((p: string) => p !== message.pattern);
                        await removeConfig.update('includePatterns', filteredPatterns, vscode.ConfigurationTarget.Global);
                        vscode.window.showInformationMessage(`Removed include pattern: ${message.pattern}`);
                        
                        fileExplorerDecorator.refresh();
                        const updatedConfiguration2 = getCurrentConfiguration();
                        panel.webview.html = getEmojiPickerWebviewContent(updatedConfiguration2.badges, updatedConfiguration2.folderBadges, updatedConfiguration2.thresholds, updatedConfiguration2.excludePatterns, workspaceData, panel.webview);
                    }
                    break;
                    
                case 'resetIncludeGlobPatterns':
                    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 && message.isWorkspaceMode) {
                        // In workspace mode: remove patterns from current directory to inherit from ancestors
                        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                        const workspaceService = getWorkspaceService(workspacePath);
                        const currentDirectory = message.currentDirectory || '<workspace>';
                        const targetPath = currentDirectory === '<workspace>' ? workspacePath : 
                                         path.join(workspacePath, currentDirectory);
                        
                        // Reset the includePatterns field to inherit from parent
                        await workspaceService.resetField(targetPath, 'includePatterns');
                        
                        // Invalidate cache to ensure fresh data on next access
                        invalidateWorkspaceServiceCache(workspacePath);
                        console.log('Cache invalidated after include patterns reset operation');
                        
                        // Get fresh service instance with updated data
                        const freshWorkspaceService = getWorkspaceService(workspacePath);
                        
                        vscode.window.showInformationMessage('Include patterns reset - now inheriting from parent');
                        
                        // Refresh decorations
                        fileExplorerDecorator.refresh();
                        notifySettingsChanged();
                        
                        const inheritanceInfo3 = await freshWorkspaceService.getSettingsWithInheritance(targetPath);
                        const refreshedWorkspaceData = { ...workspaceData, mode: workspaceData?.mode || 'workspace', workspacePath: workspacePath || '', currentDirectory: currentDirectory,
                            directoryTree: await getDirectoryTreeFromDatabase(freshWorkspaceService, workspacePath),
                            patternsWithSources: await freshWorkspaceService.getExcludePatternsWithSources(targetPath),
                            includePatternsWithSources: await freshWorkspaceService.getIncludePatternsWithSources(targetPath),
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
                        const defaultPatterns: string[] = []; // Default to empty array for include patterns
                        await resetConfig.update('includePatterns', defaultPatterns, vscode.ConfigurationTarget.Global);
                        vscode.window.showInformationMessage('Include patterns reset to defaults (empty)');
                        
                        fileExplorerDecorator.refresh();
                        notifySettingsChanged();
                        const updatedConfiguration3 = getCurrentConfiguration();
                        panel.webview.html = getEmojiPickerWebviewContent(updatedConfiguration3.badges, updatedConfiguration3.folderBadges, updatedConfiguration3.thresholds, updatedConfiguration3.excludePatterns, workspaceData, panel.webview);
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
                            patternsWithSources: await workspaceService.getExcludePatternsWithSources(workspacePath),
                            includePatternsWithSources: await workspaceService.getIncludePatternsWithSources(workspacePath)
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
                        
                        // Track the current directory globally for proper webview refresh (normalize path separators)
                        setGlobalCurrentDirectory(message.directoryPath.replace(/\\/g, '/'));
                        debug.verbose(`Directory selected via click - originalPath: "${message.directoryPath}", normalizedPath: "${getGlobalCurrentDirectory()}"`);
                        
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
                                                    path.relative(workspacePath, finalSelectedPath).replace(/\\/g, '/'),
                                    resolvedSettings: addSourceToSettings(settings),
                                    currentSettings: inheritanceInfo?.currentSettings,
                                    parentSettings: addSourceToSettings(inheritanceInfo?.parentSettings || {}),
                                    workspacePath,
                                    patternsWithSources: await workspaceService.getExcludePatternsWithSources(finalSelectedPath || workspacePath),
                                    includePatternsWithSources: await workspaceService.getIncludePatternsWithSources(finalSelectedPath || workspacePath)
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
                                currentSettings: {},
                                parentSettings: {},
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
                                includePatternsWithSources: await workspaceService.getIncludePatternsWithSources(targetPath),
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
                case 'configureDebugService':
                    // Handle debug service configuration - save to VS Code settings
                    const backend = message.backend as 'none' | 'console' | 'file';
                    
                    // Update VS Code configuration - this will trigger automatic update via configuration listener
                    const debugConfig = vscode.workspace.getConfiguration('codeCounter');
                    await debugConfig.update('debug', backend, vscode.ConfigurationTarget.Global);
                    
                    debug.info(`Debug service configured: backend=${backend}`);
                    let statusMessage = 'Disabled';
                    if (backend === 'console') {
                        statusMessage = 'Developer Tools';
                    } else if (backend === 'file') {
                        statusMessage = 'File Log (.vscode/code-counter/debug.log)';
                    }
                    vscode.window.showInformationMessage(`Debug service updated: ${statusMessage}`);
                    break;

                case 'openDebugLogFile':
                    // Handle opening the debug log file
                    try {
                        const debugService = DebugService.getInstance();
                        const logFilePath = debugService.getLogFilePath();
                        
                        if (logFilePath && fs.existsSync(logFilePath)) {
                            // Open the debug log file in VS Code
                            const document = await vscode.workspace.openTextDocument(logFilePath);
                            await vscode.window.showTextDocument(document);
                        } else {
                            vscode.window.showWarningMessage('Debug log file not found. Make sure File Log is enabled and extension activity has generated logs.');
                        }
                    } catch (error) {
                        debug.error('Error opening debug log file:', error);
                        vscode.window.showErrorMessage('Failed to open debug log file: ' + (error as Error).message);
                    }
                    break;
            }
        },
        undefined
    );

    // Handle webview disposal
    panel.onDidDispose(() => {
        // Database service handles cleanup automatically - no action needed
        setGlobalEmojiPickerPanel(null);
        debug.info('Code Counter settings panel disposed');
    });
}

// Large webview generation functions moved to shared/webviewUtils - cleaned up orphaned code

/**
 * Find the nearest directory to a file path for adding exclusion patterns
 */
// Removed ~600 lines of orphaned webview generation code - now using shared utilities

/**
 * Find the nearest directory to a file path for adding exclusion patterns
 */

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
    const workspaceService = getWorkspaceService(workspacePath);
    
    // Find the appropriate directory for this file
    const targetDirectory = await findNearestConfigDirectory(filePath);
    
    // Validate pattern is not null/undefined/empty
    if (!pattern || pattern.trim() === '') {
        vscode.window.showErrorMessage('Cannot add empty exclusion pattern');
        return;
    }

    // Get the relative path for the target directory
    // Normalize paths to ensure consistent format and resolve any symbolic links
    const normalizedWorkspacePath = path.resolve(path.normalize(workspacePath));
    const normalizedTargetDirectory = path.resolve(path.normalize(targetDirectory));
    
    console.log('DEBUG addExclusionPattern: NORMALIZED workspacePath =', normalizedWorkspacePath);
    console.log('DEBUG addExclusionPattern: NORMALIZED targetDirectory =', normalizedTargetDirectory);
    
    // Ensure target directory is within workspace before calculating relative path
    if (!normalizedTargetDirectory.startsWith(normalizedWorkspacePath)) {
        console.error('SECURITY: Target directory is outside workspace bounds');
        vscode.window.showErrorMessage('Cannot add exclusion pattern: Target directory is outside workspace');
        return;
    }
    
    // Calculate relative path safely
    let relativePath = path.relative(normalizedWorkspacePath, normalizedTargetDirectory);
    
    // Additional validation to prevent path traversal
    if (relativePath.includes('..') || path.isAbsolute(relativePath)) {
        console.error('SECURITY: Calculated relative path contains path traversal or is absolute:', relativePath);
        vscode.window.showErrorMessage('Cannot add exclusion pattern: Invalid directory path');
        return;
    }
    
    console.log('DEBUG addExclusionPattern: CALCULATED relativePath =', relativePath);
    
    // Normalize path separators for consistent storage
    const directoryPath = relativePath.replace(/\\/g, '/') || '';
    console.log('DEBUG addExclusionPattern: workspacePath =', workspacePath);
    console.log('DEBUG addExclusionPattern: targetDirectory =', targetDirectory);
    console.log('DEBUG addExclusionPattern: relativePath =', relativePath);
    console.log('DEBUG addExclusionPattern: directoryPath =', directoryPath);
    
    // Get current settings with inheritance for this directory
    // Pass the absolute target directory path, not the relative path
    const settingsWithInheritance = await workspaceService.getSettingsWithInheritance(normalizedTargetDirectory);
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
    
    console.log('DEBUG: Adding exclusion pattern:', {
        pattern,
        inheritedPatterns,
        newExcludePatterns,
        directoryPath
    });
    
    // Update only the excludePatterns in local settings
    const updatedLocalSettings: WorkspaceSettings = { 
        ...localSettings, 
        'codeCounter.excludePatterns': newExcludePatterns 
    };

    // Save the updated settings - pass absolute target directory path, not relative
    await workspaceService.saveWorkspaceSettings(normalizedTargetDirectory, updatedLocalSettings);
    
    // Notify settings changed first to trigger decorator refresh
    notifySettingsChanged();
    
    // Refresh file explorer decorators to ensure inheritance chain is updated
    refreshFileExplorerDecorator();
    
    // Add small delay to ensure database operations and decorator updates are fully committed
    await new Promise(resolve => setTimeout(resolve, 660));
    
    // Force refresh by creating a new service instance to ensure we get the latest state
    // This avoids any potential caching issues with the current service instance
    const refreshService = new WorkspaceDatabaseService(workspacePath);
    await refreshEmojiPickerWebviewWithService(refreshService, workspacePath);
    
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

    // Initialize debug service with configuration monitoring
    const debug = DebugService.getInstance();
    debug.initialize(context);
    debug.info('Code Counter extension activated');

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
    setGlobalPathBasedSettings(pathBasedSettings); // Set global reference for settings notifications
    const fileExplorerDecorator = new FileExplorerDecorationProvider(pathBasedSettings);
    setGlobalFileExplorerDecorator(fileExplorerDecorator); // Set global reference for decorator refresh
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

