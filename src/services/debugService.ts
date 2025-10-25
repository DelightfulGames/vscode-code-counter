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

export type LogLevel = 'error' | 'warning' | 'info' | 'verbose';
export type LogBackend = 'none' | 'console';

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
        const backendType: LogBackend = debugSetting === 'console' ? 'console' : 'none';
        
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
        return this.backend instanceof ConsoleBackend ? 'console' : 'none';
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
     * Clean up resources when extension is deactivated
     */
    public dispose(): void {
        if (this.configurationListener) {
            this.configurationListener.dispose();
            this.configurationListener = null;
        }
    }
}