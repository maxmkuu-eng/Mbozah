import fs from 'node:fs';

const path = 'server.ts';
let source = fs.readFileSync(path, 'utf8');

source = source.replace(
  'const PORT = 10000;',
  'const PORT = Number(process.env.PORT) || 10000;'
);

source = source.replace(
  'await ensureInitialSeedFiles();',
  "ensureInitialSeedFiles().catch((error) => console.error('[MKUU-BACKEND] Seed initialization error:', error));"
);

const oldHealth = "app.get(['/health','/api/health','/api/status','/api/system/status','/api/ping'], async (_req,res)=>{ const health=await geminiService.getHealthStatus(); res.json({status:'ok',service:'MKUU Backend',gemini:'configured',chatModel:health.chatModel||PERSONAL_CHAT_MODEL,backend:health.backend||BACKEND_IDENTIFIER,aiProvider:health.aiProvider||AI_PROVIDER,imageModel:PRIMARY_IMAGE_MODEL,time:new Date().toISOString(),latencyMs:health.latencyMs}); });";
const newHealth = "app.get(['/health','/api/health','/api/status','/api/system/status','/api/ping'], (_req,res)=>{ res.status(200).json({status:'ok',service:'MKUU Backend',gemini:'configured',chatModel:PERSONAL_CHAT_MODEL,backend:BACKEND_IDENTIFIER,aiProvider:AI_PROVIDER,imageModel:PRIMARY_IMAGE_MODEL,time:new Date().toISOString()}); });";

source = source.replace(oldHealth, newHealth);
fs.writeFileSync(path, source);
console.log('Faable startup patch applied.');
