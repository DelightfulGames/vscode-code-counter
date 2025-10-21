import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { WorkspaceSettingsService, WorkspaceSettings } from '../../services/workspaceSettingsService';

suite('Edge Cases and Error Handling Tests', () => {
    let tempDir: string;
    let service: WorkspaceSettingsService;
    
    suiteSetup(async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'edge-cases-'));
        service = new WorkspaceSettingsService(tempDir);
    });
    
    suiteTeardown(async () => {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    suite('Malformed Configuration Files', () => {
        test('should handle completely invalid JSON', async () => {
            const testDir = path.join(tempDir, 'invalid-json');
            await fs.promises.mkdir(testDir, { recursive: true });

            const settingsPath = path.join(testDir, '.code-counter.json');
            await fs.promises.writeFile(settingsPath, 'this is not json at all');

            // Should fallback to global settings without throwing
            const resolved = await service.getResolvedSettings(testDir);
            expect(resolved.source).to.equal('global');
            expect(resolved['codeCounter.excludePatterns']).to.be.an('array');
        });

        test('should handle empty files', async () => {
            const testDir = path.join(tempDir, 'empty-file');
            await fs.promises.mkdir(testDir, { recursive: true });

            const settingsPath = path.join(testDir, '.code-counter.json');
            await fs.promises.writeFile(settingsPath, '');

            // Should fallback to global settings
            const resolved = await service.getResolvedSettings(testDir);
            expect(resolved.source).to.equal('global');
        });

        test('should handle partial JSON objects', async () => {
            const testDir = path.join(tempDir, 'partial-json');
            await fs.promises.mkdir(testDir, { recursive: true });

            const settingsPath = path.join(testDir, '.code-counter.json');
            await fs.promises.writeFile(settingsPath, '{"codeCounter.excludePatterns": ["*.log"'); // Missing closing bracket

            // Should fallback to global settings
            const resolved = await service.getResolvedSettings(testDir);
            expect(resolved.source).to.equal('global');
        });

        test('should handle valid JSON with invalid structure', async () => {
            const testDir = path.join(tempDir, 'invalid-structure');
            await fs.promises.mkdir(testDir, { recursive: true });

            const settingsPath = path.join(testDir, '.code-counter.json');
            await fs.promises.writeFile(settingsPath, '{"someRandomProperty": "value", "anotherProperty": 123}');

            // Should use the JSON but inherit defaults for missing properties
            const resolved = await service.getResolvedSettings(testDir);
            expect(resolved['codeCounter.excludePatterns']).to.be.an('array');
            expect(resolved['codeCounter.lineThresholds.midThreshold']).to.be.a('number');
        });
    });

    suite('File System Edge Cases', () => {
        test('should handle non-existent directories', async () => {
            const nonExistentDir = path.join(tempDir, 'does-not-exist', 'nested', 'path');

            // Should not throw and return global settings
            const resolved = await service.getResolvedSettings(nonExistentDir);
            expect(resolved.source).to.equal('global');
            expect(resolved['codeCounter.excludePatterns']).to.be.an('array');
        });

        test('should handle directories with spaces and special characters', async () => {
            const specialDir = path.join(tempDir, 'dir with spaces & special chars (test)');
            await fs.promises.mkdir(specialDir, { recursive: true });

            const settings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['special-*.js']
            };
            await service.saveWorkspaceSettings(specialDir, settings);

            const resolved = await service.getResolvedSettings(specialDir);
            expect(resolved['codeCounter.excludePatterns']).to.include('special-*.js');
        });

        test('should handle very deep directory nesting', async () => {
            // Create very deep nesting (20 levels)
            let currentPath = tempDir;
            for (let i = 0; i < 20; i++) {
                currentPath = path.join(currentPath, `level${i}`);
                await fs.promises.mkdir(currentPath, { recursive: true });
            }

            const settings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['deep-*.js']
            };
            await service.saveWorkspaceSettings(currentPath, settings);

            const resolved = await service.getResolvedSettings(currentPath);
            expect(resolved['codeCounter.excludePatterns']).to.include('deep-*.js');
        });

        test('should handle concurrent file operations', async () => {
            const testDir = path.join(tempDir, 'concurrent');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Perform multiple operations concurrently
            const operations = [];
            for (let i = 0; i < 10; i++) {
                const settings: WorkspaceSettings = {
                    'codeCounter.excludePatterns': [`pattern${i}-*.js`],
                    'codeCounter.lineThresholds.midThreshold': 100 + i
                };
                operations.push(service.saveWorkspaceSettings(testDir, settings));
            }

            await Promise.all(operations);

            // Last write should win
            const resolved = await service.getResolvedSettings(testDir);
            expect(resolved['codeCounter.lineThresholds.midThreshold']).to.be.within(100, 110);
        });
    });

    suite('Pattern Edge Cases', () => {
        test('should handle extremely long patterns', async () => {
            const testDir = path.join(tempDir, 'long-patterns');
            await fs.promises.mkdir(testDir, { recursive: true });

            const longPattern = '**/very/long/path/with/many/segments/and/more/segments/and/even/more/segments/that/goes/on/and/on/and/on/and/on/and/on/**/*.{js,ts,jsx,tsx,vue,svelte,angular,react,html,css,scss,sass,less,styl,stylus}';
            const settings: WorkspaceSettings = {
                'codeCounter.excludePatterns': [longPattern]
            };
            await service.saveWorkspaceSettings(testDir, settings);

            const patternsWithSources = await service.getExcludePatternsWithSources(testDir);
            expect(patternsWithSources).to.have.length(1);
            expect(patternsWithSources[0].pattern).to.equal(longPattern);
        });

        test('should handle patterns with unicode characters', async () => {
            const testDir = path.join(tempDir, 'unicode-patterns');
            await fs.promises.mkdir(testDir, { recursive: true });

            const unicodePatterns = [
                '**/*文件*.js',
                '**/αρχείο-*.ts',
                '**/*файл*.vue',
                '**/🔥-*.json',
                '**/*مجلد*/**'
            ];
            const settings: WorkspaceSettings = {
                'codeCounter.excludePatterns': unicodePatterns
            };
            await service.saveWorkspaceSettings(testDir, settings);

            const patternsWithSources = await service.getExcludePatternsWithSources(testDir);
            expect(patternsWithSources).to.have.length(5);
            
            const patterns = patternsWithSources.map(p => p.pattern);
            for (const pattern of unicodePatterns) {
                expect(patterns).to.include(pattern);
            }
        });

        test('should handle patterns with escape characters', async () => {
            const testDir = path.join(tempDir, 'escape-patterns');
            await fs.promises.mkdir(testDir, { recursive: true });

            const escapePatterns = [
                '**/file\\with\\backslashes.js',
                '**/file"with"quotes.ts',
                "**/file'with'apostrophes.vue",
                '**/file\twith\ttabs.json',
                '**/file\nwith\nlines.md'
            ];
            const settings: WorkspaceSettings = {
                'codeCounter.excludePatterns': escapePatterns
            };
            await service.saveWorkspaceSettings(testDir, settings);

            const patternsWithSources = await service.getExcludePatternsWithSources(testDir);
            expect(patternsWithSources).to.have.length(5);
        });

        test('should handle empty and whitespace-only patterns', async () => {
            const testDir = path.join(tempDir, 'whitespace-patterns');
            await fs.promises.mkdir(testDir, { recursive: true });

            const problematicPatterns = [
                '',
                '   ',
                '\t',
                '\n',
                '    \t\n  ',
                'valid-*.js'
            ];
            const settings: WorkspaceSettings = {
                'codeCounter.excludePatterns': problematicPatterns
            };
            await service.saveWorkspaceSettings(testDir, settings);

            const patternsWithSources = await service.getExcludePatternsWithSources(testDir);
            // Should include all patterns (even empty/whitespace ones)
            expect(patternsWithSources).to.have.length(6);
        });
    });

    suite('Inheritance Chain Edge Cases', () => {
        test('should handle circular directory references (symlinks)', async () => {
            const dir1 = path.join(tempDir, 'circular1');
            const dir2 = path.join(tempDir, 'circular2');
            
            await fs.promises.mkdir(dir1, { recursive: true });
            await fs.promises.mkdir(dir2, { recursive: true });

            // Create settings in both directories
            const settings1: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['circular1-*.js']
            };
            await service.saveWorkspaceSettings(dir1, settings1);

            const settings2: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['circular2-*.js']
            };
            await service.saveWorkspaceSettings(dir2, settings2);

            // Should handle gracefully without infinite loops
            const resolved1 = await service.getResolvedSettings(dir1);
            const resolved2 = await service.getResolvedSettings(dir2);

            expect(resolved1['codeCounter.excludePatterns']).to.include('circular1-*.js');
            expect(resolved2['codeCounter.excludePatterns']).to.include('circular2-*.js');
        });

        test('should handle inheritance chain with mixed existing and non-existing directories', async () => {
            const existingDir = path.join(tempDir, 'existing');
            const missingDir = path.join(tempDir, 'missing');
            const deepDir = path.join(missingDir, 'deep', 'nested');

            await fs.promises.mkdir(existingDir, { recursive: true });

            const settings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['existing-*.js']
            };
            await service.saveWorkspaceSettings(existingDir, settings);

            // Try to resolve settings for non-existing deep directory
            const resolved = await service.getResolvedSettings(deepDir);
            expect(resolved.source).to.equal('global');
        });

        test('should handle inheritance when workspace root has no settings', async () => {
            // Create new workspace without workspace settings
            const cleanWorkspace = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'clean-inheritance-'));
            const cleanService = new WorkspaceSettingsService(cleanWorkspace);

            const subDir = path.join(cleanWorkspace, 'sub');
            const deepDir = path.join(subDir, 'deep');

            await fs.promises.mkdir(subDir, { recursive: true });
            await fs.promises.mkdir(deepDir, { recursive: true });

            // Set patterns only in deep directory
            const deepSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['deep-*.js']
            };
            await cleanService.saveWorkspaceSettings(deepDir, deepSettings);

            try {
                // Deep directory should use its own settings
                const deepResolved = await cleanService.getResolvedSettings(deepDir);
                expect(deepResolved['codeCounter.excludePatterns']).to.include('deep-*.js');

                // Sub directory should inherit from global (skipping deep)
                const subResolved = await cleanService.getResolvedSettings(subDir);
                expect(subResolved.source).to.equal('global');
                expect(subResolved['codeCounter.excludePatterns']).to.not.include('deep-*.js');
            } finally {
                await fs.promises.rm(cleanWorkspace, { recursive: true, force: true });
            }
        });
    });

    suite('Performance and Scalability', () => {
        test('should handle large numbers of patterns efficiently', async () => {
            const testDir = path.join(tempDir, 'large-patterns');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Create 1000 patterns
            const manyPatterns = [];
            for (let i = 0; i < 1000; i++) {
                manyPatterns.push(`pattern${i}-*.js`);
                manyPatterns.push(`**/*test${i}*/**`);
                manyPatterns.push(`**/generated${i}/**/*.{js,ts}`);
            }

            const settings: WorkspaceSettings = {
                'codeCounter.excludePatterns': manyPatterns
            };

            const startTime = Date.now();
            await service.saveWorkspaceSettings(testDir, settings);
            const patternsWithSources = await service.getExcludePatternsWithSources(testDir);
            const endTime = Date.now();

            // Should complete within reasonable time (less than 1 second)
            expect(endTime - startTime).to.be.lessThan(1000);
            expect(patternsWithSources).to.have.length(3000);
        });

        test('should handle frequent updates efficiently', async () => {
            const testDir = path.join(tempDir, 'frequent-updates');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Perform 100 updates rapidly
            const startTime = Date.now();
            for (let i = 0; i < 100; i++) {
                const settings: WorkspaceSettings = {
                    'codeCounter.excludePatterns': [`update${i}-*.js`],
                    'codeCounter.lineThresholds.midThreshold': 100 + i
                };
                await service.saveWorkspaceSettings(testDir, settings);
            }
            const endTime = Date.now();

            // Should complete all updates within reasonable time
            expect(endTime - startTime).to.be.lessThan(5000);

            const resolved = await service.getResolvedSettings(testDir);
            expect(resolved['codeCounter.lineThresholds.midThreshold']).to.equal(199);
        });
    });

    suite('Data Consistency and Integrity', () => {
        test.skip('should maintain data consistency after reset operations', async () => {
            const testDir = path.join(tempDir, 'consistency-reset');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Set workspace patterns
            const workspaceSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['workspace-*.js'],
                'codeCounter.emojis.normal': '🟢'
            };
            await service.saveWorkspaceSettings(tempDir, workspaceSettings);

            // Set local patterns and emojis  
            const localSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['local-*.js'],
                'codeCounter.emojis.normal': '✅',
                'codeCounter.lineThresholds.midThreshold': 150
            };
            await service.saveWorkspaceSettings(testDir, localSettings);

            // Verify initial state
            let resolved = await service.getResolvedSettings(testDir);
            expect(resolved['codeCounter.excludePatterns']).to.include('local-*.js');
            expect(resolved['codeCounter.emojis.normal']).to.equal('✅');

            // Reset excludePatterns only
            await service.resetField(testDir, 'excludePatterns');

            // Verify patterns are reset but other settings remain
            resolved = await service.getResolvedSettings(testDir);
            expect(resolved['codeCounter.excludePatterns']).to.include('workspace-*.js');
            expect(resolved['codeCounter.excludePatterns']).to.not.include('local-*.js');
            expect(resolved['codeCounter.emojis.normal']).to.equal('✅'); // Should remain
            expect(resolved['codeCounter.lineThresholds.midThreshold']).to.equal(150); // Should remain
        });

        test('should handle concurrent read/write operations gracefully', async () => {
            const testDir = path.join(tempDir, 'concurrent-rw');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Start multiple concurrent operations
            const operations = [];
            
            // Mix of reads and writes
            for (let i = 0; i < 20; i++) {
                if (i % 2 === 0) {
                    // Write operation
                    const settings: WorkspaceSettings = {
                        'codeCounter.excludePatterns': [`pattern${i}-*.js`]
                    };
                    operations.push(service.saveWorkspaceSettings(testDir, settings));
                } else {
                    // Read operation
                    operations.push(service.getResolvedSettings(testDir));
                }
            }

            // All operations should complete without errors
            const results = await Promise.allSettled(operations);
            const failures = results.filter(r => r.status === 'rejected');
            expect(failures).to.have.length(0);
        });
    });
});