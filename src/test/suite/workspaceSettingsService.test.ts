import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { WorkspaceSettingsService, WorkspaceSettings, ResolvedSettings } from '../../services/workspaceSettingsService';

suite('WorkspaceSettingsService Tests', () => {
    let tempDir: string;
    let service: WorkspaceSettingsService;
    
    suiteSetup(async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'workspace-settings-test-'));
        service = new WorkspaceSettingsService(tempDir);
    });
    
    suiteTeardown(async () => {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    test('should initialize with empty workspace', async () => {
        const directoryTree = await service.getDirectoryTree();
        expect(directoryTree).to.be.an('array');
        expect(directoryTree).to.have.length(0);
    });

    test('should create workspace settings file', async () => {
        const settings: WorkspaceSettings = {
            'codeCounter.lineThresholds.midThreshold': 100,
            'codeCounter.lineThresholds.highThreshold': 200,
            'codeCounter.emojis.normal': '🟢',
            'codeCounter.emojis.warning': '🟡',
            'codeCounter.emojis.danger': '🔴'
        };

        await service.saveWorkspaceSettings(tempDir, settings);

        const settingsPath = path.join(tempDir, '.code-counter.json');
        const exists = await fs.promises.access(settingsPath).then(() => true).catch(() => false);
        expect(exists).to.be.true;

        const savedContent = await fs.promises.readFile(settingsPath, 'utf-8');
        const savedSettings = JSON.parse(savedContent);
        expect(savedSettings['codeCounter.lineThresholds.midThreshold']).to.equal(100);
        expect(savedSettings['codeCounter.lineThresholds.highThreshold']).to.equal(200);
        expect(savedSettings['codeCounter.emojis.normal']).to.equal('🟢');
    });

    test('should read workspace settings through resolved settings', async () => {
        const resolved = await service.getResolvedSettings(tempDir);
        expect(resolved).to.not.be.null;
        expect(resolved['codeCounter.lineThresholds.midThreshold']).to.equal(100);
        expect(resolved['codeCounter.lineThresholds.highThreshold']).to.equal(200);
        expect(resolved['codeCounter.emojis.normal']).to.equal('🟢');
        expect(resolved.source).to.not.equal('global'); // Should be workspace-specific
    });

    test('should resolve settings with defaults when no workspace settings exist', async () => {
        // Create a completely separate workspace for this test
        const emptyWorkspace = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'empty-workspace-test-'));
        const emptyService = new WorkspaceSettingsService(emptyWorkspace);
        
        const emptyDir = path.join(emptyWorkspace, 'empty');
        await fs.promises.mkdir(emptyDir, { recursive: true });

        try {
            const resolved = await emptyService.getResolvedSettings(emptyDir);
            expect(resolved).to.not.be.null;
            expect(resolved['codeCounter.lineThresholds.midThreshold']).to.be.a('number');
            expect(resolved['codeCounter.lineThresholds.highThreshold']).to.be.a('number');
            expect(resolved['codeCounter.emojis.normal']).to.be.a('string');
            expect(resolved.source).to.equal('global');
        } finally {
            await fs.promises.rm(emptyWorkspace, { recursive: true, force: true });
        }
    });

    test('should resolve settings with workspace inheritance', async () => {
        // Create subdirectory
        const subDir = path.join(tempDir, 'src');
        await fs.promises.mkdir(subDir, { recursive: true });

        // Create subdirectory settings that override some values
        const subSettings: WorkspaceSettings = {
            'codeCounter.lineThresholds.midThreshold': 50, // Override warning threshold
            // danger inherited from parent
            'codeCounter.emojis.normal': '✅' // Override normal emoji
            // warning and danger inherited from parent
        };

        await service.saveWorkspaceSettings(subDir, subSettings);

        const resolved = await service.getResolvedSettings(subDir);
        expect(resolved['codeCounter.lineThresholds.midThreshold']).to.equal(50); // Overridden
        expect(resolved['codeCounter.lineThresholds.highThreshold']).to.equal(200); // Inherited from workspace
        expect(resolved['codeCounter.emojis.normal']).to.equal('✅'); // Overridden
        expect(resolved['codeCounter.emojis.warning']).to.equal('🟡'); // Inherited from workspace
        expect(resolved.source).to.equal('src');
    });

    test('should handle multiple inheritance levels', async () => {
        // Create nested directory structure
        const level1 = path.join(tempDir, 'src');
        const level2 = path.join(level1, 'components');
        const level3 = path.join(level2, 'ui');
        
        await fs.promises.mkdir(level3, { recursive: true });

        // Level 2 settings
        const level2Settings: WorkspaceSettings = {
            'codeCounter.lineThresholds.highThreshold': 150 // Override danger threshold
        };
        await service.saveWorkspaceSettings(level2, level2Settings);

        // Level 3 settings
        const level3Settings: WorkspaceSettings = {
            'codeCounter.emojis.danger': '💥' // Override danger emoji
        };
        await service.saveWorkspaceSettings(level3, level3Settings);

        const resolved = await service.getResolvedSettings(level3);
        expect(resolved['codeCounter.lineThresholds.midThreshold']).to.equal(50); // From level 1 (src)
        expect(resolved['codeCounter.lineThresholds.highThreshold']).to.equal(150); // From level 2 (components)
        expect(resolved['codeCounter.emojis.normal']).to.equal('✅'); // From level 1 (src)
        expect(resolved['codeCounter.emojis.warning']).to.equal('🟡'); // From workspace root
        expect(resolved['codeCounter.emojis.danger']).to.equal('💥'); // From level 3 (ui)
    });

    test('should build directory tree with settings indicators', async () => {
        const tree = await service.getDirectoryTree();
        expect(tree).to.be.an('array');
        
        // Find the src directory
        const srcNode = tree.find(node => node.name === 'src');
        expect(srcNode).to.not.be.undefined;
        expect(srcNode?.hasSettings).to.be.true;
        
        // Find the components directory
        const componentsNode = srcNode?.children.find(node => node.name === 'components');
        expect(componentsNode).to.not.be.undefined;
        expect(componentsNode?.hasSettings).to.be.true;
        
        // Find the ui directory
        const uiNode = componentsNode?.children.find(node => node.name === 'ui');
        expect(uiNode).to.not.be.undefined;
        expect(uiNode?.hasSettings).to.be.true;
    });

    test('should reset field to parent value', async () => {
        const subDir = path.join(tempDir, 'src');
        
        // Reset the warning threshold (should inherit from workspace root)
        await service.resetField(subDir, 'thresholds.mid');
        
        const resolved = await service.getResolvedSettings(subDir);
        expect(resolved['codeCounter.lineThresholds.midThreshold']).to.equal(100); // Back to workspace root value
    });

    test('should reset emoji field to parent value', async () => {
        const subDir = path.join(tempDir, 'src');
        
        // Reset the normal emoji (should inherit from workspace root)
        await service.resetField(subDir, 'badges.low');
        
        const resolved = await service.getResolvedSettings(subDir);
        expect(resolved['codeCounter.emojis.normal']).to.equal('🟢'); // Back to workspace root value
    });

    test('should delete settings file when all fields are reset', async () => {
        // Create a fresh subdirectory for this test to avoid interference
        const testDir = path.join(tempDir, 'reset-test');
        await fs.promises.mkdir(testDir, { recursive: true });
        
        // Create settings with just two fields
        const testSettings: WorkspaceSettings = {
            'codeCounter.lineThresholds.midThreshold': 75,
            'codeCounter.emojis.normal': '⚙️'
        };
        await service.saveWorkspaceSettings(testDir, testSettings);
        
        const settingsPath = path.join(testDir, '.code-counter.json');
        
        // Ensure file exists before reset
        let exists = await fs.promises.access(settingsPath).then(() => true).catch(() => false);
        expect(exists).to.be.true;
        
        // Reset both fields
        await service.resetField(testDir, 'thresholds.mid');
        await service.resetField(testDir, 'badges.low');
        
        // File should be deleted since it's now empty
        exists = await fs.promises.access(settingsPath).then(() => true).catch(() => false);
        expect(exists).to.be.false;
    });

    test('should handle invalid JSON gracefully', async () => {
        // Create a completely separate workspace for this test
        const invalidWorkspace = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'invalid-workspace-test-'));
        const invalidService = new WorkspaceSettingsService(invalidWorkspace);
        
        const invalidDir = path.join(invalidWorkspace, 'invalid');
        await fs.promises.mkdir(invalidDir, { recursive: true });
        
        const settingsPath = path.join(invalidDir, '.code-counter.json');
        await fs.promises.writeFile(settingsPath, '{ invalid json }');
        
        try {
            // Should fall back to global settings when JSON is invalid
            const resolved = await invalidService.getResolvedSettings(invalidDir);
            expect(resolved.source).to.equal('global');
        } finally {
            await fs.promises.rm(invalidWorkspace, { recursive: true, force: true });
        }
    });

    test('should clean empty settings objects', async () => {
        const cleanDir = path.join(tempDir, 'clean');
        await fs.promises.mkdir(cleanDir, { recursive: true });
        
        // Create settings with empty objects - this should result in no file being created
        const emptySettings: WorkspaceSettings = {
            // Empty settings object - no properties
        };
        
        await service.saveWorkspaceSettings(cleanDir, emptySettings);
        
        // File should not be created or should be deleted if empty
        const settingsPath = path.join(cleanDir, '.code-counter.json');
        const exists = await fs.promises.access(settingsPath).then(() => true).catch(() => false);
        expect(exists).to.be.false;
    });

    test('should handle permission errors gracefully', async () => {
        // This test is platform-specific and might not work on all systems
        // Skip on Windows as permission handling is different
        if (process.platform === 'win32') {
            return;
        }
        
        const restrictedDir = path.join(tempDir, 'restricted');
        await fs.promises.mkdir(restrictedDir, { recursive: true });
        
        // Make directory read-only
        await fs.promises.chmod(restrictedDir, 0o444);
        
        try {
            const settings: WorkspaceSettings = {
                'codeCounter.emojis.normal': '🔒'
            };
            
            // Should handle permission error gracefully
            let errorThrown = false;
            try {
                await service.saveWorkspaceSettings(restrictedDir, settings);
            } catch (error) {
                errorThrown = true;
            }
            expect(errorThrown).to.be.true;
        } finally {
            // Restore permissions for cleanup
            await fs.promises.chmod(restrictedDir, 0o755);
        }
    });

    test('should detect workspace settings existence correctly', async () => {
        const newDir = path.join(tempDir, 'newdir');
        await fs.promises.mkdir(newDir, { recursive: true });
        
        // Initially no settings
        expect(await service.hasSettings(newDir)).to.be.false;
        
        // Create settings
        const settings: WorkspaceSettings = {
            'codeCounter.emojis.normal': '📁'
        };
        await service.saveWorkspaceSettings(newDir, settings);
        
        // Now should have settings
        expect(await service.hasSettings(newDir)).to.be.true;
    });

    test('should handle relative path calculations correctly', async () => {
        const tree = await service.getDirectoryTree();
        
        // Check that relative paths are correct
        const srcNode = tree.find(node => node.name === 'src');
        expect(srcNode?.relativePath).to.equal('src');
        
        if (srcNode && srcNode.children && srcNode.children.length > 0) {
            const componentsNode = srcNode.children.find(node => node.name === 'components');
            expect(componentsNode?.relativePath).to.equal(path.join('src', 'components'));
        }
    });
});