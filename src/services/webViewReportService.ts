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
import { LineCounterService } from './lineCounter';

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
        this.debug.info('🌐 DEBUG: WebViewReportService.showReport called');
        this.debug.info('- Data type:', typeof data);
        this.debug.info('- Data keys:', Object.keys(data || {}));
        this.debug.info('- Summary data:', data?.summary);
        this.debug.info('- Files count:', data?.files?.length || 0);
        this.debug.info('- Languages count:', data?.languages?.length || 0);
        
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
        this.currentPanel.webview.html = await this.generateWebViewHTML(data);

        // Handle panel disposal
        this.currentPanel.onDidDispose(() => {
            this.currentPanel = undefined;
        }, null);

        // Handle messages from WebView
        this.currentPanel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'refresh':
                        // Trigger refresh by regenerating data and updating current panel
                        this.debug.info('🔄 Refresh requested from webview');
                        try {
                            const workspaceFolders = vscode.workspace.workspaceFolders;
                            
                            if (!workspaceFolders) {
                                this.debug.error('❌ No workspace folder is open for refresh');
                                return;
                            }

                            // Generate new data using the same pattern as CountLinesCommand
                            this.debug.info('🔄 Regenerating line count data...');
                            const lineCounter = new LineCounterService();
                            const folder = workspaceFolders[0];
                            const results = await lineCounter.countLinesWithPathBasedSettings(folder.uri.fsPath);
                            
                            // Convert to ReportData format (using the same conversion logic)
                            const newData = this.convertLineCountToReportData(results, folder.uri.fsPath);
                            
                            this.debug.info('🔄 New data generated, updating panel');
                            await this.updatePanelData(newData);
                            
                        } catch (error) {
                            this.debug.error('❌ Error during refresh:', error);
                        }
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

    private async updatePanelData(data: ReportData): Promise<void> {
        this.debug.info('🔄 DEBUG: updatePanelData called');
        this.debug.info('- Data summary:', data?.summary);
        this.debug.info('- Data files count:', data?.files?.length || 0);
        this.debug.info('- Panel exists:', !!this.currentPanel);
        
        // Store the updated data
        this.currentData = data;
        
        if (this.currentPanel) {
            this.debug.info('📤 DEBUG: Posting message to webview with data');
            // Send new data to existing panel
            this.currentPanel.webview.postMessage({
                command: 'updateData',
                data: data
            });
        }
    }

    private async generateWebViewHTML(data: ReportData): Promise<string> {
        // Read the webview-specific template file
        const templatePath = path.join(__dirname, '../../templates/webview-report.html');
        let htmlTemplate = await fs.promises.readFile(templatePath, 'utf8');
        
        // Replace template placeholders with actual data
        htmlTemplate = htmlTemplate.replace('{{GENERATED_DATE}}', data.generatedDate);
        htmlTemplate = htmlTemplate.replace('{{WORKSPACE_PATH}}', data.workspacePath);
        
        // Embed JSON data directly (much simpler than XML conversion)
        const jsonData = JSON.stringify(data).replace(/\\/g, '\\\\')
                                           .replace(/\r?\n/g, '\\n')
                                           .replace(/'/g, "\\'");
        
        // Embed the JSON data for the template to use
        htmlTemplate = htmlTemplate.replace('{{JSON_DATA}}', jsonData);
        
        return htmlTemplate;
    }

    // UNUSED: Now using template file instead of inline HTML
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
        // Use the report.html template (not webview template) for standalone exports
        const templatePath = path.join(__dirname, '../../templates/report.html');
        let htmlContent = await fs.promises.readFile(templatePath, 'utf8');
        
        // Replace template placeholders like the HTML generator does
        htmlContent = htmlContent.replace('{{GENERATED_DATE}}', data.generatedDate);
        htmlContent = htmlContent.replace('{{WORKSPACE_PATH}}', data.workspacePath);
        
        // Get version from package.json
        const packageJsonPath = path.join(__dirname, '../../package.json');
        const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
        const version = packageJson.version;
        htmlContent = htmlContent.replace(/v0\.12\.1/g, `v${version}`);
        
        // Embed the XML data (this is the key fix!)
        const escapedXmlData = this.escapeForJavaScript(xmlData);
        htmlContent = htmlContent.replace('{{XML_DATA_FALLBACK}}', escapedXmlData);
        
        // Add a note about being exported
        htmlContent = htmlContent.replace(
            '<h1>Code Counter Report</h1>',
            '<h1>Code Counter Report</h1>\n        <div style="background: #e8f4f8; padding: 8px; border-radius: 4px; margin-bottom: 16px; font-size: 0.9em; color: #0066cc;">📄 Exported HTML Report - Standalone Version</div>'
        );
        
        this.debug.info('Standalone HTML generated successfully with embedded XML data');
        return htmlContent;
    }

    private async generateLinkedHtml(data: ReportData, xmlFileName: string): Promise<string> {
        // Read the template
        const templatePath = path.join(__dirname, '../../templates/report.html');
        let htmlTemplate = await fs.promises.readFile(templatePath, 'utf8');
        
        // Replace placeholders
        htmlTemplate = htmlTemplate.replace('{{GENERATED_DATE}}', data.generatedDate);
        htmlTemplate = htmlTemplate.replace('{{WORKSPACE_PATH}}', data.workspacePath);
        
        // Get version from package.json
        const packageJsonPath = path.join(__dirname, '../../package.json');
        const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
        const version = packageJson.version;
        htmlTemplate = htmlTemplate.replace(/v0\.12\.1/g, `v${version}`);
        
        // Generate and embed XML data (even though we also save a separate XML file)
        // This ensures the HTML works standalone if the XML file is missing
        const xmlData = this.convertReportDataToXml(data);
        const escapedXmlData = this.escapeForJavaScript(xmlData);
        htmlTemplate = htmlTemplate.replace('{{XML_DATA_FALLBACK}}', escapedXmlData);
        
        // Add a note about the separate XML file
        htmlTemplate = htmlTemplate.replace(
            '<h1>Code Counter Report</h1>',
            `<h1>Code Counter Report</h1>\n        <div style="background: #e8f4f8; padding: 8px; border-radius: 4px; margin-bottom: 16px; font-size: 0.9em; color: #0066cc;">📊 HTML + XML Export - Data also available in: ${xmlFileName}</div>`
        );
        
        return htmlTemplate;
    }

    private convertLineCountToReportData(results: any, workspacePath: string): ReportData {
        this.debug.info('🔍 Converting line count results to ReportData');
        
        // Calculate summary statistics
        const summary = {
            totalFiles: results.files?.length || 0,
            totalLines: results.files?.reduce((sum: number, file: any) => sum + (file.lines || 0), 0) || 0,
            totalCodeLines: results.files?.reduce((sum: number, file: any) => sum + (file.codeLines || 0), 0) || 0,
            totalCommentLines: results.files?.reduce((sum: number, file: any) => sum + (file.commentLines || 0), 0) || 0,
            totalBlankLines: results.files?.reduce((sum: number, file: any) => sum + (file.blankLines || 0), 0) || 0,
            languageCount: 0
        };

        // Group files by language
        const languageGroups: { [key: string]: any[] } = {};
        results.files?.forEach((file: any) => {
            const lang = file.language || 'Unknown';
            if (!languageGroups[lang]) {
                languageGroups[lang] = [];
            }
            languageGroups[lang].push(file);
        });

        // Calculate language statistics
        const languages = Object.keys(languageGroups).map(langName => {
            const langFiles = languageGroups[langName];
            return {
                name: langName,
                files: langFiles.length,
                lines: langFiles.reduce((sum, file) => sum + (file.lines || 0), 0),
                codeLines: langFiles.reduce((sum, file) => sum + (file.codeLines || 0), 0),
                commentLines: langFiles.reduce((sum, file) => sum + (file.commentLines || 0), 0),
                blankLines: langFiles.reduce((sum, file) => sum + (file.blankLines || 0), 0)
            };
        });

        summary.languageCount = languages.length;

        // Prepare files data
        const files = results.files?.map((file: any) => ({
            path: file.path || '',
            relativePath: file.relativePath || '',
            language: file.language || 'Unknown',
            lines: file.lines || 0,
            codeLines: file.codeLines || 0,
            commentLines: file.commentLines || 0,
            blankLines: file.blankLines || 0,
            size: file.size || 0
        })) || [];

        return {
            summary,
            languages,
            files,
            workspacePath,
            generatedDate: new Date().toISOString()
        };
    }

    private getDateString(): string {
        const now = new Date();
        return now.toISOString().slice(0, 19).replace(/[:.]/g, '-');
    }

    private escapeForJavaScript(xmlData: string): string {
        return xmlData
            .replace(/\\/g, '\\\\')    // Escape backslashes first
            .replace(/'/g, "\\'")      // Escape single quotes
            .replace(/"/g, '\\"')      // Escape double quotes
            .replace(/\r?\n/g, '\\n')  // Escape newlines
            .replace(/\r/g, '\\r')     // Escape carriage returns
            .replace(/\t/g, '\\t')     // Escape tabs
            .replace(/\f/g, '\\f')     // Escape form feeds
            .replace(/\v/g, '\\v')     // Escape vertical tabs
            .replace(/\0/g, '\\0')     // Escape null characters
            .replace(/\u2028/g, '\\u2028') // Escape line separator
            .replace(/\u2029/g, '\\u2029'); // Escape paragraph separator
    }
}