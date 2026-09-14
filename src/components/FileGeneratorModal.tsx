import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Download,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { GeneratedFileSummary } from '../types';
import { downloadFileHelper } from '../services/clientFileGenerator';

interface FileGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateFile: (params: {
    title: string;
    fileType: 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'json' | 'md';
    contentPrompt: string;
  }) => Promise<GeneratedFileSummary>;
}

export const FileGeneratorModal: React.FC<FileGeneratorModalProps> = ({
  isOpen,
  onClose,
  onGenerateFile,
}) => {
  const [title, setTitle] = useState('');
  const [fileType, setFileType] = useState<'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'json' | 'md'>('pdf');
  const [contentPrompt, setContentPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedFile, setGeneratedFile] = useState<GeneratedFileSummary | null>(null);

  if (!isOpen) return null;

  const templates = [
    {
      label: '📄 Ripoti ya Wiki (PDF)',
      title: 'Ripoti ya Wiki ya Miradi ya Max',
      type: 'pdf' as const,
      prompt: 'Muhtasari wa maendeleo ya miradi, malengo yaliyofikiwa, na mipango ya wiki ijayo kwa Max.',
    },
    {
      label: '📊 Bajeti ya Ofisi (Excel)',
      title: 'Bajeti na Matumizi ya Ofisi',
      type: 'xlsx' as const,
      prompt: 'Jedwali la mapato, vifaa vya ofisi, mishahara, na gharama za uendeshaji.',
    },
    {
      label: '📝 Makubaliano Rasmi (Word)',
      title: 'Makubaliano ya Kazi na Masharti',
      type: 'docx' as const,
      prompt: 'Mkataba wa huduma na ushirikiano wa kitaalamu uliolindwa na sheria.',
    },
    {
      label: '📑 Orodha ya Mawasiliano (CSV)',
      title: 'Orodha ya Watu wa Karibu na Namba zao',
      type: 'csv' as const,
      prompt: 'Majina kamili, uhusiano, nambari za simu, na barua pepe za washirika wa Max.',
    },
  ];

  const applyTemplate = (t: typeof templates[0]) => {
    setTitle(t.title);
    setFileType(t.type);
    setContentPrompt(t.prompt);
    setGeneratedFile(null);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isGenerating) return;

    setIsGenerating(true);
    setGeneratedFile(null);
    try {
      const file = await onGenerateFile({
        title: title.trim(),
        fileType,
        contentPrompt: contentPrompt.trim() || title.trim(),
      });
      setGeneratedFile(file);
    } catch (e) {
      console.error('File generation error', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (generatedFile) {
      downloadFileHelper(generatedFile);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in text-[#F5F2ED]">
      <div className="w-full max-w-xl rounded-2xl bg-[#0d0d0d] border border-[#222222] p-6 sm:p-7 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="serif font-bold text-base text-[#F5F2ED]">Tengeneza Faili Halisi (Real File Engine)</h3>
              <p className="text-xs text-[#888888]">PDF, Excel, Word, CSV yenye muundo halisi wa binary</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#888888] hover:text-[#F5F2ED] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Templates */}
        <div>
          <div className="text-xs font-bold text-[#888888] uppercase tracking-wider mb-2">Sampuli za Haraka:</div>
          <div className="grid grid-cols-2 gap-2">
            {templates.map((t, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyTemplate(t)}
                className="p-3 rounded-xl glass hover:bg-white/5 border border-[#222222] text-left text-xs text-[#888888] hover:text-[#F5F2ED] transition cursor-pointer"
              >
                <div className="font-semibold text-[#D4AF37]">{t.label}</div>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#F5F2ED] mb-1">Jina la Faili (Title) *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Mfano: Ripoti ya Miradi ya Max"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#F5F2ED] mb-1">Aina ya Faili *</label>
              <select
                value={fileType}
                onChange={(e) => setFileType(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] text-xs focus:outline-none focus:border-[#D4AF37] font-bold"
              >
                <option value="pdf">📄 PDF (.pdf)</option>
                <option value="xlsx">📊 Excel (.xlsx)</option>
                <option value="docx">📝 Word (.docx)</option>
                <option value="csv">📑 CSV (.csv)</option>
                <option value="txt">📄 Text (.txt)</option>
                <option value="json">⚙️ JSON (.json)</option>
                <option value="md">📑 Markdown (.md)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#F5F2ED] mb-1">
              Maudhui au Maagizo ya Faili (Content Prompt)
            </label>
            <textarea
              rows={3}
              value={contentPrompt}
              onChange={(e) => setContentPrompt(e.target.value)}
              placeholder="Eleza nini kiwepo ndani ya faili hili kwa Max..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <button
            id="modal-generate-file-submit"
            type="submit"
            disabled={isGenerating || !title.trim()}
            className="w-full py-3 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg transition cursor-pointer disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>INATUNGA NA KUUNDA BINARY FILE...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>TENGENEZA FAILI HAPO HAPO</span>
              </>
            )}
          </button>
        </form>

        {/* Success Download Card */}
        {generatedFile && (
          <div className="p-4 rounded-2xl glass border border-[#D4AF37]/40 flex items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="p-2.5 rounded-xl bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="truncate">
                <div className="font-bold text-[#F5F2ED] text-xs truncate">{generatedFile.filename}</div>
                <div className="text-[10px] text-[#888888]">
                  {(generatedFile.size / 1024).toFixed(1)} KB • Halisi & Tayari Kupakuliwa
                </div>
              </div>
            </div>

            <button
              id={`modal-download-${generatedFile.id}`}
              onClick={handleDownload}
              className="px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-md flex-shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>PAKUA SASA</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
export default FileGeneratorModal;
