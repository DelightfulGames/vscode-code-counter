import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as sinon from 'sinon';
import { WorkspaceDatabaseService, WorkspaceSettings, SettingsWithInheritance } from '../../services/workspaceDatabaseService';

suite('WorkspaceDatabaseService Comprehensive Tests', () => {
    let testWorkspacePath: string;
    let service: WorkspaceDatabaseService;
    let mockConfig: sinon.SinonStubbedInstance<vscode.WorkspaceConfiguration>;
    let mockWorkspace: sinon.SinonStub;

    suiteSetup(async function() {
        this.timeout(30000); // 30 seconds for database setup
    });

    setup(async function() {
        this.timeout(10000);
        // Create unique temporary workspace for each test
        testWorkspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-db-test-'));
        
        // Mock VS Code configuration 
        mockConfig = {
            get: sinon.stub(),
            has: sinon.stub(),
            inspect: sinon.stub(),
            update: sinon.stub().resolves()
        } as any;

        // Setup default configuration values
        mockConfig.get.withArgs('lineThresholds.midThreshold', 300).returns(300);
        mockConfig.get.withArgs('lineThresholds.highThreshold', 1000).returns(1000);
        mockConfig.get.withArgs('excludePatterns', []).returns(['**/node_modules/**']);
        mockConfig.get.withArgs('showNotificationOnAutoGenerate', false).returns(false);

        // Setup emoji configurations
        const mockEmojiConfig = {
            get: sinon.stub()
        } as any;
        mockEmojiConfig.get.withArgs('normal', '🟢').returns('🟢');
        mockEmojiConfig.get.withArgs('warning', '🟡').returns('🟡');
        mockEmojiConfig.get.withArgs('danger', '🔴').returns('🔴');

        const mockFolderEmojiConfig = {
            get: sinon.stub()
        } as any;
        mockFolderEmojiConfig.get.withArgs('normal', '🟩').returns('🟩');
        mockFolderEmojiConfig.get.withArgs('warning', '🟨').returns('🟨');
        mockFolderEmojiConfig.get.withArgs('danger', '🟥').returns('🟥');

        mockWorkspace = sinon.stub(vscode.workspace, 'getConfiguration');
        mockWorkspace.withArgs('codeCounter').returns(mockConfig);
        mockWorkspace.withArgs('codeCounter.emojis').returns(mockEmojiConfig);
        mockWorkspace.withArgs('codeCounter.emojis.folders').returns(mockFolderEmojiConfig);

        // Initialize service
        service = new WorkspaceDatabaseService(testWorkspacePath);
        
        // Wait for async initialization
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    teardown(async function() {
        this.timeout(5000);
        if (service) {
            service.dispose();
        }
        
        // Cleanup workspace
        try {
            if (fs.existsSync(testWorkspacePath)) {
                fs.rmSync(testWorkspacePath, { recursive: true, force: true });
            }
        } catch (error) {
            console.log('Cleanup warning:', error);
        }

        if (mockWorkspace) {
            mockWorkspace.restore();
        }
    });

    suite('Database Initialization and Setup', () => {
        test('should create database directory structure', async () => {
            console.log('Testing directory structure creation');
            
            const codeCounterDir = path.join(testWorkspacePath, '.vscode', 'code-counter');
            const reportsDir = path.join(codeCounterDir, 'reports');
            
            assert.ok(fs.existsSync(codeCounterDir), 'Code counter directory should exist');
            assert.ok(fs.existsSync(reportsDir), 'Reports directory should exist');
        });

        test('should create database file after initialization', async () => {
            console.log('Testing database file creation');
            
            // Give time for async initialization
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const dbPath = path.join(testWorkspacePath, '.vscode', 'code-counter', 'code-counter.db');
            assert.ok(fs.existsSync(dbPath), 'Database file should be created');
        });

        test('should return correct directory paths', async () => {
            console.log('Testing directory path getters');
            
            const expectedCodeCounterDir = path.join(testWorkspacePath, '.vscode', 'code-counter');
            const expectedReportsDir = path.join(expectedCodeCounterDir, 'reports');
            
            assert.strictEqual(service.getCodeCounterDirectory(), expectedCodeCounterDir);
            assert.strictEqual(service.getReportsDirectory(), expectedReportsDir);
        });
    });

    suite('Settings Storage and Retrieval', () => {
        test('should save and retrieve workspace settings', async () => {
            console.log('Testing basic settings save/retrieve');
            
            const testSettings: WorkspaceSettings = {
                'codeCounter.lineThresholds.midThreshold': 200,
                'codeCounter.lineThresholds.highThreshold': 800,
                'codeCounter.emojis.normal': '🟦',
                'codeCounter.excludePatterns': ['*.test.js', '*.spec.js']
            };
            
            await service.saveWorkspaceSettings(testWorkspacePath, testSettings);
            
            const retrieved = await service.getSettingsWithInheritance(testWorkspacePath);
            
            assert.strictEqual(retrieved.resolvedSettings['codeCounter.lineThresholds.midThreshold'], 200);
            assert.strictEqual(retrieved.resolvedSettings['codeCounter.lineThresholds.highThreshold'], 800);
            assert.strictEqual(retrieved.resolvedSettings['codeCounter.emojis.normal'], '🟦');
            assert.deepStrictEqual(retrieved.resolvedSettings['codeCounter.excludePatterns'], ['*.test.js', '*.spec.js']);
        });

        test('should handle empty directory path as workspace root', async () => {
            console.log('Testing empty directory path handling');
            
            const testSettings: WorkspaceSettings = {
                'codeCounter.emojis.warning': '⚠️'
            };
            
            await service.saveWorkspaceSettings('', testSettings);
            await service.saveWorkspaceSettings(testWorkspacePath, testSettings);
            
            const retrieved1 = await service.getSettingsWithInheritance('');
            const retrieved2 = await service.getSettingsWithInheritance(testWorkspacePath);
            
            assert.strictEqual(retrieved1.resolvedSettings['codeCounter.emojis.warning'], '⚠️');
            assert.strictEqual(retrieved2.resolvedSettings['codeCounter.emojis.warning'], '⚠️');
        });

        test('should handle subdirectory settings with inheritance', async () => {
            console.log('Testing subdirectory settings inheritance');
            
            // Create subdirectory
            const subDir = path.join(testWorkspacePath, 'src');
            fs.mkdirSync(subDir, { recursive: true });
            
            // Set workspace root settings
            const workspaceSettings: WorkspaceSettings = {
                'codeCounter.lineThresholds.midThreshold': 300,
                'codeCounter.emojis.normal': '🟢',
                'codeCounter.excludePatterns': ['*.log']
            };
            
            await service.saveWorkspaceSettings(testWorkspacePath, workspaceSettings);
            
            // Set subdirectory settings
            const subDirSettings: WorkspaceSettings = {
                'codeCounter.lineThresholds.midThreshold': 150, // Override
                'codeCounter.emojis.warning': '🟨' // Add new
                // Don't set excludePatterns - should inherit
            };
            
            await service.saveWorkspaceSettings(subDir, subDirSettings);
            
            const inheritance = await service.getSettingsWithInheritance(subDir);
            
            // Should get overridden value
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.lineThresholds.midThreshold'], 150);
            
            // Should inherit from workspace
            assert.deepStrictEqual(inheritance.resolvedSettings['codeCounter.excludePatterns'], ['*.log']);
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.emojis.normal'], '🟢');
            
            // Should have local setting
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.emojis.warning'], '🟨');
            
            // Check current vs parent settings
            assert.strictEqual(inheritance.currentSettings['codeCounter.lineThresholds.midThreshold'], 150);
            assert.strictEqual(inheritance.parentSettings['codeCounter.lineThresholds.midThreshold'], 300);
        });

        test('should handle complex directory nesting', async () => {
            console.log('Testing complex directory nesting inheritance');
            
            // Create nested structure: workspace/src/components/ui
            const srcDir = path.join(testWorkspacePath, 'src');
            const componentsDir = path.join(srcDir, 'components');
            const uiDir = path.join(componentsDir, 'ui');
            
            fs.mkdirSync(uiDir, { recursive: true });
            
            // Workspace level
            await service.saveWorkspaceSettings(testWorkspacePath, {
                'codeCounter.lineThresholds.midThreshold': 300,
                'codeCounter.emojis.normal': '🟢',
                'codeCounter.excludePatterns': ['*.log', '*.tmp']
            });
            
            // src level - only override threshold
            await service.saveWorkspaceSettings(srcDir, {
                'codeCounter.lineThresholds.midThreshold': 200
            });
            
            // components level - skip (no settings)
            
            // ui level - override emoji and add pattern
            await service.saveWorkspaceSettings(uiDir, {
                'codeCounter.emojis.normal': '🔷',
                'codeCounter.excludePatterns': ['*.log', '*.tmp', '*.ui.test.js']
            });
            
            const inheritance = await service.getSettingsWithInheritance(uiDir);
            
            // Should inherit threshold from src (200), emoji from ui (🔷), patterns from ui
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.lineThresholds.midThreshold'], 200);
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.emojis.normal'], '🔷');
            assert.deepStrictEqual(inheritance.resolvedSettings['codeCounter.excludePatterns'], ['*.log', '*.tmp', '*.ui.test.js']);
        });
    });

    suite('Settings Modification and Deletion', () => {
        test('should update existing settings', async () => {
            console.log('Testing settings update');
            
            // Initial settings
            const initialSettings: WorkspaceSettings = {
                'codeCounter.lineThresholds.midThreshold': 300,
                'codeCounter.emojis.normal': '🟢'
            };
            
            await service.saveWorkspaceSettings(testWorkspacePath, initialSettings);
            
            // Update settings
            const updatedSettings: WorkspaceSettings = {
                'codeCounter.lineThresholds.midThreshold': 250, // Changed
                'codeCounter.emojis.normal': '🟢', // Same
                'codeCounter.emojis.warning': '🟡' // New
            };
            
            await service.saveWorkspaceSettings(testWorkspacePath, updatedSettings);
            
            const retrieved = await service.getSettingsWithInheritance(testWorkspacePath);
            
            assert.strictEqual(retrieved.resolvedSettings['codeCounter.lineThresholds.midThreshold'], 250);
            assert.strictEqual(retrieved.resolvedSettings['codeCounter.emojis.normal'], '🟢');
            assert.strictEqual(retrieved.resolvedSettings['codeCounter.emojis.warning'], '🟡');
        });

        test('should delete settings for a directory', async () => {
            console.log('Testing settings deletion');
            
            const subDir = path.join(testWorkspacePath, 'src');
            fs.mkdirSync(subDir, { recursive: true });
            
            // Save settings for both workspace and subdirectory
            await service.saveWorkspaceSettings(testWorkspacePath, {
                'codeCounter.emojis.normal': '🟢'
            });
            
            await service.saveWorkspaceSettings(subDir, {
                'codeCounter.emojis.warning': '🟡'
            });
            
            // Verify both exist
            let inheritance = await service.getSettingsWithInheritance(subDir);
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.emojis.normal'], '🟢');
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.emojis.warning'], '🟡');
            
            // Delete subdirectory settings
            await service.deleteSettingsForPath(subDir);
            
            // Verify subdirectory settings gone but workspace settings remain
            inheritance = await service.getSettingsWithInheritance(subDir);
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.emojis.normal'], '🟢');
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.emojis.warning'], '🟡'); // Falls back to global
        });

        test('should reset specific fields to parent values', async () => {
            console.log('Testing field reset functionality');
            
            const subDir = path.join(testWorkspacePath, 'src');
            fs.mkdirSync(subDir, { recursive: true });
            
            // Set workspace settings
            await service.saveWorkspaceSettings(testWorkspacePath, {
                'codeCounter.lineThresholds.midThreshold': 400,
                'codeCounter.emojis.normal': '🟢',
                'codeCounter.emojis.warning': '🟡'
            });
            
            // Override in subdirectory
            await service.saveWorkspaceSettings(subDir, {
                'codeCounter.lineThresholds.midThreshold': 200,
                'codeCounter.emojis.normal': '🔷',
                'codeCounter.emojis.danger': '🔴'
            });
            
            // Reset specific field
            await service.resetField(subDir, 'lineThresholds.midThreshold');
            
            const inheritance = await service.getSettingsWithInheritance(subDir);
            
            // Should inherit threshold from parent (400), keep local emoji settings
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.lineThresholds.midThreshold'], 400);
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.emojis.normal'], '🔷');
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.emojis.danger'], '🔴');
        });

        test('should reset emoji groups correctly', async () => {
            console.log('Testing emoji group reset');
            
            const subDir = path.join(testWorkspacePath, 'src');
            fs.mkdirSync(subDir, { recursive: true });
            
            // Set workspace emojis
            await service.saveWorkspaceSettings(testWorkspacePath, {
                'codeCounter.emojis.normal': '🟢',
                'codeCounter.emojis.warning': '🟡',
                'codeCounter.emojis.danger': '🔴'
            });
            
            // Override in subdirectory
            await service.saveWorkspaceSettings(subDir, {
                'codeCounter.emojis.normal': '🔷',
                'codeCounter.emojis.warning': '🔶',
                'codeCounter.lineThresholds.midThreshold': 250
            });
            
            // Reset entire emoji group
            await service.resetField(subDir, 'emojis');
            
            const inheritance = await service.getSettingsWithInheritance(subDir);
            
            // Emojis should inherit from parent, threshold should remain local
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.emojis.normal'], '🟢');
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.emojis.warning'], '🟡');
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.emojis.danger'], '🔴');
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.lineThresholds.midThreshold'], 250);
        });
    });

    suite('Exclude Patterns with Sources', () => {
        test('should identify pattern sources correctly', async () => {
            console.log('Testing pattern source identification');
            
            const subDir = path.join(testWorkspacePath, 'src');
            fs.mkdirSync(subDir, { recursive: true });
            
            // Set workspace patterns
            await service.saveWorkspaceSettings(testWorkspacePath, {
                'codeCounter.excludePatterns': ['*.log', '*.tmp', 'node_modules/**']
            });
            
            // Add subdirectory patterns
            await service.saveWorkspaceSettings(subDir, {
                'codeCounter.excludePatterns': ['*.log', '*.tmp', 'node_modules/**', '*.test.js', 'coverage/**']
            });
            
            const patternsWithSources = await service.getExcludePatternsWithSources(subDir);
            
            console.log('Patterns with sources:', patternsWithSources);
            
            // Should identify which patterns come from which level
            assert.ok(patternsWithSources.length > 0, 'Should have patterns');
            
            // All patterns should be present
            const patterns = patternsWithSources.map(p => p.pattern);
            assert.ok(patterns.includes('*.log'));
            assert.ok(patterns.includes('*.test.js'));
            assert.ok(patterns.includes('coverage/**'));
        });

        test('should handle global pattern fallbacks', async () => {
            console.log('Testing global pattern fallbacks');
            
            // Don't set any workspace patterns - should fall back to global
            const patternsWithSources = await service.getExcludePatternsWithSources(testWorkspacePath);
            
            console.log('Global fallback patterns:', patternsWithSources);
            
            // Should have global patterns (from mock config)
            assert.ok(patternsWithSources.length > 0);
            const hasGlobalPattern = patternsWithSources.some(p => p.pattern === '**/node_modules/**');
            assert.ok(hasGlobalPattern, 'Should have global node_modules pattern');
        });
    });

    suite('Directory Management', () => {
        test('should list directories with settings', async () => {
            console.log('Testing directories with settings listing');
            
            // Create multiple directories and add settings
            const srcDir = path.join(testWorkspacePath, 'src');
            const testDir = path.join(testWorkspacePath, 'test');
            const docsDir = path.join(testWorkspacePath, 'docs');
            
            fs.mkdirSync(srcDir, { recursive: true });
            fs.mkdirSync(testDir, { recursive: true });
            fs.mkdirSync(docsDir, { recursive: true });
            
            await service.saveWorkspaceSettings(testWorkspacePath, {
                'codeCounter.emojis.normal': '🟢'
            });
            
            await service.saveWorkspaceSettings(srcDir, {
                'codeCounter.emojis.warning': '🟡'
            });
            
            await service.saveWorkspaceSettings(testDir, {
                'codeCounter.emojis.danger': '🔴'
            });
            
            // docs has no settings
            
            const directories = await service.getDirectoriesWithSettings();
            console.log('Directories with settings:', directories);
            
            assert.ok(directories.includes(testWorkspacePath), 'Should include workspace root');
            assert.ok(directories.includes(srcDir), 'Should include src directory');
            assert.ok(directories.includes(testDir), 'Should include test directory');
            assert.ok(!directories.includes(docsDir), 'Should not include docs directory');
        });

        test('should handle empty directories list', async () => {
            console.log('Testing empty directories list');
            
            // Fresh service with no settings
            const directories = await service.getDirectoriesWithSettings();
            
            // Should be empty or contain only paths with empty settings
            console.log('Empty directories result:', directories);
            assert.ok(Array.isArray(directories), 'Should return array');
        });
    });

    suite('Security and Path Validation', () => {
        test('should prevent path traversal attacks', async () => {
            console.log('Testing path traversal security');
            
            // Try to save settings with path traversal
            const maliciousPath = path.join(testWorkspacePath, '..', '..', 'malicious');
            
            try {
                await service.saveWorkspaceSettings(maliciousPath, {
                    'codeCounter.emojis.normal': '💀'
                });
                assert.fail('Should have thrown error for path traversal');
            } catch (error) {
                assert.ok((error as Error).message.includes('Path traversal detected'), 'Should detect path traversal');
            }
        });

        test('should handle absolute paths safely', async () => {
            console.log('Testing absolute path handling');
            
            // Try with absolute path outside workspace
            const outsidePath = path.join(os.tmpdir(), 'outside-workspace');
            
            try {
                await service.saveWorkspaceSettings(outsidePath, {
                    'codeCounter.emojis.normal': '💀'
                });
                assert.fail('Should have thrown error for outside path');
            } catch (error) {
                assert.ok((error as Error).message.includes('Path traversal detected'), 'Should detect outside path');
            }
        });

        test('should normalize paths correctly', async () => {
            console.log('Testing path normalization');
            
            const subDir = path.join(testWorkspacePath, 'src');
            fs.mkdirSync(subDir, { recursive: true });
            
            // Try with different path formats
            const windowsPath = testWorkspacePath + '\\src';
            const unixPath = testWorkspacePath + '/src';
            const normalizedPath = path.normalize(subDir);
            
            await service.saveWorkspaceSettings(windowsPath, {
                'codeCounter.emojis.normal': '🟢'
            });
            
            const inheritance1 = await service.getSettingsWithInheritance(unixPath);
            const inheritance2 = await service.getSettingsWithInheritance(normalizedPath);
            
            // Should work with all path formats
            assert.strictEqual(inheritance1.resolvedSettings['codeCounter.emojis.normal'], '🟢');
            assert.strictEqual(inheritance2.resolvedSettings['codeCounter.emojis.normal'], '🟢');
        });
    });

    suite('Error Handling and Edge Cases', () => {
        test('should handle database initialization errors gracefully', async () => {
            console.log('Testing database initialization error handling');
            
            // This is mainly testing that the service doesn't crash on edge conditions
            // Since we can't easily mock the SQL.js initialization in this context,
            // we test with valid operations and verify they work
            
            const settings: WorkspaceSettings = {
                'codeCounter.emojis.normal': '🟢'
            };
            
            await service.saveWorkspaceSettings(testWorkspacePath, settings);
            const inheritance = await service.getSettingsWithInheritance(testWorkspacePath);
            
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.emojis.normal'], '🟢');
        });

        test('should handle undefined and null values', async () => {
            console.log('Testing undefined/null value handling');
            
            const settings: WorkspaceSettings = {
                'codeCounter.lineThresholds.midThreshold': 300,
                'codeCounter.emojis.normal': undefined as any
            };
            
            await service.saveWorkspaceSettings(testWorkspacePath, settings);
            const inheritance = await service.getSettingsWithInheritance(testWorkspacePath);
            
            // Should save defined values, skip undefined ones
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.lineThresholds.midThreshold'], 300);
            // Undefined values should fall back to defaults
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.emojis.normal'], '🟢');
        });

        test('should handle empty settings objects', async () => {
            console.log('Testing empty settings object');
            
            const emptySettings: WorkspaceSettings = {};
            
            await service.saveWorkspaceSettings(testWorkspacePath, emptySettings);
            const inheritance = await service.getSettingsWithInheritance(testWorkspacePath);
            
            // Should fall back to global defaults
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.emojis.normal'], '🟢');
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.lineThresholds.midThreshold'], 300);
        });

        test('should handle reset of non-existent fields', async () => {
            console.log('Testing reset of non-existent fields');
            
            // Try to reset field that doesn't exist
            await service.resetField(testWorkspacePath, 'nonExistentField');
            
            // Should not crash, should be able to continue normal operations
            const inheritance = await service.getSettingsWithInheritance(testWorkspacePath);
            assert.ok(inheritance.resolvedSettings, 'Should still return settings');
        });

        test('should handle very long path names', async () => {
            console.log('Testing very long path names');
            
            // Create a deeply nested directory structure
            let longPath = testWorkspacePath;
            for (let i = 0; i < 10; i++) {
                longPath = path.join(longPath, `very-long-directory-name-${i}-with-lots-of-characters`);
            }
            
            fs.mkdirSync(longPath, { recursive: true });
            
            await service.saveWorkspaceSettings(longPath, {
                'codeCounter.emojis.normal': '🔷'
            });
            
            const inheritance = await service.getSettingsWithInheritance(longPath);
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.emojis.normal'], '🔷');
        });

        test('should handle special characters in directory names', async () => {
            console.log('Testing special characters in directory names');
            
            // Create directory with special characters (that are valid in file systems)
            const specialDir = path.join(testWorkspacePath, 'special-chars_@#$%');
            fs.mkdirSync(specialDir, { recursive: true });
            
            await service.saveWorkspaceSettings(specialDir, {
                'codeCounter.emojis.warning': '⚠️'
            });
            
            const inheritance = await service.getSettingsWithInheritance(specialDir);
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.emojis.warning'], '⚠️');
        });
    });

    suite('JSON Migration Compatibility', () => {
        test('should handle migration from non-existent JSON files', async () => {
            console.log('Testing migration from non-existent JSON files');
            
            const result = await service.migrateFromJsonFiles();
            
            console.log('Migration result:', result);
            assert.strictEqual(result.migrated, 0, 'Should migrate 0 files');
            assert.strictEqual(result.errors.length, 0, 'Should have no errors');
        });

        test('should simulate JSON file migration', async () => {
            console.log('Testing JSON file migration simulation');
            
            // Create a fake JSON file in subdirectory
            const subDir = path.join(testWorkspacePath, 'src');
            fs.mkdirSync(subDir, { recursive: true });
            
            const jsonPath = path.join(subDir, '.code-counter.json');
            const jsonSettings = {
                'codeCounter.emojis.normal': '🎯',
                'codeCounter.lineThresholds.midThreshold': 250
            };
            
            fs.writeFileSync(jsonPath, JSON.stringify(jsonSettings, null, 2));
            
            // Run migration
            const result = await service.migrateFromJsonFiles();
            
            console.log('Migration result:', result);
            assert.strictEqual(result.migrated, 1, 'Should migrate 1 file');
            
            // Verify settings were migrated
            const inheritance = await service.getSettingsWithInheritance(subDir);
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.emojis.normal'], '🎯');
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.lineThresholds.midThreshold'], 250);
        });

        test('should handle corrupted JSON during migration', async () => {
            console.log('Testing corrupted JSON migration handling');
            
            const subDir = path.join(testWorkspacePath, 'src');
            fs.mkdirSync(subDir, { recursive: true });
            
            const jsonPath = path.join(subDir, '.code-counter.json');
            fs.writeFileSync(jsonPath, '{ invalid json content');
            
            const result = await service.migrateFromJsonFiles();
            
            console.log('Migration result with errors:', result);
            assert.strictEqual(result.migrated, 0, 'Should migrate 0 files');
            assert.strictEqual(result.errors.length, 1, 'Should have 1 error');
            assert.ok(result.errors[0].includes('Failed to migrate'), 'Should describe migration failure');
        });
    });

    suite('Performance and Concurrency', () => {
        test('should handle multiple rapid operations', async () => {
            console.log('Testing multiple rapid operations');
            
            const operations = [];
            
            // Create 10 rapid operations
            for (let i = 0; i < 10; i++) {
                const settings: WorkspaceSettings = {
                    'codeCounter.lineThresholds.midThreshold': 200 + i,
                    'codeCounter.emojis.normal': `🔢`
                };
                
                operations.push(service.saveWorkspaceSettings(testWorkspacePath, settings));
            }
            
            // Wait for all operations to complete
            await Promise.all(operations);
            
            // Verify final state
            const inheritance = await service.getSettingsWithInheritance(testWorkspacePath);
            
            // Should have final values (exact value depends on timing, but should be valid)
            assert.ok(inheritance.resolvedSettings['codeCounter.lineThresholds.midThreshold'] >= 200);
            assert.ok(inheritance.resolvedSettings['codeCounter.lineThresholds.midThreshold'] <= 209);
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.emojis.normal'], '🔢');
        });

        test('should handle concurrent reads and writes', async () => {
            console.log('Testing concurrent reads and writes');
            
            // Set initial data
            await service.saveWorkspaceSettings(testWorkspacePath, {
                'codeCounter.emojis.normal': '🟢'
            });
            
            // Start concurrent reads and writes
            const operations = [];
            
            // 5 reads
            for (let i = 0; i < 5; i++) {
                operations.push(service.getSettingsWithInheritance(testWorkspacePath));
            }
            
            // 3 writes
            for (let i = 0; i < 3; i++) {
                operations.push(service.saveWorkspaceSettings(testWorkspacePath, {
                    'codeCounter.lineThresholds.midThreshold': 300 + i
                }));
            }
            
            // Wait for all operations
            const results = await Promise.all(operations);
            
            // Reads should succeed (first 5 results)
            for (let i = 0; i < 5; i++) {
                const inheritance = results[i] as SettingsWithInheritance;
                assert.ok(inheritance.resolvedSettings, 'Read should succeed');
                assert.strictEqual(inheritance.resolvedSettings['codeCounter.emojis.normal'], '🟢');
            }
            
            // Final state should be valid
            const finalState = await service.getSettingsWithInheritance(testWorkspacePath);
            assert.ok(finalState.resolvedSettings['codeCounter.lineThresholds.midThreshold'] >= 300);
        });
    });

    suite('Dispose and Cleanup', () => {
        test('should dispose cleanly without errors', async () => {
            console.log('Testing clean disposal');
            
            // Use the service normally first
            await service.saveWorkspaceSettings(testWorkspacePath, {
                'codeCounter.emojis.normal': '🟢'
            });
            
            const inheritance = await service.getSettingsWithInheritance(testWorkspacePath);
            assert.strictEqual(inheritance.resolvedSettings['codeCounter.emojis.normal'], '🟢');
            
            // Dispose should not throw
            service.dispose();
            
            console.log('Service disposed successfully');
        });

        test('should handle operations after dispose gracefully', async () => {
            console.log('Testing operations after dispose');
            
            service.dispose();
            
            // Operations after dispose may throw or fail gracefully
            // We test that they don't crash the process
            try {
                await service.getSettingsWithInheritance(testWorkspacePath);
                console.log('Operation after dispose completed (may have failed gracefully)');
            } catch (error) {
                console.log('Operation after dispose threw expected error:', (error as Error).message);
                assert.ok(
                    (error as Error).message.includes('Database not initialized') || 
                    (error as Error).message.includes('disposed') ||
                    (error as Error).message.includes('out of memory') ||
                    (error as Error).message.includes('database connection is closed')
                );
            }
        });
    });
});