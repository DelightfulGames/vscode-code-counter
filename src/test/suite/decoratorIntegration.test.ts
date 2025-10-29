import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { FileExplorerDecorationProvider } from '../../providers/fileExplorerDecorator';
import { EditorTabDecorationProvider } from '../../providers/editorTabDecorator';
import { PathBasedSettingsService } from '../../services/pathBasedSettingsService';
import { WorkspaceDatabaseService, WorkspaceSettings } from '../../services/workspaceDatabaseService';
import { DebugService } from '../../services/debugService';
import { LineCountCacheService, CachedLineCount } from '../../services/lineCountCache';
import { 
    getWorkspaceService, 
    setGlobalPathBasedSettings, 
    clearServiceCache 
} from '../../shared/extensionUtils';

suite('Decorator Integration Tests', () => {
    console.log('DEBUG SUITE: Decorator Integration Tests suite starting');
    let tempDir: string;
    let workspaceSettingsService: WorkspaceDatabaseService;
    let vscodeMock: sinon.SinonSandbox;
    let fileExplorerDecorator: FileExplorerDecorationProvider;
    let editorTabDecorator: EditorTabDecorationProvider;
    let pathBasedSettings: PathBasedSettingsService;
    let decorationDisposable: vscode.Disposable;
    
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
        const mediumFile = path.join(componentsDir, 'medium.ts'); // Changed from .tsx to .ts
        const longFile = path.join(testsDir, 'long.spec.ts');
        
        await fs.promises.writeFile(shortFile, 'const x = 1;\nconst y = 2;\n'); // 2 lines
        await fs.promises.writeFile(mediumFile, new Array(150).fill('console.log("test");').join('\n')); // 150 lines
        await fs.promises.writeFile(longFile, new Array(800).fill('// test comment').join('\n')); // 800 lines
        
        // Use WorkspaceDatabaseService for consistency with PathBasedSettingsService
        workspaceSettingsService = new WorkspaceDatabaseService(tempDir);
        
        // Initialize the database by calling a method that properly waits for initialization
        await workspaceSettingsService.saveWorkspaceSettings(tempDir, {});
        
        // Each test will set up its own settings as needed
        console.log('[SETUP] Database initialized and ready for tests');
    });
    
    
    suiteTeardown(async () => {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        if (vscodeMock) {
            vscodeMock.restore();
        }
    });

    setup(async () => {
        console.log('DEBUG SETUP: Starting setup function');
        vscodeMock = sinon.createSandbox();
        console.log('DEBUG SETUP: Created sinon sandbox');
        
        // Mock workspace folders - MUST be done FIRST before creating services
        const workspaceUri = vscode.Uri.file(tempDir);
        const testWorkspaceFolder = {
            uri: workspaceUri,
            name: 'test-workspace',
            index: 0
        };
        
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [testWorkspaceFolder],
            configurable: true
        });
        console.log('DEBUG SETUP: Set workspaceFolders');
        
        // Note: workspace.fs.stat is provided by vscode-mock and cannot be stubbed directly
        // The mock provides a basic stat implementation that should work for most tests
        
        // Mock asRelativePath
        vscodeMock.stub(vscode.workspace, 'asRelativePath').callsFake((pathOrUri: string | vscode.Uri) => {
            const filePath = typeof pathOrUri === 'string' ? pathOrUri : pathOrUri.fsPath;
            return path.relative(tempDir, filePath);
        });
        
        // Mock getWorkspaceFolder - CRITICAL: Must check if file is within workspace
        vscodeMock.stub(vscode.workspace, 'getWorkspaceFolder').callsFake((uri: vscode.Uri) => {
            // Check if the file URI is within our test workspace
            // Normalize case for Windows compatibility
            if (uri && uri.fsPath.toLowerCase().startsWith(tempDir.toLowerCase())) {
                return testWorkspaceFolder;
            }
            return undefined; // File is not in workspace
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
            onDidChange: () => ({ dispose: () => {} }),
            onDidDelete: () => ({ dispose: () => {} }),
            dispose: () => {}
        } as any);
        
        // Mock configuration change events
        vscodeMock.stub(vscode.workspace, 'onDidChangeConfiguration').returns({ dispose: () => {} });
        vscodeMock.stub(vscode.workspace, 'onDidSaveTextDocument').returns({ dispose: () => {} });
        
        // Enable file debug logging for this test
        const debugService = DebugService.getInstance();
        debugService.configure('file');
        debugService.clearLog(); // Clear any existing log
        console.log('DEBUG SETUP: Configured debug service');

        // Clear any existing services and state
        clearServiceCache();
        console.log('DEBUG SETUP: Cleared service cache');
        
        // Create a shared PathBasedSettingsService that uses the test's workspace database
        pathBasedSettings = new PathBasedSettingsService();
        
        // CRITICAL: Configure the PathBasedSettingsService to use the same workspace database as our tests
        // This MUST be called after vscode.workspace.workspaceFolders is set
        pathBasedSettings.setWorkspaceSettingsService(workspaceSettingsService);
        
        // Set global reference for extension state management
        setGlobalPathBasedSettings(pathBasedSettings);
        console.log('DEBUG SETUP: Set global path-based settings');
        
        fileExplorerDecorator = new FileExplorerDecorationProvider(pathBasedSettings);
        editorTabDecorator = new EditorTabDecorationProvider(pathBasedSettings);
        console.log('DEBUG SETUP: Created decorators');
        
        // Register the file decoration provider with VS Code
        decorationDisposable = vscode.window.registerFileDecorationProvider(fileExplorerDecorator);
        console.log('DEBUG SETUP: Registered file decoration provider');
        
        // Mock the LineCountCacheService to provide expected line counts for test files
        const mockLineCountCache = (fileExplorerDecorator as any).lineCountCache as LineCountCacheService;
        vscodeMock.stub(mockLineCountCache, 'getLineCount').callsFake(async (filePath: string): Promise<CachedLineCount | null> => {
            const fileName = path.basename(filePath);
            const mockCounts: { [key: string]: CachedLineCount } = {
                'short.ts': {
                    lines: 2,
                    codeLines: 2,
                    commentLines: 0,
                    blankLines: 0,
                    lastModified: Date.now(),
                    size: 100
                },
                'medium.ts': {
                    lines: 150,
                    codeLines: 150,
                    commentLines: 0,
                    blankLines: 0,
                    lastModified: Date.now(),
                    size: 3000
                },
                'long.spec.ts': {
                    lines: 800,
                    codeLines: 800,
                    commentLines: 0,
                    blankLines: 0,
                    lastModified: Date.now(),
                    size: 16000
                },
                // Add missing test files
                'button.ts': {
                    lines: 150,
                    codeLines: 150,
                    commentLines: 0,
                    blankLines: 0,
                    lastModified: Date.now(),
                    size: 3000
                },
                'component.ts': {
                    lines: 4,
                    codeLines: 4,
                    commentLines: 0,
                    blankLines: 0,
                    lastModified: Date.now(),
                    size: 80
                },
                'test.ts': {
                    lines: 25,
                    codeLines: 25,
                    commentLines: 0,
                    blankLines: 0,
                    lastModified: Date.now(),
                    size: 500
                },
                'module.ts': {
                    lines: 1,
                    codeLines: 1,
                    commentLines: 0,
                    blankLines: 0,
                    lastModified: Date.now(),
                    size: 40
                },
                'icon.ts': {
                    lines: 3,
                    codeLines: 3,
                    commentLines: 0,
                    blankLines: 0,
                    lastModified: Date.now(),
                    size: 50
                }
            };
            return mockCounts[fileName] || null;
        });
        
        console.log('DEBUG SETUP: Setup completed successfully');
    });
    
    teardown(async () => {
        if (fileExplorerDecorator) {
            fileExplorerDecorator.dispose();
        }
        if (editorTabDecorator) {
            editorTabDecorator.dispose();
        }
        if (vscodeMock) {
            vscodeMock.restore();
        }
        
        // Clear database between tests to prevent interference
        if (workspaceSettingsService) {
            try {
                await workspaceSettingsService.clearAllSettings();
                console.log('[TEARDOWN] Cleared all database settings');
            } catch (error) {
                console.warn('[TEARDOWN] Failed to clear database settings:', error);
            }
        }
        
        // Clear PathBasedSettingsService cache to ensure fresh state for each test
        if (pathBasedSettings) {
            pathBasedSettings.clearWorkspaceServices();
        }
        
        // Dispose VS Code decoration provider
        if (decorationDisposable) {
            decorationDisposable.dispose();
        }
        
        // Clear service caches and global state
        clearServiceCache();
    });

    suite('FileExplorerDecorationProvider - Path-Based Settings', () => {
        console.log('DEBUG SUITE: FileExplorerDecorationProvider - Path-Based Settings suite starting');
        
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
            const mediumFileUri = vscode.Uri.file(path.join(tempDir, 'src', 'components', 'medium.ts')); // 150 lines
            const longFileUri = vscode.Uri.file(path.join(tempDir, 'tests', 'long.spec.ts')); // 800 lines
            
            const shortDecoration = await fileExplorerDecorator.provideFileDecoration(shortFileUri);
            const mediumDecoration = await fileExplorerDecorator.provideFileDecoration(mediumFileUri);
            const longDecoration = await fileExplorerDecorator.provideFileDecoration(longFileUri);
            
            expect(shortDecoration!.badge).to.equal('🔵'); // 2 < 100 = normal
            expect(mediumDecoration!.badge).to.equal('🟠'); // 100 <= 150 < 500 = warning
            expect(longDecoration!.badge).to.equal('🔴'); // 800 >= 500 = danger
        });

        test('should use subdirectory settings when available', async () => {
            // First create root workspace settings
            const rootSettings: WorkspaceSettings = {
                'codeCounter.emojis.normal': '🔵',
                'codeCounter.emojis.warning': '🟠',
                'codeCounter.emojis.danger': '🔴',
                'codeCounter.lineThresholds.midThreshold': 100,
                'codeCounter.lineThresholds.highThreshold': 500
            };
            await workspaceSettingsService.saveWorkspaceSettings(tempDir, rootSettings);
            
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
            
            // Add a small delay to ensure database writes are flushed
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const srcFileUri = vscode.Uri.file(path.join(srcDir, 'components', 'medium.ts')); // 150 lines in src
            const testFileUri = vscode.Uri.file(path.join(testsDir, 'long.spec.ts')); // 800 lines in tests
            
            console.log('[TEST DEBUG] About to call provideFileDecoration for srcFileUri:', srcFileUri.fsPath);
            const srcDecoration = await fileExplorerDecorator.provideFileDecoration(srcFileUri);
            console.log('[TEST DEBUG] srcDecoration result:', srcDecoration);
            
            console.log('[TEST DEBUG] About to call provideFileDecoration for testFileUri:', testFileUri.fsPath);
            const testDecoration = await fileExplorerDecorator.provideFileDecoration(testFileUri);
            console.log('[TEST DEBUG] testDecoration result:', testDecoration);
            
            // Debug: Let's manually check what PathBasedSettingsService returns
            console.log('[TEST DEBUG] Manually checking PathBasedSettingsService for srcFileUri...');
            try {
                const resolvedSettings = await pathBasedSettings.getResolvedSettings(srcFileUri.fsPath);
                console.log('[TEST DEBUG] Resolved settings for src file:', resolvedSettings);
            } catch (error) {
                console.error('[TEST DEBUG] Error getting resolved settings:', error);
            }
            
            // Src file: 150 >= 50 (src midThreshold) && < 500 (root highThreshold) = warning
            expect(srcDecoration!.badge).to.equal('🟨');
            
            // Test file: 800 >= 500 (root highThreshold) = danger (inherits from root)
            expect(testDecoration!.badge).to.equal('🔴');
            
            // Debug: Check what was logged to the debug file
            const debugService = DebugService.getInstance();
            const logFilePath = debugService.getLogFilePath();
            if (logFilePath && fs.existsSync(logFilePath)) {
                const logContent = fs.readFileSync(logFilePath, 'utf8');
                console.log('=== DEBUG LOG CONTENT ===');
                console.log(logContent);
                console.log('=== END DEBUG LOG ===');
            } else {
                console.log('No debug log file found at:', logFilePath);
            }
        });

        test('should apply path-based exclude patterns', async () => {
            // First create root workspace settings for inheritance
            const rootSettings: WorkspaceSettings = {
                'codeCounter.emojis.normal': '🔵',
                'codeCounter.emojis.warning': '🟨',
                'codeCounter.emojis.danger': '🔴',
                'codeCounter.lineThresholds.midThreshold': 100,
                'codeCounter.lineThresholds.highThreshold': 500
            };
            await workspaceSettingsService.saveWorkspaceSettings(tempDir, rootSettings);
            
            // Create settings with custom exclude patterns
            const srcDir = path.join(tempDir, 'src');
            const srcSettings: WorkspaceSettings = {
                'codeCounter.excludePatterns': ['**/*.tsx'] // Exclude tsx files in src
            };
            await workspaceSettingsService.saveWorkspaceSettings(srcDir, srcSettings);
            
            // Create tsx and ts files
            const tsxFile = path.join(srcDir, 'component.tsx');
            const tsFile = path.join(srcDir, 'module.ts');
            await fs.promises.mkdir(srcDir, { recursive: true });
            await fs.promises.writeFile(tsxFile, 'const comp = () => <div>test</div>;\n'); // 1 line - should be normal if not excluded
            await fs.promises.writeFile(tsFile, 'const fn = () => console.log("test");\n'); // 1 line - should be normal
            
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
            
            // First create root workspace settings for inheritance
            const rootSettings: WorkspaceSettings = {
                'codeCounter.emojis.normal': '🔵',
                'codeCounter.emojis.warning': '🟨',
                'codeCounter.emojis.danger': '🔴',
                'codeCounter.lineThresholds.midThreshold': 100,
                'codeCounter.lineThresholds.highThreshold': 500
            };
            await workspaceSettingsService.saveWorkspaceSettings(tempDir, rootSettings);
            
            // Create path-specific settings that override some values
            const srcDir = path.join(tempDir, 'src');
            const srcSettings: WorkspaceSettings = {
                'codeCounter.emojis.normal': '🟦',
                'codeCounter.lineThresholds.midThreshold': 50  // Override threshold but inherit warning emoji
            };
            await workspaceSettingsService.saveWorkspaceSettings(srcDir, srcSettings);
            
            // Create the actual file that the document references
            const mediumFilePath = path.join(srcDir, 'medium.ts');
            await fs.promises.mkdir(srcDir, { recursive: true });
            await fs.promises.writeFile(mediumFilePath, new Array(150).fill('console.log("test");').join('\n'));
            
            // Mock document with medium line count
            const mockDocument = {
                uri: vscode.Uri.file(mediumFilePath),
                lineCount: 150,
                fileName: 'medium.ts'
            } as vscode.TextDocument;
            
            vscodeMock.stub(vscode.window, 'activeTextEditor').value({
                document: mockDocument
            });
            
            // Create new decorator to test with the same pathBasedSettings
            const tabDecorator = new EditorTabDecorationProvider(pathBasedSettings);
            
            // Give it time to initialize
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // The status bar should use path-based emoji
            expect(mockStatusBarItem.text).to.include('🟨'); // Should use warning emoji from src settings
            
            tabDecorator.dispose();
        });
    });

    suite('Settings Inheritance Integration', () => {
        console.log('DEBUG SUITE: Settings Inheritance Integration suite starting');
        
        test('should properly inherit settings through directory hierarchy', async () => {
            console.log('DEBUG TEST: Starting hierarchy test execution - this should appear if test runs');
            console.log('HIERARCHY TEST START: Beginning test execution');
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
            const deepFileUri = vscode.Uri.file(path.join(tempDir, 'src', 'components', 'button.ts'));
            
            // Create a file with line count that should trigger warning (150 lines, mid=100, high=800)
            await fs.promises.mkdir(path.dirname(deepFileUri.fsPath), { recursive: true });
            const fileContent = new Array(150).fill('// This is line content').join('\n') + '\n'; // Ensure proper line count
            await fs.promises.writeFile(deepFileUri.fsPath, fileContent);
            
            console.log('TEST DEBUG: About to call fileExplorerDecorator.provideFileDecoration for:', deepFileUri.fsPath);
            console.log('TEST DEBUG: fileExplorerDecorator type:', typeof fileExplorerDecorator);
            console.log('TEST DEBUG: provideFileDecoration method exists:', typeof fileExplorerDecorator.provideFileDecoration);
            
            const decoration = await fileExplorerDecorator.provideFileDecoration(deepFileUri);
            
            console.log('TEST DEBUG: Full decoration object:', JSON.stringify(decoration, null, 2));
            console.log('TEST DEBUG: decoration type:', typeof decoration);
            console.log('TEST DEBUG: decoration properties:', decoration ? Object.keys(decoration) : 'undefined');
            console.log('TEST DEBUG: decoration.badge value:', decoration?.badge);
            console.log('TEST DEBUG: decoration.badge type:', typeof decoration?.badge);
            
            // Test what path-based settings returns
            const customEmojis = await pathBasedSettings.getCustomEmojisForPath(deepFileUri.fsPath);
            console.log('TEST DEBUG: customEmojis from pathBasedSettings:', JSON.stringify(customEmojis, null, 2));
            
            const threshold = await pathBasedSettings.getColorThresholdForPath(150, deepFileUri.fsPath);
            console.log('TEST DEBUG: threshold for 150 lines:', threshold);
            
            const themeEmoji = await pathBasedSettings.getThemeEmojiForPath(threshold, deepFileUri.fsPath);
            console.log('TEST DEBUG: themeEmoji for threshold:', themeEmoji);
            
            // Check actual character codes to verify encoding
            const expectedEmoji = '⚠️';
            console.log('TEST DEBUG: Expected emoji char codes:', Array.from(expectedEmoji).map(c => c.charCodeAt(0)));
            if (decoration?.badge) {
                console.log('TEST DEBUG: Actual badge char codes:', Array.from(decoration.badge).map(c => c.charCodeAt(0)));
                console.log('TEST DEBUG: Emojis match:', decoration.badge === expectedEmoji);
            }
            
            expect(decoration).to.not.be.undefined;
            expect(decoration!.badge).to.equal('⚠️'); // Should use components warning emoji
            
            // Test that it would use inherited settings for normal  
            const shortDeepFileUri = vscode.Uri.file(path.join(tempDir, 'src', 'components', 'icon.ts'));
            await fs.promises.mkdir(path.dirname(shortDeepFileUri.fsPath), { recursive: true });
            const shortContent = '// short file\nconst x = 1;\n'; // 3 lines - should be normal
            await fs.promises.writeFile(shortDeepFileUri.fsPath, shortContent);
            
            const shortDecoration = await fileExplorerDecorator.provideFileDecoration(shortDeepFileUri);
            expect(shortDecoration!.badge).to.equal('🟢'); // Should use src normal emoji
        });

        test('should handle missing intermediate settings gracefully', async () => {
            console.log('DEBUG: Starting missing intermediate test, cache keys:', Array.from((pathBasedSettings as any).workspaceServices.keys()));
            
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
            
            const deepFileUri = vscode.Uri.file(path.join(tempDir, 'src', 'components', 'test.ts'));
            await fs.promises.mkdir(path.dirname(deepFileUri.fsPath), { recursive: true });
            const testContent = '// test file\nconst x = 1;\nconst y = 2;\n'; // 4 lines - should be normal
            await fs.promises.writeFile(deepFileUri.fsPath, testContent);
            
            console.log('DEBUG: Before getResolvedSettings, cache keys:', Array.from((pathBasedSettings as any).workspaceServices.keys()));
            
            // Debug: Check what settings are actually being resolved
            const resolvedSettings = await pathBasedSettings.getResolvedSettings(deepFileUri.fsPath);
            console.log('Resolved settings for', deepFileUri.fsPath, ':', resolvedSettings['codeCounter.emojis.normal']);
            
            const decoration = await fileExplorerDecorator.provideFileDecoration(deepFileUri);
            
            expect(decoration).to.not.be.undefined;
            expect(decoration!.badge).to.equal('🟩'); // Should use deep directory setting
        });
    });
});