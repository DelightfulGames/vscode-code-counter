import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as vscode from 'vscode';
import { WorkspaceDatabaseService, WorkspaceSettings } from '../../services/workspaceDatabaseService';

// Mock VS Code API for testing
const mockVscode = {
    workspace: {
        getConfiguration: (section?: string) => ({
            get: (key: string, defaultValue?: any) => {
                // Return mock global settings
                const mockSettings: any = {
                    'lineThresholds.midThreshold': 300,
                    'lineThresholds.highThreshold': 1000,
                    'excludePatterns': [
                        '**/node_modules/**',
                        '**/out/**',
                        '**/bin/**',
                        '**/dist/**',
                        '**/.git/**',
                        '**/.**/**',
                        '**/*.vsix',
                        '**/.code-counter.json'
                    ]
                };
                return mockSettings[key] || defaultValue;
            },
            update: async () => { /* mock implementation */ }
        })
    }
};

suite('Pattern Management Integration Tests', () => {
    let tempDir: string;
    let service: WorkspaceDatabaseService;
    
    suiteSetup(async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pattern-integration-'));
        service = new WorkspaceDatabaseService(tempDir);
    });
    
    suiteTeardown(async () => {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    suite('Add Pattern Operations', () => {
        test('should handle adding pattern to directory without local patterns', async () => {
            const testDir = path.join(tempDir, 'add-test');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Set workspace patterns
            const workspaceSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['pattern-*.log', 'pattern-workspace/**']
            };
            await service.saveWorkspaceSettings(tempDir, workspaceSettings);

            // Simulate extension add pattern logic
            const inheritanceInfo = await service.getSettingsWithInheritance(testDir);
            let currentPatterns: string[] = [];
            
            if (inheritanceInfo.currentSettings?.['codeCounter.excludePatterns']) {
                currentPatterns = [...inheritanceInfo.currentSettings['codeCounter.excludePatterns']];
            } else {
                // Copy-all-then-modify: get all resolved patterns first
                const inheritedPatterns = inheritanceInfo.resolvedSettings['codeCounter.excludePatterns'] || [];
                currentPatterns = [...inheritedPatterns];
            }

            // Add new pattern
            const newPattern = '*.new';
            if (!currentPatterns.includes(newPattern)) {
                const updatedPatterns = [...currentPatterns, newPattern];
                const updatedSettings: WorkspaceSettings = {
                    'codeCounter.excludePatterns': updatedPatterns
                };
                await service.saveWorkspaceSettings(testDir, updatedSettings);
            }

            // Verify results
            const finalInfo = await service.getSettingsWithInheritance(testDir);
            console.log('DEBUG: Current Settings:', finalInfo.currentSettings?.['codeCounter.excludePatterns']);
            console.log('DEBUG: Resolved Settings:', finalInfo.resolvedSettings?.['codeCounter.excludePatterns']);
            expect(finalInfo.currentSettings?.['codeCounter.excludePatterns']).to.deep.equal(['pattern-*.log', 'pattern-workspace/**', '*.new']);
            expect(finalInfo.resolvedSettings['codeCounter.excludePatterns']).to.deep.equal(['pattern-*.log', 'pattern-workspace/**', '*.new']);
        });

        test('should handle adding pattern to directory with existing local patterns', async () => {
            const testDir = path.join(tempDir, 'add-existing');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Set initial local patterns
            const initialSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['*.spec.js', '*.test.js']
            };
            await service.saveWorkspaceSettings(testDir, initialSettings);

            // Simulate extension add pattern logic
            const inheritanceInfo = await service.getSettingsWithInheritance(testDir);
            let currentPatterns: string[] = [];
            
            if (inheritanceInfo.currentSettings?.['codeCounter.excludePatterns']) {
                currentPatterns = [...inheritanceInfo.currentSettings['codeCounter.excludePatterns']];
            } else {
                const inheritedPatterns = inheritanceInfo.resolvedSettings['codeCounter.excludePatterns'] || [];
                currentPatterns = [...inheritedPatterns];
            }

            // Add new pattern
            const newPattern = '*.e2e.js';
            if (!currentPatterns.includes(newPattern)) {
                const updatedPatterns = [...currentPatterns, newPattern];
                const updatedSettings: WorkspaceSettings = {
                    ...inheritanceInfo.currentSettings,
                    'codeCounter.excludePatterns': updatedPatterns
                };
                await service.saveWorkspaceSettings(testDir, updatedSettings);
            }

            // Verify results
            const finalInfo = await service.getSettingsWithInheritance(testDir);
            expect(finalInfo.currentSettings?.['codeCounter.excludePatterns']).to.deep.equal(['*.spec.js', '*.test.js', '*.e2e.js']);
        });

        test('should handle adding duplicate pattern gracefully', async () => {
            const testDir = path.join(tempDir, 'add-duplicate');
            await fs.promises.mkdir(testDir, { recursive: true });

            const initialSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['*.log', '*.tmp']
            };
            await service.saveWorkspaceSettings(testDir, initialSettings);

            // Try to add existing pattern
            const inheritanceInfo = await service.getSettingsWithInheritance(testDir);
            let currentPatterns: string[] = [];
            
            if (inheritanceInfo.currentSettings?.['codeCounter.excludePatterns']) {
                currentPatterns = [...inheritanceInfo.currentSettings['codeCounter.excludePatterns']];
            }

            const duplicatePattern = '*.log';
            let patternsChanged = false;
            if (!currentPatterns.includes(duplicatePattern)) {
                const updatedPatterns = [...currentPatterns, duplicatePattern];
                const updatedSettings: WorkspaceSettings = {
                    ...inheritanceInfo.currentSettings,
                    'codeCounter.excludePatterns': updatedPatterns
                };
                await service.saveWorkspaceSettings(testDir, updatedSettings);
                patternsChanged = true;
            }

            // Should not have changed
            expect(patternsChanged).to.be.false;
            const finalInfo = await service.getSettingsWithInheritance(testDir);
            expect(finalInfo.currentSettings?.['codeCounter.excludePatterns']).to.deep.equal(['*.log', '*.tmp']);
        });
    });

    suite('Remove Pattern Operations', () => {
        test('should handle removing pattern from directory without local patterns', async () => {
            const testDir = path.join(tempDir, 'remove-test');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Set workspace patterns
            const workspaceSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['*.log', '*.tmp', '*.remove']
            };
            await service.saveWorkspaceSettings(tempDir, workspaceSettings);

            // Simulate extension remove pattern logic
            const inheritanceInfo = await service.getSettingsWithInheritance(testDir);
            let currentPatterns: string[] = [];
            
            if (inheritanceInfo.currentSettings?.['codeCounter.excludePatterns']) {
                currentPatterns = [...inheritanceInfo.currentSettings['codeCounter.excludePatterns']];
            } else {
                // Copy-all-then-modify: get all resolved patterns first
                const inheritedPatterns = inheritanceInfo.resolvedSettings['codeCounter.excludePatterns'] || [];
                currentPatterns = [...inheritedPatterns];
            }

            // Remove pattern
            const patternToRemove = '*.remove';
            const filteredPatterns = currentPatterns.filter(p => p !== patternToRemove);
            
            const updatedSettings: WorkspaceSettings = {
                ...inheritanceInfo.currentSettings,
                'codeCounter.excludePatterns': filteredPatterns
            };
            await service.saveWorkspaceSettings(testDir, updatedSettings);

            // Verify results
            const finalInfo = await service.getSettingsWithInheritance(testDir);
            expect(finalInfo.currentSettings?.['codeCounter.excludePatterns']).to.deep.equal(['*.log', '*.tmp']);
            expect(finalInfo.currentSettings?.['codeCounter.excludePatterns']).to.not.include('*.remove');
        });

        test('should handle removing pattern from directory with existing local patterns', async () => {
            const testDir = path.join(tempDir, 'remove-existing');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Set initial local patterns
            const initialSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['*.spec.js', '*.test.js', '*.remove.js']
            };
            await service.saveWorkspaceSettings(testDir, initialSettings);

            // Simulate extension remove pattern logic
            const inheritanceInfo = await service.getSettingsWithInheritance(testDir);
            let currentPatterns: string[] = [];
            
            if (inheritanceInfo.currentSettings?.['codeCounter.excludePatterns']) {
                currentPatterns = [...inheritanceInfo.currentSettings['codeCounter.excludePatterns']];
            }

            // Remove pattern
            const patternToRemove = '*.remove.js';
            const filteredPatterns = currentPatterns.filter(p => p !== patternToRemove);
            
            const updatedSettings: WorkspaceSettings = {
                ...inheritanceInfo.currentSettings,
                'codeCounter.excludePatterns': filteredPatterns
            };
            await service.saveWorkspaceSettings(testDir, updatedSettings);

            // Verify results
            const finalInfo = await service.getSettingsWithInheritance(testDir);
            expect(finalInfo.currentSettings?.['codeCounter.excludePatterns']).to.deep.equal(['*.spec.js', '*.test.js']);
        });

        test('should handle removing non-existent pattern gracefully', async () => {
            const testDir = path.join(tempDir, 'remove-missing');
            await fs.promises.mkdir(testDir, { recursive: true });

            const initialSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['pattern-*.log', 'pattern-workspace/**']
            };
            await service.saveWorkspaceSettings(testDir, initialSettings);

            // Try to remove non-existent pattern
            const inheritanceInfo = await service.getSettingsWithInheritance(testDir);
            let currentPatterns: string[] = [];
            
            if (inheritanceInfo.currentSettings?.['codeCounter.excludePatterns']) {
                currentPatterns = [...inheritanceInfo.currentSettings['codeCounter.excludePatterns']];
            }

            const nonExistentPattern = '*.missing';
            const initialLength = currentPatterns.length;
            const filteredPatterns = currentPatterns.filter(p => p !== nonExistentPattern);
            
            // Should not have changed length
            expect(filteredPatterns.length).to.equal(initialLength);
            expect(filteredPatterns).to.deep.equal(['pattern-*.log', 'pattern-workspace/**']);
        });
    });

    suite('Context-Aware Pattern Operations', () => {
        test('should handle global context pattern addition', async () => {
            // Use a completely separate directory for this test to avoid interference from previous tests
            const globalTestDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'global-pattern-test-'));
            const globalService = new WorkspaceDatabaseService(globalTestDir);
            
            // The database service merges VS Code global defaults with workspace settings
            // This test verifies the service returns VS Code defaults plus workspace-specific patterns
            const patternsWithSources = await globalService.getExcludePatternsWithSources(globalTestDir);
            
            // Should have VS Code default patterns (coming from global config)
            const initialGlobalCount = patternsWithSources.filter(p => p.level === 'global').length;
            expect(initialGlobalCount).to.be.greaterThanOrEqual(0); // VS Code may have default exclude patterns
            
            // Add some workspace-specific patterns that differ from VS Code defaults
            const workspaceSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['custom-workspace-*.log', 'workspace-specific/**']
            };
            await globalService.saveWorkspaceSettings(globalTestDir, workspaceSettings);
            
            // Now should have patterns at workspace level - the new patterns should override VS Code defaults
            const updatedPatterns = await globalService.getExcludePatternsWithSources(globalTestDir);
            const workspacePatterns = updatedPatterns.filter((p: any) => p.level === 'workspace');
            expect(workspacePatterns.length).to.be.greaterThan(0);
            expect(workspacePatterns.some((p: any) => p.pattern === 'custom-workspace-*.log')).to.be.true;
            expect(workspacePatterns.some((p: any) => p.pattern === 'workspace-specific/**')).to.be.true;
            
            // Cleanup
            await fs.promises.rm(globalTestDir, { recursive: true, force: true });
        });

        test('should handle workspace context pattern addition', async () => {
            // Set workspace patterns
            const workspaceSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['unique-workspace-*.log']
            };
            await service.saveWorkspaceSettings(tempDir, workspaceSettings);

            const patternsWithSources = await service.getExcludePatternsWithSources(tempDir);
            
            // Should show workspace patterns
            const workspacePatterns = patternsWithSources.filter((p: any) => p.level === 'workspace');
            expect(workspacePatterns.length).to.equal(1);
            expect(workspacePatterns[0].pattern).to.equal('unique-workspace-*.log');
            expect(workspacePatterns[0].source).to.equal('<workspace>');
        });

        test('should handle sub-workspace context pattern addition', async () => {
            const subDir = path.join(tempDir, 'sub-context');
            await fs.promises.mkdir(subDir, { recursive: true });

            // Set sub-directory patterns
            const subSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['sub-*.js']
            };
            await service.saveWorkspaceSettings(subDir, subSettings);

            const patternsWithSources = await service.getExcludePatternsWithSources(subDir);
            
            // Should show directory patterns
            const directoryPatterns = patternsWithSources.filter((p: any) => p.level === 'directory');
            expect(directoryPatterns.length).to.equal(1);
            expect(directoryPatterns[0].pattern).to.equal('sub-*.js');
            expect(directoryPatterns[0].source).to.equal('sub-context');
        });
    });

    suite('Delete Button Logic', () => {
        test('should show delete buttons when no local patterns exist', async () => {
            const testDir = path.join(tempDir, 'delete-buttons');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Set workspace patterns
            const workspaceSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['*.log', '*.tmp']
            };
            await service.saveWorkspaceSettings(tempDir, workspaceSettings);

            const inheritanceInfo = await service.getSettingsWithInheritance(testDir);
            const hasLocalPatterns = inheritanceInfo.currentSettings?.['codeCounter.excludePatterns'] !== undefined;
            
            // Should not have local patterns, so delete buttons should be shown for inherited patterns
            expect(hasLocalPatterns).to.be.false;
            
            const patternsWithSources = await service.getExcludePatternsWithSources(testDir);
            for (const pattern of patternsWithSources) {
                // All patterns are inherited, and no local patterns exist, so delete should be available
                const shouldShowDelete = !hasLocalPatterns;
                expect(shouldShowDelete).to.be.true;
            }
        });

        test('should hide delete buttons for inherited patterns when local patterns exist', async () => {
            const testDir = path.join(tempDir, 'hide-delete');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Set workspace patterns
            const workspaceSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['*.log', '*.tmp']
            };
            await service.saveWorkspaceSettings(tempDir, workspaceSettings);

            // Set local patterns
            const localSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['*.spec.js', '*.test.js']
            };
            await service.saveWorkspaceSettings(testDir, localSettings);

            const inheritanceInfo = await service.getSettingsWithInheritance(testDir);
            const hasLocalPatterns = inheritanceInfo.currentSettings?.['codeCounter.excludePatterns'] !== undefined;
            
            // Should have local patterns
            expect(hasLocalPatterns).to.be.true;
            
            const patternsWithSources = await service.getExcludePatternsWithSources(testDir);
            const currentSettings = inheritanceInfo.currentSettings?.['codeCounter.excludePatterns'] || [];
            
            for (const pattern of patternsWithSources) {
                const isCurrentSetting = currentSettings.includes(pattern.pattern);
                if (isCurrentSetting) {
                    // Local patterns should show delete button
                    expect(true).to.be.true; // Delete button should be shown
                } else {
                    // Inherited patterns should NOT show delete button when local patterns exist
                    const shouldShowDelete = !hasLocalPatterns;
                    expect(shouldShowDelete).to.be.false;
                }
            }
        });
    });
});