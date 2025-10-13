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
            }
        },
        undefined
    );
}

function getEmojiPickerWebviewContent(badges: any, folderBadges: any, thresholds: any, excludePatterns: string[] = []): string {
    try {
        const templatePath = path.join(__dirname, '..', 'templates', 'emoji-picker.html');
        let htmlContent = fs.readFileSync(templatePath, 'utf8');
        
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
        
        const scriptContent = `
            const vscode = acquireVsCodeApi();
            let currentColorKey = '';
            let currentEmojiType = 'file';
            
            function openEmojiPicker(colorKey, type) {
                currentColorKey = colorKey;
                currentEmojiType = type;
                
                // Show the emoji picker modal
                const modal = document.getElementById('emojiModal');
                if (modal) {
                    modal.classList.add('show');
                    // Focus the search input
                    const searchInput = document.getElementById('emojiSearch');
                    if (searchInput) {
                        setTimeout(() => searchInput.focus(), 100);
                    }
                    // Initialize emoji grid if not already done
                    if (!window.emojisInitialized) {
                        initializeEmojiPicker();
                        window.emojisInitialized = true;
                    }
                }
            }
            
            window.closeEmojiPicker = function() {
                const modal = document.getElementById('emojiModal');
                if (modal) {
                    modal.classList.remove('show');
                }
            }
            
            function getCurrentlyUsedEmojis() {
                const usedEmojis = new Set();
                
                // Get all current emoji displays
                document.querySelectorAll('.current-emoji').forEach(el => {
                    const emoji = el.textContent.trim();
                    if (emoji) {
                        usedEmojis.add(emoji);
                    }
                });
                
                return usedEmojis;
            }
            
            function selectEmoji(emoji) {
                // Check if emoji is already in use
                const usedEmojis = getCurrentlyUsedEmojis();
                const currentEmojiEl = document.querySelector(\`[data-color-key="\${currentColorKey}"][data-type="\${currentEmojiType}"]\`);
                const currentEmoji = currentEmojiEl ? currentEmojiEl.textContent.trim() : '';
                
                // Allow reselecting the same emoji for the same slot
                if (usedEmojis.has(emoji) && emoji !== currentEmoji) {
                    // Show validation message
                    const validationMsg = document.createElement('div');
                    validationMsg.textContent = \`Emoji "\${emoji}" is already in use. Please choose a different emoji.\`;
                    validationMsg.style.cssText = \`
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        background: var(--vscode-inputValidation-errorBackground);
                        color: var(--vscode-inputValidation-errorForeground);
                        border: 1px solid var(--vscode-inputValidation-errorBorder);
                        padding: 15px 20px;
                        border-radius: 6px;
                        z-index: 10001;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                        max-width: 300px;
                        text-align: center;
                        font-size: 14px;
                    \`;
                    document.body.appendChild(validationMsg);
                    
                    // Remove message after 3 seconds
                    setTimeout(() => {
                        if (validationMsg.parentNode) {
                            validationMsg.parentNode.removeChild(validationMsg);
                        }
                    }, 3000);
                    
                    return;
                }
                
                // Update the current emoji display
                if (currentEmojiEl) {
                    currentEmojiEl.textContent = emoji;
                }
                
                // Send update to VS Code
                vscode.postMessage({
                    command: 'updateEmoji',
                    colorKey: currentColorKey,
                    type: currentEmojiType,
                    emoji: emoji
                });
                
                // Close the picker
                closeEmojiPicker();
            }
            
            function initializeEmojiPicker() {
                // Comprehensive emoji database with search metadata
                window.emojiData = {
                    'smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '👿', '😈'],
                    'nature': ['🌱', '🌿', '🍃', '🌳', '🌲', '🌴', '🌵', '🌾', '🌻', '🌺', '🌸', '🌼', '🌷', '💐', '🏵️', '🌹', '🥀', '🌊', '💧', '🔥', '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️','🌋'],
                    'food': ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🍵', '🧃', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾'],
                    'activities': ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️‍♀️', '🏋️', '🏋️‍♂️', '🤼‍♀️', '🤼', '🤼‍♂️', '🤸‍♀️', '🤸', '🤸‍♂️', '⛹️‍♀️', '⛹️', '⛹️‍♂️', '🤺', '🤾‍♀️', '🤾', '🤾‍♂️', '🏌️‍♀️', '🏌️', '🏌️‍♂️', '🏇', '🧘‍♀️', '🧘', '🧘‍♂️', '🏄‍♀️', '🏄', '🏄‍♂️', '🏊‍♀️', '🏊', '🏊‍♂️', '🤽‍♀️', '🤽', '🤽‍♂️', '🚣‍♀️', '🚣', '🚣‍♂️', '🧗‍♀️', '🧗', '🧗‍♂️', '🚵‍♀️', '🚵', '🚵‍♂️', '🚴‍♀️', '🚴', '🚴‍♂️', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️', '🎪', '🤹‍♀️', '🤹', '🤹‍♂️', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎵', '🎶', '🥁', '🪘', '🎹', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♠️', '♥️', '♦️', '♣️', '♟️', '🃏', '🀄', '🎴', '🎯', '🎳'],
                    'travel': ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🛹', '🛼', '🚁', '🚟', '🚠', '🚡', '⛴️', '🛥️', '🚤', '⛵', '🛶', '🚀', '🛸', '💺', '🚂', '🚆', '🚄', '🚅', '🚈', '🚝', '🚞', '🚋', '🚃', '🚖', '🚘', '🚍', '🚔', '🚨', '🚥', '🚦', '🚧', '⚓', '⛽', '🚏', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🛖', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌', '🛕', '🕍', '🕘'],
                    'objects': ['💡', '🔦', '🏮', '🪔', '📱', '💻', '🖥️', '🖨️', '⌨️', '🖱️', '🖲️', '💾', '💿', '📀', '☎️', '📞', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⏳', '⌛', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🧰', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🔩', '⚙️', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧴', '🧷', '🧼', '🧽', '🧯', '🛒', '🚭', '⚠️', '🚸', '⛔', '🚫', '🚳', '🚯', '🚱', '🚷', '📵', '🔞', '☢️', '☣️'],
                    'symbols': ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '🟤', '⚫', '⚪', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫', '⬛', '⬜', '◼️', '◻️', '◾', '◽', '▪️', '▫️', '🔶', '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘', '🔳', '🔲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '🟰', '♾️', '💲', '💱', '™️', '©️', '®️', '〰️', '➰', '➿', '🔚', '🔙', '🔛', '🔝', '🔜', '✔️', '☑️', '🔘', '⚪', '⚫', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⭐', '🌟', '💫', '⚡', '💥', '💯', '🔥', '💨', '💦', '💧', '☀️', '⛅', '⛈️', '🌤️', '🌦️', '🌧️', '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨', '🌪️', '🌫️', '🌊', '💧', '💦', '☔', '⛱️', '⚡', '🔥', '💥', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'],
                    'flags': ['🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇨', '🇦🇩', '🇦🇪', '🇦🇫', '🇦🇬', '🇦🇮', '🇦🇱', '🇦🇲', '🇦🇴', '🇦🇶', '🇦🇷', '🇦🇸', '🇦🇹', '🇦🇺', '🇦🇼', '🇦�', '🇦🇿', '🇧🇦', '🇧🇧', '🇧🇩', '🇧🇪', '🇧🇫', '🇧🇬', '🇧🇭', '🇧🇮', '🇧🇯', '🇧🇱', '🇧🇲', '🇧🇳', '🇧🇴', '🇧🇶', '🇧🇷', '🇧�🇸', '🇧🇹', '🇧🇻', '�🇼', '🇧🇾', '🇧🇿', '🇨🇦', '🇨🇨', '🇨🇩', '🇨🇫', '🇨�🇬', '🇨🇭', '🇨🇮', '🇨🇰', '🇨🇱', '🇨🇲', '�🇳', '🇨🇴', '🇨🇵', '🇨🇷', '🇨🇺', '🇨🇻', '🇨🇼', '🇨🇽', '🇨🇾', '🇨🇿', '🇩🇪', '🇩🇬', '🇩🇯', '🇩🇰', '🇩🇲', '🇩🇴', '🇩🇿', '🇪🇦', '🇪🇨', '🇪🇪', '🇪🇬', '🇪🇭', '🇪🇷', '🇪🇸', '🇪🇹', '🇪🇺', '🇫🇮', '🇫🇯', '🇫🇰', '🇫🇲', '🇫🇴', '🇫🇷', '🇬🇦', '🇬�🇧', '🇬🇩', '🇬🇪', '🇬🇫', '🇬🇬', '🇬🇭', '🇬🇮', '🇬🇱', '🇬🇲', '🇬🇳', '🇬🇵', '🇬🇶', '��🇷', '�🇸', '🇬🇹', '🇬🇺', '🇬🇼', '🇬🇾', '🇭🇰', '🇭🇲', '🇭🇳', '🇭🇷', '🇭🇹', '🇭🇺', '🇮🇨', '🇮�🇩', '��🇪', '�🇱', '🇮🇲', '🇮🇳', '🇮🇴', '🇮🇶', '🇮🇷', '🇮🇸', '🇮🇹', '�🇯�', '🇯🇲', '🇯🇴', '🇯�🇵', '��', '🇰🇬', '🇰🇭', '🇰🇮', '🇰🇲', '🇰�🇳', '🇰�', '🇰�🇷', '�🇼', '🇰🇾', '🇰🇿', '🇱🇦', '🇱🇧', '🇱🇨', '🇱�🇮', '🇱🇰', '🇱🇷', '🇱🇸', '🇱🇹', '🇱🇺', '🇱🇻', '🇱🇾', '🇲🇦', '🇲🇨', '🇲🇩', '🇲🇪', '🇲🇫', '🇲🇬', '🇲🇭', '🇲🇰', '🇲🇱', '🇲🇲', '🇲🇳', '🇲🇴', '🇲🇵', '🇲🇶', '🇲🇷', '🇲🇸', '🇲🇹', '🇲🇺', '🇲🇻', '🇲🇼', '🇲🇽', '🇲🇾', '🇲🇿', '🇳🇦', '🇳🇨', '🇳🇪', '🇳🇫', '🇳🇬', '🇳🇮', '🇳🇱', '🇳🇴', '🇳🇵', '🇳�', '🇳🇺', '🇳🇿', '🇴🇲', '🇵�🇦', '�🇪', '🇵🇫', '🇵🇬', '🇵🇭', '🇵🇰', '🇵🇱', '🇵🇲', '🇵🇳', '🇵🇷', '🇵🇸', '🇵🇹', '🇵🇼', '🇵🇾', '🇶�🇦', '�🇪', '🇷🇴', '🇷🇸', '🇷�🇺', '�🇼', '🇸🇦', '🇸�🇧', '�🇨', '🇸🇩', '🇸🇪', '🇸🇬', '🇸🇭', '🇸🇮', '🇸🇯', '🇸🇰', '🇸🇱', '🇸🇲', '🇸🇳', '🇸🇴', '🇸�🇷', '🇸🇸', '🇸🇹', '🇸🇻', '🇸🇽', '🇸🇾', '🇸🇿', '🇹🇦', '🇹🇨', '🇹🇩', '🇹🇫', '🇹🇬', '🇹🇭', '🇹🇯', '🇹🇰', '🇹🇱', '🇹🇲', '🇹🇳', '🇹🇴', '🇹🇷', '🇹🇹', '🇹🇻', '🇹🇼', '🇹🇿', '🇺🇦', '🇺🇬', '🇺🇲', '🇺🇳', '🇺🇸', '🇺🇾', '🇺🇿', '🇻🇦', '🇻🇨', '🇻🇪', '🇻🇬', '🇻🇮', '🇻🇳', '🇻🇺', '🇼🇫', '🇼🇸', '🇽🇰', '🇾🇪', '🇾🇹', '🇿🇦', '🇿🇲', '🇿🇼']
                };
                
                // Comprehensive search metadata for ALL emojis
                window.emojiSearchData = {
                    // Smileys & People
                    '😀': ['grinning', 'face', 'smile', 'happy', 'joy', 'cheerful', 'smiling'],
                    '😃': ['grinning', 'face', 'happy', 'smile', 'joy', 'smiley'],
                    '😄': ['grinning', 'face', 'smile', 'happy', 'joy', 'laugh', 'eyes'],
                    '😁': ['beaming', 'face', 'smile', 'happy', 'teeth', 'grin'],
                    '😆': ['grinning', 'face', 'smile', 'happy', 'laugh', 'satisfied', 'squinting'],
                    '😅': ['grinning', 'face', 'sweat', 'smile', 'happy', 'relief', 'nervous'],
                    '😂': ['face', 'tears', 'joy', 'laugh', 'cry', 'happy', 'lol'],
                    '🤣': ['rolling', 'floor', 'laughing', 'face', 'tears', 'joy', 'rofl'],
                    '😊': ['smiling', 'face', 'happy', 'blush', 'pleased', 'content'],
                    '😇': ['smiling', 'face', 'halo', 'innocent', 'angel'],
                    '🙂': ['slightly', 'smiling', 'face', 'happy', 'smile'],
                    '🙃': ['upside', 'down', 'face', 'silly', 'sarcastic'],
                    '😉': ['winking', 'face', 'flirt', 'suggestive', 'wink'],
                    '😌': ['relieved', 'face', 'peaceful', 'calm', 'content'],
                    '😍': ['smiling', 'face', 'heart', 'eyes', 'love', 'adore'],
                    '🥰': ['smiling', 'face', 'hearts', 'love', 'adore', 'cute'],
                    '😘': ['face', 'blowing', 'kiss', 'love', 'romance'],
                    '😗': ['kissing', 'face', 'love', 'like', 'affection'],
                    '😙': ['kissing', 'face', 'smiling', 'eyes', 'affection'],
                    '😚': ['kissing', 'face', 'closed', 'eyes', 'love'],
                    '😋': ['face', 'savoring', 'food', 'yummy', 'delicious', 'tongue'],
                    '😛': ['face', 'tongue', 'playful', 'cheeky'],
                    '😜': ['winking', 'face', 'tongue', 'playful', 'joke'],
                    '🤪': ['zany', 'face', 'crazy', 'wild', 'goofy'],
                    '😝': ['squinting', 'face', 'tongue', 'playful', 'eww'],
                    '🤑': ['money', 'mouth', 'face', 'rich', 'greedy'],
                    '🤗': ['hugging', 'face', 'hug', 'embrace'],
                    '🤭': ['face', 'hand', 'over', 'mouth', 'quiet', 'oops'],
                    '🤫': ['shushing', 'face', 'quiet', 'silence', 'secret'],
                    '🤔': ['thinking', 'face', 'hmm', 'consider', 'ponder'],
                    '🤐': ['zipper', 'mouth', 'face', 'quiet', 'sealed', 'secret'],
                    '🤨': ['face', 'raised', 'eyebrow', 'skeptical', 'suspicious'],
                    '😐': ['neutral', 'face', 'meh', 'indifferent'],
                    '😑': ['expressionless', 'face', 'blank', 'meh'],
                    '😶': ['face', 'without', 'mouth', 'quiet', 'silent'],
                    '😏': ['smirking', 'face', 'sly', 'suggestive'],
                    '😒': ['unamused', 'face', 'meh', 'annoyed'],
                    '🙄': ['face', 'rolling', 'eyes', 'annoyed', 'whatever'],
                    '😬': ['grimacing', 'face', 'awkward', 'oops'],
                    '🤥': ['lying', 'face', 'pinocchio', 'liar'],
                    '😔': ['pensive', 'face', 'sad', 'depressed', 'sorry'],
                    '😪': ['sleepy', 'face', 'tired', 'drowsy'],
                    '🤤': ['drooling', 'face', 'desire', 'hungry'],
                    '😴': ['sleeping', 'face', 'tired', 'sleep', 'zzz'],
                    '😷': ['face', 'medical', 'mask', 'sick', 'ill'],
                    '🤒': ['face', 'thermometer', 'sick', 'fever', 'ill'],
                    '🤕': ['face', 'head', 'bandage', 'hurt', 'injured'],
                    '🤢': ['nauseated', 'face', 'sick', 'green', 'vomit'],
                    '🤮': ['face', 'vomiting', 'sick', 'throw', 'up'],
                    '🤧': ['sneezing', 'face', 'sick', 'achoo'],
                    '🥵': ['hot', 'face', 'heat', 'sweating'],
                    '🥶': ['cold', 'face', 'freezing', 'blue'],
                    '🥴': ['woozy', 'face', 'drunk', 'dizzy'],
                    '😵': ['dizzy', 'face', 'dead', 'knocked', 'out'],
                    '🤯': ['exploding', 'head', 'mind', 'blown', 'shocked'],
                    '🤠': ['cowboy', 'hat', 'face', 'western'],
                    '🥳': ['partying', 'face', 'celebration', 'party', 'hat'],
                    '😎': ['smiling', 'face', 'sunglasses', 'cool'],
                    '🤓': ['nerd', 'face', 'geek', 'smart'],
                    '🧐': ['face', 'monocle', 'stuffy', 'wealthy'],
                    
                    // Nature & Animals
                    '🌱': ['seedling', 'plant', 'nature', 'grow', 'green'],
                    '🌿': ['herb', 'leaf', 'plant', 'nature', 'green'],
                    '🍃': ['leaf', 'fluttering', 'wind', 'nature', 'green'],
                    '🌳': ['deciduous', 'tree', 'nature', 'plant', 'green'],
                    '🌲': ['evergreen', 'tree', 'nature', 'plant', 'pine'],
                    '🌴': ['palm', 'tree', 'tropical', 'vacation', 'beach'],
                    '🌵': ['cactus', 'desert', 'plant', 'prickly'],
                    '🌾': ['sheaf', 'rice', 'wheat', 'grain', 'harvest'],
                    '🌻': ['sunflower', 'yellow', 'flower', 'plant'],
                    '🌺': ['hibiscus', 'flower', 'tropical', 'red'],
                    '🌸': ['cherry', 'blossom', 'flower', 'pink', 'spring'],
                    '🌼': ['daisy', 'flower', 'white', 'yellow'],
                    '🌷': ['tulip', 'flower', 'pink', 'purple', 'spring'],
                    '💐': ['bouquet', 'flowers', 'gift', 'love'],
                    '🏵️': ['rosette', 'flower', 'decoration'],
                    '🌹': ['rose', 'flower', 'red', 'love', 'romance'],
                    '🥀': ['wilted', 'flower', 'sad', 'dead'],
                    '🌊': ['water', 'wave', 'ocean', 'sea', 'blue'],
                    '💧': ['droplet', 'water', 'blue', 'tear', 'rain'],
                    '🔥': ['fire', 'flame', 'hot', 'burn', 'red', 'orange'],
                    '🐶': ['dog', 'face', 'pet', 'animal', 'puppy'],
                    '🐱': ['cat', 'face', 'pet', 'animal', 'kitten'],
                    '🐭': ['mouse', 'face', 'animal', 'rodent'],
                    '🐹': ['hamster', 'face', 'pet', 'animal'],
                    '🐰': ['rabbit', 'face', 'bunny', 'animal', 'easter'],
                    '🦊': ['fox', 'face', 'animal', 'clever'],
                    '🐻': ['bear', 'face', 'animal', 'teddy'],
                    '🐼': ['panda', 'face', 'animal', 'black', 'white'],
                    '🐨': ['koala', 'face', 'animal', 'australia'],
                    '🐯': ['tiger', 'face', 'animal', 'cat', 'stripes'],
                    '🦁': ['lion', 'face', 'animal', 'king', 'mane'],
                    '🐮': ['cow', 'face', 'animal', 'moo', 'cattle', 'dairy'],
                    '🐷': ['pig', 'face', 'animal', 'oink', 'swine', 'hog'],
                    '🐸': ['frog', 'face', 'animal', 'amphibian', 'green'],
                    '🐵': ['monkey', 'face', 'animal', 'primate', 'banana'],
                    '🙈': ['see', 'no', 'evil', 'monkey', 'hands', 'eyes'],
                    '🙉': ['hear', 'no', 'evil', 'monkey', 'hands', 'ears'],
                    '🙊': ['speak', 'no', 'evil', 'monkey', 'hands', 'mouth'],
                    '🐒': ['monkey', 'animal', 'primate', 'jungle'],
                    '🐔': ['chicken', 'animal', 'bird', 'poultry', 'farm'],
                    '🐧': ['penguin', 'animal', 'bird', 'antarctic', 'cold'],
                    '🐦': ['bird', 'animal', 'flying', 'wings'],
                    '🐤': ['baby', 'chick', 'bird', 'yellow', 'cute'],
                    '🐣': ['hatching', 'chick', 'bird', 'egg', 'baby'],
                    '🐥': ['front', 'facing', 'baby', 'chick', 'bird'],
                    '🦆': ['duck', 'bird', 'animal', 'water', 'quack'],
                    '🦅': ['eagle', 'bird', 'animal', 'flying', 'majestic'],
                    '🦉': ['owl', 'bird', 'animal', 'wise', 'night'],
                    '🦇': ['bat', 'animal', 'flying', 'vampire', 'night'],
                    '🐺': ['wolf', 'face', 'animal', 'wild', 'howl'],
                    '🐗': ['boar', 'animal', 'wild', 'pig', 'tusks'],
                    '🐴': ['horse', 'face', 'animal', 'stallion', 'mare'],
                    '🦄': ['unicorn', 'face', 'animal', 'magical', 'horn'],
                    '🐝': ['honeybee', 'bee', 'insect', 'honey', 'buzz'],
                    '🐛': ['bug', 'insect', 'caterpillar', 'crawling'],
                    '🦋': ['butterfly', 'insect', 'beautiful', 'flying', 'colorful'],
                    '🐌': ['snail', 'animal', 'slow', 'shell', 'spiral'],
                    '🐞': ['lady', 'beetle', 'bug', 'insect', 'red', 'spots'],
                    '🐜': ['ant', 'insect', 'small', 'worker', 'colony'],
                    '🦟': ['mosquito', 'insect', 'flying', 'annoying', 'bite'],
                    '🦗': ['cricket', 'insect', 'chirp', 'sound'],
                    '🕷️': ['spider', 'arachnid', 'web', 'eight', 'legs'],
                    '🕸️': ['spider', 'web', 'net', 'trap', 'silk'],
                    '🦂': ['scorpion', 'arachnid', 'sting', 'desert', 'dangerous'],
                    '🐢': ['turtle', 'animal', 'slow', 'shell', 'reptile'],
                    '🐍': ['snake', 'animal', 'reptile', 'slither', 'serpent'],
                    '🦎': ['lizard', 'animal', 'reptile', 'gecko', 'scales'],
                    '🦖': ['t-rex', 'dinosaur', 'extinct', 'prehistoric', 'big'],
                    '🦕': ['sauropod', 'dinosaur', 'extinct', 'long', 'neck'],
                    '🐙': ['octopus', 'animal', 'sea', 'tentacles', 'eight'],
                    '🦑': ['squid', 'animal', 'sea', 'tentacles', 'ink'],
                    '🦐': ['shrimp', 'animal', 'sea', 'seafood', 'small'],
                    '🦞': ['lobster', 'animal', 'sea', 'seafood', 'claws'],
                    '🦀': ['crab', 'animal', 'sea', 'seafood', 'claws'],
                    '🐡': ['blowfish', 'fish', 'animal', 'sea', 'pufferfish'],
                    '🐠': ['tropical', 'fish', 'animal', 'sea', 'colorful'],
                    '🐟': ['fish', 'animal', 'sea', 'swimming'],
                    '🐬': ['dolphin', 'animal', 'sea', 'intelligent', 'friendly'],
                    '🐳': ['spouting', 'whale', 'animal', 'sea', 'large'],
                    '🐋': ['whale', 'animal', 'sea', 'huge', 'mammal'],
                    '🦈': ['shark', 'animal', 'sea', 'dangerous', 'predator'],
                    '🐊': ['crocodile', 'animal', 'reptile', 'dangerous', 'teeth'],
                    '🐅': ['tiger', 'animal', 'cat', 'stripes', 'wild'],
                    '🐆': ['leopard', 'animal', 'cat', 'spots', 'wild'],
                    '🦓': ['zebra', 'animal', 'stripes', 'black', 'white'],
                    '🦍': ['gorilla', 'animal', 'primate', 'strong', 'ape'],
                    '🦧': ['orangutan', 'animal', 'primate', 'ape', 'orange'],
                    '🐘': ['elephant', 'animal', 'large', 'trunk', 'memory'],
                    '🦛': ['hippopotamus', 'hippo', 'animal', 'water', 'large'],
                    '🦏': ['rhinoceros', 'rhino', 'animal', 'horn', 'thick'],
                    '🐪': ['camel', 'animal', 'desert', 'hump', 'one'],
                    '🐫': ['two', 'hump', 'camel', 'animal', 'desert'],
                    '🦒': ['giraffe', 'animal', 'tall', 'long', 'neck'],
                    '🦘': ['kangaroo', 'animal', 'jumping', 'pouch', 'australia'],
                    '🐃': ['water', 'buffalo', 'animal', 'horns'],
                    '🐂': ['ox', 'animal', 'bull', 'horns', 'strong'],
                    '🐄': ['cow', 'animal', 'dairy', 'moo', 'milk'],
                    '🐎': ['horse', 'animal', 'racing', 'fast', 'gallop'],
                    '🐖': ['pig', 'animal', 'farm', 'pink', 'oink'],
                    '🐏': ['ram', 'animal', 'sheep', 'horns', 'male'],
                    '🐑': ['ewe', 'sheep', 'animal', 'wool', 'fluffy'],
                    '🦙': ['llama', 'animal', 'fluffy', 'south', 'america'],
                    '🐐': ['goat', 'animal', 'horns', 'climbing'],
                    '🦌': ['deer', 'animal', 'antlers', 'forest', 'graceful'],
                    '🐕': ['dog', 'animal', 'pet', 'loyal', 'woof'],
                    '🐩': ['poodle', 'dog', 'animal', 'pet', 'curly'],
                    '🦮': ['guide', 'dog', 'animal', 'service', 'blind'],
                    '🐕‍🦺': ['service', 'dog', 'animal', 'working', 'vest'],
                    '🐈': ['cat', 'animal', 'pet', 'meow', 'feline'],
                    '🐓': ['rooster', 'chicken', 'bird', 'male', 'crow'],
                    '🦃': ['turkey', 'bird', 'animal', 'thanksgiving'],
                    '🦚': ['peacock', 'bird', 'animal', 'colorful', 'beautiful'],
                    '🦜': ['parrot', 'bird', 'animal', 'colorful', 'talking'],
                    '🦢': ['swan', 'bird', 'animal', 'elegant', 'white'],
                    '🦩': ['flamingo', 'bird', 'animal', 'pink', 'long'],
                    '🕊️': ['dove', 'bird', 'animal', 'peace', 'white'],
                    '🐇': ['rabbit', 'animal', 'bunny', 'hop', 'ears'],
                    '🦝': ['raccoon', 'animal', 'mask', 'bandit', 'trash'],
                    '🦨': ['skunk', 'animal', 'smell', 'black', 'white'],
                    '🦡': ['badger', 'animal', 'digging', 'underground'],
                    '🦦': ['otter', 'animal', 'water', 'playful', 'cute'],
                    '🦥': ['sloth', 'animal', 'slow', 'lazy', 'tree'],
                    '🐁': ['mouse', 'animal', 'small', 'rodent', 'cheese'],
                    '🐀': ['rat', 'animal', 'rodent', 'city', 'pest'],
                    '🐿️': ['chipmunk', 'squirrel', 'animal', 'nuts', 'tree'],
                    '🌋': ['volcano', 'mountain', 'fire', 'lava', 'eruption'],
                    
                    // Food & Drink
                    '🍎': ['red', 'apple', 'fruit', 'healthy', 'food'],
                    '🍊': ['tangerine', 'orange', 'fruit', 'citrus'],
                    '🍋': ['lemon', 'fruit', 'yellow', 'sour', 'citrus'],
                    '🍌': ['banana', 'fruit', 'yellow', 'monkey'],
                    '🍉': ['watermelon', 'fruit', 'summer', 'red', 'green'],
                    '🍇': ['grapes', 'fruit', 'purple', 'wine'],
                    '🍓': ['strawberry', 'fruit', 'red', 'berry'],
                    '🍈': ['melon', 'fruit', 'green', 'cantaloupe'],
                    '🍒': ['cherries', 'fruit', 'red', 'pair'],
                    '🍑': ['peach', 'fruit', 'orange', 'fuzzy'],
                    '🥭': ['mango', 'fruit', 'tropical', 'orange'],
                    '🍍': ['pineapple', 'fruit', 'tropical', 'yellow'],
                    '🥥': ['coconut', 'fruit', 'tropical', 'brown'],
                    '🥝': ['kiwi', 'fruit', 'green', 'fuzzy'],
                    '🍅': ['tomato', 'red', 'vegetable', 'fruit'],
                    '🍆': ['eggplant', 'aubergine', 'purple', 'vegetable'],
                    '🥑': ['avocado', 'fruit', 'green', 'healthy'],
                    '🥦': ['broccoli', 'vegetable', 'green', 'healthy'],
                    '🥬': ['leafy', 'greens', 'lettuce', 'salad'],
                    '🥒': ['cucumber', 'vegetable', 'green', 'pickle'],
                    '🌶️': ['hot', 'pepper', 'spicy', 'red', 'chili'],
                    '🌽': ['corn', 'maize', 'vegetable', 'yellow', 'kernels'],
                    '🥕': ['carrot', 'vegetable', 'orange', 'root', 'healthy'],
                    '🧄': ['garlic', 'vegetable', 'white', 'clove', 'aromatic'],
                    '🧅': ['onion', 'vegetable', 'layers', 'tears', 'cooking'],
                    '🥔': ['potato', 'vegetable', 'brown', 'tuber', 'starchy'],
                    '🍠': ['roasted', 'sweet', 'potato', 'orange', 'vegetable'],
                    '🥐': ['croissant', 'bread', 'french', 'buttery', 'pastry'],
                    '🥯': ['bagel', 'bread', 'round', 'hole', 'breakfast'],
                    '🍞': ['bread', 'loaf', 'slice', 'wheat', 'carbs'],
                    '🥖': ['baguette', 'bread', 'french', 'long', 'crusty'],
                    '🥨': ['pretzel', 'bread', 'twisted', 'salty', 'german'],
                    '🧀': ['cheese', 'dairy', 'yellow', 'wedge', 'holes'],
                    '🥚': ['egg', 'white', 'protein', 'chicken', 'oval'],
                    '🍳': ['cooking', 'egg', 'fried', 'sunny', 'side', 'up'],
                    '🧈': ['butter', 'dairy', 'yellow', 'spread', 'creamy'],
                    '🥞': ['pancakes', 'breakfast', 'stack', 'syrup', 'fluffy'],
                    '🧇': ['waffle', 'breakfast', 'square', 'syrup', 'crispy'],
                    '🥓': ['bacon', 'meat', 'pork', 'strips', 'crispy'],
                    '🥩': ['cut', 'meat', 'steak', 'raw', 'red'],
                    '🍗': ['poultry', 'leg', 'chicken', 'drumstick', 'meat'],
                    '🍖': ['meat', 'on', 'bone', 'barbecue', 'ribs'],
                    '🦴': ['bone', 'skeleton', 'white', 'dog', 'chew'],
                    '🌭': ['hot', 'dog', 'sausage', 'bun', 'mustard'],
                    '🍔': ['hamburger', 'burger', 'meat', 'bun', 'fast', 'food'],
                    '🍟': ['french', 'fries', 'potato', 'golden', 'crispy'],
                    '🍕': ['pizza', 'slice', 'cheese', 'italian', 'pepperoni'],
                    '🥪': ['sandwich', 'bread', 'filling', 'lunch', 'sub'],
                    '🥙': ['stuffed', 'flatbread', 'pita', 'wrap', 'middle', 'east'],
                    '🌮': ['taco', 'shell', 'meat', 'mexican', 'spicy'],
                    '🌯': ['burrito', 'wrap', 'tortilla', 'mexican', 'filling'],
                    '🥗': ['green', 'salad', 'healthy', 'lettuce', 'vegetables'],
                    '🥘': ['shallow', 'pan', 'food', 'paella', 'cooking'],
                    '🥫': ['canned', 'food', 'tin', 'preserved', 'soup'],
                    '🍝': ['spaghetti', 'pasta', 'italian', 'noodles', 'fork'],
                    '🍜': ['steaming', 'bowl', 'ramen', 'noodles', 'soup'],
                    '🍲': ['pot', 'food', 'stew', 'cooking', 'hot'],
                    '🍛': ['curry', 'rice', 'indian', 'spicy', 'bowl'],
                    '🍣': ['sushi', 'japanese', 'fish', 'rice', 'raw'],
                    '🍱': ['bento', 'box', 'japanese', 'lunch', 'compartments'],
                    '🥟': ['dumpling', 'gyoza', 'steamed', 'filled', 'asian'],
                    '🦪': ['oyster', 'shellfish', 'sea', 'pearl', 'aphrodisiac'],
                    '🍤': ['fried', 'shrimp', 'tempura', 'seafood', 'crispy'],
                    '🍙': ['rice', 'ball', 'onigiri', 'japanese', 'seaweed'],
                    '🍚': ['cooked', 'rice', 'white', 'bowl', 'grain'],
                    '🍘': ['rice', 'cracker', 'japanese', 'senbei', 'crunchy'],
                    '🍥': ['fish', 'cake', 'swirl', 'pink', 'white'],
                    '🥠': ['fortune', 'cookie', 'message', 'crispy', 'prediction'],
                    '🥮': ['moon', 'cake', 'chinese', 'festival', 'round'],
                    '🍢': ['oden', 'skewer', 'japanese', 'hot', 'pot'],
                    '🍡': ['dango', 'sweet', 'japanese', 'skewer', 'colorful'],
                    '🍧': ['shaved', 'ice', 'cold', 'sweet', 'flavored'],
                    '🍨': ['ice', 'cream', 'cold', 'sweet', 'dessert'],
                    '🍦': ['soft', 'ice', 'cream', 'swirl', 'cone'],
                    '🥧': ['pie', 'dessert', 'crust', 'filling', 'slice'],
                    '🧁': ['cupcake', 'muffin', 'frosting', 'small', 'cake'],
                    '🍰': ['shortcake', 'dessert', 'slice', 'cream', 'sweet'],
                    '🎂': ['birthday', 'cake', 'candles', 'celebration', 'party'],
                    '🍮': ['custard', 'pudding', 'flan', 'sweet', 'creamy'],
                    '🍭': ['lollipop', 'candy', 'sweet', 'stick', 'colorful'],
                    '🍬': ['candy', 'sweet', 'wrapped', 'sugar', 'treat'],
                    '🍫': ['chocolate', 'bar', 'sweet', 'cocoa', 'dark'],
                    '🍿': ['popcorn', 'movie', 'kernels', 'snack', 'butter'],
                    '🍩': ['doughnut', 'donut', 'sweet', 'fried', 'glazed'],
                    '🍪': ['cookie', 'biscuit', 'sweet', 'chocolate', 'chip'],
                    '🌰': ['chestnut', 'nut', 'brown', 'shell', 'autumn'],
                    '🥜': ['peanuts', 'nuts', 'shell', 'protein', 'salty'],
                    '🍯': ['honey', 'pot', 'sweet', 'bee', 'golden'],
                    '🥛': ['glass', 'milk', 'white', 'dairy', 'calcium'],
                    '🍼': ['baby', 'bottle', 'milk', 'feeding', 'nipple'],
                    '☕': ['hot', 'beverage', 'coffee', 'caffeine', 'steam'],
                    '🍵': ['teacup', 'without', 'handle', 'green', 'tea'],
                    '🧃': ['beverage', 'box', 'juice', 'straw', 'drink'],
                    '🥤': ['cup', 'straw', 'soda', 'drink', 'cold'],
                    '🍶': ['sake', 'bottle', 'cup', 'japanese', 'rice', 'wine'],
                    '🍺': ['beer', 'mug', 'alcohol', 'foam', 'drink'],
                    '🍻': ['clinking', 'beer', 'mugs', 'cheers', 'celebration'],
                    '🥂': ['clinking', 'glasses', 'champagne', 'toast', 'celebration'],
                    '🍷': ['wine', 'glass', 'red', 'alcohol', 'grape'],
                    '🥃': ['tumbler', 'glass', 'whiskey', 'alcohol', 'ice'],
                    '🍸': ['cocktail', 'glass', 'martini', 'alcohol', 'olive'],
                    '🍹': ['tropical', 'drink', 'cocktail', 'fruity', 'umbrella'],
                    
                    // Activities & Sports
                    '⚽': ['soccer', 'ball', 'football', 'sport', 'black', 'white'],
                    '🏀': ['basketball', 'ball', 'sport', 'orange'],
                    '🏈': ['american', 'football', 'ball', 'sport', 'brown'],
                    '⚾': ['baseball', 'ball', 'sport', 'white'],
                    '🥎': ['softball', 'ball', 'sport', 'yellow'],
                    '🎾': ['tennis', 'ball', 'sport', 'green'],
                    '🏐': ['volleyball', 'ball', 'sport', 'white'],
                    '🏉': ['rugby', 'football', 'ball', 'sport'],
                    '🥏': ['flying', 'disc', 'frisbee', 'sport'],
                    '🎱': ['pool', '8', 'ball', 'billiards', 'black'],
                    '🏆': ['trophy', 'award', 'winner', 'gold', 'champion'],
                    '🥇': ['1st', 'place', 'medal', 'gold', 'winner'],
                    '🥈': ['2nd', 'place', 'medal', 'silver', 'runner', 'up'],
                    '🥉': ['3rd', 'place', 'medal', 'bronze', 'third'],
                    '🏅': ['sports', 'medal', 'award', 'winner', 'ribbon'],
                    '🎖️': ['military', 'medal', 'honor', 'award', 'service'],
                    '🏵️': ['rosette', 'flower', 'decoration', 'award'],
                    '🎗️': ['reminder', 'ribbon', 'awareness', 'cause'],
                    '🎫': ['ticket', 'admission', 'event', 'stub'],
                    '🎟️': ['admission', 'tickets', 'event', 'entrance'],
                    '🎪': ['circus', 'tent', 'entertainment', 'show'],
                    '🤹‍♀️': ['woman', 'juggling', 'performer', 'circus'],
                    '🤹': ['person', 'juggling', 'performer', 'circus'],
                    '🤹‍♂️': ['man', 'juggling', 'performer', 'circus'],
                    '🎭': ['performing', 'arts', 'theater', 'masks'],
                    '🩰': ['ballet', 'shoes', 'dance', 'performance'],
                    '🎨': ['artist', 'palette', 'paint', 'creative'],
                    '🎬': ['clapper', 'board', 'movie', 'film', 'action'],
                    '🎤': ['microphone', 'singing', 'karaoke', 'performance'],
                    '🎧': ['headphone', 'music', 'listening', 'audio'],
                    '🎼': ['musical', 'score', 'notes', 'composition'],
                    '🎵': ['musical', 'note', 'music', 'sound'],
                    '🎶': ['musical', 'notes', 'music', 'melody'],
                    '🥁': ['drum', 'drumsticks', 'percussion', 'music'],
                    '🪘': ['long', 'drum', 'percussion', 'music'],
                    '🎹': ['musical', 'keyboard', 'piano', 'keys'],
                    '🎷': ['saxophone', 'music', 'instrument', 'jazz'],
                    '🎺': ['trumpet', 'music', 'instrument', 'brass'],
                    '🎸': ['guitar', 'music', 'instrument', 'strings'],
                    '🪕': ['banjo', 'music', 'instrument', 'strings'],
                    '🎻': ['violin', 'music', 'instrument', 'strings'],
                    '🎲': ['game', 'die', 'dice', 'random', 'luck'],
                    '♠️': ['spade', 'suit', 'cards', 'black'],
                    '♥️': ['heart', 'suit', 'cards', 'red', 'love'],
                    '♦️': ['diamond', 'suit', 'cards', 'red'],
                    '♣️': ['club', 'suit', 'cards', 'black'],
                    '♟️': ['chess', 'pawn', 'game', 'strategy'],
                    '🃏': ['joker', 'playing', 'card', 'wild'],
                    '🀄': ['mahjong', 'red', 'dragon', 'tile'],
                    '🎴': ['flower', 'playing', 'cards', 'japanese'],
                    '🎯': ['bullseye', 'target', 'dart', 'aim'],
                    '🎳': ['bowling', 'pins', 'strike', 'sport'],
                    '🪀': ['yo-yo', 'toy', 'string', 'up', 'down'],
                    '🏓': ['ping', 'pong', 'table', 'tennis', 'paddle'],
                    '🏸': ['badminton', 'racquet', 'shuttlecock'],
                    '🏒': ['ice', 'hockey', 'stick', 'puck'],
                    '🏑': ['field', 'hockey', 'stick', 'ball'],
                    '🥍': ['lacrosse', 'stick', 'net', 'ball'],
                    '🏏': ['cricket', 'bat', 'ball', 'wicket'],
                    '🪃': ['boomerang', 'curved', 'stick', 'return'],
                    '🥅': ['goal', 'net', 'soccer', 'hockey'],
                    '⛳': ['flag', 'hole', 'golf', 'course'],
                    '🪁': ['kite', 'flying', 'wind', 'string'],
                    '🏹': ['bow', 'arrow', 'archery', 'target'],
                    '🎣': ['fishing', 'pole', 'hook', 'catch'],
                    '🤿': ['diving', 'mask', 'snorkel', 'underwater'],
                    '🥊': ['boxing', 'glove', 'fight', 'punch'],
                    '🥋': ['martial', 'arts', 'uniform', 'karate'],
                    '🎽': ['running', 'shirt', 'athletics', 'marathon'],
                    '🛹': ['skateboard', 'wheels', 'tricks', 'sport'],
                    '🛷': ['sled', 'snow', 'winter', 'sledding'],
                    '⛸️': ['ice', 'skate', 'winter', 'sport'],
                    '🥌': ['curling', 'stone', 'ice', 'sport'],
                    '🎿': ['skis', 'snow', 'winter', 'sport'],
                    '⛷️': ['skier', 'snow', 'winter', 'sport'],
                    '🏂': ['snowboarder', 'snow', 'winter', 'sport'],
                    '🪂': ['parachute', 'skydiving', 'falling', 'air'],
                    
                    // Travel & Places
                    '🚗': ['automobile', 'car', 'vehicle', 'red'],
                    '🚕': ['taxi', 'car', 'vehicle', 'yellow'],
                    '🚙': ['sport', 'utility', 'vehicle', 'suv', 'blue'],
                    '🚌': ['bus', 'vehicle', 'public', 'transport'],
                    '🚎': ['trolleybus', 'vehicle', 'electric'],
                    '🏎️': ['racing', 'car', 'formula', 'one', 'fast'],
                    '🚓': ['police', 'car', 'vehicle', 'law'],
                    '🚑': ['ambulance', 'vehicle', 'medical', 'emergency'],
                    '🚒': ['fire', 'engine', 'truck', 'emergency', 'red'],
                    '🚐': ['minibus', 'van', 'vehicle'],
                    '🛻': ['pickup', 'truck', 'vehicle'],
                    '🚚': ['delivery', 'truck', 'vehicle', 'cargo'],
                    '🚛': ['articulated', 'lorry', 'truck', 'big'],
                    '🚜': ['tractor', 'farm', 'vehicle', 'agriculture'],
                    '🏍️': ['motorcycle', 'bike', 'vehicle', 'fast'],
                    '🛵': ['motor', 'scooter', 'vehicle', 'vespa'],
                    '🚲': ['bicycle', 'bike', 'vehicle', 'pedal'],
                    '🛴': ['kick', 'scooter', 'vehicle'],
                    '🛹': ['skateboard', 'wheels', 'sport', 'trick'],
                    '🛼': ['roller', 'skate', 'wheels', 'sport'],
                    '🚁': ['helicopter', 'aircraft', 'rotor', 'flying'],
                    '🚟': ['suspension', 'railway', 'monorail'],
                    '🚠': ['mountain', 'cableway', 'ski', 'lift'],
                    '🚡': ['aerial', 'tramway', 'cable', 'car'],
                    '⛴️': ['ferry', 'boat', 'water', 'transport'],
                    '🛥️': ['motor', 'boat', 'speedboat', 'water'],
                    '🚤': ['speedboat', 'fast', 'water', 'boat'],
                    '⛵': ['sailboat', 'sailing', 'wind', 'water'],
                    '🛶': ['canoe', 'paddle', 'water', 'kayak'],
                    '🚀': ['rocket', 'space', 'launch', 'fast'],
                    '🛸': ['flying', 'saucer', 'ufo', 'alien'],
                    '💺': ['seat', 'chair', 'airplane', 'travel'],
                    '🚂': ['locomotive', 'train', 'steam', 'engine'],
                    '🚆': ['train', 'railway', 'transport', 'fast'],
                    '🚄': ['high', 'speed', 'train', 'bullet'],
                    '🚅': ['bullet', 'train', 'fast', 'japan'],
                    '🚈': ['light', 'rail', 'train', 'city'],
                    '🚝': ['monorail', 'train', 'elevated'],
                    '🚞': ['mountain', 'railway', 'train', 'cog'],
                    '🚋': ['tram', 'car', 'trolley', 'city'],
                    '🚃': ['railway', 'car', 'train', 'carriage'],
                    '🚖': ['oncoming', 'taxi', 'yellow', 'car'],
                    '🚘': ['oncoming', 'automobile', 'car'],
                    '🚍': ['oncoming', 'bus', 'transport'],
                    '🚔': ['oncoming', 'police', 'car', 'law'],
                    '🚨': ['police', 'car', 'light', 'siren'],
                    '🚥': ['horizontal', 'traffic', 'light'],
                    '🚦': ['vertical', 'traffic', 'light'],
                    '🚧': ['construction', 'barrier', 'work'],
                    '⚓': ['anchor', 'ship', 'boat', 'heavy'],
                    '⛽': ['fuel', 'pump', 'gas', 'station'],
                    '🚏': ['bus', 'stop', 'sign', 'waiting'],
                    '🗿': ['moai', 'statue', 'easter', 'island'],
                    '🗽': ['statue', 'liberty', 'new', 'york'],
                    '🗼': ['tokyo', 'tower', 'landmark', 'japan'],
                    '🏰': ['castle', 'european', 'fortress', 'medieval'],
                    '🏯': ['japanese', 'castle', 'pagoda', 'temple'],
                    '🏟️': ['stadium', 'sports', 'arena', 'coliseum'],
                    '🎡': ['ferris', 'wheel', 'amusement', 'park'],
                    '🎢': ['roller', 'coaster', 'amusement', 'thrill'],
                    '🎠': ['carousel', 'horse', 'merry', 'round'],
                    '⛲': ['fountain', 'water', 'park', 'decorative'],
                    '⛱️': ['umbrella', 'beach', 'sun', 'vacation'],
                    '🏖️': ['beach', 'umbrella', 'sand', 'vacation'],
                    '🏝️': ['desert', 'island', 'palm', 'tree'],
                    '🏜️': ['desert', 'sand', 'hot', 'dry'],
                    '🌋': ['volcano', 'mountain', 'fire', 'lava'],
                    '⛰️': ['mountain', 'peak', 'high', 'rocky'],
                    '🏔️': ['snow', 'capped', 'mountain', 'cold'],
                    '🗻': ['mount', 'fuji', 'mountain', 'japan'],
                    '🏕️': ['camping', 'tent', 'outdoors', 'nature'],
                    '⛺': ['tent', 'camping', 'outdoors', 'shelter'],
                    '🛖': ['hut', 'house', 'primitive', 'shelter'],
                    
                    // Objects & Technology
                    '💡': ['light', 'bulb', 'idea', 'bright', 'innovation'],
                    '🔦': ['flashlight', 'torch', 'light', 'dark'],
                    '🏮': ['red', 'paper', 'lantern', 'light', 'asian'],
                    '🪔': ['diya', 'lamp', 'light', 'oil'],
                    '📱': ['mobile', 'phone', 'cell', 'smartphone', 'iphone'],
                    '💻': ['laptop', 'computer', 'pc', 'technology', 'macbook'],
                    '🖥️': ['desktop', 'computer', 'pc', 'monitor'],
                    '🖨️': ['printer', 'office', 'paper', 'ink'],
                    '⌨️': ['keyboard', 'type', 'computer', 'keys'],
                    '🖱️': ['computer', 'mouse', 'click', 'pointer'],
                    '🖲️': ['trackball', 'computer', 'mouse'],
                    '💾': ['floppy', 'disk', 'save', 'storage', 'computer'],
                    '💿': ['optical', 'disk', 'cd', 'music'],
                    '📀': ['dvd', 'disk', 'movie', 'blue', 'ray'],
                    '☎️': ['telephone', 'phone', 'call', 'old'],
                    '📞': ['telephone', 'receiver', 'phone', 'call'],
                    '📟': ['pager', 'beeper', 'communication'],
                    '📠': ['fax', 'machine', 'office', 'paper'],
                    '📺': ['television', 'tv', 'screen', 'watch'],
                    '📻': ['radio', 'music', 'listen', 'antenna'],
                    '🎙️': ['studio', 'microphone', 'broadcast', 'recording'],
                    '🎚️': ['level', 'slider', 'audio', 'control'],
                    '🎛️': ['control', 'knobs', 'mixing', 'board'],
                    '🧭': ['compass', 'navigation', 'direction', 'magnetic'],
                    '⏱️': ['stopwatch', 'timer', 'chronometer', 'time'],
                    '⏲️': ['timer', 'clock', 'countdown', 'alarm'],
                    '⏰': ['alarm', 'clock', 'time', 'wake', 'up'],
                    '🕰️': ['mantelpiece', 'clock', 'time', 'antique'],
                    '⏳': ['hourglass', 'flowing', 'sand', 'time'],
                    '⌛': ['hourglass', 'done', 'sand', 'time'],
                    '📡': ['satellite', 'antenna', 'communication', 'dish'],
                    '🔋': ['battery', 'power', 'energy', 'charge'],
                    '🔌': ['electric', 'plug', 'power', 'socket'],
                    '🕯️': ['candle', 'light', 'flame', 'wax'],
                    '🧯': ['fire', 'extinguisher', 'safety', 'emergency'],
                    '🛢️': ['oil', 'drum', 'barrel', 'petroleum'],
                    '💸': ['money', 'wings', 'flying', 'expensive'],
                    '💵': ['dollar', 'banknote', 'money', 'usa'],
                    '💴': ['yen', 'banknote', 'money', 'japan'],
                    '💶': ['euro', 'banknote', 'money', 'europe'],
                    '💷': ['pound', 'banknote', 'money', 'uk'],
                    '💰': ['money', 'bag', 'dollar', 'rich'],
                    '💳': ['credit', 'card', 'payment', 'plastic'],
                    '💎': ['gem', 'stone', 'diamond', 'precious'],
                    '⚖️': ['balance', 'scale', 'justice', 'law'],
                    '🧰': ['toolbox', 'tools', 'repair', 'kit'],
                    '🔧': ['wrench', 'tool', 'repair', 'fix'],
                    '🔨': ['hammer', 'tool', 'nail', 'build'],
                    '⚒️': ['hammer', 'pick', 'tools', 'mining'],
                    '🛠️': ['hammer', 'wrench', 'tools', 'repair'],
                    '⛏️': ['pick', 'tool', 'mining', 'dig'],
                    '🔩': ['nut', 'bolt', 'screw', 'hardware'],
                    '⚙️': ['gear', 'cog', 'settings', 'mechanical'],
                    '🧱': ['brick', 'wall', 'construction', 'building'],
                    '⛓️': ['chains', 'link', 'metal', 'strong'],
                    '🧲': ['magnet', 'attraction', 'magnetic', 'horseshoe'],
                    '🔫': ['pistol', 'gun', 'weapon', 'water'],
                    '💣': ['bomb', 'explosive', 'dangerous', 'round'],
                    '🧨': ['firecracker', 'dynamite', 'explosive', 'red'],
                    '🪓': ['axe', 'tool', 'wood', 'chop'],
                    '🔪': ['kitchen', 'knife', 'blade', 'cut'],
                    '🗡️': ['dagger', 'knife', 'weapon', 'blade'],
                    '⚔️': ['crossed', 'swords', 'weapons', 'battle'],
                    '🛡️': ['shield', 'protection', 'defense', 'guard'],
                    '🚬': ['cigarette', 'smoking', 'tobacco', 'bad'],
                    '⚰️': ['coffin', 'death', 'funeral', 'burial'],
                    '⚱️': ['funeral', 'urn', 'death', 'ashes'],
                    '🏺': ['amphora', 'jar', 'pottery', 'ancient'],
                    '🔮': ['crystal', 'ball', 'fortune', 'future'],
                    '📿': ['prayer', 'beads', 'religion', 'meditation'],
                    '🧿': ['nazar', 'amulet', 'evil', 'eye'],
                    '💈': ['barber', 'pole', 'haircut', 'stripe'],
                    '⚗️': ['alembic', 'chemistry', 'distilling', 'lab'],
                    '🔭': ['telescope', 'astronomy', 'stars', 'space'],
                    '🔬': ['microscope', 'science', 'lab', 'biology'],
                    '🕳️': ['hole', 'opening', 'dark', 'deep'],
                    '🩹': ['adhesive', 'bandage', 'medical', 'first', 'aid'],
                    '🩺': ['stethoscope', 'medical', 'doctor', 'heart'],
                    '💊': ['pill', 'medicine', 'drug', 'capsule'],
                    '💉': ['syringe', 'injection', 'medical', 'needle'],
                    '🧬': ['dna', 'genetics', 'double', 'helix'],
                    '🦠': ['microbe', 'virus', 'bacteria', 'germ'],
                    '🧫': ['petri', 'dish', 'lab', 'culture'],
                    '🧪': ['test', 'tube', 'lab', 'chemistry'],
                    '🌡️': ['thermometer', 'temperature', 'hot', 'cold'],
                    '🧹': ['broom', 'cleaning', 'sweep', 'witch'],
                    '🧺': ['basket', 'laundry', 'wicker', 'storage'],
                    '🧻': ['roll', 'paper', 'toilet', 'tissue'],
                    '🚽': ['toilet', 'bathroom', 'restroom', 'loo'],
                    '🚰': ['potable', 'water', 'drinking', 'fountain'],
                    '🚿': ['shower', 'bath', 'water', 'clean'],
                    '🛁': ['bathtub', 'bath', 'relax', 'soak'],
                    '🛀': ['person', 'taking', 'bath', 'relax'],
                    '🧴': ['lotion', 'bottle', 'shampoo', 'soap'],
                    '🧷': ['safety', 'pin', 'diaper', 'fastener'],
                    '🧼': ['soap', 'bar', 'cleaning', 'wash'],
                    '🧽': ['sponge', 'cleaning', 'absorb', 'wash'],
                    '🛒': ['shopping', 'cart', 'trolley', 'store'],
                    '🚭': ['no', 'smoking', 'cigarette', 'prohibited'],
                    
                    // Symbols & Shapes
                    '🔴': ['red', 'circle', 'round', 'dot', 'color', 'stop'],
                    '🟠': ['orange', 'circle', 'round', 'dot', 'color'],
                    '🟡': ['yellow', 'circle', 'round', 'dot', 'color', 'sun'],
                    '🟢': ['green', 'circle', 'round', 'dot', 'color', 'go'],
                    '🔵': ['blue', 'circle', 'round', 'dot', 'color', 'cold'],
                    '🟣': ['purple', 'circle', 'round', 'dot', 'color', 'violet'],
                    '🟤': ['brown', 'circle', 'round', 'dot', 'color', 'earth'],
                    '⚫': ['black', 'circle', 'round', 'dot', 'color', 'dark'],
                    '⚪': ['white', 'circle', 'round', 'dot', 'color', 'light'],
                    '🟥': ['red', 'large', 'square', 'block', 'color'],
                    '🟧': ['orange', 'large', 'square', 'block', 'color'],
                    '🟨': ['yellow', 'large', 'square', 'block', 'color'],
                    '🟩': ['green', 'large', 'square', 'block', 'color'],
                    '🟦': ['blue', 'large', 'square', 'block', 'color'],
                    '🟪': ['purple', 'large', 'square', 'block', 'color'],
                    '🟫': ['brown', 'large', 'square', 'block', 'color'],
                    '⬛': ['black', 'large', 'square', 'block', 'color'],
                    '⬜': ['white', 'large', 'square', 'block', 'color'],
                    '◼️': ['black', 'medium', 'square', 'block'],
                    '◻️': ['white', 'medium', 'square', 'block'],
                    '◾': ['black', 'medium', 'small', 'square'],
                    '◽': ['white', 'medium', 'small', 'square'],
                    '▪️': ['black', 'small', 'square'],
                    '▫️': ['white', 'small', 'square'],
                    '🔶': ['large', 'orange', 'diamond'],
                    '🔷': ['large', 'blue', 'diamond'],
                    '🔸': ['small', 'orange', 'diamond'],
                    '🔹': ['small', 'blue', 'diamond'],
                    '🔺': ['red', 'triangle', 'pointed', 'up'],
                    '🔻': ['red', 'triangle', 'pointed', 'down'],
                    '💠': ['diamond', 'flower', 'blue'],
                    '🔘': ['radio', 'button', 'circle'],
                    '🔳': ['white', 'square', 'button'],
                    '�': ['black', 'square', 'button'],
                    '⭐': ['star', 'yellow', 'bright', 'favorite'],
                    '🌟': ['glowing', 'star', 'sparkle', 'shine'],
                    '💫': ['dizzy', 'star', 'sparkle'],
                    '⚡': ['high', 'voltage', 'lightning', 'electric', 'fast'],
                    '💥': ['collision', 'explosion', 'boom', 'bang'],
                    '💯': ['hundred', 'points', '100', 'percent', 'perfect'],
                    '💨': ['dashing', 'away', 'wind', 'fast', 'smoke'],
                    '💦': ['sweat', 'droplets', 'water', 'splash'],
                    '⚠️': ['warning', 'sign', 'caution', 'alert'],
                    '🚸': ['children', 'crossing', 'school', 'kids'],
                    '⛔': ['no', 'entry', 'stop', 'prohibited'],
                    '🚫': ['prohibited', 'forbidden', 'not', 'allowed'],
                    '🚳': ['no', 'bicycles', 'bike', 'prohibited'],
                    '🚯': ['no', 'littering', 'trash', 'clean'],
                    '🚱': ['non', 'potable', 'water', 'not', 'drinking'],
                    '🚷': ['no', 'pedestrians', 'walking', 'prohibited'],
                    '📵': ['no', 'mobile', 'phones', 'silent'],
                    '🔞': ['no', 'one', 'under', 'eighteen', 'adult'],
                    '☢️': ['radioactive', 'nuclear', 'danger', 'toxic'],
                    '☣️': ['biohazard', 'toxic', 'dangerous', 'warning'],
                    '🅰️': ['a', 'button', 'blood', 'type'],
                    '🅱️': ['b', 'button', 'blood', 'type'],
                    '🆎': ['ab', 'button', 'blood', 'type'],
                    '🆑': ['cl', 'button', 'clear'],
                    '🅾️': ['o', 'button', 'blood', 'type'],
                    '🆘': ['sos', 'button', 'help', 'emergency'],
                    '❌': ['cross', 'mark', 'x', 'wrong'],
                    '⭕': ['heavy', 'large', 'circle', 'o'],
                    '🛑': ['stop', 'sign', 'octagonal', 'red'],
                    '📛': ['name', 'badge', 'identification'],
                    '💢': ['anger', 'symbol', 'mad', 'comic'],
                    '♨️': ['hot', 'springs', 'steam', 'onsen'],
                    '❗': ['exclamation', 'mark', 'warning', 'alert'],
                    '❕': ['white', 'exclamation', 'mark'],
                    '❓': ['question', 'mark', 'red', 'help'],
                    '❔': ['white', 'question', 'mark'],
                    '‼️': ['double', 'exclamation', 'mark'],
                    '⁉️': ['exclamation', 'question', 'mark'],
                    '🔅': ['dim', 'button', 'low', 'brightness'],
                    '🔆': ['bright', 'button', 'high', 'brightness'],
                    '〽️': ['part', 'alternation', 'mark'],
                    '🔱': ['trident', 'emblem', 'pitchfork'],
                    '⚜️': ['fleur', 'de', 'lis', 'decorative'],
                    '🔰': ['japanese', 'symbol', 'beginner'],
                    '♻️': ['recycling', 'symbol', 'green', 'environment'],
                    '✅': ['check', 'mark', 'button', 'correct'],
                    '🈯': ['reserved', 'button', 'japanese'],
                    '💹': ['chart', 'increasing', 'with', 'yen'],
                    '❇️': ['sparkle', 'star', 'green'],
                    '✳️': ['eight', 'spoked', 'asterisk'],
                    '❎': ['cross', 'mark', 'button', 'x'],
                    '🌐': ['globe', 'with', 'meridians', 'world'],
                    'Ⓜ️': ['circled', 'm', 'metro', 'subway'],
                    '🌀': ['cyclone', 'hurricane', 'spiral'],
                    '💤': ['zzz', 'sleeping', 'comic', 'tired'],
                    '🏧': ['atm', 'sign', 'bank', 'money'],
                    '🚾': ['water', 'closet', 'restroom', 'wc'],
                    '♿': ['wheelchair', 'symbol', 'accessible'],
                    '🅿️': ['p', 'button', 'parking'],
                    '🈳': ['vacancy', 'button', 'japanese'],
                    '🈂️': ['service', 'charge', 'button', 'japanese'],
                    '🛂': ['passport', 'control', 'immigration'],
                    '🛃': ['customs', 'border', 'declaration'],
                    '🛄': ['baggage', 'claim', 'airport'],
                    '🛅': ['left', 'luggage', 'storage'],
                    '🚹': ['mens', 'symbol', 'male', 'bathroom'],
                    '🚺': ['womens', 'symbol', 'female', 'bathroom'],
                    '🚼': ['baby', 'symbol', 'infant', 'nursery'],
                    '🚻': ['restroom', 'bathroom', 'toilet'],
                    '🚮': ['put', 'litter', 'symbol', 'trash'],
                    '🎦': ['cinema', 'movie', 'film', 'theater'],
                    '📶': ['antenna', 'bars', 'signal', 'reception'],
                    '🈁': ['here', 'button', 'japanese'],
                    '🔣': ['input', 'symbols', 'characters'],
                    'ℹ️': ['information', 'source', 'info'],
                    '🔤': ['input', 'latin', 'letters', 'abc'],
                    '🔡': ['input', 'latin', 'lowercase'],
                    '🔠': ['input', 'latin', 'uppercase'],
                    '🆖': ['ng', 'button', 'no', 'good'],
                    '🆗': ['ok', 'button', 'okay'],
                    '🆙': ['up', 'button', 'level'],
                    '🆒': ['cool', 'button', 'awesome'],
                    '🆕': ['new', 'button', 'fresh'],
                    '🆓': ['free', 'button', 'no', 'cost'],
                    
                    // Hearts & Emotions
                    '❤️': ['red', 'heart', 'love', 'romance'],
                    '🧡': ['orange', 'heart', 'love'],
                    '💛': ['yellow', 'heart', 'love', 'friendship'],
                    '💚': ['green', 'heart', 'love', 'nature'],
                    '💙': ['blue', 'heart', 'love', 'trust'],
                    '�': ['purple', 'heart', 'love'],
                    '🖤': ['black', 'heart', 'dark', 'evil'],
                    '🤍': ['white', 'heart', 'pure', 'love'],
                    '🤎': ['brown', 'heart', 'love'],
                    '💔': ['broken', 'heart', 'sad', 'breakup'],
                    '❣️': ['exclamation', 'heart', 'love'],
                    '💕': ['two', 'hearts', 'love', 'affection'],
                    '💞': ['revolving', 'hearts', 'love'],
                    '💓': ['beating', 'heart', 'love', 'pulse'],
                    '💗': ['growing', 'heart', 'love', 'excited'],
                    '💖': ['sparkling', 'heart', 'love', 'affection'],
                    '�': ['heart', 'arrow', 'love', 'cupid'],
                    '💝': ['heart', 'ribbon', 'love', 'gift'],
                    '💟': ['heart', 'decoration', 'love'],
                    
                    // Flags (sample - many country flags)
                    '🏁': ['chequered', 'flag', 'racing', 'finish'],
                    '🚩': ['triangular', 'flag', 'red', 'warning'],
                    '🎌': ['crossed', 'flags', 'japan'],
                    '🏴': ['black', 'flag', 'waving'],
                    '🏳️': ['white', 'flag', 'surrender', 'peace'],
                    '🏳️‍🌈': ['rainbow', 'flag', 'pride', 'lgbt'],
                    '🏳️‍⚧️': ['transgender', 'flag', 'pride'],
                    '🏴‍☠️': ['pirate', 'flag', 'jolly', 'roger'],
                    '🇺🇸': ['united', 'states', 'america', 'usa', 'flag'],
                    '🇬🇧': ['united', 'kingdom', 'britain', 'england', 'flag'],
                    '🇫🇷': ['france', 'french', 'flag'],
                    '🇩🇪': ['germany', 'german', 'flag'],
                    '🇯🇵': ['japan', 'japanese', 'flag'],
                    '🇨🇳': ['china', 'chinese', 'flag'],
                    '🇰🇷': ['south', 'korea', 'korean', 'flag'],
                    '🇮🇳': ['india', 'indian', 'flag'],
                    '🇷🇺': ['russia', 'russian', 'flag'],
                    '🇨🇦': ['canada', 'canadian', 'flag'],
                    '🇦🇺': ['australia', 'australian', 'flag'],
                    '🇧🇷': ['brazil', 'brazilian', 'flag'],
                    '🇮🇹': ['italy', 'italian', 'flag'],
                    '🇪🇸': ['spain', 'spanish', 'flag'],
                    '🇲🇽': ['mexico', 'mexican', 'flag'],
                    '🇳🇱': ['netherlands', 'dutch', 'holland', 'flag'],
                    '🇧🇪': ['belgium', 'belgian', 'flag'],
                    '🇨🇭': ['switzerland', 'swiss', 'flag'],
                    '🇦🇹': ['austria', 'austrian', 'flag'],
                    '🇸🇪': ['sweden', 'swedish', 'flag'],
                    '🇳🇴': ['norway', 'norwegian', 'flag'],
                    '🇩🇰': ['denmark', 'danish', 'flag'],
                    '🇫🇮': ['finland', 'finnish', 'flag'],
                    '🇵🇱': ['poland', 'polish', 'flag'],
                    '🇨🇿': ['czech', 'republic', 'flag'],
                    '🇭🇺': ['hungary', 'hungarian', 'flag'],
                    '🇬🇷': ['greece', 'greek', 'flag'],
                    '🇹🇷': ['turkey', 'turkish', 'flag'],
                    '🇮🇱': ['israel', 'israeli', 'flag'],
                    '🇸🇦': ['saudi', 'arabia', 'flag'],
                    '🇦🇪': ['united', 'arab', 'emirates', 'uae', 'flag'],
                    '🇪🇬': ['egypt', 'egyptian', 'flag'],
                    '🇿🇦': ['south', 'africa', 'flag'],
                    '🇳🇬': ['nigeria', 'nigerian', 'flag'],
                    '🇰🇪': ['kenya', 'kenyan', 'flag'],
                    '🇦🇷': ['argentina', 'argentinian', 'flag'],
                    '🇨🇱': ['chile', 'chilean', 'flag'],
                    '🇨🇴': ['colombia', 'colombian', 'flag'],
                    '🇵🇪': ['peru', 'peruvian', 'flag'],
                    '🇹🇭': ['thailand', 'thai', 'flag'],
                    '🇻🇳': ['vietnam', 'vietnamese', 'flag'],
                    '🇲🇾': ['malaysia', 'malaysian', 'flag'],
                    '🇸🇬': ['singapore', 'singaporean', 'flag'],
                    '🇮🇩': ['indonesia', 'indonesian', 'flag'],
                    '🇵🇭': ['philippines', 'filipino', 'flag'],
                    '🇳🇿': ['new', 'zealand', 'kiwi', 'flag'],
                    
                    // Weather & Nature
                    '☀️': ['sun', 'sunny', 'hot', 'bright', 'yellow'],
                    '⛅': ['sun', 'behind', 'cloud', 'partly', 'cloudy'],
                    '⛈️': ['cloud', 'lightning', 'rain', 'storm'],
                    '�️': ['sun', 'behind', 'small', 'cloud'],
                    '🌦️': ['sun', 'behind', 'rain', 'cloud'],
                    '🌧️': ['cloud', 'rain', 'weather'],
                    '🌩️': ['cloud', 'lightning', 'thunder'],
                    '🌨️': ['cloud', 'snow', 'cold', 'winter'],
                    '❄️': ['snowflake', 'cold', 'winter', 'frozen'],
                    '☃️': ['snowman', 'cold', 'winter', 'snow'],
                    '⛄': ['snowman', 'without', 'snow', 'cold'],
                    '🌬️': ['wind', 'face', 'blowing', 'air'],
                    '🌪️': ['tornado', 'cyclone', 'twister', 'storm'],
                    '🌫️': ['fog', 'cloudy', 'misty'],
                    '☔': ['umbrella', 'rain', 'drops', 'weather'],
                    '⛱️': ['umbrella', 'beach', 'sun', 'vacation'],
                    
                    // Numbers & Math
                    '0️⃣': ['keycap', 'digit', 'zero'],
                    '1️⃣': ['keycap', 'digit', 'one'],
                    '2️⃣': ['keycap', 'digit', 'two'],
                    '3️⃣': ['keycap', 'digit', 'three'],
                    '4️⃣': ['keycap', 'digit', 'four'],
                    '5️⃣': ['keycap', 'digit', 'five'],
                    '6️⃣': ['keycap', 'digit', 'six'],
                    '7️⃣': ['keycap', 'digit', 'seven'],
                    '8️⃣': ['keycap', 'digit', 'eight'],
                    '9️⃣': ['keycap', 'digit', 'nine'],
                    '🔟': ['keycap', '10', 'ten'],
                    '🔢': ['input', 'numbers', '1234'],
                    '#️⃣': ['input', 'symbol', 'hash', 'pound'],
                    '*️⃣': ['input', 'symbol', 'asterisk', 'star'],
                    '➕': ['plus', 'add', 'math', 'positive'],
                    '➖': ['minus', 'subtract', 'math', 'negative'],
                    '➗': ['divide', 'division', 'math'],
                    '✖️': ['multiply', 'multiplication', 'math', 'times'],
                    '🟰': ['heavy', 'equals', 'sign', 'math'],
                    '♾️': ['infinity', 'unlimited', 'forever'],
                    '�': ['heavy', 'dollar', 'sign', 'money'],
                    '💱': ['currency', 'exchange', 'money'],
                    
                    // Arrows & Directions
                    '➡️': ['right', 'arrow', 'direction', 'next'],
                    '⬅️': ['left', 'arrow', 'direction', 'back'],
                    '⬆️': ['up', 'arrow', 'direction', 'north'],
                    '⬇️': ['down', 'arrow', 'direction', 'south'],
                    '↗️': ['up', 'right', 'arrow', 'northeast'],
                    '↘️': ['down', 'right', 'arrow', 'southeast'],
                    '↙️': ['down', 'left', 'arrow', 'southwest'],
                    '↖️': ['up', 'left', 'arrow', 'northwest'],
                    '↕️': ['up', 'down', 'arrow', 'vertical'],
                    '↔️': ['left', 'right', 'arrow', 'horizontal'],
                    '↪️': ['left', 'arrow', 'curving', 'right'],
                    '↩️': ['right', 'arrow', 'curving', 'left'],
                    '⤴️': ['right', 'arrow', 'curving', 'up'],
                    '⤵️': ['right', 'arrow', 'curving', 'down'],
                    
                    // Media & Controls
                    '▶️': ['play', 'button', 'start', 'triangle'],
                    '⏸️': ['pause', 'button', 'stop'],
                    '⏯️': ['play', 'pause', 'button'],
                    '⏹️': ['stop', 'button', 'square'],
                    '⏺️': ['record', 'button', 'circle'],
                    '⏭️': ['next', 'track', 'button', 'skip'],
                    '⏮️': ['last', 'track', 'button', 'previous'],
                    '⏩': ['fast', 'forward', 'button'],
                    '⏪': ['fast', 'reverse', 'button', 'rewind'],
                    '⏫': ['fast', 'up', 'button'],
                    '⏬': ['fast', 'down', 'button'],
                    '◀️': ['reverse', 'button', 'left', 'triangle'],
                    '🔼': ['upwards', 'button', 'triangle'],
                    '🔽': ['downwards', 'button', 'triangle']
                };
                
                displayEmojiCategory('all', window.emojiData);
                
                // Set up search functionality
                const searchInput = document.getElementById('emojiSearch');
                if (searchInput) {
                    searchInput.addEventListener('input', (e) => {
                        debounceSearch(e.target.value, window.emojiData);
                    });
                }
                
                // Close modal when clicking outside
                const modal = document.getElementById('emojiModal');
                if (modal) {
                    modal.addEventListener('click', (e) => {
                        if (e.target === modal) {
                            closeEmojiPicker();
                        }
                    });
                }
            }
            
            function displayEmojiCategory(category, emojiData) {
                const grid = document.getElementById('emojiGrid');
                if (!grid) {
                    console.log('Emoji grid not found');
                    return;
                }
                
                grid.innerHTML = '';
                
                let emojisToShow = [];
                if (category === 'all') {
                    emojisToShow = Object.values(emojiData).flat();
                } else if (emojiData[category]) {
                    emojisToShow = emojiData[category];
                }
                
                console.log(\`Displaying \${emojisToShow.length} emojis for category: \${category}\`);
                
                if (emojisToShow.length === 0) {
                    const noEmojiMsg = document.createElement('div');
                    noEmojiMsg.textContent = 'No emojis found for this category';
                    noEmojiMsg.style.textAlign = 'center';
                    noEmojiMsg.style.padding = '20px';
                    noEmojiMsg.style.color = 'var(--vscode-descriptionForeground)';
                    grid.appendChild(noEmojiMsg);
                    return;
                }
                
                const usedEmojis = getCurrentlyUsedEmojis();
                
                emojisToShow.forEach(emoji => {
                    const emojiEl = document.createElement('div');
                    emojiEl.className = 'emoji-item';
                    emojiEl.textContent = emoji;
                    emojiEl.onclick = () => selectEmoji(emoji);
                    
                    // Mark used emojis
                    if (usedEmojis.has(emoji)) {
                        emojiEl.classList.add('emoji-used');
                        emojiEl.title = \`\${emoji} - Already in use\`;
                        emojiEl.style.opacity = '0.4';
                        emojiEl.style.filter = 'grayscale(50%)';
                    } else {
                        emojiEl.title = emoji;
                    }
                    
                    grid.appendChild(emojiEl);
                });
            }
            
            window.switchCategory = function(category) {
                // Update active tab
                document.querySelectorAll('.category-tab').forEach(tab => {
                    tab.classList.remove('active');
                });
                const targetTab = document.querySelector(\`[data-category="\${category}"]\`);
                if (targetTab) {
                    targetTab.classList.add('active');
                }
                
                // Show emojis for this category
                if (window.emojiData) {
                    displayEmojiCategory(category, window.emojiData);
                }
            }
            
            let searchTimeout;
            function debounceSearch(query, emojiData) {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    searchEmojis(query, emojiData);
                }, 200);
            }
            
            function searchEmojis(query, emojiData) {
                const grid = document.getElementById('emojiGrid');
                const resultsInfo = document.getElementById('searchResultsInfo');
                if (!grid) return;
                
                if (!query.trim()) {
                    displayEmojiCategory('all', emojiData);
                    if (resultsInfo) resultsInfo.textContent = '';
                    return;
                }
                
                const searchTerm = query.toLowerCase().trim();
                const allEmojis = Object.values(emojiData).flat();
                const searchData = window.emojiSearchData || {};
                
                // Search through emojis using metadata
                const filteredEmojis = allEmojis.filter(emoji => {
                    const searchTerms = searchData[emoji] || [];
                    return searchTerms.some(term => term.toLowerCase().includes(searchTerm));
                });
                
                // Update results info
                if (resultsInfo) {
                    if (filteredEmojis.length === 0) {
                        resultsInfo.textContent = \`No emojis found for "\${query}"\`;
                        resultsInfo.style.color = 'var(--vscode-errorForeground)';
                    } else {
                        resultsInfo.textContent = \`Found \${filteredEmojis.length} emoji\${filteredEmojis.length === 1 ? '' : 's'} for "\${query}"\`;
                        resultsInfo.style.color = 'var(--vscode-foreground)';
                    }
                }
                
                grid.innerHTML = '';
                
                if (filteredEmojis.length === 0) {
                    const noResultsMsg = document.createElement('div');
                    noResultsMsg.textContent = 'Try searching for: smile, heart, red, circle, star, fire, etc.';
                    noResultsMsg.style.textAlign = 'center';
                    noResultsMsg.style.padding = '20px';
                    noResultsMsg.style.color = 'var(--vscode-descriptionForeground)';
                    grid.appendChild(noResultsMsg);
                    return;
                }
                
                const usedEmojis = getCurrentlyUsedEmojis();
                
                filteredEmojis.forEach(emoji => {
                    const emojiEl = document.createElement('div');
                    emojiEl.className = 'emoji-item';
                    emojiEl.textContent = emoji;
                    emojiEl.onclick = () => selectEmoji(emoji);
                    
                    if (usedEmojis.has(emoji)) {
                        emojiEl.classList.add('emoji-used');
                        emojiEl.title = \`\${emoji} - Already in use - \${(searchData[emoji] || []).join(', ')}\`;
                        emojiEl.style.opacity = '0.4';
                        emojiEl.style.filter = 'grayscale(50%)';
                    } else {
                        emojiEl.title = emoji + ' - ' + (searchData[emoji] || []).join(', ');
                    }
                    
                    grid.appendChild(emojiEl);
                });
            }
            
            function addPattern() {
                const input = document.getElementById('newPattern');
                const pattern = input.value.trim();
                if (pattern) {
                    vscode.postMessage({
                        command: 'addGlobPattern',
                        pattern: pattern
                    });
                    input.value = '';
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
            
            function resetEmojis() {
                vscode.postMessage({
                    command: 'resetColors'
                });
            }
            
            document.addEventListener('DOMContentLoaded', function() {
                const newPatternInput = document.getElementById('newPattern');
                newPatternInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        addPattern();
                    }
                });
            });
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
        htmlContent = htmlContent.replace(/{{scriptContent}}/g, scriptContent);
        
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