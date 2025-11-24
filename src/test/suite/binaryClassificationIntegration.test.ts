/**
 * Integration tests for centralized binary classification service
 * Verifies PNG files are correctly excluded from line counts
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BinaryDetectionService } from '../../services/binaryDetectionService';
import { BinaryClassificationService } from '../../services/binaryClassificationService';
import { LineCounterService } from '../../services/lineCounter';

suite('Binary Classification Integration Tests', () => {
    let tempDir: string;
    let binaryDetectionService: BinaryDetectionService;
    let binaryClassificationService: BinaryClassificationService;
    let lineCounterService: LineCounterService;

    setup(() => {
        // Create temp directory for test files
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'binary-classification-test-'));
        
        // Initialize services
        binaryDetectionService = new BinaryDetectionService(tempDir);
        binaryClassificationService = new BinaryClassificationService(binaryDetectionService);
        lineCounterService = new LineCounterService();
    });

    teardown(() => {
        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('should correctly classify PNG files as binary and exclude them', async () => {
        // Create a mock PNG file (minimal PNG header)
        const pngFile = path.join(tempDir, 'test.png');
        const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG magic number
        fs.writeFileSync(pngFile, pngHeader);

        const result = await binaryClassificationService.classifyFile(pngFile);

        assert.strictEqual(result.shouldInclude, false, 'PNG file should be excluded');
        assert.strictEqual(result.isBinary, true, 'PNG file should be classified as binary');
        assert.strictEqual(result.reason, 'binary_extension', 'PNG should be excluded by extension');
        assert.strictEqual(result.extension, '.png', 'Extension should be correctly identified');
    });

    test('should correctly classify JPG files as binary and exclude them', async () => {
        // Create a mock JPG file (minimal JPEG header)
        const jpgFile = path.join(tempDir, 'test.jpg');
        const jpgHeader = Buffer.from([0xFF, 0xD8, 0xFF]); // JPEG magic number
        fs.writeFileSync(jpgFile, jpgHeader);

        const result = await binaryClassificationService.classifyFile(jpgFile);

        assert.strictEqual(result.shouldInclude, false, 'JPG file should be excluded');
        assert.strictEqual(result.isBinary, true, 'JPG file should be classified as binary');
        assert.strictEqual(result.reason, 'binary_extension', 'JPG should be excluded by extension');
        assert.strictEqual(result.extension, '.jpg', 'Extension should be correctly identified');
    });

    test('should correctly classify JavaScript files as text and include them', async () => {
        // Create a JavaScript file
        const jsFile = path.join(tempDir, 'test.js');
        fs.writeFileSync(jsFile, 'console.log("Hello, world!");');

        const result = await binaryClassificationService.classifyFile(jsFile);

        assert.strictEqual(result.shouldInclude, true, 'JS file should be included');
        assert.strictEqual(result.isBinary, false, 'JS file should be classified as text');
        assert.strictEqual(result.reason, 'text_extension_clean', 'JS should be included as clean text');
        assert.strictEqual(result.extension, '.js', 'Extension should be correctly identified');
    });

    test('should handle JavaScript file with binary content correctly', async () => {
        // Create a JS file with binary content (null bytes)
        const jsFile = path.join(tempDir, 'binary.js');
        const binaryContent = Buffer.concat([
            Buffer.from('console.log("test");\x00'),
            Buffer.from([0x00, 0x01, 0x02, 0x03])
        ]);
        fs.writeFileSync(jsFile, binaryContent);

        const result = await binaryClassificationService.classifyFile(jsFile);

        assert.strictEqual(result.shouldInclude, false, 'JS file with binary content should be excluded');
        assert.strictEqual(result.isBinary, true, 'JS file with binary content should be classified as binary');
        assert.strictEqual(result.reason, 'text_extension_binary_content', 'JS with binary content should be excluded');
        assert.strictEqual(result.extension, '.js', 'Extension should be correctly identified');
    });

    test('should exclude unknown file extensions by default', async () => {
        // Create a file with unknown extension
        const unknownFile = path.join(tempDir, 'test.xyz123');
        fs.writeFileSync(unknownFile, 'some content');

        const result = await binaryClassificationService.classifyFile(unknownFile);

        assert.strictEqual(result.shouldInclude, false, 'Unknown extension should be excluded');
        assert.strictEqual(result.isBinary, false, 'Unknown extension is not confirmed binary');
        assert.strictEqual(result.reason, 'unknown_extension', 'Should be excluded as unknown extension');
        assert.strictEqual(result.extension, '.xyz123', 'Extension should be correctly identified');
    });

    test('LineCounterService should use binary classification to exclude PNG files', async () => {
        // Create test files
        const pngFile = path.join(tempDir, 'image.png');
        const jsFile = path.join(tempDir, 'script.js');
        const txtFile = path.join(tempDir, 'readme.txt');

        // Create PNG with magic number
        const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        fs.writeFileSync(pngFile, pngHeader);

        // Create text files
        fs.writeFileSync(jsFile, 'console.log("test");\nconst x = 42;');
        fs.writeFileSync(txtFile, 'Line 1\nLine 2\nLine 3');

        // Count lines using LineCounterService
        const result = await lineCounterService.countLinesWithPathBasedSettings(
            tempDir, 
            () => {} // progress callback
        );

        // Find our files in the results
        const pngResult = result.files.find(r => r.relativePath === 'image.png');
        const jsResult = result.files.find(r => r.relativePath === 'script.js');
        const txtResult = result.files.find(r => r.relativePath === 'readme.txt');

        // PNG should be excluded (not present in results)
        assert.strictEqual(pngResult, undefined, 'PNG file should not appear in line count results');

        // Text files should be included
        assert.notStrictEqual(jsResult, undefined, 'JS file should appear in results');
        assert.notStrictEqual(txtResult, undefined, 'TXT file should appear in results');

        if (jsResult) {
            assert.strictEqual(jsResult.lines, 2, 'JS file should have 2 lines counted');
        }
        if (txtResult) {
            assert.strictEqual(txtResult.lines, 3, 'TXT file should have 3 lines counted');
        }
    });

    test('should use identical binary extension lists across components', async () => {
        // Get extension lists from classification service
        const textExtensions = binaryClassificationService.getKnownTextExtensions();
        const binaryExtensions = binaryClassificationService.getKnownBinaryExtensions();

        // Verify PNG and common image formats are in binary list
        assert.strictEqual(binaryExtensions.has('.png'), true, 'PNG should be in binary extensions');
        assert.strictEqual(binaryExtensions.has('.jpg'), true, 'JPG should be in binary extensions');
        assert.strictEqual(binaryExtensions.has('.jpeg'), true, 'JPEG should be in binary extensions');
        assert.strictEqual(binaryExtensions.has('.gif'), true, 'GIF should be in binary extensions');

        // Verify common text formats are in text list
        assert.strictEqual(textExtensions.has('.js'), true, 'JS should be in text extensions');
        assert.strictEqual(textExtensions.has('.ts'), true, 'TS should be in text extensions');
        assert.strictEqual(textExtensions.has('.txt'), true, 'TXT should be in text extensions');
        assert.strictEqual(textExtensions.has('.md'), true, 'MD should be in text extensions');

        // Verify no overlap between lists
        const overlap = [...textExtensions].some(ext => binaryExtensions.has(ext));
        assert.strictEqual(overlap, false, 'Text and binary extension lists should not overlap');
    });

    test('priority order should be: binary extension > text extension + content > unknown', async () => {
        // Test 1: Binary extension takes highest priority (even if content might be text)
        const pngFile = path.join(tempDir, 'fake.png');
        fs.writeFileSync(pngFile, 'console.log("I look like JS but I am PNG")');
        
        const pngResult = await binaryClassificationService.classifyFile(pngFile);
        assert.strictEqual(pngResult.reason, 'binary_extension', 'Binary extension should take priority over content');

        // Test 2: Text extension with clean content
        const jsFile = path.join(tempDir, 'clean.js');
        fs.writeFileSync(jsFile, 'console.log("clean text");');
        
        const jsResult = await binaryClassificationService.classifyFile(jsFile);
        assert.strictEqual(jsResult.reason, 'text_extension_clean', 'Clean text file should be included');

        // Test 3: Text extension with binary content should be detected
        const dirtyJsFile = path.join(tempDir, 'dirty.js');
        fs.writeFileSync(dirtyJsFile, Buffer.concat([
            Buffer.from('console.log("test");'),
            Buffer.from([0x00, 0x01, 0x02])
        ]));
        
        const dirtyJsResult = await binaryClassificationService.classifyFile(dirtyJsFile);
        assert.strictEqual(dirtyJsResult.reason, 'text_extension_binary_content', 'Text extension with binary content should be excluded');

        // Test 4: Unknown extension should default to exclusion
        const unknownFile = path.join(tempDir, 'mystery.unknown');
        fs.writeFileSync(unknownFile, 'some content');
        
        const unknownResult = await binaryClassificationService.classifyFile(unknownFile);
        assert.strictEqual(unknownResult.reason, 'unknown_extension', 'Unknown extension should be excluded');
    });
});