import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  Edit3,
  Phone,
  Mail,
  UserCheck,
  Search,
  MessageSquare,
  AlertTriangle,
  ExternalLink,
  Eye,
  Sparkles,
  Info,
  Menu,
  ArrowLeft,
} from 'lucide-react';
import { Person } from '../types';

interface PeopleCenterProps {
  people: Person[];
  onAddPerson: (person: Omit<Person, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onEditPerson: (id: string, updates: Partial<Person>) => Promise<void>;
  onDeletePerson: (id: string) => Promise<void>;
  onSimulateMessage: (sender: string, message: string) => void;
  onAskAboutPerson: (query: string) => void;
  onBack?: () => void;
  onToggleMenu?: () => void;
}

export const PeopleCenter: React.FC<PeopleCenterProps> = ({
  people,
  onAddPerson,
  onEditPerson,
  onDeletePerson,
  onSimulateMessage,
  onAskAboutPerson,
  onBack,
  onToggleMenu,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRelation, setSelectedRelation] = useState('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [viewingPerson, setViewingPerson] = useState<Person | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New person state
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [relationship, setRelationship] = useState('Mke wangu');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [avatarColor, setAvatarColor] = useState('gold');

  const relationshipsList = [
    'All',
    'Mke wangu',
    'Mume wangu',
    'Mama yangu',
    'Baba yangu',
    'Kaka yangu',
    'Dada yangu',
    'Mtoto wangu',
    'Boss',
    'Rafiki yangu',
    'Colleague',
  ];

  const filteredPeople = people.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.relationship.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.nickname && p.nickname.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.notes && p.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRel = selectedRelation === 'All' || p.relationship.toLowerCase().includes(selectedRelation.toLowerCase());
    return matchesSearch && matchesRel;
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !relationship.trim()) return;

    await onAddPerson({
      userId: 'user_max_owner',
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      relationship: relationship.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
      avatarColor,
    });

    setName('');
    setNickname('');
    setPhone('');
    setEmail('');
    setNotes('');
    setIsAddModalOpen(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerson || !editingPerson.name.trim()) return;

    await onEditPerson(editingPerson.id, editingPerson);
    setEditingPerson(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#080808] space-y-6 text-[#F5F2ED]">
      {/* Top Navigation Bar with Menu & Back to Chat */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#222222]">
        <div className="flex items-center space-x-2">
          {onToggleMenu && (
            <button
              id="people-toggle-menu-btn"
              onClick={onToggleMenu}
              className="p-2 rounded-xl bg-[#14151a] hover:bg-[#1f2027] border border-[#282a33] text-[#c4c7c5] hover:text-white transition cursor-pointer"
              title="Fungua Menyu"
            >
              <Menu className="w-5 h-5 text-[#f0f4f9]" />
            </button>
          )}
          {onBack && (
            <button
              id="people-back-btn"
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
          id="people-quick-add-btn"
          onClick={() => setIsAddModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition cursor-pointer shadow-md"
        >
          <UserPlus className="w-4 h-4 stroke-[2.5]" />
          <span>ONGEZA MTU</span>
        </button>
      </div>

      {/* Header Banner */}
      <div className="glass p-6 sm:p-8 rounded-3xl border border-[#222222] relative overflow-hidden shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] uppercase font-bold tracking-[0.2em]">
              <Users className="w-3.5 h-3.5" />
              <span>MAX IDENTIFY • WATU WANGU WA KARIBU</span>
            </div>
            <h2 className="serif text-xl sm:text-3xl font-bold text-[#F5F2ED] tracking-wide">
              Watu wa Karibu na Uhusiano wao na Max
            </h2>
            <p className="text-xs sm:text-sm text-[#888888] max-w-2xl leading-relaxed">
              Mifumo ya MKUU AI hutambua watu hawa kiotomatiki wakati wa mazungumzo na wakati wa majibu ya moja kwa
              moja ya SMS na Gmail kulingana na uhusiano wao na heshima inayostahili.
            </p>
          </div>

          <button
            id="add-person-top-btn"
            onClick={() => setIsAddModalOpen(true)}
            className="px-5 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg transition flex-shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 stroke-[2.5]" />
            <span>ONGEZA MTU WA KARIBU</span>
          </button>
        </div>
      </div>

      {/* Recognition Demonstration Quick Actions */}
      <div className="glass p-4 rounded-2xl border border-[#222222] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#F5F2ED]">Jaribu Utambuzi kwenye Chat</div>
            <div className="text-[11px] text-[#888888]">Gusa ili kumwuliza Mkuu AI akuthibitishie mtu aliyepo</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {people.slice(0, 3).map((p) => (
            <button
              key={p.id}
              onClick={() => onAskAboutPerson(`Unamjua ${p.relationship} (${p.name})?`)}
              className="px-3 py-1.5 rounded-lg glass hover:bg-white/5 text-[#888888] hover:text-[#F5F2ED] border border-[#222222] text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
            >
              <span>"Unamjua {p.relationship}?"</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#888888] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="people-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tafuta jina, namba, uhusiano..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {relationshipsList.map((rel) => (
            <button
              key={rel}
              onClick={() => setSelectedRelation(rel)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedRelation === rel
                  ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40'
                  : 'glass text-[#888888] border border-[#222222] hover:text-[#F5F2ED]'
              }`}
            >
              {rel}
            </button>
          ))}
        </div>
      </div>

      {/* People Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPeople.length === 0 ? (
          <div className="col-span-full py-12 text-center text-[#888888]">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-30 text-[#D4AF37]" />
            <p className="text-sm font-semibold text-[#F5F2ED]">Hakuna mtu aliyepatikana kwenye orodha.</p>
            <p className="text-xs text-[#888888] mt-1">Gusa 'Ongeza Mtu wa Karibu' kuweka taarifa zake.</p>
          </div>
        ) : (
          filteredPeople.map((person) => (
            <div
              key={person.id}
              className="3d-card glass p-5 rounded-2xl border border-[#222222] border-l-2 border-[#D4AF37] hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Person Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-[#111111] border border-[#222222] flex items-center justify-center font-bold text-[#D4AF37] text-xs shadow-md">
                      {person.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="serif font-bold text-[#F5F2ED] text-base leading-tight">
                        {person.name}
                      </h4>
                      {person.nickname && (
                        <p className="text-xs text-[#888888] italic">"{person.nickname}"</p>
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37] uppercase tracking-wider">
                    {person.relationship}
                  </span>
                </div>

                {/* Contact details */}
                <div className="space-y-1 text-xs text-[#888888]">
                  {person.phone && (
                    <div className="flex items-center space-x-2 text-[#F5F2ED]/90">
                      <Phone className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span className="font-mono text-xs">{person.phone}</span>
                    </div>
                  )}
                  {person.email && (
                    <div className="flex items-center space-x-2 text-[#F5F2ED]/90">
                      <Mail className="w-3.5 h-3.5 text-[#888888]" />
                      <span className="text-xs">{person.email}</span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {person.notes && (
                  <div className="p-2.5 rounded-xl bg-[#050505] border border-[#222222] text-xs text-[#888888] leading-relaxed italic">
                    "{person.notes}"
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-[#222222] flex flex-wrap items-center justify-between gap-2">
                <button
                  id={`open-person-${person.id}`}
                  onClick={() => setViewingPerson(person)}
                  className="px-3 py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5 transition cursor-pointer shadow-md"
                  title="Fungua Profaili Kamili"
                >
                  <Eye className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>OPEN</span>
                </button>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => setEditingPerson(person)}
                    className="px-2.5 py-1.5 rounded-lg glass hover:bg-white/10 text-[#F5F2ED] border border-[#222222] text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
                    title="Hariri Taarifa"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>EDIT</span>
                  </button>

                  {/* Explicit Mandatory [ FUTA MTU ] button matching theme */}
                  <button
                    id={`delete-person-${person.id}`}
                    onClick={() => setDeletingId(person.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1 transition cursor-pointer"
                    title="Futa Mtu Kabisa Kwenye Database"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>FUTA MTU</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* VIEW PERSON FULL PROFILE MODAL (OPEN) */}
      {viewingPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl bg-[#0d0d0d] border border-[#222222] p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-2xl bg-[#111111] border border-[#D4AF37]/40 flex items-center justify-center font-bold text-[#D4AF37] text-lg shadow-lg">
                  {viewingPerson.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="serif font-bold text-xl text-[#F5F2ED] leading-tight">
                    {viewingPerson.name}
                  </h3>
                  {viewingPerson.nickname && (
                    <p className="text-xs text-[#888888] italic">"{viewingPerson.nickname}"</p>
                  )}
                  <span className="inline-block mt-1 text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37] uppercase tracking-wider">
                    {viewingPerson.relationship}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setViewingPerson(null)}
                className="text-[#888888] hover:text-[#F5F2ED] p-2 cursor-pointer text-lg"
              >
                ✕
              </button>
            </div>

            {/* Profile Contact Details */}
            <div className="p-4 rounded-2xl bg-[#050505] border border-[#222222] space-y-3">
              <div className="flex items-center justify-between text-xs py-1 border-b border-[#1a1a1a]">
                <span className="text-[#888888] flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#D4AF37]" />
                  <span>Nambari ya Simu:</span>
                </span>
                <span className="font-mono text-[#F5F2ED] font-semibold">
                  {viewingPerson.phone || 'Haijawekwa'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs py-1 border-b border-[#1a1a1a]">
                <span className="text-[#888888] flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#D4AF37]" />
                  <span>Barua Pepe (Email):</span>
                </span>
                <span className="text-[#F5F2ED]">
                  {viewingPerson.email || 'Haijawekwa'}
                </span>
              </div>

              <div className="text-xs py-1">
                <span className="text-[#888888] flex items-center gap-2 mb-1.5">
                  <Info className="w-4 h-4 text-[#D4AF37]" />
                  <span>Maelezo & Kumbukumbu (Notes):</span>
                </span>
                <div className="p-3 rounded-xl bg-[#111111] border border-[#222222] text-[#F5F2ED] italic leading-relaxed">
                  "{viewingPerson.notes || 'Hakuna maelezo ya ziada yaliyohifadhiwa kwa mtu huyu.'}"
                </div>
              </div>
            </div>

            {/* Direct Interactive Actions */}
            <div className="space-y-2.5">
              <div className="text-[10px] uppercase tracking-wider text-[#888888] font-bold">
                Vitendo vya Moja kwa Moja (Instant Actions)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    const personRef = viewingPerson;
                    setViewingPerson(null);
                    onSimulateMessage(personRef.phone || personRef.name, `Habari Max, niaje leo?`);
                  }}
                  className="p-3 rounded-xl bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#D4AF37] border border-[#D4AF37]/40 text-xs font-bold flex items-center justify-center space-x-2 transition cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Jaribu SMS Auto Reply</span>
                </button>

                <button
                  onClick={() => {
                    const personRef = viewingPerson;
                    setViewingPerson(null);
                    onAskAboutPerson(`Unamfahamu ${personRef.name} ambaye ni ${personRef.relationship}? Nieleze taarifa zake.`);
                  }}
                  className="p-3 rounded-xl glass hover:bg-white/10 text-[#F5F2ED] border border-[#222222] text-xs font-bold flex items-center justify-center space-x-2 transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                  <span>Uliza Mkuu AI Kumhusu</span>
                </button>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="pt-3 border-t border-[#222222] flex items-center justify-between">
              <button
                onClick={() => {
                  const toDelete = viewingPerson;
                  setViewingPerson(null);
                  setDeletingId(toDelete.id);
                }}
                className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>FUTA MTU</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    const toEdit = viewingPerson;
                    setViewingPerson(null);
                    setEditingPerson(toEdit);
                  }}
                  className="px-4 py-2 rounded-xl glass hover:bg-white/10 text-[#F5F2ED] border border-[#222222] text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>EDIT</span>
                </button>

                <button
                  onClick={() => setViewingPerson(null)}
                  className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-md"
                >
                  Funga
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Person Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-2xl bg-[#0d0d0d] border border-[#222222] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="serif font-bold text-base text-[#F5F2ED] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#D4AF37]" />
                <span>Ongeza Mtu wa Karibu (Max Identify)</span>
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-[#888888] hover:text-[#F5F2ED] cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#F5F2ED] mb-1">Jina Kamili *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Mfano: Jina la mtu"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#F5F2ED] mb-1">Jina la Utani (Nickname)</label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Mfano: Jina la utani / jina fupi"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#F5F2ED] mb-1">Uhusiano na Max *</label>
                  <input
                    type="text"
                    required
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    placeholder="Mke wangu, Mama, Boss..."
                    className="w-full px-3.5 py-2 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#F5F2ED] mb-1">Nambari ya Simu</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+255 7..."
                    className="w-full px-3.5 py-2 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#F5F2ED] mb-1">Barua Pepe (Email)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="mfano@gmail.com"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#F5F2ED] mb-1">Maelezo Muhimu (Notes)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Maelezo maalum, siku ya kuzaliwa, namna ya kumjibu..."
                  className="w-full px-3.5 py-2 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl glass text-[#888888] hover:text-[#F5F2ED] text-xs font-bold border border-[#222222] cursor-pointer"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider shadow-lg cursor-pointer"
                >
                  HIFADHI KWENYE DATABASE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Person Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl bg-[#0d0d0d] border border-red-900/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="serif font-bold text-white text-base">Thibitisha Kufuta Mtu?</h3>
                <p className="text-xs text-[#888888]">Rekodi itafutwa moja kwa moja kwenye Watu Wangu wa Karibu.</p>
              </div>
            </div>

            <p className="text-xs text-[#888888] leading-relaxed">
              Baada ya kumfuta mtu huyu, MKUU AI hataweza tena kumtambua wala kumtaja kwa uhusiano wake kwenye
              mazungumzo mapya au kwenye Auto Reply.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 rounded-xl glass text-[#888888] hover:text-[#F5F2ED] text-xs font-bold border border-[#222222] cursor-pointer"
              >
                Ghairi
              </button>
              <button
                id="confirm-delete-person-btn"
                onClick={async () => {
                  await onDeletePerson(deletingId);
                  setDeletingId(null);
                }}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg cursor-pointer"
              >
                FUTA KABISA (DELETE PERSON)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default PeopleCenter;
