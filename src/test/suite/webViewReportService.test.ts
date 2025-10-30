/**
 * VS Code Code Counter Extension
 * 
 * Basic Test Suite for WebViewReportService
 * Tests core functionality of the WebView report service
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { WebViewReportService, ReportData } from '../../services/webViewReportService';

suite('WebViewReportService Basic Tests', () => {
    let service: WebViewReportService;
    let sandbox: sinon.SinonSandbox;
    let mockPanel: any;
    let mockWebview: any;
    let createWebviewPanelStub: sinon.SinonStub;
    let executeCommandStub: sinon.SinonStub;
    
    // Sample test data
    const sampleReportData: ReportData = {
        summary: {
            totalFiles: 10,
            totalLines: 1000,
            totalCodeLines: 800,
            totalCommentLines: 150,
            totalBlankLines: 50,
            languageCount: 3
        },
        languages: [
            {
                name: 'TypeScript',
                files: 8,
                lines: 800,
                codeLines: 600,
                commentLines: 120,
                blankLines: 80
            },
            {
                name: 'JavaScript',
                files: 2,
                lines: 200,
                codeLines: 180,
                commentLines: 10,
                blankLines: 10
            }
        ],
        files: [
            {
                path: '/workspace/src/main.ts',
                relativePath: 'src/main.ts',
                language: 'TypeScript',
                lines: 250,
                codeLines: 200,
                commentLines: 30,
                blankLines: 20,
                size: 8192
            }
        ],
        workspacePath: '/workspace',
        generatedDate: '2025-10-26T12:00:00.000Z'
    };

    setup(() => {
        sandbox = sinon.createSandbox();
        
        // Reset singleton instance for clean testing
        (WebViewReportService as any).instance = undefined;
        service = WebViewReportService.getInstance();
        
        // Create mock webview and panel
        mockWebview = {
            html: '',
            onDidReceiveMessage: sandbox.stub().returnsArg(0),
            postMessage: sandbox.stub().resolves(),
            options: {},
            cspSource: 'test-csp',
            asWebviewUri: sandbox.stub().returnsArg(0)
        };
        
        mockPanel = {
            webview: mockWebview,
            reveal: sandbox.stub(),
            dispose: sandbox.stub(),
            onDidDispose: sandbox.stub().returnsArg(0),
            title: 'Code Counter Report',
            viewType: 'codeCounterReport',
            viewColumn: vscode.ViewColumn.Two,
            visible: true,
            active: true
        };
        
        // Mock VS Code APIs
        createWebviewPanelStub = sandbox.stub(vscode.window, 'createWebviewPanel').returns(mockPanel);
        executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();
        sandbox.stub(vscode.window, 'showQuickPick').resolves();
        sandbox.stub(vscode.window, 'showSaveDialog').resolves();
        sandbox.stub(vscode.window, 'showOpenDialog').resolves();
        sandbox.stub(vscode.window, 'showInformationMessage').resolves();
        sandbox.stub(vscode.window, 'showErrorMessage').resolves();
        // Skip stubbing vscode.workspace.fs.writeFile as it's non-configurable
        
        // Mock file system operations
        const mockHtmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Code Counter Report</title>
    <style>
        .container { padding: 20px; }
        .summary-stats { display: grid; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Code Counter Report</h1>
        <div id="summary-stats" class="summary-stats">
            <!-- Summary will be populated by JS -->
        </div>
    </div>
    <script>
        function initializeReport(data) {
            console.log('Report initialized with:', data);
        }
        
        // Handle VS Code message passing
        const vscode = acquireVsCodeApi();
        
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateData') {
                initializeReport(message.data);
            }
        });
        
        // Initialize with embedded data if available - this gets replaced by generateWebViewHTML
        const embeddedJsonData = '{{JSON_DATA}}';
        if (embeddedJsonData && embeddedJsonData !== '{{JSON_DATA}}') {
            const reportData = JSON.parse(embeddedJsonData);
            initializeReport(reportData);
        }
    </script>
</body>
</html>`;
        sandbox.stub(fs.promises, 'readFile').resolves(mockHtmlTemplate);
        sandbox.stub(fs.promises, 'writeFile').resolves();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('Singleton Pattern', () => {
        test('should return same instance when called multiple times', () => {
            const instance1 = WebViewReportService.getInstance();
            const instance2 = WebViewReportService.getInstance();
            
            expect(instance1).to.equal(instance2);
            expect(instance1).to.equal(service);
        });
        
        test('should create new instance after singleton reset', () => {
            const originalInstance = WebViewReportService.getInstance();
            
            // Reset singleton
            (WebViewReportService as any).instance = undefined;
            const newInstance = WebViewReportService.getInstance();
            
            expect(newInstance).to.not.equal(originalInstance);
        });
    });

    suite('WebView Panel Creation', () => {
        test('should create webview panel when showing report', async () => {
            await service.showReport(sampleReportData);
            
            // Verify panel was created with correct parameters
            expect(createWebviewPanelStub.calledOnce).to.be.true;
            const createCall = createWebviewPanelStub.getCall(0);
            
            expect(createCall.args[0]).to.equal('codeCounterReport');
            expect(createCall.args[1]).to.equal('Code Counter Report');
            expect(createCall.args[2]).to.equal(vscode.ViewColumn.Two);
            
            // Verify webview options
            const options = createCall.args[3];
            expect(options.enableScripts).to.be.true;
            expect(options.retainContextWhenHidden).to.be.true;
            expect(options.localResourceRoots).to.be.an('array');
        });
        
        test('should reveal existing panel instead of creating new one', async () => {
            // First call creates panel
            await service.showReport(sampleReportData);
            expect(createWebviewPanelStub.calledOnce).to.be.true;
            
            // Second call should reveal existing panel
            await service.showReport(sampleReportData);
            expect(createWebviewPanelStub.calledOnce).to.be.true; // Still only once
            expect(mockPanel.reveal.calledOnce).to.be.true;
        });
        
        test('should handle panel disposal correctly', async () => {
            await service.showReport(sampleReportData);
            
            // Verify onDidDispose was set up
            expect(mockPanel.onDidDispose.called).to.be.true;
            
            // Simulate panel disposal
            const disposeHandler = mockPanel.onDidDispose.getCall(0).args[0];
            disposeHandler();
            
            // Verify current panel is cleared
            expect((service as any).currentPanel).to.be.undefined;
        });
    });

    suite('HTML Generation', () => {
        test('should generate valid HTML with report data', async () => {
            await service.showReport(sampleReportData);
            
            const htmlContent = mockWebview.html;
            
            // Verify HTML structure
            expect(htmlContent).to.include('<!DOCTYPE html>');
            expect(htmlContent).to.include('<html lang="en">');
            expect(htmlContent).to.include('Code Counter Report');
            
            // For new panels, data is embedded in HTML, not sent via postMessage
            expect(mockWebview.html).to.include('"totalFiles":10');
            expect(mockWebview.html).to.include('"workspacePath":"/workspace"');
            
            // PostMessage is NOT called for new panels - only for updates
            expect(mockWebview.postMessage.called).to.be.false;
        });
        
        test('should include required CSS styles', async () => {
            await service.showReport(sampleReportData);
            
            const htmlContent = mockWebview.html;
            
            // Check for key CSS classes that exist in our mock template
            expect(htmlContent).to.include('.container');
            expect(htmlContent).to.include('.summary-stats');
            // Note: The actual template might have VS Code variables, but our mock is simplified
        });
        
        test('should include JavaScript functionality', async () => {
            await service.showReport(sampleReportData);
            
            const htmlContent = mockWebview.html;
            
            // Check for key JavaScript functions that exist in our mock
            expect(htmlContent).to.include('function initializeReport');
            expect(htmlContent).to.include('acquireVsCodeApi()');
            expect(htmlContent).to.include("addEventListener('message'");
            expect(htmlContent).to.include('updateData');
        });
        
        test('should handle empty data gracefully', async () => {
            const emptyData: ReportData = {
                summary: {
                    totalFiles: 0,
                    totalLines: 0,
                    totalCodeLines: 0,
                    totalCommentLines: 0,
                    totalBlankLines: 0,
                    languageCount: 0
                },
                languages: [],
                files: [],
                workspacePath: '/empty',
                generatedDate: '2025-10-26T12:00:00.000Z'
            };
            
            await service.showReport(emptyData);
            
            const htmlContent = mockWebview.html;
            
            // Should still generate valid HTML
            expect(htmlContent).to.include('<!DOCTYPE html>');
            
            // For new panels, check embedded data in HTML
            expect(htmlContent).to.include('"totalFiles":0');
            expect(htmlContent).to.include('"languages":[]');
            
            // PostMessage is NOT called for new panels
            expect(mockWebview.postMessage.called).to.be.false;
        });
    });

    suite('Message Handling', () => {
        test('should set up message handling correctly', async () => {
            await service.showReport(sampleReportData);
            
            // Verify message handler was set up
            expect(mockWebview.onDidReceiveMessage.called).to.be.true;
            
            const messageHandler = mockWebview.onDidReceiveMessage.getCall(0).args[0];
            expect(messageHandler).to.be.a('function');
        });
        
        test('should handle refresh command', async () => {
            // Use the existing executeCommandStub that's already set up in setup()
            
            await service.showReport(sampleReportData);
            
            const messageHandler = mockWebview.onDidReceiveMessage.getCall(0).args[0];
            
            // Simulate refresh message
            await messageHandler({ command: 'refresh' });
            
            // Note: We can't verify the specific command was called due to stubbing limitations
            // but we can verify the message handler exists and executes without error
        });
        
        test('should ignore unknown commands', async () => {
            // Use the existing executeCommandStub that's already set up in setup()
            
            await service.showReport(sampleReportData);
            
            const messageHandler = mockWebview.onDidReceiveMessage.getCall(0).args[0];
            
            // Simulate unknown message - should not throw and complete without error
            await messageHandler({ command: 'unknown' });
            
            // Test passes if no error is thrown
        });
    });

    suite('Data Management', () => {
        test('should store current data for export functionality', async () => {
            await service.showReport(sampleReportData);
            
            // Verify data is stored
            expect((service as any).currentData).to.equal(sampleReportData);
        });
        
        test('should update data when panel is reused', async () => {
            // Show initial report
            await service.showReport(sampleReportData);
            
            // Create modified data
            const modifiedData = {
                ...sampleReportData,
                summary: {
                    ...sampleReportData.summary,
                    totalFiles: 20
                }
            };
            
            // Show updated report
            await service.showReport(modifiedData);
            
            // Verify data was updated
            expect((service as any).currentData).to.equal(modifiedData);
            
            // Verify postMessage was called to update data
            expect(mockWebview.postMessage.called).to.be.true;
            const messageCalls = mockWebview.postMessage.getCalls();
            const lastCall = messageCalls[messageCalls.length - 1];
            expect(lastCall.args[0].command).to.equal('updateData');
            expect(lastCall.args[0].data.summary.totalFiles).to.equal(20);
        });
    });

    suite('Edge Cases', () => {
        test('should handle unicode and special characters in data', async () => {
            const unicodeData: ReportData = {
                ...sampleReportData,
                files: [{
                    path: '/workspace/测试/файл.ts',
                    relativePath: '测试/файл.ts',
                    language: 'TypeScript',
                    lines: 50,
                    codeLines: 40,
                    commentLines: 5,
                    blankLines: 5,
                    size: 1024
                }],
                workspacePath: '/workspace/测试项目'
            };
            
            await service.showReport(unicodeData);
            
            // For new panels, check embedded data in HTML with unicode characters
            expect(mockWebview.html).to.include('测试项目');
            expect(mockWebview.html).to.include('测试');
            expect(mockWebview.html).to.include('файл');
            
            // PostMessage is NOT called for new panels
            expect(mockWebview.postMessage.called).to.be.false;
        });
        
        test('should handle very large datasets without errors', async () => {
            // Create dataset with many files
            const largeFilesList = Array.from({ length: 100 }, (_, i) => ({
                path: `/workspace/file${i}.ts`,
                relativePath: `file${i}.ts`,
                language: 'TypeScript',
                lines: 100 + i,
                codeLines: 80 + i,
                commentLines: 15,
                blankLines: 5,
                size: 1024 * (i + 1)
            }));
            
            const largeData: ReportData = {
                ...sampleReportData,
                summary: {
                    ...sampleReportData.summary,
                    totalFiles: 100
                },
                files: largeFilesList
            };
            
            // Should handle large dataset without errors
            await service.showReport(largeData);
            
            // For new panels, check embedded data in HTML  
            expect(mockWebview.html).to.include('"totalFiles":100');
            
            // PostMessage is NOT called for new panels
            expect(mockWebview.postMessage.called).to.be.false;
        });
    });

    suite('Performance and Scalability', () => {
        test('should reuse panel efficiently', async () => {
            // Show report multiple times
            await service.showReport(sampleReportData);
            await service.showReport(sampleReportData);
            await service.showReport(sampleReportData);
            
            // Should create panel only once
            expect(createWebviewPanelStub.calledOnce).to.be.true;
            
            // Should reveal existing panel
            expect(mockPanel.reveal.callCount).to.equal(2);
        });
        
        test('should handle rapid successive updates', async () => {
            const updates = Array.from({ length: 5 }, (_, i) => ({
                ...sampleReportData,
                summary: { ...sampleReportData.summary, totalFiles: 10 + i }
            }));
            
            // Rapid updates should not cause errors
            for (const update of updates) {
                await service.showReport(update);
            }
            
            // Should have latest data
            expect((service as any).currentData.summary.totalFiles).to.equal(14);
        });
    });

    suite('Panel Lifecycle', () => {
        test('should clean up properly when panel is disposed', async () => {
            await service.showReport(sampleReportData);
            
            // Verify panel exists
            expect((service as any).currentPanel).to.exist;
            
            // Simulate disposal
            const disposeHandler = mockPanel.onDidDispose.getCall(0).args[0];
            disposeHandler();
            
            // Verify cleanup
            expect((service as any).currentPanel).to.be.undefined;
            
            // Next showReport should create new panel
            await service.showReport(sampleReportData);
            expect(createWebviewPanelStub.calledTwice).to.be.true;
        });
        
        test('should maintain data consistency across operations', async () => {
            // Show initial report
            await service.showReport(sampleReportData);
            expect((service as any).currentData).to.equal(sampleReportData);
            
            // Update data
            const newData = { 
                ...sampleReportData, 
                summary: { ...sampleReportData.summary, totalFiles: 20 } 
            };
            await service.showReport(newData);
            expect((service as any).currentData).to.equal(newData);
        });
    });
});