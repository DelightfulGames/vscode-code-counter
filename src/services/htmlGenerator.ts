import * as fs from 'fs';
import * as path from 'path';

export class HtmlGeneratorService {
    
    async generateHtmlReport(xmlData: string, workspacePath: string, outputDirectory: string): Promise<void> {
        // Ensure output directory exists
        const fullOutputPath = path.resolve(workspacePath, outputDirectory);
        await this.ensureDirectoryExists(fullOutputPath);
        
        // Read the HTML template
        const templatePath = path.join(__dirname, '../../templates/report.html');
        let htmlTemplate = await fs.promises.readFile(templatePath, 'utf8');
        
        // Replace template placeholders
        htmlTemplate = htmlTemplate.replace('{{GENERATED_DATE}}', new Date().toLocaleString());
        htmlTemplate = htmlTemplate.replace('{{WORKSPACE_PATH}}', workspacePath);
        
        // Provide XML data as fallback for file:// protocol access
        const escapedXmlData = xmlData.replace(/'/g, "\\'").replace(/\r?\n/g, '\\n');
        htmlTemplate = htmlTemplate.replace('{{XML_DATA_FALLBACK}}', escapedXmlData);
        
        // Write the HTML file
        const htmlFilePath = path.join(fullOutputPath, 'code-counter-report.html');
        await fs.promises.writeFile(htmlFilePath, htmlTemplate);
        
        // Write the XML file as well
        const xmlFilePath = path.join(fullOutputPath, 'code-counter-data.xml');
        await fs.promises.writeFile(xmlFilePath, xmlData);
        
        console.log(`Reports generated: ${htmlFilePath} and ${xmlFilePath}`);
    }
    
    private async ensureDirectoryExists(dirPath: string): Promise<void> {
        try {
            await fs.promises.access(dirPath);
        } catch {
            await fs.promises.mkdir(dirPath, { recursive: true });
        }
    }
}