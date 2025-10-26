/**
 * Debug Service Adapter
 * 
 * Provides configurable logging with multiple backends and verbosity levels.
 * Supports VS Code developer console integration and user-controlled debugging.
 * Monitors VS Code configuration 'codeCounter.debug' for backend changes.
 * 
 * Usage:
 *   const debug = DebugService.getInstance();
 *   debug.initialize(context); // Call once during extension activation
 *   debug.info('Application started');
 *   debug.verbose('Detailed operation info');
 *   debug.error('Something went wrong', error);
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export type LogLevel = 'error' | 'warning' | 'info' | 'verbose';
export type LogBackend = 'none' | 'console' | 'file';

export interface ILogBackend {
    error(message: string, ...args: any[]): void;
    warning(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    verbose(message: string, ...args: any[]): void;
}

/**
 * Console backend implementation using VS Code Developer Tools
 */
export class ConsoleBackend implements ILogBackend {
    error(message: string, ...args: any[]): void {
        console.error(`[Code Counter] ${message}`, ...args);
    }

    warning(message: string, ...args: any[]): void {
        console.warn(`[Code Counter] ${message}`, ...args);
    }

    info(message: string, ...args: any[]): void {
        console.info(`[Code Counter] ${message}`, ...args);
    }

    verbose(message: string, ...args: any[]): void {
        console.log(`[Code Counter] ${message}`, ...args);
    }
}

/**
 * File backend implementation that writes to .vscode/code-counter/debug.log
 */
export class FileBackend implements ILogBackend {
    private logFilePath: string | null = null;
    private isValidBackend: boolean = false;

    constructor() {
        this.setupLogFile();
    }

    public isValid(): boolean {
        return this.isValidBackend;
    }

    private setupLogFile(): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            console.warn('[Code Counter] No workspace folder found for debug logging');
            this.isValidBackend = false;
            return;
        }

        // Create .vscode directory if it doesn't exist
        const vscodeDir = path.join(workspaceFolder.uri.fsPath, '.vscode');
        if (!fs.existsSync(vscodeDir)) {
            try {
                fs.mkdirSync(vscodeDir, { recursive: true });
            } catch (error) {
                console.error('[Code Counter] Failed to create .vscode directory:', error);
                this.isValidBackend = false;
                return;
            }
        }

        this.logFilePath = path.resolve(path.join(vscodeDir, 'code-counter/debug.log'));
        
        // Initialize or overwrite the log file
        try {
            const timestamp = new Date().toISOString();
            const header = `=== Code Counter Debug Log - Started ${timestamp} ===\n`;
            fs.writeFileSync(this.logFilePath, header, 'utf8');
            this.isValidBackend = true;
            this.writeLog('INFO', 'Debug logging initialized', { logFilePath: this.logFilePath });
        } catch (error) {
            console.error('[Code Counter] Failed to initialize debug log file:', error);
            this.logFilePath = null;
            this.isValidBackend = false;
        }
    }

    private writeLog(level: string, message: string, ...args: any[]): void {
        if (!this.logFilePath) {
            // Fallback to console if file logging is not available
            console.log(`[Code Counter] ${level}: ${message}`, ...args);
            return;
        }

        try {
            const timestamp = new Date().toISOString();
            let logEntry = `[${timestamp}] ${level}: ${message}`;
            
            if (args.length > 0) {
                logEntry += ` | Args: ${args.map(arg => {
                    if (typeof arg === 'object') {
                        // Use compact JSON for arrays, pretty-printed for objects
                        if (Array.isArray(arg)) {
                            return JSON.stringify(arg);
                        } else {
                            return JSON.stringify(arg, null, 2);
                        }
                    }
                    return String(arg);
                }).join(', ')}`;
            }
            
            logEntry += '\n';
            
            fs.appendFileSync(this.logFilePath, logEntry, 'utf8');
        } catch (error) {
            // Fallback to console if file logging fails
            console.error('[Code Counter] Failed to write to debug log:', error);
            console.log(`[Code Counter] ${level}: ${message}`, ...args);
        }
    }

    error(message: string, ...args: any[]): void {
        this.writeLog('ERROR', message, ...args);
    }

    warning(message: string, ...args: any[]): void {
        this.writeLog('WARN', message, ...args);
    }

    info(message: string, ...args: any[]): void {
        this.writeLog('INFO', message, ...args);
    }

    verbose(message: string, ...args: any[]): void {
        this.writeLog('VERBOSE', message, ...args);
    }

    public getLogFilePath(): string | null {
        return this.logFilePath;
    }

    public clearLog(): void {
        if (!this.logFilePath) {
            return;
        }

        try {
            const timestamp = new Date().toISOString();
            const header = `=== Code Counter Debug Log - Cleared ${timestamp} ===\n`;
            fs.writeFileSync(this.logFilePath, header, 'utf8');
            this.writeLog('INFO', 'Debug log cleared');
        } catch (error) {
            console.error('[Code Counter] Failed to clear debug log:', error);
        }
    }
}

/**
 * Null backend that discards all log messages
 */
export class NullBackend implements ILogBackend {
    error(): void {}
    warning(): void {}
    info(): void {}
    verbose(): void {}
}

/**
 * Debug Service Singleton
 * 
 * Provides centralized logging control with configurable backends and levels.
 * Automatically monitors VS Code configuration for backend changes.
 */
export class DebugService {
    private static instance: DebugService | null = null;
    private backend: ILogBackend = new NullBackend();
    private minLevel: LogLevel = 'info';
    private configurationListener: vscode.Disposable | null = null;

    private constructor() {}

    public static getInstance(): DebugService {
        if (!DebugService.instance) {
            DebugService.instance = new DebugService();
        }
        return DebugService.instance;
    }

    /**
     * Initialize the debug service with VS Code configuration monitoring
     * @param context Extension context for registering disposables
     */
    public initialize(context: vscode.ExtensionContext): void {
        // Load initial configuration
        this.loadFromConfiguration();
        
        // Monitor configuration changes
        this.configurationListener = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('codeCounter.debug')) {
                this.loadFromConfiguration();
            }
        });
        
        // Register disposable
        context.subscriptions.push(this.configurationListener);
    }

    /**
     * Load debug configuration from VS Code settings
     */
    private loadFromConfiguration(): void {
        const config = vscode.workspace.getConfiguration('codeCounter');
        const debugSetting = config.get<string>('debug', 'none');
        
        // Convert configuration value to our backend type
        let backendType: LogBackend;
        switch (debugSetting) {
            case 'console':
                backendType = 'console';
                break;
            case 'file':
                backendType = 'file';
                break;
            default:
                backendType = 'none';
                break;
        }
        
        this.configure(backendType, this.minLevel);
    }

    /**
     * Configure the debug service backend
     * @param backendType Type of logging backend to use
     * @param minLevel Minimum log level to output
     */
    public configure(backendType: LogBackend, minLevel: LogLevel = 'info'): void {
        this.minLevel = minLevel;
        
        switch (backendType) {
            case 'console':
                this.backend = new ConsoleBackend();
                break;
            case 'file':
                const fileBackend = new FileBackend();
                if (fileBackend.isValid()) {
                    this.backend = fileBackend;
                } else {
                    // Fallback to null backend if file logging is not available
                    console.warn('[Code Counter] File logging requested but not available, falling back to null backend');
                    this.backend = new NullBackend();
                }
                break;
            case 'none':
            default:
                this.backend = new NullBackend();
                break;
        }
    }

    /**
     * Get current backend configuration
     */
    public getCurrentBackend(): LogBackend {
        if (this.backend instanceof ConsoleBackend) {
            return 'console';
        } else if (this.backend instanceof FileBackend && this.backend.isValid()) {
            return 'file';
        } else {
            return 'none';
        }
    }

    /**
     * Get current minimum log level
     */
    public getCurrentLevel(): LogLevel {
        return this.minLevel;
    }

    /**
     * Check if a log level should be output based on current configuration
     */
    private shouldLog(level: LogLevel): boolean {
        if (this.backend instanceof NullBackend) {
            return false;
        }
        return true;
    }

    /**
     * Log an error message (critical issues, exceptions)
     */
    public error(message: string, ...args: any[]): void {
        if (this.shouldLog('error')) {
            this.backend.error(message, ...args);
        }
    }

    /**
     * Log a warning message (potential issues, deprecated usage)
     */
    public warning(message: string, ...args: any[]): void {
        if (this.shouldLog('warning')) {
            this.backend.warning(message, ...args);
        }
    }

    /**
     * Log an info message (general application flow)
     */
    public info(message: string, ...args: any[]): void {
        if (this.shouldLog('info')) {
            this.backend.info(message, ...args);
        }
    }

    /**
     * Log a verbose message (detailed debugging information)
     */
    public verbose(message: string, ...args: any[]): void {
        if (this.shouldLog('verbose')) {
            this.backend.verbose(message, ...args);
        }
    }

    /**
     * Get the log file path if using file backend
     */
    public getLogFilePath(): string | null {
        if (this.backend instanceof FileBackend) {
            return this.backend.getLogFilePath();
        }
        return null;
    }

    /**
     * Clear the log file if using file backend
     */
    public clearLog(): void {
        if (this.backend instanceof FileBackend) {
            this.backend.clearLog();
        }
    }

    /**
     * Check if file logging is enabled
     */
    public isFileLoggingEnabled(): boolean {
        return this.backend instanceof FileBackend;
    }

    /**
     * Clean up resources when extension is deactivated
     */
    public dispose(): void {
        if (this.configurationListener) {
            this.configurationListener.dispose();
            this.configurationListener = null;
        }
    }
}