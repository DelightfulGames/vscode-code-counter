import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { HtmlGeneratorService } from '../../services/htmlGenerator';

suite('HtmlGeneratorService Tests', () => {
    let htmlGenerator: HtmlGeneratorService;
    let tempDir: string;
    
    suiteSetup(async () => {
        htmlGenerator = new HtmlGeneratorService();
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'html-generator-test-'));
    });
    
    suiteTeardown(async () => {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    test('should generate HTML report files from XML data', async () => {
        const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<report generatedAt="2024-01-01T12:00:00.000Z" workspacePath="${tempDir}">
    <summary totalFiles="2" totalLines="200" totalSize="10000"/>
    <languages>
        <language name="JavaScript" files="1" lines="100"/>
        <language name="TypeScript" files="1" lines="100"/>
    </languages>
    <files>
        <file path="${tempDir}/test.js" language="JavaScript" lines="100"/>
        <file path="${tempDir}/test.ts" language="TypeScript" lines="100"/>
    </files>
</report>`;
        
        const outputDir = 'output';
        
        await htmlGenerator.generateHtmlReport(xmlData, tempDir, outputDir);
        
        // Check if HTML file was created
        const htmlFilePath = path.join(tempDir, outputDir, 'code-counter-report.html');
        const htmlExists = await fs.promises.access(htmlFilePath).then(() => true).catch(() => false);
        expect(htmlExists).to.be.true;
        
        // Check if XML file was also created
        const xmlFilePath = path.join(tempDir, outputDir, 'code-counter-data.xml');
        const xmlExists = await fs.promises.access(xmlFilePath).then(() => true).catch(() => false);
        expect(xmlExists).to.be.true;
        
        // Verify XML file content
        const writtenXml = await fs.promises.readFile(xmlFilePath, 'utf8');
        expect(writtenXml).to.include('JavaScript');
        expect(writtenXml).to.include('TypeScript');
    });

    test('should handle template placeholders correctly', async () => {
        const xmlData = '<?xml version="1.0"?><report><summary totalFiles="1"/></report>';
        const outputDir = 'output';
        
        // Use the temp directory as workspace (avoids permission issues)
        await htmlGenerator.generateHtmlReport(xmlData, tempDir, outputDir);
        
        const htmlFilePath = path.join(tempDir, outputDir, 'code-counter-report.html');
        const htmlContent = await fs.promises.readFile(htmlFilePath, 'utf8');
        
        // Check if the HTML file was created and contains expected content
        expect(htmlContent).to.be.a('string');
        expect(htmlContent).to.include('html');
        expect(htmlContent).to.include(tempDir); // Workspace path should be in the content
        
        // Check that basic HTML structure exists
        expect(htmlContent).to.include('<!DOCTYPE html>');
    });

    test('should create output directory if it does not exist', async () => {
        const xmlData = '<?xml version="1.0"?><report><summary/></report>';
        const nonExistentDir = path.join(tempDir, 'new-output-dir');
        
        // Ensure directory doesn't exist initially
        const existsBefore = await fs.promises.access(nonExistentDir).then(() => true).catch(() => false);
        expect(existsBefore).to.be.false;
        
        await htmlGenerator.generateHtmlReport(xmlData, tempDir, 'new-output-dir');
        
        // Directory should now exist
        const existsAfter = await fs.promises.access(nonExistentDir).then(() => true).catch(() => false);
        expect(existsAfter).to.be.true;
    });

    test('should handle XML data with special characters', async () => {
        const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<report>
    <file path="/test/file with spaces &amp; symbols.js" language="JavaScript"/>
    <file path="/test/файл.js" language="JavaScript"/>
</report>`;
        
        const outputDir = 'output';
        
        await htmlGenerator.generateHtmlReport(xmlData, tempDir, outputDir);
        
        const xmlFilePath = path.join(tempDir, outputDir, 'code-counter-data.xml');
        const writtenXml = await fs.promises.readFile(xmlFilePath, 'utf8');
        
        expect(writtenXml).to.include('file with spaces');
        expect(writtenXml).to.include('&amp;');
        expect(writtenXml).to.include('файл.js'); // Unicode filename
    });

    test('should properly escape XML data for JavaScript string literals', async () => {
        // XML data with various problematic characters for JavaScript strings
        const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<report>
    <file path="C:\\Users\\test\\file's name.js" language="JavaScript"/>
    <file path="/test/file with "quotes" and 'apostrophes'.js" language="JavaScript"/>
    <file path="/test/file
with newlines.js" language="JavaScript"/>
</report>`;
        
        const outputDir = 'output';
        
        await htmlGenerator.generateHtmlReport(xmlData, tempDir, outputDir);
        
        // Read the HTML file and check that the XML data was properly escaped
        const htmlFilePath = path.join(tempDir, outputDir, 'code-counter-report.html');
        const htmlContent = await fs.promises.readFile(htmlFilePath, 'utf8');
        
        // Verify that the escaped XML data is present and doesn't break JavaScript
        expect(htmlContent).to.include("C:\\\\Users\\\\test\\\\file\\'s name.js");
        expect(htmlContent).to.include('file with \\"quotes\\" and \\\'apostrophes\\\'');
        expect(htmlContent).to.include('file\\nwith newlines.js');
        
        // Ensure no unescaped problematic characters remain in the embedded data
        const xmlDataStart = htmlContent.indexOf("const embeddedXmlData = '") + "const embeddedXmlData = '".length;
        const xmlDataEnd = htmlContent.indexOf("';", xmlDataStart);
        const embeddedXmlData = htmlContent.substring(xmlDataStart, xmlDataEnd);
        
        // Should not contain unescaped quotes or newlines that would break JavaScript
        expect(embeddedXmlData).to.not.match(/(^|[^\\])'/); // No unescaped single quotes
        expect(embeddedXmlData).to.not.match(/(^|[^\\])"/); // No unescaped double quotes  
        expect(embeddedXmlData).to.not.match(/(^|[^\\])\n/); // No unescaped newlines
    });
});