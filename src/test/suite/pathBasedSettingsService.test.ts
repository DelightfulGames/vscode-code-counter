import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { PathBasedSettingsService } from '../../services/pathBasedSettingsService';
import { WorkspaceSettingsService, WorkspaceSettings } from '../../services/workspaceSettingsService';

suite('PathBasedSettingsService Tests', () => {
    let tempDir: string;
    let service: PathBasedSettingsService;
    let workspaceSettingsService: WorkspaceSettingsService;
    let vscodeMock: sinon.SinonSandbox;
    
    suiteSetup(async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'path-based-settings-test-'));
        
        // Create nested directory structure for testing
        const subDir1 = path.join(tempDir, 'src');
        const subDir2 = path.join(tempDir, 'src', 'components');
        const subDir3 = path.join(tempDir, 'tests');
        
        await fs.promises.mkdir(subDir1, { recursive: true });
        await fs.promises.mkdir(subDir2, { recursive: true });
        await fs.promises.mkdir(subDir3, { recursive: true });
        
        workspaceSettingsService = new WorkspaceSettingsService(tempDir);
    });
    
    suiteTeardown(async () => {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    setup(() => {
        vscodeMock = sinon.createSandbox();
        
        // Mock workspace folders
        vscodeMock.stub(vscode.workspace, 'workspaceFolders').value([{
            uri: { fsPath: tempDir },
            name: 'test-workspace',
            index: 0
        }]);
        
        // Mock global configuration - these are the fallback values
        const createMockConfig = (): vscode.WorkspaceConfiguration => {
            const globalSettings: { [key: string]: any } = {
                'midThreshold': 300,
                'highThreshold': 1000,
                'normal': '🟢',
                'warning': '🟡', 
                'danger': '🔴',
                'excludePatterns': [
                    '**/node_modules/**',
                    '**/out/**',
                    '**/.git/**'
                ]
            };
            
            return {
                get: (key: string, defaultValue?: any) => globalSettings[key] ?? defaultValue,
                has: () => true,
                inspect: () => undefined,
                update: async () => {}
            } as vscode.WorkspaceConfiguration;
        };
        
        vscodeMock.stub(vscode.workspace, 'getConfiguration').callsFake(() => {
            return createMockConfig();
        });
        
        // Create the service AFTER setting up the mocks so it can pick up the workspace
        service = new PathBasedSettingsService();
        // IMPORTANT: Manually set the workspace settings service to use the SAME instance as our test
        // This ensures both the test and the service are reading/writing to the same workspace
        (service as any).setWorkspaceSettingsService(workspaceSettingsService);
    });
    
    teardown(() => {
        vscodeMock.restore();
    });

    suite('Basic Functionality', () => {
        test('should fall back to global settings when no workspace settings exist', async () => {
            const filePath = path.join(tempDir, 'src', 'test.ts');
            
            const emojis = await service.getCustomEmojisForPath(filePath);
            expect(emojis.normal).to.equal('🟢');
            expect(emojis.warning).to.equal('🟡');
            expect(emojis.danger).to.equal('🔴');
            
            const thresholds = await service.getThresholdConfigForPath(filePath);
            expect(thresholds.midThreshold).to.equal(300);
            expect(thresholds.highThreshold).to.equal(1000);
        });

        test('should handle missing workspace folders gracefully', async () => {
            vscodeMock.stub(vscode.workspace, 'workspaceFolders').value(undefined);
            
            const serviceWithoutWorkspace = new PathBasedSettingsService();
            const filePath = path.join(tempDir, 'test.ts');
            
            const emojis = await serviceWithoutWorkspace.getCustomEmojisForPath(filePath);
            expect(emojis.normal).to.equal('🟢'); // Should still fallback to global
        });
    });

    suite('Workspace Settings Resolution', () => {
        test('should use root workspace settings for files in root', async () => {
            // Create root workspace settings
            const rootSettings: WorkspaceSettings = {
                'codeCounter.emojis.normal': '🔵',
                'codeCounter.emojis.warning': '🟠',
                'codeCounter.lineThresholds.midThreshold': 150
            };
            await workspaceSettingsService.saveWorkspaceSettings(tempDir, rootSettings);
            
            // Add a small delay to ensure file system operations complete
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const filePath = path.join(tempDir, 'root-file.ts');
            
            const emojis = await service.getCustomEmojisForPath(filePath);
            expect(emojis.normal).to.equal('🔵');
            expect(emojis.warning).to.equal('🟠');
            expect(emojis.danger).to.equal('🔴'); // Should inherit global default
            
            const thresholds = await service.getThresholdConfigForPath(filePath);
            expect(thresholds.midThreshold).to.equal(150); // From workspace
            expect(thresholds.highThreshold).to.equal(1000); // From global default
        });

        test('should use subdirectory settings when available', async () => {
            // Create subdirectory settings that override root
            const subDir = path.join(tempDir, 'src');
            const subSettings: WorkspaceSettings = {
                'codeCounter.emojis.normal': '🟩',
                'codeCounter.lineThresholds.midThreshold': 50,
                'codeCounter.lineThresholds.highThreshold': 200
            };
            await workspaceSettingsService.saveWorkspaceSettings(subDir, subSettings);
            
            // Add a small delay to ensure file system operations complete
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const filePath = path.join(subDir, 'component.ts');
            
            const emojis = await service.getCustomEmojisForPath(filePath);
            expect(emojis.normal).to.equal('🟩'); // From subdirectory
            expect(emojis.warning).to.equal('🟠'); // Inherited from root
            expect(emojis.danger).to.equal('🔴'); // From global default
            
            const thresholds = await service.getThresholdConfigForPath(filePath);
            expect(thresholds.midThreshold).to.equal(50); // From subdirectory
            expect(thresholds.highThreshold).to.equal(200); // From subdirectory
        });

        test('should inherit from closest parent directory', async () => {
            // Create deeply nested directory settings
            const deepDir = path.join(tempDir, 'src', 'components');
            const deepSettings: WorkspaceSettings = {
                'codeCounter.emojis.danger': '🔥'
            };
            await workspaceSettingsService.saveWorkspaceSettings(deepDir, deepSettings);
            
            const filePath = path.join(deepDir, 'button.tsx');
            
            const emojis = await service.getCustomEmojisForPath(filePath);
            expect(emojis.normal).to.equal('🟩'); // From parent (src)
            expect(emojis.warning).to.equal('🟠'); // From root
            expect(emojis.danger).to.equal('🔥'); // From current directory
        });
    });

    suite('Threshold Calculation', () => {
        test('should calculate color thresholds correctly with workspace settings', async () => {
            const subDir = path.join(tempDir, 'tests');
            const testSettings: WorkspaceSettings = {
                'codeCounter.lineThresholds.midThreshold': 10,
                'codeCounter.lineThresholds.highThreshold': 20
            };
            await workspaceSettingsService.saveWorkspaceSettings(subDir, testSettings);
            
            const filePath = path.join(subDir, 'test.spec.ts');
            
            // Test different line counts
            expect(await service.getColorThresholdForPath(5, filePath)).to.equal('normal');
            expect(await service.getColorThresholdForPath(15, filePath)).to.equal('warning');
            expect(await service.getColorThresholdForPath(25, filePath)).to.equal('danger');
        });

        test('should handle invalid threshold configurations', async () => {
            const subDir = path.join(tempDir, 'tests');
            const badSettings: WorkspaceSettings = {
                'codeCounter.lineThresholds.midThreshold': 100,
                'codeCounter.lineThresholds.highThreshold': 50 // Invalid: high < mid
            };
            await workspaceSettingsService.saveWorkspaceSettings(subDir, badSettings);
            
            const filePath = path.join(subDir, 'test.ts');
            const thresholds = await service.getThresholdConfigForPath(filePath);
            
            expect(thresholds.midThreshold).to.equal(100);
            expect(thresholds.highThreshold).to.equal(200); // Should be corrected to mid + 100
        });
    });

    suite('Emoji Resolution', () => {
        test('should get correct theme emoji for file paths', async () => {
            const subDir = path.join(tempDir, 'src');
            const filePath = path.join(subDir, 'test.ts');
            
            // Should use subdirectory settings from previous test
            expect(await service.getThemeEmojiForPath('normal', filePath)).to.equal('🟩');
            expect(await service.getThemeEmojiForPath('warning', filePath)).to.equal('🟠');
            expect(await service.getThemeEmojiForPath('danger', filePath)).to.equal('🔴');
        });

        test('should get correct folder emoji for folder paths', async () => {
            const folderSettings: WorkspaceSettings = {
                'codeCounter.emojis.folders.normal': '📁',
                'codeCounter.emojis.folders.warning': '📂',
                'codeCounter.emojis.folders.danger': '📕'
            };
            await workspaceSettingsService.saveWorkspaceSettings(tempDir, folderSettings);
            
            const folderPath = path.join(tempDir, 'src');
            
            expect(await service.getFolderEmojiForPath('normal', folderPath)).to.equal('📁');
            expect(await service.getFolderEmojiForPath('warning', folderPath)).to.equal('📂');
            expect(await service.getFolderEmojiForPath('danger', folderPath)).to.equal('📕');
        });
    });

    suite('Exclude Patterns', () => {
        test('should use workspace-specific exclude patterns', async () => {
            const excludeSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': [
                    '**/*.test.ts',
                    '**/build/**',
                    '**/*.config.js'
                ]
            };
            await workspaceSettingsService.saveWorkspaceSettings(tempDir, excludeSettings);
            
            const filePath = path.join(tempDir, 'src', 'component.ts');
            const patterns = await service.getExcludePatternsForPath(filePath);
            
            expect(patterns).to.include('**/*.test.ts');
            expect(patterns).to.include('**/build/**');
            expect(patterns).to.include('**/*.config.js');
        });

        test('should inherit exclude patterns from parent directories', async () => {
            // Create different exclude patterns in subdirectory
            const subDir = path.join(tempDir, 'src');
            const subExcludeSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': [
                    '**/*.spec.ts'
                ]
            };
            await workspaceSettingsService.saveWorkspaceSettings(subDir, subExcludeSettings);
            
            const filePath = path.join(subDir, 'component.ts');
            const patterns = await service.getExcludePatternsForPath(filePath);
            
            expect(patterns).to.include('**/*.spec.ts'); // From subdirectory
        });
    });

    suite('Formatting Methods', () => {
        test('should format line count with correct emoji based on path', async () => {
            // First create subdirectory settings with the thresholds we need
            const subDir = path.join(tempDir, 'src');
            const subSettings: WorkspaceSettings = {
                'codeCounter.lineThresholds.midThreshold': 50,
                'codeCounter.lineThresholds.highThreshold': 200
            };
            await workspaceSettingsService.saveWorkspaceSettings(subDir, subSettings);
            
            // Add a small delay to ensure file system operations complete
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const filePath = path.join(subDir, 'large-component.ts');
            
            // 150 is between mid (50) and high (200), so should be warning level
            const result = await service.formatLineCountWithEmojiForPath(150, filePath);
            
            expect(result.emoji).to.equal('�'); // Should be warning level (global default since no custom emoji set)
            expect(result.text).to.equal('150L');
        });

        test('should format status bar text correctly', async () => {
            const filePath = path.join(tempDir, 'src', 'component.ts');
            
            const result1 = await service.getStatusBarTextForPath(500, filePath);
            expect(result1.text).to.equal('500 lines');
            
            const result2 = await service.getStatusBarTextForPath(1500, filePath);
            expect(result2.text).to.equal('1.5k lines');
            
            const result3 = await service.getStatusBarTextForPath(1500000, filePath);
            expect(result3.text).to.equal('1.5M lines');
        });
    });

    suite('Error Handling', () => {
        test('should handle file system errors gracefully', async () => {
            const invalidPath = '/completely/invalid/path/that/does/not/exist';
            
            // Should not throw, should fallback to global settings
            const emojis = await service.getCustomEmojisForPath(invalidPath);
            expect(emojis.normal).to.equal('🟢');
        });

        test('should handle corrupted settings files gracefully', async () => {
            // Create a corrupted .code-counter.json file
            const corruptedDir = path.join(tempDir, 'corrupted');
            await fs.promises.mkdir(corruptedDir, { recursive: true });
            
            const corruptedFile = path.join(corruptedDir, '.code-counter.json');
            await fs.promises.writeFile(corruptedFile, '{invalid json}');
            
            const filePath = path.join(corruptedDir, 'test.ts');
            
            // Should fallback to global settings without throwing
            const emojis = await service.getCustomEmojisForPath(filePath);
            expect(emojis.normal).to.equal('🟢');
        });
    });
});