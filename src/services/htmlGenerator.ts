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
import * as fs from 'fs';
import * as path from 'path';
import { DebugService } from './debugService';
import { LineCountResult } from '../types';

export class HtmlGeneratorService {
    private debug = DebugService.getInstance();
    
    async generateHtmlReport(result: LineCountResult, workspacePath: string, outputDirectory: string): Promise<string> {
        console.log('SIMPLE DEBUG TEST - generateHtmlReport called');
        console.log('Result has files:', !!(result && result.files));
        console.log('Files count:', result && result.files ? result.files.length : 0);
        
        // Generate XML data from result
        const xmlGenerator = new (require('./xmlGenerator').XmlGeneratorService)();
        const xmlData = xmlGenerator.generateXml(result);
        
        // Ensure output directory exists
        const fullOutputPath = path.resolve(workspacePath, outputDirectory);
        await this.ensureDirectoryExists(fullOutputPath);
        
        // Read the HTML template
        const templatePath = path.join(__dirname, '../../templates/report.html');
        let htmlTemplate = await fs.promises.readFile(templatePath, 'utf8');
        
        // Get version from package.json
        const packageJsonPath = path.join(__dirname, '../../package.json');
        const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
        const version = packageJson.version;
        
        // Replace template placeholders
        htmlTemplate = htmlTemplate.replace('{{GENERATED_DATE}}', new Date().toLocaleString());
        htmlTemplate = htmlTemplate.replace('{{WORKSPACE_PATH}}', workspacePath.replace(/\\/g, '/'));
        htmlTemplate = htmlTemplate.replace(/v0\.12\.1/g, `v${version}`);
        
        // Provide XML data as fallback for file:// protocol access
        // Properly escape XML data for JavaScript string literal
        const escapedXmlData = this.escapeForJavaScript(xmlData);
        htmlTemplate = htmlTemplate.replace('{{XML_DATA_FALLBACK}}', escapedXmlData);
        
        // Embed JavaScript modules directly into the HTML first
        const embeddedJavaScript = await this.getEmbeddedJavaScript();
        htmlTemplate = htmlTemplate.replace('{{JS_PLACEHOLDER}}', embeddedJavaScript);
        
        // Generate JSON file data directly from result (much simpler than parsing XML)
        const filesJsonData = this.generateFileDataFromResult(result);
        htmlTemplate = htmlTemplate.replace(/\{\{DATA_FILES\}\}/g, filesJsonData);
        
        console.log('HTML GENERATOR DEBUG:');
        console.log('Result files count:', result.files ? result.files.length : 0);
        console.log('Files JSON data length:', filesJsonData.length);
        console.log('Files JSON preview:', filesJsonData.substring(0, 200));
        console.log('Template contains DATA_FILES after replacement:', htmlTemplate.includes('{{DATA_FILES}}'));
        console.log('Embedded JavaScript length:', embeddedJavaScript.length);
        
        // Write the HTML file
        const htmlFilePath = path.join(fullOutputPath, 'code-counter-report.html');
        await fs.promises.writeFile(htmlFilePath, htmlTemplate);
        
        this.debug.info(`Reports generated: ${htmlFilePath}`);
        return htmlFilePath;
    }
    
    private async ensureDirectoryExists(dirPath: string): Promise<void> {
        try {
            await fs.promises.access(dirPath);
        } catch {
            await fs.promises.mkdir(dirPath, { recursive: true });
        }
    }

    private async getEmbeddedJavaScript(): Promise<string> {
        const templatesPath = path.join(__dirname, '../../templates');
        // Use standalone versions of JavaScript files for HTML export
        // Load in correct dependency order: common utilities, tabulator functions, filter manager, data manager, then UI handlers
        const jsFiles = ['tabulator-manager-common.js', 'tabulator-manager-standalone.js', 'filter-manager.js', 'data-manager.js', 'ui-handlers-standalone.js'];
        let combinedJs = '';
        
        for (const jsFile of jsFiles) {
            try {
                const sourcePath = path.join(templatesPath, jsFile);
                let jsContent = await fs.promises.readFile(sourcePath, 'utf8');
                
                // Rename conflicting functions and add safety checks
                if (jsFile === 'data-manager.js') {
                    jsContent = jsContent.replace(/function populateReport\(/g, 'function populateReportFromData(');
                    // Only replace populateReport calls that are function calls, not property access
                    jsContent = jsContent.replace(/([^.]|^)populateReport\(/g, '$1populateReportFromData(');
                }
                
                // Add safety checks for toLocaleString calls in both data-manager and tabulator-manager
                if (jsFile === 'data-manager.js' || jsFile === 'tabulator-manager.js') {
                    jsContent = jsContent.replace(/(\w+)\.toLocaleString\(\)/g, 'safeToLocaleString($1)');
                }
                
                // Add file separator comment and the content
                combinedJs += `\n// ========== ${jsFile} ==========\n`;
                combinedJs += jsContent;
                combinedJs += `\n// ========== End of ${jsFile} ==========\n\n`;
                
                this.debug.verbose(`Embedded JavaScript module: ${jsFile} (${jsContent.length} chars)`);
            } catch (error) {
                this.debug.warning(`Failed to read JavaScript module ${jsFile}:`, error);
            }
        }
        
        // Add missing functions that might be called by the modules
        combinedJs += `
// ========== Additional Functions ==========

/**
 * Safe toLocaleString function that handles undefined/null values
 */
function safeToLocaleString(value) {
    if (value === null || value === undefined || isNaN(value)) {
        return '0';
    }
    return Number(value).toLocaleString();
}

/**
 * Wrapper to ensure all embedded functions run in safe context
 */
function runInSafeContext(fn, ...args) {
    try {
        return fn.apply(this, args);
    } catch (error) {
        debug.error('Error in embedded function:', error);
        debug.error('Function name:', fn.name);
        debug.error('Arguments:', args);
        throw error;
    }
}

/**
 * Provide VS Code API fallback for standalone HTML reports
 */
if (typeof vscode === 'undefined') {
    window.vscode = {
        postMessage: function(message) {
            debug.info('📨 VS Code API not available (standalone HTML), message:', message);
            
            // Handle CSV export in standalone mode
            if (message.command === 'saveCSV') {
                const blob = new Blob([message.data], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = message.filename || 'export.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                debug.info('✅ CSV file downloaded in standalone mode');
            }
        }
    };
}

/**
 * Ensure data-manager functions work with HTML template data structure
 */
function initializeReportFromEmbeddedData() {
    debug.info('🎯 Initializing report from embedded data...');
    
    // Try to get embedded JSON data
    const embeddedJsonFiles = '[{{DATA_FILES}}]';
    if (embeddedJsonFiles && embeddedJsonFiles !== '[{{DATA_FILES}}]') {
        try {
            const files = JSON.parse(embeddedJsonFiles);
            
            // Calculate summary statistics like data-manager expects with safe numeric conversion
            const summary = {
                totalFiles: files.length || 0,
                totalLines: files.reduce((sum, file) => sum + (Number(file.lines) || 0), 0),
                totalCodeLines: files.reduce((sum, file) => sum + (Number(file.codeLines) || 0), 0),
                totalCommentLines: files.reduce((sum, file) => sum + (Number(file.commentLines) || 0), 0),
                totalBlankLines: files.reduce((sum, file) => sum + (Number(file.blankLines) || 0), 0),
                languageCount: 0
            };
            
            // Calculate language statistics
            const languageMap = new Map();
            files.forEach(file => {
                const lang = file.language || 'Unknown';
                if (!languageMap.has(lang)) {
                    languageMap.set(lang, { name: lang, files: 0, lines: 0 });
                }
                const langStat = languageMap.get(lang);
                langStat.files++;
                langStat.lines += Number(file.lines) || 0;
            });
            
            const languages = Array.from(languageMap.values()).sort((a, b) => b.lines - a.lines);
            summary.languageCount = languages.length;
            
            const reportData = { summary, languages, files };
            debug.info('✅ Report data prepared:', { 
                files: files.length, 
                languages: languages.length,
                totalLines: summary.totalLines 
            });
            
            return reportData;
        } catch (error) {
            debug.error('❌ Failed to parse embedded data:', error);
            return null;
        }
    }
    
    return null;
}

// ========== End of Additional Functions ==========
`;
        
        return combinedJs;
    }

    private generateFileDataFromResult(result: any): string {
        try {
            if (!result || !result.files || !Array.isArray(result.files)) {
                console.log('No files found in result');
                return '';
            }
            
            // Convert files to the format expected by template
            const files = result.files.map((fileInfo: any) => {
                // Extract directory and filename from path
                const normalizedPath = (fileInfo.relativePath || fileInfo.path || '').replace(/\\/g, '/');
                const pathParts = normalizedPath.split('/');
                const fileName = pathParts.pop() || '';
                const directory = pathParts.join('/') || '';
                
                return {
                    path: fileInfo.path || '',
                    relativePath: normalizedPath,
                    directory: directory,
                    fileName: fileName,
                    language: fileInfo.language || 'Unknown',
                    lines: fileInfo.lines || 0,
                    codeLines: fileInfo.codeLines || 0,
                    commentLines: fileInfo.commentLines || 0,
                    blankLines: fileInfo.blankLines || 0,
                    size: fileInfo.size || 0
                };
            });
            
            // Return JSON array content without outer brackets (like webview service does)
            const filesJson = JSON.stringify(files).slice(1, -1);
            console.log('Generated JSON for', files.length, 'files');
            return filesJson;
            
        } catch (error) {
            console.error('Error generating file data from result:', error);
            return '';
        }
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