import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  Search,
  Plus,
  Trash2,
  Calendar,
  Clock,
  HardDrive,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  Download,
  AlertTriangle,
  FileText,
  Paperclip,
  Share2,
  Edit3,
  X,
  Check,
  Radio,
  Menu,
  ArrowLeft,
} from 'lucide-react';
import { Conversation } from '../types';

interface ChatHistoryViewProps {
  conversations: Conversation[];
  activeConversationId: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onExportHistory: () => void;
  isOnline: boolean;
  onBack?: () => void;
  onToggleMenu?: () => void;
}

export const ChatHistoryView: React.FC<ChatHistoryViewProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onExportHistory,
  isOnline,
  onBack,
  onToggleMenu,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'recent' | 'media'>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState('');

  // Format date helper
  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'Hivi Karibuni';
      return d.toLocaleDateString('sw-TZ', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Hivi Karibuni';
    }
  };

  // Filtered & Searched conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      // Search text match
      const query = searchQuery.toLowerCase().trim();
      const matchTitle = (c.title || '').toLowerCase().includes(query);
      const matchMessage = (c.messages || []).some((m) =>
        (m.content || '').toLowerCase().includes(query)
      );
      const matchesSearch = !query || matchTitle || matchMessage;

      if (!matchesSearch) return false;

      // Category filter
      if (filterType === 'media') {
        return (c.messages || []).some(
          (m) =>
            (m.attachments && m.attachments.length > 0) ||
            (m.generatedFiles && m.generatedFiles.length > 0)
        );
      }
      return true;
    });
  }, [conversations, searchQuery, filterType]);

  // Total stats
  const totalMessagesCount = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (c.messages?.length || 0), 0);
  }, [conversations]);

  const handleStartEditing = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitleText(conv.title || 'Mazungumzo Mapya');
  };

  const handleSaveTitle = (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editTitleText.trim()) {
      onRenameConversation(id, editTitleText.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full min-w-0 bg-[#080808] text-[#F5F2ED] overflow-y-auto">
      {/* Top Navigation Bar with Menu & Back to Chat */}
      <div className="border-b border-[#222222] bg-[#0c0d11] px-4 py-3 flex-shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            {onToggleMenu && (
              <button
                id="history-toggle-menu-btn"
                onClick={onToggleMenu}
                className="p-2 rounded-xl bg-[#14151a] hover:bg-[#1f2027] border border-[#282a33] text-[#c4c7c5] hover:text-white transition cursor-pointer"
                title="Fungua Menyu"
              >
                <Menu className="w-5 h-5 text-[#f0f4f9]" />
              </button>
            )}
            {onBack && (
              <button
                id="history-back-btn"
                onClick={onBack}
                className="px-3 py-2 rounded-xl bg-[#14151a] hover:bg-[#1f2027] border border-[#282a33] text-[#D4AF37] hover:text-[#fff] text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
                title="Rudi kwenye Mazungumzo"
              >
                <ArrowLeft className="w-4 h-4 text-[#D4AF37]" />
                <span>Rudi Chat</span>
              </button>
            )}
          </div>

          <button
            id="history-quick-new-chat-btn"
            onClick={onNewConversation}
            className="px-3.5 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>MAZUNGUMZO MAPYA</span>
          </button>
        </div>
      </div>

      {/* Top Header */}
      <div className="border-b border-[#222222] bg-[#050505] p-4 sm:p-6 flex-shrink-0">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h2 className="serif text-xl sm:text-2xl font-bold text-[#D4AF37] tracking-wide">
                Kumbukumbu za Chat (Local History)
              </h2>
            </div>
            <p className="text-xs text-[#888888] mt-1">
              Mazungumzo yote yanahifadhiwa kwenye kumbukumbu ya ndani ya kifaa chako cha Android kwa matumizi ya offline & mtandaoni.
            </p>
          </div>

          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <button
              id="history-new-chat-btn"
              onClick={onNewConversation}
              className="px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs flex items-center space-x-1.5 transition shadow-md shadow-[#D4AF37]/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Anzisha Chat Mpya</span>
            </button>

            <button
              id="history-export-btn"
              onClick={onExportHistory}
              className="px-3 py-2 rounded-xl bg-[#141414] hover:bg-[#222222] text-[#CCCCCC] hover:text-[#F5F2ED] border border-[#2a2a2a] text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
              title="Hamisha Nakala ya Mazungumzo (JSON Backup)"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Backup (JSON)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* Offline & Storage Status Banner */}
        <div className="p-4 rounded-2xl glass border border-[#222222] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-xs font-bold text-[#F5F2ED] tracking-wide">
                  Uhifadhi wa Ndani ya Kifaa (IndexedDB & SQLite)
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold uppercase tracking-wider">
                  Salama & Offline
                </span>
              </div>
              <p className="text-[11px] text-[#888888] mt-0.5">
                Mazungumzo {conversations.length} • Jumla ya Ujumbe {totalMessagesCount} • Hata ukizima mtandao au simu, historia itabaki kamili.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <span
              className={`text-[10px] px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 ${
                isOnline
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              {isOnline ? 'Mtandao: Umeunganishwa' : 'Hali: Offline (Ndani ya Kifaa)'}
            </span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-[#888888] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="history-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tafuta mazungumzo au maneno ya zamani..."
              className="w-full bg-[#111111] border border-[#262626] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#F5F2ED] placeholder-[#666666] focus:border-[#D4AF37] focus:outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888888] hover:text-[#F5F2ED]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-1.5 bg-[#111111] p-1 rounded-xl border border-[#262626] self-stretch sm:self-auto justify-center">
            <button
              id="filter-all-btn"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterType === 'all'
                  ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40'
                  : 'text-[#888888] hover:text-[#CCCCCC]'
              }`}
            >
              Yote ({conversations.length})
            </button>
            <button
              id="filter-media-btn"
              onClick={() => setFilterType('media')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterType === 'media'
                  ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40'
                  : 'text-[#888888] hover:text-[#CCCCCC]'
              }`}
            >
              Yenye Nyaraka/Picha
            </button>
          </div>
        </div>

        {/* Conversations List */}
        {filteredConversations.length === 0 ? (
          <div className="py-16 text-center rounded-2xl glass border border-[#222222] p-8 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#141414] border border-[#262626] text-[#888888] flex items-center justify-center mx-auto">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#D4AF37]">
                {searchQuery ? 'Hakuna mazungumzo yaliyolingana na utafutaji' : 'Bado hakuna kumbukumbu za mazungumzo'}
              </h3>
              <p className="text-xs text-[#888888] mt-1 max-w-md mx-auto">
                {searchQuery
                  ? `Hakuna matokeo kwa neno "${searchQuery}". Jaribu neno jingine au futa utafutaji.`
                  : 'Mazungumzo unayofanya na MKUU AI yatahifadhiwa kiotomatiki hapa ndani ya kifaa chako.'}
              </p>
            </div>
            <button
              onClick={onNewConversation}
              className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold text-xs inline-flex items-center space-x-1.5 hover:bg-[#c59f2e] transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Anzisha Mazungumzo ya Kwanza</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredConversations.map((conv) => {
              const isActive = conv.id === activeConversationId;
              const msgCount = conv.messages?.length || 0;
              const lastMessage = conv.messages && conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;
              const hasAttachments = conv.messages?.some(
                (m) => (m.attachments && m.attachments.length > 0) || (m.generatedFiles && m.generatedFiles.length > 0)
              );

              return (
                <div
                  key={conv.id}
                  id={`history-item-${conv.id}`}
                  onClick={() => onSelectConversation(conv.id)}
                  className={`group relative p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-[#141414] border-[#D4AF37]/60 shadow-xl shadow-[#D4AF37]/5 ring-1 ring-[#D4AF37]/30'
                      : 'bg-[#0f0f0f] border-[#222222] hover:border-[#3a3a3a] hover:bg-[#141414]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left details */}
                    <div className="flex-1 min-w-0">
                      {editingId === conv.id ? (
                        <form
                          onSubmit={(e) => handleSaveTitle(conv.id, e)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center space-x-2 mb-2"
                        >
                          <input
                            type="text"
                            value={editTitleText}
                            onChange={(e) => setEditTitleText(e.target.value)}
                            className="bg-[#1a1a1a] border border-[#D4AF37] rounded-lg px-2.5 py-1 text-xs text-[#F5F2ED] focus:outline-none flex-1"
                            autoFocus
                          />
                          <button
                            type="submit"
                            className="p-1.5 rounded-lg bg-[#D4AF37] text-black hover:bg-[#c59f2e]"
                            title="Hifadhi Jina"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(null);
                            }}
                            className="p-1.5 rounded-lg bg-white/10 text-[#888888] hover:text-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      ) : (
                        <div className="flex items-center space-x-2 mb-1.5">
                          <h3 className="font-bold text-sm sm:text-base text-[#F5F2ED] group-hover:text-[#D4AF37] transition truncate">
                            {conv.title || 'Mazungumzo Mapya'}
                          </h3>
                          {isActive && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 font-bold uppercase tracking-wider flex-shrink-0">
                              Yanaendelea
                            </span>
                          )}
                        </div>
                      )}

                      {/* Snippet */}
                      <p className="text-xs text-[#888888] line-clamp-2 leading-relaxed mb-3">
                        {lastMessage ? lastMessage.content : 'Mazungumzo haya hayana ujumbe bado.'}
                      </p>

                      {/* Meta badges */}
                      <div className="flex items-center space-x-3 text-[11px] text-[#666666] flex-wrap gap-y-1">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-[#888888]" />
                          <span>{formatDate(conv.updatedAt || conv.createdAt)}</span>
                        </span>

                        <span>•</span>

                        <span className="flex items-center space-x-1 text-[#AAAAAA]">
                          <MessageSquare className="w-3 h-3 text-[#D4AF37]" />
                          <span>{msgCount} {msgCount === 1 ? 'ujumbe' : 'jumbe'}</span>
                        </span>

                        {hasAttachments && (
                          <>
                            <span>•</span>
                            <span className="flex items-center space-x-1 text-purple-300">
                              <Paperclip className="w-3 h-3" />
                              <span>Ina faili/picha</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center space-x-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        id={`edit-conv-title-${conv.id}`}
                        onClick={(e) => handleStartEditing(conv, e)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#888888] hover:text-[#F5F2ED] transition border border-[#222222] cursor-pointer"
                        title="Badili Jina la Mazungumzo"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        id={`delete-conv-${conv.id}`}
                        onClick={() => setDeleteConfirmId(conv.id)}
                        className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/25 text-red-400 hover:text-red-300 transition border border-red-500/20 cursor-pointer"
                        title="Futa Mazungumzo Haya"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onSelectConversation(conv.id)}
                        className="p-2 rounded-xl bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#D4AF37] border border-[#D4AF37]/40 transition hidden sm:flex items-center space-x-1 cursor-pointer font-bold text-xs"
                      >
                        <span>Fungua</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#2c2c2c] rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/30 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="serif text-lg font-bold text-[#F5F2ED]">Unataka Kufuta Mazungumzo Haya?</h3>
              <p className="text-xs text-[#888888] mt-1.5 leading-relaxed">
                Mazungumzo haya na jumbe zote zilizomo zitafutwa kabisa kutoka kwenye kumbukumbu ya ndani ya kifaa chako. Kitendo hiki hakiwezi kubatilishwa.
              </p>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                id="cancel-delete-conv-btn"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#CCCCCC] font-semibold text-xs border border-[#262626] transition cursor-pointer"
              >
                Ghairi
              </button>
              <button
                id="confirm-delete-conv-btn"
                onClick={() => {
                  onDeleteConversation(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition shadow-lg shadow-red-600/20 cursor-pointer"
              >
                Futa Kabisa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ChatHistoryView;
