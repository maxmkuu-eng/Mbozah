/**
 * Local Chat, Memory, People & File Storage Engine for MKUU AI
 * 
 * Provides durable, offline-first local persistence using IndexedDB with
 * synchronous LocalStorage backup. Guarantees 100% functionality on
 * Android Capacitor APK, Web browsers, offline environments, and reboots.
 */

import {
  ChatMessage,
  Conversation,
  Memory,
  Person,
  GeneratedFileSummary,
  AutoReplySettings,
  AutoReplyLog,
  UserProfile,
} from '../types';

const DB_NAME = 'MkuuAI_Local_DB_v2';
const DB_VERSION = 2;
const CONV_STORE = 'conversations';
const MSG_STORE = 'messages';
const MEM_STORE = 'memories';
const PEOPLE_STORE = 'people';
const FILES_STORE = 'files';
const SETTINGS_STORE = 'settings';

// LocalStorage Keys for Instant Synchronous Backup
const LS_KEYS = {
  CONVERSATIONS: 'mkuu_local_conversations_v2',
  ACTIVE_CONV: 'mkuu_active_conv_id_v2',
  MEMORIES: 'mkuu_local_memories_v2',
  PEOPLE: 'mkuu_local_people_v2',
  FILES: 'mkuu_local_files_v2',
  SETTINGS: 'mkuu_local_autoreply_settings_v2',
  LOGS: 'mkuu_local_autoreply_logs_v2',
  USER: 'mkuu_local_user_profile_v2',
};

// Default Initial Data (Seed data so APK never starts empty)
let currentUserId = 'user_max_owner';

export const setLocalStorageUserContext = (userId: string) => {
  currentUserId = userId || 'user_max_owner';
};

const DEFAULT_USER: UserProfile = {
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
};

const DEFAULT_MEMORIES: Memory[] = [
  {
    id: 'mem_1',
    userId: 'user_max_owner',
    content: 'Max anapendelea lugha ya Kiswahili fasaha kwa mawasiliano yote na MKUU AI.',
    category: 'Preferences',
    importance: 'high',
    tags: ['Lugha', 'Kiswahili', 'Upendeleo'],
    createdAt: '2026-08-10T10:00:00.000Z',
    updatedAt: '2026-08-10T10:00:00.000Z',
    source: 'explicit_command',
  },
  {
    id: 'mem_2',
    userId: 'user_max_owner',
    content: 'Kwenye mazungumzo na barua zangu rasmi, nitambue kama "Mkuu Max".',
    category: 'Preferences',
    importance: 'high',
    tags: ['Mtindo', 'Uongozi', 'Heshima'],
    createdAt: '2026-08-12T14:20:00.000Z',
    updatedAt: '2026-08-12T14:20:00.000Z',
    source: 'explicit_command',
  },
];

const DEFAULT_PEOPLE: Person[] = [];

const DEFAULT_SETTINGS: AutoReplySettings = {
  userId: 'user_max_owner',
  enabled: true,
  emergencyStop: false,
  mode: 'automatic',
  language: 'Kiswahili',
  tone: 'Heshima & Ueledi',
  workingHours: {
    enabled: true,
    start: '08:00',
    end: '20:00',
  },
  myPhoneNumber: '',
  phoneVerified: false,
  smsEnabled: true,
  gmailEnabled: true,
  safetyRules: [
    'Usiwahi kutoa PIN au nywila za kibenki wala taarifa binafsi za Max.',
    'Ujumbe unaotoka kwa nambari zisizojulikana ujibiwe kwa ufupi na kwa heshima bila kutoa ahadi za kifedha.',
    'Watu wa karibu waliopo kwenye orodha ya Watu Wangu wa Karibu watambuliwe na kujibiwa kwa heshima kulingana na uhusiano wao.',
  ],
  whitelistedNumbers: [],
  blacklistedNumbers: [],
};

// Open / Upgrade IndexedDB
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(CONV_STORE)) {
        const convStore = db.createObjectStore(CONV_STORE, { keyPath: 'id' });
        convStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(MSG_STORE)) {
        const msgStore = db.createObjectStore(MSG_STORE, { keyPath: 'id' });
        msgStore.createIndex('conversationId', 'conversationId', { unique: false });
      }

      if (!db.objectStoreNames.contains(MEM_STORE)) {
        db.createObjectStore(MEM_STORE, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(PEOPLE_STORE)) {
        db.createObjectStore(PEOPLE_STORE, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(FILES_STORE)) {
        db.createObjectStore(FILES_STORE, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

function getFromLocalStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    return JSON.parse(item) as T;
  } catch {
    return fallback;
  }
}

function saveToLocalStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`LocalStorage write error for ${key}:`, e);
  }
}

export const localChatStorage = {
  /**
   * Initialize local storage engine and bootstrap seed data if fresh install
   */
  async init(): Promise<void> {
    try {
      await openDatabase();
    } catch (e) {
      console.warn('IndexedDB unavailable, falling back to LocalStorage:', e);
    }

    // Seed owner defaults only for the original owner account.
    if (currentUserId === 'user_max_owner' && !localStorage.getItem(LS_KEYS.USER)) {
      saveToLocalStorage(LS_KEYS.USER, DEFAULT_USER);
    }

    // 1. Seed owner memories only for the original owner account.
    const existingMems = await this.getMemories();
    if (currentUserId === 'user_max_owner' && (!existingMems || existingMems.length === 0)) {
      for (const m of DEFAULT_MEMORIES) await this.saveMemory(m);
    }

    // 2. Seed People - do not seed any sample people
    const existingPeople = await this.getPeople();
    if (!existingPeople || existingPeople.length === 0) {
      for (const p of DEFAULT_PEOPLE) {
        await this.savePerson(p);
      }
    }

    // 3. Purge legacy sample files and people if previously cached
    try {
      const isSamplePerson = (name: string, phone?: string) => {
        const lowerName = (name || '').toLowerCase();
        const p = phone || '';
        return (
          lowerName === 'mary' ||
          lowerName === 'mama zawadi' ||
          lowerName === 'dr. mrema' ||
          lowerName === 'mhandisi juma' ||
          lowerName === 'baraka' ||
          p.includes('754 999 888') ||
          p.includes('754 111 222') ||
          p.includes('784 333 444') ||
          p.includes('754 889 001') ||
          p.includes('713 554 221') ||
          p.includes('788 112 334') ||
          p.includes('765 990 123')
        );
      };
      const isSampleFile = (filename: string) => {
        return (
          filename.includes('Picha_') ||
          filename.includes('Mchoro_') ||
          filename.includes('Ripoti_ya_Mfumo_wa_MKUU_AI') ||
          filename.includes('Orodha_ya_Watu_wa_Karibu') ||
          filename.includes('Mwongozo_wa_Usalama_wa_Max')
        );
      };

      const localPeople = getFromLocalStorage<Person[]>(LS_KEYS.PEOPLE, []);
      if (localPeople.some((p) => isSamplePerson(p.name, p.phone))) {
        saveToLocalStorage(
          LS_KEYS.PEOPLE,
          localPeople.filter((p) => !isSamplePerson(p.name, p.phone))
        );
      }

      const localFiles = getFromLocalStorage<GeneratedFileSummary[]>(LS_KEYS.FILES, []);
      if (localFiles.some((f) => isSampleFile(f.filename))) {
        saveToLocalStorage(
          LS_KEYS.FILES,
          localFiles.filter((f) => !isSampleFile(f.filename))
        );
      }
    } catch {
      // ignore
    }

    // 4. Seed AutoReply Settings only for the original owner account.
    if (currentUserId === 'user_max_owner' && !localStorage.getItem(LS_KEYS.SETTINGS)) {
      saveToLocalStorage(LS_KEYS.SETTINGS, DEFAULT_SETTINGS);
    }

    // Seed the owner welcome conversation only for the original owner account.
    const convs = await this.getAllConversations();
    if (currentUserId === 'user_max_owner' && convs.length === 0) {
      const initialConv: Conversation = {
        id: 'conv_main_max',
        userId: currentUserId,
        title: 'Mazungumzo ya Awali',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: 'msg_welcome',
            role: 'assistant',
            content: `Habari Mkuu **Max**! Mimi ni **MKUU AI**, msaidizi wako binafsi.\n\nMifumo yako yote—Kumbukumbu za kudumu (Max Memory), Watu wako wa karibu (Max Identify), Majibu ya kiotomatiki (Max Auto Reply), na Uzalishaji wa Mafaili halisi (PDF, Excel, Word)—ipo tayari kutumika hata bila mtandao.\n\nNikuongoze au tushughulikie nini sasa?`,
            timestamp: new Date().toISOString(),
            savedOffline: true,
          },
        ],
      };
      await this.saveConversation(initialConv);
      this.setActiveConversationId(initialConv.id);
    }
  },

  // ==========================================
  // CONVERSATIONS
  // ==========================================

  async getAllConversations(): Promise<Conversation[]> {
    try {
      const db = await openDatabase();
      return new Promise<Conversation[]>((resolve) => {
        const tx = db.transaction(CONV_STORE, 'readonly');
        const store = tx.objectStore(CONV_STORE);
        const req = store.getAll();

        req.onsuccess = () => {
          const list: Conversation[] = (req.result || []).filter((c: Conversation) => c.userId === currentUserId);
          const localList = getFromLocalStorage<Conversation[]>(LS_KEYS.CONVERSATIONS, []).filter((c) => c.userId === currentUserId);

          const map = new Map<string, Conversation>();
          for (const item of list) map.set(item.id, item);
          for (const item of localList) {
            const existing = map.get(item.id);
            if (!existing || (item.messages && item.messages.length > (existing.messages?.length || 0))) {
              map.set(item.id, item);
            }
          }

          const combined = Array.from(map.values()).sort(
            (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
          );

          resolve(combined);
        };

        req.onerror = () => {
          resolve(getFromLocalStorage<Conversation[]>(LS_KEYS.CONVERSATIONS, []));
        };
      });
    } catch {
      return getFromLocalStorage<Conversation[]>(LS_KEYS.CONVERSATIONS, []);
    }
  },

  async getConversation(id: string): Promise<Conversation | null> {
    const all = await this.getAllConversations();
    return all.find((c) => c.id === id) || null;
  },

  async saveConversation(conversation: Conversation): Promise<void> {
    if (!conversation || !conversation.id) return;

    const updatedConv: Conversation = {
      ...conversation,
      updatedAt: new Date().toISOString(),
      messages: conversation.messages || [],
    };

    // 1. LocalStorage
    const localList = getFromLocalStorage<Conversation[]>(LS_KEYS.CONVERSATIONS, []);
    const idx = localList.findIndex((c) => c.id === updatedConv.id);
    if (idx >= 0) {
      localList[idx] = updatedConv;
    } else {
      localList.unshift(updatedConv);
    }
    saveToLocalStorage(LS_KEYS.CONVERSATIONS, localList);

    // 2. IndexedDB
    try {
      const db = await openDatabase();
      const tx = db.transaction(CONV_STORE, 'readwrite');
      tx.objectStore(CONV_STORE).put(updatedConv);
    } catch (e) {
      console.warn('IDB write conversation warning:', e);
    }
  },

  async addMessage(conversationId: string, message: ChatMessage, titleFallback?: string): Promise<Conversation> {
    let conv = await this.getConversation(conversationId);

    if (!conv) {
      conv = {
        id: conversationId,
        userId: 'user_max_owner',
        title:
          titleFallback ||
          (message.content
            ? message.content.slice(0, 35) + (message.content.length > 35 ? '...' : '')
            : 'Mazungumzo Mapya'),
        createdAt: message.timestamp || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [message],
      };
    } else {
      const msgExists = conv.messages.some((m) => m.id === message.id);
      if (!msgExists) {
        conv.messages = [...conv.messages, message];
      }
      conv.updatedAt = new Date().toISOString();

      if ((conv.title === 'Mazungumzo Mapya' || !conv.title) && message.role === 'user' && message.content) {
        conv.title = message.content.slice(0, 35) + (message.content.length > 35 ? '...' : '');
      }
    }

    await this.saveConversation(conv);
    return conv;
  },

  async deleteMessage(conversationId: string, messageId: string): Promise<Conversation | null> {
    const conv = await this.getConversation(conversationId);
    if (!conv) return null;

    conv.messages = conv.messages.filter((m) => m.id !== messageId);
    conv.updatedAt = new Date().toISOString();
    await this.saveConversation(conv);
    return conv;
  },

  async deleteConversation(id: string): Promise<boolean> {
    const localList = getFromLocalStorage<Conversation[]>(LS_KEYS.CONVERSATIONS, []);
    const filtered = localList.filter((c) => c.id !== id);
    saveToLocalStorage(LS_KEYS.CONVERSATIONS, filtered);

    try {
      const db = await openDatabase();
      const tx = db.transaction(CONV_STORE, 'readwrite');
      tx.objectStore(CONV_STORE).delete(id);
    } catch (e) {
      console.warn('IDB delete conversation warning:', e);
    }
    return true;
  },

  async clearAllConversations(): Promise<void> {
    localStorage.removeItem(LS_KEYS.CONVERSATIONS);
    try {
      const db = await openDatabase();
      const tx = db.transaction(CONV_STORE, 'readwrite');
      tx.objectStore(CONV_STORE).clear();
    } catch (e) {
      console.warn('IDB clear conversations warning:', e);
    }
  },

  getActiveConversationId(): string {
    return localStorage.getItem(LS_KEYS.ACTIVE_CONV) || 'conv_main_max';
  },

  setActiveConversationId(id: string): void {
    localStorage.setItem(LS_KEYS.ACTIVE_CONV, id);
  },

  // ==========================================
  // MEMORIES (CRUD)
  // ==========================================

  async getMemories(): Promise<Memory[]> {
    try {
      const db = await openDatabase();
      return new Promise<Memory[]>((resolve) => {
        const tx = db.transaction(MEM_STORE, 'readonly');
        const store = tx.objectStore(MEM_STORE);
        const req = store.getAll();

        req.onsuccess = () => {
          const list: Memory[] = (req.result || []).filter((m: Memory) => m.userId === currentUserId);
          const localList = getFromLocalStorage<Memory[]>(LS_KEYS.MEMORIES, DEFAULT_MEMORIES).filter((m) => m.userId === currentUserId);

          const map = new Map<string, Memory>();
          for (const item of list) map.set(item.id, item);
          for (const item of localList) map.set(item.id, item);

          const combined = Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

          resolve(combined.length > 0 ? combined : DEFAULT_MEMORIES);
        };

        req.onerror = () => {
          resolve(getFromLocalStorage<Memory[]>(LS_KEYS.MEMORIES, DEFAULT_MEMORIES));
        };
      });
    } catch {
      return getFromLocalStorage<Memory[]>(LS_KEYS.MEMORIES, DEFAULT_MEMORIES).filter((m) => m.userId === currentUserId);
    }
  },

  async saveMemory(memory: Memory): Promise<void> {
    if (!memory || !memory.id) return;

    const list = getFromLocalStorage<Memory[]>(LS_KEYS.MEMORIES, []);
    const idx = list.findIndex((m) => m.id === memory.id);
    if (idx >= 0) {
      list[idx] = memory;
    } else {
      list.unshift(memory);
    }
    saveToLocalStorage(LS_KEYS.MEMORIES, list);

    try {
      const db = await openDatabase();
      const tx = db.transaction(MEM_STORE, 'readwrite');
      tx.objectStore(MEM_STORE).put(memory);
    } catch (e) {
      console.warn('IDB save memory warning:', e);
    }
  },

  async deleteMemory(id: string): Promise<void> {
    const list = getFromLocalStorage<Memory[]>(LS_KEYS.MEMORIES, []);
    const filtered = list.filter((m) => m.id !== id);
    saveToLocalStorage(LS_KEYS.MEMORIES, filtered);

    try {
      const db = await openDatabase();
      const tx = db.transaction(MEM_STORE, 'readwrite');
      tx.objectStore(MEM_STORE).delete(id);
    } catch (e) {
      console.warn('IDB delete memory warning:', e);
    }
  },

  // ==========================================
  // PEOPLE (CRUD)
  // ==========================================

  async getPeople(): Promise<Person[]> {
    const isSamplePerson = (name: string, phone?: string) => {
      const lowerName = (name || '').toLowerCase();
      const p = phone || '';
      return (
        lowerName === 'mary' ||
        lowerName === 'mama zawadi' ||
        lowerName === 'dr. mrema' ||
        lowerName === 'mhandisi juma' ||
        lowerName === 'baraka' ||
        p.includes('754 999 888') ||
        p.includes('754 111 222') ||
        p.includes('784 333 444') ||
        p.includes('754 889 001') ||
        p.includes('713 554 221') ||
        p.includes('788 112 334') ||
        p.includes('765 990 123')
      );
    };

    try {
      const db = await openDatabase();
      return new Promise<Person[]>((resolve) => {
        const tx = db.transaction(PEOPLE_STORE, 'readonly');
        const store = tx.objectStore(PEOPLE_STORE);
        const req = store.getAll();

        req.onsuccess = () => {
          const list: Person[] = (req.result || []).filter((p: Person) => p.userId === currentUserId);
          const localList = getFromLocalStorage<Person[]>(LS_KEYS.PEOPLE, []).filter((p) => p.userId === currentUserId);

          const map = new Map<string, Person>();
          for (const item of list) map.set(item.id, item);
          for (const item of localList) map.set(item.id, item);

          const combined = Array.from(map.values())
            .filter((p) => !isSamplePerson(p.name, p.phone))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          resolve(combined);
        };

        req.onerror = () => {
          const local = getFromLocalStorage<Person[]>(LS_KEYS.PEOPLE, []).filter((p) => !isSamplePerson(p.name, p.phone));
          resolve(local);
        };
      });
    } catch {
      return getFromLocalStorage<Person[]>(LS_KEYS.PEOPLE, []).filter((p) => p.userId === currentUserId && !isSamplePerson(p.name, p.phone));
    }
  },

  async savePerson(person: Person): Promise<void> {
    if (!person || !person.id) return;

    const list = getFromLocalStorage<Person[]>(LS_KEYS.PEOPLE, []);
    const idx = list.findIndex((p) => p.id === person.id);
    if (idx >= 0) {
      list[idx] = person;
    } else {
      list.unshift(person);
    }
    saveToLocalStorage(LS_KEYS.PEOPLE, list);

    try {
      const db = await openDatabase();
      const tx = db.transaction(PEOPLE_STORE, 'readwrite');
      tx.objectStore(PEOPLE_STORE).put(person);
    } catch (e) {
      console.warn('IDB save person warning:', e);
    }
  },

  async deletePerson(id: string): Promise<void> {
    const list = getFromLocalStorage<Person[]>(LS_KEYS.PEOPLE, []);
    const filtered = list.filter((p) => p.id !== id);
    saveToLocalStorage(LS_KEYS.PEOPLE, filtered);

    try {
      const db = await openDatabase();
      const tx = db.transaction(PEOPLE_STORE, 'readwrite');
      tx.objectStore(PEOPLE_STORE).delete(id);
    } catch (e) {
      console.warn('IDB delete person warning:', e);
    }
  },

  // ==========================================
  // FILES (CRUD & Data Storage)
  // ==========================================

  async getFiles(): Promise<GeneratedFileSummary[]> {
    const isSampleFile = (filename: string) => {
      return (
        filename.includes('Picha_') ||
        filename.includes('Mchoro_') ||
        filename.includes('Ripoti_ya_Mfumo_wa_MKUU_AI') ||
        filename.includes('Orodha_ya_Watu_wa_Karibu') ||
        filename.includes('Mwongozo_wa_Usalama_wa_Max')
      );
    };

    try {
      const db = await openDatabase();
      return new Promise<GeneratedFileSummary[]>((resolve) => {
        const tx = db.transaction(FILES_STORE, 'readonly');
        const store = tx.objectStore(FILES_STORE);
        const req = store.getAll();

        req.onsuccess = () => {
          const list: { file: GeneratedFileSummary; data?: string }[] = req.result || [];
          const localList = getFromLocalStorage<GeneratedFileSummary[]>(LS_KEYS.FILES, []);

          const map = new Map<string, GeneratedFileSummary>();
          for (const item of list) {
            if (item.file) map.set(item.file.id, item.file);
          }
          for (const item of localList) {
            map.set(item.id, item);
          }

          const combined = Array.from(map.values())
            .filter((f) => !isSampleFile(f.filename))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          resolve(combined);
        };

        req.onerror = () => {
          const local = getFromLocalStorage<GeneratedFileSummary[]>(LS_KEYS.FILES, []).filter((f) => !isSampleFile(f.filename));
          resolve(local);
        };
      });
    } catch {
      return getFromLocalStorage<GeneratedFileSummary[]>(LS_KEYS.FILES, []).filter((f) => !isSampleFile(f.filename));
    }
  },

  async saveFile(file: GeneratedFileSummary, base64Data?: string): Promise<void> {
    if (!file || !file.id) return;

    // 1. LocalStorage summary
    const localList = getFromLocalStorage<GeneratedFileSummary[]>(LS_KEYS.FILES, []);
    const idx = localList.findIndex((f) => f.id === file.id);
    if (idx >= 0) {
      localList[idx] = file;
    } else {
      localList.unshift(file);
    }
    saveToLocalStorage(LS_KEYS.FILES, localList);

    // 2. IndexedDB (includes base64 content)
    try {
      const db = await openDatabase();
      const tx = db.transaction(FILES_STORE, 'readwrite');
      tx.objectStore(FILES_STORE).put({
        id: file.id,
        filename: file.filename,
        file,
        data: base64Data || file.downloadUrl,
      });
    } catch (e) {
      console.warn('IDB save file warning:', e);
    }
  },

  async getFileData(idOrFilename: string): Promise<{ file: GeneratedFileSummary; data?: string } | null> {
    try {
      const db = await openDatabase();
      return new Promise<{ file: GeneratedFileSummary; data?: string } | null>((resolve) => {
        const tx = db.transaction(FILES_STORE, 'readonly');
        const store = tx.objectStore(FILES_STORE);
        const req = store.getAll();

        req.onsuccess = () => {
          const list: { id: string; filename: string; file: GeneratedFileSummary; data?: string }[] = req.result || [];
          const match = list.find((item) => item.id === idOrFilename || item.filename === idOrFilename);
          resolve(match || null);
        };

        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },

  async deleteFile(id: string): Promise<void> {
    const list = getFromLocalStorage<GeneratedFileSummary[]>(LS_KEYS.FILES, []);
    const filtered = list.filter((f) => f.id !== id);
    saveToLocalStorage(LS_KEYS.FILES, filtered);

    try {
      const db = await openDatabase();
      const tx = db.transaction(FILES_STORE, 'readwrite');
      tx.objectStore(FILES_STORE).delete(id);
    } catch (e) {
      console.warn('IDB delete file warning:', e);
    }
  },

  // ==========================================
  // AUTO REPLY SETTINGS & LOGS
  // ==========================================

  getAutoReplySettings(): AutoReplySettings {
    return getFromLocalStorage<AutoReplySettings>(LS_KEYS.SETTINGS, DEFAULT_SETTINGS);
  },

  saveAutoReplySettings(settings: AutoReplySettings): void {
    saveToLocalStorage(LS_KEYS.SETTINGS, settings);
  },

  getAutoReplyLogs(): AutoReplyLog[] {
    return getFromLocalStorage<AutoReplyLog[]>(LS_KEYS.LOGS, []);
  },

  saveAutoReplyLog(log: AutoReplyLog): void {
    const logs = getFromLocalStorage<AutoReplyLog[]>(LS_KEYS.LOGS, []);
    logs.unshift(log);
    saveToLocalStorage(LS_KEYS.LOGS, logs.slice(0, 100)); // keep last 100 logs
  },

  clearAutoReplyLogs(): void {
    saveToLocalStorage(LS_KEYS.LOGS, []);
  },

  // ==========================================
  // USER PROFILE
  // ==========================================

  getUserProfile(): UserProfile {
    return getFromLocalStorage<UserProfile>(LS_KEYS.USER, DEFAULT_USER);
  },

  saveUserProfile(user: UserProfile): void {
    saveToLocalStorage(LS_KEYS.USER, user);
  },

  /**
   * Export all chat data as JSON string for backup
   */
  async exportDataJson(): Promise<string> {
    const convs = await this.getAllConversations();
    const mems = await this.getMemories();
    const people = await this.getPeople();
    const files = await this.getFiles();
    const settings = this.getAutoReplySettings();

    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        version: '2.0',
        conversations: convs,
        memories: mems,
        people,
        files,
        autoReplySettings: settings,
      },
      null,
      2
    );
  },
};
