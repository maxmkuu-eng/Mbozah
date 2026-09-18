import React, { useState } from 'react';
import {
  PenSquare,
  Search,
  Image as ImageIcon,
  LayoutGrid,
  BookOpen,
  Plus,
  Settings,
  X,
  MessageSquare,
  Brain,
  Users,
  Zap,
  FolderDown,
  ShieldCheck,
  Volume2,
  AlertTriangle,
  ChevronRight,
  Trash2,
  ArrowLeft,
  Rocket,
  Info,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { ActiveTab, UserProfile, Conversation } from '../types';

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  user: UserProfile | null;
  emergencyStop: boolean;
  onEmergencyStopToggle: () => void;
  onOpenVoice: () => void;
  conversationCount?: number;
  memoryCount: number;
  peopleCount: number;
  filesCount: number;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  isOnline?: boolean;
  conversations?: Conversation[];
  activeConversationId?: string;
  onSelectConversation?: (id: string) => void;
  onNewChat?: () => void;
  onDeleteConversation?: (id: string) => void;
  onNewUser?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  user,
  emergencyStop,
  onEmergencyStopToggle,
  onOpenVoice,
  conversationCount = 0,
  memoryCount,
  peopleCount,
  filesCount,
  mobileMenuOpen,
  setMobileMenuOpen,
  isOnline = true,
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onNewUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLibraryOpen, setIsLibraryOpen] = useState(true);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const filteredConversations = conversations.filter((c) =>
    (c.title || 'Mazungumzo').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartNewChat = () => {
    if (onNewChat) onNewChat();
    setActiveTab('chat');
    setMobileMenuOpen(false);
  };

  const handleSelectConv = (id: string) => {
    if (onSelectConversation) onSelectConversation(id);
    setActiveTab('chat');
    setMobileMenuOpen(false);
  };

  const handleBackToChat = () => {
    setActiveTab('chat');
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Sidebar Drawer */}
      <nav
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-72 lg:w-72 xl:w-76 flex-shrink-0 bg-[#0d0e12] border-r border-[#22232a] text-[#f0f4f9] flex flex-col justify-between transition-transform duration-300 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Header & Quick Back Navigation */}
        <div className="p-4 border-b border-[#22232a] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* MKUU AI Logo - Zoomed and prominent */}
              <div className="w-12 h-12 rounded-xl bg-[#080d1a] border border-[#D4AF37]/60 flex items-center justify-center text-[#D4AF37] overflow-hidden shadow-lg shadow-black/40 flex-shrink-0">
                <img
                  src="/mkuu-ai-logo.png"
                  alt="MKUU AI"
                  className="w-full h-full object-contain scale-110 transition-transform hover:scale-125"
                />
              </div>
              <div>
                <span className="font-bold text-base text-[#f0f4f9] tracking-tight block leading-tight">
                  MKUU AI
                </span>
                <span className="text-[11px] text-[#D4AF37] font-semibold tracking-wider uppercase">
                  Max Intelligence
                </span>
              </div>
            </div>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-xl hover:bg-[#1a1b22] text-[#8e95a2] hover:text-[#f0f4f9] transition cursor-pointer"
              title="Funga"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Prominent Back Option if outside chat */}
          {activeTab !== 'chat' && (
            <button
              id="nav-back-to-chat-btn"
              onClick={handleBackToChat}
              className="w-full py-2 px-3 rounded-xl bg-[#1a1b22] hover:bg-[#242630] text-[#D4AF37] font-semibold text-xs flex items-center space-x-2 border border-[#D4AF37]/40 transition cursor-pointer shadow-sm"
            >
              <ArrowLeft className="w-4 h-4 text-[#D4AF37]" />
              <span>Rudi Kwenye Mazungumzo (Chat)</span>
            </button>
          )}

          <button
            id="nav-new-user-btn"
            onClick={() => {
              onNewUser?.();
              setMobileMenuOpen(false);
            }}
            className="w-full py-2.5 px-3.5 rounded-xl bg-[#14151a] hover:bg-[#1d1f27] text-[#f0f4f9] font-semibold text-xs flex items-center justify-center space-x-2 transition cursor-pointer border border-[#D4AF37]/40"
          >
            <Users className="w-4 h-4 text-[#D4AF37]" />
            <span>NEW USER • CONTINUE WITH GOOGLE</span>
          </button>

          {/* New Chat Primary Action */}
          <button
            id="nav-new-chat-btn"
            onClick={handleStartNewChat}
            className="w-full py-2.5 px-3.5 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition cursor-pointer shadow-lg"
          >
            <PenSquare className="w-4 h-4 stroke-[2.5]" />
            <span>MAZUNGUMZO MAPYA</span>
          </button>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4 text-sm">
          {/* Main Category Links */}
          <div className="space-y-1">
            {/* Search Chats with Toggle Input */}
            <div className="relative">
              <div className="flex items-center px-3 py-2 rounded-xl bg-[#14151a] border border-[#282a33] text-[#8e95a2]">
                <Search className="w-4 h-4 text-[#737885] mr-2.5 shrink-0" />
                <input
                  type="text"
                  placeholder="Tafuta mazungumzo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-xs text-[#f0f4f9] placeholder-[#737885]"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="p-0.5 text-xs text-[#8e95a2] hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Chat Tab Link */}
            <button
              onClick={() => {
                setActiveTab('chat');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center px-3 py-2 rounded-xl transition cursor-pointer text-left ${
                activeTab === 'chat'
                  ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] font-semibold'
                  : 'text-[#8e95a2] hover:bg-[#14151a] hover:text-[#f0f4f9]'
              }`}
            >
              <MessageSquare className="w-4 h-4 mr-3 shrink-0" />
              <span>Mazungumzo (Chat)</span>
            </button>

            {/* Images (Magic Hour Studio & Gallery) */}
            <button
              onClick={() => {
                setActiveTab('files');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center px-3 py-2 rounded-xl transition cursor-pointer text-left ${
                activeTab === 'files'
                  ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] font-semibold'
                  : 'text-[#8e95a2] hover:bg-[#14151a] hover:text-[#f0f4f9]'
              }`}
            >
              <ImageIcon className="w-4 h-4 mr-3 shrink-0" />
              <span>Picha & Faili</span>
              {filesCount > 0 && (
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[#1b1c23] text-[#8e95a2]">
                  {filesCount}
                </span>
              )}
            </button>

            {/* Sport — Live Scores & Fixtures */}
            <button
              id='nav-sport-btn'
              onClick={() => { setActiveTab('sport'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center px-3 py-2 rounded-xl transition cursor-pointer text-left ${activeTab === 'sport' ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] font-semibold' : 'text-[#8e95a2] hover:bg-[#14151a] hover:text-[#f0f4f9]'}`}
            >
              <Trophy className='w-4 h-4 mr-3 shrink-0 text-[#D4AF37]' />
              <span>Sport</span>
              <span className='ml-auto text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'>LIVE</span>
            </button>

            {/* Gemini Live Stream (Sauti Mubashara) */}
            <button
              id="nav-gemini-live-btn"
              onClick={() => {
                onOpenVoice();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition cursor-pointer text-left text-[#4E88FF] hover:bg-[#4E88FF]/10 border border-[#4E88FF]/20 group"
              title="Anzisha Gemini Live Stream yenye Uhuishaji na Sauti"
            >
              <div className="flex items-center">
                <Sparkles className="w-4 h-4 mr-3 shrink-0 text-[#4E88FF] group-hover:rotate-12 transition-transform" />
                <span className="font-semibold text-xs sm:text-sm">Gemini Live Stream</span>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#4E88FF]/20 text-[#4E88FF] font-mono font-bold">
                AUDIO FX
              </span>
            </button>

            {/* Library (Max Memory, People, Auto Reply, Security) */}
            <div>
              <button
                onClick={() => setIsLibraryOpen(!isLibraryOpen)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[#8e95a2] hover:bg-[#14151a] hover:text-[#f0f4f9] transition cursor-pointer text-left"
              >
                <div className="flex items-center">
                  <LayoutGrid className="w-4 h-4 mr-3 shrink-0" />
                  <span>Vipengele vya Max</span>
                </div>
                <ChevronRight
                  className={`w-4 h-4 text-[#737885] transition-transform ${
                    isLibraryOpen ? 'rotate-90' : ''
                  }`}
                />
              </button>

              {/* Library Sub-Items */}
              {isLibraryOpen && (
                <div className="pl-6 pr-1 py-1 space-y-1 text-xs">
                  <button
                    onClick={() => {
                      setActiveTab('memory');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition ${
                      activeTab === 'memory'
                        ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] font-semibold'
                        : 'text-[#8e95a2] hover:bg-[#14151a] hover:text-[#f0f4f9]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Brain className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>Max Memory</span>
                    </span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-[#191a21] text-[#D4AF37]">{memoryCount}</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('people');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition ${
                      activeTab === 'people'
                        ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] font-semibold'
                        : 'text-[#8e95a2] hover:bg-[#14151a] hover:text-[#f0f4f9]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Watu wa Karibu</span>
                    </span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-[#191a21] text-emerald-400">{peopleCount}</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('autoreply');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition ${
                      activeTab === 'autoreply'
                        ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] font-semibold'
                        : 'text-[#8e95a2] hover:bg-[#14151a] hover:text-[#f0f4f9]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Max Auto Reply</span>
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        emergencyStop ? 'bg-red-950/60 text-red-400 border border-red-800' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                      }`}
                    >
                      {emergencyStop ? 'OFF' : 'ON'}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('security');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center px-3 py-2 rounded-xl text-left transition ${
                      activeTab === 'security'
                        ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] font-semibold'
                        : 'text-[#8e95a2] hover:bg-[#14151a] hover:text-[#f0f4f9]'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-400 mr-2" />
                    <span>Usalama & Mmiliki</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('security');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                    title="Viungo vya Faable Deploy & Image Studio"
                  >
                    <div className="flex items-center">
                      <Rocket className="w-3.5 h-3.5 text-emerald-400 mr-2" />
                      <span>Faable Deploy</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                      LIVE
                    </span>
                  </button>

                  {/* About */}
                  <button
                    id="nav-about-btn"
                    onClick={() => setIsAboutOpen(true)}
                    className="w-full flex items-center px-3 py-2 rounded-xl text-left transition text-[#8e95a2] hover:bg-[#14151a] hover:text-[#f0f4f9]"
                    title="Kuhusu MKUU AI"
                  >
                    <Info className="w-3.5 h-3.5 text-[#D4AF37] mr-2" />
                    <span>Kuhusu MKUU AI</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Section: Recent Conversations */}
          <div className="pt-2 border-t border-[#22232a]">
            <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#737885] mb-1">
              Mazungumzo ya Hivi Karibuni
            </div>

            {filteredConversations.length === 0 ? (
              <div className="px-3 py-4 text-xs text-[#737885] leading-relaxed">
                <p className="font-medium text-[#8e95a2] mb-1">Hakuna chats zilizohifadhiwa</p>
                <p>Mazungumzo mapya yatahifadhiwa kiotomatiki hapa.</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredConversations.map((conv) => {
                  const isSelected = activeTab === 'chat' && conv.id === activeConversationId;
                  return (
                    <div
                      key={conv.id}
                      className={`group flex items-center justify-between px-3 py-2 rounded-xl transition cursor-pointer text-left ${
                        isSelected
                          ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] font-semibold'
                          : 'text-[#8e95a2] hover:bg-[#14151a] hover:text-[#f0f4f9]'
                      }`}
                      onClick={() => handleSelectConv(conv.id)}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                        <MessageSquare className="w-3.5 h-3.5 text-[#737885] shrink-0" />
                        <span className="truncate text-xs sm:text-[13px]">
                          {conv.title || 'Mazungumzo Mapya'}
                        </span>
                      </div>

                      {onDeleteConversation && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteConversation(conv.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:text-red-400 transition"
                          title="Futa Mazungumzo"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Profile & Settings Bar */}
        <div className="p-3 border-t border-[#22232a] bg-[#0a0b0e] flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#D4AF37] flex items-center justify-center font-bold text-black text-xs shadow-xs shrink-0">
              {user?.name ? user.name.slice(0, 1).toUpperCase() : 'M'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#f0f4f9] truncate leading-tight uppercase tracking-wider">
                {user?.name || 'MAYMALI NOMBO JR'}
              </div>
              <div className="text-[11px] text-[#8e95a2] truncate">
                {isOnline ? 'Online • MKUU AI' : 'Offline'}
              </div>
            </div>
          </div>

          {/* Settings Gear Button */}
          <button
            id="nav-settings-gear-btn"
            onClick={() => {
              setActiveTab('security');
              setMobileMenuOpen(false);
            }}
            className="p-2 rounded-xl hover:bg-[#1a1b22] text-[#8e95a2] hover:text-[#f0f4f9] transition cursor-pointer shrink-0"
            title="Mipangilio & Usalama"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* About MKUU AI modal */}
      {isAboutOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsAboutOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[#0d0e12] border border-[#D4AF37]/30 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 flex items-start justify-between border-b border-[#22232a]">
              <div className="flex items-center gap-3.5">
                <div className="w-16 h-16 rounded-2xl bg-[#080d1a] border border-[#D4AF37]/50 p-1 flex items-center justify-center overflow-hidden shadow-lg shadow-black/50 flex-shrink-0">
                  <img src="/mkuu-ai-logo.png" alt="MKUU AI" className="w-full h-full object-contain scale-110" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#f0f4f9] tracking-tight">MKUU AI</h2>
                  <p className="text-xs text-[#D4AF37] font-semibold tracking-wider uppercase">Max Intelligence</p>
                </div>
              </div>
              <button
                onClick={() => setIsAboutOpen(false)}
                className="p-1.5 rounded-lg text-[#8e95a2] hover:text-white hover:bg-[#1a1b22]"
                title="Funga"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm text-[#b9bec8]">
              <p>MKUU AI ni msaidizi binafsi wa AI wa Max mwenye uwezo wa kuzungumza, kutafuta taarifa, kuunda na kuhariri picha, na kusimamia vipengele vya Max.</p>
              <div className="rounded-xl bg-[#14151a] border border-[#282a33] p-3">
                <div className="text-xs text-[#737885] uppercase tracking-wider">Toleo</div>
                <div className="text-sm font-semibold text-[#f0f4f9] mt-1">MKUU AI • Max Intelligence</div>
              </div>
              <p className="text-xs text-[#737885]">Think • Search • Create • Solve</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navigation;
