import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { LineCounterService } from '../../services/lineCounter';

suite('LineCounterService Tests', () => {
    let lineCounter: LineCounterService;
    let tempDir: string;
    
    suiteSetup(async () => {
        lineCounter = new LineCounterService();
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'code-counter-test-'));
    });
    
    suiteTeardown(async () => {
        // Clean up temp directory
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });
    
    test('should count lines in JavaScript file', async () => {
        const jsContent = `// This is a comment
function hello() {
    console.log('Hello World');
    
    return 'done';
}`;
        
        const jsFilePath = path.join(tempDir, 'test.js');
        await fs.promises.writeFile(jsFilePath, jsContent);
        
        const result = await lineCounter.countLines(tempDir, []);
        
        expect(result.totalFiles).to.equal(1);
        expect(result.files).to.have.lengthOf(1);
        
        const file = result.files[0];
        expect(file.language).to.equal('JavaScript');
        expect(file.lines).to.equal(6);
        expect(file.codeLines).to.equal(4);
        expect(file.commentLines).to.equal(1);
        expect(file.blankLines).to.equal(1);
    });
    
    test('should detect correct language by extension', async () => {
        const files = [
            { name: 'test.py', content: '# Python comment\nprint("hello")', expectedLang: 'Python' },
            { name: 'test.ts', content: '// TypeScript comment\nconsole.log("hello");', expectedLang: 'TypeScript' },
            { name: 'test.java', content: '// Java comment\nSystem.out.println("hello");', expectedLang: 'Java' }
        ];
        
        for (const file of files) {
            const filePath = path.join(tempDir, file.name);
            await fs.promises.writeFile(filePath, file.content);
        }
        
        const result = await lineCounter.countLines(tempDir, []);
        
        expect(result.totalFiles).to.equal(files.length + 1); // +1 from previous test
        expect(result.languageStats).to.include.keys('Python', 'TypeScript', 'Java');
    });
    
    test('should exclude files matching patterns', async () => {
        // Create files in node_modules (should be excluded)
        const nodeModulesDir = path.join(tempDir, 'node_modules');
        await fs.promises.mkdir(nodeModulesDir, { recursive: true });
        await fs.promises.writeFile(path.join(nodeModulesDir, 'excluded.js'), 'console.log("excluded");');
        
        // Create regular file (should be included)
        await fs.promises.writeFile(path.join(tempDir, 'included.js'), 'console.log("included");');
        
        const result = await lineCounter.countLines(tempDir, ['**/node_modules/**']);
        
        // Should not count the excluded file
        const excludedFile = result.files.find(f => f.path.includes('excluded.js'));
        expect(excludedFile).to.be.undefined;
        
        // Should count the included file
        const includedFile = result.files.find(f => f.path.includes('included.js'));
        expect(includedFile).to.not.be.undefined;
    });
    
    test('should calculate language statistics correctly', async () => {
        // Clear temp directory first
        const files = await fs.promises.readdir(tempDir);
        for (const file of files) {
            await fs.promises.rm(path.join(tempDir, file), { recursive: true, force: true });
        }
        
        // Create multiple files of same language
        await fs.promises.writeFile(path.join(tempDir, 'file1.js'), 'console.log("1");\nconsole.log("2");');
        await fs.promises.writeFile(path.join(tempDir, 'file2.js'), 'console.log("3");');
        
        const result = await lineCounter.countLines(tempDir, []);
        
        expect(result.languageStats.JavaScript.files).to.equal(2);
        expect(result.languageStats.JavaScript.lines).to.equal(3); // 2 + 1 lines
    });
});