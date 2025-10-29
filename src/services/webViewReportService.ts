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
import * as fs from 'fs';
import * as path from 'path';
import { HtmlGeneratorService } from './htmlGenerator';
import { XmlGeneratorService } from './xmlGenerator';
import { LineCountResult } from '../types';
import { DebugService } from './debugService';

export interface ReportData {
    summary: {
        totalFiles: number;
        totalLines: number;
        totalCodeLines: number;
        totalCommentLines: number;
        totalBlankLines: number;
        languageCount: number;
    };
    languages: Array<{
        name: string;
        files: number;
        lines: number;
        codeLines: number;
        commentLines: number;
        blankLines: number;
    }>;
    files: Array<{
        path: string;
        relativePath: string;
        language: string;
        lines: number;
        codeLines: number;
        commentLines: number;
        blankLines: number;
        size: number;
    }>;
    workspacePath: string;
    generatedDate: string;
}

export class WebViewReportService {
    private debug = DebugService.getInstance();
    private static instance: WebViewReportService;
    private currentPanel: vscode.WebviewPanel | undefined;
    private currentData: ReportData | undefined;
    private htmlGenerator: HtmlGeneratorService;
    private xmlGenerator: XmlGeneratorService;

    constructor() {
        this.htmlGenerator = new HtmlGeneratorService();
        this.xmlGenerator = new XmlGeneratorService();
    }

    public static getInstance(): WebViewReportService {
        if (!WebViewReportService.instance) {
            WebViewReportService.instance = new WebViewReportService();
        }
        return WebViewReportService.instance;
    }

    public async showReport(data: ReportData): Promise<void> {
        // Store current data for export functionality
        this.currentData = data;
        
        // If panel already exists, reveal it and update data
        if (this.currentPanel) {
            this.currentPanel.reveal(vscode.ViewColumn.One);
            this.updatePanelData(data);
            return;
        }

        // Create new WebView panel
        this.currentPanel = vscode.window.createWebviewPanel(
            'codeCounterReport',
            'Code Counter Report',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: []
            }
        );

        // Set HTML content
        this.debug.verbose('WebView Report: Setting HTML content with data:', {
            totalFiles: data.summary.totalFiles,
            totalLines: data.summary.totalLines,
            languageCount: data.languages.length,
            fileCount: data.files.length
        });
        this.currentPanel.webview.html = this.generateWebViewHTML(data);

        // Handle panel disposal
        this.currentPanel.onDidDispose(() => {
            this.currentPanel = undefined;
        }, null);

        // Handle messages from WebView
        this.currentPanel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'refresh':
                        // Trigger refresh by asking for new data
                        vscode.commands.executeCommand('codeCounter.showReportPanel');
                        break;
                    case 'export':
                        // Handle export requests with current data
                        if (this.currentData) {
                            await this.exportReport(this.currentData);
                        }
                        break;
                    case 'debugLog':
                        // Handle debug messages from webview
                        const webviewPrefix = '[WEBVIEW-REPORT]';
                        switch (message.level) {
                            case 'verbose':
                                this.debug.verbose(webviewPrefix, message.message);
                                break;
                            case 'info':
                                this.debug.info(webviewPrefix, message.message);
                                break;
                            case 'warning':
                                this.debug.warning(webviewPrefix, message.message);
                                break;
                            case 'error':
                                this.debug.error(webviewPrefix, message.message);
                                break;
                            default:
                                this.debug.info(webviewPrefix, message.message);
                        }
                        break;
                }
            }
        );
    }

    private updatePanelData(data: ReportData): void {
        // Store the updated data
        this.currentData = data;
        
        if (this.currentPanel) {
            // Send new data to existing panel
            this.currentPanel.webview.postMessage({
                command: 'updateData',
                data: data
            });
        }
    }

    private generateWebViewHTML(data: ReportData): string {
        // Separate the data from presentation
        const jsonData = JSON.stringify(data, null, 2);
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Counter Report</title>
    <style>
        ${this.getWebViewStyles()}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Code Counter Report</h1>
            <p>Generated on <span id="generated-date"></span></p>
            <p>Workspace: <span id="workspace-path"></span></p>
            <div class="actions">
                <button id="refresh-btn" title="Refresh Data">🔄 Refresh</button>
                <button id="export-btn" title="Export to HTML">📄 Export</button>
            </div>
        </div>

        <div id="loading-indicator" class="loading hidden">
            <div class="spinner"></div>
            Loading report data...
        </div>

        <div id="error-message" class="error hidden">
            <strong>Error:</strong> <span id="error-text"></span>
        </div>

        <div id="report-content">
            <div class="stats-grid" id="summary-stats">
                <!-- Will be populated by JavaScript -->
            </div>

            <div class="section">
                <h2>📈 Language Statistics</h2>
                <div class="language-stats" id="language-stats">
                    <!-- Will be populated by JavaScript -->
                </div>
            </div>

            <div class="section">
                <h2>📁 File Details</h2>
                <input type="text" class="search-box" id="file-search" placeholder="Search files..." />
                <div class="table-container">
                    <table class="files-table">
                        <thead>
                            <tr>
                                <th>File Path</th>
                                <th>Language</th>
                                <th>Total Lines</th>
                                <th>Code Lines</th>
                                <th>Comment Lines</th>
                                <th>Blank Lines</th>
                                <th>File Size</th>
                            </tr>
                        </thead>
                        <tbody id="files-tbody">
                            <!-- Will be populated by JavaScript -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Data is embedded but kept separate from presentation logic
        const reportData = ${jsonData};
        
        ${this.getWebViewScript()}
    </script>
</body>
</html>`;
    }

    private getWebViewStyles(): string {
        return `
            body {
                font-family: var(--vscode-font-family);
                background: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                margin: 0;
                padding: 0;
                line-height: 1.6;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
            }
            .header {
                background: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
            }
            .header h1 {
                margin: 0;
                color: var(--vscode-textLink-foreground);
                font-size: 1.8em;
                font-weight: 600;
            }
            .header p {
                margin: 5px 0;
                color: var(--vscode-descriptionForeground);
            }
            .actions {
                display: flex;
                gap: 10px;
            }
            .actions button {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.9em;
                transition: background-color 0.2s;
            }
            .actions button:hover {
                background: var(--vscode-button-hoverBackground);
            }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin-bottom: 30px;
            }
            .stat-card {
                background: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                padding: 20px;
                border-radius: 8px;
                text-align: center;
            }
            .stat-card h3 {
                margin: 0 0 10px;
                color: var(--vscode-textLink-foreground);
                font-size: 1em;
                font-weight: 500;
            }
            .stat-card .value {
                font-size: 2em;
                font-weight: bold;
                color: var(--vscode-editor-foreground);
                margin: 0;
            }
            .section {
                background: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 20px;
            }
            .section h2 {
                color: var(--vscode-textLink-foreground);
                margin: 0 0 20px;
                font-size: 1.3em;
                font-weight: 600;
            }
            .language-stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 15px;
                margin-bottom: 20px;
            }
            .language-item {
                background: var(--vscode-input-background);
                border: 1px solid var(--vscode-input-border);
                padding: 15px;
                border-radius: 6px;
            }
            .language-name {
                font-weight: 600;
                color: var(--vscode-editor-foreground);
                margin-bottom: 8px;
                font-size: 1.1em;
            }
            .language-details {
                font-size: 0.9em;
                color: var(--vscode-descriptionForeground);
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 5px;
            }
            .search-box {
                width: 100%;
                max-width: 400px;
                padding: 8px 12px;
                border: 1px solid var(--vscode-input-border);
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border-radius: 4px;
                margin-bottom: 15px;
                font-size: 0.9em;
            }
            .search-box:focus {
                outline: 1px solid var(--vscode-focusBorder);
                border-color: var(--vscode-focusBorder);
            }
            .table-container {
                overflow-x: auto;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 6px;
            }
            .files-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 0.9em;
            }
            .files-table th,
            .files-table td {
                padding: 10px 12px;
                text-align: left;
                border-bottom: 1px solid var(--vscode-panel-border);
            }
            .files-table th {
                background: var(--vscode-editorGroupHeader-tabsBackground);
                color: var(--vscode-tab-activeForeground);
                font-weight: 600;
                position: sticky;
                top: 0;
                z-index: 10;
            }
            .files-table tr:hover {
                background: var(--vscode-list-hoverBackground);
            }
            .file-path {
                font-family: var(--vscode-editor-font-family);
                font-size: 0.85em;
                color: var(--vscode-textLink-foreground);
                max-width: 300px;
                word-break: break-all;
            }
            .language-badge {
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 0.8em;
                font-weight: 500;
            }
            .loading, .error {
                text-align: center;
                padding: 40px 20px;
                border-radius: 8px;
                margin: 20px 0;
            }
            .loading {
                background: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                color: var(--vscode-descriptionForeground);
            }
            .error {
                background: var(--vscode-inputValidation-errorBackground);
                border: 1px solid var(--vscode-inputValidation-errorBorder);
                color: var(--vscode-errorForeground);
            }
            .spinner {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 2px solid var(--vscode-panel-border);
                border-top: 2px solid var(--vscode-progressBar-background);
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-right: 10px;
            }
            .hidden {
                display: none;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
    }

    private getWebViewScript(): string {
        return `
            // VS Code API for message passing
            const vscode = acquireVsCodeApi();
            
            // Initialize report with data
            function initializeReport(data) {
                try {
                    this.debug.verbose('WebView: Initializing report with data:', data);
                    populateReport(data);
                    this.debug.verbose('WebView: Report populated successfully');
                } catch (error) {
                    this.debug.error('Error initializing report:', error);
                    showError('Failed to initialize report: ' + error.message);
                }
            }
            
            // Populate report sections
            function populateReport(data) {
                // Update header
                document.getElementById('generated-date').textContent = data.generatedDate;
                document.getElementById('workspace-path').textContent = data.workspacePath;
                
                // Populate summary statistics
                const summaryDiv = document.getElementById('summary-stats');
                summaryDiv.innerHTML = createSummaryHTML(data.summary);
                
                // Populate language statistics
                const langDiv = document.getElementById('language-stats');
                langDiv.innerHTML = createLanguageStatsHTML(data.languages);
                
                // Populate files table
                const tbody = document.getElementById('files-tbody');
                tbody.innerHTML = createFilesTableHTML(data.files);
                
                // Setup search functionality
                setupFileSearch();
                
                // Setup action buttons
                setupActionButtons();
            }
            
            function createSummaryHTML(summary) {
                const avgLinesPerFile = summary.totalFiles > 0 ? Math.round(summary.totalLines / summary.totalFiles) : 0;
                
                return \`
                    <div class="stat-card">
                        <h3>Total Files</h3>
                        <p class="value">\${formatNumber(summary.totalFiles)}</p>
                    </div>
                    <div class="stat-card">
                        <h3>Total Lines</h3>
                        <p class="value">\${formatNumber(summary.totalLines)}</p>
                    </div>
                    <div class="stat-card">
                        <h3>Code Lines</h3>
                        <p class="value">\${formatNumber(summary.totalCodeLines)}</p>
                    </div>
                    <div class="stat-card">
                        <h3>Languages</h3>
                        <p class="value">\${summary.languageCount}</p>
                    </div>
                    <div class="stat-card">
                        <h3>Avg Lines/File</h3>
                        <p class="value">\${formatNumber(avgLinesPerFile)}</p>
                    </div>
                \`;
            }
            
            function createLanguageStatsHTML(languages) {
                return languages.map(lang => \`
                    <div class="language-item">
                        <div class="language-name">\${escapeHtml(lang.name)}</div>
                        <div class="language-details">
                            <span>Files: \${formatNumber(lang.files)}</span>
                            <span>Lines: \${formatNumber(lang.lines)}</span>
                            <span>Code: \${formatNumber(lang.codeLines)}</span>
                            <span>Comments: \${formatNumber(lang.commentLines)}</span>
                        </div>
                    </div>
                \`).join('');
            }
            
            function createFilesTableHTML(files) {
                return files.map(file => \`
                    <tr>
                        <td class="file-path" title="\${escapeHtml(file.path)}">\${escapeHtml(file.relativePath || file.path)}</td>
                        <td><span class="language-badge">\${escapeHtml(file.language)}</span></td>
                        <td>\${formatNumber(file.lines)}</td>
                        <td>\${formatNumber(file.codeLines)}</td>
                        <td>\${formatNumber(file.commentLines)}</td>
                        <td>\${formatNumber(file.blankLines)}</td>
                        <td>\${formatBytes(file.size)}</td>
                    </tr>
                \`).join('');
            }
            
            function setupFileSearch() {
                const searchBox = document.getElementById('file-search');
                const tbody = document.getElementById('files-tbody');
                
                searchBox.addEventListener('input', function() {
                    const filter = this.value.toLowerCase();
                    const rows = tbody.querySelectorAll('tr');
                    
                    rows.forEach(row => {
                        const filePath = row.querySelector('.file-path').textContent.toLowerCase();
                        row.style.display = filePath.includes(filter) ? '' : 'none';
                    });
                });
            }
            
            function setupActionButtons() {
                document.getElementById('refresh-btn').addEventListener('click', () => {
                    vscode.postMessage({ command: 'refresh' });
                });
                
                document.getElementById('export-btn').addEventListener('click', () => {
                    vscode.postMessage({ command: 'export' });
                });
            }
            
            // Utility functions
            function formatNumber(num) {
                return num.toLocaleString();
            }
            
            function formatBytes(bytes) {
                if (bytes === 0) return '0 B';
                const k = 1024;
                const sizes = ['B', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
            }
            
            function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }
            
            function showError(message) {
                document.getElementById('error-text').textContent = message;
                document.getElementById('error-message').classList.remove('hidden');
                document.getElementById('report-content').classList.add('hidden');
            }
            
            // Handle messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'updateData':
                        populateReport(message.data);
                        break;
                }
            });
            
            // Initialize on load
            document.addEventListener('DOMContentLoaded', () => {
                this.debug.verbose('WebView: DOM ready, initializing report...');
                this.debug.verbose('WebView: reportData available:', !!reportData, typeof reportData);
                initializeReport(reportData);
            });
            
            // Fallback initialization if DOM is already loaded
            if (document.readyState === 'loading') {
                this.debug.verbose('WebView: DOM still loading, waiting for DOMContentLoaded');
            } else {
                this.debug.verbose('WebView: DOM already ready, initializing immediately');
                setTimeout(() => initializeReport(reportData), 0);
            }
        `;
    }

    private async exportReport(data: ReportData): Promise<void> {
        // Show export options to user
        const exportChoice = await vscode.window.showQuickPick([
            {
                label: '📄 HTML Report',
                description: 'Interactive HTML file with embedded data',
                detail: 'Self-contained file that works in any browser'
            },
            {
                label: '📊 HTML + XML',
                description: 'HTML report with separate XML data file',
                detail: 'Two files: clean HTML and structured XML data'
            },
            {
                label: '📋 JSON Data',
                description: 'Raw data in JSON format',
                detail: 'Machine-readable data for integration'
            }
        ], {
            placeHolder: 'Choose export format'
        });

        if (!exportChoice) {
            return; // User cancelled
        }

        try {
            if (exportChoice.label.includes('JSON')) {
                await this.exportAsJson(data);
            } else if (exportChoice.label.includes('HTML + XML')) {
                await this.exportAsHtmlXml(data);
            } else {
                await this.exportAsHtml(data);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Export failed: ${error}`);
        }
    }

    private async exportAsJson(data: ReportData): Promise<void> {
        const options: vscode.SaveDialogOptions = {
            saveLabel: 'Export as JSON',
            defaultUri: vscode.Uri.file(`code-counter-data-${this.getDateString()}.json`),
            filters: {
                'JSON Files': ['json']
            }
        };

        const fileUri = await vscode.window.showSaveDialog(options);
        if (fileUri) {
            const jsonContent = JSON.stringify(data, null, 2);
            await vscode.workspace.fs.writeFile(fileUri, Buffer.from(jsonContent, 'utf8'));
            vscode.window.showInformationMessage(`JSON exported successfully: ${path.basename(fileUri.fsPath)}`);
        }
    }

    private async exportAsHtml(data: ReportData): Promise<void> {
        const options: vscode.SaveDialogOptions = {
            saveLabel: 'Export as HTML',
            defaultUri: vscode.Uri.file(`code-counter-report-${this.getDateString()}.html`),
            filters: {
                'HTML Files': ['html']
            }
        };

        const fileUri = await vscode.window.showSaveDialog(options);
        if (fileUri) {
            // Convert ReportData back to the format expected by existing generators
            const xmlData = this.convertReportDataToXml(data);
            
            // Use existing HTML generator but save to user-selected location
            const htmlContent = await this.generateStandaloneHtml(data, xmlData);
            await vscode.workspace.fs.writeFile(fileUri, Buffer.from(htmlContent, 'utf8'));
            vscode.window.showInformationMessage(`HTML report exported successfully: ${path.basename(fileUri.fsPath)}`);
        }
    }

    private async exportAsHtmlXml(data: ReportData): Promise<void> {
        const options: vscode.OpenDialogOptions = {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Export Directory'
        };

        const folderUri = await vscode.window.showOpenDialog(options);
        if (folderUri && folderUri[0]) {
            const baseDir = folderUri[0].fsPath;
            const dateString = this.getDateString();
            
            // Generate XML data
            const xmlData = this.convertReportDataToXml(data);
            const xmlPath = path.join(baseDir, `code-counter-data-${dateString}.xml`);
            
            // Generate HTML that references the XML file
            const htmlContent = await this.generateLinkedHtml(data, `code-counter-data-${dateString}.xml`);
            const htmlPath = path.join(baseDir, `code-counter-report-${dateString}.html`);
            
            // Write both files
            await fs.promises.writeFile(xmlPath, xmlData);
            await fs.promises.writeFile(htmlPath, htmlContent);
            
            vscode.window.showInformationMessage(`Files exported successfully:\n• ${path.basename(htmlPath)}\n• ${path.basename(xmlPath)}`);
        }
    }

    private convertReportDataToXml(data: ReportData): string {
        // Convert our ReportData back to the format that XmlGeneratorService expects
        const languageStats: { [language: string]: { files: number; lines: number } } = {};
        
        // Calculate language stats from the data
        data.languages.forEach(lang => {
            languageStats[lang.name] = {
                files: lang.files,
                lines: lang.lines
            };
        });

        const xmlServiceData: LineCountResult = {
            workspacePath: data.workspacePath,
            totalFiles: data.summary.totalFiles,
            totalLines: data.summary.totalLines,
            languageStats: languageStats,
            generatedAt: new Date(data.generatedDate),
            files: data.files.map(file => ({
                path: file.path,
                relativePath: file.relativePath,
                language: file.language,
                lines: file.lines,
                codeLines: file.codeLines,
                commentLines: file.commentLines,
                blankLines: file.blankLines,
                size: file.size
            }))
        };

        return this.xmlGenerator.generateXml(xmlServiceData);
    }

    private async generateStandaloneHtml(data: ReportData, xmlData: string): Promise<string> {
        // Read the template
        const templatePath = path.join(__dirname, '../../templates/report.html');
        let htmlTemplate = await fs.promises.readFile(templatePath, 'utf8');
        
        // Replace placeholders with embedded data (standalone version)
        htmlTemplate = htmlTemplate.replace('{{GENERATED_DATE}}', data.generatedDate);
        htmlTemplate = htmlTemplate.replace('{{WORKSPACE_PATH}}', data.workspacePath);
        
        // Embed XML data as fallback (this will work even with file:// protocol)
        const escapedXmlData = xmlData.replace(/\\/g, '\\\\')
                                        .replace(/\r?\n/g, '\\n')
                                        .replace(/'/g, "\\'");
                                        
        htmlTemplate = htmlTemplate.replace('{{XML_DATA_FALLBACK}}', escapedXmlData);
        
        return htmlTemplate;
    }

    private async generateLinkedHtml(data: ReportData, xmlFileName: string): Promise<string> {
        // Read the template
        const templatePath = path.join(__dirname, '../../templates/report.html');
        let htmlTemplate = await fs.promises.readFile(templatePath, 'utf8');
        
        // Replace placeholders
        htmlTemplate = htmlTemplate.replace('{{GENERATED_DATE}}', data.generatedDate);
        htmlTemplate = htmlTemplate.replace('{{WORKSPACE_PATH}}', data.workspacePath);
        
        // Don't embed XML data - let it load from external file
        htmlTemplate = htmlTemplate.replace('{{XML_DATA_FALLBACK}}', '');
        
        // Update the fetch URL to point to the specific XML file
        htmlTemplate = htmlTemplate.replace('./code-counter-data.xml', `./${xmlFileName}`);
        
        return htmlTemplate;
    }

    private getDateString(): string {
        const now = new Date();
        return now.toISOString().slice(0, 19).replace(/[:.]/g, '-');
    }
}