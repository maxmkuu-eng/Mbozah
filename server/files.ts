import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { db, FILES_DIR, GeneratedFileSummary } from './db.js';

export interface GenerateFileOptions {
  userId: string;
  filename: string;
  fileType: 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'json' | 'md' | 'zip' | 'png' | 'jpg' | 'jpeg' | 'webp' | 'svg';
  title?: string;
  content: string;
  data?: any[];
  description?: string;
  base64Data?: string;
}

export async function generateRealFile(options: GenerateFileOptions): Promise<GeneratedFileSummary> {
  const { userId, fileType, title, content, data, description, base64Data } = options;
  const safeFilename = sanitizeFilename(options.filename || `mkuu_document_${Date.now()}.${fileType}`);
  const finalFilename = safeFilename.endsWith(`.${fileType}`) ? safeFilename : `${safeFilename}.${fileType}`;
  const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const diskFilename = `${fileId}_${finalFilename}`;
  const diskPath = path.join(FILES_DIR, diskFilename);

  let mimeType = 'text/plain';
  let buffer: Buffer;

  if (fileType === 'png') {
    mimeType = 'image/png';
    buffer = base64Data ? Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ''), 'base64') : Buffer.from(content, 'base64');
  } else if (fileType === 'jpg' || fileType === 'jpeg') {
    mimeType = 'image/jpeg';
    buffer = base64Data ? Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ''), 'base64') : Buffer.from(content, 'base64');
  } else if (fileType === 'webp') {
    mimeType = 'image/webp';
    buffer = base64Data ? Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ''), 'base64') : Buffer.from(content, 'base64');
  } else if (fileType === 'svg') {
    mimeType = 'image/svg+xml';
    buffer = Buffer.from(content, 'utf-8');
  } else if (fileType === 'pdf') {
    mimeType = 'application/pdf';
    buffer = await generatePdfBuffer(title || 'MKUU AI Document', content, data);
  } else if (fileType === 'xlsx') {
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    buffer = generateXlsxBuffer(title || 'MKUU AI Sheet', content, data);
  } else if (fileType === 'docx') {
    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    buffer = await generateDocxBuffer(title || 'MKUU AI Document', content);
  } else if (fileType === 'csv') {
    mimeType = 'text/csv; charset=utf-8';
    buffer = Buffer.from(generateCsvContent(content, data), 'utf-8');
  } else if (fileType === 'json') {
    mimeType = 'application/json';
    const jsonStr = typeof content === 'string' && (content.startsWith('{') || content.startsWith('['))
      ? content
      : JSON.stringify(data || { title, generatedBy: 'MKUU AI', owner: 'Max', content, date: new Date().toISOString() }, null, 2);
    buffer = Buffer.from(jsonStr, 'utf-8');
  } else if (fileType === 'md') {
    mimeType = 'text/markdown; charset=utf-8';
    const mdContent = `# ${title || 'MKUU AI Report'}\n\n*Mmiliki: Max | Msaidizi: MKUU AI | Tarehe: ${new Date().toLocaleDateString('sw-TZ')}*\n\n---\n\n${content}`;
    buffer = Buffer.from(mdContent, 'utf-8');
  } else {
    // Default txt
    mimeType = 'text/plain; charset=utf-8';
    const txtContent = `${title ? `=== ${title} ===\n\n` : ''}${content}\n\n[MKUU AI - Max Personal Assistant]`;
    buffer = Buffer.from(txtContent, 'utf-8');
  }

  // Write to disk
  fs.writeFileSync(diskPath, buffer);
  const size = buffer.length;

  const isImage = mimeType.startsWith('image/');
  const cleanBase64 = base64Data ? base64Data.replace(/^data:image\/\w+;base64,/, '') : (isImage ? buffer.toString('base64') : undefined);
  const previewUrl = cleanBase64 ? `data:${mimeType};base64,${cleanBase64}` : undefined;

  const fileRecord: GeneratedFileSummary = {
    id: fileId,
    filename: finalFilename,
    fileType,
    size,
    mimeType,
    createdAt: new Date().toISOString(),
    description: description || `Faili la ${fileType.toUpperCase()} lililoandaliwa na MKUU AI kwa ajili ya Max`,
    downloadUrl: `/api/files/download/${fileId}`,
    previewUrl,
    base64Data: cleanBase64,
  };

  db.addFile(fileRecord);
  return fileRecord;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function sanitizeForPdf(text: string): string {
  if (!text) return '';
  return text
    .replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/•/g, '*')
    .replace(/[^\x00-\xFF]/g, ' ')
    .trim();
}

async function generatePdfBuffer(title: string, content: string, data?: any[]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Top header banner
  page.drawRectangle({
    x: 40,
    y: height - 85,
    width: width - 80,
    height: 45,
    color: rgb(0.06, 0.09, 0.16), // Dark slate
  });

  page.drawText('MKUU AI - MAX PERSONAL ASSISTANT', {
    x: 55,
    y: height - 60,
    size: 14,
    font: helveticaBold,
    color: rgb(0.9, 0.75, 0.3), // Gold accent
  });

  page.drawText(sanitizeForPdf(`Tarehe: ${new Date().toLocaleDateString('sw-TZ')} | Mmiliki: MAX`), {
    x: 55,
    y: height - 76,
    size: 9,
    font: helvetica,
    color: rgb(0.8, 0.85, 0.9),
  });

  let currentY = height - 120;

  // Title
  const cleanTitle = sanitizeForPdf(title) || 'MKUU AI DOCUMENT';
  page.drawText(cleanTitle, {
    x: 40,
    y: currentY,
    size: 18,
    font: helveticaBold,
    color: rgb(0.1, 0.15, 0.25),
  });
  currentY -= 25;

  // Divider line
  page.drawLine({
    start: { x: 40, y: currentY + 10 },
    end: { x: width - 40, y: currentY + 10 },
    thickness: 1.5,
    color: rgb(0.85, 0.88, 0.92),
  });
  currentY -= 15;

  // Format content lines
  const rawLines = (content || '').split('\n');
  const maxCharsPerLine = 75;

  for (const rawLine of rawLines) {
    const cleanLine = sanitizeForPdf(rawLine);
    if (currentY < 80) {
      page = pdfDoc.addPage([595.28, 841.89]);
      currentY = height - 60;
    }

    if (cleanLine.trim() === '') {
      currentY -= 12;
      continue;
    }

    // Check heading
    if (cleanLine.startsWith('# ') || cleanLine.startsWith('## ') || cleanLine.startsWith('### ')) {
      const headingText = cleanLine.replace(/^#+\s*/, '');
      currentY -= 8;
      page.drawText(headingText, {
        x: 40,
        y: currentY,
        size: 13,
        font: helveticaBold,
        color: rgb(0.15, 0.2, 0.35),
      });
      currentY -= 18;
      continue;
    }

    // Bullet point
    if (cleanLine.trim().startsWith('- ') || cleanLine.trim().startsWith('* ')) {
      const bulletText = cleanLine.trim().replace(/^[-*]\s*/, '');
      page.drawCircle({
        x: 46,
        y: currentY + 3.5,
        size: 2.5,
        color: rgb(0.9, 0.7, 0.2),
      });
      
      const wrapped = wrapText(bulletText, maxCharsPerLine - 6);
      for (const line of wrapped) {
        if (currentY < 80) {
          page = pdfDoc.addPage([595.28, 841.89]);
          currentY = height - 60;
        }
        page.drawText(line, {
          x: 58,
          y: currentY,
          size: 10.5,
          font: helvetica,
          color: rgb(0.2, 0.25, 0.3),
        });
        currentY -= 15;
      }
      continue;
    }

    // Standard paragraph
    const wrapped = wrapText(cleanLine, maxCharsPerLine);
    for (const line of wrapped) {
      if (currentY < 80) {
        page = pdfDoc.addPage([595.28, 841.89]);
        currentY = height - 60;
      }
      page.drawText(line, {
        x: 40,
        y: currentY,
        size: 10.5,
        font: helvetica,
        color: rgb(0.2, 0.25, 0.3),
      });
      currentY -= 15;
    }
  }

  // Footer on all pages
  const pageCount = pdfDoc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const p = pdfDoc.getPage(i);
    p.drawLine({
      start: { x: 40, y: 45 },
      end: { x: width - 40, y: 45 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    p.drawText(`Imeandaliwa na MKUU AI kwa ajili ya Max - Ukurasa ${i + 1} kati ya ${pageCount}`, {
      x: 40,
      y: 30,
      size: 8,
      font: helveticaOblique,
      color: rgb(0.5, 0.55, 0.6),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxChars) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function generateXlsxBuffer(title: string, content: string, data?: any[]): Buffer {
  const wb = XLSX.utils.book_new();

  let rows: any[] = [];
  if (Array.isArray(data) && data.length > 0) {
    rows = data;
  } else {
    // Parse content lines or create structured table
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsedRows: any[] = [];

    // Check if table like markdown
    const isTable = lines.some((l) => l.includes('|'));
    if (isTable) {
      const tableLines = lines.filter((l) => l.includes('|') && !l.includes('---'));
      if (tableLines.length > 0) {
        const headers = tableLines[0].split('|').map((h) => h.trim()).filter(Boolean);
        for (let i = 1; i < tableLines.length; i++) {
          const cells = tableLines[i].split('|').map((c) => c.trim()).filter(Boolean);
          const obj: Record<string, any> = {};
          headers.forEach((h, idx) => {
            obj[h] = cells[idx] || '';
          });
          parsedRows.push(obj);
        }
      }
    }

    if (parsedRows.length > 0) {
      rows = parsedRows;
    } else {
      // Default structure
      rows = lines.map((l, index) => ({
        Nambari: index + 1,
        Maelezo: l,
        Mmiliki: 'Max',
        Tarehe: new Date().toLocaleDateString('sw-TZ'),
      }));
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-width columns
  const colKeys = Object.keys(rows[0] || {});
  const colWidths = colKeys.map((key) => ({
    wch: Math.max(key.length + 4, 16),
  }));
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Ripoti ya Max');

  // Metadata sheet
  const metaWs = XLSX.utils.aoa_to_sheet([
    ['MKUU AI — MFUMO WA MAX'],
    ['Kichwa cha Ripoti', title],
    ['Mmiliki', 'MAX'],
    ['Tarehe ya Kutengenezwa', new Date().toISOString()],
    ['Hali', 'Imethibitishwa na Mkuu AI'],
  ]);
  XLSX.utils.book_append_sheet(wb, metaWs, 'Taarifa za Faili');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buf);
}

async function generateDocxBuffer(title: string, content: string): Promise<Buffer> {
  const lines = content.split('\n');

  const paragraphs: Paragraph[] = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.LEFT,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Mmiliki: MAX | Msaidizi: MKUU AI | Tarehe: ${new Date().toLocaleDateString('sw-TZ')}`,
          italics: true,
          color: '666666',
          size: 20,
        }),
      ],
      spacing: { after: 300 },
    }),
  ];

  for (const line of lines) {
    if (!line.trim()) {
      paragraphs.push(new Paragraph({ text: '' }));
      continue;
    }

    if (line.startsWith('# ')) {
      paragraphs.push(
        new Paragraph({
          text: line.replace('# ', ''),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
        })
      );
    } else if (line.startsWith('## ')) {
      paragraphs.push(
        new Paragraph({
          text: line.replace('## ', ''),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 180, after: 100 },
        })
      );
    } else if (line.startsWith('### ')) {
      paragraphs.push(
        new Paragraph({
          text: line.replace('### ', ''),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 140, after: 80 },
        })
      );
    } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      paragraphs.push(
        new Paragraph({
          text: line.trim().replace(/^[-*]\s*/, ''),
          bullet: { level: 0 },
          spacing: { after: 80 },
        })
      );
    } else {
      paragraphs.push(
        new Paragraph({
          text: line,
          spacing: { after: 120 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

function generateCsvContent(content: string, data?: any[]): string {
  if (Array.isArray(data) && data.length > 0) {
    const keys = Object.keys(data[0]);
    const header = keys.map((k) => `"${k}"`).join(',');
    const rows = data.map((item) =>
      keys.map((k) => `"${String(item[k] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    return [header, ...rows].join('\n');
  }

  // Convert content lines
  const lines = content.split('\n').filter(Boolean);
  const rows = lines.map((l, idx) => `"${idx + 1}","${l.replace(/"/g, '""')}","Max","${new Date().toLocaleDateString('sw-TZ')}"`);
  return ['"Namba","Maelezo","Mmiliki","Tarehe"', ...rows].join('\n');
}

export async function ensureInitialSeedFiles(_userId: string = 'user_max_owner') {
  // No sample files: only files explicitly generated or uploaded by the user are stored.
  return;
}

