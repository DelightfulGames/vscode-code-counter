import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { LineCountCacheService } from '../../services/lineCountCache';

suite('LineCountCacheService Tests', () => {
    let cacheService: LineCountCacheService;
    let tempDir: string;
    
    suiteSetup(async () => {
        cacheService = new LineCountCacheService();
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cache-test-'));
    });
    
    suiteTeardown(async () => {
        cacheService.dispose();
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });
    
    test('should cache line counts correctly', async () => {
        const testContent = `// Test file
function hello() {
    console.log('Hello World');
    
    return 'done';
}`;
        
        const testFilePath = path.join(tempDir, 'test.js');
        await fs.promises.writeFile(testFilePath, testContent);
        
        // First call should calculate and cache
        const result1 = await cacheService.getLineCount(testFilePath);
        expect(result1).to.not.be.null;
        expect(result1!.lines).to.equal(6);
        expect(result1!.codeLines).to.equal(4);
        expect(result1!.blankLines).to.equal(1);
        
        // Second call should return cached result
        const result2 = await cacheService.getLineCount(testFilePath);
        expect(result2).to.deep.equal(result1);
    });
    
    test('should invalidate cache when file changes', async () => {
        const initialContent = 'console.log("initial");';
        const updatedContent = `console.log("initial");
console.log("updated");`;
        
        const testFilePath = path.join(tempDir, 'changing.js');
        await fs.promises.writeFile(testFilePath, initialContent);
        
        // Get initial count
        const initialResult = await cacheService.getLineCount(testFilePath);
        expect(initialResult!.lines).to.equal(1);
        
        // Wait a bit to ensure different timestamp
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Update file
        await fs.promises.writeFile(testFilePath, updatedContent);
        
        // Should get updated count
        const updatedResult = await cacheService.getLineCount(testFilePath);
        expect(updatedResult!.lines).to.equal(2);
    });
    
    test('should handle non-existent files gracefully', async () => {
        const result = await cacheService.getLineCount('/non/existent/file.js');
        expect(result).to.be.null;
    });
});