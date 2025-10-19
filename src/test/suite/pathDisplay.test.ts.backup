import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { LineCounterService } from '../../services/lineCounter';
import { XmlGeneratorService } from '../../services/xmlGenerator';

suite('Enhanced Path Display Tests', () => {
    let lineCounter: LineCounterService;
    let xmlGenerator: XmlGeneratorService;
    let tempDir: string;
    
    suiteSetup(async () => {
        lineCounter = new LineCounterService();
        xmlGenerator = new XmlGeneratorService();
    });
    
    setup(async () => {
        // Create a fresh temp directory for each test
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'code-counter-path-test-'));
    });
    
    teardown(async () => {
        // Clean up temp directory after each test
        if (tempDir) {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
        }
    });
    
    test('should include fullPath property in FileInfo objects', async () => {
        // Create nested directory structure
        const nestedDir = path.join(tempDir, 'src', 'components');
        await fs.promises.mkdir(nestedDir, { recursive: true });
        
        // Create test files
        const jsFilePath = path.join(nestedDir, 'Button.tsx');
        await fs.promises.writeFile(jsFilePath, 'export const Button = () => {};');
        
        const result = await lineCounter.countLines(tempDir, []);
        
        expect(result.files).to.have.lengthOf(1);
        
        const file = result.files[0];
        expect(file.fullPath).to.exist;
        expect(file.fullPath).to.include('src/components/Button.tsx');
        expect(file.fullPath).to.exist;
        expect(file.fullPath).to.equal('src/components/Button.tsx');
    });
    
    test('should generate XML with enhanced path attributes', async () => {
        // Create test files
        const testFile = path.join(tempDir, 'test.js');
        await fs.promises.writeFile(testFile, 'console.log("test");');
        
        const result = await lineCounter.countLines(tempDir, []);
        const xmlContent = xmlGenerator.generateXml(result);
        
        expect(xmlContent).to.include('fullPath=');
        expect(xmlContent).to.include('fileName=');
        expect(xmlContent).to.include('directory=');
        expect(xmlContent).to.include('test.js');
    });
    
    test('should handle files at workspace root correctly', async () => {
        // Create file at root
        const rootFile = path.join(tempDir, 'package.json');
        await fs.promises.writeFile(rootFile, '{"name": "test"}');
        
        const result = await lineCounter.countLines(tempDir, []);
        
        expect(result.files).to.have.lengthOf(1);
        
        const file = result.files[0];
        expect(file.fullPath).to.equal('package.json');
        expect(file.relativePath).to.equal('package.json');
    });
    
    test('should handle deeply nested files correctly', async () => {
        // Create deeply nested structure
        const deepPath = path.join(tempDir, 'src', 'components', 'ui', 'forms');
        await fs.promises.mkdir(deepPath, { recursive: true });
        
        const deepFile = path.join(deepPath, 'LoginForm.tsx');
        await fs.promises.writeFile(deepFile, 'export const LoginForm = () => {};');
        
        const result = await lineCounter.countLines(tempDir, []);
        
        expect(result.files).to.have.lengthOf(1);
        
        const file = result.files[0];
        expect(file.fullPath).to.equal('src/components/ui/forms/LoginForm.tsx');
        expect(file.relativePath).to.equal(path.join('src', 'components', 'ui', 'forms', 'LoginForm.tsx'));
    });
});