/**
 * VS Code Code Counter Extension
 * Settings Webview Handler
 * 
 * Handles the main settings webview creation and message processing
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspaceDatabaseService, WorkspaceSettings } from '../services/workspaceDatabaseService';
import { PathBasedSettingsService } from '../services/pathBasedSettingsService';
import { FileExplorerDecorationProvider } from '../providers/fileExplorerDecorator';
import { DebugService } from '../services/debugService';
import { 
    getWorkspaceService,
    setGlobalEmojiPickerPanel,
    setGlobalCurrentDirectory,
    getGlobalCurrentDirectory,
    getCurrentConfiguration,
    addSourceToSettings,
    getResolvedSettingsFromDatabase,
    calculateTargetPath,
    notifySettingsChanged,
    WorkspaceData
} from '../shared/extensionUtils';
import { getDirectoryTreeFromDatabase } from '../shared/directoryUtils';
import { getEmojiPickerWebviewContent } from '../shared/webviewUtils';
import { EmojiHandler } from './emojiHandler';
import { ThresholdHandler } from './thresholdHandler';
import { PatternHandler } from './patternHandler';
import { SettingsHandler } from './settingsHandler';

// Initialize debug service
const debug = DebugService.getInstance();

export class SettingsWebviewHandler {
    
    /**
     * Show the main Code Counter settings webview panel
     */
    static async showCodeCounterSettings(
        fileExplorerDecorator: FileExplorerDecorationProvider, 
        context: vscode.ExtensionContext, 
        pathBasedSettings: PathBasedSettingsService
    ): Promise<void> {
        try {
            debug.info('SettingsWebviewHandler.showCodeCounterSettings called');
            
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
                const migrationResult = await workspaceService.migrateAndCleanupJsonFiles();
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
                patternsWithSources,
                hasWorkspaceSettings
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
                await this.handleWebviewMessage(message, panel, fileExplorerDecorator, context, pathBasedSettings, workspaceData, badges, folderBadges, thresholds);
            },
            undefined
        );

        // Handle webview disposal
        panel.onDidDispose(() => {
            // Database service handles cleanup automatically - no action needed
            setGlobalEmojiPickerPanel(null);
            debug.info('Code Counter settings panel disposed');
        });
        
        } catch (error) {
            debug.error('Failed to show Code Counter settings:', error);
            throw error;
        }
    }

    /**
     * Handle webview messages
     */
    private static async handleWebviewMessage(
        message: any,
        panel: vscode.WebviewPanel,
        fileExplorerDecorator: FileExplorerDecorationProvider,
        context: vscode.ExtensionContext,
        pathBasedSettings: PathBasedSettingsService,
        workspaceData: WorkspaceData | undefined,
        badges: any,
        folderBadges: any,
        thresholds: any
    ): Promise<void> {
        switch (message.command) {
            case 'updateEmoji':
                await EmojiHandler.handleUpdateEmoji(message, panel, fileExplorerDecorator);
                break;
            
            case 'updateThreshold':
                await ThresholdHandler.handleUpdateThreshold(message, panel);
                break;
            
            case 'addGlobPattern':
                await PatternHandler.handleAddGlobPattern(message, panel, workspaceData, badges, folderBadges, thresholds);
                break;
            
            case 'removeGlobPattern':
                await PatternHandler.handleRemoveGlobPattern(message, panel, workspaceData, badges, folderBadges, thresholds);
                break;
            
            case 'resetGlobPatterns':
                await PatternHandler.handleResetGlobPatterns(message, panel, workspaceData, badges, folderBadges, thresholds);
                break;
            
            case 'addIncludeGlobPattern':
                await PatternHandler.handleAddIncludeGlobPattern(message, panel, workspaceData, badges, folderBadges, thresholds);
                break;
            
            case 'removeIncludeGlobPattern':
                await PatternHandler.handleRemoveIncludeGlobPattern(message, panel, workspaceData, badges, folderBadges, thresholds);
                break;
            
            case 'resetIncludeGlobPatterns':
                await PatternHandler.handleResetIncludeGlobPatterns(message, panel, workspaceData, badges, folderBadges, thresholds);
                break;
            
            case 'resetEmoji':
                await SettingsHandler.handleResetEmoji(message, panel, fileExplorerDecorator, badges, folderBadges, thresholds);
                break;
            
            case 'updateNotificationSetting':
                await SettingsHandler.handleUpdateNotificationSetting(message);
                break;
            
            case 'updateOutputDirectory':
                await SettingsHandler.handleUpdateOutputDirectory(message);
                break;
            
            case 'browseOutputDirectory':
                await SettingsHandler.handleBrowseOutputDirectory(panel);
                break;
            
            case 'updateAutoGenerate':
                await SettingsHandler.handleUpdateAutoGenerate(message);
                break;
            
            case 'createWorkspaceSettings':
                await SettingsHandler.handleCreateWorkspaceSettings(message, context, panel, badges, folderBadges, thresholds);
                break;
            
            case 'checkEmptySettingsBeforeChange':
                await SettingsHandler.handleCheckEmptySettingsBeforeChange(message, panel);
                break;
            
            case 'selectDirectory':
                await SettingsHandler.handleSelectDirectory(message, context, panel, badges, folderBadges, thresholds);
                break;
            
            case 'createSubWorkspace':
                await SettingsHandler.handleCreateSubWorkspace(message, context, panel);
                break;
            
            case 'saveWorkspaceSettings':
                await SettingsHandler.handleSaveWorkspaceSettings(message, pathBasedSettings, panel);
                break;
            
            case 'resetWorkspaceField':
                await SettingsHandler.handleResetWorkspaceField(message, panel, fileExplorerDecorator);
                break;
            
            case 'configureDebugService':
                await SettingsHandler.handleConfigureDebugService(message);
                break;
            
            case 'openDebugLogFile':
                await SettingsHandler.handleOpenDebugLogFile();
                break;
            
            case 'debugLog':
                // Handle debug messages from webview
                const webviewPrefix = '[WEBVIEW]';
                switch (message.level) {
                    case 'verbose':
                        debug.verbose(webviewPrefix, message.message);
                        break;
                    case 'info':
                        debug.info(webviewPrefix, message.message);
                        break;
                    case 'warning':
                        debug.warning(webviewPrefix, message.message);
                        break;
                    case 'error':
                        debug.error(webviewPrefix, message.message);
                        break;
                    default:
                        debug.info(webviewPrefix, message.message);
                }
                break;
            
            default:
                debug.error(`Unknown webview command: ${message.command}`);
        }
    }
}