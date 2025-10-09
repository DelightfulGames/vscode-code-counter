import * as vscode from 'vscode';
import { CountLinesCommand } from './commands/countLines';
import { FileWatcherProvider } from './providers/fileWatcher';
import { FileExplorerDecorationProvider } from './providers/fileExplorerDecorator';
import { EditorTabDecorationProvider } from './providers/editorTabDecorator';

async function showColorPicker(): Promise<void> {
    const config = vscode.workspace.getConfiguration('codeCounter');
    const colors = config.get('colors', {
        low: '#90EE90',
        medium: '#FFD700', 
        high: '#FF6B6B'
    });

    // Create a webview panel for the color picker
    const panel = vscode.window.createWebviewPanel(
        'colorPicker',
        'Code Counter - Color Settings',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    // HTML content with color picker
    panel.webview.html = getColorPickerWebviewContent(colors);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
        async (message) => {
            switch (message.command) {
                case 'updateColor':
                    const updatedColors = { ...colors, [message.colorKey]: message.color };
                    await config.update('colors', updatedColors, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage(`Updated ${message.colorKey} threshold color`);
                    break;
                case 'resetColors':
                    const defaultColors = {
                        low: '#90EE90',
                        medium: '#FFD700', 
                        high: '#FF6B6B'
                    };
                    await config.update('colors', defaultColors, vscode.ConfigurationTarget.Global);
                    panel.webview.html = getColorPickerWebviewContent(defaultColors);
                    vscode.window.showInformationMessage('Colors reset to defaults');
                    break;
            }
        },
        undefined
    );
}

function getColorPickerWebviewContent(colors: any): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Code Counter Colors</title>
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
            .color-picker-container {
                display: flex;
                align-items: center;
                gap: 10px;
                margin: 10px 0;
            }
            input[type="color"] {
                width: 50px;
                height: 35px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
            }
            .color-text {
                font-family: monospace;
                padding: 5px 10px;
                background: var(--vscode-input-background);
                border: 1px solid var(--vscode-input-border);
                border-radius: 3px;
                min-width: 80px;
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
                color: white;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <h1>🎨 Code Counter Color Settings</h1>
        
        <div class="color-section">
            <h3>🟢 Low Threshold (Few lines)</h3>
            <div class="color-picker-container">
                <input type="color" id="lowColor" value="${colors.low}" />
                <span class="color-text" id="lowText">${colors.low}</span>
            </div>
            <div class="preview" id="lowPreview" style="background-color: ${colors.low}">Lines: 25</div>
        </div>

        <div class="color-section">
            <h3>🟡 Medium Threshold (Moderate lines)</h3>
            <div class="color-picker-container">
                <input type="color" id="mediumColor" value="${colors.medium}" />
                <span class="color-text" id="mediumText">${colors.medium}</span>
            </div>
            <div class="preview" id="mediumPreview" style="background-color: ${colors.medium}">Lines: 150</div>
        </div>

        <div class="color-section">
            <h3>🔴 High Threshold (Many lines)</h3>
            <div class="color-picker-container">
                <input type="color" id="highColor" value="${colors.high}" />
                <span class="color-text" id="highText">${colors.high}</span>
            </div>
            <div class="preview" id="highPreview" style="background-color: ${colors.high}">Lines: 500</div>
        </div>

        <button onclick="resetColors()">🔄 Reset to Defaults</button>

        <script>
            const vscode = acquireVsCodeApi();

            function setupColorPicker(colorKey) {
                const picker = document.getElementById(colorKey + 'Color');
                const text = document.getElementById(colorKey + 'Text');
                const preview = document.getElementById(colorKey + 'Preview');
                
                picker.addEventListener('change', function() {
                    const color = this.value;
                    text.textContent = color;
                    preview.style.backgroundColor = color;
                    
                    vscode.postMessage({
                        command: 'updateColor',
                        colorKey: colorKey,
                        color: color
                    });
                });
            }

            setupColorPicker('low');
            setupColorPicker('medium');
            setupColorPicker('high');

            function resetColors() {
                vscode.postMessage({
                    command: 'resetColors'
                });
            }
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

    const toggleExplorerDisposable = vscode.commands.registerCommand('codeCounter.toggleExplorerLineCounts', () => {
        fileExplorerDecorator.toggleExplorerLineCounts();
    });

    const toggleTabDisposable = vscode.commands.registerCommand('codeCounter.toggleTabLineCounts', () => {
        editorTabDecorator.toggleTabLineCounts();
    });

    const toggleColorDisposable = vscode.commands.registerCommand('codeCounter.toggleColorThresholds', () => {
        const config = vscode.workspace.getConfiguration('codeCounter.colorThresholds');
        const currentEnabled = config.get<boolean>('enabled', true);
        
        config.update('enabled', !currentEnabled, vscode.ConfigurationTarget.Global);
        
        const status = !currentEnabled ? 'enabled' : 'disabled';
        vscode.window.showInformationMessage(`Color coding for line counts: ${status}`);
    });

    const resetColorsDisposable = vscode.commands.registerCommand('codeCounter.resetColors', async () => {
        const colorConfig = vscode.workspace.getConfiguration('codeCounter.colors');
        
        await colorConfig.update('normal', '#4CAF50', vscode.ConfigurationTarget.Global);
        await colorConfig.update('warning', '#FFC107', vscode.ConfigurationTarget.Global);
        await colorConfig.update('danger', '#F44336', vscode.ConfigurationTarget.Global);
        
        vscode.window.showInformationMessage('Colors reset to defaults: Green, Yellow, Red');
    });

    const openColorSettingsDisposable = vscode.commands.registerCommand('codeCounter.openColorSettings', async () => {
        await showColorPicker();
    });

    // Add all disposables to context
    context.subscriptions.push(
        countLinesDisposable,
        toggleExplorerDisposable,
        toggleTabDisposable,
        toggleColorDisposable,
        resetColorsDisposable,
        openColorSettingsDisposable,
        decorationProvider,
        fileWatcher,
        fileExplorerDecorator,
        editorTabDecorator
    );
}

export function deactivate() {}