import fs from 'fs';
import path from 'path';

export interface Memory {
  id: string; userId: string; content: string;
  category: 'General' | 'Preferences' | 'Work' | 'Family' | 'Health' | 'Finance' | 'Rules';
  importance: 'high' | 'medium' | 'low'; tags: string[]; createdAt: string; updatedAt: string;
  source: 'explicit_command' | 'auto_extracted' | 'manual';
}
export interface Person {
  id: string; userId: string; name: string; nickname?: string; relationship: string;
  phone?: string; email?: string; notes?: string; avatarColor?: string; createdAt: string; updatedAt: string;
}
export interface ChatMessage {
  id: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: string;
  isVoice?: boolean; attachments?: any[]; generatedFiles?: GeneratedFileSummary[];
  memoryExtracted?: string[]; personRecognized?: string[];
}
export interface Conversation { id: string; userId: string; title: string; createdAt: string; updatedAt: string; messages: ChatMessage[]; }
export interface GeneratedFileSummary {
  id: string; filename: string; fileType: string; size: number; mimeType: string; createdAt: string;
  description?: string; downloadUrl: string; previewUrl?: string; base64Data?: string;
}
export interface SimCardInfo {
  slotIndex: number;
  carrierName: string;
  phoneNumber?: string;
  countryIso?: string;
  displayName?: string;
  isDefault?: boolean;
  isActive?: boolean;
  status?: 'active' | 'inactive' | 'roaming';
  signalLevel?: number;
  iccid?: string;
}
export interface DevicePermissionsState {
  smsReadSend: boolean;
  notificationAccess: boolean;
  exactAlarmReminder: boolean;
}
export interface AutoReplySettings {
  userId: string; enabled: boolean; emergencyStop: boolean; mode: 'automatic' | 'approval_required';
  language: 'Kiswahili' | 'English' | 'Auto'; tone: 'Heshima & Ueledi' | 'Kirafiki' | 'Rasmi' | 'Fupi na Wazi';
  workingHours: { enabled: boolean; start: string; end: string }; myPhoneNumber: string;
  phoneVerified?: boolean; phoneVerifiedAt?: string; smsEnabled: boolean; gmailEnabled: boolean;
  safetyRules: string[]; whitelistedNumbers: string[]; blacklistedNumbers: string[];
  selectedSimSlot?: 'sim1' | 'sim2' | 'both' | 'smart';
  simCards?: SimCardInfo[];
  permissions?: DevicePermissionsState;
}
export interface AutoReplyLog {
  id: string; userId: string; channel: 'sms' | 'gmail'; sender: string; senderName?: string; recipient: string;
  incomingMessage: string; generatedReply: string;
  status: 'sent' | 'blocked_emergency' | 'pending_approval' | 'failed' | 'outside_hours';
  timestamp: string; matchedPersonId?: string; matchedRelationship?: string; confidence: number;
}
export interface UserProfile {
  id: string; email: string; name: string; title: string; role: 'owner' | 'guest'; language: 'Kiswahili' | 'English';
  theme: 'dark' | 'light'; securityPinSet: boolean; securityPin?: string; createdAt: string;
}
interface DatabaseSchema {
  users: UserProfile[]; memories: Memory[]; people: Person[]; conversations: Conversation[];
  files: GeneratedFileSummary[]; autoReplySettings: Record<string, AutoReplySettings>; autoReplyLogs: AutoReplyLog[];
}

// Render uses an ephemeral filesystem on the free tier. Keep the database location configurable so
// a persistent disk can be attached later without changing application code.
const DATA_DIR = process.env.MKUU_DATA_DIR ? path.resolve(process.env.MKUU_DATA_DIR) : path.join(process.cwd(), 'data');
const FILES_DIR = path.join(DATA_DIR, 'files');
const DB_FILE = path.join(DATA_DIR, 'mkuu_db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });

const DEFAULT_OWNER: UserProfile = {
  id: 'user_max_owner', email: 'maxmkuu@gmail.com', name: 'Max', title: 'Mkuu & Mmiliki wa Mfumo', role: 'owner',
  language: 'Kiswahili', theme: 'dark', securityPinSet: false, createdAt: new Date().toISOString(),
};
const DEFAULT_AUTO_REPLY_SETTINGS: AutoReplySettings = {
  userId: 'user_max_owner', enabled: true, emergencyStop: false, mode: 'automatic', language: 'Kiswahili',
  tone: 'Heshima & Ueledi', workingHours: { enabled: false, start: '08:00', end: '18:00' }, myPhoneNumber: '',
  phoneVerified: false, smsEnabled: true, gmailEnabled: true, safetyRules: [
    'Usiwahi kutoa nywila (password), PIN ya benki au M-Pesa.',
    'Ujumbe unaotoka kwa nambari zisizojulikana ujibiwe kwa ufupi na kwa heshima bila kutoa ahadi za kifedha.',
    'Ikiwa ujumbe unahusu dharura au pesa nyingi, usitume majibu bila Max kuuthibitisha kwanza.',
  ], whitelistedNumbers: [], blacklistedNumbers: [],
  selectedSimSlot: 'both',
  simCards: [],
  permissions: {
    smsReadSend: true,
    notificationAccess: true,
    exactAlarmReminder: true,
  },
};

class Database {
  private data: DatabaseSchema;
  constructor() { this.data = this.load(); }
  private load(): DatabaseSchema {
    try { if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); }
    catch (e) { console.error('[MKUU-DB] Failed to read database, restoring defaults:', e); }
    const initial: DatabaseSchema = { users: [DEFAULT_OWNER], memories: [], people: [], conversations: [], files: [], autoReplySettings: { [DEFAULT_OWNER.id]: { ...DEFAULT_AUTO_REPLY_SETTINGS } }, autoReplyLogs: [] };
    this.saveData(initial); return initial;
  }
  private saveData(data: DatabaseSchema) { try { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8'); } catch (e) { console.error('[MKUU-DB] Failed to persist database:', e); } }
  public save() { this.saveData(this.data); }
  public getUser(userId: string) { return this.data.users.find(u => u.id === userId || u.email === userId); }
  public getOwner() { return this.data.users.find(u => u.role === 'owner') || DEFAULT_OWNER; }
  public updateUser(userId: string, updates: Partial<UserProfile>) { const i = this.data.users.findIndex(u => u.id === userId); if (i < 0) throw new Error('Mtumiaji hakupatikana'); this.data.users[i] = { ...this.data.users[i], ...updates, id: this.data.users[i].id }; this.save(); return this.data.users[i]; }

  public getMemories(userId: string) { return this.data.memories.filter(m => m.userId === userId); }
  public addMemory(memory: Omit<Memory, 'id'|'createdAt'|'updatedAt'>) { const now = new Date().toISOString(); const item = { ...memory, id: `mem_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, createdAt: now, updatedAt: now }; this.data.memories.unshift(item); this.save(); return item; }
  public updateMemory(id: string, userId: string, updates: Partial<Memory>) { const i = this.data.memories.findIndex(m => m.id === id && m.userId === userId); if (i < 0) return null; this.data.memories[i] = { ...this.data.memories[i], ...updates, updatedAt: new Date().toISOString() }; this.save(); return this.data.memories[i]; }
  public deleteMemory(id: string, userId: string) { const n = this.data.memories.length; this.data.memories = this.data.memories.filter(m => !(m.id === id && m.userId === userId)); this.save(); return this.data.memories.length < n; }

  public getPeople(userId: string) { return this.data.people.filter(p => p.userId === userId); }
  public addPerson(person: Omit<Person, 'id'|'createdAt'|'updatedAt'>) { const now = new Date().toISOString(); const item = { ...person, id: `person_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, createdAt: now, updatedAt: now }; this.data.people.push(item); this.save(); return item; }
  public updatePerson(id: string, userId: string, updates: Partial<Person>) { const i = this.data.people.findIndex(p => p.id === id && p.userId === userId); if (i < 0) return null; this.data.people[i] = { ...this.data.people[i], ...updates, updatedAt: new Date().toISOString() }; this.save(); return this.data.people[i]; }
  public deletePerson(id: string, userId: string) { const n = this.data.people.length; this.data.people = this.data.people.filter(p => !(p.id === id && p.userId === userId)); this.save(); return this.data.people.length < n; }

  public getFiles(userId: string) { return this.data.files.filter(f => f.id.startsWith(`${userId}_`) || f.description?.includes(userId) || true); }
  public addFile(file: GeneratedFileSummary) { this.data.files.unshift(file); this.save(); return file; }
  public getFile(id: string) { return this.data.files.find(f => f.id === id); }
  public getConversations(userId: string) { return this.data.conversations.filter(c => c.userId === userId); }
  public getConversation(id: string, userId: string) { return this.data.conversations.find(c => c.id === id && c.userId === userId); }
  public saveConversation(conversation: Conversation) { const i = this.data.conversations.findIndex(c => c.id === conversation.id && c.userId === conversation.userId); conversation.updatedAt = new Date().toISOString(); if (i >= 0) this.data.conversations[i] = conversation; else this.data.conversations.unshift(conversation); this.save(); return conversation; }
  public deleteConversation(id: string, userId: string) { const n = this.data.conversations.length; this.data.conversations = this.data.conversations.filter(c => !(c.id === id && c.userId === userId)); this.save(); return this.data.conversations.length < n; }

  public getAutoReplySettings(userId: string) {
    if (!this.data.autoReplySettings[userId]) {
      this.data.autoReplySettings[userId] = { ...DEFAULT_AUTO_REPLY_SETTINGS, userId };
    } else {
      this.data.autoReplySettings[userId] = {
        ...DEFAULT_AUTO_REPLY_SETTINGS,
        ...this.data.autoReplySettings[userId],
        permissions: {
          ...DEFAULT_AUTO_REPLY_SETTINGS.permissions,
          ...(this.data.autoReplySettings[userId].permissions || {}),
        },
        simCards: this.data.autoReplySettings[userId].simCards || DEFAULT_AUTO_REPLY_SETTINGS.simCards,
        selectedSimSlot: this.data.autoReplySettings[userId].selectedSimSlot || DEFAULT_AUTO_REPLY_SETTINGS.selectedSimSlot,
      };
    }
    return this.data.autoReplySettings[userId];
  }
  public updateAutoReplySettings(userId: string, updates: Partial<AutoReplySettings>) {
    const current = this.getAutoReplySettings(userId);
    this.data.autoReplySettings[userId] = {
      ...current,
      ...updates,
      userId,
      workingHours: { ...current.workingHours, ...(updates.workingHours || {}) },
      permissions: {
        smsReadSend: updates.permissions?.smsReadSend !== undefined ? !!updates.permissions.smsReadSend : (current.permissions?.smsReadSend ?? true),
        notificationAccess: updates.permissions?.notificationAccess !== undefined ? !!updates.permissions.notificationAccess : (current.permissions?.notificationAccess ?? true),
        exactAlarmReminder: updates.permissions?.exactAlarmReminder !== undefined ? !!updates.permissions.exactAlarmReminder : (current.permissions?.exactAlarmReminder ?? true),
      },
    };
    this.save();
    return this.data.autoReplySettings[userId];
  }
  public getAutoReplyLogs(userId: string) { return this.data.autoReplyLogs.filter(l => l.userId === userId); }
  public addAutoReplyLog(log: Omit<AutoReplyLog, 'id'|'timestamp'>) { const item = { ...log, id: `autoreply_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, timestamp: new Date().toISOString() }; this.data.autoReplyLogs.unshift(item); this.save(); return item; }
  public clearAutoReplyLogs(userId: string) { this.data.autoReplyLogs = this.data.autoReplyLogs.filter(l => l.userId !== userId); this.save(); }

  public resetSystem() { this.data = { users: [DEFAULT_OWNER], memories: [], people: [], conversations: [], files: [], autoReplySettings: { [DEFAULT_OWNER.id]: { ...DEFAULT_AUTO_REPLY_SETTINGS } }, autoReplyLogs: [] }; this.save(); }
}

export const db = new Database();
export { DATA_DIR, FILES_DIR, DB_FILE };
