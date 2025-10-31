## Leading Slash Fix for Context Menu Exclusion Patterns

### Problem
When excluding files/directories from the context menu, the exclusion patterns were not working properly because they were missing the leading slash required for proper glob matching.

### Root Cause
The pattern creation functions in the context menu handlers were generating relative path patterns like:
- `src/components/Button.tsx` 
- `node_modules/**`
- `dist/build.js`

But glob matchers often require patterns to start with `/` to properly match from the workspace root:
- `/src/components/Button.tsx`
- `/node_modules/**` 
- `/dist/build.js`

### Solution Applied
Updated all relative path pattern creation functions to add a leading slash:

1. **`handleExcludeRelativePath`** in `src/utils/exclusionUtils.ts`
2. **`createRelativePathPattern`** in `src/utils/exclusionUtils.ts`
3. **Pattern creation** in `src/handlers/patternHandler.ts`

### Code Changes
Added this logic to pattern creation:
```typescript
// Use forward slashes for consistency and add leading slash for proper glob matching
let pattern = relativePath.replace(/\\/g, '/');
if (!pattern.startsWith('/')) {
    pattern = '/' + pattern;
}
```

### Behavior Changes
- **Before**: Context menu exclusions created patterns like `src/folder/file.ts` which might not match properly
- **After**: Context menu exclusions create patterns like `/src/folder/file.ts` which match correctly from workspace root

### Files Modified
- `src/utils/exclusionUtils.ts` - Fixed `handleExcludeRelativePath` and `createRelativePathPattern` 
- `src/handlers/patternHandler.ts` - Fixed pattern creation in `handleExcludeRelativePath`

### Testing
- ✅ All 249 existing tests pass
- ✅ Code compiles without errors
- ✅ Patterns now have proper leading slash format

This fix ensures that when users exclude files or directories via context menu, the exclusion patterns will work correctly with the glob matching system.