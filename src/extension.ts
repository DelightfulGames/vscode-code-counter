import * as vscode from 'vscode';
import { CountLinesCommand } from './commands/countLines';
import { FileWatcherProvider } from './providers/fileWatcher';
import { FileExplorerDecorationProvider } from './providers/fileExplorerDecorator';
import { EditorTabDecorationProvider } from './providers/editorTabDecorator';

function getCurrentConfiguration() {
    const config = vscode.workspace.getConfiguration('codeCounter');
    const emojiConfig = vscode.workspace.getConfiguration('codeCounter.emojis');
    
    return {
        badges: {
            low: emojiConfig.get('normal', '🟢'),
            medium: emojiConfig.get('warning', '🟡'), 
            high: emojiConfig.get('danger', '🔴')
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

async function showEmojiPicker(): Promise<void> {
    const { badges: badges, thresholds, excludePatterns } = getCurrentConfiguration();

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
    panel.webview.html = getEmojiPickerWebviewContent(badges, thresholds, excludePatterns);

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
                        const emojiConfig = vscode.workspace.getConfiguration('codeCounter.emojis');
                        await emojiConfig.update(configKey, message.emoji, vscode.ConfigurationTarget.Global);
                        vscode.window.showInformationMessage(`Updated ${configKey} emoji to ${message.emoji}`);
                    }
                    break;
                case 'updateThreshold':
                    const thresholdConfig = vscode.workspace.getConfiguration('codeCounter');
                    await thresholdConfig.update(`lineThresholds.${message.thresholdKey}Threshold`, message.value, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage(`Updated ${message.thresholdKey} threshold to ${message.value} lines`);
                    break;
                case 'addGlobPattern':
                    const patternConfig = vscode.workspace.getConfiguration('codeCounter');
                    const currentPatterns = patternConfig.get<string[]>('excludePatterns', []);
                    if (message.pattern && !currentPatterns.includes(message.pattern)) {
                        const updatedPatterns = [...currentPatterns, message.pattern];
                        await patternConfig.update('excludePatterns', updatedPatterns, vscode.ConfigurationTarget.Global);
                        vscode.window.showInformationMessage(`Added exclude pattern: ${message.pattern}`);
                        
                        // Refresh the WebView to show the updated patterns
                        const updatedConfiguration = getCurrentConfiguration();
                        panel.webview.html = getEmojiPickerWebviewContent(updatedConfiguration.badges, updatedConfiguration.thresholds, updatedConfiguration.excludePatterns);
                    }
                    break;
                case 'removeGlobPattern':
                    const removeConfig = vscode.workspace.getConfiguration('codeCounter');
                    const currentPatterns2 = removeConfig.get<string[]>('excludePatterns', []);
                    const filteredPatterns = currentPatterns2.filter((p: string) => p !== message.pattern);
                    await removeConfig.update('excludePatterns', filteredPatterns, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage(`Removed exclude pattern: ${message.pattern}`);
                    
                    // Refresh the WebView to show the updated patterns
                    const updatedConfiguration2 = getCurrentConfiguration();
                    panel.webview.html = getEmojiPickerWebviewContent(updatedConfiguration2.badges, updatedConfiguration2.thresholds, updatedConfiguration2.excludePatterns);
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
                    
                    // Refresh the WebView to show the reset patterns
                    const updatedConfiguration3 = getCurrentConfiguration();
                    panel.webview.html = getEmojiPickerWebviewContent(updatedConfiguration3.badges, updatedConfiguration3.thresholds, updatedConfiguration3.excludePatterns);
                    break;
                case 'resetColors':
                    const emojiConfig = vscode.workspace.getConfiguration('codeCounter.emojis');
                    await emojiConfig.update('normal', '🟢', vscode.ConfigurationTarget.Global);
                    await emojiConfig.update('warning', '🟡', vscode.ConfigurationTarget.Global);
                    await emojiConfig.update('danger', '🔴', vscode.ConfigurationTarget.Global);
                    
                    const thresholdResetConfig = vscode.workspace.getConfiguration('codeCounter');
                    const defaultThresholds = {
                        mid: 300,
                        high: 1000
                    };
                    await thresholdResetConfig.update('lineThresholds.midThreshold', defaultThresholds.mid, vscode.ConfigurationTarget.Global);
                    await thresholdResetConfig.update('lineThresholds.highThreshold', defaultThresholds.high, vscode.ConfigurationTarget.Global);
                    
                    // Refresh the WebView with reset values
                    const updatedConfiguration4 = getCurrentConfiguration();
                    panel.webview.html = getEmojiPickerWebviewContent(updatedConfiguration4.badges, updatedConfiguration4.thresholds, updatedConfiguration4.excludePatterns);
                    vscode.window.showInformationMessage('Emoji indicators and thresholds reset to defaults');
                    break;
            }
        },
        undefined
    );
}

function getEmojiPickerWebviewContent(badges: any, thresholds: any, excludePatterns: string[] = []): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Code Counter Emoji Settings</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                background: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                padding: 20px;
                margin: 0;
            }
            .color-section {
                margin: 20px 0;
                padding: 15px;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 5px;
            }
            .emoji-picker-container {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin: 10px 0;
            }
            .current-emoji-display {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 10px;
            }
            .current-emoji {
                width: 60px;
                height: 60px;
                background: var(--vscode-input-background);
                border: 2px solid var(--vscode-input-border);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 32px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .current-emoji:hover {
                border-color: var(--vscode-focusBorder);
                transform: scale(1.05);
            }
            .emoji-picker-modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 1000;
                align-items: center;
                justify-content: center;
            }
            .emoji-picker-modal.show {
                display: flex;
            }
            .emoji-picker {
                background: var(--vscode-editor-background);
                border: 2px solid var(--vscode-panel-border);
                border-radius: 8px;
                width: 90%;
                max-width: 500px;
                max-height: 80%;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .emoji-picker-header {
                padding: 15px;
                border-bottom: 1px solid var(--vscode-panel-border);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .emoji-search-container {
                padding: 15px;
                border-bottom: 1px solid var(--vscode-panel-border);
                background: var(--vscode-input-background);
            }
            .emoji-search-input {
                width: 100%;
                padding: 10px;
                background: var(--vscode-input-background);
                border: 1px solid var(--vscode-input-border);
                border-radius: 4px;
                color: var(--vscode-input-foreground);
                font-size: 14px;
                box-sizing: border-box;
            }
            .emoji-search-input:focus {
                outline: none;
                border-color: var(--vscode-focusBorder);
            }
            .search-results-info {
                padding: 8px 15px;
                background: var(--vscode-textBlockQuote-background);
                border-bottom: 1px solid var(--vscode-panel-border);
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
                display: none;
            }
            .emoji-picker-close {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 8px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 18px;
            }
            .emoji-picker-close:hover {
                background: var(--vscode-button-hoverBackground);
            }
            .emoji-categories {
                display: flex;
                background: var(--vscode-tab-inactiveBackground);
                border-bottom: 1px solid var(--vscode-panel-border);
                overflow-x: auto;
                scrollbar-width: thin;
            }
            .category-tab {
                padding: 10px 15px;
                cursor: pointer;
                border: none;
                background: transparent;
                color: var(--vscode-tab-inactiveForeground);
                font-size: 16px;
                white-space: nowrap;
                border-bottom: 3px solid transparent;
                transition: all 0.2s ease;
            }
            .category-tab:hover {
                background: var(--vscode-tab-hoverBackground);
            }
            .category-tab.active {
                color: var(--vscode-tab-activeForeground);
                background: var(--vscode-tab-activeBackground);
                border-bottom-color: var(--vscode-tab-activeBorder);
            }
            .emoji-grid-container {
                flex: 1;
                overflow-y: auto;
                padding: 15px;
                max-height: 300px;
            }
            .emoji-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
                gap: 8px;
                justify-items: center;
            }
            .emoji-item {
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                border-radius: 6px;
                font-size: 24px;
                transition: all 0.2s ease;
                border: 2px solid transparent;
            }
            .emoji-item:hover {
                background: var(--vscode-list-hoverBackground);
                transform: scale(1.1);
                border-color: var(--vscode-focusBorder);
            }
            .emoji-item.selected {
                background: var(--vscode-list-activeSelectionBackground);
                border-color: var(--vscode-list-activeSelectionForeground);
            }
            .threshold-container {
                display: flex;
                align-items: center;
                gap: 10px;
                margin: 5px 0;
            }
            .threshold-input {
                width: 80px;
                padding: 5px;
                background: var(--vscode-input-background);
                border: 1px solid var(--vscode-input-border);
                border-radius: 3px;
                color: var(--vscode-input-foreground);
            }
            button {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 8px 16px;
                border-radius: 3px;
                cursor: pointer;
                margin: 10px 5px 0 0;
            }
            button:hover {
                background: var(--vscode-button-hoverBackground);
            }
            .preview {
                margin-top: 10px;
                padding: 5px 10px;
                border-radius: 3px;
                background: var(--vscode-textCodeBlock-background);
                border: 1px solid var(--vscode-input-border);
                font-weight: bold;
                font-family: monospace;
            }
            .glob-patterns-container {
                margin: 10px 0;
                max-height: 200px;
                overflow-y: auto;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 3px;
                padding: 5px;
            }
            .glob-pattern-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin: 5px 0;
                padding: 5px 10px;
                background: var(--vscode-input-background);
                border-radius: 3px;
            }
            .glob-pattern-item code {
                font-family: var(--vscode-editor-font-family);
                background: transparent;
                color: var(--vscode-textCodeBlock-foreground);
                flex: 1;
            }
            .remove-btn {
                background: var(--vscode-inputValidation-errorBackground);
                color: var(--vscode-inputValidation-errorForeground);
                border: none;
                padding: 2px 6px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 12px;
                margin: 0 0 0 10px;
            }
            .remove-btn:hover {
                opacity: 0.8;
            }
            .add-pattern-container {
                display: flex;
                gap: 10px;
                margin: 10px 0;
                align-items: center;
            }
            .add-pattern-container input {
                flex: 1;
                padding: 8px;
                background: var(--vscode-input-background);
                border: 1px solid var(--vscode-input-border);
                border-radius: 3px;
                color: var(--vscode-input-foreground);
                font-family: var(--vscode-editor-font-family);
            }
            .pattern-examples {
                margin: 15px 0;
                font-size: 14px;
            }
            .pattern-examples details {
                background: var(--vscode-textBlockQuote-background);
                border-left: 4px solid var(--vscode-textBlockQuote-border);
                padding: 10px;
                border-radius: 3px;
            }
            .pattern-examples summary {
                cursor: pointer;
                font-weight: bold;
                margin-bottom: 10px;
            }
            .pattern-examples ul {
                margin: 10px 0 0 20px;
            }
            .pattern-examples li {
                margin: 5px 0;
            }
            .pattern-examples code {
                background: var(--vscode-textCodeBlock-background);
                padding: 2px 4px;
                border-radius: 2px;
                font-family: var(--vscode-editor-font-family);
                color: var(--vscode-textCodeBlock-foreground);
            }
        </style>
    </head>
    <body>
        <h1>🎨 Code Counter Emoji Settings</h1>
        
        <div class="color-section">
            <h3>${badges.low} Low Line Count</h3>
            <div class="emoji-picker-container">
                <label>Emoji: </label>
                <div class="current-emoji-display">
                    <div class="current-emoji" data-color-key="low" onclick="openEmojiPicker('low')">${badges.low}</div>
                    <small>Click to change emoji</small>
                </div>
            </div>
            <div class="threshold-container">
                <label>Less than: </label>
                <input type="number" class="threshold-input" id="midThreshold" value="${thresholds.mid}" min="1" max="9999" />
                <span>lines</span>
            </div>
            <div class="preview" id="lowPreview">${badges.low} Lines: ${Math.floor(thresholds.mid / 2)}</div>
        </div>

        <div class="color-section">
            <h3>${badges.medium} Medium Line Count</h3>
            <div class="emoji-picker-container">
                <label>Emoji: </label>
                <div class="current-emoji-display">
                    <div class="current-emoji" data-color-key="medium" onclick="openEmojiPicker('medium')">${badges.medium}</div>
                    <small>Click to change emoji</small>
                </div>
            </div>
            <div class="threshold-container">
                <label>Less than: </label>
                <input type="number" class="threshold-input" id="highThreshold" value="${thresholds.high}" min="1" max="9999" />
                <span>lines</span>
            </div>
            <div class="preview" id="mediumPreview">${badges.medium} Lines: ${Math.floor((thresholds.mid + thresholds.high) / 2)}</div>
        </div>

        <div class="color-section">
            <h3>${badges.high} High Line Count</h3>
            <div class="emoji-picker-container">
                <label>Emoji: </label>
                <div class="current-emoji-display">
                    <div class="current-emoji" data-color-key="high" onclick="openEmojiPicker('high')">${badges.high}</div>
                    <small>Click to change emoji</small>
                </div>
            </div>
            <div class="threshold-container">
                <label>Greater than or equal to: <strong>${thresholds.high}</strong> lines</label>
            </div>
            <div class="preview" id="highPreview">${badges.high} Lines: ${thresholds.high + 500}</div>
        </div>

        <!-- Emoji Picker Modal -->
        <div class="emoji-picker-modal" id="emojiModal">
            <div class="emoji-picker">
                <div class="emoji-picker-header">
                    <h3>Select Emoji</h3>
                    <button class="emoji-picker-close" onclick="closeEmojiPicker()">✕</button>
                </div>
                <div class="emoji-search-container">
                    <input type="text" class="emoji-search-input" id="emojiSearch" placeholder="Search emojis... (e.g., 'smile', 'heart', 'red circle')" />
                </div>
                <div class="search-results-info" id="searchResultsInfo"></div>
                <div class="emoji-categories">
                    <button class="category-tab active" data-category="all" onclick="switchCategory('all')">All</button>
                    <button class="category-tab" data-category="smileys" onclick="switchCategory('smileys')">😀 Smileys</button>
                    <button class="category-tab" data-category="nature" onclick="switchCategory('nature')">🌱 Nature</button>
                    <button class="category-tab" data-category="food" onclick="switchCategory('food')">🍎 Food</button>
                    <button class="category-tab" data-category="activities" onclick="switchCategory('activities')">⚽ Activities</button>
                    <button class="category-tab" data-category="travel" onclick="switchCategory('travel')">🚗 Travel</button>
                    <button class="category-tab" data-category="objects" onclick="switchCategory('objects')">💡 Objects</button>
                    <button class="category-tab" data-category="symbols" onclick="switchCategory('symbols')">🔴 Symbols</button>
                    <button class="category-tab" data-category="flags" onclick="switchCategory('flags')">🏁 Flags</button>
                </div>
                <div class="emoji-grid-container">
                    <div class="emoji-grid" id="emojiGrid"></div>
                </div>
            </div>
        </div>

        <div class="color-section">
            <h3>📁 Exclude Patterns</h3>
            <p>Glob patterns for files to exclude from line counting:</p>
            <div class="glob-patterns-container">
                ${excludePatterns.map((pattern, index) => `
                    <div class="glob-pattern-item" data-pattern="${pattern}">
                        <code>${pattern}</code>
                        <button onclick="removePattern('${pattern}')" class="remove-btn">❌</button>
                    </div>
                `).join('')}
            </div>
            <div class="add-pattern-container">
                <input type="text" id="newPattern" placeholder="Enter glob pattern (e.g., **/*.tmp)" />
                <button onclick="addPattern()">➕ Add Pattern</button>
            </div>
            <div class="pattern-examples">
                <details>
                    <summary>📖 Pattern Examples</summary>
                    <ul>
                        <li><code>**/node_modules/**</code> - Exclude all node_modules folders</li>
                        <li><code>**/*.tmp</code> - Exclude all .tmp files</li>
                        <li><code>**/dist/**</code> - Exclude all dist folders</li>
                        <li><code>**/.git/**</code> - Exclude all .git folders</li>
                        <li><code>**/test/**</code> - Exclude all test folders</li>
                        <li><code>**/*.min.js</code> - Exclude minified JS files</li>
                    </ul>
                </details>
            </div>
            <button onclick="resetPatterns()">🔄 Reset Patterns to Defaults</button>
        </div>

        <button onclick="resetEmojis()">🔄 Reset Emojis to Defaults</button>

        <script>
            const vscode = acquireVsCodeApi();

            // Comprehensive emoji data with names and aliases for searching
            const emojiDatabase = {
                '😀': { name: 'grinning face', aliases: ['grinning', 'happy', 'smile', 'joy'], category: 'smileys' },
                '😃': { name: 'grinning face with big eyes', aliases: ['smiley', 'happy', 'joy', 'haha'], category: 'smileys' },
                '😄': { name: 'grinning face with smiling eyes', aliases: ['smile', 'happy', 'joy', 'laugh', 'pleased'], category: 'smileys' },
                '😁': { name: 'beaming face with smiling eyes', aliases: ['grin', 'happy', 'smile', 'joy', 'kawaii'], category: 'smileys' },
                '😆': { name: 'grinning squinting face', aliases: ['satisfied', 'laugh', 'happy', 'haha', 'joy'], category: 'smileys' },
                '😅': { name: 'grinning face with sweat', aliases: ['sweat_smile', 'hot', 'happy', 'laugh', 'relief'], category: 'smileys' },
                '🤣': { name: 'rolling on the floor laughing', aliases: ['rofl', 'lol', 'laughing', 'funny', 'haha'], category: 'smileys' },
                '😂': { name: 'face with tears of joy', aliases: ['joy', 'tears', 'weary', 'happy', 'funny', 'haha'], category: 'smileys' },
                '🙂': { name: 'slightly smiling face', aliases: ['slight_smile', 'happy'], category: 'smileys' },
                '🙃': { name: 'upside down face', aliases: ['upside_down', 'flipped', 'silly'], category: 'smileys' },
                '😉': { name: 'winking face', aliases: ['wink', 'flirt', 'sexy', 'girl'], category: 'smileys' },
                '😊': { name: 'smiling face with smiling eyes', aliases: ['blush', 'massage', 'happiness'], category: 'smileys' },
                '😇': { name: 'smiling face with halo', aliases: ['angel', 'innocent'], category: 'smileys' },
                '🥰': { name: 'smiling face with hearts', aliases: ['love', 'crush', 'hearts', 'adore'], category: 'smileys' },
                '😍': { name: 'smiling face with heart eyes', aliases: ['heart_eyes', 'love', 'crush', 'attractive'], category: 'smileys' },
                '🤩': { name: 'star struck', aliases: ['starstruck', 'eyes', 'grinning'], category: 'smileys' },
                '😘': { name: 'face blowing a kiss', aliases: ['kissing_heart', 'flirt'], category: 'smileys' },
                '😗': { name: 'kissing face', aliases: ['kissing'], category: 'smileys' },
                '☺️': { name: 'smiling face', aliases: ['relaxed', 'blush', 'pleased'], category: 'smileys' },
                '😚': { name: 'kissing face with closed eyes', aliases: ['kissing_closed_eyes'], category: 'smileys' },
                '😙': { name: 'kissing face with smiling eyes', aliases: ['kissing_smiling_eyes'], category: 'smileys' },
                '🥲': { name: 'smiling face with tear', aliases: ['happy_cry', 'touched'], category: 'smileys' },
                '😋': { name: 'face savoring food', aliases: ['yum', 'tongue', 'lick'], category: 'smileys' },
                '😛': { name: 'face with tongue', aliases: ['stuck_out_tongue'], category: 'smileys' },
                '😜': { name: 'winking face with tongue', aliases: ['stuck_out_tongue_winking_eye', 'prank', 'silly'], category: 'smileys' },
                '🤪': { name: 'zany face', aliases: ['goofy', 'wacky'], category: 'smileys' },
                '😝': { name: 'squinting face with tongue', aliases: ['stuck_out_tongue_closed_eyes', 'prank'], category: 'smileys' },
                '🤑': { name: 'money mouth face', aliases: ['money_mouth', 'rich'], category: 'smileys' },
                '🤗': { name: 'hugging face', aliases: ['hugging'], category: 'smileys' },
                '🤭': { name: 'face with hand over mouth', aliases: ['hand_over_mouth', 'quiet', 'whoops'], category: 'smileys' },
                '🤫': { name: 'shushing face', aliases: ['shush', 'quiet', 'silence'], category: 'smileys' },
                '🤔': { name: 'thinking face', aliases: ['thinking', 'hmm'], category: 'smileys' },
                '🤐': { name: 'zipper mouth face', aliases: ['zipper_mouth', 'silence', 'hush'], category: 'smileys' },
                '🤨': { name: 'face with raised eyebrow', aliases: ['raised_eyebrow', 'suspicious'], category: 'smileys' },
                '😐': { name: 'neutral face', aliases: ['neutral'], category: 'smileys' },
                '😑': { name: 'expressionless face', aliases: ['expressionless'], category: 'smileys' },
                '😶': { name: 'face without mouth', aliases: ['no_mouth', 'mute', 'silence'], category: 'smileys' },
                '😏': { name: 'smirking face', aliases: ['smirk'], category: 'smileys' },
                '😒': { name: 'unamused face', aliases: ['unamused', 'meh'], category: 'smileys' },
                '🙄': { name: 'face with rolling eyes', aliases: ['eye_roll', 'eyes'], category: 'smileys' },
                '😬': { name: 'grimacing face', aliases: ['grimacing'], category: 'smileys' },
                '🤥': { name: 'lying face', aliases: ['liar'], category: 'smileys' },
                '😌': { name: 'relieved face', aliases: ['relieved'], category: 'smileys' },
                '😔': { name: 'pensive face', aliases: ['pensive'], category: 'smileys' },
                '😪': { name: 'sleepy face', aliases: ['sleepy', 'tired'], category: 'smileys' },
                '🤤': { name: 'drooling face', aliases: ['drool'], category: 'smileys' },
                '😴': { name: 'sleeping face', aliases: ['sleeping'], category: 'smileys' },
                '😷': { name: 'face with medical mask', aliases: ['mask', 'sick', 'ill'], category: 'smileys' },
                '🤒': { name: 'face with thermometer', aliases: ['thermometer_face', 'sick'], category: 'smileys' },
                '🤕': { name: 'face with head bandage', aliases: ['head_bandage', 'hurt'], category: 'smileys' },
                '🤢': { name: 'nauseated face', aliases: ['nauseated', 'sick'], category: 'smileys' },
                '🤮': { name: 'face vomiting', aliases: ['vomit', 'sick'], category: 'smileys' },
                '🤧': { name: 'sneezing face', aliases: ['sneezing'], category: 'smileys' },
                '🥵': { name: 'hot face', aliases: ['hot', 'heat', 'sweating'], category: 'smileys' },
                '🥶': { name: 'cold face', aliases: ['cold', 'freezing'], category: 'smileys' },
                '🥴': { name: 'woozy face', aliases: ['woozy', 'tipsy'], category: 'smileys' },
                '😵': { name: 'knocked out face', aliases: ['dizzy_face'], category: 'smileys' },
                '🤯': { name: 'exploding head', aliases: ['exploding_head', 'mind_blown'], category: 'smileys' },
                '🤠': { name: 'cowboy hat face', aliases: ['cowboy'], category: 'smileys' },
                '🥳': { name: 'partying face', aliases: ['partying', 'celebration'], category: 'smileys' },
                '🥸': { name: 'disguised face', aliases: ['disguise'], category: 'smileys' },
                '😎': { name: 'smiling face with sunglasses', aliases: ['sunglasses', 'cool'], category: 'smileys' },
                '🤓': { name: 'nerd face', aliases: ['nerd'], category: 'smileys' },
                '🧐': { name: 'face with monocle', aliases: ['monocle'], category: 'smileys' },
                
                // Common symbols and objects
                '🔴': { name: 'red circle', aliases: ['red', 'circle', 'dot'], category: 'symbols' },
                '🟠': { name: 'orange circle', aliases: ['orange', 'circle', 'dot'], category: 'symbols' },
                '🟡': { name: 'yellow circle', aliases: ['yellow', 'circle', 'dot'], category: 'symbols' },
                '🟢': { name: 'green circle', aliases: ['green', 'circle', 'dot'], category: 'symbols' },
                '🔵': { name: 'blue circle', aliases: ['blue', 'circle', 'dot'], category: 'symbols' },
                '🟣': { name: 'purple circle', aliases: ['purple', 'circle', 'dot'], category: 'symbols' },
                '⚫': { name: 'black circle', aliases: ['black', 'circle', 'dot'], category: 'symbols' },
                '⚪': { name: 'white circle', aliases: ['white', 'circle', 'dot'], category: 'symbols' },
                '🟤': { name: 'brown circle', aliases: ['brown', 'circle', 'dot'], category: 'symbols' },
                '💡': { name: 'light bulb', aliases: ['bulb', 'idea', 'light'], category: 'objects' },
                '🔥': { name: 'fire', aliases: ['flame', 'hot', 'burn'], category: 'symbols' },
                '⭐': { name: 'star', aliases: ['star'], category: 'symbols' },
                '🌟': { name: 'glowing star', aliases: ['star2'], category: 'symbols' },
                '✨': { name: 'sparkles', aliases: ['sparkles'], category: 'symbols' },
                '⚡': { name: 'high voltage', aliases: ['zap'], category: 'symbols' },
                '❤️': { name: 'red heart', aliases: ['heart', 'love'], category: 'symbols' },
                '💚': { name: 'green heart', aliases: ['green_heart'], category: 'symbols' },
                '💛': { name: 'yellow heart', aliases: ['yellow_heart'], category: 'symbols' },
                '💙': { name: 'blue heart', aliases: ['blue_heart'], category: 'symbols' },
                '💜': { name: 'purple heart', aliases: ['purple_heart'], category: 'symbols' },
                '🖤': { name: 'black heart', aliases: ['black_heart'], category: 'symbols' },
                '🤍': { name: 'white heart', aliases: ['white_heart'], category: 'symbols' },
                '🤎': { name: 'brown heart', aliases: ['brown_heart'], category: 'symbols' },
                '✅': { name: 'check mark button', aliases: ['white_check_mark', 'done', 'yes'], category: 'symbols' },
                '❌': { name: 'cross mark', aliases: ['x', 'no'], category: 'symbols' },
                '⚠️': { name: 'warning', aliases: ['warning'], category: 'symbols' },
                '🚫': { name: 'prohibited', aliases: ['no_entry_sign'], category: 'symbols' },
                '🔔': { name: 'bell', aliases: ['bell'], category: 'objects' },
                '🔕': { name: 'bell with slash', aliases: ['no_bell'], category: 'objects' },
                '📁': { name: 'file folder', aliases: ['file_folder'], category: 'objects' },
                '📂': { name: 'open file folder', aliases: ['open_file_folder'], category: 'objects' },
                '📄': { name: 'page facing up', aliases: ['page_facing_up'], category: 'objects' },
                '📝': { name: 'memo', aliases: ['memo', 'pencil'], category: 'objects' },
                '🔧': { name: 'wrench', aliases: ['wrench'], category: 'objects' },
                '🔨': { name: 'hammer', aliases: ['hammer'], category: 'objects' },
                '⚙️': { name: 'gear', aliases: ['gear'], category: 'objects' },
                '🛠️': { name: 'hammer and wrench', aliases: ['tools'], category: 'objects' },
                '🎯': { name: 'direct hit', aliases: ['dart'], category: 'activities' },
                '🎪': { name: 'circus tent', aliases: ['circus_tent'], category: 'activities' },
                '🎭': { name: 'performing arts', aliases: ['performing_arts'], category: 'activities' },
                '🎨': { name: 'artist palette', aliases: ['art'], category: 'activities' },
                '🎬': { name: 'clapper board', aliases: ['clapper'], category: 'activities' },
                '🎮': { name: 'video game', aliases: ['video_game'], category: 'activities' },
                '🎲': { name: 'game die', aliases: ['game_die'], category: 'activities' },
                '🎸': { name: 'guitar', aliases: ['guitar'], category: 'activities' },
                '🎹': { name: 'musical keyboard', aliases: ['musical_keyboard'], category: 'activities' },
                '🎵': { name: 'musical note', aliases: ['musical_note'], category: 'symbols' },
                '🎶': { name: 'musical notes', aliases: ['notes'], category: 'symbols' },
                '🚗': { name: 'automobile', aliases: ['car', 'red_car'], category: 'travel' },
                '🚙': { name: 'sport utility vehicle', aliases: ['blue_car'], category: 'travel' },
                '🚌': { name: 'bus', aliases: ['bus'], category: 'travel' },
                '🚚': { name: 'delivery truck', aliases: ['truck'], category: 'travel' },
                '✈️': { name: 'airplane', aliases: ['airplane'], category: 'travel' },
                '🚀': { name: 'rocket', aliases: ['rocket'], category: 'travel' },
                '🏠': { name: 'house', aliases: ['house'], category: 'travel' },
                '🏢': { name: 'office building', aliases: ['office'], category: 'travel' },
                '🌍': { name: 'globe showing Europe-Africa', aliases: ['earth_africa'], category: 'nature' },
                '🌎': { name: 'globe showing Americas', aliases: ['earth_americas'], category: 'nature' },
                '🌏': { name: 'globe showing Asia-Australia', aliases: ['earth_asia'], category: 'nature' },
                '🌳': { name: 'deciduous tree', aliases: ['deciduous_tree'], category: 'nature' },
                '🌲': { name: 'evergreen tree', aliases: ['evergreen_tree'], category: 'nature' },
                '🌱': { name: 'seedling', aliases: ['seedling'], category: 'nature' },
                '🌿': { name: 'herb', aliases: ['herb'], category: 'nature' },
                '🍎': { name: 'red apple', aliases: ['apple'], category: 'food' },
                '🍌': { name: 'banana', aliases: ['banana'], category: 'food' },
                '🍇': { name: 'grapes', aliases: ['grapes'], category: 'food' },
                '🍓': { name: 'strawberry', aliases: ['strawberry'], category: 'food' },
                '🍕': { name: 'pizza', aliases: ['pizza'], category: 'food' },
                '🍔': { name: 'hamburger', aliases: ['hamburger'], category: 'food' },
                '🍟': { name: 'french fries', aliases: ['fries'], category: 'food' },
                '☕': { name: 'hot beverage', aliases: ['coffee'], category: 'food' },
                '🥤': { name: 'cup with straw', aliases: ['cup_with_straw'], category: 'food' },
                '🏁': { name: 'chequered flag', aliases: ['checkered_flag'], category: 'flags' },
                '🚩': { name: 'triangular flag', aliases: ['triangular_flag_on_post'], category: 'flags' },
                '🏳️': { name: 'white flag', aliases: ['white_flag'], category: 'flags' },
                '🏴': { name: 'black flag', aliases: ['black_flag'], category: 'flags' },
                
                // Additional commonly searched emojis
                '👍': { name: 'thumbs up', aliases: ['thumbsup', '+1', 'like', 'good', 'yes'], category: 'smileys' },
                '👎': { name: 'thumbs down', aliases: ['thumbsdown', '-1', 'dislike', 'bad', 'no'], category: 'smileys' },
                '🔶': { name: 'large orange diamond', aliases: ['large_orange_diamond', 'orange', 'diamond'], category: 'symbols' },
                '🔷': { name: 'large blue diamond', aliases: ['large_blue_diamond', 'blue', 'diamond'], category: 'symbols' },
                '⚪': { name: 'white circle', aliases: ['white_circle', 'circle', 'white'], category: 'symbols' },
                '🟠': { name: 'orange circle', aliases: ['orange_circle', 'orange'], category: 'symbols' },
                '🔒': { name: 'locked', aliases: ['lock'], category: 'objects' },
                '🔓': { name: 'unlocked', aliases: ['unlock'], category: 'objects' },
                '📍': { name: 'round pushpin', aliases: ['round_pushpin', 'pin'], category: 'objects' },
                '📌': { name: 'pushpin', aliases: ['pushpin', 'pin'], category: 'objects' },
                '🚀': { name: 'rocket', aliases: ['rocket', 'launch', 'space'], category: 'travel' },
                '💻': { name: 'laptop computer', aliases: ['computer', 'laptop'], category: 'objects' },
                '⌨️': { name: 'keyboard', aliases: ['keyboard'], category: 'objects' },
                '🖱️': { name: 'computer mouse', aliases: ['mouse'], category: 'objects' },
                '📱': { name: 'mobile phone', aliases: ['iphone', 'smartphone', 'mobile'], category: 'objects' },
                '💾': { name: 'floppy disk', aliases: ['floppy_disk', 'save'], category: 'objects' },
                '💿': { name: 'optical disk', aliases: ['cd'], category: 'objects' },
                '📀': { name: 'dvd', aliases: ['dvd'], category: 'objects' },
                '🎵': { name: 'musical note', aliases: ['musical_note', 'music'], category: 'symbols' },
                '🎶': { name: 'musical notes', aliases: ['notes', 'music'], category: 'symbols' }
            };

            // Build category arrays from database
            const emojiData = {
                smileys: [],
                nature: [],
                food: [],
                activities: [],
                travel: [],
                objects: [],
                symbols: [],
                flags: []
            };

            // Populate category arrays and handle emojis not in database
            Object.keys(emojiDatabase).forEach(emoji => {
                const data = emojiDatabase[emoji];
                if (emojiData[data.category]) {
                    emojiData[data.category].push(emoji);
                }
            });

            // Add additional emojis that aren't in the search database (for backwards compatibility)
            const additionalEmojis = {
                nature: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔', '🌵', '🎄', '🌴', '☘️', '🍀', '🎍', '🎋', '🍃', '🍂', '🍁', '🍄', '🐚', '🌾', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🌞', '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌙', '🪐', '💫', '☄️', '💥', '🌪️', '🌈', '☀️', '🌤️', '⛅', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨', '💧', '💦', '☔', '☂️', '🌊', '🌫️'],
                food: ['🍐', '🍊', '🍋', '🍉', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍟', '🫓', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '🍵', '🧃', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊', '🥄', '🍴', '🍽️', '🥣', '🥡', '🥢', '🧂'],
                activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏑', '🏒', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️‍♀️', '🏋️', '🏋️‍♂️', '🤼‍♀️', '🤼', '🤼‍♂️', '🤸‍♀️', '🤸', '🤸‍♂️', '⛹️‍♀️', '⛹️', '⛹️‍♂️', '🤺', '🤾‍♀️', '🤾', '🤾‍♂️', '🏌️‍♀️', '🏌️', '🏌️‍♂️', '🏇', '🧘‍♀️', '🧘', '🧘‍♂️', '🏄‍♀️', '🏄', '🏄‍♂️', '🏊‍♀️', '🏊', '🏊‍♂️', '🤽‍♀️', '🤽', '🤽‍♂️', '🚣‍♀️', '🚣', '🚣‍♂️', '🧗‍♀️', '🧗', '🧗‍♂️', '🚵‍♀️', '🚵', '🚵‍♂️', '🚴‍♀️', '🚴', '🚴‍♂️', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️', '🤹', '🤹‍♀️', '🤹‍♂️', '🩰', '🎤', '🎧', '🎼', '🥁', '🪘', '🎷', '🎺', '🪕', '🎻', '♟️', '🎳', '🎰', '🧩'],
                travel: ['🚕', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🛼', '🚁', '🛸', '🛫', '🛬', '🪂', '💺', '🛰️', '🚉', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🛩️', '🚟', '🚠', '🚡', '🛶', '🚤', '🛥️', '🛳️', '⛵', '🚢', '⚓', '⛽', '🚧', '🚨', '🚥', '🚦', '🛑', '🚏', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🛖', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌', '🛕', '🕍', '🕋', '⛩️', '🛤️', '🛣️', '🗾', '🎑', '🏞️', '🌅', '🌄', '🌠', '🎇', '🎆', '🌇', '🌆', '🏙️', '🌃', '🌌', '🌉', '🌁'],
                objects: ['🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🧰', '⚒️', '⛏️', '🔩', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🖼️', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🏷️', '📪', '📬', '📭', '📮', '📯', '📜', '📃', '🧾', '📊', '📈', '📉', '🗒️', '🗓️', '📆', '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📋', '🗂️', '🗞️', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇️', '📐', '📏', '🧮', '📌', '📍', '✂️', '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓', '🧡', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '⭕', '🛑', '⛔', '📛', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '🚸', '🔱', '⚜️', '🔰', '♻️', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '➕', '➖', '➗', '✖️', '♾️', '💲', '💱', '™️', '©️', '®️', '〰️', '➰', '➿', '🔚', '🔙', '🔛', '🔝', '🔜', '✔️', '☑️', '🔘', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔈', '🔇', '🔉', '🔊', '📣', '📢', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧'],
                symbols: ['🟠', '🟡', '🟢', '🟣', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♠️', '♣️', '♥️', '♦️', '💧', '✨', '☄️', '💫', '🌙', '☀️', '🌈', '🔆', '🔅', '💥', '💢', '💨', '💦', '💤', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔱', '⚜️', '♻️', '✳️', '❇️', '💠', '🌀', '➰', '➿', '🔃', '🔄', '🔁', '🔂', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '➕', '➖', '➗', '✖️', '♾️', '💲', '💱', '™️', '©️', '®️', '〰️', '🔚', '🔙', '🔛', '🔝', '🔜', '✔️', '☑️', '🔘', '🔈', '🔇', '🔉', '🔊', '📣', '📢', '💬', '💭', '🗯️', '🃏', '🎴', '🀄'],
                flags: ['🚩', '🎌', '🏴', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇨', '🇦🇩', '🇦🇪', '🇦🇫', '🇦🇬', '🇦🇮', '🇦🇱', '🇦🇲', '🇦🇴', '🇦🇶', '🇦🇷', '🇦🇸', '🇦🇹', '🇦🇺', '🇦🇼', '🇦🇽', '🇦🇿', '🇧🇦', '🇧🇧', '🇧🇩', '🇧🇪', '🇧🇫', '🇧🇬', '🇧🇭', '🇧🇮', '🇧🇯', '🇧🇱', '🇧🇲', '🇧🇳', '🇧🇴', '🇧🇶', '🇧🇷', '🇧🇸', '🇧🇹', '🇧🇻', '🇧🇼', '🇧🇾', '🇧🇿', '🇨🇦', '🇨🇨', '🇨🇩', '🇨🇫', '🇨🇬', '🇨🇭', '🇨🇮', '🇨🇰', '🇨🇱', '🇨🇲', '🇨🇳', '🇨🇴', '🇨🇵', '🇨🇷', '🇨🇺', '🇨🇻', '🇨🇼', '🇨🇽', '🇨🇾', '🇨🇿', '🇩🇪', '🇩🇬', '🇩🇯', '🇩🇰', '🇩🇲', '🇩🇴', '🇩🇿', '🇪🇦', '🇪🇨', '🇪🇪', '🇪🇬', '🇪🇭', '🇪🇷', '🇪🇸', '🇪🇹', '🇪🇺', '🇫🇮', '🇫🇯', '🇫🇰', '🇫🇲', '🇫🇴', '🇫🇷', '🇬🇦', '🇬🇧', '🇬🇩', '🇬🇪', '🇬🇫', '🇬🇬', '🇬🇭', '🇬🇮', '🇬🇱', '🇬🇲', '🇬🇳', '🇬🇵', '🇬🇶', '🇬🇷', '🇬🇸', '🇬🇹', '🇬🇺', '🇬🇼', '🇬🇾', '🇭🇰', '🇭🇲', '🇭🇳', '🇭🇷', '🇭🇹', '🇭🇺', '🇮🇨', '🇮🇩', '🇮🇪', '🇮🇱', '🇮🇲', '🇮🇳', '🇮🇴', '🇮🇶', '🇮🇷', '🇮🇸', '🇮🇹', '🇯🇪', '🇯🇲', '🇯🇴', '🇯🇵', '🇰🇪', '🇰🇬', '🇰🇭', '🇰🇮', '🇰🇲', '🇰🇳', '🇰🇵', '🇰🇷', '🇰🇼', '🇰🇾', '🇰🇿', '🇱🇦', '🇱🇧', '🇱🇨', '🇱🇮', '🇱🇰', '🇱🇷', '🇱🇸', '🇱🇹', '🇱🇺', '🇱🇻', '🇱🇾', '🇲🇦', '🇲🇨', '🇲🇩', '🇲🇪', '🇲🇫', '🇲🇬', '🇲🇭', '🇲🇰', '🇲🇱', '🇲🇲', '🇲🇳', '🇲🇴', '🇲🇵', '🇲🇶', '🇲🇷', '🇲🇸', '🇲🇹', '🇲🇺', '🇲🇻', '🇲🇼', '🇲🇽', '🇲🇾', '🇲🇿', '🇳🇦', '🇳🇨', '🇳🇪', '🇳🇫', '🇳🇬', '🇳🇮', '🇳🇱', '🇳🇴', '🇳🇵', '🇳🇷', '🇳🇺', '🇳🇿', '🇴🇲', '🇵🇦', '🇵🇪', '🇵🇫', '🇵🇬', '🇵🇭', '🇵🇰', '🇵🇱', '🇵🇲', '🇵🇳', '🇵🇷', '🇵🇸', '🇵🇹', '🇵🇼', '🇵🇾', '🇶🇦', '🇷🇪', '🇷🇴', '🇷🇸', '🇷🇺', '🇷🇼', '🇸🇦', '🇸🇧', '🇸🇨', '🇸🇩', '🇸🇪', '🇸🇬', '🇸🇭', '🇸🇮', '🇸🇯', '🇸🇰', '🇸🇱', '🇸🇲', '🇸🇳', '🇸🇴', '🇸🇷', '🇸🇸', '🇸🇹', '🇸🇻', '🇸🇽', '🇸🇾', '🇸🇿', '🇹🇦', '🇹🇨', '🇹🇩', '🇹🇫', '🇹🇬', '🇹🇭', '🇹🇯', '🇹🇰', '🇹🇱', '🇹🇲', '🇹🇳', '🇹🇴', '🇹🇷', '🇹🇹', '🇹🇻', '🇹🇼', '🇹🇿', '🇺🇦', '🇺🇬', '🇺🇲', '🇺🇳', '🇺🇸', '🇺🇾', '🇺🇿', '🇻🇦', '🇻🇨', '🇻🇪', '🇻🇬', '🇻🇮', '🇻🇳', '🇻🇺', '🇼🇫', '🇼🇸', '🇽🇰', '🇾🇪', '🇾🇹', '🇿🇦', '🇿🇲', '🇿🇼']
            };

            // Merge additional emojis into category arrays
            Object.keys(additionalEmojis).forEach(category => {
                if (emojiData[category]) {
                    additionalEmojis[category].forEach(emoji => {
                        if (!emojiData[category].includes(emoji)) {
                            emojiData[category].push(emoji);
                        }
                    });
                }
            });
                nature: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔', '🌵', '🎄', '🌲', '🌳', '🌴', '🌱', '🌿', '☘️', '🍀', '🎍', '🎋', '🍃', '🍂', '🍁', '🍄', '🐚', '🌾', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🌞', '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌙', '🌎', '🌍', '🌏', '🪐', '💫', '⭐', '🌟', '✨', '⚡', '☄️', '💥', '🔥', '🌪️', '🌈', '☀️', '🌤️', '⛅', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨', '💧', '💦', '☔', '☂️', '🌊', '🌫️'],
                food: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🍵', '🧃', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊', '🥄', '🍴', '🍽️', '🥣', '🥡', '🥢', '🧂'],
                activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏑', '🏒', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️‍♀️', '🏋️', '🏋️‍♂️', '🤼‍♀️', '🤼', '🤼‍♂️', '🤸‍♀️', '🤸', '🤸‍♂️', '⛹️‍♀️', '⛹️', '⛹️‍♂️', '🤺', '🤾‍♀️', '🤾', '🤾‍♂️', '🏌️‍♀️', '🏌️', '🏌️‍♂️', '🏇', '🧘‍♀️', '🧘', '🧘‍♂️', '🏄‍♀️', '🏄', '🏄‍♂️', '🏊‍♀️', '🏊', '🏊‍♂️', '🤽‍♀️', '🤽', '🤽‍♂️', '🚣‍♀️', '🚣', '🚣‍♂️', '🧗‍♀️', '🧗', '🧗‍♂️', '🚵‍♀️', '🚵', '🚵‍♂️', '🚴‍♀️', '🚴', '🚴‍♂️', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️', '🎪', '🤹', '🤹‍♀️', '🤹‍♂️', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎵', '🎶', '🥁', '🪘', '🎹', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩'],
                travel: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🛹', '🛼', '🚁', '🛸', '✈️', '🛫', '🛬', '🪂', '💺', '🚀', '🛰️', '🚉', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🚟', '🚠', '🚡', '🛶', '🚤', '🛥️', '🛳️', '⛵', '🚢', '⚓', '⛽', '🚧', '🚨', '🚥', '🚦', '🛑', '🚏', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🛖', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌', '🛕', '🕍', '🕋', '⛩️', '🛤️', '🛣️', '🗾', '🎑', '🏞️', '🌅', '🌄', '🌠', '🎇', '🎆', '🌇', '🌆', '🏙️', '🌃', '🌌', '🌉', '🌁'],
                objects: ['💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🧰', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🔩', '⚙️', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🖼️', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🏷️', '📪', '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒️', '🗓️', '📆', '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📋', '📁', '📂', '🗂️', '🗞️', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇️', '📐', '📏', '🧮', '📌', '📍', '✂️', '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '📝', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '♾️', '💲', '💱', '™️', '©️', '®️', '〰️', '➰', '➿', '🔚', '🔙', '🔛', '🔝', '🔜', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧'],
                symbols: ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♠️', '♣️', '♥️', '♦️', '🔥', '💧', '⭐', '🌟', '✨', '⚡', '☄️', '💫', '🌙', '☀️', '🌈', '🔆', '🔅', '💥', '💢', '💨', '💦', '💤', '✅', '❌', '❗', '❕', '❓', '❔', '‼️', '⁉️', '⚠️', '🚸', '🔱', '⚜️', '♻️', '✳️', '❇️', '💠', '🌀', '➰', '➿', '🔃', '🔄', '🔁', '🔂', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🎵', '🎶', '➕', '➖', '➗', '✖️', '♾️', '💲', '💱', '™️', '©️', '®️', '〰️', '🔚', '🔙', '🔛', '🔝', '🔜', '✔️', '☑️', '🔘', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬', '💭', '🗯️', '🃏', '🎴', '🀄'],
                flags: ['🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇨', '🇦🇩', '🇦🇪', '🇦🇫', '🇦🇬', '🇦🇮', '🇦🇱', '🇦🇲', '🇦🇴', '🇦🇶', '🇦🇷', '🇦🇸', '🇦🇹', '🇦🇺', '🇦🇼', '🇦🇽', '🇦🇿', '🇧🇦', '🇧🇧', '🇧🇩', '🇧🇪', '🇧🇫', '🇧🇬', '🇧🇭', '🇧🇮', '🇧🇯', '🇧🇱', '🇧🇲', '🇧🇳', '🇧🇴', '🇧🇶', '🇧🇷', '🇧🇸', '🇧🇹', '🇧🇻', '🇧🇼', '🇧🇾', '🇧🇿', '🇨🇦', '🇨🇨', '🇨🇩', '🇨🇫', '🇨🇬', '🇨🇭', '🇨🇮', '🇨🇰', '🇨🇱', '🇨🇲', '🇨🇳', '🇨🇴', '🇨🇵', '🇨🇷', '🇨🇺', '🇨🇻', '🇨🇼', '🇨🇽', '🇨🇾', '🇨🇿', '🇩🇪', '🇩🇬', '🇩🇯', '🇩🇰', '🇩🇲', '🇩🇴', '🇩🇿', '🇪🇦', '🇪🇨', '🇪🇪', '🇪🇬', '🇪🇭', '🇪🇷', '🇪🇸', '🇪🇹', '🇪🇺', '🇫🇮', '🇫🇯', '🇫🇰', '🇫🇲', '🇫🇴', '🇫🇷', '🇬🇦', '🇬🇧', '🇬🇩', '🇬🇪', '🇬🇫', '🇬🇬', '🇬🇭', '🇬🇮', '🇬🇱', '🇬🇲', '🇬🇳', '🇬🇵', '🇬🇶', '🇬🇷', '🇬🇸', '🇬🇹', '🇬🇺', '🇬🇼', '🇬🇾', '🇭🇰', '🇭🇲', '🇭🇳', '🇭🇷', '🇭🇹', '🇭🇺', '🇮🇨', '🇮🇩', '🇮🇪', '🇮🇱', '🇮🇲', '🇮🇳', '🇮🇴', '🇮🇶', '🇮🇷', '🇮🇸', '🇮🇹', '🇯🇪', '🇯🇲', '🇯🇴', '🇯🇵', '🇰🇪', '🇰🇬', '🇰🇭', '🇰🇮', '🇰🇲', '🇰🇳', '🇰🇵', '🇰🇷', '🇰🇼', '🇰🇾', '🇰🇿', '🇱🇦', '🇱🇧', '🇱🇨', '🇱🇮', '🇱🇰', '🇱🇷', '🇱🇸', '🇱🇹', '🇱🇺', '🇱🇻', '🇱🇾', '🇲🇦', '🇲🇨', '🇲🇩', '🇲🇪', '🇲🇫', '🇲🇬', '🇲🇭', '🇲🇰', '🇲🇱', '🇲🇲', '🇲🇳', '🇲🇴', '🇲🇵', '🇲🇶', '🇲🇷', '🇲🇸', '🇲🇹', '🇲🇺', '🇲🇻', '🇲🇼', '🇲🇽', '🇲🇾', '🇲🇿', '🇳🇦', '🇳🇨', '🇳🇪', '🇳🇫', '🇳🇬', '🇳🇮', '🇳🇱', '🇳🇴', '🇳🇵', '🇳🇷', '🇳🇺', '🇳🇿', '🇴🇲', '🇵🇦', '🇵🇪', '🇵🇫', '🇵🇬', '🇵🇭', '🇵🇰', '🇵🇱', '🇵🇲', '🇵🇳', '🇵🇷', '🇵🇸', '🇵🇹', '🇵🇼', '🇵🇾', '🇶🇦', '🇷🇪', '🇷🇴', '🇷🇸', '🇷🇺', '🇷🇼', '🇸🇦', '🇸🇧', '🇸🇨', '🇸🇩', '🇸🇪', '🇸🇬', '🇸🇭', '🇸🇮', '🇸🇯', '🇸🇰', '🇸🇱', '🇸🇲', '🇸🇳', '🇸🇴', '🇸🇷', '🇸🇸', '🇸🇹', '🇸🇻', '🇸🇽', '🇸🇾', '🇸🇿', '🇹🇦', '🇹🇨', '🇹🇩', '🇹🇫', '🇹🇬', '🇹🇭', '🇹🇯', '🇹🇰', '🇹🇱', '🇹🇲', '🇹🇳', '🇹🇴', '🇹🇷', '🇹🇹', '🇹🇻', '🇹🇼', '🇹🇿', '🇺🇦', '🇺🇬', '🇺🇲', '🇺🇳', '🇺🇸', '🇺🇾', '🇺🇿', '🇻🇦', '🇻🇨', '🇻🇪', '🇻🇬', '🇻🇮', '🇻🇳', '🇻🇺', '🇼🇫', '🇼🇸', '🇽🇰', '🇾🇪', '🇾🇹', '🇿🇦', '🇿🇲', '🇿🇼']
            };

            let currentColorKey = '';
            let currentCategory = 'all';
            let currentSearchTerm = '';

            function getAllEmojis() {
                return Object.values(emojiData).flat();
            }

            function searchEmojis(searchTerm) {
                if (!searchTerm.trim()) {
                    return [];
                }

                const term = searchTerm.toLowerCase().trim();
                const results = [];

                // Search through emoji database
                Object.keys(emojiDatabase).forEach(emoji => {
                    const data = emojiDatabase[emoji];
                    const searchableText = [
                        data.name,
                        ...data.aliases,
                        emoji
                    ].join(' ').toLowerCase();

                    if (searchableText.includes(term)) {
                        results.push({
                            emoji: emoji,
                            name: data.name,
                            aliases: data.aliases,
                            category: data.category,
                            relevance: calculateRelevance(term, data.name, data.aliases)
                        });
                    }
                });

                // Sort by relevance (exact matches first, then partial matches)
                return results.sort((a, b) => b.relevance - a.relevance).map(r => r.emoji);
            }

            function calculateRelevance(searchTerm, name, aliases) {
                const term = searchTerm.toLowerCase();
                let score = 0;

                // Exact name match gets highest score
                if (name.toLowerCase() === term) {
                    score += 100;
                } else if (name.toLowerCase().startsWith(term)) {
                    score += 80;
                } else if (name.toLowerCase().includes(term)) {
                    score += 60;
                }

                // Check aliases
                aliases.forEach(alias => {
                    const aliasLower = alias.toLowerCase();
                    if (aliasLower === term) {
                        score += 90;
                    } else if (aliasLower.startsWith(term)) {
                        score += 70;
                    } else if (aliasLower.includes(term)) {
                        score += 50;
                    }
                });

                return score;
            }

            function openEmojiPicker(colorKey) {
                currentColorKey = colorKey;
                currentSearchTerm = '';
                const modal = document.getElementById('emojiModal');
                modal.classList.add('show');
                
                // Clear search and reset to all category
                document.getElementById('emojiSearch').value = '';
                document.getElementById('searchResultsInfo').style.display = 'none';
                currentCategory = 'all';
                
                // Update active tab
                document.querySelectorAll('.category-tab').forEach(tab => {
                    tab.classList.remove('active');
                });
                document.querySelector('[data-category="all"]').classList.add('active');
                
                // Highlight the current emoji in the picker
                const currentEmoji = document.querySelector(\`[data-color-key="\${colorKey}"]\`).textContent;
                renderEmojiGrid('all', currentEmoji);
                
                // Focus search input
                setTimeout(() => {
                    document.getElementById('emojiSearch').focus();
                }, 100);
            }

            function closeEmojiPicker() {
                const modal = document.getElementById('emojiModal');
                modal.classList.remove('show');
            }

            function switchCategory(category) {
                // Clear search when switching categories
                currentSearchTerm = '';
                document.getElementById('emojiSearch').value = '';
                document.getElementById('searchResultsInfo').style.display = 'none';
                
                // Update active tab
                document.querySelectorAll('.category-tab').forEach(tab => {
                    tab.classList.remove('active');
                });
                document.querySelector(\`[data-category="\${category}"]\`).classList.add('active');
                
                currentCategory = category;
                
                // Get current emoji to keep it selected
                const currentEmoji = document.querySelector(\`[data-color-key="\${currentColorKey}"]\`).textContent;
                renderEmojiGrid(category, currentEmoji);
            }

            function renderEmojiGrid(category, selectedEmoji = '', searchTerm = '') {
                const grid = document.getElementById('emojiGrid');
                const searchResultsInfo = document.getElementById('searchResultsInfo');
                let emojis = [];

                if (searchTerm && searchTerm.trim()) {
                    // Search mode
                    emojis = searchEmojis(searchTerm);
                    searchResultsInfo.textContent = \`Found \${emojis.length} emoji(s) matching "\${searchTerm}"\`;
                    searchResultsInfo.style.display = emojis.length > 0 ? 'block' : 'block';
                    
                    if (emojis.length === 0) {
                        searchResultsInfo.textContent = \`No emojis found matching "\${searchTerm}". Try different keywords like "smile", "heart", or "red".\`;
                    }
                } else {
                    // Category mode
                    emojis = category === 'all' ? getAllEmojis() : emojiData[category] || [];
                    searchResultsInfo.style.display = 'none';
                }
                
                grid.innerHTML = '';
                
                emojis.forEach(emoji => {
                    const item = document.createElement('div');
                    item.className = 'emoji-item';
                    item.textContent = emoji;
                    
                    // Add tooltip with emoji name and aliases
                    if (emojiDatabase[emoji]) {
                        const data = emojiDatabase[emoji];
                        const aliases = data.aliases.length > 0 ? \` (aliases: \${data.aliases.join(', ')})\` : '';
                        item.title = \`\${data.name}\${aliases}\`;
                    }
                    
                    if (emoji === selectedEmoji) {
                        item.classList.add('selected');
                    }
                    
                    item.onclick = () => selectEmoji(emoji);
                    grid.appendChild(item);
                });
            }

            function selectEmoji(emoji) {
                if (!currentColorKey) return;
                
                // Update the current emoji display
                const currentEmojiEl = document.querySelector(\`[data-color-key="\${currentColorKey}"]\`);
                currentEmojiEl.textContent = emoji;
                
                // Update preview
                const preview = document.getElementById(currentColorKey + 'Preview');
                const currentText = preview.textContent;
                const linesPart = currentText.substring(currentText.indexOf('Lines:'));
                preview.textContent = emoji + ' ' + linesPart;
                
                // Update section header
                const section = currentEmojiEl.closest('.color-section');
                const header = section.querySelector('h3');
                const headerText = header.textContent;
                const newHeaderText = headerText.replace(/^[^\\s]+/, emoji);
                header.textContent = newHeaderText;
                
                // Send update to VS Code
                vscode.postMessage({
                    command: 'updateEmoji',
                    colorKey: currentColorKey,
                    emoji: emoji
                });
                
                // Close the picker
                closeEmojiPicker();
            }

            // Close modal when clicking outside of it
            document.getElementById('emojiModal').addEventListener('click', function(e) {
                if (e.target === this) {
                    closeEmojiPicker();
                }
            });

            // Initialize with default emoji grid
            document.addEventListener('DOMContentLoaded', function() {
                renderEmojiGrid('all');
                
                // Setup search functionality
                const searchInput = document.getElementById('emojiSearch');
                let searchTimeout;
                
                searchInput.addEventListener('input', function() {
                    clearTimeout(searchTimeout);
                    const searchTerm = this.value.trim();
                    
                    // Debounce search to avoid excessive calls
                    searchTimeout = setTimeout(() => {
                        currentSearchTerm = searchTerm;
                        
                        if (searchTerm) {
                            // In search mode, disable category tabs
                            document.querySelectorAll('.category-tab').forEach(tab => {
                                tab.classList.remove('active');
                            });
                            
                            const currentEmoji = currentColorKey ? document.querySelector(\`[data-color-key="\${currentColorKey}"]\`).textContent : '';
                            renderEmojiGrid('search', currentEmoji, searchTerm);
                        } else {
                            // Return to category mode
                            const categoryTab = document.querySelector(\`[data-category="\${currentCategory}"]\`);
                            if (categoryTab) {
                                categoryTab.classList.add('active');
                            }
                            const currentEmoji = currentColorKey ? document.querySelector(\`[data-color-key="\${currentColorKey}"]\`).textContent : '';
                            renderEmojiGrid(currentCategory, currentEmoji);
                        }
                    }, 200);
                });
                
                searchInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape') {
                        this.value = '';
                        currentSearchTerm = '';
                        document.getElementById('searchResultsInfo').style.display = 'none';
                        
                        // Return to category mode
                        const categoryTab = document.querySelector(\`[data-category="\${currentCategory}"]\`);
                        if (categoryTab) {
                            categoryTab.classList.add('active');
                        }
                        const currentEmoji = currentColorKey ? document.querySelector(\`[data-color-key="\${currentColorKey}"]\`).textContent : '';
                        renderEmojiGrid(currentCategory, currentEmoji);
                    } else if (e.key === 'Enter') {
                        // Select first emoji in search results
                        const firstEmoji = document.querySelector('.emoji-item');
                        if (firstEmoji) {
                            selectEmoji(firstEmoji.textContent);
                        }
                    }
                });
            });
            
            // Setup threshold inputs
            function setupThresholdInput(inputId, thresholdKey) {
                const input = document.getElementById(inputId);
                input.addEventListener('change', function() {
                    const value = parseInt(this.value);
                    if (value > 0) {
                        vscode.postMessage({
                            command: 'updateThreshold',
                            thresholdKey: thresholdKey,
                            value: value
                        });
                        
                        // Update preview values
                        updatePreviewValues();
                    }
                });
            }
            
            setupThresholdInput('midThreshold', 'mid');
            setupThresholdInput('highThreshold', 'high');
            
            function updatePreviewValues() {
                const midThreshold = parseInt(document.getElementById('midThreshold').value);
                const highThreshold = parseInt(document.getElementById('highThreshold').value);
                
                document.getElementById('lowPreview').textContent = 'Lines: ' + Math.floor(midThreshold / 2);
                document.getElementById('mediumPreview').textContent = 'Lines: ' + Math.floor((midThreshold + highThreshold) / 2);
                document.getElementById('highPreview').textContent = 'Lines: ' + (highThreshold + 500);
                
                // Update high threshold label
                document.querySelector('.color-section:last-of-type .threshold-container label strong').textContent = highThreshold;
            }

            function resetEmojis() {
                vscode.postMessage({
                    command: 'resetColors'
                });
            }

            function addPattern() {
                const input = document.getElementById('newPattern');
                const pattern = input.value.trim();
                
                if (pattern) {
                    // Validate glob pattern
                    if (isValidGlobPattern(pattern)) {
                        vscode.postMessage({
                            command: 'addGlobPattern',
                            pattern: pattern
                        });
                        input.value = '';
                    } else {
                        alert('Invalid glob pattern. Please use valid glob syntax (e.g., **/*.js, **/node_modules/**)');
                    }
                }
            }

            function removePattern(pattern) {
                vscode.postMessage({
                    command: 'removeGlobPattern',
                    pattern: pattern
                });
            }

            function resetPatterns() {
                vscode.postMessage({
                    command: 'resetGlobPatterns'
                });
            }

            function isValidGlobPattern(pattern) {
                // Basic validation for glob patterns
                if (!pattern || pattern.length === 0) return false;
                
                // Check for invalid characters that would break the glob
                if (pattern.includes('\\\\') || pattern.includes('<') || pattern.includes('>') || pattern.includes('|')) {
                    return false;
                }
                
                // Must contain at least one valid glob character or be a simple path
                return true; // We'll allow most patterns and let the glob library handle validation
            }

            // Allow Enter key to add patterns
            document.getElementById('newPattern').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    addPattern();
                }
            });
        </script>
    </body>
    </html>`;
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

    const resetColorsDisposable = vscode.commands.registerCommand('codeCounter.resetColors', async () => {
        const emojiConfig = vscode.workspace.getConfiguration('codeCounter.emojis');
        
        await emojiConfig.update('normal', '🟢', vscode.ConfigurationTarget.Global);
        await emojiConfig.update('warning', '🟡', vscode.ConfigurationTarget.Global);
        await emojiConfig.update('danger', '🔴', vscode.ConfigurationTarget.Global);
        
        vscode.window.showInformationMessage('Emoji indicators reset to defaults: 🟢 🟡 🔴');
    });

    const openColorSettingsDisposable = vscode.commands.registerCommand('codeCounter.openColorSettings', async () => {
        await showEmojiPicker();
    });

    // Add all disposables to context
    context.subscriptions.push(
        countLinesDisposable,
        resetColorsDisposable,
        openColorSettingsDisposable,
        decorationProvider,
        fileWatcher,
        fileExplorerDecorator,
        editorTabDecorator
    );
}

export function deactivate() {}