import { db } from './db.js';
import { geminiService } from './geminiService.js';

export async function runDiagnostics() {
  const started = Date.now();
  let gemini: any = { status: 'unknown' };
  try {
    gemini = await geminiService.getHealthStatus();
  } catch (error: any) {
    gemini = { status: 'unavailable', error: error?.message || String(error) };
  }
  const owner = db.getOwner();
  const people = db.getPeople(owner.id);
  const memories = db.getMemories(owner.id);
  const files = db.getFiles(owner.id);
  return {
    status: gemini.status === 'connected' || gemini.status === 'configured' ? 'ok' : 'degraded',
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    backend: 'MKUU Server',
    gemini,
    storage: { owner: !!owner, people: people.length, memories: memories.length, files: files.length },
    capabilities: {
      chat: true,
      streaming: true,
      images: true,
      documents: true,
      spreadsheets: true,
      memory: true,
      peopleContext: true,
      autoReply: true,
      emergencyStop: true,
    },
  };
}
