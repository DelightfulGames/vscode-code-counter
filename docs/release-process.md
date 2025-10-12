# Release Process

This document outlines the comprehensive release process for the VS Code Code Counter extension, from development to marketplace publication.

## Overview

The release process follows a structured approach ensuring quality, stability, and proper versioning. Every release undergoes thorough testing, documentation updates, and marketplace validation.

## Pre-Release Checklist

### Code Quality Verification
- [ ] All tests pass (run `npm test`)
- [ ] Code coverage meets minimum thresholds (41%+)
- [ ] TypeScript compilation successful (`npm run compile`)
- [ ] Linting passes without errors
- [ ] Performance benchmarks meet standards

### Documentation Updates
- [ ] CHANGELOG.md updated with new features/fixes
- [ ] README.md reflects current functionality
- [ ] API documentation updated
- [ ] Configuration options documented
- [ ] Breaking changes highlighted

### Version Management
```json
{
  "version": "X.Y.Z",
  "engines": {
    "vscode": "^1.74.0"
  }
}
```

### Testing Protocol
- [ ] Unit tests (51/51 passing)
- [ ] Integration tests
- [ ] Manual testing on multiple platforms
- [ ] Extension loading/unloading cycles
- [ ] WebView functionality verification

## Release Types

### Patch Release (X.Y.Z → X.Y.Z+1)
- Bug fixes
- Minor performance improvements
- Documentation updates
- No breaking changes

### Minor Release (X.Y.Z → X.Y+1.0)
- New features
- Enhancement to existing functionality
- New configuration options
- Backward compatible changes

### Major Release (X.Y.Z → X+1.0.0)
- Breaking changes
- Major architectural changes
- Significant feature additions
- API modifications

## Build Process

### 1. Environment Preparation
```bash
# Clean build environment
npm run clean
rm -rf node_modules
npm install

# Verify dependencies
npm audit
npm outdated
```

### 2. Compilation and Testing
```bash
# TypeScript compilation
npm run compile

# Run full test suite
npm run test

# Generate coverage report
npm run coverage
```

### 3. Package Generation
```bash
# Install VSCE (VS Code Extension manager)
npm install -g vsce

# Package extension
vsce package

# Verify package contents
vsce ls
```

## Quality Gates

### Automated Testing
- **Unit Tests**: 51 tests covering core functionality
- **Mock System**: 15+ VS Code API surfaces
- **Coverage**: Minimum 41% code coverage
- **Performance**: Response times under 100ms

### Manual Testing Checklist
- [ ] Extension activation/deactivation
- [ ] Line counting accuracy
- [ ] File explorer decorations
- [ ] Status bar updates
- [ ] WebView report generation
- [ ] Configuration persistence
- [ ] Theme compatibility

### Cross-Platform Testing
- [ ] Windows 10/11
- [ ] macOS (Intel/Apple Silicon)
- [ ] Linux (Ubuntu/Fedora)
- [ ] Different VS Code versions

## Marketplace Publication

### 1. Pre-Publication Validation
```bash
# Validate package
vsce package --dry-run

# Check marketplace requirements
vsce verify
```

### 2. Publication Process
```bash
# Login to marketplace
vsce login [publisher-name]

# Publish extension
vsce publish

# Verify publication
vsce show [extension-name]
```

### 3. Post-Publication Tasks
- [ ] Update GitHub releases
- [ ] Tag repository with version
- [ ] Update documentation
- [ ] Monitor marketplace metrics
- [ ] Respond to user feedback

## Version Control Integration

### Git Workflow
```bash
# Feature branch
git checkout -b feature/new-feature
git commit -m "feat: add new feature"
git push origin feature/new-feature

# Create pull request
# Merge after review

# Tag release
git tag v1.2.3
git push origin v1.2.3
```

### Branching Strategy
- **main**: Production-ready code
- **develop**: Integration branch
- **feature/***: New features
- **hotfix/***: Critical fixes
- **release/***: Release preparation

## Rollback Procedures

### Marketplace Rollback
```bash
# Unpublish current version
vsce unpublish

# Republish previous version
vsce publish --packagePath previous-version.vsix
```

### Emergency Hotfix
1. Create hotfix branch from main
2. Apply minimal fix
3. Test thoroughly
4. Fast-track release process
5. Monitor deployment

## Release Automation

### CI/CD Pipeline
```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ['v*']
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run compile
      - run: npm test
      - run: vsce package
      - run: vsce publish
```

### Automated Testing
- Pre-commit hooks
- Continuous integration
- Automated package validation
- Security scanning

## Metrics and Monitoring

### Release Metrics
- Installation count
- User ratings/reviews
- Error reports
- Performance metrics
- Usage analytics

### Success Criteria
- Zero critical bugs within 48 hours
- Installation rate > 90% of previous version
- User rating maintained > 4.0
- Performance regression < 5%

## Communication

### Internal Communication
- Release notes to development team
- Stakeholder updates
- Documentation team coordination

### External Communication
- GitHub release notes
- Marketplace description updates
- User community announcements
- Blog post for major releases

## Post-Release Activities

### Immediate (24-48 hours)
- [ ] Monitor error reports
- [ ] Check installation metrics
- [ ] Respond to urgent issues
- [ ] Validate core functionality

### Short-term (1-2 weeks)
- [ ] Analyze user feedback
- [ ] Performance monitoring
- [ ] Feature usage analytics
- [ ] Plan next iteration

### Long-term (1 month+)
- [ ] Feature adoption analysis
- [ ] Technical debt assessment
- [ ] Roadmap adjustments
- [ ] Process improvements

## Emergency Procedures

### Critical Bug Response
1. **Assessment** (< 2 hours)
   - Impact analysis
   - User base affected
   - Severity classification

2. **Response** (< 4 hours)
   - Hotfix development
   - Emergency testing
   - Expedited release

3. **Communication** (< 1 hour)
   - User notification
   - Status updates
   - Timeline communication

### Marketplace Issues
- Contact Microsoft support
- Provide detailed error logs
- Prepare alternative distribution
- Communicate with users

## Documentation Updates

### Required Updates per Release
- [ ] CHANGELOG.md entries
- [ ] Version number updates
- [ ] API documentation
- [ ] Configuration reference
- [ ] Migration guides (if needed)

### Archive Management
- Previous version documentation
- Deprecation notices
- Backward compatibility notes
- Migration assistance

## Tools and Resources

### Development Tools
- **VSCE**: VS Code Extension manager
- **TypeScript**: Language and compiler
- **Mocha**: Testing framework
- **Istanbul**: Coverage analysis

### Monitoring Tools
- VS Code Marketplace analytics
- GitHub Insights
- Error tracking services
- Performance monitoring

### Communication Channels
- GitHub Issues/Discussions
- VS Code Marketplace Q&A
- Development team channels
- User community forums

This comprehensive release process ensures quality, stability, and user satisfaction while maintaining development velocity and marketplace compliance.