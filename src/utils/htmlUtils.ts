/**
 * HTML utility functions for VS Code Code Counter Extension webview
 */

import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { DirectoryNode, WorkspaceData } from '../services/workspaceSettingsService';
import { getCurrentConfiguration, getNotificationAndOutputSettings } from './configurationUtils';

/**
 * Escape HTML characters to prevent XSS attacks
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
 * Generate HTML for workspace directory tree
 */
export function generateDirectoryTreeHtml(directories: DirectoryNode[], currentDirectory: string, level: number = 1): string {
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

/**
 * Generate HTML for workspace settings section
 */
export function generateWorkspaceSettingsHtml(workspaceData: WorkspaceData | undefined): string {
    if (!workspaceData) {
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
    }
    
    const directoryTreeHtml = generateDirectoryTreeHtml(workspaceData.directoryTree || [], workspaceData.currentDirectory);
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
 * Generate patterns HTML with inheritance information
 */
export function generatePatternsHtml(
    workspaceData: WorkspaceData | undefined, 
    patternType: 'exclude' | 'include'
): string {
    let patternsHtml = '';
    
    if (workspaceData && workspaceData.mode === 'workspace' && workspaceData.resolvedSettings) {
        const patternsWithSources = patternType === 'exclude' ? 
            workspaceData.patternsWithSources : 
            workspaceData.includePatternsWithSources;
            
        if (patternsWithSources && patternsWithSources.length > 0) {
            const currentSettings = workspaceData.currentSettings?.[`codeCounter.${patternType}Patterns`] || [];
            const hasLocalPatterns = workspaceData.currentSettings?.[`codeCounter.${patternType}Patterns`] !== undefined;
            
            const patternItems = patternsWithSources.map((item) => {
                const isLocal = currentSettings.includes(item.pattern);
                const sourceText = item.source === 'local' ? 'Local' : 
                                 item.source === 'inherited' ? 'Inherited' : 
                                 item.source;
                const sourceClass = item.source === 'local' ? 'source-local' : 'source-inherited';
                const removeButton = hasLocalPatterns && isLocal ? 
                    `<button class="remove-pattern" onclick="remove${patternType.charAt(0).toUpperCase() + patternType.slice(1)}GlobPattern('${escapeHtml(item.pattern)}')">✕</button>` : 
                    '';
                
                return `
                    <div class="pattern-item ${sourceClass}">
                        <span class="pattern-text">${escapeHtml(item.pattern)}</span>
                        <span class="pattern-source">${sourceText}</span>
                        ${removeButton}
                    </div>
                `;
            });
            
            patternsHtml = patternItems.join('');
        } else {
            patternsHtml = `<div class="pattern-item no-patterns">No ${patternType} patterns configured</div>`;
        }
    } else {
        // Global mode - simple list
        const config = getCurrentConfiguration();
        const patterns = patternType === 'exclude' ? config.excludePatterns : [];
        
        patternsHtml = patterns.map(pattern => 
            `<div class="pattern-item global-pattern">
                <span class="pattern-text">${escapeHtml(pattern)}</span>
                <span class="pattern-source">Global</span>
                <button class="remove-pattern" onclick="remove${patternType.charAt(0).toUpperCase() + patternType.slice(1)}GlobPattern('${escapeHtml(pattern)}')">✕</button>
            </div>`
        ).join('') || `<div class="pattern-item no-patterns">No ${patternType} patterns configured</div>`;
    }
    
    return patternsHtml;
}

/**
 * Load template files and embedded data for webview
 */
export function loadWebviewAssets(webview?: vscode.Webview): {
    htmlContent: string;
    scriptContent: string;
    cssContent: string;
    embeddedData: {
        emojiData: any;
        emojiSearchData: any;
        workspaceData: any;
    };
    useInlineScript: boolean;
} {
    const templatePath = path.join(__dirname, '..', '..', 'templates', 'emoji-picker.html');
    const scriptPath = path.join(__dirname, '..', '..', 'templates', 'emoji-picker.js');
    const cssPath = path.join(__dirname, '..', '..', 'templates', 'emoji-picker.css');
    const emojiDataPath = path.join(__dirname, '..', '..', 'templates', 'emoji-data.json');
    const emojiSearchDataPath = path.join(__dirname, '..', '..', 'templates', 'emoji-search-data.json');
    
    const htmlContent = fs.readFileSync(templatePath, 'utf8');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    const emojiData = fs.readFileSync(emojiDataPath, 'utf8');
    const emojiSearchData = fs.readFileSync(emojiSearchDataPath, 'utf8');
    
    // Create webview URIs for the JavaScript and CSS files
    const scriptUri = webview ? webview.asWebviewUri(vscode.Uri.file(scriptPath)) : null;
    const useInlineScript = !webview || !scriptUri;
    
    // Cleanup metadata entries from emoji search data
    let emojiDB = JSON.parse(emojiData);
    let emojiSearchDB = JSON.parse(emojiSearchData);
    
    Object.keys(emojiSearchDB).forEach(key => {
        if (key.startsWith('_') || key === 'metadata') {
            delete emojiSearchDB[key];
        }
    });

    Object.keys(emojiDB).forEach(key => {
        if (key.startsWith('_') || key === 'metadata') {
            delete emojiDB[key];
        }
    });

    const embeddedData = {
        emojiData: emojiDB,
        emojiSearchData: emojiSearchDB,
        workspaceData: null // Will be set by caller
    };
    
    return {
        htmlContent,
        scriptContent,
        cssContent,
        embeddedData,
        useInlineScript
    };
}