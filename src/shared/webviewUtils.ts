/**
 * VS Code Code Counter Extension
 * WebView Utilities - Shared Functions
 * 
 * Functions for generating webview HTML content and handling webview operations
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getCurrentConfiguration } from './extensionUtils';
import type { WorkspaceData } from './extensionUtils';
import { DebugService } from '../services/debugService';

// Module-level debug instance
const debug = DebugService.getInstance();

/**
 * Escape HTML for safe rendering
 */
export function escapeHtml(unsafe: string): string {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Generate HTML content for emoji picker webview
 */
export function getEmojiPickerWebviewContent(badges: any, 
        folderBadges: any, 
        thresholds: any,
        excludePatterns: string[] = [],
        workspaceData?: WorkspaceData,
        webview?: vscode.Webview): string {
    try {
        const templatePath = path.join(__dirname, '..', '..', 'templates', 'emoji-picker.html');
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
                            <span class="pattern-path" title="Inherited from ${item.source}">
                                ${item.source === '<global>' 
                                    ? '&lt;global&gt;'
                                    : (item.source === '<workspace>' 
                                        ? '&lt;workspace&gt;' 
                                        : item.source
                                    )
                                }
                            </span>
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

        // Generate include patterns HTML with inheritance information
        let includePatternsHtml = '';
        
        if (workspaceData && workspaceData.mode === 'workspace' && workspaceData.resolvedSettings && workspaceData.includePatternsWithSources && workspaceData.includePatternsWithSources.length > 0) {
            // In workspace mode, show detailed inheritance information
            const currentSettings = workspaceData.currentSettings?.['codeCounter.includePatterns'] || [];
            const hasLocalPatterns = workspaceData.currentSettings?.['codeCounter.includePatterns'] !== undefined;
            
            const patternItems = workspaceData.includePatternsWithSources.map((item) => {
                const isCurrentSetting = currentSettings.includes(item.pattern);
                const levelClass = item.level === 'global' ? 'global-setting' : 
                                 item.level === 'workspace' ? 'workspace-setting' : 'directory-setting';
                const borderClass = isCurrentSetting ? 'current-setting' : 'inherited-setting';
                
                if (isCurrentSetting) {
                    return `
                        <div class="glob-pattern-item ${borderClass} ${levelClass}" data-pattern="${item.pattern}">
                            <code>${item.pattern}</code>
                            <span class="pattern-source" title="Set in current directory">📍</span>
                            <button onclick="removeIncludePattern('${item.pattern}')" class="remove-btn">❌</button>
                        </div>
                    `;
                } else {
                    const opacity = item.level === 'global' ? '0.7' : '0.8';
                    const deleteButton = !hasLocalPatterns ? 
                        `<button onclick="removeIncludePattern('${item.pattern}')" class="remove-btn" title="Remove (will copy all patterns to local first)">❌</button>` : 
                        '';
                    
                    return `
                        <div class="glob-pattern-item ${borderClass} ${levelClass}" data-pattern="${item.pattern}">
                            <code style="opacity: ${opacity};">${item.pattern}</code>
                            <span class="pattern-path" title="Inherited from ${item.source}">
                                ${item.source === '<global>' 
                                    ? '&lt;global&gt;'
                                    : (item.source === '<workspace>' 
                                        ? '&lt;workspace&gt;' 
                                        : item.source
                                    )
                                }
                            </span>
                            <span class="pattern-source" title="Inherited from ${item.source}">🔗</span>
                            ${deleteButton}
                        </div>
                    `;
                }
            });
            
            includePatternsHtml = patternItems.join('');
        } else {
            const includePatterns = workspaceData?.resolvedSettings?.['codeCounter.includePatterns'] || [];
            if (includePatterns.length > 0) {
                includePatternsHtml = includePatterns.map((pattern: string) => `
                    <div class="glob-pattern-item" data-pattern="${pattern}">
                        <code>${pattern}</code>
                        <button onclick="removeIncludePattern('${pattern}')" class="remove-btn">❌</button>
                    </div>
                `).join('');
            }
        }

        // Load the JavaScript content, CSS and JSON data
        const scriptPath = path.join(__dirname, '..', '..', 'templates', 'emoji-picker.js');
        const cssPath = path.join(__dirname, '..', '..', 'templates', 'emoji-picker.css');
        const emojiDataPath = path.join(__dirname, '..', '..', 'templates', 'emoji-data.json');
        const emojiSearchDataPath = path.join(__dirname, '..', '..', 'templates', 'emoji-search-data.json');
        
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        const cssContent = fs.readFileSync(cssPath, 'utf8');
        const emojiData = fs.readFileSync(emojiDataPath, 'utf8');
        const emojiSearchData = fs.readFileSync(emojiSearchDataPath, 'utf8');
        
        // Create webview URIs for the JavaScript and CSS files
        const scriptUri = webview ? webview.asWebviewUri(vscode.Uri.file(scriptPath)) : null;
        const cssUri = webview ? webview.asWebviewUri(vscode.Uri.file(cssPath)) : null;
        
        // Fallback: if no webview provided, embed the script and CSS inline (backward compatibility)
        let useInlineScript = !webview || !scriptUri;
        
        // Cleanup metadata entries from emoji search data
        let emojiDB = JSON.parse(emojiData);
        let emojiSearchDB = JSON.parse(emojiSearchData);
        Object.keys(emojiSearchDB).forEach(key => {
            if (key.startsWith('_')) delete emojiSearchDB[key];
        });

        Object.keys(emojiDB).forEach(key => {
            if (key.startsWith('_')) delete emojiDB[key];
        });

        // Embed data for the webview
        let embeddedData;
        try {
            embeddedData = {
                emojiData: emojiDB,
                emojiSearchData: emojiSearchDB,
                workspaceData: workspaceData || null
            };
        } catch (parseError) {
            debug.error('Error parsing emoji data:', parseError);
            embeddedData = {
                emojiData: {},
                emojiSearchData: {},
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
        
        // Replace placeholders with actual values
        htmlContent = htmlContent.replace(/{{badges\.low}}/g, badges.low || '🟢');
        htmlContent = htmlContent.replace(/{{badges\.medium}}/g, badges.medium || '🟡');
        htmlContent = htmlContent.replace(/{{badges\.high}}/g, badges.high || '🔴');
        htmlContent = htmlContent.replace(/{{folderBadges\.low}}/g, folderBadges.low || '🟩');
        htmlContent = htmlContent.replace(/{{folderBadges\.medium}}/g, folderBadges.medium || '🟨');
        htmlContent = htmlContent.replace(/{{folderBadges\.high}}/g, folderBadges.high || '🟥');
        htmlContent = htmlContent.replace(/{{thresholds\.mid}}/g, thresholds.mid?.toString() || '300');
        htmlContent = htmlContent.replace(/{{thresholds\.high}}/g, thresholds.high?.toString() || '1000');
        htmlContent = htmlContent.replace(/{{lowPreviewLines}}/g, lowPreviewLines.toString());
        htmlContent = htmlContent.replace(/{{mediumPreviewLines}}/g, mediumPreviewLines.toString());
        htmlContent = htmlContent.replace(/{{highPreviewLines}}/g, highPreviewLines.toString());
        htmlContent = htmlContent.replace(/{{lowFolderAvg}}/g, lowFolderAvg.toString());
        htmlContent = htmlContent.replace(/{{mediumFolderAvg}}/g, mediumFolderAvg.toString());
        htmlContent = htmlContent.replace(/{{highFolderAvg}}/g, highFolderAvg.toString());
        htmlContent = htmlContent.replace(/{{highFolderMax}}/g, highFolderMax.toString());
        htmlContent = htmlContent.replace(/{{excludePatterns}}/g, excludePatternsHtml);
        htmlContent = htmlContent.replace(/{{includePatterns}}/g, includePatternsHtml);
        htmlContent = htmlContent.replace(/{{showNotificationChecked}}/g, showNotificationChecked);
        
        // Replace debug configuration
        const currentConfig = getCurrentConfiguration();
        const debugBackendValue = currentConfig.debug || 'none';
        htmlContent = htmlContent.replace(/{{debugBackend}}/g, debugBackendValue);
        htmlContent = htmlContent.replace(/{{debugBackendNoneSelected}}/g, debugBackendValue === 'none' ? 'selected' : '');
        htmlContent = htmlContent.replace(/{{debugBackendConsoleSelected}}/g, debugBackendValue === 'console' ? 'selected' : '');
        htmlContent = htmlContent.replace(/{{debugBackendFileSelected}}/g, debugBackendValue === 'file' ? 'selected' : '');
        
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
            const parentSettings = workspaceData.parentSettings;
            parentFileNormal = parentSettings['codeCounter.emojis.normal'] || 'N/A';
            parentFileWarning = parentSettings['codeCounter.emojis.warning'] || 'N/A';
            parentFileDanger = parentSettings['codeCounter.emojis.danger'] || 'N/A';
            parentFolderNormal = parentSettings['codeCounter.emojis.folders.normal'] || 'N/A';
            parentFolderWarning = parentSettings['codeCounter.emojis.folders.warning'] || 'N/A';
            parentFolderDanger = parentSettings['codeCounter.emojis.folders.danger'] || 'N/A';
            parentWarningThreshold = parentSettings['codeCounter.lineThresholds.midThreshold']?.toString() || 'N/A';
            parentDangerThreshold = parentSettings['codeCounter.lineThresholds.highThreshold']?.toString() || 'N/A';
            
            parentFileNormalSource = parentSettings.source || 'global';
            parentFileWarningSource = parentSettings.source || 'global';
            parentFileDangerSource = parentSettings.source || 'global';
            parentFolderNormalSource = parentSettings.source || 'global';
            parentFolderWarningSource = parentSettings.source || 'global';
            parentFolderDangerSource = parentSettings.source || 'global';
            parentWarningThresholdSource = parentSettings.source || 'global';
            parentDangerThresholdSource = parentSettings.source || 'global';
        }
        
        htmlContent = htmlContent.replace(/{{parentFileNormal}}/g, parentFileNormal);
        htmlContent = htmlContent.replace(/{{parentFileWarning}}/g, parentFileWarning);
        htmlContent = htmlContent.replace(/{{parentFileDanger}}/g, parentFileDanger);
        htmlContent = htmlContent.replace(/{{parentFolderNormal}}/g, parentFolderNormal);
        htmlContent = htmlContent.replace(/{{parentFileNormalSource}}/g, escapeHtml(parentFileNormalSource));
        htmlContent = htmlContent.replace(/{{parentFileWarningSource}}/g, escapeHtml(parentFileWarningSource));
        htmlContent = htmlContent.replace(/{{parentFileDangerSource}}/g, escapeHtml(parentFileDangerSource));
        htmlContent = htmlContent.replace(/{{parentFolderNormalSource}}/g, escapeHtml(parentFolderNormalSource));
        htmlContent = htmlContent.replace(/{{parentFolderWarning}}/g, parentFolderWarning);
        htmlContent = htmlContent.replace(/{{parentFolderDanger}}/g, parentFolderDanger);
        htmlContent = htmlContent.replace(/{{parentFolderWarningSource}}/g, escapeHtml(parentFolderWarningSource));
        htmlContent = htmlContent.replace(/{{parentFolderDangerSource}}/g, escapeHtml(parentFolderDangerSource));
        htmlContent = htmlContent.replace(/{{parentWarningThresholdSource}}/g, escapeHtml(parentWarningThresholdSource));
        htmlContent = htmlContent.replace(/{{parentDangerThresholdSource}}/g, escapeHtml(parentDangerThresholdSource));
        htmlContent = htmlContent.replace(/{{parentWarningThreshold}}/g, parentWarningThreshold);
        htmlContent = htmlContent.replace(/{{parentDangerThreshold}}/g, parentDangerThreshold);
        
        // Workspace settings placeholders
        const workspaceSettingsHtml = generateWorkspaceSettingsHtml(workspaceData);
        
        // Check if workspace is available (separate from whether it has existing settings)
        const hasWorkspace = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0;
        
        let createWorkspaceButtonHtml = '';
        if (!workspaceData || !workspaceData.directoryTree || workspaceData.directoryTree.length === 0) {
            createWorkspaceButtonHtml = `
                <div class="create-workspace-container">
                    <p>No workspace settings found. Create initial workspace configuration:</p>
                    <button onclick="createWorkspaceSettings()" class="create-workspace-btn">Create Workspace Settings</button>
                </div>
            `;
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
        
        debug.error('Error loading emoji picker template:', error);
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
 * Generate workspace settings HTML
 */
export function generateWorkspaceSettingsHtml(workspaceData: any): string {
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

/**
 * Generate directory tree HTML
 */
export function generateDirectoryTreeHtml(directories: any[], currentDirectory: string, level: number = 1): string {
    if (!directories || directories.length === 0) return '';
    
    // Sort directories: those with settings first, then alphabetically
    const sortedDirectories = [...directories].sort((a, b) => {
        if (a.hasSettings && !b.hasSettings) return -1;
        if (!a.hasSettings && b.hasSettings) return 1;
        return a.name.localeCompare(b.name);
    });
    
    return sortedDirectories.map(dir => {
        // Skip any malformed directory entries
        if (!dir.name || dir.name.trim() === '' || dir.name === '<subworkspace>') {
            return '';
        }
        
        const isSelected = currentDirectory === dir.relativePath;
        const hasSettingsClass = dir.hasSettings ? 'has-settings' : '';
        const selectedClass = isSelected ? 'selected' : '';
        
        // Visual indicators
        const settingsIndicator = dir.hasSettings ? ' ⚙️' : '';
        const isHidden = dir.name.startsWith('.');
        const folderIcon = dir.hasSettings ? '📁' : (isHidden ? '🫣' : '📁');
        const hiddenClass = isHidden ? 'hidden-directory' : '';
        
        // Recursively generate children HTML
        const childrenHtml = dir.children && dir.children.length > 0 ? 
            generateDirectoryTreeHtml(dir.children, currentDirectory, level + 1) : '';
        
        // Escape directory name and path for safe HTML
        const safeName = escapeHtml(dir.name);
        const safePath = escapeHtml(dir.relativePath.replace(/\\/g, '/'));
        
        return `
            <div class="directory-container">
                <div class="directory-item ${selectedClass} ${hasSettingsClass} ${hiddenClass}" 
                     style="margin-left: ${level * 15}px"
                     onclick="selectDirectory('${safePath}')">
                    <span class="directory-icon">${folderIcon}</span>
                    <span class="directory-name">${safeName}</span>
                    <span class="settings-indicator">${settingsIndicator}</span>
                </div>
                ${childrenHtml}
            </div>
        `;
    }).filter(html => html.trim() !== '').join('');
}