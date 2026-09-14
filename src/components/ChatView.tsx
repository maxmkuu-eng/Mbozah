import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import {
  Send,
  Mic,
  Brain,
  Users,
  Download,
  FileText,
  FileSpreadsheet,
  FileCode,
  Volume2,
  VolumeX,
  Sparkles,
  RefreshCw,
  Plus,
  File,
  Paperclip,
  Image,
  Camera,
  X,
  Eye,
  AlertCircle,
  History,
  Trash2,
  WifiOff,
  HardDrive,
  Copy,
  Check,
  Globe,
  ChevronDown,
  ExternalLink,
  Facebook,
  Instagram,
  Youtube,
  Menu,
  MoreVertical,
  Square,
  PenSquare,
  Share2,
  ArrowLeft,
} from 'lucide-react';
import { ChatMessage, GeneratedFileSummary, Memory, Person, AttachmentItem, UserProfile } from '../types';
import { downloadFileHelper } from '../services/clientFileGenerator';
import { getApiUrl } from '../services/apiConfig';

interface ParsedSourceItem {
  title: string;
  url: string;
  domain: string;
  platform: 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'web';
  extra?: string;
}

function parseAxaSources(content: string): { body: string; sources: ParsedSourceItem[] } {
  if (!content) return { body: '', sources: [] };

  const markerMatch = content.match(/\n\s*(\*\*Vyanzo Vilivyothibitishwa[^\n]*\*\*|\*\*Vyanzo vya Habari[^\n]*\*\*|\*\*Vyanzo:[^\n]*\*\*|Vyanzo Vilivyothibitishwa:)/i);

  if (!markerMatch || markerMatch.index === undefined) {
    return { body: content, sources: [] };
  }

  const markerIndex = markerMatch.index;
  const body = content.slice(0, markerIndex).trim();
  const sourcesText = content.slice(markerIndex + markerMatch[0].length).trim();

  const sources: ParsedSourceItem[] = [];
  const lines = sourcesText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match markdown link: [title](url) or - [title](<url>)
    const linkMatch = trimmed.match(/\[([^\]]+)\]\((https?:\/\/[^\s)>]+)\)/i);
    if (linkMatch) {
      let title = linkMatch[1].replace(/^[🔴🎵📸🔵🌐\s]+/, '').trim();
      const url = linkMatch[2].replace(/[<>]/g, '').trim();

      let domain = 'axa.ai';
      try {
        domain = new URL(url).hostname.replace(/^www\./, '');
      } catch {}

      let platform: 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'web' = 'web';
      const lowerLine = trimmed.toLowerCase();
      const lowerDomain = domain.toLowerCase();
      const lowerUrl = url.toLowerCase();

      if (lowerDomain.includes('youtube.com') || lowerDomain.includes('youtu.be') || lowerUrl.includes('youtube.com/') || lowerUrl.includes('youtu.be/') || lowerLine.includes('youtube')) {
        platform = 'youtube';
      } else if (lowerDomain.includes('tiktok.com') || lowerUrl.includes('tiktok.com/') || lowerLine.includes('tiktok')) {
        platform = 'tiktok';
      } else if (lowerDomain.includes('instagram.com') || lowerUrl.includes('instagram.com/') || lowerLine.includes('instagram')) {
        platform = 'instagram';
      } else if (lowerDomain.includes('facebook.com') || lowerDomain.includes('fb.com') || lowerUrl.includes('facebook.com/') || lowerLine.includes('facebook')) {
        platform = 'facebook';
      }

      // Check for extra text after the link (like dates or badges)
      const afterLink = trimmed.slice((linkMatch.index || 0) + linkMatch[0].length)
        .replace(/^[\s—\-\*]+/, '')
        .replace(/[\*]+$/, '')
        .trim();

      sources.push({
        title: title || domain,
        url,
        domain,
        platform,
        extra: afterLink,
      });
    }
  }

  return { body, sources };
}

interface ChatViewProps {
  messages: ChatMessage[];
  conversationTitle?: string;
  onSendMessage: (text: string, isVoice?: boolean, attachments?: AttachmentItem[]) => Promise<any>;
  onRetryMessage?: (message: ChatMessage) => Promise<any>;
  isLoading: boolean;
  onOpenVoice: () => void;
  onNewChat: () => void;
  onOpenHistory?: () => void;
  onDeleteMessage?: (messageId: string) => void;
  onOpenMemoryModal: () => void;
  onOpenFileGenerator: () => void;
  onPreviewDocument: (file: GeneratedFileSummary) => void;
  memories: Memory[];
  people: Person[];
  isOnline?: boolean;
  onToggleMenu?: () => void;
  onStopGeneration?: () => void;
  user?: UserProfile | null;
  onBack?: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  conversationTitle = 'Mkuu Chat',
  onSendMessage,
  onRetryMessage,
  isLoading,
  onOpenVoice,
  onNewChat,
  onOpenHistory,
  onDeleteMessage,
  onOpenMemoryModal,
  onOpenFileGenerator,
  onPreviewDocument,
  memories,
  people,
  isOnline = true,
  onToggleMenu,
  onStopGeneration,
  user,
  onBack,
}) => {
  const [inputText, setInputText] = useState('');
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [selectedAttachments, setSelectedAttachments] = useState<AttachmentItem[]>([]);
  const [isPhotoMenuOpen, setIsPhotoMenuOpen] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'Mkuu' | 'AXA Live Web Search' | 'Magic Hour Studio'>('Mkuu');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && selectedAttachments.length === 0) || isLoading) return;

    const textToSend = inputText;
    const attachmentsToSend = [...selectedAttachments];

    setInputText('');
    setSelectedAttachments([]);
    setErrorMessage(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      await onSendMessage(textToSend, false, attachmentsToSend);
    } catch (err: any) {
      setErrorMessage(err.message || 'Ujumbe haukuweza kutumwa.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // File Selection Handlers
  const handleFileSelect = (files: FileList | null, isDoc = false) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const maxSizeBytes = 20 * 1024 * 1024; // 20MB limit

    if (file.size > maxSizeBytes) {
      setErrorMessage(`Faili limezidi uwezo (Max 20MB). Faili hili lina ${(file.size / (1024 * 1024)).toFixed(1)}MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';

      const newAttachment: AttachmentItem = {
        id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        filename: file.name,
        fileType: ext,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        base64Data,
        previewUrl: file.type.startsWith('image/') ? base64Data : undefined,
      };

      setSelectedAttachments((prev) => [...prev, newAttachment]);
      setErrorMessage(null);
      setIsPhotoMenuOpen(false);
    };

    reader.onerror = () => {
      setErrorMessage('Picha au faili haikuweza kusomwa kwenye kifaa chako.');
    };

    reader.readAsDataURL(file);
  };

  const removeAttachment = (index: number) => {
    setSelectedAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // TTS Readout for specific message with native Android bridge and safe browser speech
  const playSpeech = (msgId: string, text: string) => {
    if (playingMessageId === msgId) {
      if (typeof window !== 'undefined' && (window as any).MkuuDevice?.stopSpeaking) {
        (window as any).MkuuDevice.stopSpeaking();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setPlayingMessageId(null);
      return;
    }

    const cleanText = text
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/<[^>]*>/g, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .trim();

    if (!cleanText) return;

    // Check Android native bridge first (APK)
    if (
      typeof window !== 'undefined' &&
      (window as any).MkuuDevice &&
      typeof (window as any).MkuuDevice.speak === 'function'
    ) {
      setPlayingMessageId(msgId);
      const isSpeaking = (window as any).MkuuDevice.speak(cleanText, 'sw');
      if (isSpeaking) {
        const interval = setInterval(() => {
          if (!(window as any).MkuuDevice?.isSpeaking?.()) {
            clearInterval(interval);
            setPlayingMessageId((prev) => (prev === msgId ? null : prev));
          }
        }, 250);
        return;
      }
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      setPlayingMessageId(msgId);
      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voices = window.speechSynthesis.getVoices() || [];
      const swVoice = voices.find((v) => v.lang.toLowerCase().startsWith('sw'));
      if (swVoice) {
        utterance.voice = swVoice;
        utterance.lang = swVoice.lang;
      } else {
        const defVoice = voices.find((v) => v.default) || voices[0];
        if (defVoice) {
          utterance.voice = defVoice;
          utterance.lang = defVoice.lang || 'en-US';
        }
      }

      utterance.rate = 1.0;
      (window as any).__mkuuChatUtterance = utterance;

      utterance.onend = () => {
        (window as any).__mkuuChatUtterance = null;
        setPlayingMessageId((prev) => (prev === msgId ? null : prev));
      };
      utterance.onerror = () => {
        (window as any).__mkuuChatUtterance = null;
        setPlayingMessageId((prev) => (prev === msgId ? null : prev));
      };

      window.speechSynthesis.speak(utterance);
      window.speechSynthesis.resume();
    } catch (err) {
      console.warn('Speech error:', err);
      setPlayingMessageId(null);
    }
  };

  const handleCopyMessage = async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(msgId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  // Gemini Quick suggestions
  const quickActions = [
    {
      title: 'Uchambuzi wa Mechi & Habari',
      subtitle: 'Matokeo na taarifa za sasa kupitia Google Search',
      prompt: 'Niambie matokeo na habari mpya za hivi punde za Ligi Kuu Tanzania Bara na EPL leo.',
      icon: Globe,
    },
    {
      title: 'Tengeneza Faili la PDF au Excel',
      subtitle: 'Pakua nyaraka iliyokamilika kwenye simu',
      prompt: 'Niandalie faili la PDF lenye ripoti kamili ya miradi ya kiufundi ya wiki hii kwa ajili ya Max.',
      icon: FileText,
    },
    {
      title: 'Andika Barua Pepe Rasmi',
      subtitle: 'Ujumbe wenye heshima, staha na ueledi',
      prompt: 'Niandikie barua pepe rasmi ya kuomba likizo fupi ya siku 3 kwenda kwa Mkurugenzi Juma.',
      icon: Sparkles,
    },
    {
      title: 'Max Memory & Watu wa Karibu',
      subtitle: 'Kumbuka watu muhimu na mahusiano yao',
      prompt: 'Ni nani watu wangu wa karibu waliosajiliwa kwenye mfumo na maelezo yao muhimu?',
      icon: Brain,
    },
  ];

  // File type icon resolver
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
        return <FileCode className="w-5 h-5 text-[#9B72CF]" />;
      default:
        return <File className="w-5 h-5 text-[#c4c7c5]" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full min-w-0 bg-gradient-to-b from-[#ffffff] via-[#ffffff] to-[#d5e7fc] relative overflow-hidden text-[#1f1f1f]">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        id="hidden-gallery-input"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        id="hidden-camera-input"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />
      <input
        type="file"
        ref={documentInputRef}
        accept=".pdf,.docx,.xlsx,.csv,.txt,.json,.md,.png,.jpg,.jpeg"
        id="hidden-document-input"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files, true)}
      />

      {/* Header Bar - Authentic Google Gemini Style */}
      <header className="h-14 sm:h-16 flex-shrink-0 px-3 sm:px-5 flex items-center justify-between bg-transparent z-10 text-[#1f1f1f]">
        <div className="flex items-center space-x-1 sm:space-x-2">
          {/* Hamburger Menu button - Iconic two horizontal bars (=) */}
          <button
            type="button"
            id="chat-toggle-menu-btn"
            onClick={onToggleMenu}
            className="p-2 -ml-1 rounded-full hover:bg-black/5 text-[#1f1f1f] transition cursor-pointer"
            title="Open Menu"
          >
            <svg className="w-5 h-5 text-[#1f1f1f]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="4" y1="9" x2="20" y2="9" />
              <line x1="4" y1="15" x2="20" y2="15" />
            </svg>
          </button>

          {/* Optional Back Button */}
          {onBack && (
            <button
              type="button"
              id="chat-back-btn"
              onClick={onBack}
              className="p-2 rounded-full hover:bg-black/5 text-[#1f1f1f] transition cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5 text-[#1f1f1f]" />
            </button>
          )}

          {/* Model Selector Dropdown: Mkuu */}
          <div className="relative">
            <button
              type="button"
              id="chat-model-selector-btn"
              onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
              className="flex items-center space-x-1 px-2 py-1 rounded-xl hover:bg-black/5 text-base font-normal text-[#1f1f1f] tracking-tight transition cursor-pointer"
            >
              <span className="font-medium text-[#1f1f1f]">{selectedModel}</span>
              <ChevronDown className="w-4 h-4 text-[#444746]" />
            </button>

            {isModelMenuOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-64 bg-white border border-[#e3e3e3] rounded-2xl shadow-2xl py-2 z-50 text-[#1f1f1f]">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedModel('Mkuu');
                    setIsModelMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs text-[#1f1f1f] hover:bg-[#f0f4f9] flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <div className="font-semibold text-[#1f1f1f]">Mkuu</div>
                    <div className="text-[11px] text-[#747775]">Akili bandia ya haraka na majibu sahihi</div>
                  </div>
                  {selectedModel === 'Mkuu' && <Check className="w-4 h-4 text-[#1a73e8]" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedModel('AXA Live Web Search');
                    setIsModelMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs text-[#1f1f1f] hover:bg-[#f0f4f9] flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <div className="font-semibold text-emerald-700">AXA Live Web Search</div>
                    <div className="text-[11px] text-[#747775]">Real-time live search & fresh news</div>
                  </div>
                  {selectedModel === 'AXA Live Web Search' && <Check className="w-4 h-4 text-emerald-600" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedModel('Magic Hour Studio');
                    setIsModelMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs text-[#1f1f1f] hover:bg-[#f0f4f9] flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <div className="font-semibold text-purple-700">Magic Hour Studio</div>
                    <div className="text-[11px] text-[#747775]">Image generation &amp; editing (AI Studio)</div>
                  </div>
                  {selectedModel === 'Magic Hour Studio' && <Check className="w-4 h-4 text-purple-600" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Header Actions: Edit/New Chat pen + User Avatar */}
        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
          {/* New Chat Pen Icon (Sparkle/Edit) */}
          <button
            type="button"
            id="chat-new-conversation-btn"
            onClick={onNewChat}
            className="p-2 rounded-full hover:bg-black/5 text-[#1f1f1f] transition cursor-pointer"
            title="New chat"
          >
            <svg className="w-5 h-5 text-[#1f1f1f]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>

          {/* User profile avatar circle */}
          <div
            className="w-8 h-8 rounded-full overflow-hidden border border-black/10 shadow-xs flex items-center justify-center bg-[#28292c] text-white text-xs font-semibold select-none cursor-pointer"
            title={user?.name || 'User Profile'}
            onClick={onOpenHistory}
          >
            {user?.name ? (
              user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
            ) : (
              <span>M</span>
            )}
          </div>

          {messages.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)}
                className="p-2 rounded-full hover:bg-black/5 text-[#1f1f1f] transition cursor-pointer"
                title="Options"
              >
                <MoreVertical className="w-5 h-5 text-[#1f1f1f]" />
              </button>

              {isOptionsMenuOpen && (
                <div className="absolute top-full right-0 mt-1.5 w-52 bg-white border border-[#e3e3e3] rounded-2xl shadow-2xl py-1.5 z-40 text-[#1f1f1f]">
                  <button
                    type="button"
                    onClick={() => {
                      onNewChat();
                      setIsOptionsMenuOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-[#1f1f1f] hover:bg-[#f0f4f9] flex items-center space-x-2 cursor-pointer"
                  >
                    <PenSquare className="w-4 h-4 text-[#747775]" />
                    <span>Mazungumzo Mapya</span>
                  </button>
                  {onOpenHistory && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenHistory();
                        setIsOptionsMenuOpen(false);
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs text-[#1f1f1f] hover:bg-[#f0f4f9] flex items-center space-x-2 cursor-pointer"
                    >
                      <History className="w-4 h-4 text-[#747775]" />
                      <span>Kumbukumbu za Chat</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Offline Notice Banner */}
      {!isOnline && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center space-x-2">
            <WifiOff className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span>
              <strong>Modi ya Nje ya Mtandao:</strong> Mazungumzo yote yamehifadhiwa salama kwenye kumbukumbu ya ndani ya kifaa chako.
            </span>
          </div>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold uppercase tracking-wider flex-shrink-0">
            Local SQLite
          </span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-6 min-h-0 w-full bg-transparent flex flex-col">
        <div className={`w-full max-w-3xl mx-auto space-y-6 ${messages.length === 0 ? 'flex-1 flex flex-col justify-center' : ''}`}>
          {messages.length === 0 ? (
            /* Gemini Empty State: "Ready when you are" (Exact match to Screenshot) */
            <div className="flex-1 flex flex-col items-center justify-center max-w-xl mx-auto py-12 px-4 text-center select-none">
              {/* Colorful 4-point Gemini Sparkle Logo */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center mx-auto mb-5 animate-in fade-in zoom-in duration-300">
                <svg viewBox="0 0 24 24" className="w-16 h-16 sm:w-20 sm:h-20" fill="none">
                  <defs>
                    <linearGradient id="geminiSparkleMain" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4E88FF" />
                      <stop offset="35%" stopColor="#9B72CF" />
                      <stop offset="70%" stopColor="#E2725B" />
                      <stop offset="100%" stopColor="#F4B400" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 6.627 12 0 12C6.627 12 12 6.627 12 0Z"
                    fill="url(#geminiSparkleMain)"
                  />
                </svg>
              </div>
              <h1 className="text-[32px] sm:text-[38px] font-normal text-[#1f1f1f] tracking-tight font-sans">
                Ready when you are
              </h1>
            </div>
          ) : (
            /* Conversation Messages */
            messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const isAxa = msg.aiProvider === 'AXA Live Web Search' || msg.chatModel === 'AXA Live Web Search' || Boolean(msg.content && (msg.content.includes('AXA LIVE') || msg.content.includes('Vyanzo vya AXA') || msg.content.includes('AXA Live Web Search')));
              return (
                <div
                  key={msg.id}
                  id={`chat-msg-${msg.id}`}
                  className={`group relative flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-2 w-full`}
                >
                  {/* User Message */}
                  {isUser ? (
                    <div className="flex flex-col items-end space-y-1.5 max-w-[90%] sm:max-w-[75%]">
                      {/* Attached Items */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 justify-end mb-1">
                          {msg.attachments.map((att, i) => (
                            <div
                              key={i}
                              className="p-2 rounded-2xl bg-white border border-[#e3e3e3] flex items-center space-x-2 shadow-xs"
                            >
                              {att.previewUrl ? (
                                <img
                                  src={att.previewUrl}
                                  alt={att.filename}
                                  className="w-12 h-12 object-cover rounded-xl border border-[#e3e3e3]"
                                />
                              ) : (
                                <div className="p-2 rounded-xl bg-[#f0f4f9] text-[#1a73e8]">
                                  {getFileIcon(att.fileType)}
                                </div>
                              )}
                              <div className="text-left text-xs pr-2">
                                <div className="font-semibold text-[#1f1f1f] truncate max-w-[140px]">
                                  {att.filename}
                                </div>
                                <div className="text-[10px] text-[#747775]">
                                  {att.fileType.toUpperCase()} • {(att.size / 1024).toFixed(1)} KB
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Mint Green User Bubble (Screenshot 3) */}
                      {msg.content && (
                        <div className="px-5 py-3.5 rounded-[24px] bg-[#e2f3e8] text-sm sm:text-base text-[#1f1f1f] leading-relaxed break-words whitespace-pre-wrap shadow-xs">
                          {msg.content}
                        </div>
                      )}

                      <div className="flex items-center space-x-2 px-2 text-[11px] text-[#747775]">
                        {msg.savedOffline && (
                          <span className="text-emerald-600 flex items-center gap-1">
                            <HardDrive className="w-2.5 h-2.5" />
                            <span>Saved Local</span>
                          </span>
                        )}
                        <span>
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {onDeleteMessage && (
                          <button
                            onClick={() => onDeleteMessage(msg.id)}
                            className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition p-0.5 cursor-pointer"
                            title="Futa Ujumbe"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : msg.isError ? (
                    /* Error Message */
                    <div className="flex flex-col items-start space-y-1.5 max-w-[95%] sm:max-w-[85%] w-full">
                      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-red-200 text-sm leading-relaxed text-[#1f1f1f] shadow-xs w-full space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-red-600 font-semibold text-xs uppercase tracking-wide">
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            <span>Hitilafu Imepatikana</span>
                          </div>
                          {msg.errorCode && (
                            <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-mono text-[10px] border border-red-200 font-semibold">
                              {msg.errorCode}
                            </span>
                          )}
                        </div>

                        <div className="text-xs sm:text-sm text-[#1f1f1f] leading-relaxed whitespace-pre-line">
                          {msg.content}
                        </div>

                        {msg.technicalDetails && (
                          <div className="p-2.5 rounded-xl bg-[#f8fafd] border border-[#e3e3e3] font-mono text-[11px] text-[#444746] break-all">
                            <span className="text-[#747775] block uppercase font-bold text-[9px] mb-0.5">
                              Uchunguzi wa Kiufundi:
                            </span>
                            {msg.technicalDetails}
                          </div>
                        )}

                        {onRetryMessage && msg.retryPayload && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => onRetryMessage(msg)}
                              className="px-4 py-2 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>JARIBU TENA</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 px-2 text-[10px] text-[#747775]">
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {onDeleteMessage && (
                          <button
                            onClick={() => onDeleteMessage(msg.id)}
                            className="hover:text-red-500 transition cursor-pointer ml-1"
                            title="Futa Ujumbe"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Assistant Response (AXA Live Search or Gemini) */
                    <div className="flex flex-col items-start space-y-2 max-w-[95%] sm:max-w-[85%] w-full">
                      {/* Response Provider Header */}
                      <div className="flex items-center space-x-2">
                        {isAxa ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-xs flex-shrink-0">
                            <Globe className="w-3.5 h-3.5 text-white" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                              <defs>
                                <linearGradient id="geminiSparkleMsg" x1="0%" y1="0%" x2="100%" y2="100%">
                                  <stop offset="0%" stopColor="#4E88FF" />
                                  <stop offset="50%" stopColor="#9B72CF" />
                                  <stop offset="100%" stopColor="#D96570" />
                                </linearGradient>
                              </defs>
                              <path
                                d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 6.627 12 0 12C6.627 12 12 6.627 12 0Z"
                                fill="url(#geminiSparkleMsg)"
                              />
                            </svg>
                          </div>
                        )}
                        <span className="text-xs font-semibold text-[#f0f4f9]">
                          {isAxa ? 'AXA Live Search' : 'MKUU AI'}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                          isAxa
                            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/50'
                            : 'bg-[#1e2027] text-[#D4AF37] border-[#D4AF37]/30'
                        }`}>
                          {isAxa ? 'AXA Web Search' : 'MKUU'}
                        </span>
                      </div>

                      {/* Content Box */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#e3e3e3] text-sm sm:text-[15px] leading-relaxed text-[#1f1f1f] shadow-xs w-full">
                        {msg.content ? (() => {
                          const { body: cleanBody, sources: axaSources } = parseAxaSources(msg.content);
                          return (
                            <div className="space-y-4">
                              <div className="prose prose-sm max-w-none text-[#1f1f1f] break-words">
                                <Markdown
                                  components={{
                                    a: ({ href, children }) => (
                                      <a
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 font-medium text-[#1a73e8] hover:underline underline-offset-2 transition-colors cursor-pointer"
                                      >
                                        <span>{children}</span>
                                        <ExternalLink className="w-3 h-3 inline-block flex-shrink-0 opacity-80" />
                                      </a>
                                    ),
                                  }}
                                >
                                  {cleanBody || msg.content}
                                </Markdown>
                                {isLoading && index === messages.length - 1 && (
                                  <span className="inline-block w-2 h-4 ml-1 bg-[#1a73e8] animate-pulse align-middle rounded-xs" />
                                )}
                              </div>

                              {/* Dedicated Separated Clickable / Tappable Sources Cards */}
                              {axaSources.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-[#e3e3e3] space-y-2.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1f1f1f]">
                                      <Globe className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Vyanzo Vilivyothibitishwa (AXA) — Gusa Kufungua</span>
                                    </div>
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                                      {axaSources.length} Vyanzo
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {axaSources.map((src, sIdx) => (
                                      <a
                                        key={sIdx}
                                        href={src.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-start gap-3 p-3 min-h-[44px] rounded-xl bg-[#f8fafd] hover:bg-[#eef2f6] active:scale-[0.98] border border-[#e3e3e3] hover:border-[#c2e7ff] transition-all duration-150 group/card no-underline cursor-pointer shadow-2xs"
                                        title={`Fungua: ${src.url}`}
                                      >
                                        <div className="p-2 rounded-lg bg-white border border-[#e3e3e3] flex-shrink-0 mt-0.5 group-hover/card:border-[#1a73e8]/50 transition-colors">
                                          {src.platform === 'youtube' && <Youtube className="w-4 h-4 text-red-600" />}
                                          {src.platform === 'tiktok' && (
                                            <svg className="w-4 h-4 text-black fill-current" viewBox="0 0 24 24">
                                              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.16 1.18 2.09 2.35 2.29.98.17 2.05-.08 2.77-.79.61-.57.92-1.39.95-2.22.03-3.83.01-7.66.02-11.49 0-.27-.04-.54-.07-.81V.02h.07z" />
                                            </svg>
                                          )}
                                          {src.platform === 'instagram' && <Instagram className="w-4 h-4 text-pink-600" />}
                                          {src.platform === 'facebook' && <Facebook className="w-4 h-4 text-blue-600" />}
                                          {src.platform === 'web' && <Globe className="w-4 h-4 text-emerald-600" />}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                          <div className="text-xs sm:text-[13px] font-medium text-[#1f1f1f] group-hover/card:text-[#1a73e8] line-clamp-2 leading-snug">
                                            {src.title}
                                          </div>
                                          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[#747775]">
                                            <span className="px-1.5 py-0.5 rounded bg-white text-[#444746] font-mono text-[10px] border border-[#e3e3e3]">
                                              {src.platform.toUpperCase()} • {src.domain}
                                            </span>
                                            {src.extra && <span className="truncate">{src.extra}</span>}
                                          </div>
                                        </div>

                                        <div className="p-1 rounded-md text-[#747775] group-hover/card:text-[#1a73e8] transition-all flex-shrink-0 mt-0.5">
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </div>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })() : (
                          /* Initial streaming feedback */
                          <div className="flex items-center space-x-2 py-1 text-xs text-[#747775]">
                            <span className="inline-block w-2 h-2 rounded-full bg-[#1a73e8] animate-ping" />
                            <span>Inachakata majibu...</span>
                          </div>
                        )}

                        {/* Extracted Memory Tag */}
                        {msg.memoryExtracted && msg.memoryExtracted.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-[#e3e3e3] flex flex-wrap gap-1.5">
                            {msg.memoryExtracted.map((mem, idx) => (
                              <div
                                key={idx}
                                className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#f0f4f9] border border-[#e3e3e3] text-[#1a73e8] text-[11px] font-medium"
                              >
                                <Brain className="w-3 h-3 text-[#1a73e8]" />
                                <span>Max Memory: Imehifadhiwa</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Person Recognized Tag */}
                        {msg.personRecognized && msg.personRecognized.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {msg.personRecognized.map((person, idx) => (
                              <div
                                key={idx}
                                className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-medium"
                              >
                                <Users className="w-3 h-3 text-emerald-600" />
                                <span>Max Identify: {person}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Generated Real Binary Files / Images Cards */}
                        {msg.generatedFiles && msg.generatedFiles.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-[#e3e3e3] space-y-3">
                            <div className="text-[11px] font-semibold text-[#444746] flex items-center gap-1.5 uppercase tracking-wider">
                              <Sparkles className="w-3.5 h-3.5 text-[#1a73e8]" />
                              <span>Faili / Picha Iliyotengenezwa:</span>
                            </div>
                            {msg.generatedFiles.map((file) => {
                              const isImage =
                                ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(
                                  file.fileType?.toLowerCase() || ''
                                ) ||
                                !!file.previewUrl ||
                                !!file.base64Data ||
                                file.mimeType?.startsWith('image/') ||
                                file.downloadUrl?.startsWith('data:image/');

                              const imageUrl = file.previewUrl
                                ? file.previewUrl
                                : file.base64Data
                                ? (file.base64Data.startsWith('data:') ? file.base64Data : `data:${file.mimeType || 'image/png'};base64,${file.base64Data}`)
                                : file.downloadUrl?.startsWith('data:')
                                ? file.downloadUrl
                                : file.downloadUrl
                                ? getApiUrl(file.downloadUrl)
                                : '';

                              return (
                                <div
                                  key={file.id}
                                  className="rounded-2xl bg-[#f8fafd] border border-[#e3e3e3] overflow-hidden shadow-xs"
                                >
                                  {/* Image preview */}
                                  {isImage && imageUrl && (
                                    <div className="relative bg-[#f0f4f9] border-b border-[#e3e3e3] p-2 flex justify-center items-center group">
                                      <img
                                        src={imageUrl}
                                        alt={file.filename}
                                        className="max-h-72 w-auto max-w-full object-contain rounded-xl shadow cursor-pointer transition-transform duration-200 group-hover:scale-[1.01]"
                                        onClick={() => onPreviewDocument(file)}
                                        loading="lazy"
                                      />
                                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => onPreviewDocument(file)}
                                          className="p-1.5 rounded-lg bg-black/70 hover:bg-black text-white text-xs font-medium flex items-center space-x-1 backdrop-blur-md border border-white/20 cursor-pointer shadow"
                                          title="Tazama Kikubwa"
                                        >
                                          <Eye className="w-3.5 h-3.5 text-white" />
                                          <span>Kikubwa</span>
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  <div className="p-3.5 flex items-center justify-between gap-3">
                                    <div className="flex items-center space-x-3 overflow-hidden">
                                      <div className="p-2 rounded-xl bg-white border border-[#e3e3e3] flex-shrink-0 text-[#1a73e8]">
                                        {getFileIcon(file.fileType)}
                                      </div>
                                      <div className="truncate">
                                        <div className="font-semibold text-[#1f1f1f] text-xs truncate">
                                          {file.filename}
                                        </div>
                                        <div className="text-[10px] text-[#747775]">
                                          {file.fileType.toUpperCase()} • {(file.size / 1024).toFixed(1)} KB
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center space-x-2 flex-shrink-0">
                                      <button
                                        id={`preview-file-btn-${file.id}`}
                                        onClick={() => onPreviewDocument(file)}
                                        className="px-3 py-1.5 rounded-full bg-white hover:bg-[#f0f4f9] text-xs font-medium text-[#1f1f1f] flex items-center space-x-1 border border-[#e3e3e3] transition cursor-pointer"
                                        title="Soma / Tazama Faili"
                                      >
                                        <Eye className="w-3.5 h-3.5 text-[#1a73e8]" />
                                        <span>Tazama</span>
                                      </button>

                                      <button
                                        id={`download-file-${file.id}`}
                                        onClick={() => downloadFileHelper(file)}
                                        className="px-3.5 py-1.5 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-semibold text-xs flex items-center space-x-1.5 shadow-xs transition cursor-pointer"
                                        title="Pakua Kwenye Kifaa"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Pakua</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Gemini Response Action Bar (Copy, Speak, Delete) */}
                      <div className="flex items-center space-x-3 px-2 text-xs text-[#747775]">
                        <button
                          onClick={() => handleCopyMessage(msg.id, msg.content)}
                          className="hover:text-[#1f1f1f] flex items-center space-x-1 transition cursor-pointer p-1 rounded-md hover:bg-[#f0f4f9]"
                          title="Nakili jibu"
                        >
                          {copiedMessageId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-600 font-medium">Imenakiliwa</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Nakili</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => playSpeech(msg.id, msg.content)}
                          className="hover:text-[#1f1f1f] flex items-center space-x-1 transition cursor-pointer p-1 rounded-md hover:bg-[#f0f4f9]"
                          title="Sikiliza kwa Sauti"
                        >
                          {playingMessageId === msg.id ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5 text-red-600 animate-pulse" />
                              <span className="text-red-600 font-semibold">Zima</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Sikiliza</span>
                            </>
                          )}
                        </button>

                        {onDeleteMessage && (
                          <button
                            onClick={() => onDeleteMessage(msg.id)}
                            className="hover:text-red-600 transition cursor-pointer p-1 rounded-md hover:bg-[#f0f4f9]"
                            title="Futa Ujumbe"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Selected Attachments Row */}
      {selectedAttachments.length > 0 && (
        <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 pt-2">
          <div className="flex flex-wrap gap-2.5 p-3 rounded-2xl bg-white border border-[#e3e3e3] shadow-xs">
            {selectedAttachments.map((att, index) => (
              <div
                key={index}
                className="relative group p-2 rounded-xl bg-[#f8fafd] border border-[#e3e3e3] flex items-center space-x-3 shadow-xs"
              >
                {att.previewUrl ? (
                  <img
                    src={att.previewUrl}
                    alt={att.filename}
                    className="w-12 h-12 object-cover rounded-lg border border-[#e3e3e3]"
                  />
                ) : (
                  <div className="p-2 rounded-lg bg-white text-[#1a73e8]">
                    {getFileIcon(att.fileType)}
                  </div>
                )}
                <div className="text-xs">
                  <div className="font-semibold text-[#1f1f1f] truncate max-w-[150px]">
                    {att.filename}
                  </div>
                  <div className="text-[10px] text-[#747775]">
                    {att.fileType.toUpperCase()} • {(att.size / 1024).toFixed(1)} KB
                  </div>
                </div>

                <button
                  type="button"
                  id={`remove-att-${index}`}
                  onClick={() => removeAttachment(index)}
                  className="p-1 rounded-full bg-red-100 hover:bg-red-200 text-red-700 transition cursor-pointer"
                  title="Ondoa Kiambatisho"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Toast */}
      {errorMessage && (
        <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 pt-2">
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-red-600 hover:text-red-900 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Gemini Signature Composer (Floating Pill Bar - Exact match to Screenshot) */}
      <div className="w-full flex-shrink-0 px-4 sm:px-6 pt-2 pb-6 sm:pb-8 bg-transparent z-10">
        <form onSubmit={handleSend} className="w-full max-w-2xl mx-auto">
          <div className="w-full rounded-[36px] bg-white border border-[#e3e3e3] shadow-[0_4px_24px_rgba(0,0,0,0.06)] px-4 py-2 sm:py-2.5 flex items-center gap-3 transition-shadow duration-200 focus-within:shadow-[0_4px_28px_rgba(0,0,0,0.12)]">
            {/* Plus Button with Menu */}
            <div className="relative shrink-0">
              <button
                type="button"
                id="chat-image-btn"
                onClick={() => setIsPhotoMenuOpen(!isPhotoMenuOpen)}
                className="p-1.5 -ml-1 rounded-full hover:bg-black/5 text-[#1f1f1f] transition cursor-pointer flex items-center justify-center"
                title="Ambatisha faili au picha"
              >
                <Plus className="w-6 h-6 text-[#1f1f1f] stroke-[2]" />
              </button>

              {/* Photo & Attachment Popup */}
              {isPhotoMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-52 bg-white border border-[#e3e3e3] rounded-2xl p-1.5 shadow-xl z-30 space-y-1">
                  <button
                    type="button"
                    id="take-photo-action-btn"
                    onClick={() => {
                      setIsPhotoMenuOpen(false);
                      cameraInputRef.current?.click();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-[#f0f4f9] text-[#1f1f1f] flex items-center space-x-2 cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-emerald-600" />
                    <span>Piga Picha (Camera)</span>
                  </button>

                  <button
                    type="button"
                    id="gallery-photo-action-btn"
                    onClick={() => {
                      setIsPhotoMenuOpen(false);
                      imageInputRef.current?.click();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-[#f0f4f9] text-[#1f1f1f] flex items-center space-x-2 cursor-pointer"
                  >
                    <Image className="w-4 h-4 text-[#1a73e8]" />
                    <span>Chagua Gallery</span>
                  </button>

                  <button
                    type="button"
                    id="chat-document-picker-btn"
                    onClick={() => {
                      setIsPhotoMenuOpen(false);
                      documentInputRef.current?.click();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-[#f0f4f9] text-[#1f1f1f] flex items-center space-x-2 cursor-pointer"
                  >
                    <Paperclip className="w-4 h-4 text-[#444746]" />
                    <span>Nyaraka (PDF, DOCX)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsPhotoMenuOpen(false);
                      onOpenFileGenerator();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-[#f0f4f9] text-[#1f1f1f] flex items-center space-x-2 cursor-pointer"
                  >
                    <FileCode className="w-4 h-4 text-purple-600" />
                    <span>Tengeneza Faili</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsPhotoMenuOpen(false);
                      onOpenMemoryModal();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-[#f0f4f9] text-[#1f1f1f] flex items-center space-x-2 cursor-pointer"
                  >
                    <Brain className="w-4 h-4 text-amber-600" />
                    <span>Max Memory</span>
                  </button>
                </div>
              )}
            </div>

            {/* Textarea */}
            <textarea
              id="mkuu-chat-input"
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Uliza Mkuu..."
              className="flex-1 bg-transparent border-none outline-none resize-none text-[16px] text-[#1f1f1f] placeholder-[#747775] leading-normal min-h-[26px] max-h-[120px] px-1 py-1 font-sans"
            />

            {/* Right Action Controls: Stop (Screenshot 3) or Mic + Live Wave (Screenshot 1) */}
            {isLoading ? (
              /* Stop Button */
              <button
                type="button"
                id="chat-stop-stream-btn"
                onClick={onStopGeneration}
                className="w-9 h-9 rounded-full bg-[#1f1f1f] hover:bg-black text-white flex items-center justify-center cursor-pointer shadow-xs transition active:scale-95 shrink-0"
                title="Simamisha Ujumbe (Stop)"
              >
                <Square className="w-3.5 h-3.5 fill-white" />
              </button>
            ) : (
              /* Idle Controls */
              <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
                {inputText.trim() || selectedAttachments.length > 0 ? (
                  <button
                    type="submit"
                    id="chat-send-btn"
                    className="w-9 h-9 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white flex items-center justify-center cursor-pointer shadow-xs transition active:scale-95"
                    title="Tuma Ujumbe"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      id="chat-mic-btn"
                      onClick={onOpenVoice}
                      className="p-1.5 rounded-full hover:bg-black/5 text-[#1f1f1f] transition cursor-pointer"
                      title="Ongea kwa Sauti"
                    >
                      <Mic className="w-6 h-6 text-[#1f1f1f]" />
                    </button>

                    {/* Mkuu Live Soundwave Pill Button */}
                    <button
                      type="button"
                      id="chat-live-voice-btn"
                      onClick={onOpenVoice}
                      className="w-10 h-10 rounded-full bg-[#d3e3fd] hover:bg-[#c2e7ff] text-[#041e49] flex items-center justify-center shadow-xs cursor-pointer transition active:scale-95 shrink-0"
                      title="Mkuu Live (Sauti Mubashara)"
                    >
                      <div className="flex items-center gap-[3px] h-4">
                        <span className="w-[2.5px] h-2 bg-[#041e49] rounded-full" />
                        <span className="w-[2.5px] h-4 bg-[#041e49] rounded-full" />
                        <span className="w-[2.5px] h-3 bg-[#041e49] rounded-full" />
                        <span className="w-[2.5px] h-1.5 bg-[#041e49] rounded-full" />
                      </div>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </form>

        {/* Mkuu Swahili Disclaimer */}
        <p className="text-center text-[11px] text-[#747775] mt-2 font-normal">
          Mkuu inaweza kutoa taarifa zisizo sahihi, zikiwemo kuhusu watu, kwa hivyo hakiki majibu yake.
        </p>
      </div>
    </div>
  );
};

export default ChatView;
