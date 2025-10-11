/**
 * Comprehensive VS Code API Mock for Testing
 * This mock provides the VS Code APIs needed for running tests outside of the VS Code environment
 */

import { EventEmitter } from 'events';

// Mock VS Code Types and Interfaces
interface MockUri {
    fsPath: string;
    scheme: string;
    authority: string;
    path: string;
    query: string;
    fragment: string;
}

interface MockWebview {
    html: string;
    onDidReceiveMessage: (callback: (message: any) => void) => { dispose: () => void };
    postMessage: (message: any) => Promise<boolean>;
}

interface MockWebviewPanel {
    webview: MockWebview;
    reveal: (viewColumn?: number) => void;
    dispose: () => void;
    onDidDispose: (callback: () => void) => { dispose: () => void };
}

interface MockTextDocument {
    uri: MockUri;
    fileName: string;
    languageId: string;
    version: number;
    getText: () => string;
    lineCount: number;
}

interface MockWorkspaceFolder {
    uri: MockUri;
    name: string;
    index: number;
}

interface MockFileSystemWatcher {
    onDidCreate: (callback: (uri: MockUri) => void) => { dispose: () => void };
    onDidDelete: (callback: (uri: MockUri) => void) => { dispose: () => void };
    onDidChange: (callback: (uri: MockUri) => void) => { dispose: () => void };
    dispose: () => void;
}

interface MockStatusBarItem {
    text: string;
    tooltip: string;
    backgroundColor: any;
    show: () => void;
    hide: () => void;
    dispose: () => void;
}

interface MockConfiguration {
    get: <T>(section: string, defaultValue?: T) => T;
    has: (section: string) => boolean;
    inspect: (section: string) => any;
    update: (section: string, value: any) => Promise<void>;
}

interface MockConfigurationChangeEvent {
    affectsConfiguration: (section: string) => boolean;
}

// Create the mock VS Code module
export const createVSCodeMock = () => {
    const mockEventEmitter = new EventEmitter();
    
    // Mock disposables list
    const disposables: Array<{ dispose: () => void }> = [];
    
    const mockUri = (path: string): MockUri => ({
        fsPath: path,
        scheme: 'file',
        authority: '',
        path: path,
        query: '',
        fragment: ''
    });

    const mockWebview: MockWebview = {
        html: '',
        onDidReceiveMessage: (callback) => {
            mockEventEmitter.on('webview-message', callback);
            const disposable = { dispose: () => mockEventEmitter.off('webview-message', callback) };
            disposables.push(disposable);
            return disposable;
        },
        postMessage: async (message) => {
            mockEventEmitter.emit('webview-post-message', message);
            return true;
        }
    };

    const mockWebviewPanel: MockWebviewPanel = {
        webview: mockWebview,
        reveal: (viewColumn) => {
            mockEventEmitter.emit('panel-revealed', { viewColumn });
        },
        dispose: () => {
            mockEventEmitter.emit('panel-disposed');
        },
        onDidDispose: (callback) => {
            mockEventEmitter.on('panel-disposed', callback);
            const disposable = { dispose: () => mockEventEmitter.off('panel-disposed', callback) };
            disposables.push(disposable);
            return disposable;
        }
    };

    const mockStatusBarItem: MockStatusBarItem = {
        text: '',
        tooltip: '',
        backgroundColor: undefined,
        show: () => mockEventEmitter.emit('statusbar-show'),
        hide: () => mockEventEmitter.emit('statusbar-hide'),
        dispose: () => mockEventEmitter.emit('statusbar-dispose')
    };

    const mockConfiguration: MockConfiguration = {
        get: <T>(section: string, defaultValue?: T): T => {
            // Return sensible defaults for common configuration keys
            const configs: { [key: string]: any } = {
                'codeCounter.excludePatterns': ['**/node_modules/**', '**/out/**', '**/dist/**', '**/.git/**'],
                'codeCounter.outputDirectory': './code-counter-output',
                'codeCounter.showLineCountsInExplorer': true,
                'codeCounter.showLineCountsInTabs': true,
                'codeCounter.lineThresholds.warning': 300,
                'codeCounter.lineThresholds.danger': 1000,
                'codeCounter.emojis.normal': '📄',
                'codeCounter.emojis.warning': '⚠️',
                'codeCounter.emojis.danger': '🚨',
                'codeCounter.emojis.folders.normal': '📁',
                'codeCounter.emojis.folders.warning': '⚠️',
                'codeCounter.emojis.folders.danger': '🚨'
            };
            return configs[section] ?? defaultValue as T;
        },
        has: (section: string) => true,
        inspect: (section: string) => ({ key: section }),
        update: async (section: string, value: any) => {
            mockEventEmitter.emit('config-updated', { section, value });
        }
    };

    const mockFileSystemWatcher: MockFileSystemWatcher = {
        onDidCreate: (callback) => {
            mockEventEmitter.on('fs-create', callback);
            const disposable = { dispose: () => mockEventEmitter.off('fs-create', callback) };
            disposables.push(disposable);
            return disposable;
        },
        onDidDelete: (callback) => {
            mockEventEmitter.on('fs-delete', callback);
            const disposable = { dispose: () => mockEventEmitter.off('fs-delete', callback) };
            disposables.push(disposable);
            return disposable;
        },
        onDidChange: (callback) => {
            mockEventEmitter.on('fs-change', callback);
            const disposable = { dispose: () => mockEventEmitter.off('fs-change', callback) };
            disposables.push(disposable);
            return disposable;
        },
        dispose: () => {
            mockEventEmitter.emit('fs-watcher-dispose');
        }
    };

    const mockWorkspaceFolder: MockWorkspaceFolder = {
        uri: mockUri('/mock/workspace'),
        name: 'mock-workspace',
        index: 0
    };

    // Main VS Code mock object
    const vscode = {
        // Constants and Enums
        ViewColumn: {
            One: 1,
            Two: 2,
            Three: 3,
            Active: -1,
            Beside: -2
        },
        
        StatusBarAlignment: {
            Left: 1,
            Right: 2
        },

        FileType: {
            Unknown: 0,
            File: 1,
            Directory: 2,
            SymbolicLink: 64
        },

        // Window API
        window: {
            createWebviewPanel: (viewType: string, title: string, viewColumn: number, options: any) => {
                mockEventEmitter.emit('webview-panel-created', { viewType, title, viewColumn, options });
                return mockWebviewPanel;
            },
            
            createStatusBarItem: (alignment: number, priority?: number) => {
                mockEventEmitter.emit('statusbar-created', { alignment, priority });
                return mockStatusBarItem;
            },

            showInformationMessage: (message: string) => {
                mockEventEmitter.emit('info-message', message);
                return Promise.resolve(undefined);
            },

            showErrorMessage: (message: string) => {
                mockEventEmitter.emit('error-message', message);
                return Promise.resolve(undefined);
            },

            showWarningMessage: (message: string) => {
                mockEventEmitter.emit('warning-message', message);
                return Promise.resolve(undefined);
            },

            showQuickPick: (items: any[], options?: any) => {
                mockEventEmitter.emit('quick-pick', { items, options });
                return Promise.resolve(items[0]); // Return first item by default
            },

            showSaveDialog: (options: any) => {
                mockEventEmitter.emit('save-dialog', options);
                return Promise.resolve(mockUri('/mock/save/path.json'));
            },

            showOpenDialog: (options: any) => {
                mockEventEmitter.emit('open-dialog', options);
                return Promise.resolve([mockUri('/mock/open/path')]);
            },

            onDidChangeActiveTextEditor: (callback: (editor: any) => void) => {
                mockEventEmitter.on('active-editor-changed', callback);
                const disposable = { dispose: () => mockEventEmitter.off('active-editor-changed', callback) };
                disposables.push(disposable);
                return disposable;
            },

            activeTextEditor: undefined
        },

        // Workspace API
        workspace: {
            getConfiguration: (section?: string) => mockConfiguration,
            
            onDidChangeConfiguration: (callback: (event: MockConfigurationChangeEvent) => void) => {
                mockEventEmitter.on('config-changed', callback);
                const disposable = { dispose: () => mockEventEmitter.off('config-changed', callback) };
                disposables.push(disposable);
                return disposable;
            },

            onDidSaveTextDocument: (callback: (document: MockTextDocument) => void) => {
                mockEventEmitter.on('document-saved', callback);
                const disposable = { dispose: () => mockEventEmitter.off('document-saved', callback) };
                disposables.push(disposable);
                return disposable;
            },

            createFileSystemWatcher: (pattern: string) => {
                mockEventEmitter.emit('fs-watcher-created', pattern);
                return mockFileSystemWatcher;
            },

            getWorkspaceFolder: (uri: MockUri) => {
                return mockWorkspaceFolder;
            },

            workspaceFolders: [mockWorkspaceFolder],

            findFiles: async (include: string | any, exclude?: any, maxResults?: number) => {
                mockEventEmitter.emit('find-files', { include, exclude, maxResults });
                // Return some mock file URIs for testing
                return [
                    mockUri('/mock/workspace/src/test.js'),
                    mockUri('/mock/workspace/src/app.ts'),
                    mockUri('/mock/workspace/README.md')
                ];
            },

            fs: {
                writeFile: async (uri: MockUri, content: Buffer) => {
                    mockEventEmitter.emit('fs-write', { uri, content });
                    return Promise.resolve();
                },

                readFile: async (uri: MockUri) => {
                    mockEventEmitter.emit('fs-read', uri);
                    return Promise.resolve(Buffer.from('mock file content'));
                },

                stat: async (uri: MockUri) => {
                    mockEventEmitter.emit('fs-stat', uri);
                    return Promise.resolve({
                        type: 1, // FileType.File
                        size: 1024,
                        ctime: Date.now(),
                        mtime: Date.now()
                    });
                }
            }
        },

        // Commands API
        commands: {
            executeCommand: (command: string, ...args: any[]) => {
                mockEventEmitter.emit('command-executed', { command, args });
                return Promise.resolve();
            },

            registerCommand: (command: string, callback: (...args: any[]) => any) => {
                mockEventEmitter.emit('command-registered', { command });
                const disposable = { dispose: () => mockEventEmitter.off('command-registered', callback) };
                disposables.push(disposable);
                return disposable;
            }
        },

        // Uri API
        Uri: {
            file: (path: string) => mockUri(path),
            parse: (value: string) => mockUri(value)
        },

        // RelativePattern API
        RelativePattern: class MockRelativePattern {
            constructor(public base: string, public pattern: string) {}
        },

        // EventEmitter for testing
        EventEmitter: class MockEventEmitter {
            private emitter = new EventEmitter();
            
            get event() {
                return (listener: (...args: any[]) => void) => {
                    this.emitter.on('event', listener);
                    return { dispose: () => this.emitter.off('event', listener) };
                };
            }
            
            fire(data?: any) {
                this.emitter.emit('event', data);
            }
        },

        // Extensions API
        extensions: {
            getExtension: (extensionId: string) => undefined
        },

        // Test utilities
        _mockEventEmitter: mockEventEmitter,
        _mockWebviewPanel: mockWebviewPanel,
        _mockConfiguration: mockConfiguration,
        _disposables: disposables,
        _clearMocks: () => {
            mockEventEmitter.removeAllListeners();
            disposables.length = 0;
            mockWebview.html = '';
            mockStatusBarItem.text = '';
            mockStatusBarItem.tooltip = '';
        }
    };

    return vscode;
};

// Export the mock for use in tests
export const mockVSCode = createVSCodeMock();

// Auto-install the mock when this module is imported
if (typeof global !== 'undefined') {
    // Node.js environment - install as global mock
    (global as any).vscode = mockVSCode;
}

export default mockVSCode;