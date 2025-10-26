/**
 * Comprehensive Test Suite for DebugService
 *
 * Tests the debug service singleton functionality including:
 * - Singleton pattern implementation
 * - Backend switching (console, null)
 * - VS Code configuration integration
 * - Log level filtering and message formatting
 */

import { expect } from 'chai';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { DebugService, ConsoleBackend, NullBackend } from '../../services/debugService';

suite('DebugService Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let configurationStub: any;
    let workspaceGetConfigurationStub: sinon.SinonStub;
    let onDidChangeConfigurationStub: sinon.SinonStub;
    let mockContext: vscode.ExtensionContext;
    let disposableStub: any;

    setup(() => {
        sandbox = sinon.createSandbox();

        // Reset singleton for each test by clearing the internal instance
        // Note: This requires special handling since instance is private
        (DebugService as any).instance = null;

        // Mock VS Code configuration
        configurationStub = {
            get: sandbox.stub()
        };
        workspaceGetConfigurationStub = sandbox.stub(vscode.workspace, 'getConfiguration');
        workspaceGetConfigurationStub.withArgs('codeCounter').returns(configurationStub);

        // Mock configuration change listener
        disposableStub = {
            dispose: sandbox.stub()
        };
        onDidChangeConfigurationStub = sandbox.stub(vscode.workspace, 'onDidChangeConfiguration');
        onDidChangeConfigurationStub.returns(disposableStub);

        // Mock extension context
        mockContext = {
            subscriptions: []
        } as any;

        // Default configuration values
        configurationStub.get.withArgs('debug', 'none').returns('none');
    });

    teardown(() => {
        sandbox.restore();
        
        // Clean up singleton
        const instance = (DebugService as any).instance;
        if (instance) {
            instance.dispose();
            (DebugService as any).instance = null;
        }
    });

    test('should return the same instance on multiple calls', () => {
        const instance1 = DebugService.getInstance();
        const instance2 = DebugService.getInstance();
        expect(instance1).to.equal(instance2);
    });

    test('should initialize with VS Code configuration monitoring', () => {
        const debug = DebugService.getInstance();
        debug.initialize(mockContext);

        expect(workspaceGetConfigurationStub.calledWith('codeCounter')).to.be.true;
        expect(onDidChangeConfigurationStub.called).to.be.true;
        expect(mockContext.subscriptions).to.have.length(1);
    });

    test('should configure backend based on VS Code settings', () => {
        configurationStub.get.withArgs('debug', 'none').returns('console');
        
        const debug = DebugService.getInstance();
        debug.initialize(mockContext);

        expect(debug.getCurrentBackend()).to.equal('console');
    });

    test('should default to none backend when configuration is invalid', () => {
        configurationStub.get.withArgs('debug', 'none').returns('invalid');
        
        const debug = DebugService.getInstance();
        debug.initialize(mockContext);

        expect(debug.getCurrentBackend()).to.equal('none');
    });

    test('should respond to configuration changes', () => {
        const debug = DebugService.getInstance();
        debug.initialize(mockContext);

        // Simulate configuration change
        const configChangeCallback = onDidChangeConfigurationStub.getCall(0).args[0];
        const changeEvent = {
            affectsConfiguration: sandbox.stub().returns(true)
        };

        // Update configuration to console
        configurationStub.get.withArgs('debug', 'none').returns('console');
        
        configChangeCallback(changeEvent);

        expect(debug.getCurrentBackend()).to.equal('console');
    });

    suite('Console Backend Logging', () => {
        test('should set console backend correctly', () => {
            const debug = DebugService.getInstance();
            debug.configure('console');
            
            expect(debug.getCurrentBackend()).to.equal('console');
        });

        test('should set none backend correctly', () => {
            const debug = DebugService.getInstance();
            debug.configure('none');
            
            expect(debug.getCurrentBackend()).to.equal('none');
        });

        test('should default to info log level', () => {
            const debug = DebugService.getInstance();
            debug.configure('console');
            
            expect(debug.getCurrentLevel()).to.equal('info');
        });

        test('should accept custom log levels', () => {
            const debug = DebugService.getInstance();
            debug.configure('console', 'verbose');
            
            expect(debug.getCurrentLevel()).to.equal('verbose');
        });

        test('should not throw when logging with console backend', () => {
            const debug = DebugService.getInstance();
            debug.configure('console');
            
            expect(() => debug.error('Test error')).to.not.throw;
            expect(() => debug.warning('Test warning')).to.not.throw;
            expect(() => debug.info('Test info')).to.not.throw;
            expect(() => debug.verbose('Test verbose')).to.not.throw;
        });
    });

    suite('Null Backend Behavior', () => {
        let consoleStubs: any;

        setup(() => {
            // Stub console methods to ensure they're NOT called
            consoleStubs = {
                error: sandbox.stub(console, 'error'),
                warn: sandbox.stub(console, 'warn'),
                info: sandbox.stub(console, 'info'),
                log: sandbox.stub(console, 'log')
            };
        });

        test('should not log with none backend', () => {
            const debug = DebugService.getInstance();
            debug.configure('none');
            
            debug.error('Test error');
            debug.warning('Test warning');
            debug.info('Test info');
            debug.verbose('Test verbose');

            expect(consoleStubs.error.called).to.be.false;
            expect(consoleStubs.warn.called).to.be.false;
            expect(consoleStubs.info.called).to.be.false;
            expect(consoleStubs.log.called).to.be.false;
        });

        test('should return none as current backend', () => {
            const debug = DebugService.getInstance();
            debug.configure('none');
            
            expect(debug.getCurrentBackend()).to.equal('none');
        });
    });

    suite('Backend Classes', () => {
        suite('ConsoleBackend', () => {
            test('should not throw when logging', () => {
                const backend = new ConsoleBackend();
                
                expect(() => backend.error('Test message', 123)).to.not.throw;
                expect(() => backend.warning('Test warning')).to.not.throw;
                expect(() => backend.info('Test info')).to.not.throw;
                expect(() => backend.verbose('Test verbose')).to.not.throw;
            });

            test('should handle multiple arguments', () => {
                const backend = new ConsoleBackend();
                
                expect(() => backend.error('Error', { data: 'test' }, 'extra')).to.not.throw;
                expect(() => backend.warning('Warning', 123)).to.not.throw;
                expect(() => backend.info('Info', true, null)).to.not.throw;
                expect(() => backend.verbose('Verbose', [1, 2, 3])).to.not.throw;
            });
        });

        suite('NullBackend', () => {
            test('should not throw when called', () => {
                const backend = new NullBackend();
                
                expect(() => backend.error()).to.not.throw;
                expect(() => backend.warning()).to.not.throw;
                expect(() => backend.info()).to.not.throw;
                expect(() => backend.verbose()).to.not.throw;
            });

            test('should create instances successfully', () => {
                const backend = new NullBackend();
                expect(backend).to.be.an.instanceof(NullBackend);
            });
        });
    });

    suite('Dispose', () => {
        test('should clean up configuration listener', () => {
            const debug = DebugService.getInstance();
            debug.initialize(mockContext);
            
            debug.dispose();

            expect(disposableStub.dispose.called).to.be.true;
        });

        test('should handle dispose when not initialized', () => {
            const debug = DebugService.getInstance();
            
            expect(() => debug.dispose()).to.not.throw;
        });
    });

    suite('File Logging Backend Tests', () => {
        let tempDir: string;
        let workspaceFolders: any[];

        setup(() => {
            // Create a temporary directory for testing
            const fs = require('fs');
            const path = require('path');
            const os = require('os');
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'debug-service-test-'));
            
            // Create mock workspace folders
            workspaceFolders = [{
                uri: vscode.Uri.file(tempDir),
                name: 'test-workspace',
                index: 0
            }];
            
            // Mock vscode.workspace.workspaceFolders
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: workspaceFolders,
                configurable: true
            });
        });

        teardown(() => {
            // Clean up temporary directory
            const fs = require('fs');
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
            
            // Reset workspace folders
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: undefined,
                configurable: true
            });
        });

        test('should create debug log file when file backend is configured', () => {
            // Configure to use file logging
            configurationStub.get.withArgs('debug', 'none').returns('file');
            
            const debug = DebugService.getInstance();
            debug.initialize(mockContext);
            
            expect(debug.getCurrentBackend()).to.equal('file');
            expect(debug.isFileLoggingEnabled()).to.be.true;
            
            const logFilePath = debug.getLogFilePath();
            expect(logFilePath).to.not.be.null;
            expect(logFilePath).to.include('code-counter.debug.log');
            
            // Check that file exists
            const fs = require('fs');
            expect(fs.existsSync(logFilePath)).to.be.true;
        });

        test('should write log messages to file', () => {
            configurationStub.get.withArgs('debug', 'none').returns('file');
            
            const debug = DebugService.getInstance();
            debug.initialize(mockContext);
            
            const logFilePath = debug.getLogFilePath();
            
            debug.info('Test info message');
            debug.warning('Test warning message');
            debug.error('Test error message');
            debug.verbose('Test verbose message');
            
            // Read the log file content
            const fs = require('fs');
            const logContent = fs.readFileSync(logFilePath, 'utf8');
            
            expect(logContent).to.include('INFO: Test info message');
            expect(logContent).to.include('WARN: Test warning message');
            expect(logContent).to.include('ERROR: Test error message');
            expect(logContent).to.include('VERBOSE: Test verbose message');
        });

        test('should overwrite log file on initialization', () => {
            configurationStub.get.withArgs('debug', 'none').returns('file');
            
            const debug = DebugService.getInstance();
            debug.initialize(mockContext);
            
            const logFilePath = debug.getLogFilePath();
            
            debug.info('First message');
            
            const fs = require('fs');
            let logContent = fs.readFileSync(logFilePath, 'utf8');
            expect(logContent).to.include('First message');
            
            // Reconfigure (should overwrite)
            debug.configure('file');
            debug.info('Second message');
            
            logContent = fs.readFileSync(logFilePath, 'utf8');
            expect(logContent).to.include('Second message');
            expect(logContent).to.not.include('First message');
        });

        test('should clear log file when clearLog is called', () => {
            configurationStub.get.withArgs('debug', 'none').returns('file');
            
            const debug = DebugService.getInstance();
            debug.initialize(mockContext);
            
            const logFilePath = debug.getLogFilePath();
            
            debug.info('Message before clear');
            
            const fs = require('fs');
            let logContent = fs.readFileSync(logFilePath, 'utf8');
            expect(logContent).to.include('Message before clear');
            
            debug.clearLog();
            debug.info('Message after clear');
            
            logContent = fs.readFileSync(logFilePath, 'utf8');
            expect(logContent).to.include('Message after clear');
            expect(logContent).to.not.include('Message before clear');
        });

        test('should handle missing workspace folder gracefully', () => {
            // Set workspace folders to undefined
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: undefined,
                configurable: true
            });
            
            configurationStub.get.withArgs('debug', 'none').returns('file');
            
            const debug = DebugService.getInstance();
            debug.initialize(mockContext);
            
            expect(debug.getCurrentBackend()).to.equal('none'); // Should fallback to none
            expect(debug.isFileLoggingEnabled()).to.be.false;
            expect(debug.getLogFilePath()).to.be.null;
        });

        test('should handle backend switching with file logging', () => {
            const debug = DebugService.getInstance();
            debug.initialize(mockContext);
            
            // Start with none
            configurationStub.get.withArgs('debug', 'none').returns('none');
            debug.configure('none');
            expect(debug.getCurrentBackend()).to.equal('none');
            expect(debug.isFileLoggingEnabled()).to.be.false;
            
            // Switch to file
            debug.configure('file');
            expect(debug.getCurrentBackend()).to.equal('file');
            expect(debug.isFileLoggingEnabled()).to.be.true;
            
            const logFilePath = debug.getLogFilePath();
            expect(logFilePath).to.not.be.null;
            
            const fs = require('fs');
            expect(fs.existsSync(logFilePath)).to.be.true;
            
            // Switch back to console
            debug.configure('console');
            expect(debug.getCurrentBackend()).to.equal('console');
            expect(debug.isFileLoggingEnabled()).to.be.false;
            expect(debug.getLogFilePath()).to.be.null;
        });

        test('should create .vscode directory if it does not exist', () => {
            const path = require('path');
            const fs = require('fs');
            
            const vscodeDir = path.join(tempDir, '.vscode');
            expect(fs.existsSync(vscodeDir)).to.be.false;
            
            configurationStub.get.withArgs('debug', 'none').returns('file');
            
            const debug = DebugService.getInstance();
            debug.initialize(mockContext);
            
            expect(fs.existsSync(vscodeDir)).to.be.true;
            const logFilePath = debug.getLogFilePath();
            const expectedPath = path.resolve(path.join(vscodeDir, 'code-counter.debug.log'));
            expect(logFilePath).to.equal(expectedPath);
        });

        test('should include timestamp and proper formatting in log entries', () => {
            configurationStub.get.withArgs('debug', 'none').returns('file');
            
            const debug = DebugService.getInstance();
            debug.initialize(mockContext);
            
            const logFilePath = debug.getLogFilePath();
            
            const beforeTime = new Date();
            debug.info('Timestamp test message');
            const afterTime = new Date();
            
            const fs = require('fs');
            const logContent = fs.readFileSync(logFilePath, 'utf8');
            const lines = logContent.split('\n').filter((line: string) => line.includes('Timestamp test message'));
            
            expect(lines).to.have.length(1);
            const logLine = lines[0];
            
            // Extract timestamp from log line [YYYY-MM-DDTHH:mm:ss.sssZ]
            const timestampMatch = logLine.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/);
            expect(timestampMatch).to.not.be.null;
            
            const logTime = new Date(timestampMatch![1]);
            expect(logTime.getTime()).to.be.at.least(beforeTime.getTime() - 1000); // Allow 1s tolerance
            expect(logTime.getTime()).to.be.at.most(afterTime.getTime() + 1000);
        });

        test('should handle complex object serialization in file logging', () => {
            configurationStub.get.withArgs('debug', 'none').returns('file');
            
            const debug = DebugService.getInstance();
            debug.initialize(mockContext);
            
            const logFilePath = debug.getLogFilePath();
            
            const complexObject = {
                nested: {
                    array: [1, 2, 3],
                    string: 'test',
                    boolean: true
                }
            };
            
            debug.info('Complex object test', complexObject);
            
            const fs = require('fs');
            const logContent = fs.readFileSync(logFilePath, 'utf8');
            expect(logContent).to.include('Complex object test');
            expect(logContent).to.include('"nested"');
            expect(logContent).to.include('"array"');
            expect(logContent).to.include('1');
        });
    });
});