import * as assert from 'assert';
import { GlobUtils } from '../../utils/globUtils';

suite('GlobUtils Test', () => {
    test('** should match zero directories (root files)', () => {
        // Test case: **/*.test.js should match .test.js files in root directory
        assert.strictEqual(GlobUtils.matchesPattern('my.test.js', '**/*.test.js'), true, 
            '**/*.test.js should match my.test.js in root directory');
        
        assert.strictEqual(GlobUtils.matchesPattern('app.test.js', '**/*.test.js'), true, 
            '**/*.test.js should match app.test.js in root directory');
    });

    test('** should match one or more directories', () => {
        // Test case that should still work: subdirectory files
        assert.strictEqual(GlobUtils.matchesPattern('src/my.test.js', '**/*.test.js'), true, 
            '**/*.test.js should match my.test.js in src directory');
            
        assert.strictEqual(GlobUtils.matchesPattern('src/utils/helper.test.js', '**/*.test.js'), true, 
            '**/*.test.js should match helper.test.js in nested directory');
    });

    test('** should not match non-matching files', () => {
        // Files that should not match
        assert.strictEqual(GlobUtils.matchesPattern('test.ts', '**/*.test.js'), false, 
            '**/*.test.js should not match .ts files');
            
        assert.strictEqual(GlobUtils.matchesPattern('testfile.js', '**/*.test.js'), false, 
            '**/*.test.js should not match files without .test. pattern');
    });

    test('node_modules pattern should work correctly', () => {
        // Test the common node_modules exclusion pattern
        assert.strictEqual(GlobUtils.matchesPattern('node_modules/some-package/index.js', '**/node_modules/**'), true, 
            '**/node_modules/** should match files in node_modules');
            
        assert.strictEqual(GlobUtils.matchesPattern('src/node_modules/package/file.js', '**/node_modules/**'), true, 
            '**/node_modules/** should match nested node_modules');
            
        assert.strictEqual(GlobUtils.matchesPattern('src/my-modules/index.js', '**/node_modules/**'), false, 
            '**/node_modules/** should not match non-node_modules directories');
    });

    test('should handle single asterisk patterns', () => {
        assert.strictEqual(GlobUtils.matchesPattern('test.js', '*.js'), true, 
            '*.js should match test.js');
            
        assert.strictEqual(GlobUtils.matchesPattern('test.ts', '*.js'), false, 
            '*.js should not match test.ts');
            
        assert.strictEqual(GlobUtils.matchesPattern('src/test.js', '*.js'), false, 
            '*.js should not match files in subdirectories');
    });

    test('should handle question mark patterns', () => {
        assert.strictEqual(GlobUtils.matchesPattern('test1.js', 'test?.js'), true, 
            'test?.js should match test1.js');
            
        assert.strictEqual(GlobUtils.matchesPattern('test.js', 'test?.js'), false, 
            'test?.js should not match test.js (no character for ?)');
            
        assert.strictEqual(GlobUtils.matchesPattern('test12.js', 'test?.js'), false, 
            'test?.js should not match test12.js (too many chars for ?)');
    });

    test('should handle multiple patterns with matchesAnyPattern', () => {
        const patterns = ['*.js', '*.ts', '**/test/**'];
        
        assert.strictEqual(GlobUtils.matchesAnyPattern('app.js', patterns), true, 
            'should match .js files');
            
        assert.strictEqual(GlobUtils.matchesAnyPattern('app.ts', patterns), true, 
            'should match .ts files');
            
        assert.strictEqual(GlobUtils.matchesAnyPattern('src/test/helper.py', patterns), true, 
            'should match files in test directories');
            
        assert.strictEqual(GlobUtils.matchesAnyPattern('app.py', patterns), false, 
            'should not match .py files');
    });

    test('should handle edge cases', () => {
        // Empty pattern
        assert.strictEqual(GlobUtils.matchesPattern('test.js', ''), false, 
            'empty pattern should not match anything');
            
        // Empty filename
        assert.strictEqual(GlobUtils.matchesPattern('', '*.js'), false, 
            'empty filename should not match any pattern');
            
        // Pattern with no wildcards
        assert.strictEqual(GlobUtils.matchesPattern('exact.js', 'exact.js'), true, 
            'exact match should work');
            
        assert.strictEqual(GlobUtils.matchesPattern('different.js', 'exact.js'), false, 
            'non-matching exact pattern should not match');
    });

    test('should handle case sensitivity', () => {
        // The implementation uses case-insensitive matching
        assert.strictEqual(GlobUtils.matchesPattern('TEST.JS', '*.js'), true, 
            'should handle case insensitive matching');
            
        assert.strictEqual(GlobUtils.matchesPattern('test.JS', '*.js'), true, 
            'should handle mixed case extensions');
    });

    test('should handle complex nested patterns', () => {
        assert.strictEqual(GlobUtils.matchesPattern('src/components/Button/Button.test.js', '**/components/**/*.test.js'), true, 
            'complex nested pattern should match');
            
        assert.strictEqual(GlobUtils.matchesPattern('src/utils/helper.js', '**/components/**/*.test.js'), false, 
            'complex nested pattern should not match wrong path');
    });
});