import { expect } from 'chai';
import { lineThresholdservice, ColorThreshold } from '../../services/lineThresholdservice';

suite('lineThresholdservice Tests', () => {
    
    test('should classify line counts correctly', () => {
        // Test with default thresholds (300, 1000)
        expect(lineThresholdservice.getColorThreshold(100)).to.equal('normal');
        expect(lineThresholdservice.getColorThreshold(299)).to.equal('normal');
        expect(lineThresholdservice.getColorThreshold(300)).to.equal('warning');
        expect(lineThresholdservice.getColorThreshold(500)).to.equal('warning');
        expect(lineThresholdservice.getColorThreshold(999)).to.equal('warning');
        expect(lineThresholdservice.getColorThreshold(1000)).to.equal('danger');
        expect(lineThresholdservice.getColorThreshold(2000)).to.equal('danger');
    });
    
    test('should format line counts with appropriate text', () => {
        const result1 = lineThresholdservice.formatLineCountWithEmoji(42);
        expect(result1.text).to.equal('42L');
        expect(result1.emoji).to.be.a('string');
        
        const result2 = lineThresholdservice.formatLineCountWithEmoji(1500);
        expect(result2.text).to.equal('1.5kL');
        expect(result2.emoji).to.be.a('string');
        
        const result3 = lineThresholdservice.formatLineCountWithEmoji(2500000);
        expect(result3.text).to.equal('2.5ML');
        expect(result3.emoji).to.be.a('string');
    });
    
    test('should format status bar text correctly', () => {
        const result1 = lineThresholdservice.getStatusBarText(42);
        expect(result1.text).to.equal('42 lines');
        
        const result2 = lineThresholdservice.getStatusBarText(1500);
        expect(result2.text).to.equal('1.5k lines');
        
        const result3 = lineThresholdservice.getStatusBarText(2500000);
        expect(result3.text).to.equal('2.5M lines');
    });
    
    test('should create colored tooltips with threshold info', () => {
        const tooltip = lineThresholdservice.createColoredTooltip(
            'test.js',
            500, // warning level
            400,
            50,
            50,
            25000
        );
        
        expect(tooltip).to.contain('test.js');
        expect(tooltip).to.contain('🟡 Above 300 lines');
        expect(tooltip).to.contain('Total Lines: 500');
        expect(tooltip).to.contain('Code Lines: 400');
        expect(tooltip).to.contain('Comment Lines: 50');
        expect(tooltip).to.contain('Blank Lines: 50');
    });
    
    test('should handle threshold configuration validation', () => {
        const config = lineThresholdservice.getThresholdConfig();
        
        // Should have valid defaults
        expect(config.midThreshold).to.be.a('number');
        expect(config.highThreshold).to.be.a('number');
        expect(config.highThreshold).to.be.greaterThan(config.midThreshold);
        expect(config.enabled).to.be.a('boolean');
    });

    test('should handle custom emojis configuration', () => {
        const emojis = lineThresholdservice.getCustomEmojis();
        
        // Should have valid emoji strings
        expect(emojis.normal).to.be.a('string');
        expect(emojis.warning).to.be.a('string');
        expect(emojis.danger).to.be.a('string');
        
        // Should have at least one character (emoji)
        expect(emojis.normal.length).to.be.greaterThan(0);
        expect(emojis.warning.length).to.be.greaterThan(0);
        expect(emojis.danger.length).to.be.greaterThan(0);
    });
});