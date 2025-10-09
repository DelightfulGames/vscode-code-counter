import * as vscode from 'vscode';
import { LineCounterService } from '../services/lineCounter';
import { XmlGeneratorService } from '../services/xmlGenerator';
import { HtmlGeneratorService } from '../services/htmlGenerator';

export class CountLinesCommand {
    private lineCounter: LineCounterService;
    private xmlGenerator: XmlGeneratorService;
    private htmlGenerator: HtmlGeneratorService;

    constructor() {
        this.lineCounter = new LineCounterService();
        this.xmlGenerator = new XmlGeneratorService();
        this.htmlGenerator = new HtmlGeneratorService();
    }

    async execute(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder is open');
            return;
        }

        try {
            vscode.window.showInformationMessage('Counting lines of code...');
            
            // Get configuration
            const config = vscode.workspace.getConfiguration('codeCounter');
            const excludePatterns = config.get<string[]>('excludePatterns', []);
            const outputDirectory = config.get<string>('outputDirectory', './reports');

            // Count lines for each workspace folder
            for (const folder of workspaceFolders) {
                const results = await this.lineCounter.countLines(folder.uri.fsPath, excludePatterns);
                
                // Generate XML data source
                const xmlData = this.xmlGenerator.generateXml(results);
                
                // Generate HTML report
                await this.htmlGenerator.generateHtmlReport(xmlData, folder.uri.fsPath, outputDirectory);
            }

            vscode.window.showInformationMessage('Line counting completed! Reports generated.');
            
        } catch (error) {
            vscode.window.showErrorMessage(`Error counting lines: ${error}`);
        }
    }
}