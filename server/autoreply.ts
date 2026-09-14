import { db, AutoReplyLog, Person } from './db.js';
import { generateContentWithFallback } from './gemini.js';

export interface ProcessInboundMessageParams {
  userId: string;
  channel: 'sms' | 'gmail';
  sender: string; // phone number or email
  message: string;
  recipient?: string;
  simulate?: boolean;
}

export async function processInboundAutoReply(params: ProcessInboundMessageParams): Promise<AutoReplyLog> {
  const { userId, channel, sender, message, recipient = '+255 700 123 456' } = params;
  const settings = db.getAutoReplySettings(userId);
  const people = db.getPeople(userId);
  const memories = db.getMemories(userId);
  const user = db.getUser(userId) || db.getOwner();

  // 1. Check Emergency Killswitch
  if (settings.emergencyStop) {
    return db.addAutoReplyLog({
      userId,
      channel,
      sender,
      recipient,
      incomingMessage: message,
      generatedReply: '[AUTO REPLY BLOCKED: EMERGENCY STOP ACTIVATED BY MAX]',
      status: 'blocked_emergency',
      confidence: 0,
    });
  }

  // 2. Check if Auto Reply is disabled or channel disabled
  if (!settings.enabled || (channel === 'sms' && !settings.smsEnabled) || (channel === 'gmail' && !settings.gmailEnabled)) {
    return db.addAutoReplyLog({
      userId,
      channel,
      sender,
      recipient,
      incomingMessage: message,
      generatedReply: '[AUTO REPLY DISABLED IN SETTINGS]',
      status: 'failed',
      confidence: 0,
    });
  }

  // 3. Match Sender in Max Identify (Watu Wangu wa Karibu)
  const normalizePhoneForMatch = (phone?: string): string => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('255')) return digits.slice(3);
    if (digits.startsWith('0')) return digits.slice(1);
    return digits;
  };

  const normalizedSender = sender.replace(/[\s-]/g, '').toLowerCase();
  const senderPhoneDigits = normalizePhoneForMatch(sender);

  let matchedPerson: Person | undefined = people.find((p) => {
    if (p.phone) {
      const pDigits = normalizePhoneForMatch(p.phone);
      if (pDigits && senderPhoneDigits && (pDigits === senderPhoneDigits || (pDigits.length >= 7 && senderPhoneDigits.length >= 7 && (pDigits.endsWith(senderPhoneDigits) || senderPhoneDigits.endsWith(pDigits))))) {
        return true;
      }
      if (p.phone.replace(/[\s-]/g, '').toLowerCase() === normalizedSender) return true;
    }
    if (p.email && p.email.toLowerCase() === normalizedSender) return true;
    if (p.name && message.toLowerCase().includes(p.name.toLowerCase())) return true;
    if (p.nickname && message.toLowerCase().includes(p.nickname.toLowerCase())) return true;
    return false;
  });

  const senderDisplayName = matchedPerson
    ? `${matchedPerson.name} (${matchedPerson.relationship})`
    : `Mtumaji Asiyejulikana (${sender})`;

  // 4. Generate contextual Auto Reply
  let replyText = '';
  let confidence = 0.95;

  try {
    const prompt = `
Wewe ni mfumo wa MAX AUTO REPLY wa MKUU AI, msaidizi binafsi wa MAX.

TAARIFA ZA MMILIKI (MAX):
- Jina: Max
- Lugha: ${settings.language}
- Mtindo wa Majibu (Tone): ${settings.tone}

TAARIFA ZA MTUMAJI:
- Anwani ya Mtumaji: ${sender}
- Utambuzi (Max Identify): ${matchedPerson ? `Jina: ${matchedPerson.name}, Uhusiano: ${matchedPerson.relationship}, Maelezo: ${matchedPerson.notes || 'Hakuna'}` : 'Mtu huyu hajapangwa kwenye Watu wa Karibu'}

KANUNI ZA USALAMA ZA MAX AUTO REPLY:
${settings.safetyRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

UJUMBE ULIOMFIKIA MAX (${channel.toUpperCase()}):
"${message}"

MAELEKEZO:
1. Andika jibu fupi, zuri na lenye hadhi kwa niaba ya msaidizi wa Max (MKUU AI) au kama jibu rasmi la Max kulingana na uhusiano.
2. Mfahamishe mtumaji kwa upole kwamba ujumbe umepokewa na Max ataufanyia kazi mara moja.
3. Ikiwa mtumaji ni mtu wa karibu (mfano mke, mama, boss), jibu kwa heshima na ukaribu unaostahili hadhi yake.
4. USITOE ahadi zisizothibitishwa au taarifa za siri za kifedha.
5. Lugha ya jibu: ${settings.language === 'Kiswahili' ? 'Kiswahili Fasaha' : 'English / Match Language'}.
`;

    const generated = await generateContentWithFallback({
      preferredModel: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        temperature: 0.6,
      },
    });

    replyText = generated.trim() || getDefaultFallbackReply(matchedPerson, message);
  } catch (error) {
    console.error('Error generating auto-reply after fallbacks:', error);
    replyText = getDefaultFallbackReply(matchedPerson, message);
    confidence = 0.85;
  }

  const finalStatus: AutoReplyLog['status'] = settings.mode === 'approval_required' ? 'pending_approval' : 'sent';

  return db.addAutoReplyLog({
    userId,
    channel,
    sender,
    senderName: senderDisplayName,
    recipient,
    incomingMessage: message,
    generatedReply: replyText,
    status: finalStatus,
    matchedPersonId: matchedPerson?.id,
    matchedRelationship: matchedPerson?.relationship,
    confidence,
  });
}

function getDefaultFallbackReply(person?: Person, incomingMessage?: string): string {
  if (person) {
    if (person.relationship.toLowerCase().includes('mke')) {
      return `Habari, nimepokea ujumbe wako. Max yuko bize kidogo kwa sasa lakini atawasiliana nawe mara moja.`;
    }
    if (person.relationship.toLowerCase().includes('mama')) {
      return `Shikamoo, nimepokea ujumbe wako. Max anashukuru sana na atakupigia punde tu atakapopata nafasi.`;
    }
    if (person.relationship.toLowerCase().includes('boss') || person.relationship.toLowerCase().includes('bosi')) {
      return `Habari, ujumbe wako umepokelewa. Max atapitia taarifa hii na kutoa mrejesho rasmi mara moja.`;
    }
    return `Habari, Max amepokea ujumbe wako na atajibu punde akipata nafasi.`;
  }
  return `Habari, asante kwa ujumbe wako. Nimeupokea kupitia MKUU AI na Max atawasiliana nawe atakapopata nafasi.`;
}
