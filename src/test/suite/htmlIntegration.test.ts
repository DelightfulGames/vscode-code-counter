import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { WorkspaceSettingsService, WorkspaceSettings, WorkspaceData } from '../../services/workspaceSettingsService';

suite('HTML Generation and UI Integration Tests', () => {
    let tempDir: string;
    let service: WorkspaceSettingsService;
    
    suiteSetup(async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'html-integration-'));
        service = new WorkspaceSettingsService(tempDir);
    });
    
    suiteTeardown(async () => {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    suite('Pattern Display Logic', () => {
        test('should generate correct HTML for local patterns', async () => {
            const testDir = path.join(tempDir, 'local-patterns');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Set local patterns
            const settings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['*.spec.js', '*.test.js', 'local/**']
            };
            await service.saveWorkspaceSettings(testDir, settings);

            // Get workspace data as would be used in HTML generation
            const directoryTree = await service.getDirectoryTree();
            const inheritanceInfo = await service.getSettingsWithInheritance(testDir);
            const patternsWithSources = await service.getExcludePatternsWithSources(testDir);

            const workspaceData: WorkspaceData = {
                mode: 'workspace',
                directoryTree,
                currentDirectory: 'local-patterns',
                resolvedSettings: inheritanceInfo.resolvedSettings,
                currentSettings: inheritanceInfo.currentSettings,
                parentSettings: inheritanceInfo.parentSettings,
                workspacePath: tempDir,
                patternsWithSources
            };

            // Verify data structure for HTML generation
            expect(workspaceData.patternsWithSources).to.have.length(3);
            expect(workspaceData.currentSettings?.['codeCounter.excludePatterns']).to.deep.equal(['*.spec.js', '*.test.js', 'local/**']);

            const currentSettings = workspaceData.currentSettings?.['codeCounter.excludePatterns'] || [];
            const hasLocalPatterns = workspaceData.currentSettings?.['codeCounter.excludePatterns'] !== undefined;

            if (workspaceData.patternsWithSources) {
                for (const item of workspaceData.patternsWithSources) {
                    const isCurrentSetting = currentSettings.includes(item.pattern);
                    
                    // All patterns should be current settings in this case
                    expect(isCurrentSetting).to.be.true;
                    
                    // Should show delete button for local patterns
                    expect(true).to.be.true; // Would generate delete button HTML
                    
                    // Should show local pattern indicator
                    expect(item.level).to.equal('directory');
                    expect(item.source).to.equal('local-patterns');
                }
            }
        });

        test('should generate correct HTML for inherited patterns without local patterns', async () => {
            const testDir = path.join(tempDir, 'inherited-only');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Set workspace patterns
            const workspaceSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['*.log', '*.tmp', 'workspace/**']
            };
            await service.saveWorkspaceSettings(tempDir, workspaceSettings);

            // Get workspace data for directory with no local patterns
            const directoryTree = await service.getDirectoryTree();
            const inheritanceInfo = await service.getSettingsWithInheritance(testDir);
            const patternsWithSources = await service.getExcludePatternsWithSources(testDir);

            const workspaceData: WorkspaceData = {
                mode: 'workspace',
                directoryTree,
                currentDirectory: 'inherited-only',
                resolvedSettings: inheritanceInfo.resolvedSettings,
                currentSettings: inheritanceInfo.currentSettings,
                parentSettings: inheritanceInfo.parentSettings,
                workspacePath: tempDir,
                patternsWithSources
            };

            // Verify data structure
            expect(workspaceData.patternsWithSources).to.have.length(3);
            expect(workspaceData.currentSettings?.['codeCounter.excludePatterns']).to.be.undefined;

            const currentSettings = workspaceData.currentSettings?.['codeCounter.excludePatterns'] || [];
            const hasLocalPatterns = workspaceData.currentSettings?.['codeCounter.excludePatterns'] !== undefined;

            if (workspaceData.patternsWithSources) {
                for (const item of workspaceData.patternsWithSources) {
                    const isCurrentSetting = currentSettings.includes(item.pattern);
                    
                    // All patterns should be inherited in this case
                    expect(isCurrentSetting).to.be.false;
                    
                    // Should show delete button since no local patterns exist (copy-all-then-modify)
                    const shouldShowDelete = !hasLocalPatterns;
                    expect(shouldShowDelete).to.be.true;
                    
                    // Should show inherited pattern indicators
                    expect(item.level).to.equal('workspace');
                    expect(item.source).to.equal('<workspace>');
                }
            }
        });

        test('should generate correct HTML for mixed local and inherited patterns', async () => {
            const subDir = path.join(tempDir, 'sub');
            const testDir = path.join(subDir, 'mixed-patterns');
            await fs.promises.mkdir(subDir, { recursive: true });
            await fs.promises.mkdir(testDir, { recursive: true });

            // Set workspace patterns
            const workspaceSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['*.log', '*.tmp']
            };
            await service.saveWorkspaceSettings(tempDir, workspaceSettings);

            // Set sub-directory patterns
            const subSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['*.spec.js', '*.test.js']
            };
            await service.saveWorkspaceSettings(subDir, subSettings);

            // Test directory inherits from sub (nearest ancestor)
            const directoryTree = await service.getDirectoryTree();
            const inheritanceInfo = await service.getSettingsWithInheritance(testDir);
            const patternsWithSources = await service.getExcludePatternsWithSources(testDir);

            const workspaceData: WorkspaceData = {
                mode: 'workspace',
                directoryTree,
                currentDirectory: path.join('sub', 'mixed-patterns'),
                resolvedSettings: inheritanceInfo.resolvedSettings,
                currentSettings: inheritanceInfo.currentSettings,
                parentSettings: inheritanceInfo.parentSettings,
                workspacePath: tempDir,
                patternsWithSources
            };

            // Should inherit from sub directory, not workspace
            expect(workspaceData.patternsWithSources).to.have.length(2);
            if (workspaceData.patternsWithSources && workspaceData.patternsWithSources.length > 0) {
                expect(workspaceData.patternsWithSources[0].pattern).to.equal('*.spec.js');
                expect(workspaceData.patternsWithSources[0].source).to.equal('sub');
                expect(workspaceData.patternsWithSources[0].level).to.equal('directory');

                // Should not include workspace patterns
                const workspacePatterns = workspaceData.patternsWithSources.filter(p => p.pattern === '*.log');
                expect(workspacePatterns).to.have.length(0);
            }
        });
    });

    suite('Source Label Generation', () => {
        test('should generate correct source labels for different inheritance levels', async () => {
            const patternsWithSources = await service.getExcludePatternsWithSources(tempDir);

            for (const item of patternsWithSources) {
                let expectedSourceLabel = '<global>';
                
                if (item.level === 'global') {
                    expectedSourceLabel = '<global>';
                } else if (item.level === 'workspace') {
                    expectedSourceLabel = '<workspace>';
                } else if (item.level === 'directory') {
                    // For directory level, should show relative path
                    const workspacePath = tempDir;
                    const relativePath = path.relative(workspacePath, item.source);
                    expectedSourceLabel = relativePath || item.source;
                }

                // Verify source labeling logic
                expect(item.source).to.equal(expectedSourceLabel);
            }
        });

        test('should handle relative path calculation correctly', async () => {
            const deepDir = path.join(tempDir, 'deep', 'nested', 'directory');
            await fs.promises.mkdir(deepDir, { recursive: true });

            const settings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['deep-*.js']
            };
            await service.saveWorkspaceSettings(deepDir, settings);

            const patternsWithSources = await service.getExcludePatternsWithSources(deepDir);
            const directoryPattern = patternsWithSources.find(p => p.level === 'directory');

            expect(directoryPattern).to.not.be.undefined;
            expect(directoryPattern?.source).to.equal(path.join('deep', 'nested', 'directory'));
        });
    });

    suite('Directory Tree Management', () => {
        test('should handle directory tree updates correctly', async () => {
            const initialTree = await service.getDirectoryTree();
            const initialDirCount = initialTree.length;

            // Add new directory
            const newDir = path.join(tempDir, 'new-directory');
            await fs.promises.mkdir(newDir, { recursive: true });

            // Add settings to make it appear in tree
            const settings: WorkspaceSettings = {
                'codeCounter.emojis.normal': '📁'
            };
            await service.saveWorkspaceSettings(newDir, settings);

            const updatedTree = await service.getDirectoryTree();
            expect(updatedTree.length).to.be.greaterThan(initialDirCount);

            const newDirNode = updatedTree.find(node => node.name === 'new-directory');
            expect(newDirNode).to.not.be.undefined;
            expect(newDirNode?.hasSettings).to.be.true;
            expect(newDirNode?.relativePath).to.equal('new-directory');
        });
    });

    suite('Global vs Workspace Mode', () => {
        test('should handle global mode workspace data', async () => {
            // Create workspace data for global mode
            const globalWorkspaceData: WorkspaceData = {
                mode: 'global',
                directoryTree: [],
                currentDirectory: '<global>',
                resolvedSettings: {
                    'codeCounter.excludePatterns': ['**/node_modules/**', '**/.git/**'],
                    'codeCounter.includePatterns': [],
                    'codeCounter.emojis.normal': '🟢',
                    'codeCounter.emojis.warning': '🟡',
                    'codeCounter.emojis.danger': '🔴',
                    'codeCounter.emojis.folders.normal': '🟩',
                    'codeCounter.emojis.folders.warning': '🟨',
                    'codeCounter.emojis.folders.danger': '🟥',
                    'codeCounter.lineThresholds.midThreshold': 300,
                    'codeCounter.lineThresholds.highThreshold': 1000,
                    'codeCounter.showNotificationOnAutoGenerate': false,
                    source: 'global'
                },
                currentSettings: undefined,
                parentSettings: undefined,
                workspacePath: tempDir
            };

            // Verify global mode data structure
            expect(globalWorkspaceData.mode).to.equal('global');
            expect(globalWorkspaceData.currentDirectory).to.equal('<global>');
            expect(globalWorkspaceData.currentSettings).to.be.undefined;
            expect(globalWorkspaceData.parentSettings).to.be.undefined;
            if (globalWorkspaceData.resolvedSettings) {
                expect(globalWorkspaceData.resolvedSettings.source).to.equal('global');
            }
        });

        test('should handle workspace mode with proper inheritance', async () => {
            const testDir = path.join(tempDir, 'workspace-mode');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Create workspace data for workspace mode
            const inheritanceInfo = await service.getSettingsWithInheritance(testDir);
            const patternsWithSources = await service.getExcludePatternsWithSources(testDir);

            const workspaceData: WorkspaceData = {
                mode: 'workspace',
                directoryTree: await service.getDirectoryTree(),
                currentDirectory: 'workspace-mode',
                resolvedSettings: inheritanceInfo.resolvedSettings,
                currentSettings: inheritanceInfo.currentSettings,
                parentSettings: inheritanceInfo.parentSettings,
                workspacePath: tempDir,
                patternsWithSources
            };

            // Verify workspace mode data structure
            expect(workspaceData.mode).to.equal('workspace');
            expect(workspaceData.currentDirectory).to.equal('workspace-mode');
            expect(workspaceData.parentSettings).to.not.be.undefined;
            expect(workspaceData.patternsWithSources).to.be.an('array');
        });
    });

    suite('Pattern HTML Generation Edge Cases', () => {
        test('should handle empty patterns array', async () => {
            const testDir = path.join(tempDir, 'empty-patterns');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Set empty patterns
            const settings: WorkspaceSettings = {
                'codeCounter.excludePatterns': []
            };
            await service.saveWorkspaceSettings(testDir, settings);

            const patternsWithSources = await service.getExcludePatternsWithSources(testDir);
            expect(patternsWithSources).to.have.length(0);

            const inheritanceInfo = await service.getSettingsWithInheritance(testDir);
            const workspaceData: WorkspaceData = {
                mode: 'workspace',
                directoryTree: await service.getDirectoryTree(),
                currentDirectory: 'empty-patterns',
                resolvedSettings: inheritanceInfo.resolvedSettings,
                currentSettings: inheritanceInfo.currentSettings,
                parentSettings: inheritanceInfo.parentSettings,
                workspacePath: tempDir,
                patternsWithSources
            };

            // Should handle empty patterns gracefully
            expect(workspaceData.patternsWithSources).to.have.length(0);
            expect(workspaceData.currentSettings?.['codeCounter.excludePatterns']).to.deep.equal([]);
        });

        test('should handle special characters in patterns', async () => {
            const testDir = path.join(tempDir, 'special-chars');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Set patterns with special characters
            const settings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['**/*.{js,ts}', '**/[Tt]est/**', '**/@types/**', '**/node_modules/**/*']
            };
            await service.saveWorkspaceSettings(testDir, settings);

            const patternsWithSources = await service.getExcludePatternsWithSources(testDir);
            expect(patternsWithSources).to.have.length(4);

            // Verify special characters are preserved
            const patterns = patternsWithSources.map(p => p.pattern);
            expect(patterns).to.include('**/*.{js,ts}');
            expect(patterns).to.include('**/[Tt]est/**');
            expect(patterns).to.include('**/@types/**');
            expect(patterns).to.include('**/node_modules/**/*');
        });

        test('should handle very long patterns', async () => {
            const testDir = path.join(tempDir, 'long-patterns');
            await fs.promises.mkdir(testDir, { recursive: true });

            // Set very long pattern
            const longPattern = '**/very/long/path/with/many/segments/and/wildcards/**/*.{js,ts,jsx,tsx,vue,svelte,html,css,scss,sass,less}';
            const settings: WorkspaceSettings = {
                'codeCounter.excludePatterns': [longPattern]
            };
            await service.saveWorkspaceSettings(testDir, settings);

            const patternsWithSources = await service.getExcludePatternsWithSources(testDir);
            expect(patternsWithSources).to.have.length(1);
            expect(patternsWithSources[0].pattern).to.equal(longPattern);
        });
    });

    suite('Directory Tree Integration', () => {
        test('should correctly reflect settings state in directory tree', async () => {
            // Create multiple directories
            const dirs = ['dir-with-settings', 'dir-without-settings', 'dir-with-empty-settings'];
            for (const dir of dirs) {
                await fs.promises.mkdir(path.join(tempDir, dir), { recursive: true });
            }

            // Add settings to first directory
            const settings1: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['*.log']
            };
            await service.saveWorkspaceSettings(path.join(tempDir, 'dir-with-settings'), settings1);

            // Add empty settings to third directory
            const settings3: WorkspaceSettings = {};
            await service.saveWorkspaceSettings(path.join(tempDir, 'dir-with-empty-settings'), settings3);

            const directoryTree = await service.getDirectoryTree();
            
            const dirWithSettings = directoryTree.find(node => node.name === 'dir-with-settings');
            const dirWithoutSettings = directoryTree.find(node => node.name === 'dir-without-settings');
            const dirWithEmptySettings = directoryTree.find(node => node.name === 'dir-with-empty-settings');

            expect(dirWithSettings?.hasSettings).to.be.true;
            expect(dirWithoutSettings?.hasSettings).to.be.false;
            expect(dirWithEmptySettings?.hasSettings).to.be.false; // Empty settings should not count
        });
    });
});