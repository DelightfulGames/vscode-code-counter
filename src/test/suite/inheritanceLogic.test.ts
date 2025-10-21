import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { WorkspaceSettingsService, WorkspaceSettings, ResolvedSettings } from '../../services/workspaceSettingsService';

suite('Workspace Settings Inheritance Tests', () => {
    let tempDir: string;
    let service: WorkspaceSettingsService;
    
    suiteSetup(async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'inheritance-test-'));
        service = new WorkspaceSettingsService(tempDir);
    });
    
    suiteTeardown(async () => {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    suite('Exclude Patterns Inheritance', () => {
        test.skip('should inherit from nearest ancestor only', async () => {
            // Create directory structure: workspace -> src -> components -> ui
            const srcDir = path.join(tempDir, 'src');
            const componentsDir = path.join(srcDir, 'components');
            const uiDir = path.join(componentsDir, 'ui');
            
            await fs.promises.mkdir(srcDir, { recursive: true });
            await fs.promises.mkdir(componentsDir, { recursive: true });
            await fs.promises.mkdir(uiDir, { recursive: true });

            // Set patterns at workspace level
            const workspaceSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['workspace-*.js', 'root/**']
            };
            await service.saveWorkspaceSettings(tempDir, workspaceSettings);

            // Set different patterns at src level
            const srcSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['*.spec.js', '*.test.js', 'src/**']
            };
            await service.saveWorkspaceSettings(srcDir, srcSettings);

            // ui directory should inherit from src (nearest ancestor), not workspace
            const resolved = await service.getResolvedSettings(uiDir);
            expect(resolved['codeCounter.excludePatterns']).to.deep.equal(['*.spec.js', '*.test.js', 'src/**']);
            expect(resolved['codeCounter.excludePatterns']).to.not.include('workspace-*.js');
            expect(resolved['codeCounter.excludePatterns']).to.not.include('root/**');
        });

        test('should skip ancestor without patterns and use next ancestor', async () => {
            // Create directory structure: workspace -> src -> components -> ui
            const srcDir = path.join(tempDir, 'src');
            const componentsDir = path.join(srcDir, 'components');
            const uiDir = path.join(componentsDir, 'ui');
            
            await fs.promises.mkdir(srcDir, { recursive: true });
            await fs.promises.mkdir(componentsDir, { recursive: true });
            await fs.promises.mkdir(uiDir, { recursive: true });

            // Set patterns at workspace level
            const workspaceSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['workspace-*.js', 'root/**']
            };
            await service.saveWorkspaceSettings(tempDir, workspaceSettings);

            // Set settings at src level but WITHOUT excludePatterns
            const srcSettings: WorkspaceSettings = {
                'codeCounter.emojis.normal': '🟢',
                'codeCounter.lineThresholds.midThreshold': 100
            };
            await service.saveWorkspaceSettings(srcDir, srcSettings);

            // ui directory should inherit from workspace (skipping src), since src doesn't define patterns
            const resolved = await service.getResolvedSettings(uiDir);
            expect(resolved['codeCounter.excludePatterns']).to.deep.equal(['workspace-*.js', 'root/**']);
        });

        test('should fall back to global when no ancestor defines patterns', async () => {
            // Create new workspace without any pattern definitions
            const cleanWorkspace = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'clean-workspace-'));
            const cleanService = new WorkspaceSettingsService(cleanWorkspace);
            
            const testDir = path.join(cleanWorkspace, 'test');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Set workspace settings but WITHOUT excludePatterns
            const workspaceSettings: WorkspaceSettings = {
                'codeCounter.emojis.normal': '🟢',
                'codeCounter.lineThresholds.midThreshold': 100
            };
            await cleanService.saveWorkspaceSettings(cleanWorkspace, workspaceSettings);

            try {
                const resolved = await cleanService.getResolvedSettings(testDir);
                // Should fall back to global/default patterns
                expect(resolved['codeCounter.excludePatterns']).to.be.an('array');
                expect(resolved['codeCounter.excludePatterns']).to.include('**/node_modules/**');
                expect(resolved['codeCounter.excludePatterns']).to.include('**/.git/**');
            } finally {
                await fs.promises.rm(cleanWorkspace, { recursive: true, force: true });
            }
        });

        test.skip('should handle empty patterns array', async () => {
            const testDir = path.join(tempDir, 'empty-patterns');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Set empty patterns array (different from undefined)
            const settings: WorkspaceSettings = {
                'codeCounter.excludePatterns': []
            };
            await service.saveWorkspaceSettings(testDir, settings);

            const resolved = await service.getResolvedSettings(testDir);
            expect(resolved['codeCounter.excludePatterns']).to.deep.equal([]);
        });
    });

    suite('Pattern Source Tracking', () => {
        test('should correctly identify pattern sources', async () => {
            // Create directory structure
            const srcDir = path.join(tempDir, 'src');
            const libDir = path.join(tempDir, 'lib');
            
            await fs.promises.mkdir(srcDir, { recursive: true });
            await fs.promises.mkdir(libDir, { recursive: true });

            // Set workspace patterns
            const workspaceSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['*.log', 'workspace/**']
            };
            await service.saveWorkspaceSettings(tempDir, workspaceSettings);

            // Set src patterns
            const srcSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['*.spec.js', 'src/**']
            };
            await service.saveWorkspaceSettings(srcDir, srcSettings);

            // Test src directory patterns
            const srcPatterns = await service.getExcludePatternsWithSources(srcDir);
            expect(srcPatterns).to.have.length(2);
            expect(srcPatterns[0]).to.deep.include({ pattern: '*.spec.js', source: 'src', level: 'directory' });
            expect(srcPatterns[1]).to.deep.include({ pattern: 'src/**', source: 'src', level: 'directory' });

            // Test lib directory patterns (should inherit from workspace)
            const libPatterns = await service.getExcludePatternsWithSources(libDir);
            expect(libPatterns).to.have.length(2);
            expect(libPatterns[0]).to.deep.include({ pattern: '*.log', source: '<workspace>', level: 'workspace' });
            expect(libPatterns[1]).to.deep.include({ pattern: 'workspace/**', source: '<workspace>', level: 'workspace' });
        });

        test('should handle global pattern sources', async () => {
            // Create new workspace without any pattern definitions
            const cleanWorkspace = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'global-patterns-'));
            const cleanService = new WorkspaceSettingsService(cleanWorkspace);
            
            const testDir = path.join(cleanWorkspace, 'test');
            await fs.promises.mkdir(testDir, { recursive: true });

            try {
                const patterns = await cleanService.getExcludePatternsWithSources(testDir);
                expect(patterns.length).to.be.greaterThan(0);
                
                // All patterns should be from global source
                for (const pattern of patterns) {
                    expect(pattern.source).to.equal('<global>');
                    expect(pattern.level).to.equal('global');
                }
            } finally {
                await fs.promises.rm(cleanWorkspace, { recursive: true, force: true });
            }
        });
    });

    suite('Inheritance Information', () => {
        test('should provide correct inheritance information', async () => {
            const testDir = path.join(tempDir, 'inheritance-info');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Set workspace settings
            const workspaceSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['*.log'],
                'codeCounter.emojis.normal': '🟢',
                'codeCounter.lineThresholds.midThreshold': 100
            };
            await service.saveWorkspaceSettings(tempDir, workspaceSettings);

            // Set test directory settings (only some fields)
            const testSettings: WorkspaceSettings = {
                'codeCounter.emojis.normal': '✅',
                // excludePatterns not set - should inherit
                // midThreshold not set - should inherit
            };
            await service.saveWorkspaceSettings(testDir, testSettings);

            const inheritanceInfo = await service.getSettingsWithInheritance(testDir);
            
            // Current settings should only have what's explicitly set
            expect(inheritanceInfo.currentSettings).to.deep.include({
                'codeCounter.emojis.normal': '✅'
            });
            expect(inheritanceInfo.currentSettings?.['codeCounter.excludePatterns']).to.be.undefined;

            // Parent settings should have workspace values
            expect(inheritanceInfo.parentSettings).to.deep.include({
                'codeCounter.excludePatterns': ['*.log'],
                'codeCounter.emojis.normal': '🟢',
                'codeCounter.lineThresholds.midThreshold': 100
            });

            // Resolved should combine current overrides with inherited values
            expect(inheritanceInfo.resolvedSettings).to.deep.include({
                'codeCounter.excludePatterns': ['*.log'], // Inherited
                'codeCounter.emojis.normal': '✅', // Overridden
                'codeCounter.lineThresholds.midThreshold': 100 // Inherited
            });
        });
    });

    suite('Copy-Then-Modify Behavior', () => {
        test.skip('should copy all patterns when modifying inherited patterns', async () => {
            const testDir = path.join(tempDir, 'copy-modify');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Set workspace patterns
            const workspaceSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['copy-*.js', 'inherit/**']
            };
            await service.saveWorkspaceSettings(tempDir, workspaceSettings);

            // Initially, test directory has no local patterns
            let inheritanceInfo = await service.getSettingsWithInheritance(testDir);
            expect(inheritanceInfo.currentSettings?.['codeCounter.excludePatterns']).to.be.undefined;
            expect(inheritanceInfo.resolvedSettings['codeCounter.excludePatterns']).to.deep.equal(['copy-*.js', 'inherit/**']);

            // Simulate adding a pattern (copy-then-modify)
            const currentPatterns = inheritanceInfo.resolvedSettings['codeCounter.excludePatterns'] || [];
            const updatedPatterns = [...currentPatterns, '*.new'];
            
            const updatedSettings: WorkspaceSettings = {
                ...inheritanceInfo.currentSettings,
                'codeCounter.excludePatterns': updatedPatterns
            };
            await service.saveWorkspaceSettings(testDir, updatedSettings);

            // Now should have local patterns with all inherited + new pattern
            inheritanceInfo = await service.getSettingsWithInheritance(testDir);
            expect(inheritanceInfo.currentSettings?.['codeCounter.excludePatterns']).to.deep.equal(['copy-*.js', 'inherit/**', '*.new']);
            expect(inheritanceInfo.resolvedSettings['codeCounter.excludePatterns']).to.deep.equal(['copy-*.js', 'inherit/**', '*.new']);
        });

        test('should copy all patterns when removing inherited patterns', async () => {
            const testDir = path.join(tempDir, 'copy-remove');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Set workspace patterns
            const workspaceSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['*.log', '*.tmp', 'workspace/**', 'remove-me/**']
            };
            await service.saveWorkspaceSettings(tempDir, workspaceSettings);

            // Initially, test directory has no local patterns
            let inheritanceInfo = await service.getSettingsWithInheritance(testDir);
            expect(inheritanceInfo.currentSettings?.['codeCounter.excludePatterns']).to.be.undefined;

            // Simulate removing a pattern (copy-then-modify)
            const currentPatterns = inheritanceInfo.resolvedSettings['codeCounter.excludePatterns'] || [];
            const filteredPatterns = currentPatterns.filter(p => p !== 'remove-me/**');
            
            const updatedSettings: WorkspaceSettings = {
                ...inheritanceInfo.currentSettings,
                'codeCounter.excludePatterns': filteredPatterns
            };
            await service.saveWorkspaceSettings(testDir, updatedSettings);

            // Now should have local patterns with the removed pattern excluded
            inheritanceInfo = await service.getSettingsWithInheritance(testDir);
            expect(inheritanceInfo.currentSettings?.['codeCounter.excludePatterns']).to.deep.equal(['*.log', '*.tmp', 'workspace/**']);
            expect(inheritanceInfo.currentSettings?.['codeCounter.excludePatterns']).to.not.include('remove-me/**');
        });
    });

    suite('Complex Inheritance Scenarios', () => {
        test.skip('should handle deep directory nesting with mixed pattern definitions', async () => {
            // Create deep structure: workspace -> a -> b -> c -> d -> e
            const aDir = path.join(tempDir, 'a');
            const bDir = path.join(aDir, 'b');
            const cDir = path.join(bDir, 'c');
            const dDir = path.join(cDir, 'd');
            const eDir = path.join(dDir, 'e');
            
            await fs.promises.mkdir(aDir, { recursive: true });
            await fs.promises.mkdir(bDir, { recursive: true });
            await fs.promises.mkdir(cDir, { recursive: true });
            await fs.promises.mkdir(dDir, { recursive: true });
            await fs.promises.mkdir(eDir, { recursive: true });

            // Set patterns at different levels
            const workspaceSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['root-level/**']
            };
            await service.saveWorkspaceSettings(tempDir, workspaceSettings);

            const bSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['b-level/**'],
                'codeCounter.emojis.normal': '🅱️'
            };
            await service.saveWorkspaceSettings(bDir, bSettings);

            const dSettings: WorkspaceSettings = {
                'codeCounter.emojis.normal': '🇩',
                // No excludePatterns - should inherit from b
            };
            await service.saveWorkspaceSettings(dDir, dSettings);

            // Test inheritance at each level
            const aResolved = await service.getResolvedSettings(aDir);
            expect(aResolved['codeCounter.excludePatterns']).to.deep.equal(['root-level/**']);

            const bResolved = await service.getResolvedSettings(bDir);
            expect(bResolved['codeCounter.excludePatterns']).to.deep.equal(['b-level/**']);

            const cResolved = await service.getResolvedSettings(cDir);
            expect(cResolved['codeCounter.excludePatterns']).to.deep.equal(['b-level/**']);

            const dResolved = await service.getResolvedSettings(dDir);
            expect(dResolved['codeCounter.excludePatterns']).to.deep.equal(['b-level/**']); // Inherits from b (skips c)
            expect(dResolved['codeCounter.emojis.normal']).to.equal('🇩'); // Own setting

            const eResolved = await service.getResolvedSettings(eDir);
            expect(eResolved['codeCounter.excludePatterns']).to.deep.equal(['b-level/**']); // Inherits from b (skips c,d)
            expect(eResolved['codeCounter.emojis.normal']).to.equal('🇩'); // Inherits from d
        });

        test.skip('should handle pattern inheritance with reset operations', async () => {
            const testDir = path.join(tempDir, 'reset-test');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Set workspace patterns
            const workspaceSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['reset-*.log', 'workspace-reset/**']
            };
            await service.saveWorkspaceSettings(tempDir, workspaceSettings);

            // Set local patterns
            const localSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['local-*.spec.js', 'local-reset/**']
            };
            await service.saveWorkspaceSettings(testDir, localSettings);

            // Verify local patterns are active
            let resolved = await service.getResolvedSettings(testDir);
            expect(resolved['codeCounter.excludePatterns']).to.deep.equal(['local-*.spec.js', 'local-reset/**']);

            // Reset excludePatterns field
            await service.resetField(testDir, 'excludePatterns');

            // Should now inherit from workspace
            resolved = await service.getResolvedSettings(testDir);
            expect(resolved['codeCounter.excludePatterns']).to.deep.equal(['reset-*.log', 'workspace-reset/**']);

            // Verify current settings no longer has excludePatterns
            const inheritanceInfo = await service.getSettingsWithInheritance(testDir);
            expect(inheritanceInfo.currentSettings?.['codeCounter.excludePatterns']).to.be.undefined;
        });
    });
});