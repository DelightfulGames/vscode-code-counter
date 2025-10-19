import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CountLinesCommand } from './commands/countLines';
import { FileWatcherProvider } from './providers/fileWatcher';
import { FileExplorerDecorationProvider } from './providers/fileExplorerDecorator';
import { EditorTabDecorationProvider } from './providers/editorTabDecorator';
import { WebViewReportService } from './services/webViewReportService';
import { WorkspaceSettingsService, ResolvedSettings, DirectoryNode, WorkspaceSettings, WorkspaceData } from './services/workspaceSettingsService';

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
            '**/.**/**',
            '**/*.vsix',
            '**/.code-counter.json',
            '**/**-lock.json'            
        ])
    };
}

async function showCodeCounterSettings(fileExplorerDecorator: FileExplorerDecorationProvider): Promise<void> {
    const { badges, folderBadges, thresholds, excludePatterns } = getCurrentConfiguration();

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

    // Auto-detect workspace settings
    let workspaceData: WorkspaceData | undefined = undefined;

    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const workspaceService = new WorkspaceSettingsService(workspacePath);
        
        const directoryTree = await workspaceService.getDirectoryTree();
        const inheritanceInfo = await workspaceService.getSettingsWithInheritance(workspacePath);
        
        workspaceData = {
            mode: 'global',
            directoryTree,
            currentDirectory: '<global>',
            resolvedSettings: inheritanceInfo.resolvedSettings,
            currentSettings: inheritanceInfo.currentSettings,
            parentSettings: inheritanceInfo.parentSettings,
            workspacePath
        };
    }

    // HTML content with emoji picker
    panel.webview.html = getEmojiPickerWebviewContent(badges, folderBadges, thresholds, excludePatterns, workspaceData, panel.webview);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
        async (message) => {
            switch (message.command) {
                case 'updateEmoji':
                    // Check if we're in workspace mode
                    if (workspaceData?.mode !== 'global' && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                        // Handle workspace emoji update
                        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                        const workspaceService = new WorkspaceSettingsService(workspacePath);
                        const targetPath = workspaceData?.currentDirectory === '<workspace>' ? workspacePath : 
                                         path.join(workspacePath, workspaceData?.currentDirectory);
                        
                        // Get current workspace settings by reading the file manually (since readSettingsFile is private)
                        const settingsPath = path.join(targetPath, '.code-counter.json');
                        let existingWorkspaceSettings: any = {};
                        
                        try {
                            if (await fs.promises.access(settingsPath).then(() => true).catch(() => false)) {
                                const content = await fs.promises.readFile(settingsPath, 'utf-8');
                                existingWorkspaceSettings = JSON.parse(content);
                            }
                        } catch (error) {
                            console.log('Could not read existing workspace settings, starting with empty settings');
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
                            
                            const emojiType = message.type === 'folder' ? 'folder' : 'file';
                            const colorName = message.colorKey === 'low' ? 'low' : message.colorKey === 'medium' ? 'medium' : 'high';
                            vscode.window.showInformationMessage(`Updated ${colorName} ${emojiType} emoji to ${message.emoji} in workspace settings`);
                            
                            // Refresh the WebView to show the updated emoji
                            const directoryTree = await workspaceService.getDirectoryTree();
                            const resolvedSettings = await workspaceService.getResolvedSettings(targetPath);
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
                    break;
                case 'updateThreshold':
                    // Check if we're in workspace mode
                    if (workspaceData && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                        // Handle workspace threshold update
                        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                        const workspaceService = new WorkspaceSettingsService(workspacePath);
                        const targetPath = workspaceData.currentDirectory === '<workspace>' ? workspacePath : 
                                         path.join(workspacePath, workspaceData.currentDirectory);
                        
                        // Get existing workspace settings
                        const settingsPath = path.join(targetPath, '.code-counter.json');
                        let existingWorkspaceSettings: any = {};
                        
                        try {
                            if (await fs.promises.access(settingsPath).then(() => true).catch(() => false)) {
                                const content = await fs.promises.readFile(settingsPath, 'utf-8');
                                existingWorkspaceSettings = JSON.parse(content);
                            }
                        } catch (error) {
                            console.log('Could not read existing workspace settings, starting with empty settings');
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
                            vscode.window.showInformationMessage(`Updated ${message.thresholdKey} threshold to ${message.value} lines in workspace settings`);
                            
                            // Refresh the WebView to show updated values
                            const directoryTree = await workspaceService.getDirectoryTree();
                            const resolvedSettings = await workspaceService.getResolvedSettings(targetPath);
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
                        }
                    } else {
                        // Handle global threshold update (original behavior)
                        const thresholdConfig = vscode.workspace.getConfiguration('codeCounter');
                        await thresholdConfig.update(`lineThresholds.${message.thresholdKey}Threshold`, message.value, vscode.ConfigurationTarget.Global);
                        vscode.window.showInformationMessage(`Updated ${message.thresholdKey} threshold to ${message.value} lines`);
                        
                        // Refresh the WebView to show updated preview values
                        const updatedConfigurationThreshold = getCurrentConfiguration();
                        panel.webview.html = getEmojiPickerWebviewContent(updatedConfigurationThreshold.badges, updatedConfigurationThreshold.folderBadges, updatedConfigurationThreshold.thresholds, updatedConfigurationThreshold.excludePatterns);
                    }
                    break;
                case 'addGlobPattern':
                    const patternConfig = vscode.workspace.getConfiguration('codeCounter');
                    const currentPatterns = patternConfig.get<string[]>('excludePatterns', []);
                    if (message.pattern && !currentPatterns.includes(message.pattern)) {
                        const updatedPatterns = [...currentPatterns, message.pattern];
                        await patternConfig.update('excludePatterns', updatedPatterns, vscode.ConfigurationTarget.Global);
                        vscode.window.showInformationMessage(`Added exclude pattern: ${message.pattern}`);
                        
                        // Trigger full refresh of all decorations (configuration watcher will handle cache clearing)
                        fileExplorerDecorator.refresh();
                        
                        // Refresh the WebView to show the updated patterns
                        const updatedConfiguration = getCurrentConfiguration();
                        panel.webview.html = getEmojiPickerWebviewContent(updatedConfiguration.badges, updatedConfiguration.folderBadges, updatedConfiguration.thresholds, updatedConfiguration.excludePatterns);
                    }
                    break;
                case 'removeGlobPattern':
                    const removeConfig = vscode.workspace.getConfiguration('codeCounter');
                    const currentPatterns2 = removeConfig.get<string[]>('excludePatterns', []);
                    const filteredPatterns = currentPatterns2.filter((p: string) => p !== message.pattern);
                    await removeConfig.update('excludePatterns', filteredPatterns, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage(`Removed exclude pattern: ${message.pattern}`);
                    
                    // Trigger full refresh of all decorations (configuration watcher will handle cache clearing)
                    fileExplorerDecorator.refresh();
                    
                    // Refresh the WebView to show the updated patterns
                    const updatedConfiguration2 = getCurrentConfiguration();
                    panel.webview.html = getEmojiPickerWebviewContent(updatedConfiguration2.badges, updatedConfiguration2.folderBadges, updatedConfiguration2.thresholds, updatedConfiguration2.excludePatterns);
                    break;
                case 'resetGlobPatterns':
                    const resetConfig = vscode.workspace.getConfiguration('codeCounter');
                    const defaultPatterns = [
                        '**/node_modules/**',
                        '**/out/**',
                        '**/bin/**', 
                        '**/dist/**',
                        '**/.git/**',
                        '**/.**/**',
                        '**/*.vsix',
                        '**/.code-counter.json',
                        '**/**-lock.json'
                    ];
                    await resetConfig.update('excludePatterns', defaultPatterns, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage('Exclude patterns reset to defaults');
                    
                    // Trigger full refresh of all decorations (configuration watcher will handle cache clearing)
                    fileExplorerDecorator.refresh();
                    
                    // Refresh the WebView to show the reset patterns
                    const updatedConfiguration3 = getCurrentConfiguration();
                    panel.webview.html = getEmojiPickerWebviewContent(updatedConfiguration3.badges, updatedConfiguration3.folderBadges, updatedConfiguration3.thresholds, updatedConfiguration3.excludePatterns);
                    break;
                case 'resetEmoji':
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
                    
                    // Refresh the WebView with reset values
                    const updatedConfiguration4 = getCurrentConfiguration();
                    panel.webview.html = getEmojiPickerWebviewContent(updatedConfiguration4.badges, updatedConfiguration4.folderBadges, updatedConfiguration4.thresholds, updatedConfiguration4.excludePatterns);
                    vscode.window.showInformationMessage('Emoji indicators and thresholds reset to defaults');
                    break;
                case 'updateNotificationSetting':
                    const notificationConfig = vscode.workspace.getConfiguration('codeCounter');
                    await notificationConfig.update('showNotificationOnAutoGenerate', message.enabled, vscode.ConfigurationTarget.Global);
                    const statusText = message.enabled ? 'enabled' : 'disabled';
                    vscode.window.showInformationMessage(`Popup notifications on auto-generate ${statusText}`);
                    break;
                case 'createWorkspaceSettings':
                    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                        const workspaceService = new WorkspaceSettingsService(workspacePath);
                        
                        // Create empty workspace settings file with skipCleanup=true to preserve empty file
                        await workspaceService.saveWorkspaceSettings(workspacePath, {}, true);

                        // Get directory tree and workspace data
                        const directoryTree = await workspaceService.getDirectoryTree();
                        const inheritanceInfo = await workspaceService.getSettingsWithInheritance(workspacePath);

                        // Refresh webview with workspace mode
                        const currentConfig = getCurrentConfiguration();
                        workspaceData = {
                            mode: 'workspace',
                            directoryTree,
                            currentDirectory: '<workspace>',
                            resolvedSettings: inheritanceInfo.resolvedSettings,
                            currentSettings: inheritanceInfo.currentSettings,
                            parentSettings: inheritanceInfo.parentSettings,
                            workspacePath
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
                        const workspaceService = new WorkspaceSettingsService(workspacePath);
                        
                        const currentPath = message.currentDirectory === '<global>' ? null : 
                                          message.currentDirectory === '<workspace>' ? workspacePath : 
                                          path.join(workspacePath, message.currentDirectory);
                        
                        let hasEmptySettings = false;
                        if (currentPath) {
                            hasEmptySettings = await workspaceService.hasEmptySettings(currentPath);
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
                        const workspaceService = new WorkspaceSettingsService(workspacePath);
                        
                        // Get the previous directory path if it exists and track if cleanup happened
                        const previousDirectory = message.previousDirectory;
                        let cleanupHappened = false;
                        
                        if (previousDirectory && previousDirectory !== '<global>') {
                            const previousPath = previousDirectory === '<workspace>' ? workspacePath : 
                                               path.join(workspacePath, previousDirectory);
                            
                            // Check if previous directory has empty settings and clean them up
                            if (await workspaceService.hasEmptySettings(previousPath)) {
                                await workspaceService.deleteSettingsFile(path.join(previousPath, '.code-counter.json'));
                                cleanupHappened = true;
                            }
                        }
                        
                        const selectedPath = message.directoryPath === '<global>' ? null : 
                                           message.directoryPath === '<workspace>' ? workspacePath : 
                                           path.join(workspacePath, message.directoryPath);
                        
                        let resolvedSettings;
                        let mode = 'global';
                        
                        if (selectedPath === null) {
                            // Global mode
                            const globalConfig = getCurrentConfiguration();
                            resolvedSettings = {
                                lineThresholds: {
                                    warning: globalConfig.thresholds.mid,
                                    danger: globalConfig.thresholds.high
                                },
                                emojis: {
                                    normal: globalConfig.badges.low,
                                    warning: globalConfig.badges.medium,
                                    danger: globalConfig.badges.high
                                },
                                source: 'global'
                            };
                        } else {
                            // Workspace/subdirectory mode
                            resolvedSettings = await workspaceService.getResolvedSettings(selectedPath);
                            mode = 'workspace';
                        }
                        
                        const directoryTree = await workspaceService.getDirectoryTree();
                        const currentConfig = getCurrentConfiguration();
                        
                        let finalSelectedPath = selectedPath;
                        let finalResolvedSettings = resolvedSettings;
                        let finalMode = mode;
                        let inheritanceInfo = null;
                        
                        if (message.mode === 'global') {
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
                        } else if (finalSelectedPath) {
                            // Get inheritance information for workspace/subdirectory
                            inheritanceInfo = await workspaceService.getSettingsWithInheritance(finalSelectedPath);
                            finalResolvedSettings = inheritanceInfo.resolvedSettings;
                        }
                        
                        // Use resolved settings for display (type assertion to handle union type)
                        const settings = finalResolvedSettings as ResolvedSettings;
                        const displayBadges = {
                            low: settings['codeCounter.emojis.folders.normal'],
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
                                    resolvedSettings: inheritanceInfo?.resolvedSettings ?? (await workspaceService.getSettingsWithInheritance(workspacePath)).resolvedSettings,
                                    currentSettings: inheritanceInfo?.currentSettings ?? (await workspaceService.getSettingsWithInheritance(workspacePath)).currentSettings,
                                    parentSettings: inheritanceInfo?.parentSettings ?? (await workspaceService.getSettingsWithInheritance(workspacePath)).parentSettings,
                                    workspacePath
                                }
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
                                    resolvedSettings: settings,
                                    currentSettings: inheritanceInfo?.currentSettings,
                                    parentSettings: inheritanceInfo?.parentSettings || undefined,
                                    workspacePath
                                }
                            );
                        }
                    }
                    break;
                case 'createSubWorkspace':
                    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                        const workspaceService = new WorkspaceSettingsService(workspacePath);
                        const targetPath = path.join(workspacePath, message.directoryPath);
                        
                        // Create empty settings file in subdirectory with skipCleanup=true
                        await workspaceService.saveWorkspaceSettings(targetPath, {}, true);
                        
                        // Refresh with updated tree
                        const directoryTree = await workspaceService.getDirectoryTree();
                        const resolvedSettings = await workspaceService.getResolvedSettings(targetPath);
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
                        const workspaceService = new WorkspaceSettingsService(workspacePath);
                        
                        const targetPath = message.directoryPath === '<workspace>' ? workspacePath : 
                                         path.join(workspacePath, message.directoryPath);
                        
                        await workspaceService.saveWorkspaceSettings(targetPath, message.settings);
                        
                        // Refresh to show updated settings
                        const directoryTree = await workspaceService.getDirectoryTree();
                        const resolvedSettings = await workspaceService.getResolvedSettings(targetPath);
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
                        
                        vscode.window.showInformationMessage('Workspace settings saved');
                    }
                    break;
                case 'resetWorkspaceField':
                    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                        const workspaceService = new WorkspaceSettingsService(workspacePath);
                        
                        const targetPath = message.directory === '<workspace>' ? workspacePath : 
                                         path.join(workspacePath, message.directory);
                        
                        await workspaceService.resetField(targetPath, message.field);
                        
                        // Refresh to show updated settings
                        const directoryTree = await workspaceService.getDirectoryTree();
                        const resolvedSettings = await workspaceService.getResolvedSettings(targetPath);
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
                        
                        vscode.window.showInformationMessage(`Field ${message.field} reset to parent value`);
                    }
                    break;
            }
        },
        undefined
    );
}

function getEmojiPickerWebviewContent(badges: any, 
        folderBadges: any, 
        thresholds: any,
        excludePatterns: string[] = [],
        workspaceData?: WorkspaceData,
        webview?: vscode.Webview): string {
    try {
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
        
        const excludePatternsHtml = excludePatterns.map((pattern) => `
            <div class="glob-pattern-item" data-pattern="${pattern}">
                <code>${pattern}</code>
                <button onclick="removePattern('${pattern}')" class="remove-btn">❌</button>
            </div>
        `).join('');

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
        
        // We'll embed only the data, not the script content
        let embeddedData;
        try {
            embeddedData = {
                emojiData: JSON.parse(emojiData),
                emojiSearchData: JSON.parse(emojiSearchData),
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
        
        htmlContent = htmlContent.replace(/{{badges\.low}}/g, badges.low);
        htmlContent = htmlContent.replace(/{{badges\.medium}}/g, badges.medium);
        htmlContent = htmlContent.replace(/{{badges\.high}}/g, badges.high);
        htmlContent = htmlContent.replace(/{{folderBadges\.low}}/g, folderBadges.low);
        htmlContent = htmlContent.replace(/{{folderBadges\.medium}}/g, folderBadges.medium);
        htmlContent = htmlContent.replace(/{{folderBadges\.high}}/g, folderBadges.high);
        htmlContent = htmlContent.replace(/{{thresholds\.mid}}/g, thresholds.mid?.toString());
        htmlContent = htmlContent.replace(/{{thresholds\.high}}/g, thresholds.high?.toString());
        htmlContent = htmlContent.replace(/{{lowPreviewLines}}/g, lowPreviewLines.toString());
        htmlContent = htmlContent.replace(/{{mediumPreviewLines}}/g, mediumPreviewLines.toString());
        htmlContent = htmlContent.replace(/{{highPreviewLines}}/g, highPreviewLines.toString());
        htmlContent = htmlContent.replace(/{{lowFolderAvg}}/g, lowFolderAvg.toString());
        htmlContent = htmlContent.replace(/{{mediumFolderAvg}}/g, mediumFolderAvg.toString());
        htmlContent = htmlContent.replace(/{{highFolderAvg}}/g, highFolderAvg.toString());
        htmlContent = htmlContent.replace(/{{highFolderMax}}/g, highFolderMax.toString());
        htmlContent = htmlContent.replace(/{{excludePatterns}}/g, excludePatternsHtml);
        htmlContent = htmlContent.replace(/{{showNotificationChecked}}/g, showNotificationChecked);
        
        // Inheritance information placeholders
        let parentFileNormal = 'N/A';
        let parentFileWarning = 'N/A';
        let parentFileDanger = 'N/A';
        let parentFolderNormal = 'N/A';
        let parentFolderWarning = 'N/A';
        let parentFolderDanger = 'N/A';
        let parentWarningThreshold = 'N/A';
        let parentDangerThreshold = 'N/A';
        
        if (workspaceData && workspaceData.parentSettings) {
            parentFileNormal = workspaceData.parentSettings['codeCounter.emojis.normal'];
            parentFileWarning = workspaceData.parentSettings['codeCounter.emojis.warning'];
            parentFileDanger = workspaceData.parentSettings['codeCounter.emojis.danger'];
            parentFolderNormal = workspaceData.parentSettings['codeCounter.emojis.folders.normal'];
            parentFolderWarning = workspaceData.parentSettings['codeCounter.emojis.folders.warning'];
            parentFolderDanger = workspaceData.parentSettings['codeCounter.emojis.folders.danger'];
            parentWarningThreshold = workspaceData.parentSettings['codeCounter.lineThresholds.midThreshold'].toString();
            parentDangerThreshold = workspaceData.parentSettings['codeCounter.lineThresholds.highThreshold'].toString();
        }
        
        htmlContent = htmlContent.replace(/{{parentFileNormal}}/g, parentFileNormal);
        htmlContent = htmlContent.replace(/{{parentFileWarning}}/g, parentFileWarning);
        htmlContent = htmlContent.replace(/{{parentFileDanger}}/g, parentFileDanger);
        htmlContent = htmlContent.replace(/{{parentFolderNormal}}/g, parentFolderNormal);
        htmlContent = htmlContent.replace(/{{parentFolderWarning}}/g, parentFolderWarning);
        htmlContent = htmlContent.replace(/{{parentFolderDanger}}/g, parentFolderDanger);
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
                <div class="directory-item ${workspaceData.currentDirectory === '<workspace>' ? 'selected' : ''}" 
                     onclick="selectDirectory('<workspace>')">
                    <span class="directory-icon">📁</span>
                    &lt;workspace&gt;
                </div>
                ${directoryTreeHtml}
            </div>
            ${workspaceData.currentDirectory !== '<global>' ? 
                '<button onclick="createSubWorkspace()" class="create-sub-workspace-button">Create sub-workspace</button>' : 
                ''}
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

    // Removed toggle commands - users can simply disable the extension if they don't want it

    const resetColorsDisposable = vscode.commands.registerCommand('codeCounter.resetBadgeSettings', async () => {
        const emojiConfig = vscode.workspace.getConfiguration('codeCounter.emojis');
        
        await emojiConfig.update('normal', '🟢', vscode.ConfigurationTarget.Global);
        await emojiConfig.update('warning', '🟡', vscode.ConfigurationTarget.Global);
        await emojiConfig.update('danger', '🔴', vscode.ConfigurationTarget.Global);
        
        vscode.window.showInformationMessage('Emoji indicators reset to defaults: 🟢 🟡 🔴');
    });

    const openColorSettingsDisposable = vscode.commands.registerCommand('codeCounter.openSettings', async () => {
        await showCodeCounterSettings(fileExplorerDecorator);
    });

    const showReportPanelDisposable = vscode.commands.registerCommand('codeCounter.showReportPanel', async () => {
        await countLinesCommand.executeAndShowPanel();
    });

    // Add all disposables to context
    context.subscriptions.push(
        countLinesDisposable,
        resetColorsDisposable,
        openColorSettingsDisposable,
        showReportPanelDisposable,
        decorationProvider,
        fileWatcher,
        fileExplorerDecorator,
        editorTabDecorator
    );
}

export function deactivate() {}