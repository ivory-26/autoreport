'use client';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { marked } from 'marked';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

/**
 * Parse Markdown content and extract formatted text runs
 * Returns array of text runs with formatting information
 */
function parseMarkdownToTextRuns(markdown) {
  const runs = [];
  const lines = markdown.split('\n');
  
  for (const line of lines) {
    if (!line.trim()) {
      runs.push({ text: '\n', bold: false, italic: false, code: false });
      continue;
    }

    // Parse inline formatting
    let currentText = line;
    let currentPos = 0;
    const lineRuns = [];

    // Regex patterns for Markdown
    const patterns = [
      { regex: /\*\*\*(.+?)\*\*\*/g, bold: true, italic: true }, // Bold italic
      { regex: /\*\*(.+?)\*\*/g, bold: true, italic: false },     // Bold
      { regex: /\*(.+?)\*/g, bold: false, italic: true },         // Italic
      { regex: /__(.+?)__/g, bold: true, italic: false },         // Bold alt
      { regex: /_(.+?)_/g, bold: false, italic: true },           // Italic alt
      { regex: /`(.+?)`/g, code: true },                          // Inline code
    ];

    // Simple parser - process each pattern
    const segments = [];
    let workingText = currentText;
    
    // Extract bold/italic/code segments
    patterns.forEach(pattern => {
      const matches = [...workingText.matchAll(pattern.regex)];
      matches.forEach(match => {
        const [full, content] = match;
        const index = workingText.indexOf(full);
        if (index >= 0) {
          segments.push({
            start: index,
            end: index + full.length,
            text: content,
            ...pattern
          });
        }
      });
    });

    // Sort segments by start position
    segments.sort((a, b) => a.start - b.start);

    // Build text runs
    let pos = 0;
    for (const segment of segments) {
      // Add plain text before this segment
      if (pos < segment.start) {
        lineRuns.push({
          text: workingText.substring(pos, segment.start),
          bold: false,
          italic: false,
          code: false
        });
      }
      // Add formatted segment
      lineRuns.push({
        text: segment.text,
        bold: segment.bold || false,
        italic: segment.italic || false,
        code: segment.code || false
      });
      pos = segment.end;
    }

    // Add remaining plain text
    if (pos < workingText.length) {
      lineRuns.push({
        text: workingText.substring(pos),
        bold: false,
        italic: false,
        code: false
      });
    }

    runs.push(...lineRuns);
    runs.push({ text: '\n', bold: false, italic: false, code: false });
  }

  return runs.filter(r => r.text);
}

/**
 * Export report to PDF with Markdown formatting support
 * @param {Object} report - The report object
 * @param {string} filename - Output filename (without extension)
 */
export async function exportToPDF(report, filename = 'report') {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  const checkNewPage = (requiredSpace = 20) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }
  };

  // Title
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  const titleLines = pdf.splitTextToSize(report.title, contentWidth);
  pdf.text(titleLines, margin, yPosition);
  yPosition += titleLines.length * 10 + 5;

  // Metadata
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Template: ${report.templateId} • Status: ${report.status}`, margin, yPosition);
  yPosition += 8;

  if (report.metadata?.totalWordCount) {
    pdf.text(`${report.metadata.totalWordCount.toLocaleString()} words`, margin, yPosition);
    yPosition += 8;
  }

  // Separator line
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Sections
  pdf.setTextColor(0, 0, 0);
  
  for (const section of report.sections) {
    checkNewPage(30);

    // Section heading
    const isSubSection = section.number.includes('.');
    pdf.setFontSize(isSubSection ? 12 : 14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${section.number} ${section.title}`, margin + (isSubSection ? 5 : 0), yPosition);
    yPosition += isSubSection ? 6 : 8;

    // Section content with formatting
    if (section.content) {
      const textRuns = parseMarkdownToTextRuns(section.content);
      
      for (const run of textRuns) {
        if (run.text === '\n') {
          yPosition += 5;
          checkNewPage(6);
          continue;
        }

        // Set font style based on formatting
        pdf.setFontSize(run.code ? 9 : 11);
        const fontStyle = run.bold && run.italic ? 'bolditalic' : 
                         run.bold ? 'bold' : 
                         run.italic ? 'italic' : 'normal';
        pdf.setFont(run.code ? 'courier' : 'times', fontStyle);
        
        if (run.code) {
          pdf.setTextColor(60, 60, 60);
          pdf.setFillColor(245, 245, 245);
        } else {
          pdf.setTextColor(0, 0, 0);
        }

        const lines = pdf.splitTextToSize(run.text, contentWidth - (isSubSection ? 5 : 0));
        for (const line of lines) {
          checkNewPage(6);
          pdf.text(line, margin + (isSubSection ? 5 : 0), yPosition);
          yPosition += 5;
        }
      }
    } else {
      pdf.setFontSize(10);
      pdf.setFont('times', 'italic');
      pdf.setTextColor(150, 150, 150);
      pdf.text('No content yet.', margin + (isSubSection ? 5 : 0), yPosition);
      pdf.setTextColor(0, 0, 0);
      yPosition += 5;
    }

    yPosition += 8;
  }

  // Footer on last page
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text(
    `Generated by AutoReport • ${new Date().toLocaleDateString()}`,
    margin,
    pageHeight - 10
  );

  pdf.save(`${filename}.pdf`);
}

/**
 * Export report to DOCX with full Markdown formatting support
 * @param {Object} report - The report object
 * @param {string} filename - Output filename (without extension)
 */
export async function exportToDOCX(report, filename = 'report') {
  const children = [];

  // Title
  children.push(
    new Paragraph({
      text: report.title,
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
    })
  );

  // Metadata
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Template: ${report.templateId} • Status: ${report.status}`,
          size: 20,
          color: '666666',
        }),
      ],
      spacing: { after: 100 },
    })
  );

  if (report.metadata?.totalWordCount) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${report.metadata.totalWordCount.toLocaleString()} words`,
            size: 20,
            color: '666666',
          }),
        ],
        spacing: { after: 400 },
      })
    );
  }

  // Sections
  for (const section of report.sections) {
    const isSubSection = section.number.includes('.');

    // Section heading
    children.push(
      new Paragraph({
        text: `${section.number} ${section.title}`,
        heading: isSubSection ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 100 },
      })
    );

    // Section content with Markdown formatting
    if (section.content) {
      const textRuns = parseMarkdownToTextRuns(section.content);
      const paragraphRuns = [];
      let currentParagraph = [];

      for (const run of textRuns) {
        if (run.text === '\n') {
          if (currentParagraph.length > 0) {
            paragraphRuns.push([...currentParagraph]);
            currentParagraph = [];
          }
        } else {
          currentParagraph.push(
            new TextRun({
              text: run.text,
              bold: run.bold,
              italics: run.italic,
              font: run.code ? 'Courier New' : 'Times New Roman',
              size: run.code ? 20 : 24,
              color: run.code ? '404040' : '000000',
              shading: run.code ? { fill: 'F5F5F5' } : undefined,
            })
          );
        }
      }

      if (currentParagraph.length > 0) {
        paragraphRuns.push(currentParagraph);
      }

      for (const runs of paragraphRuns) {
        children.push(
          new Paragraph({
            children: runs,
            spacing: { after: 120 },
          })
        );
      }
    } else {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'No content yet.',
              italics: true,
              color: '999999',
              size: 22,
            }),
          ],
          spacing: { after: 120 },
        })
      );
    }
  }

  // Footer
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated by AutoReport • ${new Date().toLocaleDateString()}`,
          size: 18,
          color: '999999',
        }),
      ],
      spacing: { before: 600 },
      alignment: AlignmentType.CENTER,
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
}

/**
 * Export report to DOC format
 */
export async function exportToDOC(report, filename = 'report') {
  const children = [];

  children.push(
    new Paragraph({
      text: report.title,
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Template: ${report.templateId} • Status: ${report.status}`,
          size: 20,
          color: '666666',
        }),
      ],
      spacing: { after: 400 },
    })
  );

  for (const section of report.sections) {
    const isSubSection = section.number.includes('.');

    children.push(
      new Paragraph({
        text: `${section.number} ${section.title}`,
        heading: isSubSection ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 100 },
      })
    );

    if (section.content) {
      const textRuns = parseMarkdownToTextRuns(section.content);
      const paragraphRuns = [];
      let currentParagraph = [];

      for (const run of textRuns) {
        if (run.text === '\n') {
          if (currentParagraph.length > 0) {
            paragraphRuns.push([...currentParagraph]);
            currentParagraph = [];
          }
        } else {
          currentParagraph.push(
            new TextRun({
              text: run.text,
              bold: run.bold,
              italics: run.italic,
              font: run.code ? 'Courier New' : 'Times New Roman',
              size: run.code ? 20 : 24,
              color: run.code ? '404040' : '000000',
              shading: run.code ? { fill: 'F5F5F5' } : undefined,
            })
          );
        }
      }

      if (currentParagraph.length > 0) {
        paragraphRuns.push(currentParagraph);
      }

      for (const runs of paragraphRuns) {
        children.push(
          new Paragraph({
            children: runs,
            spacing: { after: 120 },
          })
        );
      }
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.doc`);
}
