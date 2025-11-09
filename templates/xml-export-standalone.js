/**
 * Standalone XML Export Module
 * Loaded dynamically only when XML export is requested
 */

(function() {
    'use strict';

    console.log('XML Export Module: Loading...');

    /**
     * XML escaping function
     */
    function escapeXML(str) {
        if (str === null || str === undefined) {
            return '';
        }
        var result = String(str);
        result = result.replace(/&/g, '&amp;');
        result = result.replace(/</g, '&lt;');
        result = result.replace(/>/g, '&gt;');
        result = result.replace(/"/g, '&quot;');
        result = result.replace(/'/g, '&apos;');
        return result;
    }

    /**
     * Generate XML content from table data
     */
    function generateXMLFromTable() {
        console.log('XML Export Module: Starting XML generation...');
        
        try {
            if (!window.filesTable) {
                throw new Error('Table not available');
            }

            var data = window.filesTable.getData();
            var dataLength = data.length;
            console.log('XML Export Module: Retrieved ' + dataLength + ' rows for XML export');

            // Calculate totals manually
            var totalFiles = dataLength;
            var totalLines = 0;
            var totalCodeLines = 0;
            var totalCommentLines = 0;
            var totalBlankLines = 0;
            var totalSize = 0;

            var i;
            for (i = 0; i < dataLength; i++) {
                var row = data[i];
                totalLines = totalLines + (parseInt(row.lines, 10) || 0);
                totalCodeLines = totalCodeLines + (parseInt(row.codeLines, 10) || 0);
                totalCommentLines = totalCommentLines + (parseInt(row.commentLines, 10) || 0);
                totalBlankLines = totalBlankLines + (parseInt(row.blankLines, 10) || 0);
                totalSize = totalSize + (parseInt(row.size, 10) || 0);
            }

            // Build XML step by step
            var xml = '';
            xml = xml + '<?xml version="1.0" encoding="UTF-8"?>\n';
            xml = xml + '<CodeCounterReport>\n';
            
            // Metadata
            xml = xml + '  <Metadata>\n';
            xml = xml + '    <Generated>' + escapeXML(new Date().toISOString()) + '</Generated>\n';
            xml = xml + '    <Generator>VS Code Code Counter Extension</Generator>\n';
            xml = xml + '    <Version>1.0.2</Version>\n';
            xml = xml + '    <TotalFiles>' + String(totalFiles) + '</TotalFiles>\n';
            xml = xml + '  </Metadata>\n';
            
            // Summary
            xml = xml + '  <Summary>\n';
            xml = xml + '    <TotalLines>' + String(totalLines) + '</TotalLines>\n';
            xml = xml + '    <TotalCodeLines>' + String(totalCodeLines) + '</TotalCodeLines>\n';
            xml = xml + '    <TotalCommentLines>' + String(totalCommentLines) + '</TotalCommentLines>\n';
            xml = xml + '    <TotalBlankLines>' + String(totalBlankLines) + '</TotalBlankLines>\n';
            xml = xml + '    <TotalSize>' + String(totalSize) + '</TotalSize>\n';
            xml = xml + '  </Summary>\n';
            
            // Files
            xml = xml + '  <Files>\n';
            for (i = 0; i < dataLength; i++) {
                var fileRow = data[i];
                xml = xml + '    <File>\n';
                xml = xml + '      <RelativePath>' + escapeXML(fileRow.relativePath || '') + '</RelativePath>\n';
                xml = xml + '      <Directory>' + escapeXML(fileRow.directory || '') + '</Directory>\n';
                xml = xml + '      <FileName>' + escapeXML(fileRow.fileName || '') + '</FileName>\n';
                xml = xml + '      <Language>' + escapeXML(fileRow.language || '') + '</Language>\n';
                xml = xml + '      <Lines>' + String(parseInt(fileRow.lines, 10) || 0) + '</Lines>\n';
                xml = xml + '      <CodeLines>' + String(parseInt(fileRow.codeLines, 10) || 0) + '</CodeLines>\n';
                xml = xml + '      <CommentLines>' + String(parseInt(fileRow.commentLines, 10) || 0) + '</CommentLines>\n';
                xml = xml + '      <BlankLines>' + String(parseInt(fileRow.blankLines, 10) || 0) + '</BlankLines>\n';
                xml = xml + '      <Size>' + String(parseInt(fileRow.size, 10) || 0) + '</Size>\n';
                xml = xml + '    </File>\n';
            }
            xml = xml + '  </Files>\n';
            xml = xml + '</CodeCounterReport>';

            console.log('XML Export Module: Generated XML with ' + String(dataLength) + ' files');
            return xml;
        } catch (error) {
            console.error('XML Export Module: XML generation failed:', error);
            throw error;
        }
    }

    /**
     * Download XML file
     */
    function downloadXML() {
        console.log('XML Export Module: Starting XML download...');
        
        try {
            var xmlData = generateXMLFromTable();
            var blob = new Blob([xmlData], { type: 'application/xml;charset=utf-8;' });
            var link = document.createElement('a');
            
            if (link.download !== undefined) {
                var url = URL.createObjectURL(blob);
                var currentDate = new Date();
                var dateStr = currentDate.toISOString().slice(0, 10);
                var fileName = 'code-counter-report-' + dateStr + '.xml';
                
                link.setAttribute('href', url);
                link.setAttribute('download', fileName);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                console.log('XML Export Module: XML download completed');
            }
        } catch (error) {
            console.error('XML Export Module: XML download failed:', error);
            alert('Failed to download XML: ' + error.message);
        }
    }

    // Make functions globally available
    window.XMLExport = {
        generateXML: generateXMLFromTable,
        download: downloadXML
    };

    console.log('XML Export Module: ✅ Loaded successfully');

})();