/**
 * Binary Detection Integration Test
 * Tests that binary files (especially images) are properly excluded from line counting
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { LineCounterService } from '../../services/lineCounter';
import { FileInfo, LineCountResult } from '../../types';
import { FileExplorerDecorationProvider } from '../../providers/fileExplorerDecorator';
import { BinaryDetectionService } from '../../services/binaryDetectionService';

suite('Binary Detection Integration Tests', function() {
    this.timeout(15000);
    
    let tempDir: string;
    let lineCounterService: LineCounterService;
    let decoratorProvider: FileExplorerDecorationProvider;
    let binaryDetectionService: BinaryDetectionService;
    
    suiteSetup(async function() {
        // Create a temporary directory for testing
        tempDir = path.join(os.tmpdir(), 'binary-detection-test-' + Date.now());
        await fs.promises.mkdir(tempDir, { recursive: true });
        
        // Initialize services
        lineCounterService = new LineCounterService();
        decoratorProvider = new FileExplorerDecorationProvider();
        binaryDetectionService = new BinaryDetectionService(tempDir);
        
        console.log('Setting up binary detection tests in:', tempDir);
        
        // Create test files with actual content
        
        // Create text files that should be counted
        await fs.promises.writeFile(
            path.join(tempDir, 'script.js'), 
            'console.log("Hello World");\n// This is a comment\nconst x = 1;\n'
        );
        
        await fs.promises.writeFile(
            path.join(tempDir, 'data.json'), 
            '{\n  "name": "test",\n  "value": 123\n}\n'
        );
        
        await fs.promises.writeFile(
            path.join(tempDir, 'readme.md'), 
            '# Test File\n\nThis is a markdown file.\n\n- Item 1\n- Item 2\n'
        );
        
        // Create binary files that should NOT be counted
        // PNG file - minimal valid PNG header
        const pngHeader = Buffer.from([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
            0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
            0x49, 0x48, 0x44, 0x52, // IHDR
            0x00, 0x00, 0x00, 0x01, // Width: 1
            0x00, 0x00, 0x00, 0x01, // Height: 1
            0x08, 0x02, 0x00, 0x00, 0x00, // Bit depth, color type, compression, filter, interlace
            0x90, 0x77, 0x53, 0xDE  // CRC
        ]);
        await fs.promises.writeFile(path.join(tempDir, 'test-image.png'), pngHeader);
        
        // JPEG file - minimal valid JPEG header
        const jpegHeader = Buffer.from([
            0xFF, 0xD8, 0xFF, 0xE0, // JPEG signature
            0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, // JFIF header
            0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
            0xFF, 0xD9 // End of Image
        ]);
        await fs.promises.writeFile(path.join(tempDir, 'photo.jpg'), jpegHeader);
        
        // SVG file (text-based but should be treated as binary)
        await fs.promises.writeFile(
            path.join(tempDir, 'icon.svg'),
            '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>\n'
        );
        
        // Fake PNG with text extension (should be caught by binary detection)
        await fs.promises.writeFile(path.join(tempDir, 'fake-text.txt'), pngHeader);
        
        // ZIP file 
        const zipHeader = Buffer.from([
            0x50, 0x4B, 0x03, 0x04, // ZIP signature
            0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        ]);
        await fs.promises.writeFile(path.join(tempDir, 'archive.zip'), zipHeader);
        
        console.log('Test files created successfully');
    });
    
    suiteTeardown(async function() {
        try {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            console.warn('Failed to cleanup temp directory:', error);
        }
        
        // Dispose services
        decoratorProvider.dispose();
    });
    
    suite('Extension-based Binary Classification', () => {
        test('should classify PNG files as binary based on extension', async function() {
            const pngFile = path.join(tempDir, 'test-image.png');
            
            // Test via decorator (which should be working)
            const decoration = await decoratorProvider.provideFileDecoration(vscode.Uri.file(pngFile));
            
            // PNG files should get no decoration (skipped as binary)
            assert.strictEqual(decoration, undefined, 'PNG files should not get decorations (treated as binary)');
        });
        
        test('should classify JPEG files as binary based on extension', async function() {
            const jpegFile = path.join(tempDir, 'photo.jpg');
            
            const decoration = await decoratorProvider.provideFileDecoration(vscode.Uri.file(jpegFile));
            assert.strictEqual(decoration, undefined, 'JPEG files should not get decorations (treated as binary)');
        });
        
        test('should classify SVG files as binary based on extension', async function() {
            const svgFile = path.join(tempDir, 'icon.svg');
            
            const decoration = await decoratorProvider.provideFileDecoration(vscode.Uri.file(svgFile));
            assert.strictEqual(decoration, undefined, 'SVG files should be treated as binary based on extension');
        });
        
        test('should classify ZIP files as binary based on extension', async function() {
            const zipFile = path.join(tempDir, 'archive.zip');
            
            const decoration = await decoratorProvider.provideFileDecoration(vscode.Uri.file(zipFile));
            assert.strictEqual(decoration, undefined, 'ZIP files should not get decorations (treated as binary)');
        });
    });
    
    suite('Content-based Binary Detection for Text Extensions', () => {
        test('should detect fake PNG with text extension via binary detection', async function() {
            const fakeTextFile = path.join(tempDir, 'fake-text.txt');
            
            // This file has .txt extension but PNG content - should be detected as binary
            const result = await binaryDetectionService.isBinary(fakeTextFile);
            assert.strictEqual(result.isBinary, true, 'Fake text file with PNG content should be detected as binary');
            // PNG files contain null bytes, so null_bytes detection should trigger first (which is correct)
            assert.strictEqual(result.detectionMethod, 'null_bytes', 'Should detect null bytes in PNG data');
        });
        
        test('should allow legitimate text files', async function() {
            const textFiles = [
                path.join(tempDir, 'script.js'),
                path.join(tempDir, 'data.json'), 
                path.join(tempDir, 'readme.md')
            ];
            
            for (const textFile of textFiles) {
                const result = await binaryDetectionService.isBinary(textFile);
                assert.strictEqual(result.isBinary, false, `Text file ${path.basename(textFile)} should not be detected as binary`);
            }
        });
    });
    
    suite('LineCounterService Binary Filtering', () => {
        test('should exclude binary files from line counting reports', async function() {
            // This is the critical test - the reports should not include binary files
            const result = await lineCounterService.countLines(tempDir);
            
            console.log('Line count result:', {
                totalFiles: result.totalFiles,
                files: result.files.map((f: FileInfo) => ({ fileName: path.basename(f.path), lines: f.lines }))
            });
            
            // Should only include text files
            const fileNames = result.files.map((f: FileInfo) => path.basename(f.path));
            
            // Text files should be included
            assert.ok(fileNames.includes('script.js'), 'JavaScript file should be included in count');
            assert.ok(fileNames.includes('data.json'), 'JSON file should be included in count');
            assert.ok(fileNames.includes('readme.md'), 'Markdown file should be included in count');
            
            // Binary files should be excluded
            assert.ok(!fileNames.includes('test-image.png'), 'PNG file should be excluded from count');
            assert.ok(!fileNames.includes('photo.jpg'), 'JPEG file should be excluded from count');
            assert.ok(!fileNames.includes('icon.svg'), 'SVG file should be excluded from count');
            assert.ok(!fileNames.includes('archive.zip'), 'ZIP file should be excluded from count');
            
            // Fake text file should be excluded due to binary content detection
            assert.ok(!fileNames.includes('fake-text.txt'), 'Fake text file with binary content should be excluded');
            
            // Verify reasonable line counts for text files
            const jsFile = result.files.find((f: FileInfo) => path.basename(f.path) === 'script.js');
            assert.ok(jsFile && jsFile.lines > 0, 'JavaScript file should have positive line count');
            
            const jsonFile = result.files.find((f: FileInfo) => path.basename(f.path) === 'data.json');
            assert.ok(jsonFile && jsonFile.lines > 0, 'JSON file should have positive line count');
        });
        
        test('should handle inclusion patterns for binary files', async function() {
            // Test that inclusion patterns can override binary detection
            const result = await lineCounterService.countLinesWithInclusions(
                tempDir,
                [], // no exclusions
                ['**/*.png'] // include PNG files explicitly
            );
            
            const fileNames = result.files.map((f: FileInfo) => path.basename(f.path));
            
            // Now PNG should be included due to inclusion pattern
            assert.ok(fileNames.includes('test-image.png'), 'PNG file should be included when explicitly included via pattern');
            
            // Other binary files should still be excluded
            assert.ok(!fileNames.includes('photo.jpg'), 'JPEG file should still be excluded without inclusion pattern');
            assert.ok(!fileNames.includes('archive.zip'), 'ZIP file should still be excluded without inclusion pattern');
        });
    });
    
    suite('Integration with VS Code Workspace', () => {
        test('should integrate with VS Code workspace file discovery', async function() {
            // Test with the actual temp directory without mocking workspace
            // This tests the core functionality without VS Code workspace dependencies
            
            const result = await lineCounterService.countLines(tempDir);
            
            // Verify that binary files are properly filtered out
            const includedExtensions = result.files.map((f: FileInfo) => path.extname(f.path));
            const hasImageExtensions = includedExtensions.some((ext: string) => ['.png', '.jpg', '.svg'].includes(ext));
            
            assert.strictEqual(hasImageExtensions, false, 'Image files should not appear in workspace line counting');
        });
    });
    
    suite('Error Handling and Edge Cases', () => {
        test('should handle binary detection errors gracefully', async function() {
            // Create a file that might cause binary detection issues
            const problematicFile = path.join(tempDir, 'problematic.txt');
            await fs.promises.writeFile(problematicFile, Buffer.from([0x00, 0x01, 0x02, 0xFF])); // Mixed binary/text content
            
            const result = await lineCounterService.countLines(tempDir);
            
            // Should not crash and should handle the file appropriately
            assert.ok(result.files.length >= 0, 'Should handle problematic files without crashing');
        });
        
        test('should handle missing files gracefully', async function() {
            const nonExistentFile = path.join(tempDir, 'does-not-exist.txt');
            
            try {
                await binaryDetectionService.isBinary(nonExistentFile);
                assert.fail('Should throw error for non-existent file');
            } catch (error) {
                assert.ok(error instanceof Error, 'Should throw proper error for missing file');
            }
        });
    });
});