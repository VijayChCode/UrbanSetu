import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const SRC_DIR = path.resolve('trust_docs');

const LOGO_PATHS = [
    path.resolve('mobile/assets/images/icon.png'),
    path.resolve('app_icon.png'),
    path.resolve('web/public/favicon.png'),
    path.resolve('mobile/assets/images/favicon.png')
];

function getLogoPath() {
    for (const p of LOGO_PATHS) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return null;
}

/**
 * Replaces common smart punctuation and strips non-Latin1 characters
 * to avoid PDFKit Helvetica font rendering errors.
 */
function sanitizeText(text) {
    if (!text) return '';
    return text
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/[\u2022]/g, '*')
        .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '')
        .trim();
}

/**
 * Splits text into blocks of Headings, Lists, Paragraphs, Code Blocks, and HRs.
 */
function parseMarkdown(mdText) {
    const lines = mdText.split(/\r?\n/);
    const blocks = [];
    let inCodeBlock = false;
    let codeBlockLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Code block toggle
        if (line.trim().startsWith('```')) {
            if (inCodeBlock) {
                blocks.push({
                    type: 'code_block',
                    content: codeBlockLines.join('\n')
                });
                codeBlockLines = [];
                inCodeBlock = false;
            } else {
                inCodeBlock = true;
            }
            continue;
        }

        if (inCodeBlock) {
            codeBlockLines.push(line);
            continue;
        }

        // Horizontal rule
        if (line.trim() === '---' || line.trim() === '***') {
            blocks.push({ type: 'hr' });
            continue;
        }

        // Headings
        if (line.startsWith('# ')) {
            blocks.push({ type: 'h1', text: sanitizeText(line.substring(2)) });
            continue;
        }
        if (line.startsWith('## ')) {
            blocks.push({ type: 'h2', text: sanitizeText(line.substring(3)) });
            continue;
        }
        if (line.startsWith('### ')) {
            blocks.push({ type: 'h3', text: sanitizeText(line.substring(4)) });
            continue;
        }

        // Bullet lists
        const bulletMatch = line.match(/^(\s*)([*+-])\s+(.*)/);
        if (bulletMatch) {
            const indent = bulletMatch[1].length;
            blocks.push({
                type: 'bullet_item',
                indent: indent,
                text: sanitizeText(bulletMatch[3])
            });
            continue;
        }

        // Numbered lists
        const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
        if (numberedMatch) {
            const indent = numberedMatch[1].length;
            const number = numberedMatch[2];
            blocks.push({
                type: 'numbered_item',
                indent: indent,
                number: number,
                text: sanitizeText(numberedMatch[3])
            });
            continue;
        }

        // Blockquotes
        if (line.startsWith('> ')) {
            blocks.push({ type: 'blockquote', text: sanitizeText(line.substring(2)) });
            continue;
        }

        // Paragraphs
        if (line.trim() === '') {
            blocks.push({ type: 'blank_line' });
        } else {
            const lastBlock = blocks[blocks.length - 1];
            if (lastBlock && lastBlock.type === 'paragraph') {
                lastBlock.text += ' ' + line.trim();
            } else {
                blocks.push({ type: 'paragraph', text: sanitizeText(line) });
            }
        }
    }

    // Clean text of final paragraphs to ensure proper formatting
    blocks.forEach(b => {
        if (b.type === 'paragraph') {
            b.text = sanitizeText(b.text);
        }
    });

    return blocks.filter((b, idx) => {
        if (b.type === 'blank_line') {
            if (idx === 0) return false;
            const next = blocks[idx + 1];
            if (!next || next.type === 'blank_line' || next.type === 'hr' || next.type.startsWith('h')) {
                return false;
            }
        }
        return true;
    });
}

/**
 * Parses inline formatting tags (bold, italic, code, and markdown links).
 */
function parseFormattedText(text) {
    const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g;
    const parts = text.split(regex);
    return parts.map(part => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return { text: part.slice(2, -2), font: 'Helvetica-Bold', color: '#1f2937' };
        } else if (part.startsWith('*') && part.endsWith('*')) {
            return { text: part.slice(1, -1), font: 'Helvetica-Oblique', color: '#4b5563' };
        } else if (part.startsWith('`') && part.endsWith('`')) {
            return { text: part.slice(1, -1), font: 'Courier', color: '#b91c1c' };
        } else if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
            const closeBracket = part.indexOf(']');
            const linkText = part.slice(1, closeBracket);
            const url = part.slice(closeBracket + 2, -1);
            return { text: linkText, font: 'Helvetica-Bold', color: '#2563eb', link: url, underline: true };
        } else {
            return { text: part, font: 'Helvetica', color: '#374151' };
        }
    }).filter(part => part.text !== '');
}

/**
 * Renders multiple text fragments on a single line flow.
 */
function renderFormattedParts(doc, parts, options = {}) {
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = (i === parts.length - 1);
        
        doc.font(part.font)
           .fillColor(part.color);
           
        const textOpts = {
            continued: !isLast,
            ...options
        };
        
        if (part.link) {
            textOpts.link = part.link;
            textOpts.underline = part.underline;
        }
        
        doc.text(part.text, textOpts);
    }
}

/**
 * Compiles a markdown file to PDF
 */
function convertMdToPdf(mdFilePath, pdfFilePath) {
    console.log(`Converting: ${path.basename(mdFilePath)} -> ${path.basename(pdfFilePath)}`);
    const mdContent = fs.readFileSync(mdFilePath, 'utf-8');
    const blocks = parseMarkdown(mdContent);

    const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true
    });

    const writeStream = fs.createWriteStream(pdfFilePath);
    doc.pipe(writeStream);

    // Draw logo and header banner on Page 1
    const logoPath = getLogoPath();
    if (logoPath) {
        doc.image(logoPath, 50, 40, { width: 32, height: 32 });
    }
    
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e3a8a')
       .text('URBANSETU', 90, 45, { continued: true })
       .font('Helvetica').fillColor('#9ca3af')
       .text('   |   TRUST & COMPLIANCE SYSTEM');

    doc.save()
       .strokeColor('#e5e7eb')
       .lineWidth(1)
       .moveTo(50, 80)
       .lineTo(doc.page.width - 50, 80)
       .stroke()
       .restore();

    doc.y = 110; // set starting position for the main document content

    blocks.forEach(block => {
        // Prevent drawing elements below page boundaries
        if (doc.y > doc.page.height - doc.page.margins.bottom - 40) {
            doc.addPage();
        }

        switch (block.type) {
            case 'h1': {
                doc.font('Helvetica-Bold')
                   .fontSize(22)
                   .fillColor('#0f172a')
                   .text(block.text);
                
                doc.moveDown(0.3);
                // Thick blue underline accent
                const currentY = doc.y;
                doc.save()
                   .strokeColor('#2563eb')
                   .lineWidth(3.5)
                   .moveTo(doc.page.margins.left, currentY)
                   .lineTo(doc.page.margins.left + 50, currentY)
                   .stroke()
                   .restore();
                doc.moveDown(1.2);
                break;
            }

            case 'h2': {
                if (doc.y > doc.page.height - 120) {
                    doc.addPage();
                } else {
                    doc.moveDown(1.2);
                }
                doc.font('Helvetica-Bold')
                   .fontSize(14)
                   .fillColor('#1e3a8a')
                   .text(block.text);
                doc.moveDown(0.6);
                break;
            }

            case 'h3': {
                if (doc.y > doc.page.height - 80) {
                    doc.addPage();
                } else {
                    doc.moveDown(1.0);
                }
                doc.font('Helvetica-Bold')
                   .fontSize(11)
                   .fillColor('#1f2937')
                   .text(block.text);
                doc.moveDown(0.4);
                break;
            }

            case 'hr': {
                doc.moveDown(0.8);
                const currentY = doc.y;
                doc.save()
                   .strokeColor('#e5e7eb')
                   .lineWidth(1)
                   .moveTo(doc.page.margins.left, currentY)
                   .lineTo(doc.page.width - doc.page.margins.right, currentY)
                   .stroke()
                   .restore();
                doc.moveDown(1.0);
                break;
            }

            case 'blank_line': {
                doc.moveDown(0.6);
                break;
            }

            case 'blockquote': {
                const parts = parseFormattedText(block.text);
                const startX = doc.x;
                const startY = doc.y;
                
                doc.x = startX + 15;
                renderFormattedParts(doc, parts, {
                    width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 15,
                    lineGap: 2
                });
                
                const endY = doc.y;
                
                // Draw quote left border
                doc.save()
                   .strokeColor('#d1d5db')
                   .lineWidth(3)
                   .moveTo(startX + 5, startY)
                   .lineTo(startX + 5, endY)
                   .stroke()
                   .restore();
                
                doc.x = startX;
                doc.moveDown(0.8);
                break;
            }

            case 'bullet_item':
            case 'numbered_item': {
                const parts = parseFormattedText(block.text);
                const indentLevel = block.indent || 0;
                const startX = doc.page.margins.left + (indentLevel * 12);
                const startY = doc.y;

                const label = block.type === 'bullet_item' ? '•' : `${block.number}.`;

                // Draw list marker
                doc.font('Helvetica-Bold')
                   .fillColor('#1e3a8a')
                   .text(label, startX, startY);

                // Draw indented item content
                doc.x = startX + 15;
                doc.y = startY;
                renderFormattedParts(doc, parts, {
                    width: doc.page.width - doc.page.margins.right - doc.x,
                    lineGap: 2
                });

                doc.x = doc.page.margins.left;
                doc.moveDown(0.5);
                break;
            }

            case 'code_block': {
                const codeLines = block.content.split('\n');
                const startX = doc.page.margins.left;
                const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
                const padding = 10;

                // Estimate code block height
                let blockHeight = padding * 2;
                doc.font('Courier').fontSize(8.5);
                for (const line of codeLines) {
                    blockHeight += doc.heightOfString(line || ' ', { width: width - padding * 2 }) + 2;
                }

                // If block exceeds current page space, force new page
                if (doc.y + blockHeight > doc.page.height - doc.page.margins.bottom) {
                    doc.addPage();
                }

                const rectY = doc.y;
                doc.save()
                   .fillColor('#f9fafb')
                   .strokeColor('#e5e7eb')
                   .lineWidth(1)
                   .roundedRect(startX, rectY, width, blockHeight, 4)
                   .fillAndStroke()
                   .restore();

                doc.x = startX + padding;
                doc.y = rectY + padding;
                doc.fillColor('#1f2937');
                
                for (const line of codeLines) {
                    doc.text(line, { width: width - padding * 2 });
                    doc.y += 2;
                }

                doc.x = doc.page.margins.left;
                doc.y = rectY + blockHeight;
                doc.moveDown(0.8);
                break;
            }

            case 'paragraph': {
                const parts = parseFormattedText(block.text);
                renderFormattedParts(doc, parts, {
                    width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
                    lineGap: 3
                });
                doc.moveDown(0.8);
                break;
            }
        }
    });

    // --- Dynamic Headers/Footers via Buffer Loop ---
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        
        // Running Header (only on page 2 onwards)
        if (i > 0) {
            const logoPath = getLogoPath();
            if (logoPath) {
                doc.image(logoPath, 50, 20, { width: 12, height: 12 });
            }
            
            doc.save()
               .font('Helvetica-Bold')
               .fontSize(7)
               .fillColor('#1e3a8a')
               .text('URBANSETU', 68, 23, { continued: true })
               .font('Helvetica')
               .fillColor('#9ca3af')
               .text('   |   SECURITY & COMPLIANCE SYSTEM');
            
            doc.strokeColor('#f3f4f6')
               .lineWidth(0.5)
               .moveTo(50, 35)
               .lineTo(doc.page.width - 50, 35)
               .stroke()
               .restore();
        }

        // Running Footer (on all pages)
        doc.save();
        doc.strokeColor('#e5e7eb')
           .lineWidth(0.5)
           .moveTo(50, doc.page.height - 40)
           .lineTo(doc.page.width - 50, doc.page.height - 40)
           .stroke();

        doc.font('Helvetica')
           .fontSize(7)
           .fillColor('#9ca3af')
           .text('Confidential - Official UrbanSetu Compliance Document', 50, doc.page.height - 30);
           
        const pageLabel = `Page ${i + 1} of ${range.count}`;
        doc.text(pageLabel, doc.page.width - 150, doc.page.height - 30, {
            width: 100,
            align: 'right'
        });
        doc.restore();
    }

    doc.end();
    console.log(`Completed PDF: ${path.basename(pdfFilePath)}`);
}

// Read directory and convert all files
const files = fs.readdirSync(SRC_DIR);
const mdFiles = files.filter(f => f.endsWith('.md'));

if (mdFiles.length === 0) {
    console.log('No Markdown files found in trust_docs directory.');
} else {
    mdFiles.forEach(file => {
        const mdPath = path.join(SRC_DIR, file);
        const pdfPath = path.join(SRC_DIR, file.replace(/\.md$/, '.pdf'));
        try {
            convertMdToPdf(mdPath, pdfPath);
        } catch (err) {
            console.error(`Error converting ${file}:`, err);
        }
    });
}
