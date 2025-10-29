import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { WorkspaceDatabaseService, WorkspaceSettings } from '../../services/workspaceDatabaseService';

suite('Data Consistency Tests', () => {
    let tempDir: string;
    let service: WorkspaceDatabaseService;
    
    suiteSetup(async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'consistency-tests-'));
        service = new WorkspaceDatabaseService(tempDir);
    });
    
    suiteTeardown(async () => {
        await service.dispose();
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    suite('Data Consistency and Integrity', () => {
        test('should maintain data consistency after reset operations', async () => {
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

            // Verify initial state using getSettingsWithInheritance
            let inheritance = await service.getSettingsWithInheritance(testDir);
            expect(inheritance.resolvedSettings['codeCounter.excludePatterns']).to.include('local-*.js');
            expect(inheritance.resolvedSettings['codeCounter.emojis.normal']).to.equal('✅');

            // Reset excludePatterns only
            await service.resetField(testDir, 'excludePatterns');

            // Verify patterns are reset but other settings remain
            inheritance = await service.getSettingsWithInheritance(testDir);
            expect(inheritance.resolvedSettings['codeCounter.excludePatterns']).to.include('workspace-*.js');
            expect(inheritance.resolvedSettings['codeCounter.excludePatterns']).to.not.include('local-*.js');
            expect(inheritance.resolvedSettings['codeCounter.emojis.normal']).to.equal('✅'); // Should remain
            expect(inheritance.resolvedSettings['codeCounter.lineThresholds.midThreshold']).to.equal(150); // Should remain
        });

        test('should maintain consistent workspace data across operations', async () => {
            const testDir = path.join(tempDir, 'consistency-operations');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Initial state
            let inheritanceInfo = await service.getSettingsWithInheritance(testDir);
            let patternsWithSources = await service.getExcludePatternsWithSources(testDir);
            
            // Get initial pattern count (including VS Code defaults)
            const initialPatternCount = patternsWithSources.length;

            // Add pattern operation
            const currentPatterns = inheritanceInfo.resolvedSettings['codeCounter.excludePatterns'] || [];
            const updatedPatterns = [...currentPatterns, '*.consistency-test'];
            const updatedSettings: WorkspaceSettings = {
                ...inheritanceInfo.currentSettings,
                'codeCounter.excludePatterns': updatedPatterns
            };
            await service.saveWorkspaceSettings(testDir, updatedSettings);

            // Refresh and verify consistency
            const updatedInheritance = await service.getSettingsWithInheritance(testDir);
            const updatedPatternsWithSources = await service.getExcludePatternsWithSources(testDir);

            // Verify the new pattern was added to current settings
            expect(updatedInheritance.currentSettings['codeCounter.excludePatterns']).to.include('*.consistency-test');
            
            // Verify the new pattern appears in resolved settings
            expect(updatedInheritance.resolvedSettings['codeCounter.excludePatterns']).to.include('*.consistency-test');
            
            // Verify the new pattern appears in patterns with sources
            expect(updatedPatternsWithSources.some((p: any) => p.pattern === '*.consistency-test')).to.be.true;
            
            // Verify consistency: should have more patterns now
            expect(updatedPatternsWithSources.length).to.be.greaterThan(initialPatternCount);
        });
    });
});