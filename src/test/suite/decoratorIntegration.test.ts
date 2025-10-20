import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { FileExplorerDecorationProvider } from '../../providers/fileExplorerDecorator';
import { EditorTabDecorationProvider } from '../../providers/editorTabDecorator';
import { WorkspaceSettingsService, WorkspaceSettings } from '../../services/workspaceSettingsService';

suite('Decorator Integration Tests', () => {
    let tempDir: string;
    let workspaceSettingsService: WorkspaceSettingsService;
    let vscodeMock: sinon.SinonSandbox;
    let fileExplorerDecorator: FileExplorerDecorationProvider;
    let editorTabDecorator: EditorTabDecorationProvider;
    
    suiteSetup(async () => {
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'decorator-integration-test-'));
        
        // Create test file structure
        const srcDir = path.join(tempDir, 'src');
        const componentsDir = path.join(srcDir, 'components');
        const testsDir = path.join(tempDir, 'tests');
        
        await fs.promises.mkdir(srcDir, { recursive: true });
        await fs.promises.mkdir(componentsDir, { recursive: true });
        await fs.promises.mkdir(testsDir, { recursive: true });
        
        // Create test files with different line counts
        const shortFile = path.join(srcDir, 'short.ts');
        const mediumFile = path.join(componentsDir, 'medium.tsx');
        const longFile = path.join(testsDir, 'long.spec.ts');
        
        await fs.promises.writeFile(shortFile, 'const x = 1;\nconst y = 2;\n'); // 2 lines
        await fs.promises.writeFile(mediumFile, new Array(150).fill('console.log("test");').join('\n')); // 150 lines
        await fs.promises.writeFile(longFile, new Array(800).fill('// test comment').join('\n')); // 800 lines
        
        workspaceSettingsService = new WorkspaceSettingsService(tempDir);
    });
    
    suiteTeardown(async () => {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    setup(() => {
        vscodeMock = sinon.createSandbox();
        
        // Mock workspace folders
        const workspaceUri = vscode.Uri.file(tempDir);
        vscodeMock.stub(vscode.workspace, 'workspaceFolders').value([{
            uri: workspaceUri,
            name: 'test-workspace',
            index: 0
        }]);
        
        // Mock workspace.fs for file operations
        vscodeMock.stub(vscode.workspace.fs, 'stat').callsFake(async (uri: vscode.Uri) => {
            try {
                const stats = await fs.promises.stat(uri.fsPath);
                return {
                    type: stats.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File,
                    ctime: stats.ctimeMs,
                    mtime: stats.mtimeMs,
                    size: stats.size
                };
            } catch (error) {
                throw new vscode.FileSystemError('File not found');
            }
        });
        
        // Mock asRelativePath
        vscodeMock.stub(vscode.workspace, 'asRelativePath').callsFake((pathOrUri: string | vscode.Uri) => {
            const filePath = typeof pathOrUri === 'string' ? pathOrUri : pathOrUri.fsPath;
            return path.relative(tempDir, filePath);
        });
        
        // Mock getWorkspaceFolder
        vscodeMock.stub(vscode.workspace, 'getWorkspaceFolder').callsFake(() => {
            return {
                uri: workspaceUri,
                name: 'test-workspace',
                index: 0
            };
        });
        
        // Mock global configuration with defaults
        const createMockConfig = (): vscode.WorkspaceConfiguration => ({
            get: (key: string, defaultValue?: any) => {
                const defaults: { [key: string]: any } = {
                    'midThreshold': 300,
                    'highThreshold': 1000,
                    'normal': '🟢',
                    'warning': '🟡',
                    'danger': '🔴',
                    'excludePatterns': ['**/node_modules/**', '**/.git/**']
                };
                return defaults[key] ?? defaultValue;
            },
            has: () => true,
            inspect: () => undefined,
            update: async () => {}
        } as vscode.WorkspaceConfiguration);
        
        vscodeMock.stub(vscode.workspace, 'getConfiguration').returns(createMockConfig());
        
        // Mock createFileSystemWatcher to prevent real file watching
        vscodeMock.stub(vscode.workspace, 'createFileSystemWatcher').returns({
            onDidCreate: () => ({ dispose: () => {} }),
            onDidDelete: () => ({ dispose: () => {} }),
            dispose: () => {}
        } as any);
        
        // Mock configuration change events
        vscodeMock.stub(vscode.workspace, 'onDidChangeConfiguration').returns({ dispose: () => {} });
        vscodeMock.stub(vscode.workspace, 'onDidSaveTextDocument').returns({ dispose: () => {} });
        
        fileExplorerDecorator = new FileExplorerDecorationProvider();
        editorTabDecorator = new EditorTabDecorationProvider();
    });
    
    teardown(() => {
        fileExplorerDecorator.dispose();
        editorTabDecorator.dispose();
        vscodeMock.restore();
    });

    suite('FileExplorerDecorationProvider - Path-Based Settings', () => {
        test('should use global settings when no workspace settings exist', async () => {
            const fileUri = vscode.Uri.file(path.join(tempDir, 'src', 'short.ts'));
            
            const decoration = await fileExplorerDecorator.provideFileDecoration(fileUri);
            
            expect(decoration).to.not.be.undefined;
            expect(decoration!.badge).to.equal('🟢'); // Should use global normal emoji (2 lines < 300)
        });

        test('should use root workspace settings for files in workspace', async () => {
            // Create root workspace settings with custom emojis
            const rootSettings: WorkspaceSettings = {
                'codeCounter.emojis.normal': '🔵',
                'codeCounter.emojis.warning': '🟠',
                'codeCounter.emojis.danger': '🔴',
                'codeCounter.lineThresholds.midThreshold': 100,
                'codeCounter.lineThresholds.highThreshold': 500
            };
            await workspaceSettingsService.saveWorkspaceSettings(tempDir, rootSettings);
            
            const shortFileUri = vscode.Uri.file(path.join(tempDir, 'src', 'short.ts')); // 2 lines
            const mediumFileUri = vscode.Uri.file(path.join(tempDir, 'src', 'components', 'medium.tsx')); // 150 lines
            const longFileUri = vscode.Uri.file(path.join(tempDir, 'tests', 'long.spec.ts')); // 800 lines
            
            const shortDecoration = await fileExplorerDecorator.provideFileDecoration(shortFileUri);
            const mediumDecoration = await fileExplorerDecorator.provideFileDecoration(mediumFileUri);
            const longDecoration = await fileExplorerDecorator.provideFileDecoration(longFileUri);
            
            expect(shortDecoration!.badge).to.equal('🔵'); // 2 < 100 = normal
            expect(mediumDecoration!.badge).to.equal('🟠'); // 100 <= 150 < 500 = warning
            expect(longDecoration!.badge).to.equal('🔴'); // 800 >= 500 = danger
        });

        test('should use subdirectory settings when available', async () => {
            // Create subdirectory settings that override root
            const srcDir = path.join(tempDir, 'src');
            const srcSettings: WorkspaceSettings = {
                'codeCounter.emojis.normal': '🟩',
                'codeCounter.emojis.warning': '🟨',
                'codeCounter.lineThresholds.midThreshold': 50  // Lower threshold for src files
            };
            await workspaceSettingsService.saveWorkspaceSettings(srcDir, srcSettings);
            
            // Create different settings for tests directory
            const testsDir = path.join(tempDir, 'tests');
            const testSettings: WorkspaceSettings = {
                'codeCounter.emojis.normal': '✅',
                'codeCounter.emojis.warning': '⚠️',
                'codeCounter.lineThresholds.midThreshold': 200  // Higher threshold for test files
            };
            await workspaceSettingsService.saveWorkspaceSettings(testsDir, testSettings);
            
            const srcFileUri = vscode.Uri.file(path.join(srcDir, 'components', 'medium.tsx')); // 150 lines in src
            const testFileUri = vscode.Uri.file(path.join(testsDir, 'long.spec.ts')); // 800 lines in tests
            
            const srcDecoration = await fileExplorerDecorator.provideFileDecoration(srcFileUri);
            const testDecoration = await fileExplorerDecorator.provideFileDecoration(testFileUri);
            
            // Src file: 150 >= 50 (src midThreshold) && < 500 (root highThreshold) = warning
            expect(srcDecoration!.badge).to.equal('🟨');
            
            // Test file: 800 >= 500 (root highThreshold) = danger (inherits from root)
            expect(testDecoration!.badge).to.equal('🔴');
        });

        test('should apply path-based exclude patterns', async () => {
            // Create settings with custom exclude patterns
            const srcDir = path.join(tempDir, 'src');
            const srcSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['**/*.tsx'] // Exclude tsx files in src
            };
            await workspaceSettingsService.saveWorkspaceSettings(srcDir, srcSettings);
            
            // Create tsx and ts files
            const tsxFile = path.join(srcDir, 'component.tsx');
            const tsFile = path.join(srcDir, 'module.ts');
            await fs.promises.writeFile(tsxFile, 'const comp = () => <div>test</div>;');
            await fs.promises.writeFile(tsFile, 'const fn = () => console.log("test");');
            
            const tsxUri = vscode.Uri.file(tsxFile);
            const tsUri = vscode.Uri.file(tsFile);
            
            const tsxDecoration = await fileExplorerDecorator.provideFileDecoration(tsxUri);
            const tsDecoration = await fileExplorerDecorator.provideFileDecoration(tsUri);
            
            expect(tsxDecoration).to.be.undefined; // Should be excluded
            expect(tsDecoration).to.not.be.undefined; // Should not be excluded
        });

        test('should provide folder decorations with path-based settings', async () => {
            // Create folder-specific emoji settings
            const rootSettings: WorkspaceSettings = {
                'codeCounter.emojis.folders.normal': '📁',
                'codeCounter.emojis.folders.warning': '📂',
                'codeCounter.emojis.folders.danger': '📕',
                'codeCounter.lineThresholds.midThreshold': 100,
                'codeCounter.lineThresholds.highThreshold': 500
            };
            await workspaceSettingsService.saveWorkspaceSettings(tempDir, rootSettings);
            
            const srcDirUri = vscode.Uri.file(path.join(tempDir, 'src'));
            
            const folderDecoration = await fileExplorerDecorator.provideFileDecoration(srcDirUri);
            
            expect(folderDecoration).to.not.be.undefined;
            expect(folderDecoration!.badge).to.include('📁'); // Should contain folder emoji
            expect(folderDecoration!.tooltip).to.include('Folder:'); // Should have folder info
        });
    });

    suite('EditorTabDecorationProvider - Path-Based Settings', () => {
        test('should use path-based settings for status bar display', async () => {
            // Mock window and status bar
            const mockStatusBarItem = {
                text: '',
                tooltip: '',
                show: sinon.stub(),
                hide: sinon.stub(),
                dispose: sinon.stub()
            };
            
            vscodeMock.stub(vscode.window, 'createStatusBarItem').returns(mockStatusBarItem as any);
            
            // Create path-specific settings
            const srcDir = path.join(tempDir, 'src');
            const srcSettings: WorkspaceSettings = {
                'codeCounter.emojis.normal': '🟦',
                'codeCounter.lineThresholds.midThreshold': 50
            };
            await workspaceSettingsService.saveWorkspaceSettings(srcDir, srcSettings);
            
            // Mock document with medium line count
            const mockDocument = {
                uri: vscode.Uri.file(path.join(srcDir, 'medium.tsx')),
                lineCount: 150,
                fileName: 'medium.tsx'
            } as vscode.TextDocument;
            
            vscodeMock.stub(vscode.window, 'activeTextEditor').value({
                document: mockDocument
            });
            
            // Create new decorator to test
            const tabDecorator = new EditorTabDecorationProvider();
            
            // Give it time to initialize
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // The status bar should use path-based emoji
            expect(mockStatusBarItem.text).to.include('🟨'); // Should use warning emoji from src settings
            
            tabDecorator.dispose();
        });
    });

    suite('Settings Inheritance Integration', () => {
        test('should properly inherit settings through directory hierarchy', async () => {
            // Create multi-level settings hierarchy
            const rootSettings: WorkspaceSettings = {
                'codeCounter.emojis.normal': '🔵',
                'codeCounter.emojis.warning': '🟡',
                'codeCounter.emojis.danger': '🔴',
                'codeCounter.lineThresholds.midThreshold': 200,
                'codeCounter.lineThresholds.highThreshold': 800
            };
            await workspaceSettingsService.saveWorkspaceSettings(tempDir, rootSettings);
            
            const srcSettings: WorkspaceSettings = {
                'codeCounter.emojis.normal': '🟢', // Override normal emoji only
                'codeCounter.lineThresholds.midThreshold': 100 // Override mid threshold only
            };
            await workspaceSettingsService.saveWorkspaceSettings(path.join(tempDir, 'src'), srcSettings);
            
            const componentSettings: WorkspaceSettings = {
                'codeCounter.emojis.warning': '⚠️' // Override warning emoji only
            };
            await workspaceSettingsService.saveWorkspaceSettings(path.join(tempDir, 'src', 'components'), componentSettings);
            
            // Test file in deeply nested directory
            const deepFileUri = vscode.Uri.file(path.join(tempDir, 'src', 'components', 'button.tsx'));
            
            // Create a file with line count that should trigger warning (150 lines, mid=100, high=800)
            await fs.promises.writeFile(deepFileUri.fsPath, new Array(150).fill('// line').join('\n'));
            
            const decoration = await fileExplorerDecorator.provideFileDecoration(deepFileUri);
            
            expect(decoration).to.not.be.undefined;
            expect(decoration!.badge).to.equal('⚠️'); // Should use components warning emoji
            
            // Test that it would use inherited settings for normal
            const shortDeepFileUri = vscode.Uri.file(path.join(tempDir, 'src', 'components', 'icon.tsx'));
            await fs.promises.writeFile(shortDeepFileUri.fsPath, '// short file\nconst x = 1;');
            
            const shortDecoration = await fileExplorerDecorator.provideFileDecoration(shortDeepFileUri);
            expect(shortDecoration!.badge).to.equal('🟢'); // Should use src normal emoji
        });

        test('should handle missing intermediate settings gracefully', async () => {
            // Only create root and deep directory settings, skip intermediate
            const rootSettings: WorkspaceSettings = {
                'codeCounter.emojis.normal': '🔵',
                'codeCounter.lineThresholds.midThreshold': 300
            };
            await workspaceSettingsService.saveWorkspaceSettings(tempDir, rootSettings);
            
            // Skip src directory, go straight to components
            const deepSettings: WorkspaceSettings = {
                'codeCounter.emojis.normal': '🟩'
            };
            await workspaceSettingsService.saveWorkspaceSettings(path.join(tempDir, 'src', 'components'), deepSettings);
            
            const deepFileUri = vscode.Uri.file(path.join(tempDir, 'src', 'components', 'test.tsx'));
            await fs.promises.writeFile(deepFileUri.fsPath, '// test\nconst x = 1;');
            
            const decoration = await fileExplorerDecorator.provideFileDecoration(deepFileUri);
            
            expect(decoration).to.not.be.undefined;
            expect(decoration!.badge).to.equal('🟩'); // Should use deep directory setting
        });
    });
});