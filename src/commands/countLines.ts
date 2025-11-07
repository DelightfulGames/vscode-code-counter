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
import { JsonGeneratorService } from '../services/jsonGenerator';
import { CsvGeneratorService } from '../services/csvGenerator';
import { ExportAllService } from '../services/exportAllService';
import { HtmlGeneratorService } from '../services/htmlGenerator';
import { WebViewReportService, ReportData } from '../services/webViewReportService';
import { WorkspaceDatabaseService } from '../services/workspaceDatabaseService';
import { DebugService } from '../services/debugService';
import path from 'path';

export class CountLinesCommand {
    private debug = DebugService.getInstance();
    private lineCounter: LineCounterService;
    private xmlGenerator: XmlGeneratorService;
    private jsonGenerator: JsonGeneratorService;
    private csvGenerator: CsvGeneratorService;
    private exportAllService: ExportAllService;
    private htmlGenerator: HtmlGeneratorService;

    constructor() {
        this.lineCounter = new LineCounterService();
        this.xmlGenerator = new XmlGeneratorService();
        this.jsonGenerator = new JsonGeneratorService();
        this.csvGenerator = new CsvGeneratorService();
        this.exportAllService = new ExportAllService();
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
            this.debug.warning('Failed to get workspace exclusion patterns, falling back to global settings:', error);
            // Fallback to global settings if workspace settings fail
            const config = vscode.workspace.getConfiguration('codeCounter');
            return config.get<string[]>('excludePatterns', []);
        }
    }

    /**
     * Get inclusion patterns for a workspace folder using hierarchical settings
     */
    private async getInclusionPatterns(workspacePath: string): Promise<string[]> {
        try {
            const workspaceService = new WorkspaceDatabaseService(workspacePath);
            const settingsWithInheritance = await workspaceService.getSettingsWithInheritance(workspacePath);
            return settingsWithInheritance.resolvedSettings['codeCounter.includePatterns'] || [];
        } catch (error) {
            this.debug.warning('Failed to get workspace inclusion patterns, falling back to global settings:', error);
            // Fallback to global settings if workspace settings fail
            const config = vscode.workspace.getConfiguration('codeCounter');
            return config.get<string[]>('includePatterns', []);
        }
    }

    async execute(): Promise<void> {
        this.debug.info('🚀 CountLinesCommand.execute() called');
        
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        if (!workspaceFolders) {
            this.debug.error('❌ No workspace folder is open');
            vscode.window.showErrorMessage('No workspace folder is open');
            return;
        }
        
        this.debug.info('📁 Found workspace folders:', workspaceFolders.length);

        // Ask user for output preference
        const choice = await vscode.window.showQuickPick([
            {
                label: '📊 Show Report Panel',
                description: 'View results in VS Code panel (recommended)',
                detail: 'Interactive report with real-time updates'
            },
            {
                label: '📊 Export Report',
                description: 'Generate a standalone HTML report file',
                detail: 'Create File for sharing or external viewing'
            },
            {
                label: '💾 Export Data',
                description: 'Generate HTML, JSON, CSV, and XML files',
                detail: 'Create files for sharing or external viewing'
            }
        ], {
            placeHolder: 'How would you like to view the data?'
        });

        if (!choice) {
            return; // User cancelled
        }

        try {
            vscode.window.showInformationMessage('Counting lines of code...');
            
            // Use path-based settings instead of workspace-level patterns
            const folder = workspaceFolders[0];

            if (choice.label.includes('Show Report Panel')) {
                // Show in WebView panel using path-based settings
                const results = await this.lineCounter.countLinesWithPathBasedSettings(folder.uri.fsPath);
                
                this.debug.info('CountLinesCommand execute results (path-based):', {
                    totalFiles: results.files?.length || 0,
                    totalLines: results.totalLines || 0,
                    workspacePath: results.workspacePath,
                    languageStats: results.languageStats,
                    sampleFiles: results.files?.slice(0, 3).map((f: any) => ({ 
                        path: f.relativePath, 
                        lines: f.lines, 
                        language: f.language 
                    })) || []
                });
                
                this.debug.info('Converting results to report data...');
                const reportData = this.convertToReportData(results, folder.uri.fsPath);
                
                this.debug.info('Converted report data:', {
                    totalFiles: reportData.summary?.totalFiles || 0,
                    totalLines: reportData.summary?.totalLines || 0,
                    filesCount: reportData.files?.length || 0,
                    languagesCount: reportData.languages?.length || 0,
                    sampleReportFiles: reportData.files?.slice(0, 3).map(f => ({
                        path: f.relativePath,
                        lines: f.lines,
                        language: f.language
                    })) || []
                });
                
                const webViewService = WebViewReportService.getInstance();
                await webViewService.showReport(reportData);

                vscode.window.showInformationMessage('Line counting completed! Report opened in panel.');
            } else if (choice.label.includes('Export Report')) {
                // Generate HTML files
                const config = vscode.workspace.getConfiguration('codeCounter');
                const outputDirectory = config.get<string>('outputDirectory', '.vscode/code-counter/reports');
                
                let filePath = '';
                for (const folder of workspaceFolders) {
                    // Use path-based settings for HTML export as well
                    const results = await this.lineCounter.countLinesWithPathBasedSettings(folder.uri.fsPath);
                    filePath = await this.htmlGenerator.generateHtmlReport(results, folder.uri.fsPath, outputDirectory);
                }

                vscode.window.showInformationMessage(`Line counting completed! ${filePath} generated.`, );
            } else {
                // Export data options
                const exportChoice = await vscode.window.showQuickPick([                    
                    {
                        label: '📚 Export Data Package',
                        description: 'Exports all available export formats',
                        detail: 'Create Files for sharing or external viewing'
                    },
                    {
                        label: '📙 Export XML',
                        description: 'Exports the data as XML',
                        detail: 'Create Files for sharing or external viewing'
                    },
                    {
                        label: '📘 Export JSON',
                        description: 'Exports the data as JSON',
                        detail: 'Create files for sharing or external viewing'
                    },
                    {
                        label: '📗 Export CSV',
                        description: 'Exports the data as CSV',
                        detail: 'Create File for sharing or external viewing'
                    }
                ], {
                    placeHolder: 'How would you like to export the data?'
                });

                if (!exportChoice) {
                    return; // User cancelled
                }

                if (exportChoice.label.includes('Export XML')) {
                    const config = vscode.workspace.getConfiguration('codeCounter');
                    let outputDirectory = config.get<string>('outputDirectory', '.vscode/code-counter/reports');

                    for (const folder of workspaceFolders) {
                        // Use path-based settings for XML export as well
                        const results = await this.lineCounter.countLinesWithPathBasedSettings(folder.uri.fsPath);
                        outputDirectory = path.join(folder.uri.fsPath, outputDirectory);
                        const xmlPath = await this.xmlGenerator.generateXmlFile(results, outputDirectory);
                        vscode.window.showInformationMessage(`XML export completed! File saved to: ${xmlPath}`);
                    }                    
                } else if (exportChoice.label.includes('Export JSON')) {
                    const config = vscode.workspace.getConfiguration('codeCounter');
                    let outputDirectory = config.get<string>('outputDirectory', '.vscode/code-counter/reports');

                    for (const folder of workspaceFolders) {
                        const results = await this.lineCounter.countLinesWithPathBasedSettings(folder.uri.fsPath);
                        outputDirectory = path.join(folder.uri.fsPath, outputDirectory);
                        const jsonPath = await this.jsonGenerator.generateJsonFile(results, outputDirectory);
                        vscode.window.showInformationMessage(`JSON export completed! File saved to: ${jsonPath}`);
                    }
                } else if (exportChoice.label.includes('Export CSV')) {
                    const config = vscode.workspace.getConfiguration('codeCounter');
                    let outputDirectory = config.get<string>('outputDirectory', '.vscode/code-counter/reports');

                    for (const folder of workspaceFolders) {
                        const results = await this.lineCounter.countLinesWithPathBasedSettings(folder.uri.fsPath);
                        outputDirectory = path.join(folder.uri.fsPath, outputDirectory);
                        const csvPath = await this.csvGenerator.generateCsvFile(results, outputDirectory);
                        vscode.window.showInformationMessage(`CSV export completed! File saved to: ${csvPath}`);
                    }
                } else {
                    // Export all formats
                    const config = vscode.workspace.getConfiguration('codeCounter');
                    let outputDirectory = config.get<string>('outputDirectory', '.vscode/code-counter/reports');

                    for (const folder of workspaceFolders) {
                        const results = await this.lineCounter.countLinesWithPathBasedSettings(folder.uri.fsPath);
                        outputDirectory = path.join(folder.uri.fsPath, outputDirectory);
                        const exportResults = await this.exportAllService.exportAllFormats(results, outputDirectory);
                        const action = await vscode.window.showInformationMessage(
                            `All formats exported! ${exportResults.totalFiles} files saved to: ${outputDirectory}`, 
                            'Open Folder'
                        );
                        
                        if (action === 'Open Folder') {
                            await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(outputDirectory));
                        }
                    }
                }

            }        
            
            // Refresh decorations after counting is complete
            this.refreshDecorations();
            
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
            
            // Count lines for the first workspace folder using path-based settings
            const folder = workspaceFolders[0];
            const results = await this.lineCounter.countLinesWithPathBasedSettings(folder.uri.fsPath);
            
            // Convert to WebView report data format
            const reportData = this.convertToReportData(results, folder.uri.fsPath);
            
            // Show in WebView panel
            const webViewService = WebViewReportService.getInstance();
            await webViewService.showReport(reportData);

            vscode.window.showInformationMessage('Line counting completed! Report opened in panel.');
            
            // Refresh decorations after counting is complete
            this.refreshDecorations();
            
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
            const outputDirectory = config.get<string>('outputDirectory', '.vscode/code-counter/reports');

            let exportedFilePath = '';
            // Generate HTML files for all workspace folders using path-based settings
            for (const folder of workspaceFolders) {
                const results = await this.lineCounter.countLinesWithPathBasedSettings(folder.uri.fsPath);
                exportedFilePath = await this.htmlGenerator.generateHtmlReport(results, folder.uri.fsPath, outputDirectory);
            }
            
            // Log for debugging auto-generation
            this.debug.info(`Auto-generated report saved to: ${exportedFilePath}`);

            // Count lines for notification (use first workspace folder for summary) using path-based settings
            const folder = workspaceFolders[0];
            const results = await this.lineCounter.countLinesWithPathBasedSettings(folder.uri.fsPath);
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
            this.debug.error('Auto line count failed:', error);
        }
        
        // Refresh decorations after counting is complete
        this.refreshDecorations();
    }

    private convertToReportData(results: any, workspacePath: string): ReportData {
        this.debug.info('🔍 DEBUG: convertToReportData called with:');
        this.debug.info('- Results type:', typeof results);
        this.debug.info('- Results keys:', Object.keys(results || {}));
        this.debug.info('- Files array length:', results.files?.length || 0);
        
        if (results.files && results.files.length > 0) {
            this.debug.info('- First file sample:', JSON.stringify(results.files[0], null, 2));
        }
        
        // Calculate summary statistics
        const summary = {
            totalFiles: results.files?.length || 0,
            totalLines: results.files?.reduce((sum: number, file: any) => sum + (file.lines || 0), 0) || 0,
            totalCodeLines: results.files?.reduce((sum: number, file: any) => sum + (file.codeLines || 0), 0) || 0,
            totalCommentLines: results.files?.reduce((sum: number, file: any) => sum + (file.commentLines || 0), 0) || 0,
            totalBlankLines: results.files?.reduce((sum: number, file: any) => sum + (file.blankLines || 0), 0) || 0,
            languageCount: 0
        };
        
        this.debug.info('📊 DEBUG: Calculated summary:', summary);

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

        const reportData = {
            summary,
            languages,
            files,
            workspacePath,
            generatedDate: new Date().toLocaleString()
        };
        
        this.debug.info('✅ DEBUG: Final ReportData structure:');
        this.debug.info('- Summary:', reportData.summary);
        this.debug.info('- Languages count:', reportData.languages.length);
        this.debug.info('- Files count:', reportData.files.length);
        this.debug.info('- First language sample:', reportData.languages[0] || 'none');
        this.debug.info('- First file sample:', reportData.files[0] || 'none');
        
        return reportData;
    }

    private refreshDecorations(): void {
        // Trigger decorator refresh by firing a command that the extension handles
        // This ensures decorations are updated after line counting
        vscode.commands.executeCommand('codeCounter.internal.refreshDecorations');
    }
}