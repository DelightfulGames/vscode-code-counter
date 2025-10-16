import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CountLinesCommand } from './commands/countLines';
import { FileWatcherProvider } from './providers/fileWatcher';
import { FileExplorerDecorationProvider } from './providers/fileExplorerDecorator';
import { EditorTabDecorationProvider } from './providers/editorTabDecorator';
import { WebViewReportService } from './services/webViewReportService';

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
            '**/dist/**',
            '**/.git/**'
        ])
    };
}

async function showEmojiPicker(fileExplorerDecorator: FileExplorerDecorationProvider): Promise<void> {
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

    // HTML content with emoji picker
    panel.webview.html = getEmojiPickerWebviewContent(badges, folderBadges, thresholds, excludePatterns);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
        async (message) => {
            switch (message.command) {
                case 'updateEmoji':
                    // Map emoji keys to configuration paths
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
                        panel.webview.html = getEmojiPickerWebviewContent(updatedConfiguration.badges, updatedConfiguration.folderBadges, updatedConfiguration.thresholds, updatedConfiguration.excludePatterns);
                    }
                    break;
                case 'updateThreshold':
                    const thresholdConfig = vscode.workspace.getConfiguration('codeCounter');
                    await thresholdConfig.update(`lineThresholds.${message.thresholdKey}Threshold`, message.value, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage(`Updated ${message.thresholdKey} threshold to ${message.value} lines`);
                    
                    // Refresh the WebView to show updated preview values
                    const updatedConfigurationThreshold = getCurrentConfiguration();
                    panel.webview.html = getEmojiPickerWebviewContent(updatedConfigurationThreshold.badges, updatedConfigurationThreshold.folderBadges, updatedConfigurationThreshold.thresholds, updatedConfigurationThreshold.excludePatterns);
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
                        '**/dist/**',
                        '**/.git/**'
                    ];
                    await resetConfig.update('excludePatterns', defaultPatterns, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage('Exclude patterns reset to defaults');
                    
                    // Trigger full refresh of all decorations (configuration watcher will handle cache clearing)
                    fileExplorerDecorator.refresh();
                    
                    // Refresh the WebView to show the reset patterns
                    const updatedConfiguration3 = getCurrentConfiguration();
                    panel.webview.html = getEmojiPickerWebviewContent(updatedConfiguration3.badges, updatedConfiguration3.folderBadges, updatedConfiguration3.thresholds, updatedConfiguration3.excludePatterns);
                    break;
                case 'resetColors':
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
            }
        },
        undefined
    );
}

function getEmojiPickerWebviewContent(badges: any, folderBadges: any, thresholds: any, excludePatterns: string[] = []): string {
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

        //Load the JavaScript content and JSON data
        const scriptPath = path.join(__dirname, '..', 'templates', 'emoji-picker.js');
        const emojiDataPath = path.join(__dirname, '..', 'templates', 'emoji-data.json');
        const emojiSearchDataPath = path.join(__dirname, '..', 'templates', 'emoji-search-data.json');
        
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        const emojiData = fs.readFileSync(emojiDataPath, 'utf8');
        const emojiSearchData = fs.readFileSync(emojiSearchDataPath, 'utf8');
        
        // Prepend the JSON data to the script content
        const fullScriptContent = `
            // Embedded emoji data
            window.emojiData = ${emojiData};
            window.emojiSearchData = ${emojiSearchData};
            
            ${scriptContent}
        `;
        
        htmlContent = htmlContent.replace(/{{badges\.low}}/g, badges.low);
        htmlContent = htmlContent.replace(/{{badges\.medium}}/g, badges.medium);
        htmlContent = htmlContent.replace(/{{badges\.high}}/g, badges.high);
        htmlContent = htmlContent.replace(/{{folderBadges\.low}}/g, folderBadges.low);
        htmlContent = htmlContent.replace(/{{folderBadges\.medium}}/g, folderBadges.medium);
        htmlContent = htmlContent.replace(/{{folderBadges\.high}}/g, folderBadges.high);
        htmlContent = htmlContent.replace(/{{thresholds\.mid}}/g, thresholds.mid.toString());
        htmlContent = htmlContent.replace(/{{thresholds\.high}}/g, thresholds.high.toString());
        htmlContent = htmlContent.replace(/{{lowPreviewLines}}/g, lowPreviewLines.toString());
        htmlContent = htmlContent.replace(/{{mediumPreviewLines}}/g, mediumPreviewLines.toString());
        htmlContent = htmlContent.replace(/{{highPreviewLines}}/g, highPreviewLines.toString());
        htmlContent = htmlContent.replace(/{{lowFolderAvg}}/g, lowFolderAvg.toString());
        htmlContent = htmlContent.replace(/{{mediumFolderAvg}}/g, mediumFolderAvg.toString());
        htmlContent = htmlContent.replace(/{{highFolderAvg}}/g, highFolderAvg.toString());
        htmlContent = htmlContent.replace(/{{highFolderMax}}/g, highFolderMax.toString());
        htmlContent = htmlContent.replace(/{{excludePatterns}}/g, excludePatternsHtml);
        htmlContent = htmlContent.replace(/{{showNotificationChecked}}/g, showNotificationChecked);
        htmlContent = htmlContent.replace(/{{scriptContent}}/g, fullScriptContent);
        
        return htmlContent;
        
    } catch (error) {
        console.error('Error loading emoji picker template:', error);
        return `<!DOCTYPE html>
            <html>
            <head><title>Code Counter Settings</title></head>
            <body>
                <h1>Error Loading Settings</h1>
                <p>Could not load template: ${error}</p>
            </body>
            </html>`;
    }
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
        await showEmojiPicker(fileExplorerDecorator);
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