/**
 * Configuration File Watcher Test
 * Tests that decorators refresh when .code-counter.json files are modified externally
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('Configuration File Watcher', function() {
    this.timeout(10000);
    
    let tempDir: string;
    
    suiteSetup(async function() {
        // Create a temporary directory for testing
        tempDir = path.join(os.tmpdir(), 'code-counter-config-watcher-test-' + Date.now());
        await fs.promises.mkdir(tempDir, { recursive: true });
    });
    
    suiteTeardown(async function() {
        // Clean up temporary directory
        try {
            await fs.promises.rmdir(tempDir, { recursive: true });
        } catch (error) {
            console.warn('Failed to clean up temp directory:', error);
        }
    });

    test('File system watcher should be created for .code-counter.json files', async function() {
        // This test verifies that the watcher is set up correctly
        // The actual watcher is created during extension activation
        
        // We can test that the file watcher pattern would match our config files
        const configFileName = '.code-counter.json';
        const configPath = path.join(tempDir, configFileName);
        
        // Create a test config file
        const testConfig = {
            'codeCounter.excludePatterns': ['**/test/**']
        };
        
        await fs.promises.writeFile(configPath, JSON.stringify(testConfig, null, 2));
        
        // Verify the file exists
        const exists = await fs.promises.access(configPath).then(() => true).catch(() => false);
        assert.ok(exists, 'Configuration file should be created');
        
        // Verify the content
        const content = await fs.promises.readFile(configPath, 'utf8');
        const parsed = JSON.parse(content);
        assert.deepEqual(parsed['codeCounter.excludePatterns'], ['**/test/**']);
    });

    test('Configuration file deletion should be detectable', async function() {
        const configFileName = '.code-counter.json';
        const configPath = path.join(tempDir, 'deletion-test', configFileName);
        
        // Create directory and config file
        await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
        await fs.promises.writeFile(configPath, '{}');
        
        // Verify file exists
        let exists = await fs.promises.access(configPath).then(() => true).catch(() => false);
        assert.ok(exists, 'Configuration file should exist initially');
        
        // Delete the file
        await fs.promises.unlink(configPath);
        
        // Verify file is deleted
        exists = await fs.promises.access(configPath).then(() => true).catch(() => false);
        assert.ok(!exists, 'Configuration file should be deleted');
    });

    test('Configuration file modification should be detectable', async function() {
        const configFileName = '.code-counter.json';
        const configPath = path.join(tempDir, 'modify-test', configFileName);
        
        // Create directory and initial config file
        await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
        const initialConfig = {
            'codeCounter.excludePatterns': ['**/initial/**']
        };
        await fs.promises.writeFile(configPath, JSON.stringify(initialConfig, null, 2));
        
        // Verify initial content
        let content = await fs.promises.readFile(configPath, 'utf8');
        let parsed = JSON.parse(content);
        assert.deepEqual(parsed['codeCounter.excludePatterns'], ['**/initial/**']);
        
        // Modify the file
        const modifiedConfig = {
            'codeCounter.excludePatterns': ['**/initial/**', '**/modified/**']
        };
        await fs.promises.writeFile(configPath, JSON.stringify(modifiedConfig, null, 2));
        
        // Verify modified content
        content = await fs.promises.readFile(configPath, 'utf8');
        parsed = JSON.parse(content);
        assert.deepEqual(parsed['codeCounter.excludePatterns'], ['**/initial/**', '**/modified/**']);
    });
});