/**
 * MKUU AI — Client-Side Binary & Text File Generator
 * 
 * Generates genuine PDF, Word (.docx), Excel (.xlsx), CSV, JSON, Markdown, and TXT files
 * directly in the browser / Android Capacitor APK environment without requiring server roundtrips.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { GeneratedFileSummary } from '../types';
import { localChatStorage } from './localChatStorage';
import { getApiUrl } from './apiConfig';

export interface ClientGenerateOptions {
  title: string;
  fileType: 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'json' | 'md';
  contentPrompt: string;
  data?: any[];
  description?: string;
}

export interface GeneratedClientFileResult {
  file: GeneratedFileSummary;
  blob: Blob;
  base64Data: string;
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

/**
 * Generate PDF in pure JavaScript client-side
 */
async function generateClientPdf(title: string, content: string): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const gold = rgb(0.83, 0.69, 0.22); // #D4AF37
  const darkBg = rgb(0.08, 0.08, 0.08);
  const textDark = rgb(0.12, 0.12, 0.12);
  const textMuted = rgb(0.45, 0.45, 0.45);

  let y = height - 50;

  // Header Bar
  page.drawRectangle({
    x: 40,
    y: y - 55,
    width: width - 80,
    height: 60,
    color: darkBg,
  });

  page.drawRectangle({
    x: 40,
    y: y - 57,
    width: width - 80,
    height: 3,
    color: gold,
  });

  page.drawText('MKUU AI — WARAKA NA RIPOTI RASMI', {
    x: 55,
    y: y - 25,
    size: 14,
    font: helveticaBold,
    color: gold,
  });

  page.drawText(`MMILIKI: MAX  |  TAREHE: ${new Date().toLocaleDateString('sw-TZ')}  |  MUUNDO: PDF RASMI`, {
    x: 55,
    y: y - 45,
    size: 8,
    font: helvetica,
    color: rgb(0.9, 0.9, 0.9),
  });

  y -= 85;

  // Document Title
  const cleanTitle = sanitizeForPdf(title);
  page.drawText(cleanTitle, {
    x: 40,
    y,
    size: 16,
    font: helveticaBold,
    color: textDark,
  });

  y -= 25;

  // Content Paragraphs
  const cleanContent = sanitizeForPdf(content);
  const lines = cleanContent.split('\n');

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      y -= 10;
      continue;
    }

    if (y < 70) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = height - 50;
    }

    // Check if header or bullet
    if (trimmed.startsWith('#') || trimmed.startsWith('===') || trimmed.endsWith(':')) {
      y -= 8;
      page.drawText(trimmed.replace(/^[#=\s]+/, ''), {
        x: 40,
        y,
        size: 11,
        font: helveticaBold,
        color: gold,
      });
      y -= 16;
    } else {
      // Wrap text
      const words = trimmed.split(' ');
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const textWidth = helvetica.widthOfTextAtSize(testLine, 10);
        if (textWidth > width - 80) {
          page.drawText(currentLine, {
            x: 40,
            y,
            size: 10,
            font: helvetica,
            color: textDark,
          });
          y -= 14;
          currentLine = word;
          if (y < 70) {
            page = pdfDoc.addPage([595.28, 841.89]);
            y = height - 50;
          }
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        page.drawText(currentLine, {
          x: 40,
          y,
          size: 10,
          font: helvetica,
          color: textDark,
        });
        y -= 14;
      }
    }
  }

  // Footer on current page
  page.drawText('Imetengenezwa na MKUU AI — Mfumo Mahususi wa Max', {
    x: 40,
    y: 30,
    size: 8,
    font: helveticaOblique,
    color: textMuted,
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * Generate Excel (.xlsx) client-side
 */
function generateClientXlsx(title: string, content: string, customData?: any[]): Blob {
  const wb = XLSX.utils.book_new();

  let rows: any[] = [];
  if (customData && Array.isArray(customData) && customData.length > 0) {
    rows = customData;
  } else {
    // Parse content lines or generate structured tabular data
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
    rows.push({
      Kipengele: 'Jina la Mradi / Waraka',
      Maelezo: title,
      Hali: 'Imekamilika',
      Tarehe: new Date().toLocaleDateString('sw-TZ'),
    });

    lines.forEach((line, idx) => {
      if (line.includes(':') || line.includes('-') || line.includes(',')) {
        const parts = line.split(/[:,-]/).map((p) => p.trim());
        rows.push({
          Nambari: idx + 1,
          Kipengele: parts[0] || `Kipengele ${idx + 1}`,
          Maelezo: parts[1] || parts[0],
          Kiasi_au_Kiwango: parts[2] || 'Tsh 0',
          Tarehe: new Date().toLocaleDateString('sw-TZ'),
        });
      } else {
        rows.push({
          Nambari: idx + 1,
          Kipengele: `Mada ${idx + 1}`,
          Maelezo: line,
          Hali: 'Inafanyiwa kazi',
          Tarehe: new Date().toLocaleDateString('sw-TZ'),
        });
      }
    });
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Data ya Max');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Generate Word (.docx) client-side
 */
async function generateClientDocx(title: string, content: string): Promise<Blob> {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Imetayarishwa kwa ajili ya: Max  |  Msaidizi: MKUU AI  |  Tarehe: ${new Date().toLocaleDateString('sw-TZ')}`,
          italics: true,
          color: '666666',
          size: 20,
        }),
      ],
      spacing: { after: 400 },
    }),
  ];

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      paragraphs.push(new Paragraph({ spacing: { after: 120 } }));
      continue;
    }

    if (trimmed.startsWith('#') || trimmed.startsWith('===')) {
      paragraphs.push(
        new Paragraph({
          text: trimmed.replace(/^[#=\s]+/, ''),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
        })
      );
    } else if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
      paragraphs.push(
        new Paragraph({
          text: trimmed.replace(/^[•\-*]\s*/, ''),
          bullet: { level: 0 },
          spacing: { after: 80 },
        })
      );
    } else {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed, size: 22 })],
          spacing: { after: 140 },
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

  const blob = await Packer.toBlob(doc);
  return blob;
}

/**
 * Convert Blob to Base64 String
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Client-Side Autonomous File Generator
 */
export async function clientGenerateFile(options: ClientGenerateOptions): Promise<GeneratedClientFileResult> {
  const { title, fileType, contentPrompt, data, description } = options;
  const safeFilename = sanitizeFilename(title || `mkuu_doc_${Date.now()}`);
  const finalFilename = safeFilename.endsWith(`.${fileType}`) ? safeFilename : `${safeFilename}.${fileType}`;
  const fileId = `file_loc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  let blob: Blob;
  let mimeType = 'text/plain';

  if (fileType === 'pdf') {
    mimeType = 'application/pdf';
    blob = await generateClientPdf(title, contentPrompt);
  } else if (fileType === 'xlsx') {
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    blob = generateClientXlsx(title, contentPrompt, data);
  } else if (fileType === 'docx') {
    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    blob = await generateClientDocx(title, contentPrompt);
  } else if (fileType === 'csv') {
    mimeType = 'text/csv; charset=utf-8';
    const csvContent = `Namba,Kipengele,Maelezo,Tarehe\n1,"${title}","${contentPrompt.replace(/"/g, '""')}","${new Date().toLocaleDateString('sw-TZ')}"\n`;
    blob = new Blob([csvContent], { type: mimeType });
  } else if (fileType === 'json') {
    mimeType = 'application/json';
    const jsonStr = JSON.stringify(
      data || {
        title,
        owner: 'Max',
        generatedBy: 'MKUU AI Client Engine',
        content: contentPrompt,
        createdAt: new Date().toISOString(),
      },
      null,
      2
    );
    blob = new Blob([jsonStr], { type: mimeType });
  } else if (fileType === 'md') {
    mimeType = 'text/markdown; charset=utf-8';
    const mdContent = `# ${title}\n\n*Mmiliki: Max | Msaidizi: MKUU AI | Tarehe: ${new Date().toLocaleDateString('sw-TZ')}*\n\n---\n\n${contentPrompt}\n`;
    blob = new Blob([mdContent], { type: mimeType });
  } else {
    mimeType = 'text/plain; charset=utf-8';
    const txtContent = `=== ${title} ===\nTarehe: ${new Date().toLocaleDateString('sw-TZ')}\nMmiliki: Max\n\n${contentPrompt}\n\n[MKUU AI - Max Personal Assistant]`;
    blob = new Blob([txtContent], { type: mimeType });
  }

  const base64Data = await blobToBase64(blob);

  const fileSummary: GeneratedFileSummary = {
    id: fileId,
    filename: finalFilename,
    fileType,
    size: blob.size,
    mimeType,
    createdAt: new Date().toISOString(),
    description: description || `Faili la ${fileType.toUpperCase()} lililoandaliwa papo hapo kwa Max (${(blob.size / 1024).toFixed(1)} KB)`,
    downloadUrl: base64Data, // Data URL is directly downloadable everywhere
  };

  // Persist locally in IndexedDB / LocalStorage
  await localChatStorage.saveFile(fileSummary, base64Data);

  return {
    file: fileSummary,
    blob,
    base64Data,
  };
}

/**
 * Universal, Fail-Safe Download Helper
 * Guaranteed to trigger downloads in Web Browsers, Android WebViews, Capacitor APKs, and iOS.
 */
export async function downloadFileHelper(file: {
  filename: string;
  downloadUrl?: string;
  base64Data?: string;
  content?: string;
  mimeType?: string;
  fileType?: string;
}): Promise<void> {
  if (typeof window === 'undefined') return;

  const filename = file.filename || `mkuu_file_${Date.now()}`;
  let objectUrl: string | null = null;

  // Native Android APK Bridge Check: Saves directly into device Pictures/Downloads
  const nativeDevice = (window as any).MkuuDevice;
  const isNativeSupported = nativeDevice && typeof nativeDevice.saveMediaFile === 'function';

  try {
    // 1. If base64 data is present
    if (file.base64Data) {
      const rawBase64 = file.base64Data.startsWith('data:')
        ? file.base64Data.split(',')[1]
        : file.base64Data;
      if (isNativeSupported) {
        try {
          const handled = nativeDevice.saveMediaFile(rawBase64, filename, file.mimeType || 'image/png');
          if (handled) return;
        } catch (err) {
          console.warn('[MKUU-DOWNLOAD] Native saveMediaFile failed:', err);
        }
      }

      const dataUri = file.base64Data.startsWith('data:')
        ? file.base64Data
        : `data:${file.mimeType || 'application/octet-stream'};base64,${file.base64Data}`;
      const link = document.createElement('a');
      link.href = dataUri;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => document.body.removeChild(link), 1500);
      return;
    }

    // 2. If it's a blob url or data url
    if (file.downloadUrl && (file.downloadUrl.startsWith('data:') || file.downloadUrl.startsWith('blob:'))) {
      if (file.downloadUrl.startsWith('data:') && isNativeSupported) {
        try {
          const rawBase64 = file.downloadUrl.split(',')[1];
          const handled = nativeDevice.saveMediaFile(rawBase64, filename, file.mimeType || 'image/png');
          if (handled) return;
        } catch (err) {
          console.warn('[MKUU-DOWNLOAD] Native saveMediaFile data URL failed:', err);
        }
      }

      const link = document.createElement('a');
      link.href = file.downloadUrl;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => document.body.removeChild(link), 1500);
      return;
    }

    // 3. If file is stored in local database
    const localFile = await localChatStorage.getFileData(file.filename);
    if (localFile?.data && localFile.data.startsWith('data:')) {
      if (isNativeSupported) {
        try {
          const rawBase64 = localFile.data.split(',')[1];
          const handled = nativeDevice.saveMediaFile(rawBase64, filename, file.mimeType || 'image/png');
          if (handled) return;
        } catch (err) {
          console.warn('[MKUU-DOWNLOAD] Native saveMediaFile local DB failed:', err);
        }
      }

      const link = document.createElement('a');
      link.href = localFile.data;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => document.body.removeChild(link), 1500);
      return;
    }

    // 4. If remote URL, fetch as blob and download
    if (file.downloadUrl) {
      const fullUrl = getApiUrl(file.downloadUrl);
      try {
        const res = await fetch(fullUrl);
        if (res.ok) {
          const blob = await res.blob();
          objectUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = objectUrl;
          link.download = filename;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            document.body.removeChild(link);
            if (objectUrl) URL.revokeObjectURL(objectUrl);
          }, 2000);
          return;
        }
      } catch (fetchErr) {
        console.warn('Direct fetch download note:', fetchErr);
      }

      // Fallback direct link
      const fallbackLink = document.createElement('a');
      fallbackLink.href = fullUrl;
      fallbackLink.download = filename;
      fallbackLink.target = '_blank';
      document.body.appendChild(fallbackLink);
      fallbackLink.click();
      setTimeout(() => document.body.removeChild(fallbackLink), 1500);
      return;
    }

    // 5. If text content provided
    if (file.content) {
      const blob = new Blob([file.content], { type: file.mimeType || 'text/plain;charset=utf-8' });
      objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      }, 2000);
      return;
    }
  } catch (err) {
    console.error('Universal download error:', err);
    if (file.downloadUrl) {
      window.open(getApiUrl(file.downloadUrl), '_blank');
    }
  }
}
