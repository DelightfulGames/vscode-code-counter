/**
 * Webview management for VS Code Code Counter Extension
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DebugService } from '../services/debugService';
import { WorkspaceDatabaseService, WorkspaceSettings } from '../services/workspaceDatabaseService';
import { DirectoryNode, WorkspaceData } from '../services/workspaceSettingsService';
import { FileExplorerDecorationProvider } from '../providers/fileExplorerDecorator';
import { PathBasedSettingsService } from '../services/pathBasedSettingsService';
import { 
    getCurrentConfiguration, 
    addSourceToSettings, 
    getNotificationAndOutputSettings 
} from '../utils/configurationUtils';
import { 
    escapeHtml, 
    generateDirectoryTreeHtml, 
    generateWorkspaceSettingsHtml, 
    generatePatternsHtml, 
    loadWebviewAssets 
} from '../utils/htmlUtils';
import { 
    getWorkspaceService, 
    getDirectoryTreeFromDatabase, 
    getResolvedSettingsFromDatabase 
} from '../utils/workspaceUtils';

const debug = DebugService.getInstance();

// Global webview panel reference
let globalEmojiPickerPanel: vscode.WebviewPanel | null = null;
let globalCurrentDirectory: string = '<workspace>';

/**
 * Refresh emoji picker webview with updated data from database service
 */
export async function refreshEmojiPickerWebviewWithService(workspaceService: WorkspaceDatabaseService, workspacePath: string): Promise<void> {
    if (!globalEmojiPickerPanel) {
        // No panel is open, nothing to refresh
        return;
    }

    try {
        debug.info('Refreshing emoji picker webview with existing service instance');
        
        // Force a 200ms delay to ensure database operations have completed
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Create a completely fresh service instance to avoid any caching issues
        const freshService = getWorkspaceService(workspacePath);
        debug.verbose('Using cached service instance for refresh (cache provides fresh data)');
        
        // Get workspace-level data for emoji display (emojis should always be workspace-level)
        const workspaceInheritanceInfo = await freshService.getSettingsWithInheritance(workspacePath);
        debug.verbose('Workspace inheritance info for emojis:', {
            currentSettings: workspaceInheritanceInfo.currentSettings,
            resolvedSettings: workspaceInheritanceInfo.resolvedSettings,
            parentSettings: workspaceInheritanceInfo.parentSettings
        });
        const workspaceResolvedSettings = workspaceInheritanceInfo.resolvedSettings;
        const globalConfig = getCurrentConfiguration();
        
        const badges = {
            low: workspaceResolvedSettings['codeCounter.emojis.normal'] || globalConfig.badges.low,
            medium: workspaceResolvedSettings['codeCounter.emojis.warning'] || globalConfig.badges.medium,
            high: workspaceResolvedSettings['codeCounter.emojis.danger'] || globalConfig.badges.high
        };
        const folderBadges = {
            low: workspaceResolvedSettings['codeCounter.emojis.folders.normal'] || globalConfig.folderBadges.low,
            medium: workspaceResolvedSettings['codeCounter.emojis.folders.warning'] || globalConfig.folderBadges.medium,
            high: workspaceResolvedSettings['codeCounter.emojis.folders.danger'] || globalConfig.folderBadges.high
        };
        const thresholds = {
            mid: workspaceResolvedSettings['codeCounter.lineThresholds.midThreshold'] || globalConfig.thresholds.mid,
            high: workspaceResolvedSettings['codeCounter.lineThresholds.highThreshold'] || globalConfig.thresholds.high
        };
        const excludePatterns = workspaceResolvedSettings['codeCounter.excludePatterns'] || globalConfig.excludePatterns;
        debug.verbose('Exclude patterns from workspace level:', excludePatterns);

        // Build workspace data for the webview using the fresh service
        const directoryTree = await getDirectoryTreeFromDatabase(freshService, workspacePath);
        
        // Calculate target path for the current directory (ensure normalized path separators)
        const currentDirectory = (globalCurrentDirectory || '<workspace>').replace(/\\/g, '/');
        const targetPath = currentDirectory === '<workspace>' ? workspacePath : 
                          currentDirectory === '<global>' ? workspacePath :
                          path.join(workspacePath, currentDirectory);
        
        // Get inheritance info and patterns for the specific directory
        const targetInheritanceInfo = await freshService.getSettingsWithInheritance(targetPath);
        const patternsWithSources = await freshService.getExcludePatternsWithSources(targetPath);
        
        debug.verbose('Refresh targeting directory:', currentDirectory, 'at path:', targetPath);
        debug.verbose('Patterns for current directory:', patternsWithSources);
        debug.verbose('Directory tree paths:', directoryTree.map(dir => dir.relativePath));
        debug.verbose('Current directory for selection highlighting:', currentDirectory);
        
        const workspaceData = {
            mode: 'workspace' as const,
            directoryTree,
            currentDirectory,
            resolvedSettings: {
                ...workspaceInheritanceInfo.resolvedSettings,
                source: 'database'
            } as any,
            currentSettings: {
                ...workspaceInheritanceInfo.currentSettings,
                source: 'database'
            } as any,
            parentSettings: addSourceToSettings(workspaceInheritanceInfo.parentSettings),
            workspacePath,
            patternsWithSources
        };

        debug.verbose('Final webview refresh data validation:', {
            'excludePatterns length': excludePatterns?.length || 0,
            'excludePatterns content': excludePatterns,
            'workspaceData.resolvedSettings has excludePatterns': !!workspaceData.resolvedSettings['codeCounter.excludePatterns'],
            'workspaceData.currentSettings has excludePatterns': !!workspaceData.currentSettings['codeCounter.excludePatterns'],
            'workspaceData.parentSettings has excludePatterns': !!workspaceData.parentSettings['codeCounter.excludePatterns']
        });

        // Update the webview content
        globalEmojiPickerPanel.webview.html = getEmojiPickerWebviewContent(
            badges, 
            folderBadges, 
            thresholds, 
            excludePatterns, 
            workspaceData, 
            globalEmojiPickerPanel.webview
        );

        debug.info('Emoji picker webview refreshed with updated exclusion patterns');
    } catch (error) {
        debug.error('Failed to refresh emoji picker webview with service:', error);
    }
}

/**
 * Get the current global directory for webview state tracking
 */
export function getCurrentGlobalDirectory(): string {
    return globalCurrentDirectory;
}

/**
 * Set the current global directory for webview state tracking
 */
export function setCurrentGlobalDirectory(directory: string): void {
    globalCurrentDirectory = directory.replace(/\\/g, '/');
}

/**
 * Get the global webview panel reference
 */
export function getGlobalEmojiPickerPanel(): vscode.WebviewPanel | null {
    return globalEmojiPickerPanel;
}

/**
 * Set the global webview panel reference
 */
export function setGlobalEmojiPickerPanel(panel: vscode.WebviewPanel | null): void {
    globalEmojiPickerPanel = panel;
}

/**
 * Generate comprehensive webview HTML content for emoji picker
 */
export function getEmojiPickerWebviewContent(badges: any, 
        folderBadges: any, 
        thresholds: any,
        excludePatterns: string[] = [],
        workspaceData?: WorkspaceData,
        webview?: vscode.Webview): string {
    try {
        debug.verbose('getEmojiPickerWebviewContent called with:', {
            badges: badges,
            folderBadges: folderBadges,
            thresholds: thresholds,
            excludePatterns: excludePatterns?.length || 0,
            workspaceData: !!workspaceData
        });

        const { htmlContent, scriptContent, cssContent, embeddedData, useInlineScript } = loadWebviewAssets(webview);
        let processedHtml = htmlContent;
        
        // Get notification and output settings
        const { showNotificationOnAutoGenerate, outputDirectory, autoGenerate } = getNotificationAndOutputSettings();
        const showNotificationChecked = showNotificationOnAutoGenerate ? 'checked' : '';
        const autoGenerateChecked = autoGenerate ? 'checked' : '';
        
        const lowPreviewLines = Math.floor(thresholds.mid / 2);
        const mediumPreviewLines = Math.floor((thresholds.mid + thresholds.high) / 2);
        const highPreviewLines = thresholds.high + 500;
        const lowFolderAvg = Math.floor(thresholds.mid / 2);
        const mediumFolderAvg = Math.floor((thresholds.mid + thresholds.high) / 2);
        const highFolderAvg = thresholds.high + 200;
        const highFolderMax = thresholds.high + 500;
        
        // Generate exclude patterns HTML with inheritance information
        const excludePatternsHtml = generatePatternsHtml(workspaceData, 'exclude');
        
        // Generate include patterns HTML with inheritance information
        const includePatternsHtml = generatePatternsHtml(workspaceData, 'include');

        // Embed workspace data for JavaScript
        embeddedData.workspaceData = workspaceData;
        
        // For backward compatibility, create full script content as fallback
        const fullScriptContent = `
            // Embedded emoji data
            window.emojiData = ${JSON.stringify(embeddedData.emojiData)};
            window.emojiSearchData = ${JSON.stringify(embeddedData.emojiSearchData)};
            
            // Workspace settings data
            window.workspaceData = ${JSON.stringify(embeddedData.workspaceData)};
            
            ${scriptContent}
        `;
        
        // Replace placeholders with actual values
        const lowBadge = badges.low || '🟢';
        const mediumBadge = badges.medium || '🟡';
        const highBadge = badges.high || '🔴';
        
        processedHtml = processedHtml.replace(/{{badges\.low}}/g, lowBadge);
        processedHtml = processedHtml.replace(/{{badges\.medium}}/g, mediumBadge);
        processedHtml = processedHtml.replace(/{{badges\.high}}/g, highBadge);
        processedHtml = processedHtml.replace(/{{folderBadges\.low}}/g, folderBadges.low || '🟩');
        processedHtml = processedHtml.replace(/{{folderBadges\.medium}}/g, folderBadges.medium || '🟨');
        processedHtml = processedHtml.replace(/{{folderBadges\.high}}/g, folderBadges.high || '🟥');
        
        const midValue = thresholds.mid?.toString() || '300';
        const highValue = thresholds.high?.toString() || '1000';
        
        processedHtml = processedHtml.replace(/{{thresholds\.mid}}/g, midValue);
        processedHtml = processedHtml.replace(/{{thresholds\.high}}/g, highValue);
        processedHtml = processedHtml.replace(/{{lowPreviewLines}}/g, lowPreviewLines.toString());
        processedHtml = processedHtml.replace(/{{mediumPreviewLines}}/g, mediumPreviewLines.toString());
        processedHtml = processedHtml.replace(/{{highPreviewLines}}/g, highPreviewLines.toString());
        processedHtml = processedHtml.replace(/{{lowFolderAvg}}/g, lowFolderAvg.toString());
        processedHtml = processedHtml.replace(/{{mediumFolderAvg}}/g, mediumFolderAvg.toString());
        processedHtml = processedHtml.replace(/{{highFolderAvg}}/g, highFolderAvg.toString());
        processedHtml = processedHtml.replace(/{{highFolderMax}}/g, highFolderMax.toString());
        processedHtml = processedHtml.replace(/{{excludePatterns}}/g, excludePatternsHtml);
        processedHtml = processedHtml.replace(/{{includePatterns}}/g, includePatternsHtml);
        processedHtml = processedHtml.replace(/{{showNotificationChecked}}/g, showNotificationChecked);
        processedHtml = processedHtml.replace(/{{outputDirectory}}/g, outputDirectory);
        processedHtml = processedHtml.replace(/{{autoGenerateChecked}}/g, autoGenerateChecked);
        
        // Replace debug configuration
        const currentConfig = getCurrentConfiguration();
        const debugBackendValue = currentConfig.debug || 'none';
        processedHtml = processedHtml.replace(/{{debugBackend}}/g, debugBackendValue);
        processedHtml = processedHtml.replace(/{{debugBackendNoneSelected}}/g, debugBackendValue === 'none' ? 'selected' : '');
        processedHtml = processedHtml.replace(/{{debugBackendConsoleSelected}}/g, debugBackendValue === 'console' ? 'selected' : '');
        processedHtml = processedHtml.replace(/{{debugBackendFileSelected}}/g, debugBackendValue === 'file' ? 'selected' : '');
        
        // Inheritance information placeholders
        const { 
            parentFileNormal, parentFileWarning, parentFileDanger,
            parentFolderNormal, parentFolderWarning, parentFolderDanger,
            parentWarningThreshold, parentDangerThreshold,
            parentFileNormalSource, parentFileWarningSource, parentFileDangerSource,
            parentFolderNormalSource, parentFolderWarningSource, parentFolderDangerSource,
            parentWarningThresholdSource, parentDangerThresholdSource
        } = extractInheritanceInfo(workspaceData);
        
        processedHtml = processedHtml.replace(/{{parentFileNormal}}/g, parentFileNormal);
        processedHtml = processedHtml.replace(/{{parentFileWarning}}/g, parentFileWarning);
        processedHtml = processedHtml.replace(/{{parentFileDanger}}/g, parentFileDanger);
        processedHtml = processedHtml.replace(/{{parentFolderNormal}}/g, parentFolderNormal);
        processedHtml = processedHtml.replace(/{{parentFileNormalSource}}/g, escapeHtml(parentFileNormalSource));
        processedHtml = processedHtml.replace(/{{parentFileWarningSource}}/g, escapeHtml(parentFileWarningSource));
        processedHtml = processedHtml.replace(/{{parentFileDangerSource}}/g, escapeHtml(parentFileDangerSource));
        processedHtml = processedHtml.replace(/{{parentFolderNormalSource}}/g, escapeHtml(parentFolderNormalSource));
        processedHtml = processedHtml.replace(/{{parentFolderWarning}}/g, parentFolderWarning);
        processedHtml = processedHtml.replace(/{{parentFolderDanger}}/g, parentFolderDanger);
        processedHtml = processedHtml.replace(/{{parentFolderWarningSource}}/g, escapeHtml(parentFolderWarningSource));
        processedHtml = processedHtml.replace(/{{parentFolderDangerSource}}/g, escapeHtml(parentFolderDangerSource));
        processedHtml = processedHtml.replace(/{{parentWarningThresholdSource}}/g, escapeHtml(parentWarningThresholdSource));
        processedHtml = processedHtml.replace(/{{parentDangerThresholdSource}}/g, escapeHtml(parentDangerThresholdSource));
        processedHtml = processedHtml.replace(/{{parentWarningThreshold}}/g, parentWarningThreshold);
        processedHtml = processedHtml.replace(/{{parentDangerThreshold}}/g, parentDangerThreshold);
        
        // Workspace settings placeholders
        const workspaceSettingsHtml = generateWorkspaceSettingsHtml(workspaceData);
        
        // Check if workspace is available (separate from whether it has existing settings)
        const hasWorkspace = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0;
        
        let createWorkspaceButtonHtml = '';
        if (!workspaceData || !workspaceData.directoryTree || workspaceData.directoryTree.length === 0) {
            createWorkspaceButtonHtml = hasWorkspace ? 
                '<button onclick="createWorkspaceSettings()" class="create-workspace-btn">Create Workspace Settings</button>' : 
                '<div class="no-workspace-message">Open a workspace to configure directory-specific settings</div>';
        }
        
        processedHtml = processedHtml.replace(/{{workspaceSettings}}/g, workspaceSettingsHtml);
        processedHtml = processedHtml.replace(/{{createWorkspaceButton}}/g, createWorkspaceButtonHtml);
        
        if (useInlineScript) {
            processedHtml = processedHtml.replace(/{{EMBEDDED_SCRIPT}}/g, fullScriptContent);
            processedHtml = processedHtml.replace(/{{EMBEDDED_CSS}}/g, cssContent);
        } else {
            const scriptUri = webview?.asWebviewUri(vscode.Uri.file(path.join(__dirname, '..', '..', 'templates', 'emoji-picker.js')));
            const cssUri = webview?.asWebviewUri(vscode.Uri.file(path.join(__dirname, '..', '..', 'templates', 'emoji-picker.css')));
            processedHtml = processedHtml.replace(/{{SCRIPT_URI}}/g, scriptUri?.toString() || '');
            processedHtml = processedHtml.replace(/{{CSS_URI}}/g, cssUri?.toString() || '');
        }
        
        return processedHtml;
        
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

/**
 * Extract inheritance information for parent settings display
 */
function extractInheritanceInfo(workspaceData: WorkspaceData | undefined) {
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
        const config = getCurrentConfiguration();
        
        parentFileNormal = workspaceData.parentSettings['codeCounter.emojis.normal'] || config.badges.low;
        parentFileWarning = workspaceData.parentSettings['codeCounter.emojis.warning'] || config.badges.medium;
        parentFileDanger = workspaceData.parentSettings['codeCounter.emojis.danger'] || config.badges.high;
        parentFolderNormal = workspaceData.parentSettings['codeCounter.emojis.folders.normal'] || config.folderBadges.low;
        parentFolderWarning = workspaceData.parentSettings['codeCounter.emojis.folders.warning'] || config.folderBadges.medium;
        parentFolderDanger = workspaceData.parentSettings['codeCounter.emojis.folders.danger'] || config.folderBadges.high;
        parentWarningThreshold = workspaceData.parentSettings['codeCounter.lineThresholds.midThreshold']?.toString() || config.thresholds.mid.toString();
        parentDangerThreshold = workspaceData.parentSettings['codeCounter.lineThresholds.highThreshold']?.toString() || config.thresholds.high.toString();
        
        // All parent settings come from database source
        parentFileNormalSource = 'Parent Directory';
        parentFileWarningSource = 'Parent Directory';
        parentFileDangerSource = 'Parent Directory';
        parentFolderNormalSource = 'Parent Directory';
        parentFolderWarningSource = 'Parent Directory';
        parentFolderDangerSource = 'Parent Directory';
        parentWarningThresholdSource = 'Parent Directory';
        parentDangerThresholdSource = 'Parent Directory';
    } else if (workspaceData && workspaceData.mode === 'workspace') {
        // In workspace mode but no parent settings, show global defaults
        const config = getCurrentConfiguration();
        
        parentFileNormal = config.badges.low;
        parentFileWarning = config.badges.medium;
        parentFileDanger = config.badges.high;
        parentFolderNormal = config.folderBadges.low;
        parentFolderWarning = config.folderBadges.medium;
        parentFolderDanger = config.folderBadges.high;
        parentWarningThreshold = config.thresholds.mid.toString();
        parentDangerThreshold = config.thresholds.high.toString();
        
        // All defaults come from global configuration
        parentFileNormalSource = 'Global Settings';
        parentFileWarningSource = 'Global Settings';
        parentFileDangerSource = 'Global Settings';
        parentFolderNormalSource = 'Global Settings';
        parentFolderWarningSource = 'Global Settings';
        parentFolderDangerSource = 'Global Settings';
        parentWarningThresholdSource = 'Global Settings';
        parentDangerThresholdSource = 'Global Settings';
    }
    
    return {
        parentFileNormal, parentFileWarning, parentFileDanger,
        parentFolderNormal, parentFolderWarning, parentFolderDanger,
        parentWarningThreshold, parentDangerThreshold,
        parentFileNormalSource, parentFileWarningSource, parentFileDangerSource,
        parentFolderNormalSource, parentFolderWarningSource, parentFolderDangerSource,
        parentWarningThresholdSource, parentDangerThresholdSource
    };
}

/**
 * Show Code Counter Settings - Main webview creation function
 * Moved from extension.ts to centralize webview management
 */
export async function showCodeCounterSettings(fileExplorerDecorator: FileExplorerDecorationProvider, context: vscode.ExtensionContext, pathBasedSettings: PathBasedSettingsService): Promise<void> {
    // Delegate to the proper handler class
    const { SettingsWebviewHandler } = await import('../handlers/settingsWebviewHandler');
    return SettingsWebviewHandler.showCodeCounterSettings(fileExplorerDecorator, context, pathBasedSettings);
}