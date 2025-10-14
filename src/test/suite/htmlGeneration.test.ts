import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { LineCounterService } from '../../services/lineCounter';
import { XmlGeneratorService } from '../../services/xmlGenerator';
import { HtmlGeneratorService } from '../../services/htmlGenerator';

suite('HTML Report Generation Tests', () => {
    let lineCounter: LineCounterService;
    let xmlGenerator: XmlGeneratorService;
    let htmlGenerator: HtmlGeneratorService;
    let tempDir: string;
    
    suiteSetup(async () => {
        lineCounter = new LineCounterService();
        xmlGenerator = new XmlGeneratorService();
        htmlGenerator = new HtmlGeneratorService();
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'code-counter-html-test-'));
    });
    
    suiteTeardown(async () => {
        // Clean up temp directory
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });
    
    test('should generate HTML report with enhanced path display', async () => {
        // Create nested structure
        const srcDir = path.join(tempDir, 'src', 'components');
        await fs.promises.mkdir(srcDir, { recursive: true });
        
        // Create test files
        const files = [
            { path: path.join(tempDir, 'package.json'), content: '{"name": "test"}' },
            { path: path.join(srcDir, 'Button.tsx'), content: 'export const Button = () => {};' },
            { path: path.join(srcDir, 'Form.tsx'), content: 'export const Form = () => {};' }
        ];
        
        for (const file of files) {
            await fs.promises.writeFile(file.path, file.content);
        }
        
        // Count lines
        const result = await lineCounter.countLines(tempDir, []);
        
        // Generate XML
        const xmlContent = xmlGenerator.generateXml(result);
        
        // Generate HTML report
        const outputDir = path.join(tempDir, 'reports');
        await htmlGenerator.generateHtmlReport(xmlContent, tempDir, 'reports');
        
        // Verify HTML file was created
        const htmlFilePath = path.join(outputDir, 'code-counter-report.html');
        expect(fs.existsSync(htmlFilePath)).to.be.true;
        
        // Read and verify HTML content
        const htmlContent = await fs.promises.readFile(htmlFilePath, 'utf8');
        
        // Verify the HTML contains expected structure
        expect(htmlContent).to.include('file-name-cell');
        expect(htmlContent).to.include('file-name-display');
        expect(htmlContent).to.include('file-path-toggle');
        expect(htmlContent).to.include('Toggle Paths');
        
        // Verify XML data is embedded
        expect(htmlContent).to.include('package.json');
        expect(htmlContent).to.include('Button.tsx');
        expect(htmlContent).to.include('Form.tsx');
    });
    
    test('should handle workspace paths correctly in HTML', async () => {
        // Create a simple file
        const testFile = path.join(tempDir, 'README.md');
        await fs.promises.writeFile(testFile, '# Test Project');
        
        // Count lines
        const result = await lineCounter.countLines(tempDir, []);
        
        // Generate XML and HTML
        const xmlContent = xmlGenerator.generateXml(result);
        const outputDir = path.join(tempDir, 'output');
        await htmlGenerator.generateHtmlReport(xmlContent, tempDir, 'output');
        
        // Verify files exist
        const htmlFilePath = path.join(outputDir, 'code-counter-report.html');
        const xmlFilePath = path.join(outputDir, 'code-counter-data.xml');
        
        expect(fs.existsSync(htmlFilePath)).to.be.true;
        expect(fs.existsSync(xmlFilePath)).to.be.true;
        
        // Verify content
        const htmlContent = await fs.promises.readFile(htmlFilePath, 'utf8');
        expect(htmlContent).to.include(tempDir.replace(/\\/g, '/'));
    });
    
    test('should properly format directory paths with trailing slashes', async () => {
        // Create nested file structure 
        const deepDir = path.join(tempDir, 'src', 'components', 'ui');
        await fs.promises.mkdir(deepDir, { recursive: true });
        
        const testFile = path.join(deepDir, 'Button.tsx');
        await fs.promises.writeFile(testFile, 'export const Button = () => {};');
        
        // Generate report
        const result = await lineCounter.countLines(tempDir, []);
        const xmlContent = xmlGenerator.generateXml(result);
        const outputDir = path.join(tempDir, 'output');
        await htmlGenerator.generateHtmlReport(xmlContent, tempDir, 'output');
        
        // Read generated HTML
        const htmlFilePath = path.join(outputDir, 'code-counter-report.html');
        const htmlContent = await fs.promises.readFile(htmlFilePath, 'utf8');
        
        // Verify the HTML contains the proper directory logic
        expect(htmlContent).to.include('pathParts.join(\'/\') + \'/\'');
        expect(htmlContent).to.include('src/components/ui/Button.tsx');
    });
});