# Test Fixtures

This directory contains test files used by the Code Counter extension test suites.

## Files

- **test-binary.bin** - Binary test file for binary detection testing
- **test-binary.dat** - Additional binary test file with different extension  
- **test.txt** - Plain text test file for supported file testing
- **test.unknown** - File with unknown extension for unsupported file testing

## Usage

These fixtures are used by various test suites to verify:
- Binary file detection functionality
- File extension support detection  
- File decoration behavior
- Language detection and classification

## Adding New Fixtures

When adding new test files:
1. Place them in this directory
2. Update this README with a description
3. Reference them in test files using relative paths from the test suite directory
4. Use descriptive filenames that indicate their purpose