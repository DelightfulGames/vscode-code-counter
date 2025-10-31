/**
 * Test Command for File Exclusion Decorator Refresh
 * 
 * This command can be used to test if file exclusion from context menu 
 * properly refreshes the file decorator immediately.
 */

import * as vscode from 'vscode';
import { PatternHandler } from '../handlers/patternHandler';

export class TestExclusionCommand {
    /**
     * Test exclusion of current file and verify decorator refresh
     */
    static async testCurrentFileExclusion(): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        
        if (!activeEditor) {
            vscode.window.showErrorMessage('No active editor. Please open a file to test exclusion.');
            return;
        }
        
        const fileUri = activeEditor.document.uri;
        
        if (fileUri.scheme !== 'file') {
            vscode.window.showErrorMessage('Cannot test exclusion on non-file URIs');
            return;
        }
        
        try {
            // Show info before excluding
            vscode.window.showInformationMessage(`Testing exclusion of: ${fileUri.fsPath}`);
            
            // Add exclusion pattern (this should trigger decorator refresh)
            await PatternHandler.handleExcludeRelativePath(fileUri);
            
            // Give a moment for the refresh to take effect
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Show completion message
            vscode.window.showInformationMessage(
                `Exclusion test completed. Check if the file decorator has been removed for: ${vscode.workspace.asRelativePath(fileUri)}`
            );
            
        } catch (error) {
            vscode.window.showErrorMessage(`Test failed: ${error}`);
        }
    }
}