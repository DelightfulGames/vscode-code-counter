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
import { LineCounterService } from '../services/lineCounter';
import { XmlGeneratorService } from '../services/xmlGenerator';
import { HtmlGeneratorService } from '../services/htmlGenerator';
import { WebViewReportService, ReportData } from '../services/webViewReportService';
import { WorkspaceDatabaseService } from '../services/workspaceDatabaseService';

export class CountLinesCommand {
    private lineCounter: LineCounterService;
    private xmlGenerator: XmlGeneratorService;
    private htmlGenerator: HtmlGeneratorService;

    constructor() {
        this.lineCounter = new LineCounterService();
        this.xmlGenerator = new XmlGeneratorService();
        this.htmlGenerator = new HtmlGeneratorService();
    }

    /**
     * Get exclusion patterns for a workspace folder using hierarchical settings
     */
    private async getExclusionPatterns(workspacePath: string): Promise<string[]> {
        try {
            const workspaceService = new WorkspaceDatabaseService(workspacePath);
            const settingsWithInheritance = await workspaceService.getSettingsWithInheritance(workspacePath);
            return settingsWithInheritance.resolvedSettings['codeCounter.excludePatterns'] || [];
        } catch (error) {
            console.warn('Failed to get workspace exclusion patterns, falling back to global settings:', error);
            // Fallback to global settings if workspace settings fail
            const config = vscode.workspace.getConfiguration('codeCounter');
            return config.get<string[]>('excludePatterns', []);
        }
    }

    async execute(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder is open');
            return;
        }

        // Ask user for output preference
        const choice = await vscode.window.showQuickPick([
            {
                label: '📊 Show Report Panel',
                description: 'View results in VS Code panel (recommended)',
                detail: 'Interactive report with real-time updates'
            },
            {
                label: '📄 Export HTML Files',
                description: 'Generate HTML and XML files',
                detail: 'Create files for sharing or external viewing'
            }
        ], {
            placeHolder: 'How would you like to view the report?'
        });

        if (!choice) {
            return; // User cancelled
        }

        try {
            vscode.window.showInformationMessage('Counting lines of code...');
            
            // Get exclusion patterns using hierarchical workspace settings
            const folder = workspaceFolders[0];
            const excludePatterns = await this.getExclusionPatterns(folder.uri.fsPath);

            if (choice.label.includes('Panel')) {
                // Show in WebView panel
                const results = await this.lineCounter.countLines(folder.uri.fsPath, excludePatterns);
                const reportData = this.convertToReportData(results, folder.uri.fsPath);
                
                const webViewService = WebViewReportService.getInstance();
                await webViewService.showReport(reportData);

                vscode.window.showInformationMessage('Line counting completed! Report opened in panel.');
            } else {
                // Generate HTML/XML files
                const config = vscode.workspace.getConfiguration('codeCounter');
                const outputDirectory = config.get<string>('outputDirectory', './.cc/reports');
                
                for (const folder of workspaceFolders) {
                    const folderExcludePatterns = await this.getExclusionPatterns(folder.uri.fsPath);
                    const results = await this.lineCounter.countLines(folder.uri.fsPath, folderExcludePatterns);
                    const xmlData = this.xmlGenerator.generateXml(results);
                    await this.htmlGenerator.generateHtmlReport(xmlData, folder.uri.fsPath, outputDirectory);
                }

                vscode.window.showInformationMessage('Line counting completed! HTML reports generated.');
            }
            
        } catch (error) {
            vscode.window.showErrorMessage(`Error counting lines: ${error}`);
        }
    }

    async executeAndShowPanel(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder is open');
            return;
        }

        try {
            vscode.window.showInformationMessage('Counting lines of code...');
            
            // Count lines for the first workspace folder (or combine if multiple)
            const folder = workspaceFolders[0];
            const excludePatterns = await this.getExclusionPatterns(folder.uri.fsPath);
            const results = await this.lineCounter.countLines(folder.uri.fsPath, excludePatterns);
            
            // Convert to WebView report data format
            const reportData = this.convertToReportData(results, folder.uri.fsPath);
            
            // Show in WebView panel
            const webViewService = WebViewReportService.getInstance();
            await webViewService.showReport(reportData);

            vscode.window.showInformationMessage('Line counting completed! Report opened in panel.');
            
        } catch (error) {
            vscode.window.showErrorMessage(`Error counting lines: ${error}`);
        }
    }

    /**
     * Execute command with notification-based UI (for auto-generated reports)
     */
    public async executeAndShowNotification(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        if (!workspaceFolders) {
            return; // Silently ignore if no workspace
        }

        try {
            // Get configuration
            const config = vscode.workspace.getConfiguration('codeCounter');
            const showNotification = config.get<boolean>('showNotificationOnAutoGenerate', false);
            const outputDirectory = config.get<string>('outputDirectory', './.cc/reports');

            // Generate HTML/XML files for all workspace folders
            for (const folder of workspaceFolders) {
                const excludePatterns = await this.getExclusionPatterns(folder.uri.fsPath);
                const results = await this.lineCounter.countLines(folder.uri.fsPath, excludePatterns);
                const xmlData = this.xmlGenerator.generateXml(results);
                await this.htmlGenerator.generateHtmlReport(xmlData, folder.uri.fsPath, outputDirectory);
            }
            
            // Log for debugging auto-generation
            console.log(`Auto-generated reports saved to: ${outputDirectory}`);

            // Count lines for notification (use first workspace folder for summary)
            const folder = workspaceFolders[0];
            const excludePatterns = await this.getExclusionPatterns(folder.uri.fsPath);
            const results = await this.lineCounter.countLines(folder.uri.fsPath, excludePatterns);
            const reportData = this.convertToReportData(results, folder.uri.fsPath);

            // Only show notification if enabled in settings
            if (showNotification) {
                // Show notification with button to view report
                const action = await vscode.window.showInformationMessage(
                    `📊 Reports auto-generated: ${reportData.summary.totalFiles} files, ${reportData.summary.totalLines.toLocaleString()} lines`,
                    {
                        modal: false
                    },
                    'View Report'
                );

                if (action === 'View Report') {
                    const webViewService = WebViewReportService.getInstance();
                    await webViewService.showReport(reportData);
                }
            }

        } catch (error) {
            // Silently log errors for auto-generated reports to avoid spam
            console.error('Auto line count failed:', error);
        }
    }

    private convertToReportData(results: any, workspacePath: string): ReportData {
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
            const files = languageGroups[langName];
            return {
                name: langName,
                files: files.length,
                lines: files.reduce((sum, file) => sum + (file.lines || 0), 0),
                codeLines: files.reduce((sum, file) => sum + (file.codeLines || 0), 0),
                commentLines: files.reduce((sum, file) => sum + (file.commentLines || 0), 0),
                blankLines: files.reduce((sum, file) => sum + (file.blankLines || 0), 0)
            };
        });

        summary.languageCount = languages.length;

        // Prepare file data
        const files = results.files?.map((file: any) => ({
            path: file.path || '',
            relativePath: file.relativePath || file.path || '',
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
            generatedDate: new Date().toLocaleString()
        };
    }
}