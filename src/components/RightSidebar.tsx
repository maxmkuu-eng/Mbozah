import React, { useEffect, useState } from 'react';
import {
  Brain,
  Users,
  FolderDown,
  Zap,
  Crown,
  Plus,
  ArrowRight,
  ShieldCheck,
  Volume2,
  Bell,
  Clock,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { Memory, Person, GeneratedFileSummary, AutoReplySettings, ActiveTab } from '../types';

interface ReminderItem {
  id: string;
  title: string;
  remindAt: string;
  repeat: 'none' | 'daily' | 'weekly' | 'monthly';
  enabled: boolean;
}

interface RightSidebarProps {
  memories: Memory[];
  people: Person[];
  files: GeneratedFileSummary[];
  autoReplySettings: AutoReplySettings;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenVoice: () => void;
  onOpenFileGenerator: () => void;
}

const REMINDER_STORAGE_KEY = 'mkuu_alarm_reminders_v1';

export const RightSidebar: React.FC<RightSidebarProps> = ({
  memories,
  people,
  files,
  autoReplySettings,
  setActiveTab,
  onOpenVoice,
  onOpenFileGenerator,
}) => {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [title, setTitle] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [repeat, setRepeat] = useState<ReminderItem['repeat']>('none');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMINDER_STORAGE_KEY);
      if (saved) setReminders(JSON.parse(saved));
    } catch (e) {
      console.warn('[MKUU-REMINDER] Failed to load reminders:', e);
    }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminders)); } catch (e) {
      console.warn('[MKUU-REMINDER] Failed to save reminders:', e);
    }
  }, [reminders]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setReminders((current) => current.map((r) => {
        if (!r.enabled || !r.remindAt) return r;
        const due = new Date(r.remindAt).getTime();
        if (!Number.isFinite(due) || due > now) return r;

        try {
          if (typeof window !== 'undefined' && (window as any).MkuuDevice?.showNotification) {
            (window as any).MkuuDevice.showNotification('MKUU AI — Alarm / Reminder', r.title);
          }
        } catch (_) {}

        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('MKUU AI — Alarm / Reminder', { body: r.title });
          }
        } catch (_) {}

        try {
          const audio = new Audio('/notification.mp3');
          audio.play().catch(() => {});
        } catch (_) {}

        if (r.repeat === 'none') return { ...r, enabled: false };
        const next = new Date(r.remindAt);
        if (r.repeat === 'daily') next.setDate(next.getDate() + 1);
        if (r.repeat === 'weekly') next.setDate(next.getDate() + 7);
        if (r.repeat === 'monthly') next.setMonth(next.getMonth() + 1);
        return { ...r, remindAt: next.toISOString() };
      }));
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const requestNotifications = async () => {
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    } catch (_) {}
  };

  const addReminder = async () => {
    if (!title.trim() || !remindAt) return;
    await requestNotifications();
    const item: ReminderItem = {
      id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: title.trim(),
      remindAt: new Date(remindAt).toISOString(),
      repeat,
      enabled: true,
    };
    setReminders((prev) => [item, ...prev]);
    setTitle('');
    setRemindAt('');
    setRepeat('none');
    setShowReminderForm(false);
  };

  const toggleReminder = (id: string) => {
    setReminders((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const deleteReminder = (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const formatReminderTime = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('sw-TZ', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <aside className="hidden xl:flex flex-col w-64 2xl:w-72 flex-shrink-0 bg-[#050505] border-l border-[#222222] h-full overflow-y-auto p-4 2xl:p-6 space-y-5 2xl:space-y-6 text-[#F5F2ED]">
      <div className="glass p-4 rounded-2xl border-l-2 border-[#D4AF37] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Crown className="w-4 h-4 text-[#D4AF37]" />
            <span className="serif text-xs font-bold text-[#D4AF37] tracking-wider">MMILIKI: MAX</span>
          </div>
          <span className="status-dot text-emerald-500 bg-emerald-500" />
        </div>
        <p className="text-[11px] text-[#888888] leading-relaxed">MKUU AI anafanya kazi kwa uelewa kamili wa data zako.</p>
        <button onClick={onOpenVoice} className="w-full py-2 px-3 rounded-xl bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#D4AF37] border border-[#D4AF37]/30 text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer">
          <Volume2 className="w-3.5 h-3.5" /><span>Washa Sauti ya Mkuu</span>
        </button>
      </div>

      {/* ALARM & REMINDER — restored */}
      <section className="glass rounded-2xl p-3.5 border border-[#D4AF37]/25">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="text-[10px] uppercase tracking-[0.22em] text-[#D4AF37] font-bold">Alarm & Reminder</h3>
          </div>
          <button onClick={() => { requestNotifications(); setShowReminderForm((v) => !v); }} className="p-1.5 rounded-lg bg-[#D4AF37]/15 text-[#D4AF37] hover:bg-[#D4AF37]/25" title="Ongeza reminder">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {showReminderForm && (
          <div className="space-y-2.5 mb-3 p-2.5 rounded-xl bg-white/[0.03] border border-[#222222]">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Jina la alarm/reminder" className="w-full rounded-lg bg-[#111217] border border-[#2a2b32] px-2.5 py-2 text-xs text-white outline-none focus:border-[#D4AF37]/60" />
            <input type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} className="w-full rounded-lg bg-[#111217] border border-[#2a2b32] px-2.5 py-2 text-xs text-white outline-none focus:border-[#D4AF37]/60" />
            <select value={repeat} onChange={(e) => setRepeat(e.target.value as ReminderItem['repeat'])} className="w-full rounded-lg bg-[#111217] border border-[#2a2b32] px-2.5 py-2 text-xs text-white outline-none">
              <option value="none">Mara moja</option>
              <option value="daily">Kila siku</option>
              <option value="weekly">Kila wiki</option>
              <option value="monthly">Kila mwezi</option>
            </select>
            <div className="flex gap-2">
              <button onClick={addReminder} className="flex-1 rounded-lg bg-[#D4AF37] text-black py-2 text-xs font-bold">Hifadhi</button>
              <button onClick={() => setShowReminderForm(false)} className="rounded-lg bg-white/5 border border-[#2a2b32] px-3 py-2 text-xs">Funga</button>
            </div>
          </div>
        )}

        {reminders.length === 0 ? (
          <button onClick={() => setShowReminderForm(true)} className="w-full rounded-xl border border-dashed border-[#33343b] py-3 text-[11px] text-[#888] hover:text-[#D4AF37] hover:border-[#D4AF37]/40 transition">
            Hakuna alarm. Bonyeza + kuweka reminder.
          </button>
        ) : (
          <div className="space-y-2">
            {reminders.slice(0, 5).map((r) => (
              <div key={r.id} className={`rounded-xl border p-2.5 ${r.enabled ? 'border-[#D4AF37]/25 bg-[#D4AF37]/5' : 'border-[#292a30] bg-white/[0.02] opacity-60'}`}>
                <div className="flex items-start gap-2">
                  <Clock className="w-3.5 h-3.5 mt-0.5 text-[#D4AF37] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{r.title}</p>
                    <p className="text-[10px] text-[#999] mt-0.5">{formatReminderTime(r.remindAt)} · {r.repeat === 'none' ? 'Mara moja' : r.repeat === 'daily' ? 'Kila siku' : r.repeat === 'weekly' ? 'Kila wiki' : 'Kila mwezi'}</p>
                  </div>
                  <button onClick={() => toggleReminder(r.id)} className="text-[#D4AF37]" title={r.enabled ? 'Zima' : 'Washa'}>
                    {r.enabled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => deleteReminder(r.id)} className="text-red-400 hover:text-red-300" title="Futa"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
            {reminders.length > 5 && <p className="text-[10px] text-[#777] text-center">+ {reminders.length - 5} nyingine</p>}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] uppercase tracking-[0.3em] text-[#888888]">Max Memory ({memories.length})</h3>
          <button onClick={() => setActiveTab('memory')} className="text-[10px] text-[#888888] hover:text-[#D4AF37] flex items-center gap-0.5 cursor-pointer"><span>Zote</span><ArrowRight className="w-3 h-3" /></button>
        </div>
        <div className="space-y-2.5">
          {memories.slice(0, 2).map((m, idx) => (
            <div key={m.id} onClick={() => setActiveTab('memory')} className={`3d-card glass p-3 rounded-xl text-xs cursor-pointer hover:border-[#D4AF37]/40 transition ${idx === 0 ? 'border-l-2 border-[#D4AF37]' : ''}`}>
              <p className="text-[#888888] text-[10px] mb-1 italic">Kumbukumbu • {m.category}</p>
              <p className="text-[#F5F2ED] line-clamp-2 leading-relaxed">{m.content}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] uppercase tracking-[0.3em] text-[#888888]">Watu Wangu ({people.length})</h3>
          <button onClick={() => setActiveTab('people')} className="text-[10px] text-[#888888] hover:text-[#D4AF37] flex items-center gap-0.5 cursor-pointer"><span>Orodha</span><ArrowRight className="w-3 h-3" /></button>
        </div>
        {people.length > 0 && (
          <div className="glass p-4 rounded-2xl border-l-2 border-[#D4AF37] space-y-2.5">
            <div className="flex items-center space-x-3"><div className="w-9 h-9 rounded-full bg-[#111111] border border-[#222222] overflow-hidden flex items-center justify-center font-bold text-xs text-[#D4AF37]">{people[0].name.slice(0, 2).toUpperCase()}</div><div><p className="text-xs font-bold text-[#F5F2ED]">{people[0].name}</p><p className="text-[10px] text-[#D4AF37] font-medium">{people[0].relationship}</p></div></div>
            {people[0].phone && <p className="text-[10px] text-[#888888]">📞 {people[0].phone}</p>}
            {people[0].email && <p className="text-[10px] text-[#888888]">📧 {people[0].email}</p>}
            <button onClick={() => setActiveTab('people')} className="w-full mt-2 py-1.5 border border-red-900/30 text-[10px] uppercase tracking-widest text-red-400 rounded-lg bg-red-500/5 hover:bg-red-500/10 transition cursor-pointer">Futa au Badili Mtu</button>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-[10px] uppercase tracking-[0.3em] text-[#888888] mb-3">Auto Reply</h3>
        <div onClick={() => setActiveTab('autoreply')} className="flex items-center justify-between glass p-3.5 rounded-xl cursor-pointer hover:border-[#D4AF37]/30 transition">
          <div><span className="text-xs font-bold text-[#F5F2ED] tracking-wider block">KILL SWITCH / STATUS</span><span className="text-[10px] text-[#888888]">{autoReplySettings.enabled && !autoReplySettings.emergencyStop ? 'ON — Active & Replying' : 'OFF — Disabled'}</span></div>
          <div className={`w-10 h-5 rounded-full relative transition-colors ${autoReplySettings.enabled && !autoReplySettings.emergencyStop ? 'bg-emerald-500' : 'bg-red-900/60'}`}><div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${autoReplySettings.enabled && !autoReplySettings.emergencyStop ? 'right-0.5 bg-white' : 'left-0.5 bg-white'}`} /></div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3"><h3 className="text-[10px] uppercase tracking-[0.3em] text-[#888888]">Faili Halisi ({files.length})</h3><button onClick={() => setActiveTab('files')} className="text-[10px] text-[#888888] hover:text-[#D4AF37] flex items-center gap-0.5 cursor-pointer"><span>Vault</span><ArrowRight className="w-3 h-3" /></button></div>
        <button onClick={onOpenFileGenerator} className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-[#F5F2ED] border border-[#222222] hover:border-[#D4AF37]/40 text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer"><Plus className="w-3.5 h-3.5 text-[#D4AF37]" /><span>Tengeneza PDF / Excel</span></button>
      </section>

      <div className="p-3 rounded-xl glass border border-[#222222] flex items-center space-x-2 text-[10px] text-[#888888] mt-auto"><ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span>Data za Max zinalindwa na hazitoki kwenye seva.</span></div>
    </aside>
  );
};
export default RightSidebar;
