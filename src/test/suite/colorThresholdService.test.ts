import { expect } from 'chai';
import { ColorThresholdService, ColorThreshold } from '../../services/colorThresholdService';

suite('ColorThresholdService Tests', () => {
    
    test('should classify line counts correctly', () => {
        // Test with default thresholds (300, 1000)
        expect(ColorThresholdService.getColorThreshold(100)).to.equal('normal');
        expect(ColorThresholdService.getColorThreshold(299)).to.equal('normal');
        expect(ColorThresholdService.getColorThreshold(300)).to.equal('warning');
        expect(ColorThresholdService.getColorThreshold(500)).to.equal('warning');
        expect(ColorThresholdService.getColorThreshold(999)).to.equal('warning');
        expect(ColorThresholdService.getColorThreshold(1000)).to.equal('danger');
        expect(ColorThresholdService.getColorThreshold(2000)).to.equal('danger');
    });
    
    test('should format line counts with appropriate text', () => {
        const result1 = ColorThresholdService.formatLineCountWithColor(42);
        expect(result1.text).to.equal('42L');
        
        const result2 = ColorThresholdService.formatLineCountWithColor(1500);
        expect(result2.text).to.equal('1.5kL');
        
        const result3 = ColorThresholdService.formatLineCountWithColor(2500000);
        expect(result3.text).to.equal('2.5ML');
    });
    
    test('should format status bar text correctly', () => {
        const result1 = ColorThresholdService.getStatusBarText(42);
        expect(result1.text).to.equal('42 lines');
        
        const result2 = ColorThresholdService.getStatusBarText(1500);
        expect(result2.text).to.equal('1.5k lines');
        
        const result3 = ColorThresholdService.getStatusBarText(2500000);
        expect(result3.text).to.equal('2.5M lines');
    });
    
    test('should create colored tooltips with threshold info', () => {
        const tooltip = ColorThresholdService.createColoredTooltip(
            'test.js',
            500, // warning level
            400,
            50,
            50,
            25000
        );
        
        expect(tooltip).to.contain('test.js');
        expect(tooltip).to.contain('⚠️ Above 300 lines');
        expect(tooltip).to.contain('Total Lines: 500');
        expect(tooltip).to.contain('Code Lines: 400');
        expect(tooltip).to.contain('Comment Lines: 50');
        expect(tooltip).to.contain('Blank Lines: 50');
    });
    
    test('should handle threshold configuration validation', () => {
        const config = ColorThresholdService.getThresholdConfig();
        
        // Should have valid defaults
        expect(config.yellowThreshold).to.be.a('number');
        expect(config.redThreshold).to.be.a('number');
        expect(config.redThreshold).to.be.greaterThan(config.yellowThreshold);
        expect(config.enabled).to.be.a('boolean');
    });

    test('should handle custom colors configuration', () => {
        const colors = ColorThresholdService.getCustomColors();
        
        // Should have valid color strings
        expect(colors.normal).to.be.a('string');
        expect(colors.warning).to.be.a('string');
        expect(colors.danger).to.be.a('string');
        
        // Should be valid hex colors (start with #)
        expect(colors.normal).to.match(/^#[0-9A-Fa-f]{6}$/);
        expect(colors.warning).to.match(/^#[0-9A-Fa-f]{6}$/);
        expect(colors.danger).to.match(/^#[0-9A-Fa-f]{6}$/);
    });
});