import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  FileSpreadsheet,
  FileCode,
  File,
  Download,
  Trash2,
  Eye,
  ExternalLink,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { GeneratedFileSummary } from '../types';
import { getApiUrl } from '../services/apiConfig';
import { downloadFileHelper } from '../services/clientFileGenerator';
import { localChatStorage } from '../services/localChatStorage';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: GeneratedFileSummary | null;
  onDelete?: (id: string) => Promise<void>;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  file,
  onDelete,
}) => {
  const [textContent, setTextContent] = useState<string>('');
  const [tableData, setTableData] = useState<any[][]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !file) {
      setTextContent('');
      setTableData([]);
      setError(null);
      setShowDeleteConfirm(false);
      setIsDeleting(false);
      setDeleteError(null);
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
      }
      return;
    }

    setZoomLevel(100);
    setShowDeleteConfirm(false);
    setDeleteError(null);
    setLoading(true);
    setError(null);

    async function loadFileData() {
      try {
        // 1. Check local storage first (Offline / Local Generator Support)
        const localRecord = await localChatStorage.getFileData(file!.id);
        const dataUrl = localRecord?.data || (file!.downloadUrl?.startsWith('data:') ? file!.downloadUrl : null);

        if (file!.fileType === 'pdf') {
          if (dataUrl && dataUrl.startsWith('data:application/pdf')) {
            // Convert data url to blob for iframe/object
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setPdfBlobUrl(url);
            setLoading(false);
            return;
          }

          // Fetch PDF from server
          try {
            const res = await fetch(getApiUrl(`/api/files/view/${file!.id}`));
            if (res.ok) {
              const blob = await res.blob();
              const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
              setPdfBlobUrl(url);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.warn('PDF server fetch note:', e);
          }

          // If fetch fails but downloadUrl exists
          if (file!.downloadUrl) {
            setPdfBlobUrl(getApiUrl(file!.downloadUrl));
          }
          setLoading(false);
          return;
        }

        if (file!.fileType === 'xlsx' || file!.fileType === 'csv') {
          let arrayBuffer: ArrayBuffer | null = null;

          if (dataUrl && dataUrl.startsWith('data:')) {
            const res = await fetch(dataUrl);
            arrayBuffer = await res.arrayBuffer();
          } else {
            try {
              const res = await fetch(getApiUrl(file!.downloadUrl));
              if (res.ok) {
                arrayBuffer = await res.arrayBuffer();
              }
            } catch (e) {
              console.warn('Excel fetch note:', e);
            }
          }

          if (arrayBuffer) {
            const wb = XLSX.read(arrayBuffer, { type: 'array' });
            const firstSheetName = wb.SheetNames[0];
            const ws = wb.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
            setTableData(jsonData);
            setLoading(false);
            return;
          }
        }

        // Textual formats (txt, json, md, csv)
        if (['txt', 'json', 'csv', 'md', 'docx'].includes(file!.fileType)) {
          if (dataUrl && dataUrl.startsWith('data:')) {
            const res = await fetch(dataUrl);
            const text = await res.text();
            setTextContent(text);
            setLoading(false);
            return;
          }

          try {
            const res = await fetch(getApiUrl(file!.downloadUrl));
            if (res.ok) {
              const text = await res.text();
              setTextContent(text);
              setLoading(false);
              return;
            }
          } catch (err) {
            console.warn('Text fetch note:', err);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('File load error:', err);
        setError('Faili haikuweza kufunguliwa kikamilifu.');
        setLoading(false);
      }
    }

    loadFileData();

    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [isOpen, file?.id]);

  if (!isOpen || !file) return null;

  const handleDownload = () => {
    downloadFileHelper(file);
  };

  const handleCopyContent = () => {
    if (!textContent) return;
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmDelete = async () => {
    if (!onDelete || !file) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(file.id);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err: any) {
      console.error('Delete error:', err);
      setIsDeleting(false);
      setDeleteError('Faili haikuweza kufutwa.');
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-400" />;
      case 'xlsx':
      case 'csv':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
      case 'docx':
        return <FileText className="w-5 h-5 text-blue-400" />;
      case 'json':
        return <FileCode className="w-5 h-5 text-[#D4AF37]" />;
      default:
        return <File className="w-5 h-5 text-[#888888]" />;
    }
  };

  const renderViewer = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-[#888888] space-y-3">
          <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold">Inafungua maudhui ya {file.filename}...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-8 text-center bg-[#150a0a] rounded-2xl border border-red-500/30 text-red-400 space-y-3">
          <AlertCircle className="w-8 h-8 mx-auto text-red-400" />
          <p className="text-sm font-bold">{error}</p>
          <p className="text-xs text-[#888888]">
            Tafadhali pakua faili hili moja kwa moja ili kulifungua kwenye programu yako unayoipenda.
          </p>
          <button
            onClick={handleDownload}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold text-xs uppercase cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Pakua Faili ({(file.size / 1024).toFixed(1)} KB)</span>
          </button>
        </div>
      );
    }

    // PDF Preview
    if (file.fileType === 'pdf') {
      const inlineUrl = pdfBlobUrl || getApiUrl(`/api/files/view/${file.id}`);
      return (
        <div className="w-full flex flex-col bg-[#111111] rounded-2xl overflow-hidden border border-[#222222]">
          <div className="p-2.5 bg-[#1a1a1a] border-b border-[#2a2a2a] flex items-center justify-between px-4 text-xs text-[#888888]">
            <span className="font-semibold text-[#F5F2ED] flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-red-400" />
              <span>PDF In-App Viewer (Muundo Halisi wa PDF)</span>
            </span>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleDownload}
                className="text-[#D4AF37] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <span>Pakua Moja kwa Moja</span>
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="w-full h-[62vh] relative bg-[#1e1e1e] flex flex-col items-center justify-center">
            <object data={inlineUrl} type="application/pdf" className="w-full h-full border-0">
              <iframe src={`${inlineUrl}#toolbar=1&navpanes=0`} title={file.filename} className="w-full h-full border-0">
                <div className="p-6 text-center text-[#888888]">
                  <p className="text-sm text-[#F5F2ED] font-bold mb-2">PDF haikuweza kuonekana moja kwa moja kwenye fremu hii.</p>
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold text-xs uppercase cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Pakua PDF ({(file.size / 1024).toFixed(1)} KB)</span>
                  </button>
                </div>
              </iframe>
            </object>
          </div>
        </div>
      );
    }

    // Excel Table Preview
    if ((file.fileType === 'xlsx' || file.fileType === 'csv') && tableData.length > 0) {
      return (
        <div className="bg-[#050505] p-4 rounded-2xl border border-[#222222] max-h-[60vh] overflow-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              {tableData.slice(0, 1).map((row, rIdx) => (
                <tr key={rIdx} className="bg-[#1a1a1a] border-b border-[#333333]">
                  {row.map((cell: any, cIdx: number) => (
                    <th key={cIdx} className="p-2.5 text-[#D4AF37] font-bold uppercase tracking-wider">
                      {String(cell || '')}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {tableData.slice(1).map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-[#1f1f1f] hover:bg-[#111111]">
                  {row.map((cell: any, cIdx: number) => (
                    <td key={cIdx} className="p-2.5 text-[#F5F2ED]">
                      {String(cell !== undefined && cell !== null ? cell : '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // Image Preview
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(file.fileType.toLowerCase()) || file.mimeType?.startsWith('image/') || file.previewUrl || file.base64Data) {
      const imgSrc = file.previewUrl
        ? file.previewUrl
        : file.base64Data
        ? (file.base64Data.startsWith('data:') ? file.base64Data : `data:${file.mimeType || 'image/png'};base64,${file.base64Data}`)
        : file.downloadUrl?.startsWith('data:')
        ? file.downloadUrl
        : getApiUrl(file.downloadUrl || `/api/files/view/${file.id}`);
      return (
        <div className="flex flex-col items-center justify-center p-4 bg-[#0a0a0a] rounded-2xl border border-[#222222] min-h-[300px] overflow-auto">
          <img
            src={imgSrc}
            alt={file.filename}
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center center' }}
            className="max-h-[60vh] max-w-full object-contain rounded-lg transition-transform duration-150"
            onError={(e) => {
              if (file.downloadUrl) {
                (e.target as HTMLImageElement).src = getApiUrl(file.downloadUrl);
              }
            }}
          />
        </div>
      );
    }

    // Textual: JSON / CSV / TXT / MD
    if (['txt', 'json', 'csv', 'md'].includes(file.fileType) || textContent) {
      return (
        <div className="relative bg-[#050505] p-4 sm:p-6 rounded-2xl border border-[#222222] max-h-[60vh] overflow-y-auto font-mono text-xs sm:text-sm text-[#F5F2ED] leading-relaxed">
          <div className="sticky top-0 right-0 flex justify-end pb-2">
            <button
              onClick={handleCopyContent}
              className="p-2 rounded-lg bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#888888] hover:text-[#F5F2ED] border border-[#333333] transition cursor-pointer flex items-center space-x-1"
              title="Nakili Maudhui"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400 font-sans">Imenakiliwa</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-sans">Nakili</span>
                </>
              )}
            </button>
          </div>
          <pre className="whitespace-pre-wrap break-words font-mono select-text">
            {textContent || 'Faili ni tupu au halina maandishi.'}
          </pre>
        </div>
      );
    }

    // Word (DOCX) fallback card
    return (
      <div className="p-8 sm:p-12 text-center bg-[#0a0a0a] rounded-2xl border border-[#222222] space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[#151515] border border-[#262626] flex items-center justify-center mx-auto shadow-xl">
          {getFileIcon(file.fileType)}
        </div>
        <div className="space-y-1">
          <h4 className="serif font-bold text-base sm:text-lg text-[#F5F2ED]">{file.filename}</h4>
          <p className="text-xs text-[#888888]">
            Muundo wa {file.fileType.toUpperCase()} ({(file.size / 1024).toFixed(1)} KB)
          </p>
          <p className="text-xs text-[#666666] max-w-md mx-auto pt-2">
            Faili hili limetengenezwa kwa muundo halisi wa binary wa {file.fileType.toUpperCase()}. Unaweza kulipakua mara moja au kulifungua kwenye kifaa chako.
          </p>
        </div>

        <div className="pt-2 flex justify-center">
          <button
            id="modal-doc-download-action"
            onClick={handleDownload}
            className="px-6 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider flex items-center space-x-2 shadow-lg transition cursor-pointer"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>PAKUA FAILI SASA ({(file.size / 1024).toFixed(1)} KB)</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in text-[#F5F2ED]">
      <div className="relative w-full max-w-3xl bg-[#0d0d0d] border border-[#262626] rounded-3xl p-5 sm:p-7 shadow-2xl overflow-hidden flex flex-col space-y-4 max-h-[92vh]">
        {/* Delete Confirmation Overlay */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center space-y-4 animate-fade-in">
            <div className="p-3.5 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-1 max-w-md">
              <h3 className="serif font-bold text-lg text-white">Una uhakika unataka kufuta faili hili?</h3>
              <p className="text-xs text-[#888888]">
                Faili <span className="text-[#F5F2ED] font-mono font-bold">"{file.filename}"</span> litafutwa kabisa kutoka kwenye hifadhi ya kifaa hiki.
              </p>
            </div>

            {deleteError && (
              <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-semibold">
                {deleteError}
              </div>
            )}

            <div className="flex items-center space-x-3 pt-2">
              <button
                id="cancel-delete-confirm-btn"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl glass border border-[#333333] text-[#888888] hover:text-[#F5F2ED] text-xs font-bold uppercase tracking-wider transition cursor-pointer"
              >
                CANCEL
              </button>

              <button
                id="do-delete-confirm-btn"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider flex items-center space-x-2 shadow-lg transition cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Inafuta...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>DELETE</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[#202020] pb-3.5">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="p-2.5 rounded-xl bg-[#141414] border border-[#242424] flex-shrink-0">
              {getFileIcon(file.fileType)}
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-white text-sm sm:text-base truncate" title={file.filename}>
                  {file.filename}
                </h3>
                <span className="text-[9px] px-2 py-0.5 rounded font-bold uppercase bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 flex-shrink-0">
                  {file.fileType.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-[#888888] font-mono">
                {(file.size / 1024).toFixed(1)} KB • Imehifadhiwa {new Date(file.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {['png', 'jpg', 'jpeg'].includes(file.fileType) && (
              <div className="flex items-center space-x-1 glass p-1 rounded-xl border border-[#222222] mr-1">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(50, z - 20))}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-[#888888] hover:text-[#F5F2ED] cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] text-[#888888] px-1 font-mono">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(200, z + 20))}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-[#888888] hover:text-[#F5F2ED] cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              id="close-doc-preview-modal"
              onClick={onClose}
              className="p-2 rounded-xl glass text-[#888888] hover:text-[#F5F2ED] border-[#222222] hover:bg-white/5 transition cursor-pointer"
              title="Funga"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewer Content */}
        <div className="flex-1 overflow-y-auto py-1">{renderViewer()}</div>

        {/* Bottom Actions Bar */}
        <div className="flex items-center justify-between border-t border-[#202020] pt-3">
          <div>
            {onDelete && (
              <button
                id="doc-preview-delete-btn"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3.5 py-2 rounded-xl text-red-400 hover:bg-red-500/10 border border-red-500/20 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>DELETE</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              id="doc-preview-download-btn"
              onClick={handleDownload}
              className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider flex items-center space-x-2 shadow-lg transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>DOWNLOAD ({(file.size / 1024).toFixed(1)} KB)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentPreviewModal;
