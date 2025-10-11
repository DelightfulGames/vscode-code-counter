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
});