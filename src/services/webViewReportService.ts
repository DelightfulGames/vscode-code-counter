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
        directory: string;
        fileName: string;
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
                    case 'openFile':
                        // Handle opening files in VS Code
                        if (message.filePath) {
                            try {
                                this.debug.info('🔗 Opening file from webview:', message.filePath);
                                const uri = vscode.Uri.file(message.filePath);
                                await vscode.window.showTextDocument(uri, { preview: false });
                                this.debug.info('✅ File opened successfully');
                            } catch (error) {
                                this.debug.error('❌ Failed to open file:', error);
                                vscode.window.showErrorMessage(`Failed to open file: ${message.filePath}`);
                            }
                        } else {
                            this.debug.error('❌ No file path provided in openFile message');
                        }
                        break;
                    case 'export':
                        // Handle export requests with current data
                        if (this.currentData) {
                            await this.exportReport(this.currentData);
                        }
                        break;
                    case 'saveCSV':
                        // Handle CSV save requests from webview
                        this.debug.info('💾 CSV save requested from webview');
                        if (message.data && message.filename) {
                            try {
                                await this.saveCSVFile(message.data, message.filename);
                            } catch (error) {
                                this.debug.error('❌ Failed to save CSV file:', error);
                                vscode.window.showErrorMessage(`Failed to save CSV file: ${error instanceof Error ? error.message : String(error)}`);
                            }
                        } else {
                            this.debug.error('❌ Invalid CSV save request - missing data or filename');
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
        this.debug.info('🎨 Generating webview HTML with external assets');
        
        // Read the webview-specific template file
        const templatePath = path.join(__dirname, '../../templates/webview-report.html');
        this.debug.info('📁 Loading webview template from:', templatePath);
        let htmlTemplate = await fs.promises.readFile(templatePath, 'utf8');
        this.debug.info('📄 Template loaded:', { 
            length: htmlTemplate.length, 
            lines: htmlTemplate.split('\n').length,
            firstLine: htmlTemplate.split('\n')[0],
            containsDataFiles: htmlTemplate.includes('{{DATA_FILES}}')
        });
        
        // Read external CSS file
        const cssPath = path.join(__dirname, '../../templates/webview-report.css');
        let cssContent = '';
        try {
            cssContent = await fs.promises.readFile(cssPath, 'utf8');
            this.debug.info('✅ CSS file loaded successfully');
        } catch (error) {
            this.debug.error('❌ Failed to load CSS file:', error);
            cssContent = '/* CSS file not found */';
        }
        
        // Read all modular JavaScript files in correct loading order
        const jsModules = [
            'core.js',
            'tabulator-manager-common.js',  // Load common utilities first
            'data-manager.js', 
            'ui-handlers.js',
            'tabulator-manager.js',
            'filter-manager.js',
            'webview-report.js'
        ];
        
        let jsContent = '';
        for (const module of jsModules) {
            const modulePath = path.join(__dirname, `../../templates/${module}`);
            try {
                const moduleContent = await fs.promises.readFile(modulePath, 'utf8');
                jsContent += `\n// === ${module.toUpperCase()} ===\n`;
                jsContent += moduleContent;
                jsContent += `\n// === END ${module.toUpperCase()} ===\n`;
                this.debug.info(`✅ ${module} loaded successfully (${moduleContent.length} chars)`);
                
                // Special debug for webview-report.js to check for template placeholder
                if (module === 'webview-report.js') {
                    const hasPlaceholder = moduleContent.includes('{{JSON_DATA}}');
                    this.debug.info(`🔍 webview-report.js contains {{JSON_DATA}} placeholder: ${hasPlaceholder}`);
                }
            } catch (error) {
                this.debug.error(`❌ Failed to load ${module}:`, error);
                jsContent += `\n// ERROR: Failed to load ${module}\nconsole.error("${module} not found");\n`;
            }
        }
        
        this.debug.info('✅ All JavaScript modules loaded successfully');
        
        // Replace template placeholders with actual data
        htmlTemplate = htmlTemplate.replace('{{GENERATED_DATE}}', data.generatedDate);
        htmlTemplate = htmlTemplate.replace('{{WORKSPACE_PATH}}', data.workspacePath);
        
        // Embed JSON data with proper escaping for JavaScript strings
        const jsonData = JSON.stringify(data)
            .replace(/\\/g, '\\\\')   // Escape backslashes
            .replace(/'/g, "\\'");    // Escape single quotes

        // Inject CSS content
        const cssInjection = `<style>\n${cssContent}\n</style>`;
        htmlTemplate = htmlTemplate.replace('{{INJECTED_CSS}}', cssInjection);

        // Debug: Check for placeholder before replacement
        const assignmentPattern = /const embeddedJsonData = '{{JSON_DATA}}';/g;
        const allPlaceholderPattern = /\{\{JSON_DATA\}\}/g;
        const originalCount = (jsContent.match(allPlaceholderPattern) || []).length;
        const assignmentCount = (jsContent.match(assignmentPattern) || []).length;
        
        this.debug.info(`🔍 Before replacement: Found ${originalCount} total {{JSON_DATA}} placeholders`);
        this.debug.info(`🎯 Assignment patterns to replace: ${assignmentCount}`);
        this.debug.info(`📊 JSON data preview: ${jsonData.substring(0, 100)}...`);
        
        // Replace only the assignment, not the comparison checks
        jsContent = jsContent.replace(assignmentPattern, `const embeddedJsonData = '${jsonData}';`);
        const newCount = (jsContent.match(allPlaceholderPattern) || []).length;
        
        this.debug.info(`🔄 JSON template replacement: ${originalCount} placeholders found, ${originalCount - newCount} replaced`);
        this.debug.info(`📊 JSON data length: ${jsonData.length} characters`);
        
        // Debug: Check if replacement was successful
        const newAssignmentCount = (jsContent.match(assignmentPattern) || []).length;
        if (assignmentCount > 0 && newAssignmentCount === 0) {
            this.debug.info('✅ Template replacement successful - assignment pattern replaced');
            this.debug.info(`🔍 Remaining comparison placeholders: ${newCount} (expected: 2)`);
        } else if (assignmentCount === 0) {
            this.debug.error('❌ No assignment {{JSON_DATA}} placeholders found in JavaScript content');
        } else {
            this.debug.error(`❌ Template replacement failed: ${newAssignmentCount} assignment patterns still remain`);
        }
        
        const jsInjection = `<script>\n${jsContent}\n</script>`;
        
        htmlTemplate = htmlTemplate.replace('{{INJECTED_JS}}', jsInjection);
        
       
        this.debug.info('🎉 Webview HTML generation completed with injected assets');
        return htmlTemplate;
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

    /**
     * Public method for generating standalone HTML content (used by HtmlGeneratorService)
     */
    async generateStandaloneHtmlContent(data: ReportData, xmlData: string): Promise<string> {
        this.debug.info('🔧 WebViewReportService.generateStandaloneHtmlContent called', {
            filesCount: data.files.length,
            xmlLength: xmlData.length,
            workspacePath: data.workspacePath
        });
        return this.generateStandaloneHtml(data, xmlData);
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
        
        // Convert ReportData to the file format expected by the template
        const filesJson = JSON.stringify(data.files).slice(1, -1); // Remove outer brackets
        this.debug.info('Generated files JSON for template:', { 
            filesCount: data.files.length, 
            jsonLength: filesJson.length,
            preview: filesJson.substring(0, 200) + '...'
        });
        
        // Replace the DATA_FILES placeholder
        htmlContent = htmlContent.replace('{{DATA_FILES}}', filesJson);
        
        console.log('PLACEHOLDER REPLACEMENT DEBUG');
        console.log('Files JSON length:', filesJson.length);
        console.log('Files JSON preview:', filesJson.substring(0, 100));
        console.log('HTML contains placeholder after replacement:', htmlContent.includes('{{DATA_FILES}}'));
        console.log('HTML contains file data:', htmlContent.includes('"path":'));
        
        // Verify replacement worked
        const replacementCheck = htmlContent.includes('{{DATA_FILES}}');
        this.debug.info('Template placeholder replacement result:', { 
            stillContainsPlaceholder: replacementCheck,
            filesDataLength: filesJson.length
        });
        
        // Add a note about being exported
        htmlContent = htmlContent.replace(
            '<h1>Code Counter Report</h1>',
            '<h1>Code Counter Report</h1>\n        <div style="background: #e8f4f8; padding: 8px; border-radius: 4px; margin-bottom: 16px; font-size: 0.9em; color: #0066cc;">📄 Exported HTML Report - Standalone Version</div>'
        );
        
        this.debug.info('Standalone HTML generated successfully with file data embedded');
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

    private async saveCSVFile(csvData: string, suggestedFilename: string): Promise<void> {
        this.debug.info('💾 Attempting to save CSV file:', suggestedFilename);
        
        try {
            // Show save dialog to let user choose location
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(suggestedFilename),
                filters: {
                    'CSV Files': ['csv'],
                    'All Files': ['*']
                },
                saveLabel: 'Save CSV Report'
            });

            if (saveUri) {
                // Write the CSV data to the selected file
                const encoder = new TextEncoder();
                const csvBytes = encoder.encode(csvData);
                
                await vscode.workspace.fs.writeFile(saveUri, csvBytes);
                
                this.debug.info('✅ CSV file saved successfully:', saveUri.fsPath);
                vscode.window.showInformationMessage(`CSV report saved to: ${saveUri.fsPath}`);
                
                // Optionally open the file location
                const openAction = 'Open File Location';
                const result = await vscode.window.showInformationMessage(
                    'CSV export completed successfully!', 
                    openAction
                );
                
                if (result === openAction) {
                    await vscode.commands.executeCommand('revealFileInOS', saveUri);
                }
            } else {
                this.debug.info('📤 CSV save cancelled by user');
            }
        } catch (error) {
            this.debug.error('❌ Error saving CSV file:', error);
            throw error;
        }
    }
}