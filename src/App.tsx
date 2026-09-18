import React, { useState, useEffect } from 'react';
import {
  ActiveTab,
  ChatMessage,
  Conversation,
  Memory,
  Person,
  GeneratedFileSummary,
  AutoReplySettings,
  AutoReplyLog,
  UserProfile,
  AttachmentItem,
} from './types';
import { Navigation } from './components/Navigation';
import { ChatView } from './components/ChatView';
import { ChatHistoryView } from './components/ChatHistoryView';
import { VoiceModal } from './components/VoiceModal';
import { MemoryCenter } from './components/MemoryCenter';
import { PeopleCenter } from './components/PeopleCenter';
import { AutoReplyCenter } from './components/AutoReplyCenter';
import { FilesCenter } from './components/FilesCenter';
import { SecurityCenter } from './components/SecurityCenter';
import Sport from './components/Sport';
import { RightSidebar } from './components/RightSidebar';
import { FileGeneratorModal } from './components/FileGeneratorModal';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';
import { localChatStorage } from './services/localChatStorage';
import { apiFetch, getApiUrl, MkuuApiError } from './services/apiConfig';
import { executeMkuuChat } from './services/aiEngine';
import { clientGenerateFile } from './services/clientFileGenerator';
import GoogleAuthModal from './components/GoogleAuthModal';
import { subscribeToFirebaseAuth } from './services/firebaseAuth';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [user, setUser] = useState<UserProfile | null>({
    id: 'user_max_owner',
    name: 'Max',
    title: 'Mkuu',
    email: 'maxmkuu@gmail.com',
    role: 'owner',
    language: 'Kiswahili',
    theme: 'dark',
    securityPinSet: true,
    securityPin: '1234',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string>('conv_main_max');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [memories, setMemories] = useState<Memory[]>([
    {
      id: 'mem_1',
      userId: 'user_max_owner',
      content: 'Max anapendelea lugha ya Kiswahili fasaha kwa mawasiliano yote na MKUU AI.',
      category: 'Preferences',
      importance: 'high',
      tags: ['lugha', 'kiswahili', 'upendeleo'],
      createdAt: '2026-08-13T09:12:26.903Z',
      updatedAt: '2026-08-13T09:12:26.903Z',
      source: 'explicit_command',
    },
    {
      id: 'mem_2',
      userId: 'user_max_owner',
      content: 'Max ni mmiliki na msimamizi mkuu wa mifumo yote ya MKUU AI.',
      category: 'General',
      importance: 'high',
      tags: ['mmiliki', 'max', 'utambulisho'],
      createdAt: '2026-08-12T09:12:26.903Z',
      updatedAt: '2026-08-12T09:12:26.903Z',
      source: 'manual',
    },
    {
      id: 'mem_3',
      userId: 'user_max_owner',
      content: 'Miradi mikuu ya Max kwa mwaka huu inahusu ujenzi wa teknolojia za kijasusi za AI na mifumo ya kiotomatiki.',
      category: 'Work',
      importance: 'medium',
      tags: ['kazi', 'miradi', 'teknolojia'],
      createdAt: '2026-08-14T09:12:26.903Z',
      updatedAt: '2026-08-14T09:12:26.903Z',
      source: 'auto_extracted',
    }
  ]);
  const [people, setPeople] = useState<Person[]>([]);
  const [files, setFiles] = useState<GeneratedFileSummary[]>([]);
  const [autoReplySettings, setAutoReplySettings] = useState<AutoReplySettings>({
    userId: 'user_max_owner',
    enabled: true,
    emergencyStop: false,
    mode: 'automatic',
    language: 'Kiswahili',
    tone: 'Heshima & Ueledi',
    workingHours: { enabled: true, start: '08:00', end: '20:00' },
    myPhoneNumber: '',
    phoneVerified: false,
    selectedSimSlot: 'both',
    simCards: [],
    smsEnabled: true,
    gmailEnabled: true,
    safetyRules: [
      'Kamwe usitoe nenosiri, siri za kibenki, au taarifa binafsi za Max.',
      'Mjibu kila mtu kwa heshima na uadilifu kulingana na daraja lake katika Watu wa Karibu.',
      'Kwa masuala nyeti au ya dharura sana, mjulishe mtumaji kwamba Max atampigia mwenyewe.',
    ],
    whitelistedNumbers: [],
    blacklistedNumbers: [],
  });
  const [autoReplyLogs, setAutoReplyLogs] = useState<AutoReplyLog[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isFileGeneratorModalOpen, setIsFileGeneratorModalOpen] = useState(false);
  const [previewingFile, setPreviewingFile] = useState<GeneratedFileSummary | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isNewUserAuthOpen, setIsNewUserAuthOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToFirebaseAuth((firebaseUser) => {
      if (firebaseUser) {
        setUser((prev) => ({
          ...(prev || {}),
          id: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'MKUU AI User',
          email: firebaseUser.email || '',
          title: 'MKUU AI User',
          role: 'user',
          securityPinSet: false,
          securityPin: '',
        }));
      }
    });
    return unsubscribe;
  }, []);

  // Monitor network online / offline and interface transitions (Wi-Fi ↔ Mobile Data)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('[NETWORK] Connection established / online');
    };
    const handleOffline = () => {
      setIsOnline(false);
      console.log('[NETWORK] Connection lost / offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Support dynamic Network Information API if available on mobile
    const navConn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (navConn && typeof navConn.addEventListener === 'function') {
      const handleConnChange = () => {
        setIsOnline(navigator.onLine);
        console.log(`[NETWORK] Interface changed: type=${navConn.type || 'unknown'}, effectiveType=${navConn.effectiveType || 'unknown'}`);
      };
      navConn.addEventListener('change', handleConnChange);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        navConn.removeEventListener('change', handleConnChange);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Safe JSON fetch helper with remote URL resolution
  const fetchJson = async <T,>(endpoint: string): Promise<T | null> => {
    try {
      return await apiFetch<T>(endpoint);
    } catch (e) {
      console.warn(`Fetch notice for ${endpoint}:`, e);
      return null;
    }
  };

  // 1. Initial Local Database Hydration (Immediate & Offline-Ready)
  useEffect(() => {
    const initLocalData = async () => {
      await localChatStorage.init();
      
      // Load local files
      const localFiles = await localChatStorage.getFiles();
      if (localFiles && localFiles.length > 0) {
        setFiles(localFiles);
      }

      // Load local memories
      const localMems = await localChatStorage.getMemories();
      if (localMems && localMems.length > 0) {
        setMemories(localMems);
      }

      // Load local people
      const localPeople = await localChatStorage.getPeople();
      if (localPeople && localPeople.length > 0) {
        setPeople(localPeople);
      }

      // Load local auto reply settings
      const localSettings = await localChatStorage.getAutoReplySettings();
      if (localSettings) {
        let merged = { ...localSettings };
        if (typeof window !== 'undefined' && (window as any).MkuuDevice && typeof (window as any).MkuuDevice.getAutoReplyState === 'function') {
          try {
            const nativeState = JSON.parse((window as any).MkuuDevice.getAutoReplyState() || '{}');
            if (nativeState.emergencyStop !== undefined) {
              merged.emergencyStop = !!nativeState.emergencyStop;
            }
          } catch (err) {
            console.warn('[MkuuDevice] Failed to parse native auto reply state on init:', err);
          }
        }
        setAutoReplySettings(merged);
      } else if (typeof window !== 'undefined' && (window as any).MkuuDevice && typeof (window as any).MkuuDevice.getAutoReplyState === 'function') {
        try {
          const nativeState = JSON.parse((window as any).MkuuDevice.getAutoReplyState() || '{}');
          if (nativeState.emergencyStop !== undefined) {
            setAutoReplySettings((prev) => ({ ...prev, emergencyStop: !!nativeState.emergencyStop }));
          }
        } catch {}
      }

      // Load local conversations
      const localConvs = await localChatStorage.getAllConversations();
      if (localConvs && localConvs.length > 0) {
        setConversations(localConvs);
        const activeId = localChatStorage.getActiveConversationId();
        const activeConv = localConvs.find((c) => c.id === activeId) || localConvs[0];
        setConversationId(activeConv.id);
        setMessages(activeConv.messages || []);
      } else {
        // Create initial default conversation
        const initialConv: Conversation = {
          id: 'conv_main_max',
          userId: 'user_max_owner',
          title: 'Mazungumzo ya Awali',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [],
        };
        await localChatStorage.saveConversation(initialConv);
        setConversations([initialConv]);
        setConversationId(initialConv.id);
        setMessages([]);
      }
    };

    initLocalData();
  }, []);

  // 2. Initial Remote Data Fetching & Synchronization
  const fetchAllData = async () => {
    try {
      // User Profile
      const userData = await fetchJson<any>('/api/me');
      if (userData) {
        setUser(userData.user || userData);
      }

      // Memories
      const memData = await fetchJson<Memory[]>('/api/memories');
      if (memData && Array.isArray(memData)) {
        setMemories(memData);
      }

      // People
      const peopleData = await fetchJson<Person[]>('/api/people');
      if (peopleData && Array.isArray(peopleData)) {
        setPeople(peopleData);
      }

      // Files
      const filesData = await fetchJson<GeneratedFileSummary[]>('/api/files');
      if (filesData && Array.isArray(filesData)) {
        // Ensure download URLs are resolved
        const resolvedFiles = filesData.map((f) => ({
          ...f,
          downloadUrl: f.downloadUrl?.startsWith('http') ? f.downloadUrl : getApiUrl(f.downloadUrl),
        }));
        setFiles(resolvedFiles);
        for (const rf of resolvedFiles) {
          await localChatStorage.saveFile(rf);
        }
      }

      // Auto Reply Settings
      const settingsData = await fetchJson<AutoReplySettings>('/api/autoreply/settings');
      if (settingsData && settingsData.userId) {
        setAutoReplySettings(settingsData);
      }

      // Auto Reply Logs
      const logsData = await fetchJson<AutoReplyLog[]>('/api/autoreply/logs');
      if (logsData && Array.isArray(logsData)) {
        setAutoReplyLogs(logsData);
      }

      // Fetch conversations from server and merge into local DB
      const remoteConvs = await fetchJson<Conversation[]>('/api/conversations');
      if (remoteConvs && Array.isArray(remoteConvs)) {
        for (const rConv of remoteConvs) {
          await localChatStorage.saveConversation(rConv);
        }
        const updatedLocal = await localChatStorage.getAllConversations();
        setConversations(updatedLocal);
      }
    } catch (e) {
      console.warn('Network sync notice (running with local cache):', e);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Send Message with Offline-First Local Persistence & Autonomous Multi-Tier AI Processing
  const handleSendMessage = async (text: string, isVoice = false, attachments: AttachmentItem[] = []) => {
    if (!text.trim() && attachments.length === 0) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      isVoice,
      attachments,
      savedOffline: true,
    };

    // 1. Immediately persist user message to local IndexedDB & LocalStorage
    const updatedConv = await localChatStorage.addMessage(conversationId, userMsg);
    
    // Create assistant message placeholder immediately for real-time live streaming
    const aiMsgId = `msg_ai_${Date.now()}`;
    const initialAiMsg: ChatMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isVoice,
      savedOffline: false,
    };

    setMessages([...updatedConv.messages, initialAiMsg]);

    // Refresh conversation list in state
    const allConvs = await localChatStorage.getAllConversations();
    setConversations(allConvs);

    setIsLoading(true);

    try {
      // 2. Execute Multi-Tier AI Engine with Live Streaming Callback
      const chatResult = await executeMkuuChat({
        userId: user?.id || 'user_max_owner',
        message: text,
        conversationId,
        conversationHistory: updatedConv.messages,
        isVoice,
        attachments,
        user,
        memories,
        people,
        onChunk: (_delta, fullText) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsgId ? { ...m, content: fullText } : m))
          );
        },
      });

      const processedFiles: GeneratedFileSummary[] = (chatResult.generatedFiles || []).map((f: any) => ({
        ...f,
        downloadUrl: f.downloadUrl?.startsWith('http') ? f.downloadUrl : getApiUrl(f.downloadUrl),
      }));

      const finalContent = chatResult.reply || '';
      const aiMsg: ChatMessage = {
        id: aiMsgId,
        role: 'assistant',
        content: finalContent,
        timestamp: new Date().toISOString(),
        isVoice,
        generatedFiles: processedFiles,
        memoryExtracted: chatResult.memoriesExtracted?.map((m: any) => m.content || m),
        personRecognized: chatResult.peopleRecognized?.map((p: any) => p.name || p),
        savedOffline: true,
        aiProvider: chatResult.aiProvider,
        chatModel: chatResult.chatModel,
      };

      // Persist AI response to local DB
      await localChatStorage.addMessage(conversationId, aiMsg);
      const activeConv = await localChatStorage.getConversation(conversationId);
      if (activeConv) {
        setMessages(activeConv.messages);
      }

      const refreshedConvs = await localChatStorage.getAllConversations();
      setConversations(refreshedConvs);

      // If new memories were extracted, update local state
      if (chatResult.memoriesExtracted && chatResult.memoriesExtracted.length > 0) {
        setMemories((prev) => [...chatResult.memoriesExtracted!, ...prev]);
      }

      // If new people were recognized, update state
      if (chatResult.peopleRecognized && chatResult.peopleRecognized.length > 0) {
        setPeople((prev) => [...chatResult.peopleRecognized!, ...prev]);
      }

      // If files were generated, update files
      if (processedFiles.length > 0) {
        setFiles((prev) => [...processedFiles, ...prev]);
        for (const pf of processedFiles) {
          await localChatStorage.saveFile(pf);
        }
      }

      return {
        reply: finalContent,
        cleanSpeechText: chatResult.cleanSpeechText || finalContent,
      };
    } catch (e: any) {
      console.error('Chat execution error:', e);
      // Remove the empty streaming placeholder on fatal failure
      setMessages((prev) => prev.filter((m) => m.id !== aiMsgId));

      const isMkuuError = e instanceof MkuuApiError;
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      const errorCode = isMkuuError ? e.code : (isOffline ? 'NO_INTERNET' : 'BACKEND_UNREACHABLE');
      const userMessage = isMkuuError ? e.userMessage : (isOffline ? 'HAKUNA INTANETI\nTafadhali washa Wi-Fi au Mobile Data.' : 'SEVA YA MKUU HAIPATIKANI\nTafadhali jaribu tena.');
      const technicalDetails = isMkuuError ? e.technicalDetails : (e?.message || 'Failed to connect to backend');
      
      const errorMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: userMessage,
        timestamp: new Date().toISOString(),
        savedOffline: true,
        isError: true,
        errorCode,
        technicalDetails,
        retryPayload: {
          text,
          isVoice,
          attachments,
        },
      };

      const finalConv = await localChatStorage.addMessage(conversationId, errorMsg);
      setMessages(finalConv.messages);
      const refreshedConvs = await localChatStorage.getAllConversations();
      setConversations(refreshedConvs);

      return {
        reply: errorMsg.content,
        cleanSpeechText: errorMsg.content,
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Retry Failed Message with fresh network execution (NO local mock)
  const handleRetryMessage = async (failedMsg: ChatMessage) => {
    if (!failedMsg.retryPayload) return;
    const { text, isVoice, attachments } = failedMsg.retryPayload;
    
    // Remove the error message from conversation history before retrying
    await localChatStorage.deleteMessage(conversationId, failedMsg.id);
    const activeConv = await localChatStorage.getConversation(conversationId);
    if (activeConv) {
      setMessages(activeConv.messages);
    }

    // Trigger fresh network request
    await handleSendMessage(text, isVoice, attachments);
  };

  // Start New Conversation
  const handleNewChat = async () => {
    const newId = `conv_${Date.now()}`;
    const newConv: Conversation = {
      id: newId,
      userId: 'user_max_owner',
      title: 'Mazungumzo Mapya',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };

    await localChatStorage.saveConversation(newConv);
    localChatStorage.setActiveConversationId(newId);
    setConversationId(newId);
    setMessages([]);
    const all = await localChatStorage.getAllConversations();
    setConversations(all);
    setActiveTab('chat');
  };

  // Switch Active Conversation
  const handleSelectConversation = async (id: string) => {
    localChatStorage.setActiveConversationId(id);
    setConversationId(id);
    const conv = await localChatStorage.getConversation(id);
    if (conv) {
      setMessages(conv.messages || []);
    }
    setActiveTab('chat');
  };

  // Delete Conversation
  const handleDeleteConversation = async (id: string) => {
    await localChatStorage.deleteConversation(id);
    const updated = await localChatStorage.getAllConversations();
    setConversations(updated);

    if (conversationId === id) {
      if (updated.length > 0) {
        setConversationId(updated[0].id);
        setMessages(updated[0].messages || []);
      } else {
        handleNewChat();
      }
    }
  };

  // Delete Single Message
  const handleDeleteMessage = async (msgId: string) => {
    const updatedConv = await localChatStorage.deleteMessage(conversationId, msgId);
    if (updatedConv) {
      setMessages(updatedConv.messages);
      const all = await localChatStorage.getAllConversations();
      setConversations(all);
    }
  };

  // Rename Conversation
  const handleRenameConversation = async (id: string, newTitle: string) => {
    const conv = await localChatStorage.getConversation(id);
    if (conv) {
      conv.title = newTitle;
      conv.updatedAt = new Date().toISOString();
      await localChatStorage.saveConversation(conv);
    }
    const updated = await localChatStorage.getAllConversations();
    setConversations(updated);
  };

  // Export Chat History
  const handleExportHistory = async () => {
    const allConvs = await localChatStorage.getAllConversations();
    const dataStr = JSON.stringify(allConvs, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MKUU_AI_CHAT_HISTORY_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Voice Interaction Handlers
  const handleVoiceAssistant = async (spokenText: string) => {
    const res = await handleSendMessage(spokenText, true);
    return res?.cleanSpeechText || res?.reply || 'Nimekuelewa vizuri sana, Mkuu Max.';
  };

  // Kill Switch & Auto Reply Master Handler
  const handleEmergencyStopToggle = async () => {
    // Current active state: true if Auto Reply is running, false if stopped
    const isCurrentlyActive = !!autoReplySettings.enabled && !autoReplySettings.emergencyStop;
    const turnOn = !isCurrentlyActive;

    const updatedSettings: AutoReplySettings = {
      ...autoReplySettings,
      enabled: turnOn,
      smsEnabled: turnOn,
      emergencyStop: !turnOn,
    };
    setAutoReplySettings(updatedSettings);
    localChatStorage.saveAutoReplySettings(updatedSettings);

    // 1. Direct native APK synchronization via MkuuDevice (Android bridge)
    if (typeof window !== 'undefined' && (window as any).MkuuDevice && typeof (window as any).MkuuDevice.setAutoReplyState === 'function') {
      try {
        (window as any).MkuuDevice.setAutoReplyState(
          turnOn, // enabled
          !turnOn, // emergencyStop
          turnOn // smsEnabled
        );
        console.log('[MkuuDevice] Auto Reply State synchronized to native bridge:', turnOn ? 'ON (ACTIVE)' : 'OFF (STOPPED)');
      } catch (nativeErr) {
        console.warn('[MkuuDevice] Failed to set native auto-reply state:', nativeErr);
      }
    }

    // 2. Server persistence
    try {
      await apiFetch('/api/autoreply/settings', {
        method: 'POST',
        body: JSON.stringify({
          enabled: turnOn,
          smsEnabled: turnOn,
          emergencyStop: !turnOn,
        }),
      });
      await apiFetch('/api/autoreply/emergency-stop', {
        method: 'POST',
        body: JSON.stringify({ active: turnOn, stop: !turnOn }),
      });
      const updated = await fetchJson<AutoReplySettings>('/api/autoreply/settings');
      if (updated) {
        setAutoReplySettings(updated);
        localChatStorage.saveAutoReplySettings(updated);
      }
    } catch (e) {
      console.error('Auto Reply toggle failed:', e);
    }
  };

  // Memory Handlers (Offline-First + Server Sync)
  const handleAddMemory = async (memory: {
    content: string;
    category: Memory['category'];
    importance: Memory['importance'];
    tags: string[];
  }) => {
    const localNewMem: Memory = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      userId: 'user_max_owner',
      content: memory.content,
      category: memory.category,
      importance: memory.importance,
      tags: memory.tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'manual',
    };

    // Immediately update UI and local DB
    setMemories((prev) => [localNewMem, ...prev]);
    await localChatStorage.saveMemory(localNewMem);

    // Try server sync
    try {
      const serverMem = await apiFetch<Memory>('/api/memories', {
        method: 'POST',
        body: JSON.stringify(memory),
      });
      if (serverMem) {
        setMemories((prev) => prev.map((m) => (m.id === localNewMem.id ? serverMem : m)));
        await localChatStorage.saveMemory(serverMem);
      }
    } catch (e) {
      console.warn('Server memory add note (saved in local memory state):', e);
    }
  };

  const handleEditMemory = async (id: string, updates: Partial<Memory>) => {
    const updatedMem = memories.find((m) => m.id === id);
    if (updatedMem) {
      const merged = { ...updatedMem, ...updates, updatedAt: new Date().toISOString() };
      setMemories((prev) => prev.map((m) => (m.id === id ? merged : m)));
      await localChatStorage.saveMemory(merged);
    }

    // Try server sync
    try {
      await apiFetch<Memory>(`/api/memories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    } catch (e) {
      console.warn('Server memory edit note (updated in local state):', e);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    await localChatStorage.deleteMemory(id);

    // Try server sync
    try {
      await apiFetch(`/api/memories/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Server memory delete note (deleted from local state):', e);
    }
  };

  const handleTestMemoryQuery = async (query: string): Promise<string> => {
    try {
      const data = await apiFetch<any>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: `Swali kuhusu kumbukumbu za Max: ${query}`,
        }),
      });
      return data.reply;
    } catch (e: any) {
      const matched = memories.filter((m) =>
        m.content.toLowerCase().includes(query.toLowerCase()) ||
        m.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()))
      );
      if (matched.length > 0) {
        return `Kumbukumbu ${matched.length} zilizolingana kwenye hifadhi ya Max:\n\n` +
          matched.map((m) => `• [${m.category}] ${m.content}`).join('\n');
      }
      return `Nimekagulia hifadhi ya Max: hakuna rekodi inayofanana moja kwa moja na "${query}".`;
    }
  };

  // People Handlers (Offline-First + Server Sync)
  const handleAddPerson = async (personData: Omit<Person, 'id' | 'createdAt' | 'updatedAt'>) => {
    const localPerson: Person = {
      id: `person_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...personData,
    };

    setPeople((prev) => [localPerson, ...prev]);
    await localChatStorage.savePerson(localPerson);

    try {
      const serverPerson = await apiFetch<Person>('/api/people', {
        method: 'POST',
        body: JSON.stringify(personData),
      });
      if (serverPerson) {
        setPeople((prev) => prev.map((p) => (p.id === localPerson.id ? serverPerson : p)));
        await localChatStorage.savePerson(serverPerson);
      }
    } catch (e) {
      console.warn('Server person add note (saved in local state):', e);
    }
  };

  const handleEditPerson = async (id: string, updates: Partial<Person>) => {
    const existing = people.find((p) => p.id === id);
    if (existing) {
      const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      setPeople((prev) => prev.map((p) => (p.id === id ? merged : p)));
      await localChatStorage.savePerson(merged);
    }

    try {
      await apiFetch<Person>(`/api/people/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    } catch (e) {
      console.warn('Server person edit note (updated in local state):', e);
    }
  };

  const handleDeletePerson = async (id: string) => {
    setPeople((prev) => prev.filter((p) => p.id !== id));
    await localChatStorage.deletePerson(id);

    try {
      await apiFetch(`/api/people/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Server person delete note (deleted from local state):', e);
    }
  };

  const handleAskAboutPerson = (name: string) => {
    setActiveTab('chat');
    handleSendMessage(`Nieleze kuhusu ${name} kutoka kwenye orodha yangu ya Watu wa Karibu.`);
  };

  // Auto Reply Handlers
  const handleUpdateAutoReplySettings = async (newSettings: Partial<AutoReplySettings>): Promise<void> => {
    setAutoReplySettings((prev) => ({ ...prev, ...newSettings }));
    try {
      const updated = await apiFetch<AutoReplySettings>('/api/autoreply/settings', {
        method: 'POST',
        body: JSON.stringify(newSettings),
      });
      if (updated) {
        setAutoReplySettings(updated);
      }
    } catch (err) {
      console.warn('Settings updated in local state:', err);
    }
  };

  const handleSimulateInbound = async (params: {
    sender: string;
    message: string;
    channel: 'sms' | 'gmail';
  }): Promise<AutoReplyLog> => {
    try {
      const data = await apiFetch<any>('/api/autoreply/simulate', {
        method: 'POST',
        body: JSON.stringify({
          sender: params.sender,
          content: params.message,
          channel: params.channel,
        }),
      });

      const freshLogs = await fetchJson<AutoReplyLog[]>('/api/autoreply/logs');
      if (freshLogs) {
        setAutoReplyLogs(freshLogs);
      }

      return data.log || {
        id: `sim_${Date.now()}`,
        userId: 'user_max_owner',
        timestamp: new Date().toISOString(),
        channel: params.channel,
        sender: params.sender,
        recipient: 'Max (+255 754 000 111)',
        incomingMessage: params.message,
        generatedReply: data.replyContent || 'Jibu lililozalishwa kwa ueledi.',
        status: data.autoReplied ? 'sent' : 'blocked_emergency',
        confidence: 0.95,
      };
    } catch (e: any) {
      const simLog: AutoReplyLog = {
        id: `sim_local_${Date.now()}`,
        userId: 'user_max_owner',
        timestamp: new Date().toISOString(),
        channel: params.channel,
        sender: params.sender,
        recipient: 'Max (+255 754 000 111)',
        incomingMessage: params.message,
        generatedReply: `Habari, nimepokea ujumbe wako kwa Max. Max ameelekezwa na atawasiliana nawe punde. Asante! (Mkuu AI Auto-Reply)`,
        status: autoReplySettings.emergencyStop ? 'blocked_emergency' : 'sent',
        confidence: 0.96,
      };
      setAutoReplyLogs((prev) => [simLog, ...prev]);
      return simLog;
    }
  };

  const handleClearLogs = async () => {
    setAutoReplyLogs([]);
    try {
      await apiFetch('/api/autoreply/logs/clear', { method: 'POST' });
    } catch (e) {
      console.warn('Logs cleared locally:', e);
    }
  };

  // Files Handlers (Offline-First + Client Binary Engine + Server Sync)
  const handleDeleteFile = async (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    await localChatStorage.deleteFile(id);

    if (previewingFile?.id === id) {
      setPreviewingFile(null);
    }

    try {
      await apiFetch(`/api/files/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Server delete sync notice (deleted locally):', e);
    }
  };

  const handleGenerateFile = async (params: {
    title: string;
    fileType: 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'json' | 'md';
    contentPrompt: string;
  }): Promise<GeneratedFileSummary> => {
    let newFile: GeneratedFileSummary | null = null;

    // 1. Try server-side generation first if available
    try {
      const rawFile = await apiFetch<GeneratedFileSummary>('/api/files/generate', {
        method: 'POST',
        body: JSON.stringify({
          filename: params.title,
          fileType: params.fileType,
          contentPrompt: params.contentPrompt,
        }),
      });

      if (rawFile && rawFile.downloadUrl) {
        newFile = {
          ...rawFile,
          downloadUrl: rawFile.downloadUrl.startsWith('http') ? rawFile.downloadUrl : getApiUrl(rawFile.downloadUrl),
        };
      }
    } catch (serverErr) {
      console.warn('Server file generate note, falling back to client binary generator:', serverErr);
    }

    // 2. If server not available or failed, use client binary engine
    if (!newFile) {
      const clientRes = await clientGenerateFile({
        title: params.title,
        fileType: params.fileType,
        contentPrompt: params.contentPrompt,
      });
      newFile = clientRes.file;
    }

    // 3. Save to local IndexedDB
    await localChatStorage.saveFile(newFile, newFile.downloadUrl);

    // 4. Update React state
    setFiles((prev) => [newFile!, ...prev]);

    return newFile;
  };

  // Security / Settings Handlers
  const handleUpdatePin = async (newPin: string) => {
    setUser((prev) => (prev ? { ...prev, securityPin: newPin, securityPinSet: true } : prev));
    try {
      const data = await apiFetch<any>('/api/user/pin', {
        method: 'POST',
        body: JSON.stringify({ pin: newPin }),
      });
      if (data && data.user) {
        setUser(data.user);
      }
    } catch (e) {
      console.warn('Pin updated in local state:', e);
    }
  };

  const handleExportAllData = async () => {
    const allConvs = await localChatStorage.getAllConversations();
    const fullBackup = {
      exportDate: new Date().toISOString(),
      owner: user,
      memories,
      people,
      files,
      autoReplySettings,
      autoReplyLogs,
      conversations: allConvs,
    };

    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MKUU_AI_MAX_FULL_BACKUP_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearAllData = async () => {
    await localChatStorage.clearAllConversations();
    setMessages([]);
    setConversations([]);
    try {
      await apiFetch('/api/system/reset', { method: 'POST' });
      await fetchAllData();
    } catch (e) {
      console.warn('Reset executed locally:', e);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen overflow-hidden bg-[#131314] text-[#f0f4f9] font-sans">
      {/* Left Navigation Sidebar & Mobile Header */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        emergencyStop={autoReplySettings.emergencyStop}
        onEmergencyStopToggle={handleEmergencyStopToggle}
        onOpenVoice={() => setIsVoiceModalOpen(true)}
        conversationCount={conversations.length}
        memoryCount={memories.length}
        peopleCount={people.length}
        filesCount={files.length}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        isOnline={isOnline}
        onNewUser={() => setIsNewUserAuthOpen(true)}
      />

      {/* Main View Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 w-full overflow-hidden relative">
        {!isOnline && (
          <div className="w-full bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-300 z-20">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Muunganisho wa intaneti umekatika au uko chini. Unatumia hifadhi ya ndani.</span>
            </span>
            <button
              onClick={() => {
                setIsOnline(navigator.onLine);
                fetchAllData();
              }}
              className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[11px] font-semibold text-amber-200 transition cursor-pointer"
            >
              Jaribu Kuunganisha
            </button>
          </div>
        )}
        {activeTab === 'chat' && (
          <ChatView
            messages={messages}
            conversationTitle={
              conversations.find((c) => c.id === conversationId)?.title || 'Mkuu Chat'
            }
            onSendMessage={handleSendMessage}
            onRetryMessage={handleRetryMessage}
            isLoading={isLoading}
            onOpenVoice={() => setIsVoiceModalOpen(true)}
            onNewChat={handleNewChat}
            onOpenHistory={() => setActiveTab('history')}
            onDeleteMessage={handleDeleteMessage}
            onOpenMemoryModal={() => setActiveTab('memory')}
            onOpenFileGenerator={() => setIsFileGeneratorModalOpen(true)}
            onPreviewDocument={(file) => setPreviewingFile(file)}
            memories={memories}
            people={people}
            isOnline={isOnline}
            onToggleMenu={() => setMobileMenuOpen((prev) => !prev)}
            onBack={handleNewChat}
            user={user}
          />
        )}

        {activeTab === 'history' && (
          <ChatHistoryView
            conversations={conversations}
            activeConversationId={conversationId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewChat}
            onDeleteConversation={handleDeleteConversation}
            onRenameConversation={handleRenameConversation}
            onExportHistory={handleExportHistory}
            isOnline={isOnline}
            onBack={() => setActiveTab('chat')}
            onToggleMenu={() => setMobileMenuOpen((prev) => !prev)}
          />
        )}

        {activeTab === 'memory' && (
          <MemoryCenter
            memories={memories}
            onAddMemory={handleAddMemory}
            onEditMemory={handleEditMemory}
            onDeleteMemory={handleDeleteMemory}
            onTestQuery={handleTestMemoryQuery}
            onBack={() => setActiveTab('chat')}
            onToggleMenu={() => setMobileMenuOpen((prev) => !prev)}
          />
        )}

        {activeTab === 'people' && (
          <PeopleCenter
            people={people}
            onAddPerson={handleAddPerson}
            onEditPerson={handleEditPerson}
            onDeletePerson={handleDeletePerson}
            onSimulateMessage={(sender, message) => {
              setActiveTab('autoreply');
              handleSimulateInbound({ sender, message, channel: 'sms' });
            }}
            onAskAboutPerson={handleAskAboutPerson}
            onBack={() => setActiveTab('chat')}
            onToggleMenu={() => setMobileMenuOpen((prev) => !prev)}
          />
        )}

        {activeTab === 'autoreply' && (
          <AutoReplyCenter
            settings={autoReplySettings}
            logs={autoReplyLogs}
            people={people}
            onUpdateSettings={handleUpdateAutoReplySettings}
            onEmergencyStopToggle={handleEmergencyStopToggle}
            onSimulateInbound={handleSimulateInbound}
            onClearLogs={handleClearLogs}
            onBack={() => setActiveTab('chat')}
            onToggleMenu={() => setMobileMenuOpen((prev) => !prev)}
          />
        )}

        {activeTab === 'files' && (
          <FilesCenter
            files={files}
            onDeleteFile={handleDeleteFile}
            onOpenFileGenerator={() => setIsFileGeneratorModalOpen(true)}
            onAskChatAboutFile={(filename) => {
              setActiveTab('chat');
              handleSendMessage(`Tafadhali chambua na unipe muhtasari wa faili: ${filename}`);
            }}
            onPreviewDocument={(file) => setPreviewingFile(file)}
            onFileUploadSuccess={(newFile) => setFiles((prev) => [newFile, ...prev])}
            onBack={() => setActiveTab('chat')}
            onToggleMenu={() => setMobileMenuOpen((prev) => !prev)}
          />
        )}

        {activeTab === 'sport' && (
          <Sport onBack={() => setActiveTab('chat')} onToggleMenu={() => setMobileMenuOpen((prev) => !prev)} />
        )}

        {activeTab === 'security' && (
          <SecurityCenter
            user={user}
            memories={memories}
            people={people}
            autoReplySettings={autoReplySettings}
            onUpdatePin={handleUpdatePin}
            onExportAllData={handleExportAllData}
            onClearAllData={handleClearAllData}
            onBack={() => setActiveTab('chat')}
            onToggleMenu={() => setMobileMenuOpen((prev) => !prev)}
          />
        )}
      </main>

      {/* Right Intelligence Sidebar (Hidden on mobile) */}
      <div className="hidden xl:block w-80 h-full flex-shrink-0 border-l border-[#222222]">
        <RightSidebar
          memories={memories}
          people={people}
          files={files}
          autoReplySettings={autoReplySettings}
          setActiveTab={(tab) => setActiveTab(tab)}
          onOpenVoice={() => setIsVoiceModalOpen(true)}
          onOpenFileGenerator={() => setIsFileGeneratorModalOpen(true)}
        />
      </div>

      <GoogleAuthModal
        isOpen={isNewUserAuthOpen}
        onClose={() => setIsNewUserAuthOpen(false)}
        onSignedIn={(profile) => {
          setUser((prev) => ({
            ...(prev || {}),
            id: profile.id,
            name: profile.name,
            email: profile.email,
            title: 'MKUU AI User',
            role: 'user',
            language: 'Kiswahili',
            theme: 'dark',
            securityPinSet: false,
            securityPin: '',
            createdAt: new Date().toISOString(),
          }));
        }}
      />

      {/* Voice Assistant Modal */
      <VoiceModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onSendMessage={async (text, isVoice) => {
          const res = await handleSendMessage(text, isVoice);
          return {
            reply: res?.reply || '',
            cleanSpeechText: res?.cleanSpeechText || res?.reply || '',
          };
        }}
        memories={memories}
        people={people}
      />

      {/* Real Binary File Generator Modal */}
      <FileGeneratorModal
        isOpen={isFileGeneratorModalOpen}
        onClose={() => setIsFileGeneratorModalOpen(false)}
        onGenerateFile={handleGenerateFile}
      />

      {/* Real Document Preview & Open Modal */}
      <DocumentPreviewModal
        isOpen={!!previewingFile}
        file={previewingFile}
        onClose={() => setPreviewingFile(null)}
        onDelete={handleDeleteFile}
      />
    </div>
  );
};

export default App;
