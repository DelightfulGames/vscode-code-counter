export class GlobUtils {
    
    static matchesPattern(filePath: string, pattern: string): boolean {
        // Convert glob pattern to regex
        const regexPattern = this.globToRegex(pattern);
        const regex = new RegExp(regexPattern, 'i');
        return regex.test(filePath);
    }
    
    static matchesAnyPattern(filePath: string, patterns: string[]): boolean {
        return patterns.some(pattern => this.matchesPattern(filePath, pattern));
    }
    
    private static globToRegex(pattern: string): string {
        // Escape special regex characters except for glob wildcards
        let regex = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&'); // Escape regex special chars
        
        // Handle path separators first (both forward and backward slashes)
        regex = regex.replace(/\//g, '[/\\\\]');
        
        // Now handle glob patterns
        regex = regex.replace(/\*\*/g, '.__DOUBLE_STAR__'); // Temporarily replace **
        regex = regex.replace(/\*/g, '[^/\\\\]*'); // * matches anything except path separators
        regex = regex.replace(/\?/g, '[^/\\\\]'); // ? matches single char except path separators
        
        // Handle ** correctly - it should match zero or more path segments
        // **/ should match "" (empty string) or "dir/" or "dir/subdir/"
        regex = regex.replace(/\.__DOUBLE_STAR__\[\/\\\\\]/g, '(?:.*[/\\\\])?'); // **/ matches zero or more dirs
        regex = regex.replace(/\[\/\\\\\]\.__DOUBLE_STAR__/g, '(?:[/\\\\].*)?'); // /** matches optional path  
        regex = regex.replace(/\.__DOUBLE_STAR__/g, '.*'); // ** alone matches everything
        
        return `^${regex}$`;
    }
    
    static getDefaultExclusions(): string[] {
        return [
            '**/node_modules/**',
            '**/out/**',
            '**/dist/**',
            '**/.git/**',
            '**/.vscode/**',
            '**/coverage/**',
            '**/*.log',
            '**/.DS_Store',
            '**/Thumbs.db'
        ];
    }
}