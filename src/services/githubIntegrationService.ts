/**
 * VS Code Code Counter Extension - GitHub Integration Service
 * 
 * Copyright (c) 2025 DelightfulGames
 * Licensed under the MIT License
 * 
 * Repository: https://github.com/DelightfulGames/vscode-code-counter
 * Marketplace: https://marketplace.visualstudio.com/items?itemName=DelightfulGames.vscode-code-counter
 */

import * as vscode from 'vscode';
import * as https from 'https';
import { DebugService } from './debugService';

/**
 * Service for handling GitHub integration and issue creation
 */
export class GitHubIntegrationService {
    private static instance: GitHubIntegrationService | undefined;
    private readonly debug = DebugService.getInstance();

    private constructor() {}

    public static getInstance(): GitHubIntegrationService {
        if (!GitHubIntegrationService.instance) {
            GitHubIntegrationService.instance = new GitHubIntegrationService();
        }
        return GitHubIntegrationService.instance;
    }

    /**
     * Search for existing language support issues on GitHub
     */
    public async searchLanguageIssues(fileExtension: string): Promise<{
        exists: boolean;
        issueUrl?: string;
        searchUrl: string;
    }> {
        const searchQuery = `repo:DelightfulGames/vscode-code-counter is:issue label:enhancement ${fileExtension} language support`;
        const encodedQuery = encodeURIComponent(searchQuery);
        const searchUrl = `https://github.com/DelightfulGames/vscode-code-counter/issues?q=${encodedQuery}`;

        this.debug.info(`Searching GitHub for language support issues: ${fileExtension}`);

        try {
            // Make a lightweight search to check if similar issues exist
            const apiUrl = `https://api.github.com/search/issues?q=${encodedQuery}`;
            const searchResults = await this.makeGitHubAPICall(apiUrl);

            if (searchResults && searchResults.items && searchResults.items.length > 0) {
                // Found existing issues
                const existingIssue = searchResults.items[0];
                return {
                    exists: true,
                    issueUrl: existingIssue.html_url,
                    searchUrl: searchUrl
                };
            }

            return {
                exists: false,
                searchUrl: searchUrl
            };
        } catch (error) {
            this.debug.warning(`GitHub search failed for ${fileExtension}:`, error);
            // Return search URL as fallback
            return {
                exists: false,
                searchUrl: searchUrl
            };
        }
    }

    /**
     * Create a new GitHub issue for language support request
     */
    public async createLanguageSupportIssue(fileExtension: string, filePath: string): Promise<string> {
        const title = `[Language Request] Add support for ${fileExtension} files`;
        const body = this.generateIssueBody(fileExtension, filePath);
        
        const issueUrl = `https://github.com/DelightfulGames/vscode-code-counter/issues/new?` +
            `title=${encodeURIComponent(title)}&` +
            `body=${encodeURIComponent(body)}&` +
            `labels=enhancement,language-request`;

        this.debug.info(`Generated GitHub issue creation URL for ${fileExtension}`);
        
        return issueUrl;
    }

    /**
     * Show GitHub integration dialog with options
     */
    public async showGitHubIntegrationDialog(fileExtension: string, filePath: string): Promise<void> {
        const searchProgress = vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Searching for existing ${fileExtension} support requests...`,
            cancellable: true
        }, async (progress, token) => {
            try {
                progress.report({ increment: 0 });
                
                // Check if user canceled
                if (token.isCancellationRequested) {
                    return;
                }
                
                progress.report({ increment: 50 });
                
                // Search for existing issues
                const searchResults = await this.searchLanguageIssues(fileExtension);
                
                progress.report({ increment: 100 });
                
                // Show appropriate dialog based on search results
                if (searchResults.exists && searchResults.issueUrl) {
                    await this.showExistingIssueDialog(fileExtension, searchResults.issueUrl, searchResults.searchUrl);
                } else {
                    await this.showNewIssueDialog(fileExtension, filePath, searchResults.searchUrl);
                }
            } catch (error) {
                this.debug.error('GitHub integration dialog error:', error);
                vscode.window.showErrorMessage(
                    `Failed to search GitHub issues: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
            }
        });

        await searchProgress;
    }

    /**
     * Show dialog when existing issue is found
     */
    private async showExistingIssueDialog(fileExtension: string, issueUrl: string, searchUrl: string): Promise<void> {
        const result = await vscode.window.showInformationMessage(
            `Found existing ${fileExtension} language support request on GitHub.`,
            {
                modal: true,
                detail: 'An issue for this language extension already exists. You can view it or search for more related issues.'
            },
            'View Existing Issue',
            'Search All Issues',
            'Cancel'
        );

        switch (result) {
            case 'View Existing Issue':
                await vscode.env.openExternal(vscode.Uri.parse(issueUrl));
                break;
            case 'Search All Issues':
                await vscode.env.openExternal(vscode.Uri.parse(searchUrl));
                break;
        }
    }

    /**
     * Show dialog when no existing issue is found
     */
    private async showNewIssueDialog(fileExtension: string, filePath: string, searchUrl: string): Promise<void> {
        const result = await vscode.window.showInformationMessage(
            `No existing ${fileExtension} language support requests found.`,
            {
                modal: true,
                detail: 'Would you like to create a new issue to request support for this language?'
            },
            'Create New Issue',
            'Search Issues',
            'Cancel'
        );

        switch (result) {
            case 'Create New Issue':
                const issueUrl = await this.createLanguageSupportIssue(fileExtension, filePath);
                await vscode.env.openExternal(vscode.Uri.parse(issueUrl));
                break;
            case 'Search Issues':
                await vscode.env.openExternal(vscode.Uri.parse(searchUrl));
                break;
        }
    }

    /**
     * Generate issue body with system information and context
     */
    private generateIssueBody(fileExtension: string, filePath: string): string {
        const systemInfo = this.getSystemInfo();
        const fileName = filePath.split(/[\\/]/).pop() || 'unknown';
        
        // Use simple formatting that won't cause encoding issues
        return `Language Support Request

File Extension: ${fileExtension}
Example File: ${fileName}

Description:
Please add support for ${fileExtension} files to VS Code Code Counter.

Use Case:
I encountered this file type while using Code Counter and would like it to be included in line counting and analysis.

System Information:
${systemInfo}

Additional Context:
- File discovered through Code Counter's file explorer
- Currently shows as unsupported with question mark badge
- Generated automatically via Code Counter extension

This issue was created automatically through VS Code Code Counter extension v1.1.0`;
    }

    /**
     * Get system information for issue context
     */
    private getSystemInfo(): string {
        const extension = vscode.extensions.getExtension('DelightfulGames.vscode-code-counter');
        const extensionVersion = extension?.packageJSON?.version || 'unknown';
        const vscodeVersion = vscode.version;
        const platform = process.platform;
        const arch = process.arch;

        return `VS Code Version: ${vscodeVersion}
Code Counter Version: ${extensionVersion}
Platform: ${platform}
Architecture: ${arch}`;
    }

    /**
     * Make GitHub API call with timeout and error handling
     */
    private async makeGitHubAPICall(url: string, timeoutMs: number = 10000): Promise<any> {
        return new Promise((resolve, reject) => {
            const request = https.get(url, {
                headers: {
                    'User-Agent': 'VSCode-CodeCounter-Extension',
                    'Accept': 'application/vnd.github.v3+json'
                },
                timeout: timeoutMs
            }, (response) => {
                let data = '';
                
                response.on('data', (chunk) => {
                    data += chunk;
                });
                
                response.on('end', () => {
                    try {
                        if (response.statusCode === 200) {
                            const jsonData = JSON.parse(data);
                            resolve(jsonData);
                        } else {
                            reject(new Error(`GitHub API returned status ${response.statusCode}`));
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse GitHub API response: ${error}`));
                    }
                });
            });
            
            request.on('error', (error) => {
                reject(new Error(`GitHub API request failed: ${error.message}`));
            });
            
            request.on('timeout', () => {
                request.destroy();
                reject(new Error('GitHub API request timed out'));
            });
        });
    }
}