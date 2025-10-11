import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { FileUtils } from '../../utils/fileUtils';

suite('FileUtils Tests', () => {
    let tempDir: string;
    
    suiteSetup(async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fileutils-test-'));
    });
    
    suiteTeardown(async () => {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    test('should check if file exists correctly', async () => {
        const existingFile = path.join(tempDir, 'existing.txt');
        const nonExistingFile = path.join(tempDir, 'non-existing.txt');
        
        // Create a file
        await fs.promises.writeFile(existingFile, 'test content');
        
        const existsResult = await FileUtils.fileExists(existingFile);
        const notExistsResult = await FileUtils.fileExists(nonExistingFile);
        
        expect(existsResult).to.be.true;
        expect(notExistsResult).to.be.false;
    });

    test('should create directory if it does not exist', async () => {
        const newDir = path.join(tempDir, 'new', 'nested', 'directory');
        
        // Ensure it doesn't exist initially
        const existsBefore = await FileUtils.fileExists(newDir);
        expect(existsBefore).to.be.false;
        
        await FileUtils.ensureDirectory(newDir);
        
        // Check it exists now
        const existsAfter = await FileUtils.fileExists(newDir);
        expect(existsAfter).to.be.true;
        
        // Verify it's actually a directory
        const stats = await fs.promises.stat(newDir);
        expect(stats.isDirectory()).to.be.true;
    });

    test('should not fail when ensuring existing directory', async () => {
        const existingDir = path.join(tempDir, 'existing-dir');
        
        // Create directory first
        await fs.promises.mkdir(existingDir);
        
        // This should not throw an error
        await FileUtils.ensureDirectory(existingDir);
        
        // Directory should still exist
        const exists = await FileUtils.fileExists(existingDir);
        expect(exists).to.be.true;
    });

    test('should read file content correctly', async () => {
        const testFile = path.join(tempDir, 'test-content.txt');
        const testContent = 'Hello World\nThis is a test file\nWith multiple lines';
        
        await fs.promises.writeFile(testFile, testContent);
        
        const readContent = await FileUtils.readFileContent(testFile);
        expect(readContent).to.equal(testContent);
    });

    test('should write file content and create directories', async () => {
        const nestedFile = path.join(tempDir, 'nested', 'folders', 'test-write.txt');
        const testContent = 'Content written by FileUtils';
        
        await FileUtils.writeFileContent(nestedFile, testContent);
        
        // Check file exists
        const exists = await FileUtils.fileExists(nestedFile);
        expect(exists).to.be.true;
        
        // Check content is correct
        const readContent = await fs.promises.readFile(nestedFile, 'utf8');
        expect(readContent).to.equal(testContent);
        
        // Check directories were created
        const dirExists = await FileUtils.fileExists(path.dirname(nestedFile));
        expect(dirExists).to.be.true;
    });

    test('should get file extension correctly', () => {
        expect(FileUtils.getFileExtension('test.js')).to.equal('.js');
        expect(FileUtils.getFileExtension('test.TS')).to.equal('.ts'); // Should be lowercase
        expect(FileUtils.getFileExtension('file.TEST.JS')).to.equal('.js');
        expect(FileUtils.getFileExtension('noextension')).to.equal('');
        expect(FileUtils.getFileExtension('.hidden')).to.equal(''); // Hidden files have no extension by path.extname logic
        expect(FileUtils.getFileExtension('.hidden.txt')).to.equal('.txt'); // This would have an extension
        expect(FileUtils.getFileExtension('/path/to/file.py')).to.equal('.py');
    });

    test('should calculate relative paths correctly', () => {
        const fromPath = '/home/user/project';
        const toPath = '/home/user/project/src/file.js';
        
        const relativePath = FileUtils.getRelativePath(fromPath, toPath);
        expect(relativePath).to.equal(path.join('src', 'file.js'));
        
        // Test with same path
        const samePath = FileUtils.getRelativePath(fromPath, fromPath);
        expect(samePath).to.equal('');
        
        // Test with parent directory
        const parentPath = FileUtils.getRelativePath(toPath, fromPath);
        expect(parentPath).to.equal(path.join('..', '..'));
    });

    test('should get file size correctly', async () => {
        const testFile = path.join(tempDir, 'size-test.txt');
        const testContent = 'This content is exactly 50 characters long!!';
        
        await fs.promises.writeFile(testFile, testContent);
        
        const size = await FileUtils.getFileSize(testFile);
        expect(size).to.equal(testContent.length);
    });

    test('should handle UTF-8 files correctly', async () => {
        const testFile = path.join(tempDir, 'utf8-test.txt');
        const testContent = 'Hello 世界 🌍 测试 файл';
        
        await FileUtils.writeFileContent(testFile, testContent);
        const readContent = await FileUtils.readFileContent(testFile);
        
        expect(readContent).to.equal(testContent);
        
        // File size should account for UTF-8 encoding
        const size = await FileUtils.getFileSize(testFile);
        expect(size).to.be.greaterThan(testContent.length); // UTF-8 chars take more bytes
    });

    test('should throw error when reading non-existent file', async () => {
        const nonExistentFile = path.join(tempDir, 'does-not-exist.txt');
        
        try {
            await FileUtils.readFileContent(nonExistentFile);
            expect.fail('Should have thrown an error');
        } catch (error) {
            expect(error).to.be.instanceOf(Error);
        }
    });

    test('should throw error when getting size of non-existent file', async () => {
        const nonExistentFile = path.join(tempDir, 'does-not-exist.txt');
        
        try {
            await FileUtils.getFileSize(nonExistentFile);
            expect.fail('Should have thrown an error');
        } catch (error) {
            expect(error).to.be.instanceOf(Error);
        }
    });
});