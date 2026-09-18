import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { db, FILES_DIR } from './server/db.js';
import { geminiService, PERSONAL_CHAT_MODEL, AI_PROVIDER, BACKEND_IDENTIFIER } from './server/geminiService.js';
import { imageService, PRIMARY_IMAGE_MODEL, getTempImage } from './server/imageService.js';
import { universalAgent } from './server/agentEngine.js';
import { generateRealFile, ensureInitialSeedFiles } from './server/files.js';
import { searchWeb } from './server/webSearchService.js';
import { getSportDashboard } from './server/sportService.js';
import { getManagerSnapshot, addTask, updateTask, deleteTask, addEvent, updateEvent, deleteEvent, addReminder, updateReminder, deleteReminder, updateSettings, addAction, markReminderDelivered } from './server/assistantManager.js';
import { generateContentWithFallback } from './server/gemini.js';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
  const DEFAULT_USER_ID = 'user_max_owner';
  ensureInitialSeedFiles().catch((error) => console.error('[MKUU-BACKEND] Seed initialization error:', error));
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, x-magic-hour-key, x-gemini-key, *');
    res.header('Access-Control-Expose-Headers', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
  });
  app.use(express.json({ limit:'50mb' }));
  app.use(express.urlencoded({ extended:true, limit:'50mb' }));

  app.get(['/health','/api/health','/api/status','/api/system/status','/api/ping'], (_req,res)=>{ res.status(200).json({status:'ok',service:'MKUU Backend',gemini:'configured',chatModel:PERSONAL_CHAT_MODEL,backend:BACKEND_IDENTIFIER,aiProvider:AI_PROVIDER,imageModel:PRIMARY_IMAGE_MODEL,time:new Date().toISOString()}); });
  app.get(['/api/me','/api/auth/me','/api/user'],(_req,res)=>{const owner=db.getOwner();res.json({...owner,user:owner,authenticated:true,role:'owner',title:'MAX — Mmiliki Aliyeidhinishwa'});});
  app.put(['/api/auth/profile','/api/me','/api/user/profile'],(req,res)=>{try{const updated=db.updateUser(DEFAULT_USER_ID,req.body);res.json({success:true,user:updated,...updated});}catch(e:any){res.status(400).json({error:e.message});}});
  app.post('/api/user/pin',(req,res)=>{try{const {pin}=req.body;const updated=db.updateUser(DEFAULT_USER_ID,{securityPinSet:!!pin,securityPin:pin});res.json({success:true,user:updated});}catch(e:any){res.status(400).json({error:e.message});}});
  app.post('/api/system/reset',(_req,res)=>{try{db.resetSystem();res.json({success:true,message:'Mfumo umerejeshwa katika hali ya msingi.'});}catch(e:any){res.status(500).json({error:e.message});}});

  // AI Assistant Manager: tasks, calendar, reminders, proactive status, Android action intents and settings.
  app.get('/api/manager',(_req,res)=>res.json(getManagerSnapshot(DEFAULT_USER_ID)));
  app.get('/api/manager/tasks',(_req,res)=>res.json(getManagerSnapshot(DEFAULT_USER_ID).tasks));
  app.post('/api/manager/tasks',(req,res)=>{try{res.status(201).json(addTask(DEFAULT_USER_ID,req.body));}catch(e:any){res.status(400).json({error:e.message});}});
  app.patch('/api/manager/tasks/:id',(req,res)=>{const item=updateTask(DEFAULT_USER_ID,req.params.id,req.body);if(!item)return res.status(404).json({error:'Kazi haijapatikana'});res.json(item);});
  app.delete('/api/manager/tasks/:id',(req,res)=>res.json({success:deleteTask(DEFAULT_USER_ID,req.params.id)}));
  app.get('/api/manager/calendar',(_req,res)=>res.json(getManagerSnapshot(DEFAULT_USER_ID).events));
  app.post('/api/manager/calendar',(req,res)=>{try{res.status(201).json(addEvent(DEFAULT_USER_ID,req.body));}catch(e:any){res.status(400).json({error:e.message});}});
  app.patch('/api/manager/calendar/:id',(req,res)=>{const item=updateEvent(DEFAULT_USER_ID,req.params.id,req.body);if(!item)return res.status(404).json({error:'Tukio halijapatikana'});res.json(item);});
  app.delete('/api/manager/calendar/:id',(req,res)=>res.json({success:deleteEvent(DEFAULT_USER_ID,req.params.id)}));
  app.get('/api/manager/reminders',(_req,res)=>res.json(getManagerSnapshot(DEFAULT_USER_ID).reminders));
  app.post('/api/manager/reminders',(req,res)=>{try{res.status(201).json(addReminder(DEFAULT_USER_ID,req.body));}catch(e:any){res.status(400).json({error:e.message});}});
  app.patch('/api/manager/reminders/:id',(req,res)=>{const item=updateReminder(DEFAULT_USER_ID,req.params.id,req.body);if(!item)return res.status(404).json({error:'Reminder haijapatikana'});res.json(item);});
  app.delete('/api/manager/reminders/:id',(req,res)=>res.json({success:deleteReminder(DEFAULT_USER_ID,req.params.id)}));
  app.post('/api/manager/reminders/:id/deliver',(req,res)=>{const item=markReminderDelivered(DEFAULT_USER_ID,req.params.id);if(!item)return res.status(404).json({error:'Reminder haijapatikana'});res.json(item);});
  app.get('/api/manager/settings',(_req,res)=>res.json(getManagerSnapshot(DEFAULT_USER_ID).settings));
  app.put('/api/manager/settings',(req,res)=>res.json(updateSettings(DEFAULT_USER_ID,req.body)));
  app.post('/api/manager/actions',(req,res)=>{try{const {type,label,payload={}}=req.body||{};if(!type||!label)return res.status(400).json({error:'Action type na label vinahitajika'});res.status(201).json(addAction(DEFAULT_USER_ID,{type,label,payload}));}catch(e:any){res.status(400).json({error:e.message});}});

  const processChatRequest = async (req:any) => {
    const {message='',conversationId,conversationHistory=[],isVoice=false,attachments=[],people=[],user}=req.body||{};
    if(!message && (!attachments||attachments.length===0)) throw new Error('Ujumbe au kiambatisho kinahitajika');
    if (Array.isArray(people) && people.length > 0) {
      const existing = db.getPeople(DEFAULT_USER_ID);
      for (const p of people) {
        if (p && p.name && !existing.some(e => e.name.toLowerCase() === p.name.toLowerCase())) {
          db.addPerson({
            userId: DEFAULT_USER_ID,
            name: p.name,
            relationship: p.relationship || 'Mtu wa karibu',
            phone: p.phone,
            email: p.email,
            nickname: p.nickname,
            notes: p.notes,
            avatarColor: p.avatarColor || 'emerald',
          });
        }
      }
    }
    let effectiveHistory=Array.isArray(conversationHistory)&&conversationHistory.length?conversationHistory:[];
    if(!effectiveHistory.length&&conversationId){const stored=db.getConversation(conversationId,DEFAULT_USER_ID);if(stored) effectiveHistory=stored.messages;}
    const result=await geminiService.processChat({userId:DEFAULT_USER_ID,message,conversationHistory:effectiveHistory,isVoice,attachments,user});
    if(conversationId){let c=db.getConversation(conversationId,DEFAULT_USER_ID);const u={id:`msg_${Date.now()}_u`,role:'user' as const,content:message,timestamp:new Date().toISOString(),isVoice,attachments};const a={id:`msg_${Date.now()}_a`,role:'assistant' as const,content:result.reply,timestamp:new Date().toISOString(),generatedFiles:result.generatedFiles,memoryExtracted:result.memoriesExtracted?.map(m=>m.content),personRecognized:result.peopleRecognized?.map(p=>p.name)};if(c){c.messages.push(u,a);db.saveConversation(c);}else{c={id:conversationId,userId:DEFAULT_USER_ID,title:message.slice(0,35)||'Mazungumzo Mapya',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),messages:[u,a]};db.saveConversation(c);}}
    return {reply:result.reply,cleanSpeechText:result.cleanSpeechText,memoriesExtracted:result.memoriesExtracted,peopleRecognized:result.peopleRecognized,generatedFiles:result.generatedFiles,aiProvider:result.aiProvider,chatModel:result.chatModel,latencyMs:result.latencyMs};
  };
  app.post(['/api/chat','/api/chat/'],async(req,res)=>{try{res.json(await processChatRequest(req));}catch(error:any){console.error('[MKUU-BACKEND] Chat API Error:',error);res.status(503).json({error:'GEMINI_UNAVAILABLE',message:error.message||'Google Gemini API Error',aiProvider:AI_PROVIDER,chatModel:PERSONAL_CHAT_MODEL});}});
  app.post('/api/chat/stream',async(req,res)=>{
    res.writeHead(200, {
      'Content-Type':'text/event-stream; charset=utf-8',
      'Cache-Control':'no-cache, no-transform',
      'Connection':'keep-alive',
      'X-Accel-Buffering':'no',
    });
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }
    try {
      const {message='',conversationId,conversationHistory=[],isVoice=false,attachments=[],people=[]}=req.body||{};
      if(!message && (!attachments||attachments.length===0)) throw new Error('Ujumbe au kiambatisho kinahitajika');
      if (Array.isArray(people) && people.length > 0) {
        const existing = db.getPeople(DEFAULT_USER_ID);
        for (const p of people) {
          if (p && p.name && !existing.some(e => e.name.toLowerCase() === p.name.toLowerCase())) {
            db.addPerson({
              userId: DEFAULT_USER_ID,
              name: p.name,
              relationship: p.relationship || 'Mtu wa karibu',
              phone: p.phone,
              email: p.email,
              nickname: p.nickname,
              notes: p.notes,
              avatarColor: p.avatarColor || 'emerald',
            });
          }
        }
      }
      let effectiveHistory=Array.isArray(conversationHistory)&&conversationHistory.length?conversationHistory:[];
      if(!effectiveHistory.length&&conversationId){const stored=db.getConversation(conversationId,DEFAULT_USER_ID);if(stored) effectiveHistory=stored.messages;}
      
      let fullReply = '';
      let doneResult: any = null;
      for await (const packet of geminiService.streamChat({
        userId: DEFAULT_USER_ID,
        message,
        conversationHistory: effectiveHistory,
        isVoice,
        attachments,
        user,
      })) {
        if (packet.type === 'delta') {
          fullReply += packet.text;
          res.write(`data: ${JSON.stringify({ type: 'delta', text: packet.text })}\n\n`);
          if (typeof (res as any).flush === 'function') (res as any).flush();
        } else if (packet.type === 'done') {
          doneResult = packet.result;
          res.write(`data: ${JSON.stringify({ type: 'done', ...packet.result })}\n\n`);
        }
      }

      if (conversationId && fullReply) {
        let c = db.getConversation(conversationId, DEFAULT_USER_ID);
        const u = { id: `msg_${Date.now()}_u`, role: 'user' as const, content: message, timestamp: new Date().toISOString(), isVoice, attachments };
        const a = {
          id: `msg_${Date.now()}_a`,
          role: 'assistant' as const,
          content: fullReply,
          timestamp: new Date().toISOString(),
          generatedFiles: doneResult?.generatedFiles,
          memoryExtracted: doneResult?.memoriesExtracted?.map((m:any)=>m.content),
          personRecognized: doneResult?.peopleRecognized?.map((p:any)=>p.name),
          aiProvider: doneResult?.aiProvider,
          chatModel: doneResult?.chatModel,
        };
        if (c) { c.messages.push(u, a); db.saveConversation(c); }
        else { c = { id: conversationId, userId: DEFAULT_USER_ID, title: message.slice(0, 35) || 'Mazungumzo Mapya', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [u, a] }; db.saveConversation(c); }
      }
      res.end();
    } catch(e:any) {
      console.error('[MKUU-BACKEND] Stream Error:', e);
      res.write(`data: ${JSON.stringify({type:'error',message:e.message||'Google Gemini API Error'})}\n\n`);
      res.end();
    }
  });
  app.post('/api/agent', async (req, res) => {
    try {
      const { message = '', conversationHistory = [], isVoice = false, attachments = [], people = [], apiKey } = req.body || {};
      if (!message && !attachments.length) throw new Error('Ujumbe au kiambatisho kinahitajika');
      res.json({
        success: true,
        ...(await universalAgent.execute({
          userId: DEFAULT_USER_ID,
          message,
          conversationHistory,
          isVoice,
          attachments,
          people,
          apiKey,
        })),
      });
    } catch (e: any) {
      res.status(503).json({
        success: false,
        error: 'GEMINI_UNAVAILABLE',
        message: e.message,
        aiProvider: AI_PROVIDER,
        chatModel: PERSONAL_CHAT_MODEL,
      });
    }
  });
  app.get('/api/sport', async (_req, res) => {
    try { res.json(await getSportDashboard()); }
    catch (e:any) { res.status(503).json({ error: 'SPORT_UNAVAILABLE', message: e?.message || 'Sport data haipatikani kwa sasa.' }); }
  });
  app.post(['/api/search', '/api/web-search'], async (req, res) => {
    try {
      const { query = '', platform, numResults } = req.body || {};
      const result = await searchWeb(query, { platform, numResults });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'AXA search failed' });
    }
  });

  // Temporary image serving for image reference
  app.get('/api/image/temp/:id', (req, res) => {
    const item = getTempImage(req.params.id);
    if (!item) return res.status(404).send('Image expired or not found');
    res.setHeader('Content-Type', item.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=900');
    res.send(item.buffer);
  });

  // Dedicated Magic Hour Studio Image Generation & Editing API
  app.post(['/api/image/edit', '/api/image/generate', '/api/image'], async (req, res) => {
    try {
      const {
        prompt = '',
        imageBase64,
        mimeType = 'image/jpeg',
        filename = 'picha_iliyohaririwa.png',
        aspectRatio = '1:1',
        model,
        apiKey,
      } = req.body || {};

      if (!prompt && !imageBase64) {
        return res.status(400).json({ error: 'Maelekezo au picha inahitajika kwa ajili ya Image Studio' });
      }

      const attachments = imageBase64
        ? [{ filename, fileType: mimeType.includes('png') ? 'png' : 'jpg', mimeType, base64Data: imageBase64 }]
        : [];

      const headerKey = (req.headers['x-magic-hour-key'] as string) || (req.headers['authorization']?.replace(/^Bearer\s+/i, ''));

      const result = await imageService.processImage({
        userId: DEFAULT_USER_ID,
        prompt: prompt || 'Enhance and edit this image with high fidelity and photorealistic details',
        attachments,
        imageBase64,
        aspectRatio,
        model,
        apiKey: apiKey || headerKey,
      });

      res.json({
        success: true,
        reply: result.explanation,
        file: result.file,
        generatedFiles: [result.file],
        modelUsed: result.modelUsed,
      });
    } catch (e: any) {
      console.error('[MKUU-BACKEND] Magic Hour Studio error:', e);
      res.status(500).json({
        success: false,
        error: e.message || 'Hitilafu ya Image Studio kupitia Magic Hour Studio',
      });
    }
  });

  // Device Hardware & Permissions APIs (Dual SIM & Android Permissions)
  app.get('/api/device/sim-cards',(_req,res)=>{
    const s = db.getAutoReplySettings(DEFAULT_USER_ID);
    res.json({ simCards: s.simCards || [], selectedSimSlot: s.selectedSimSlot || 'both' });
  });
  app.post('/api/device/sim-cards',(req,res)=>{
    const { selectedSimSlot, simCards } = req.body || {};
    const updates: any = {};
    if (selectedSimSlot) updates.selectedSimSlot = selectedSimSlot;
    if (Array.isArray(simCards)) updates.simCards = simCards;
    const updated = db.updateAutoReplySettings(DEFAULT_USER_ID, updates);
    res.json({ success: true, selectedSimSlot: updated.selectedSimSlot, simCards: updated.simCards });
  });
  app.get('/api/device/permissions',(_req,res)=>{
    const s = db.getAutoReplySettings(DEFAULT_USER_ID);
    res.json({ permissions: s.permissions || { smsReadSend: true, notificationAccess: true, exactAlarmReminder: true } });
  });
  app.post('/api/device/permissions',(req,res)=>{
    const { permissions } = req.body || {};
    const updated = db.updateAutoReplySettings(DEFAULT_USER_ID, { permissions });
    res.json({ success: true, permissions: updated.permissions });
  });

  app.get('/api/conversations',(_req,res)=>res.json(db.getConversations(DEFAULT_USER_ID)));
  app.get('/api/conversations/:id',(req,res)=>{const c=db.getConversation(req.params.id,DEFAULT_USER_ID);res.json(c||{id:req.params.id,userId:DEFAULT_USER_ID,title:'Mazungumzo Mapya',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),messages:[]});});
  app.post('/api/conversations',(req,res)=>{const {title='Mazungumzo Mapya',messages=[]}=req.body;res.json(db.saveConversation({id:`conv_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,userId:DEFAULT_USER_ID,title,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),messages}));
  });
  app.delete('/api/conversations/:id',(req,res)=>res.json({success:db.deleteConversation(req.params.id,DEFAULT_USER_ID)}));
  app.get('/api/memories',(_req,res)=>res.json(db.getMemories(DEFAULT_USER_ID)));
  app.post('/api/memories',(req,res)=>{const {content,category='General',importance='medium',tags=[],source='manual'}=req.body;if(!content)return res.status(400).json({error:'Kumbukumbu inahitaji maelezo'});res.json(db.addMemory({userId:DEFAULT_USER_ID,content,category,importance,tags,source}));});
  app.put('/api/memories/:id',(req,res)=>{const item=db.updateMemory(req.params.id,DEFAULT_USER_ID,req.body);if(!item)return res.status(404).json({error:'Kumbukumbu haijapatikana'});res.json(item);});
  app.delete('/api/memories/:id',(req,res)=>res.json({success:db.deleteMemory(req.params.id,DEFAULT_USER_ID)}));
  app.get('/api/people',(_req,res)=>res.json(db.getPeople(DEFAULT_USER_ID)));
  app.post('/api/people',(req,res)=>{const {name,nickname,relationship,phone,email,notes,avatarColor}=req.body;if(!name||!relationship)return res.status(400).json({error:'Jina na Uhusiano vinahitajika'});res.json(db.addPerson({userId:DEFAULT_USER_ID,name,nickname,relationship,phone,email,notes,avatarColor:avatarColor||'blue'}));});
  app.put('/api/people/:id',(req,res)=>{const item=db.updatePerson(req.params.id,DEFAULT_USER_ID,req.body);if(!item)return res.status(404).json({error:'Mtu hajapatikana'});res.json(item);});
  app.delete('/api/people/:id',(req,res)=>res.json({success:db.deletePerson(req.params.id,DEFAULT_USER_ID)}));

  app.get('/api/autoreply/settings',(_req,res)=>res.json(db.getAutoReplySettings(DEFAULT_USER_ID)));
  app.put('/api/autoreply/settings',(req,res)=>res.json(db.updateAutoReplySettings(DEFAULT_USER_ID,req.body)));
  app.post('/api/autoreply/settings',(req,res)=>res.json(db.updateAutoReplySettings(DEFAULT_USER_ID,req.body)));
  app.post('/api/autoreply/verify-phone',(req,res)=>{const phoneNumber=String(req.body?.phoneNumber||'').trim();if(!phoneNumber)return res.status(400).json({error:'PHONE_REQUIRED',message:'Nambari ya simu inahitajika.'});const updated=db.updateAutoReplySettings(DEFAULT_USER_ID,{myPhoneNumber:phoneNumber,phoneVerified:true,phoneVerifiedAt:new Date().toISOString()});res.json({success:true,phoneNumber,phoneVerified:true,phoneVerifiedAt:updated.phoneVerifiedAt});});
  app.post('/api/autoreply/remove-phone',(_req,res)=>{const updated=db.updateAutoReplySettings(DEFAULT_USER_ID,{myPhoneNumber:'',phoneVerified:false,phoneVerifiedAt:undefined});res.json({success:true,phoneNumber:'',phoneVerified:false});});
  app.get('/api/autoreply/logs',(_req,res)=>res.json(db.getAutoReplyLogs(DEFAULT_USER_ID)));
  app.delete('/api/autoreply/logs',(_req,res)=>{db.clearAutoReplyLogs(DEFAULT_USER_ID);res.json({success:true});});
  app.post('/api/autoreply/emergency-stop', (req, res) => {
    const current = db.getAutoReplySettings(DEFAULT_USER_ID);
    const currentlyActive = current.enabled && !current.emergencyStop;
    let turnOn: boolean;
    if (req.body?.active !== undefined) {
      turnOn = !!req.body.active;
    } else if (req.body?.stop !== undefined) {
      turnOn = !req.body.stop;
    } else {
      turnOn = !currentlyActive;
    }
    const updated = db.updateAutoReplySettings(DEFAULT_USER_ID, {
      enabled: turnOn,
      smsEnabled: turnOn,
      emergencyStop: !turnOn,
    });
    res.json({
      success: true,
      active: turnOn,
      emergencyStop: updated.emergencyStop,
      enabled: updated.enabled,
      settings: updated,
    });
  });

  // Dedicated SMS Auto Reply Inbound Endpoint (Android APK & Remote Gateway)
  app.post(['/api/sms/inbound', '/api/sms/inbound/'], async (req, res) => {
    try {
      const { sender = '', message = '', conversationHistory = [], contact = {} } = req.body || {};
      const currentSender = String(sender || '').trim();
      const currentMessage = String(message || '').trim();
      if (!currentSender || !currentMessage) {
        return res.status(400).json({ error: 'SMS_REQUIRED', message: 'Namba ya mtumaji na ujumbe vinahitajika.' });
      }

      // Check AutoReply settings to verify if enabled and not stopped
      const settings = db.getAutoReplySettings(DEFAULT_USER_ID);
      const isAutoReplyActive = settings.enabled && !settings.emergencyStop;
      if (!isAutoReplyActive) {
        return res.status(403).json({
          error: 'AUTO_REPLY_OFF',
          message: 'Auto Reply ya SMS imezimwa (Kill switch ipo OFF).',
          active: false,
        });
      }

      // Load persistent memories & people for deep contextual understanding
      const memories = db.getMemories(DEFAULT_USER_ID) || [];
      const memoryContext = memories.slice(-30).map(m => `- ${m.content}`).join('\n');

      const people = db.getPeople(DEFAULT_USER_ID) || [];
      const normSender = currentSender.replace(/\D/g, '');
      const matchedPerson = people.find(p => {
        if (!p.phone) return false;
        const normP = p.phone.replace(/\D/g, '');
        return normP.length >= 7 && (normSender.endsWith(normP) || normP.endsWith(normSender));
      });

      const contactName = matchedPerson?.name || contact?.name || '';
      const relationship = matchedPerson?.relationship || (contactName ? 'Mtu anayefahamika' : 'Haijulikani');
      const notes = matchedPerson?.notes || '';

      const systemInstruction = `Wewe ni MKUU AI, msaidizi rasmi na mwerevu wa Max (Mkuu) unayejibu SMS za simu yake ya mkononi moja kwa moja.
Lengo lako ni kuelewa kikamilifu kile mtumaji anachouliza au kuongea, na kumjibu kwa weledi, heshima, Kiswahili fasaha (au lugha aliyoandika mtumaji) na haraka sana.

MUKTADHA WA MTUMAJI:
- Namba ya Mtumaji: ${currentSender}
${notes ? `- Maelezo ya Ziada: ${notes}` : ''}

KUMBUKUMBU NA DATA ZA MAX:
${memoryContext || '- Max ni mmiliki wa mifumo ya MKUU AI, anajishughulisha na teknolojia za AI na miradi mbalimbali.'}

SHERIA KUU NA ZISIZOVUNJIKA ZA MAJIBU YA SMS:
1. KANUNI YA LAZIMA - BILA KUTAJA JINA LA MTU: KAMWE USITAJE jina la mtu aliyetuma SMS wala usimuite kwa jina lolote la mtu kwenye jibu lako la SMS (mfano: USISEME "Habari Juma", "Habari Mama Asha", "Asante John", wala usitaje jina la mtu aliyetuma ujumbe). Jibu kwa heshima, adabu na ufasaha moja kwa moja bila kutaja jina lake.
2. UELEWA NA MWENDELEZO: Soma kwa makini swali na mada aliyoleta mtumaji. Endeleza mazungumzo kama mwendelezo wa SMS zitakavyoendelea kuingia bila kukata mazungumzo wala kurudia salamu zisizohitajika. Jibu swali lake mara moja au endeleza mada husika kwa uelewa kamili na fasaha.
3. JIBU KAMA BINADAMU MWEREVU: Usijibu kama roboti. Usiseme "Ujumbe wako umepokelewa" au "Nitakujibu baadaye". Jibu ujumbe wenyewe kwa heshima na uadilifu.
4. UREFU WA SMS: Jibu liwe fupi, fasaha na kamili linalotoshea kwenye ujumbe wa kawaida wa SMS ya simu (sentensi 1 hadi 3, maneno 15 hadi 45). Usiongeze maneno marefu mno.
5. DHARURA AU MAAMUZI YA MAX: Kama mtumaji anataka kuwasiliana na Max ana kwa ana, au ni jambo la dharura linalohitaji uamuzi binafsi wa Max, mpe jibu la heshima kuwa umemjulisha Max na atawasiliana naye mara moja, na weka alama hii mwishoni kabisa mwa jibu: [[MKUU_ACTION:CONTACT_OWNER]]
6. BILA FORMATTING: Hii ni SMS ya kawaida ya simu. Kamwe usitumie alama za markdown kama **, ##, au bullet points (*).`;

      const safeHistory = Array.isArray(conversationHistory) ? conversationHistory.slice(-12) : [];
      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

      for (const turn of safeHistory) {
        const text = String(turn?.content || turn?.message || '').trim();
        if (!text) continue;
        const role: 'user' | 'model' = (turn?.role === 'assistant' || turn?.role === 'model') ? 'model' : 'user';
        const prev = contents[contents.length - 1];
        if (prev && prev.role === role) {
          prev.parts.push({ text });
        } else {
          contents.push({ role, parts: [{ text }] });
        }
      }

      if (contents.length > 0 && contents[0].role === 'model') {
        contents.shift();
      }

      const last = contents[contents.length - 1];
      if (last && last.role === 'user') {
        last.parts.push({ text: currentMessage });
      } else {
        contents.push({ role: 'user', parts: [{ text: currentMessage }] });
      }

      const rawReply = await generateContentWithFallback({
        preferredModel: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.5,
          maxOutputTokens: 250,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      const replyText = rawReply.trim();
      const hasAction = replyText.includes('[[MKUU_ACTION:CONTACT_OWNER]]');
      let cleanReply = replyText.replace('[[MKUU_ACTION:CONTACT_OWNER]]', '').trim();

      // Enforce strict user requirement: Never mention the sender's name in the reply
      if (contactName && contactName.trim().length > 1) {
        const escaped = contactName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        cleanReply = cleanReply
          .replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '')
          .replace(/\s{2,}/g, ' ')
          .replace(/,\s*,/g, ',')
          .replace(/^,\s*/, '')
          .trim();
      }

      // Record to auto reply logs in database
      try {
        db.addAutoReplyLog({
          userId: DEFAULT_USER_ID,
          channel: 'sms',
          sender: currentSender,
          senderName: contactName || undefined,
          recipient: 'Max (SIM)',
          incomingMessage: currentMessage,
          generatedReply: cleanReply,
          status: 'sent',
          matchedRelationship: relationship || undefined,
          confidence: 0.98,
        });
      } catch (_) {}

      res.json({
        reply: replyText,
        cleanSpeechText: cleanReply,
        action: hasAction ? 'CONTACT_OWNER' : 'NONE',
        mode: 'sms_autoreply',
      });
    } catch (error: any) {
      console.error('[MKUU-BACKEND] SMS Auto Reply Error:', error);
      res.status(500).json({ error: 'SMS_REPLY_FAILED', message: error?.message || 'Hitilafu ya kutoa jibu la SMS.' });
    }
  });

  app.get('/api/files',(_req,res)=>res.json(db.getFiles(DEFAULT_USER_ID)));
  app.get('/api/files/download/:id',(req,res)=>{const file=db.getFile(req.params.id);if(!file)return res.status(404).json({error:'Faili halijapatikana'});const diskPrefix=`${file.id}_`;const filename=fs.readdirSync(FILES_DIR).find(n=>n.startsWith(diskPrefix));if(!filename)return res.status(404).json({error:'Faili halipo kwenye storage'});res.type(file.mimeType);res.download(path.join(FILES_DIR,filename),file.filename);});
  app.get('/api/stats',(_req,res)=>{const memories=db.getMemories(DEFAULT_USER_ID),people=db.getPeople(DEFAULT_USER_ID),files=db.getFiles(DEFAULT_USER_ID),logs=db.getAutoReplyLogs(DEFAULT_USER_ID),settings=db.getAutoReplySettings(DEFAULT_USER_ID);res.json({totalMemories:memories.length,totalPeople:people.length,totalFiles:files.length,totalAutoReplies:logs.length,emergencyStop:settings.emergencyStop,autoReplyEnabled:settings.enabled,systemHealth:'100% Salama & Imeunganishwa',owner:'Max'});});
  app.all('/api/*',(req,res)=>res.status(404).json({error:`API route ${req.method} ${req.path} not found`}));
  if(process.env.NODE_ENV!=='production'){const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}else{const distPath=path.join(process.cwd(),'dist');app.use(express.static(distPath));app.get('*',(_req,res)=>res.sendFile(path.join(distPath,'index.html')));}
  app.listen(PORT,'0.0.0.0',()=>console.log(`👑 MKUU AI Server is running on port ${PORT}`));
}
startServer();