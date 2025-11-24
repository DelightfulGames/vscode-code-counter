/**
 * VS Code Code Counter Extension
 * 
 * Copyright (c) 2025 DelightfulGames
 * Licensed under the MIT License
 * 
 * Centralized Binary File Classification Service
 * Ensures identical binary detection logic across all components
 */

import * as path from 'path';
import { BinaryDetectionService } from './binaryDetectionService';
import { DebugService } from './debugService';

export interface ClassificationResult {
    shouldInclude: boolean;
    reason: 'binary_extension' | 'text_extension_clean' | 'text_extension_binary_content' | 'unknown_extension';
    isBinary: boolean;
    extension: string;
}

export class BinaryClassificationService {
    private debug = DebugService.getInstance();
    
    constructor(private binaryDetectionService?: BinaryDetectionService) {}
    
    /**
     * Centralized binary classification logic used by both decorator and line counter
     * Priority Order:
     * 1. Known binary extensions → exclude (binary=true, shouldInclude=false)
     * 2. Known text extensions → apply content detection → include if clean text
     * 3. Unknown extensions → exclude (assume binary for safety)
     */
    async classifyFile(filePath: string): Promise<ClassificationResult> {
        const ext = path.extname(filePath).toLowerCase();
        
        // Step 1: Check known BINARY extensions FIRST (highest priority)
        if (this.getKnownBinaryExtensions().has(ext)) {
            this.debug.verbose('File excluded as known binary extension:', { filePath, ext });
            return {
                shouldInclude: false,
                reason: 'binary_extension',
                isBinary: true,
                extension: ext
            };
        }
        
        // Step 2: Check known TEXT extensions with binary content detection
        if (this.getKnownTextExtensions().has(ext)) {
            if (this.binaryDetectionService) {
                try {
                    const binaryResult = await this.binaryDetectionService.isBinary(filePath);
                    if (binaryResult.isBinary) {
                        this.debug.verbose('Text extension file contains binary content:', { 
                            filePath, ext, 
                            detectionMethod: binaryResult.detectionMethod 
                        });
                        return {
                            shouldInclude: false,
                            reason: 'text_extension_binary_content',
                            isBinary: true,
                            extension: ext
                        };
                    } else {
                        this.debug.verbose('Text extension file contains clean text content:', { filePath, ext });
                        return {
                            shouldInclude: true,
                            reason: 'text_extension_clean',
                            isBinary: false,
                            extension: ext
                        };
                    }
                } catch (error) {
                    this.debug.warning('Binary detection failed for known text file - assuming text:', { filePath, error });
                    return {
                        shouldInclude: true,
                        reason: 'text_extension_clean',
                        isBinary: false,
                        extension: ext
                    };
                }
            } else {
                // No binary detection service available, trust the extension
                return {
                    shouldInclude: true,
                    reason: 'text_extension_clean',
                    isBinary: false,
                    extension: ext
                };
            }
        }
        
        // Step 3: Unknown extensions - exclude by default (assume binary for safety)
        this.debug.verbose('File excluded as unknown extension:', { filePath, ext });
        return {
            shouldInclude: false,
            reason: 'unknown_extension',
            isBinary: false, // Unknown, not confirmed binary
            extension: ext
        };
    }
    
    /**
     * Get comprehensive set of known text file extensions
     * MUST be identical across all components
     */
    getKnownTextExtensions(): Set<string> {
        return new Set([
            // Programming languages
            '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx',
            '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.kts', '.scala', '.sc', '.sbt',
            '.dart', '.lua', '.r', '.R', '.m', '.pl', '.pm', '.hs', '.erl', '.ex', '.exs',
            '.clj', '.cljs', '.cljc', '.fs', '.fsx', '.fsi', '.ml', '.mli', '.asm', '.s',
            '.cbl', '.cob', '.cpy', '.f', '.f90', '.f95', '.f03', '.f08', '.vb', '.bas',
            '.pas', '.pp', '.ads', '.adb', '.groovy', '.gradle', '.jl', '.nim', '.cr',
            '.mm', '.dpr', '.dfm', '.vala', '.zig', '.v', '.scm', '.ss', '.rkt',
            '.coffee', '.ls', '.elm', '.purs', '.tcl', '.tk', '.awk', '.gawk',
            
            // Shell and scripting
            '.sh', '.bash', '.zsh', '.fish', '.csh', '.ksh', '.bat', '.cmd', '.ps1', '.psm1', '.psd1',
            
            // Web technologies
            '.html', '.htm', '.xhtml', '.css', '.scss', '.sass', '.less', '.stylus',
            '.vue', '.svelte', '.astro',
            
            // Data and config
            '.json', '.jsonc', '.json5', '.xml', '.xsd', '.xsl', '.xslt', '.yaml', '.yml',
            '.toml', '.ini', '.cfg', '.conf', '.config', '.properties', '.env',
            '.htaccess', '.gitignore', '.gitattributes', '.editorconfig',
            
            // Documentation and text
            '.md', '.markdown', '.mdown', '.mkd', '.rst', '.txt', '.text', '.rtf',
            '.tex', '.latex', '.org', '.adoc', '.asciidoc',
            
            // Database and query
            '.sql', '.psql', '.mysql', '.cypher', '.sparql',
            '.graphql', '.gql',
            
            // Build and project files
            '.dockerfile', '.dockerignore', '.makefile', '.make', '.mk', '.cmake',
            '.gradle', '.sbt', '.maven', '.ant', '.rake', '.gemfile',
            
            // Log and data files
            '.log', '.logs', '.out', '.err', '.trace', '.csv', '.tsv', '.tab',
            
            // Specialized formats
            '.proto', '.g4', '.bnf', '.ebnf', '.lex', '.yacc', '.bison'
        ]);
    }
    
    /**
     * Get comprehensive set of known binary file extensions
     * MUST be identical across all components
     */
    getKnownBinaryExtensions(): Set<string> {
        return new Set([
            // Images  
            '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.tiff', '.tif', '.webp',
            '.svg', '.psd', '.ai', '.eps', '.raw', '.cr2', '.nef', '.orf', '.sr2',
            '.dng', '.heic', '.heif', '.avif', '.jxl',
            
            // Video
            '.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm', '.m4v',
            '.mpg', '.mpeg', '.3gp', '.ogv', '.asf', '.rm', '.rmvb',
            
            // Audio
            '.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a', '.opus',
            '.ape', '.ac3', '.dts', '.amr',
            
            // Archives and compression
            '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.lzma',
            '.cab', '.iso', '.dmg', '.pkg', '.deb', '.rpm',
            
            // Documents
            '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
            '.odt', '.ods', '.odp', '.pages', '.numbers', '.key',
            
            // Executables and libraries
            '.exe', '.dll', '.so', '.dylib', '.app', '.msi', '.appx',
            '.bin', '.run', '.snap', '.flatpak',
            
            // Database files
            '.db', '.sqlite', '.sqlite3', '.mdb', '.accdb', '.dbf',
            
            // System and temporary
            '.tmp', '.temp', '.cache', '.lock', '.pid', '.swap',
            '.bak', '.backup', '.old', '.orig',
            
            // Fonts
            '.ttf', '.otf', '.woff', '.woff2', '.eot',
            
            // CAD and 3D
            '.dwg', '.dxf', '.step', '.iges', '.stl', '.obj', '.3ds',
            
            // Virtual machines
            '.vmdk', '.vdi', '.qcow2', '.vhd', '.vhdx',
            
            // Game assets
            '.unity', '.unitypackage', '.asset', '.prefab'
        ]);
    }
}