// MKUU AI - Single live web-search provider: AXA
// No Tavily fallback. Specialist queries are isolated to their requested source/category.

import { resolveStadium } from './sportService.js';

export const WEB_SEARCH_PROVIDER = 'AXA Live Web Search';
const AXA_SEARCH_ENDPOINT = 'https://api.exa.ai/search';

export type SocialPlatform = 'facebook' | 'tiktok' | 'instagram' | 'youtube' | 'web';
export interface SearchSourceCard { title:string; url:string; snippet:string; summary?:string; text?:string; publishedDate?:string; sourceDomain:string; favicon:string; platform?:SocialPlatform; }
export interface SearchQueryResult { query:string; enabled:boolean; provider:string; status:'ok'|'disabled'|'error'; sources:SearchSourceCard[]; message?:string; timestamp:string; results:SearchSourceCard[]; socialTargeted?:boolean; }
export interface LiveWebSearchProvider { name:string; search(query:string, options?:SearchWebOptions):Promise<SearchQueryResult>; }
export interface SearchWebOptions { news?:boolean; numResults?:number; includeDomains?:string[]; platform?:'facebook'|'tiktok'|'instagram'|'youtube'|'all-social'|'web'; }

const BBC=['bbc.com','bbc.co.uk'];
const ALJAZEERA=['aljazeera.com'];
const WAR_NEWS=['bbc.com','bbc.co.uk','aljazeera.com','reuters.com','apnews.com','theguardian.com','dw.com','france24.com'];
const DEATH_NEWS=['bbc.com','bbc.co.uk','aljazeera.com','reuters.com','apnews.com','thecitizen.co.tz','theguardian.com'];
const POLITICS_NEWS=['bbc.com','bbc.co.uk','reuters.com','apnews.com','aljazeera.com','thecitizen.co.tz','theguardian.com','dw.com','france24.com'];
const COURT_NEWS=['bbc.com','bbc.co.uk','reuters.com','apnews.com','aljazeera.com','thecitizen.co.tz','theguardian.com','dw.com','france24.com'];
const ARTIST_SCANDAL_NEWS=['bbc.com','bbc.co.uk','reuters.com','apnews.com','aljazeera.com','thecitizen.co.tz','theguardian.com','musicinafrica.net','billboard.com','rollingstone.com','bongo5.com','millardayo.com'];
// Football whitelist: only the four sources requested by the app owner.
const FOOTBALL=['fotmob.com','livescore.com','azamtv.co.tz','azamtv.com'];
const TZ_FOOTBALL=['fotmob.com','livescore.com','azamtv.co.tz','azamtv.com'];
const ENTERTAINMENT=['musicinafrica.net','allafrica.com','billboard.com','rollingstone.com','youtube.com'];
const TZ_ENTERTAINMENT=['musicinafrica.net','allafrica.com','bongo5.com','millardayo.com','thecitizen.co.tz','youtube.com'];

function hasAny(v:string, words:string[]){const x=v.toLowerCase();return words.some(w=>x.includes(w.toLowerCase()));}
function isDeath(q:string){return hasAny(q,['kifo','amefariki','alifariki','afariki','death','died','dead','passed away','mazishi','msiba','anazikwa','amekufa','burial','buried','funeral','laid to rest']);}
function isWar(q:string){return hasAny(q,['vita','war','wars','conflict','migogoro','ukraine','russia','gaza','israel','palestine','sudan','congo','drc','ceasefire','fighting','mapigano','mzozo']);}
function isPolitics(q:string){return hasAny(q,['siasa','politics','political','election','elections','uchaguzi','president','rais','presidential','government','serikali','minister','waziri','parliament','bunge','mp','senator','party','chama cha siasa','opposition','opposition party','campaign','kampeni','vote','kura','cabinet']);}
function isCourt(q:string){return hasAny(q,['kesi','case','court','mahakama','lawsuit','trial','hearing','appeal','appealed','charged','charge','mashtaka','accused','alleged','arrested','arrest','kukamatwa','amekamatwa','detained','detention','kizuizini','imprisoned','imprisonment','jailed','jail','prison','kifungo','kufungwa','sentenced','sentence','hukumiwa','amehukumiwa','convicted','conviction','guilty','hatia']);}
function isArtistScandal(q:string){return hasAny(q,['scandal','skendo','skendo za wasanii','controversy','controversy','drama','allegation','allegations','tuhuma','kashfa','msanii amekamatwa','msanii kafungwa','msanii amehukumiwa','artist arrested','artist charged','artist convicted','artist jailed']);}
function isFootball(q:string){return hasAny(q,['yanga','young africans','simba','simba sc','azam','mechi','mchezo','matokeo','score','live score','live scores','fixture','fixtures','ratiba','msimamo','standings','football','mpira','soka','ligi kuu','premier league','champions league','next match','mchezo ujao','anacheza na nani','wanacheza na nani']);}
function isEntertainment(q:string){return hasAny(q,['msanii','wasanii','artist','artists','celebrity','burudani','muziki','music','wimbo','nyimbo','song','songs','album','albamu','bongo flava','singeli','diamond','harmonize','alikiba','zuchu','rayvanny','burna boy','wizkid','davido','taylor swift','drake']);}
function isTanzania(q:string){return hasAny(q,['tanzania','tz','tanzanian','yanga','young africans','simba','simba sc','azam','bongo flava','singeli','wasanii wa tanzania','msanii wa tanzania']);}
function isYanga(q:string){return hasAny(q,['yanga','young africans']);}

type SearchCategory='bbc'|'aljazeera'|'death'|'war'|'politics'|'court'|'artist-scandal'|'football'|'entertainment'|'general';
function categoryFor(q:string,o:SearchWebOptions):SearchCategory{
 const x=q.toLowerCase();
 if(hasAny(x,['bbc']))return'bbc';
 if(hasAny(x,['al jazeera','aljazeera']))return'aljazeera';
 // Explicit legal/arrest/conviction/scandal topics must be classified before generic entertainment.
 if(isArtistScandal(x))return'artist-scandal';
 if(isCourt(x))return'court';
 if(isPolitics(x))return'politics';
 if(isDeath(x))return'death';
 if(isWar(x))return'war';
 if(isFootball(x))return'football';
 if(isEntertainment(x))return'entertainment';
 if(o.news||hasAny(x,['habari','news','breaking','taarifa','latest','current']))return'war';
 return'general';
}
function domainsFor(q:string,c:SearchCategory):string[]|undefined{
 if(c==='bbc')return BBC;if(c==='aljazeera')return ALJAZEERA;if(c==='death')return DEATH_NEWS;if(c==='war')return WAR_NEWS;
 if(c==='politics')return POLITICS_NEWS;if(c==='court')return COURT_NEWS;if(c==='artist-scandal')return ARTIST_SCANDAL_NEWS;
 if(c==='football')return isTanzania(q)?TZ_FOOTBALL:FOOTBALL;
 if(c==='entertainment')return isTanzania(q)?TZ_ENTERTAINMENT:ENTERTAINMENT;
 return undefined;
}

export function detectSearchIntent(message:string):boolean{
 const q=String(message||'').trim().toLowerCase();if(!q)return false;
 return hasAny(q,['leo','leo hii','today','sasa','hivi sasa','latest','current','currently','habari','news','breaking','taarifa','vita','war','conflict','bbc','al jazeera','aljazeera','kifo','amefariki','alifariki','death','died','dead','mazishi','msiba','anazikwa','burial','buried','funeral','mechi','mchezo','matokeo','score','live score','fixture','fixtures','ratiba','msimamo','yanga','young africans','simba','azam','football','mpira','soka','wasanii','msanii','artists','artist','burudani','muziki','music','wimbo','nyimbo','album','albamu','siasa','politics','election','uchaguzi','president','rais','government','serikali','minister','waziri','parliament','bunge','kesi','case','court','mahakama','lawsuit','trial','hearing','appeal','charged','arrested','arrest','kukamatwa','amekamatwa','detained','imprisoned','imprisonment','jailed','jail','prison','kifungo','kufungwa','sentenced','hukumiwa','amehukumiwa','convicted','conviction','scandal','skendo','kashfa','tuhuma','controversy','drama'])||/\b(what|who|where|when|which|how)\b.*\b(today|now|latest|next|live)\b/i.test(q);
}
export function detectSocialPlatform(domain:string,url=''):SocialPlatform{const d=domain.toLowerCase(),u=url.toLowerCase();if(d.includes('youtube.com')||d.includes('youtu.be')||u.includes('youtube.com/'))return'youtube';if(d.includes('tiktok.com'))return'tiktok';if(d.includes('instagram.com'))return'instagram';if(d.includes('facebook.com')||d.includes('fb.com'))return'facebook';return'web';}
function tzDateParts(now:Date){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Dar_es_Salaam',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).reduce<Record<string,string>>((a,v)=>{if(v.type!=='literal')a[v.type]=v.value;return a},{});const start=new Date(`${p.year}-${p.month}-${p.day}T00:00:00+03:00`);return{startIso:start.toISOString(),endIso:now.toISOString()};}
function todayTzIso(now:Date){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Dar_es_Salaam',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).reduce<Record<string,string>>((a,v)=>{if(v.type!=='literal')a[v.type]=v.value;return a},{});return `${p.year}-${p.month}-${p.day}`;}

export class AxaWebSearchProvider implements LiveWebSearchProvider{
 name='AXA';
 async search(query:string,options:SearchWebOptions={}):Promise<SearchQueryResult>{
  const trimmed=query.trim(),timestamp=new Date().toISOString();
  const empty=(status:SearchQueryResult['status'],enabled:boolean,message?:string):SearchQueryResult=>({query:trimmed,enabled,provider:this.name,status,sources:[],results:[],message,timestamp,socialTargeted:false});
  if(!trimmed)return empty('ok',true,'Query haijawekwa.');
  const key=process.env.AXA_API_KEY||process.env.EXA_API_KEY||process.env.EXA_WEB_SEARCH_KEY;if(!key)return empty('disabled',false,'AXA_API_KEY haijawekwa kwenye server environment.');
  const now=new Date(),year=now.getFullYear(),q=trimmed.toLowerCase(),category=categoryFor(q,options),domains=options.includeDomains?.length?Array.from(new Set(options.includeDomains)):domainsFor(q,category);
  const isToday=hasAny(q,['leo','leo hii','today','sasa','hivi sasa','live','currently']);
  let searchQuery=trimmed;
  if(category==='football')searchQuery+=` ${year} exact fixture opponent kickoff UTC Tanzania time current season`;
  else if(category==='death')searchQuery+=` ${year} latest death obituary funeral burial confirmation`;
  else if(category==='war')searchQuery+=` ${year} latest ongoing conflict war fighting ceasefire casualties`;
  else if(category==='politics')searchQuery+=` ${year} latest political news government election parliament`;
  else if(category==='court')searchQuery+=` ${year} latest court case arrest charges detention conviction sentence imprisonment`;
  else if(category==='artist-scandal')searchQuery+=` ${year} latest artist celebrity scandal controversy arrest court charges conviction`;
  else if(category==='entertainment')searchQuery+=` ${year} latest news`;
  else if(category!=='general')searchQuery+=` ${year} latest`;
  try{
   const newsCategory=['war','bbc','aljazeera','death','politics','court','artist-scandal'].includes(category);
   const payload:any={query:searchQuery,type:'auto',numResults:Math.min(Math.max(options.numResults||(category==='football'?10:8),1),10),contents:{summary:true,text:{maxCharacters:category==='football'?3500:3200},maxAgeHours:category==='football'&&isToday?12:48}};
   if(domains?.length)payload.includeDomains=domains;
   if(newsCategory){payload.category='news';payload.startPublishedDate=new Date(Date.now()-7*86400000).toISOString();}
   if(isToday&&['war','bbc','aljazeera','death','politics','court','artist-scandal'].includes(category)){const d=tzDateParts(now);payload.startPublishedDate=d.startIso;payload.endPublishedDate=d.endIso;payload.contents.maxAgeHours=24;}
   const response=await fetch(AXA_SEARCH_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,Accept:'application/json'},body:JSON.stringify(payload)});
   if(!response.ok){const t=await response.text().catch(()=> '');return empty('error',true,`AXA web search failed (${response.status}): ${t.slice(0,300)}`);}
   const data:any=await response.json();
   let sources:SearchSourceCard[]=(Array.isArray(data?.results)?data.results:[]).slice(0,10).map((item:any)=>{let sourceDomain='axa.ai';try{sourceDomain=new URL(item.url).hostname.replace(/^www\./,'')}catch{}const summary=typeof item.summary==='string'?item.summary.trim():'';const text=typeof item.text==='string'?item.text.replace(/\s+/g,' ').trim():'';return{title:item.title||sourceDomain,url:item.url,snippet:summary||text.slice(0,600)||item.title||'',summary,text,publishedDate:item.publishedDate||item.published_date,sourceDomain,favicon:`https://www.google.com/s2/favicons?domain=${sourceDomain}&sz=32`,platform:detectSocialPlatform(sourceDomain,item.url)}}).filter((s:SearchSourceCard)=>Boolean(s.url));
   if(domains?.length)sources=sources.filter(s=>domains.some(d=>s.sourceDomain===d||s.sourceDomain.endsWith(`.${d}`)));
   if(category==='football'&&isToday){
    const today=todayTzIso(now);
    const relevantTeam=isYanga(q)?['yanga','young africans']:q.split(/\s+/).filter(x=>x.length>3&& !['leo','today','mchezo','mechi','anacheza','wanacheza','timu','gani','nani'].includes(x));
    sources=sources.filter(s=>{const hay=`${s.title} ${s.summary||''} ${s.text||''}`.toLowerCase();const hasTeam=relevantTeam.some(t=>hay.includes(t));const [yy,mm,dd]=today.split('-'); const monthName=new Intl.DateTimeFormat('en',{timeZone:'Africa/Dar_es_Salaam',month:'long'}).format(now).toLowerCase(); const hasToday=hay.includes('today')||hay.includes('leo')||hay.includes(today)||hay.includes(dd+' '+monthName)||hay.includes(dd+'/'+mm+'/'+yy);return hasTeam&&hasToday;});
   }
   sources.sort((a,b)=>(b.publishedDate?new Date(b.publishedDate).getTime():0)-(a.publishedDate?new Date(a.publishedDate).getTime():0));
   return{query:trimmed,enabled:true,provider:this.name,status:'ok',sources,results:sources,timestamp,socialTargeted:false};
  }catch(error){return empty('error',true,error instanceof Error?error.message:'AXA web search failed.');}
 }
}
export function getSearchProvider():LiveWebSearchProvider{return new AxaWebSearchProvider();}
export async function searchWeb(query:string,options:SearchWebOptions={}):Promise<SearchQueryResult>{return getSearchProvider().search(query,options);}

function requestedFootballTeam(q:string):string{
 const x=q.toLowerCase();
 if(/yanga|young africans/.test(x))return'young africans';
 if(/simba(?: sc)?/.test(x))return'simba';
 if(/azam fc|azam/.test(x))return'azam';
 const m=x.match(/\b([a-z][a-z0-9 .'-]{2,40})\s+(?:anacheza|wanacheza|plays|play)\b/i);
 return m?.[1]?.trim()||'';
}
function footballSourceScore(q:string,r:SearchSourceCard):number{
 const hay=(r.title+' '+(r.summary||'')+' '+(r.text||'')).toLowerCase();
 const team=requestedFootballTeam(q); if(!team)return 0;
 const aliases=team==='young africans'?['young africans','yanga']:team==='simba'?['simba sc','simba']:team==='azam'?['azam fc','azam']:[team];
 let score=0; if(aliases.some(a=>hay.includes(a)))score+=10; if(/today|leo|upcoming|next match|fixture|ratiba|kick.?off/.test(hay))score+=5; if(/fotmob|livescore|azam/.test(r.sourceDomain))score+=2; return score;
}
const BANNED_OPPONENT_TERMS = /^(?:fixtures?|results?|schedule|table|standings|live\s*scores?|scores?|news|squad|tickets|preview|highlights|stats|matches?|overview|vs\.?|today|leo|fotmob|livescore|azam|azam\s*sports|azam\s*tv|league|champions\s*league|caf\s*champions\s*league|premier\s*league|laliga|serie\s*a|updates?|report|lineups?)\b/i;

function extractFootballFixture(q:string,results:SearchSourceCard[]):{team:string;opponent:string;time:string;stadium?:string;competition?:string;isHome:boolean;source:SearchSourceCard}|null{
 const team=requestedFootballTeam(q); if(!team)return null;
 const aliases=team==='young africans'?['young africans','yanga']:team==='simba'?['simba sc','simba']:team==='azam'?['azam fc','azam']:[team];
 const ranked=results.map(r=>({r,score:footballSourceScore(q,r)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
 for(const item of ranked){
  const r=item.r; const hay=(r.title+' '+(r.summary||'')+' '+(r.text||'')).replace(/\s+/g,' ');
  const teamPattern=aliases.map(a=>a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  const re1=new RegExp('(?:'+teamPattern+')\\s+(?:vs\\.?|v\\.?|against)\\s+([A-Za-z0-9 .\'&-]{2,70})','i');
  const re2=new RegExp('([A-Za-z0-9 .\'&-]{2,70})\\s+(?:vs\\.?|v\\.?|against)\\s+(?:'+teamPattern+')','i');
  const m1=re1.exec(hay);
  const m2=!m1?re2.exec(hay):null;
  const matchup=m1||m2; if(!matchup)continue;
  const isHome=Boolean(m1);
  let opponent=(matchup[1]||'').replace(/\s+(?:today|leo|tomorrow|jana|on|at|in|—|\|).*$/i,'').trim();
  if(!opponent||aliases.some(a=>opponent.toLowerCase()===a)||BANNED_OPPONENT_TERMS.test(opponent)||opponent.length<3)continue;
  let time=''; const utc=/(\d{1,2})(?::(\d{2}))?\s*UTC/i.exec(hay); const iso=/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)/i.exec(hay);
  if(utc){const total=(Number(utc[1])*60+Number(utc[2]||0)+180)%1440;time=String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0')+' EAT';}
  else if(iso){const d=new Date(iso[1]);if(!Number.isNaN(d.getTime()))time=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Dar_es_Salaam',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)+' EAT';}
  const competition=/caf champions league/i.test(hay)?'CAF Champions League':/premier league/i.test(hay)?'Premier League':/la liga/i.test(hay)?'La Liga':/serie a/i.test(hay)?'Serie A':/ligue 1/i.test(hay)?'Ligue 1':undefined;
  const homeTeamForStadium = isHome ? (team === 'simba' ? 'Simba SC' : team === 'young africans' ? 'Young Africans' : team === 'azam' ? 'Azam FC' : team) : opponent;
  const stadium = resolveStadium(homeTeamForStadium, competition || '');
  return {team,opponent,time,stadium,competition,isHome,source:r};
 } return null;
}
function uniqueRelevantSources(q:string,category:SearchCategory,sources:SearchSourceCard[]):SearchSourceCard[]{
 const seen=new Set<string>();
 return sources.map((r,i)=>({r,i,score:category==='football'?footballSourceScore(q,r):0})).filter(x=>category!=='football'||x.score>0).sort((a,b)=>b.score-a.score||a.i-b.i).map(x=>x.r).filter(r=>{const key=r.sourceDomain;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,4);
}

export function formatAxaLiveAnswer(search:SearchQueryResult,timeContext:{formattedString:string;iso:string}):string{
 const q=search.query.toLowerCase(),category=categoryFor(q,{});
 const relevant=uniqueRelevantSources(search.query,category,search.sources);
 if(category==='football'){
  const fixture=extractFootballFixture(search.query,relevant);
  if(fixture){
   const name=fixture.team==='young africans'?'Young Africans (Yanga)':fixture.team==='simba'?'Simba SC':fixture.team==='azam'?'Azam FC':fixture.team;
   const time=fixture.time?`• **Saa ya Mechi:** **${fixture.time}** (saa za Tanzania / Afrika Mashariki)`:'• **Saa ya Mechi:** Saa ya kuanza itathibitishwa na waandaaji wa mashindano';
   const venue=fixture.stadium?`\n• **Uwanja:** **${fixture.stadium}** (${fixture.isHome ? 'Nyumbani' : 'Ugenini'})`:'';
   const comp=fixture.competition?`\n• **Mashindano:** **${fixture.competition}**`:'';
   return `⚽ **Taarifa Kamili ya Mchezo wa ${name}**\n\n• **Mpinzani:** **${fixture.opponent}** (${fixture.isHome ? 'Nyumbani' : 'Ugenini'})\n${time}${venue}${comp}\n\n**Chanzo:** [${fixture.source.sourceDomain}](${fixture.source.url})`;
  }
  if(!relevant.length)return '⚽ **AXA haijaweza kuthibitisha mechi hiyo kwa vyanzo vya mpira vilivyoruhusiwa.**\nMuda wa utafutaji: '+timeContext.formattedString;
 }
 const results=relevant.length?relevant:search.sources.slice(0,4);
 if(!results.length)return 'AXA Live Web Search haikuweza kupata au kuthibitisha taarifa ya sasa mtandaoni kwa swali hili.\nMuda wa utafutaji: '+timeContext.formattedString;
 const header=category==='football'?'⚽ **AXA LIVE — MICHEZO/FIXTURES/LIVE SCORE**':category==='entertainment'?'🎵 **AXA LIVE — WASANII & BURUDANI**':category==='death'?'🕯️ **AXA LIVE — TAARIFA YA KIFO/MSIBA**':category==='court'?'⚖️ **AXA LIVE — KESI/KUKAMATWA/KUHUKUMIWA/KIFUNGO**':category==='politics'?'🏛️ **AXA LIVE — SIASA**':category==='artist-scandal'?'🎤 **AXA LIVE — WASANII/SKENDO**':category==='bbc'?'📰 **AXA LIVE — BBC NEWS**':category==='aljazeera'?'📰 **AXA LIVE — AL JAZEERA**':category==='war'?'🌍 **AXA LIVE — HABARI/VITA/MIGOGORO**':'🌐 **AXA LIVE WEB SEARCH**';
 const body=results.map(r=>{let text=(r.summary||r.text||r.snippet||'').replace(/\s+/g,' ').trim();if(text.length>700)text=text.slice(0,700)+'...';return '📌 **'+r.title+'** ('+r.sourceDomain+')\n'+text;}).join('\n\n');
 const sourceLines=results.map((r,i)=>(i+1)+'. ['+r.sourceDomain+']('+r.url+')').join('\n');
 return header+'\n*Taarifa ya moja kwa moja — '+timeContext.formattedString+'*\n\n'+body+'\n\n**Vyanzo:**\n'+sourceLines;
}
