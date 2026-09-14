export const SPORT_SOURCE_WHITELIST = ['FotMob', 'LiveScore', 'Azam Sports', 'Azam Media'] as const;

export interface SportMatch {
  id: string;
  leagueId: number;
  league: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: 'LIVE' | 'UPCOMING' | 'FT' | 'POSTPONED' | 'CANCELLED';
  statusText: string;
  kickoffUtc: string;
  kickoffEAT: string;
  kickoffSwahili?: string;
  source: 'FotMob';
  sourceUrl: string;
  stadium?: string;
  aggScore?: string;
}

const LEAGUES = [
  { id: 9066, name: 'Ligi Kuu Tanzania' },
  { id: 47, name: 'Premier League England' },
  { id: 87, name: 'La Liga Spain' },
  { id: 55, name: 'Serie A Italy' },
  { id: 53, name: 'Ligue 1 France' },
  { id: 42, name: 'UEFA Champions League' },
  { id: 526, name: 'CAF Champions League' },
];

function dateInTZ(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dar_es_Salaam',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

function dateKey(date: string): string {
  return date.replace(/-/g, '');
}

function eat(utc: string): string {
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('sw-TZ', {
    timeZone: 'Africa/Dar_es_Salaam',
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function fotMobOsloToUTC(timeStr: string): string {
  if (!timeStr) return new Date().toISOString();
  const parts = timeStr.trim().split(' ');
  if (parts.length < 2) return new Date().toISOString();
  const [d, m, y] = parts[0].split('.');
  const [h, min] = parts[1].split(':');
  if (!d || !m || !y || !h || !min) return new Date().toISOString();

  // Target time in Europe/Oslo from FotMob feed
  const targetIso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${min.padStart(2, '0')}:00`;
  let guess = new Date(targetIso + 'Z');

  const osloDtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Oslo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });

  for (let i = 0; i < 3; i++) {
    const p = osloDtf.formatToParts(guess);
    const get = (type: string) => p.find(x => x.type === type)?.value || '';
    const hourVal = get('hour') === '24' ? '00' : get('hour');
    const osloIso = `${get('year')}-${get('month')}-${get('day')}T${hourVal}:${get('minute')}:${get('second')}`;
    const diff = new Date(targetIso + 'Z').getTime() - new Date(osloIso + 'Z').getTime();
    if (diff === 0) break;
    guess = new Date(guess.getTime() + diff);
  }
  return guess.toISOString();
}

function formatTanzaniaTime(utcIso: string): { eatStr: string; swahiliTime: string } {
  const d = new Date(utcIso);
  if (Number.isNaN(d.getTime())) return { eatStr: '', swahiliTime: '' };

  const eatDtf = new Intl.DateTimeFormat('sw-TZ', {
    timeZone: 'Africa/Dar_es_Salaam',
    weekday: 'short', day: '2-digit', month: 'short',
  });

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dar_es_Salaam',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find(x => x.type === type)?.value || '';
  const h = parseInt(get('hour') === '24' ? '0' : get('hour'), 10);
  const min = get('minute');

  // Mfumo wa saa wa Kiswahili (mfano 16:00 ni Saa 10 Jioni, 18:30 ni Saa 12:30 Jioni, 22:00 ni Saa 4 Usiku)
  let swHours = (h - 6 + 24) % 12;
  if (swHours === 0) swHours = 12;
  let period = 'Asubuhi';
  if (h >= 12 && h < 16) period = 'Mchana';
  else if (h >= 16 && h < 19) period = 'Jioni';
  else if (h >= 19 || h < 6) period = 'Usiku';

  const swahiliTime = `Saa ${swHours}:${min} ${period}`;
  const hour24 = `${get('hour')}:${min} EAT`;
  const dateFormatted = eatDtf.format(d);

  const todayTZ = dateInTZ(0);
  const matchDayTZ = `${get('year')}-${get('month')}-${get('day')}`;
  
  const eatStr = matchDayTZ === todayTZ ? hour24 : `${dateFormatted} • ${hour24}`;
  return { eatStr, swahiliTime };
}

export function resolveStadium(homeTeam: string, league = ''): string {
  const h = (homeTeam || '').toLowerCase();

  // Tanzanian Premier League & CAF clubs home stadiums
  if (h.includes('simba')) return 'Uwanja wa Benjamin Mkapa, Dar es Salaam';
  if (h.includes('yanga') || h.includes('young africans')) return 'Uwanja wa Benjamin Mkapa, Dar es Salaam';
  if (h.includes('azam')) return 'Azam Complex, Chamazi, Dar es Salaam';
  if (h.includes('singida')) return 'Uwanja wa CCM Liti, Singida';
  if (h.includes('tabora')) return 'Uwanja wa Ali Hassan Mwinyi, Tabora';
  if (h.includes('dodoma')) return 'Uwanja wa Jamhuri, Dodoma';
  if (h.includes('coastal')) return 'Uwanja wa Mkwakwani, Tanga';
  if (h.includes('kagera')) return 'Uwanja wa Kaitaba, Bukoba';
  if (h.includes('mashujaa')) return 'Uwanja wa Lake Tanganyika, Kigoma';
  if (h.includes('namungo')) return 'Uwanja wa Majaliwa, Ruangwa, Lindi';
  if (h.includes('prisons') || h.includes('kengold')) return 'Uwanja wa Sokoine, Mbeya';
  if (h.includes('kmc')) return 'KMC Complex, Mwenge, Dar es Salaam';
  if (h.includes('jkt')) return 'Uwanja wa Meja Jenerali Isamuhyo, Mbweni, Dar es Salaam';
  if (h.includes('pamba')) return 'Uwanja wa CCM Kirumba, Mwanza';
  if (h.includes('fountain gate')) return 'Uwanja wa Tanzanite Kwacheki, Manyara';
  if (h.includes('geita gold')) return 'Uwanja wa Nyankumbu Girls, Geita';

  // African / CAF opponents
  if (h.includes('mighty wanderers')) return 'Kamuzu Stadium / Bingu National Stadium, Malawi';
  if (h.includes('al ahly') || h.includes('zamalek')) return 'Cairo International Stadium, Cairo, Misri';
  if (h.includes('mamelodi sundowns')) return 'Loftus Versfeld Stadium, Pretoria, Afrika Kusini';
  if (h.includes('tp mazembe')) return 'Stade TP Mazembe, Lubumbashi, DRC';
  if (h.includes('esperance') || h.includes('espérance')) return 'Stade Hammadi Agrebi, Tunis, Tunisia';
  if (h.includes('wydad') || h.includes('raja')) return 'Stade Mohammed V, Casablanca, Morocco';
  if (h.includes('gaborone united')) return 'Botswana National Stadium, Gaborone';

  // Top European clubs
  if (h.includes('arsenal')) return 'Emirates Stadium (London, Uingereza)';
  if (h.includes('chelsea')) return 'Stamford Bridge (London, Uingereza)';
  if (h.includes('liverpool')) return 'Anfield (Liverpool, Uingereza)';
  if (h.includes('manchester city') || h.includes('man city')) return 'Etihad Stadium (Manchester, Uingereza)';
  if (h.includes('manchester united') || h.includes('man utd')) return 'Old Trafford (Manchester, Uingereza)';
  if (h.includes('tottenham')) return 'Tottenham Hotspur Stadium (London, Uingereza)';
  if (h.includes('aston villa')) return 'Villa Park (Birmingham, Uingereza)';
  if (h.includes('newcastle')) return "St. James' Park (Newcastle, Uingereza)";
  if (h.includes('real madrid')) return 'Estadio Santiago Bernabéu (Madrid, Hispania)';
  if (h.includes('barcelona')) return 'Estadi Olímpic Lluís Companys / Camp Nou (Barcelona, Hispania)';
  if (h.includes('atletico') || h.includes('atlético')) return 'Cívitas Metropolitano (Madrid, Hispania)';
  if (h.includes('bayern')) return 'Allianz Arena (Munich, Ujerumani)';
  if (h.includes('dortmund')) return 'Signal Iduna Park (Dortmund, Ujerumani)';
  if (h.includes('paris') || h.includes('psg')) return 'Parc des Princes (Paris, Ufaransa)';
  if (h.includes('juventus')) return 'Allianz Stadium (Turin, Italia)';
  if (h.includes('inter') || h.includes('milan')) return 'Stadio San Siro / Giuseppe Meazza (Milano, Italia)';

  return `Uwanja wa nyumbani wa ${homeTeam}`;
}

const dateCache = new Map<string, { expiresAt: number; data: SportMatch[] }>();

async function fetchDate(date: string): Promise<SportMatch[]> {
  const cacheKey = dateKey(date);
  const cached = dateCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const url = `https://apigw.fotmob.com/matches?date=${cacheKey}&timezone=Africa%2FDar_es_Salaam`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/xml,application/xml,*/*',
    },
  });
  if (!response.ok) throw new Error(`FotMob HTTP ${response.status}`);
  const xml = await response.text();

  const leagueBlocks = xml.split('<league ');
  const out: SportMatch[] = [];

  const getAttr = (str: string, attr: string): string => {
    const match = str.match(new RegExp(`${attr}="([^"]*)"`));
    return match ? decodeXml(match[1]) : '';
  };

  for (let i = 1; i < leagueBlocks.length; i++) {
    const chunk = leagueBlocks[i];
    const headerEnd = chunk.indexOf('>');
    if (headerEnd === -1) continue;
    const header = chunk.slice(0, headerEnd);
    const body = chunk.slice(headerEnd + 1);

    const lid = Number(getAttr(header, 'id'));
    const lname = getAttr(header, 'name');
    const ccode = getAttr(header, 'ccode');

    let targetLeague: { id: number; name: string } | null = null;
    if (lid === 9066 || ccode === 'TAN' || lname.toLowerCase().includes('tanzania')) {
      targetLeague = { id: 9066, name: 'Ligi Kuu Tanzania' };
    } else if ((lid === 47 || lname === 'Premier League') && ccode === 'ENG') {
      targetLeague = { id: 47, name: 'Premier League England' };
    } else if ((lid === 87 || lname === 'LaLiga' || lname === 'La Liga') && ccode === 'ESP') {
      targetLeague = { id: 87, name: 'La Liga Spain' };
    } else if ((lid === 55 || lname === 'Serie A') && ccode === 'ITA') {
      targetLeague = { id: 55, name: 'Serie A Italy' };
    } else if ((lid === 53 || lname === 'Ligue 1') && ccode === 'FRA') {
      targetLeague = { id: 53, name: 'Ligue 1 France' };
    } else if ((lid === 42 || lid === 943230 || lname === 'Champions League' || lname === 'UEFA Champions League') && !lname.includes('CAF') && !lname.includes('AFC') && !lname.includes('CONCACAF') && !lname.includes('Youth')) {
      targetLeague = { id: 42, name: 'UEFA Champions League' };
    } else if (lid === 526 || lid === 943487 || lname.includes('CAF Champions League')) {
      targetLeague = { id: 526, name: 'CAF Champions League' };
    }

    if (!targetLeague) continue;

    const matchItems = body.split('<match ');
    for (let j = 1; j < matchItems.length; j++) {
      const mItem = matchItems[j];
      const mEnd = mItem.indexOf('/>');
      const mHeader = mEnd !== -1 ? mItem.slice(0, mEnd) : mItem;

      const mid = getAttr(mHeader, 'id');
      const hTeam = getAttr(mHeader, 'hTeam');
      const aTeam = getAttr(mHeader, 'aTeam');
      const rawStatus = getAttr(mHeader, 'Status');
      const timeStr = getAttr(mHeader, 'time');
      const hScore = getAttr(mHeader, 'hScore');
      const aScore = getAttr(mHeader, 'aScore');

      if (!mid || !hTeam || !aTeam) continue;

      let status: SportMatch['status'] = 'UPCOMING';
      let statusText = 'Inakuja';
      if (rawStatus === 'S') {
        status = 'LIVE';
        statusText = 'LIVE';
      } else if (rawStatus === 'F') {
        status = 'FT';
        statusText = 'FT';
      } else if (rawStatus === 'P') {
        status = 'POSTPONED';
        statusText = 'Imeahirishwa';
      } else if (rawStatus === 'C') {
        status = 'CANCELLED';
        statusText = 'Imefutwa';
      }

      const homeScore = (status === 'UPCOMING' && hScore === '0' && aScore === '0') ? null : (hScore !== '' ? Number(hScore) : null);
      const awayScore = (status === 'UPCOMING' && hScore === '0' && aScore === '0') ? null : (aScore !== '' ? Number(aScore) : null);
      const agg = getAttr(mHeader, 'agg');

      const slug = `${hTeam.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-vs-${aTeam.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const utc = fotMobOsloToUTC(timeStr);
      const { eatStr, swahiliTime } = formatTanzaniaTime(utc);
      const stadium = resolveStadium(hTeam, targetLeague.name);

      out.push({
        id: mid,
        leagueId: targetLeague.id,
        league: targetLeague.name,
        home: hTeam,
        away: aTeam,
        homeScore,
        awayScore,
        status,
        statusText,
        kickoffUtc: utc,
        kickoffEAT: eatStr,
        kickoffSwahili: swahiliTime,
        source: 'FotMob',
        sourceUrl: `https://www.fotmob.com/match/${slug}/${mid}`,
        stadium,
        aggScore: agg || undefined,
      });
    }
  }

  // Cache: 60 seconds TTL
  dateCache.set(cacheKey, { expiresAt: now + 60_000, data: out });
  return out;
}

let cachedDashboard: { expiresAt: number; data: any } | null = null;

export async function getSportDashboard(): Promise<{
  generatedAt: string;
  timezone: 'Africa/Dar_es_Salaam';
  season: string;
  sources: readonly string[];
  leagues: typeof LEAGUES;
  live: SportMatch[];
  today: SportMatch[];
  upcoming: SportMatch[];
  previous: SportMatch[];
}> {
  const now = Date.now();
  if (cachedDashboard && cachedDashboard.expiresAt > now) {
    return cachedDashboard.data;
  }

  const today = dateInTZ(0);
  const dates = Array.from({ length: 15 }, (_, i) => dateInTZ(i - 7));
  const unique = [...new Set(dates)];
  const results = await Promise.all(unique.map(async d => {
    try { return await fetchDate(d); } catch (e) {
      console.warn('[SPORT] FotMob date fetch failed', d, e);
      return [];
    }
  }));
  const all = results.flat();
  const byId = new Map<string, SportMatch>();
  for (const m of all) byId.set(m.id, m);
  const matches = [...byId.values()].sort((a,b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime());
  // Use exact local calendar day instead of display-text matching.
  const localDay = (utc: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dar_es_Salaam' }).format(new Date(utc));
  const live = matches.filter(m => m.status === 'LIVE');
  const todayExact = matches.filter(m => localDay(m.kickoffUtc) === today);
  const upcoming = matches.filter(m => m.status === 'UPCOMING' && new Date(m.kickoffUtc).getTime() > now);
  const previous = matches.filter(m => ['FT','POSTPONED','CANCELLED'].includes(m.status)).sort((a,b) => new Date(b.kickoffUtc).getTime() - new Date(a.kickoffUtc).getTime());
  const season = new Date().getUTCMonth() >= 6 ? `${new Date().getUTCFullYear()}/${new Date().getUTCFullYear()+1}` : `${new Date().getUTCFullYear()-1}/${new Date().getUTCFullYear()}`;
  const data = { generatedAt: new Date().toISOString(), timezone: 'Africa/Dar_es_Salaam' as const, season, sources: SPORT_SOURCE_WHITELIST, leagues: LEAGUES, live, today: todayExact, upcoming, previous };
  cachedDashboard = { expiresAt: now + 15_000, data };
  return data;
}

export function formatMatchReport(match: SportMatch, focusTeam?: string): string {
  const isHome = focusTeam
    ? (focusTeam === 'yanga' ? (match.home.toLowerCase().includes('yanga') || match.home.toLowerCase().includes('young africans')) : match.home.toLowerCase().includes(focusTeam))
    : true;
  const teamName = isHome ? match.home : match.away;
  const opponent = isHome ? match.away : match.home;
  const stadium = match.stadium || resolveStadium(match.home, match.league);
  const time = match.kickoffSwahili
    ? `${match.kickoffSwahili} (${match.kickoffEAT})`
    : match.kickoffEAT;

  const d = new Date(match.kickoffUtc);
  const dateFormatted = new Intl.DateTimeFormat('sw-TZ', {
    timeZone: 'Africa/Dar_es_Salaam',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);

  const isToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dar_es_Salaam' }).format(d) ===
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dar_es_Salaam' }).format(new Date());

  let statusSection = '';
  if (match.status === 'LIVE') {
    statusSection = `🔴 **Mchezo Unaendelea SASA HIVI (LIVE)**\n• **Matokeo:** **${match.home} ${match.homeScore ?? 0} - ${match.awayScore ?? 0} ${match.away}**`;
  } else if (match.status === 'FT') {
    statusSection = `🏁 **Mchezo Umemalizika (FT)**\n• **Matokeo:** **${match.home} ${match.homeScore ?? 0} - ${match.awayScore ?? 0} ${match.away}**`;
  } else {
    statusSection = `⏳ **Inakuja (${isToday ? 'Leo' : dateFormatted})**`;
  }

  let aggNote = '';
  if (match.aggScore) {
    aggNote = `\n• **Matokeo ya Jumla (Aggregate):** **${match.aggScore}**`;
  }

  const uwanjaMaelezo = isHome
    ? `${stadium} (Nyumbani kwa ${teamName})`
    : `${stadium} (Ugenini - Nyumbani kwa ${opponent})`;

  return `⚽ **Taarifa Kamili ya Mchezo: ${match.home} vs ${match.away}**

• **Mpinzani:** **${opponent}** (${isHome ? 'Mchezo upo nyumbani' : 'Mchezo upo ugenini'})
• **Uwanja:** **${uwanjaMaelezo}**
• **Saa ya Mechi:** **${time}** — ${isToday ? `Leo (${dateFormatted})` : dateFormatted}
• **Mashindano:** **${match.league}**
• **Hali ya Mchezo:** ${statusSection}${aggNote}

**Chanzo:** [FotMob](${match.sourceUrl}) • LiveScore • Azam Sports`;
}

export function formatTodayMatchesList(matches: SportMatch[]): string {
  if (matches.length === 0) {
    return '⚽ **Hakuna mechi za ligi zilizoidhinishwa zilizoratibiwa leo.**\n\nUnaweza kuulizia ratiba ya michezo ijayo ya Simba SC, Yanga, au Azam FC.';
  }
  const lines = matches.slice(0, 10).map((m, i) => {
    const time = m.kickoffSwahili ? `${m.kickoffSwahili} (${m.kickoffEAT})` : m.kickoffEAT;
    const stadium = m.stadium || resolveStadium(m.home, m.league);
    return `${i + 1}. ⚽ **${m.home} vs ${m.away}**\n   • **Saa:** ${time}\n   • **Uwanja:** ${stadium}\n   • **Ligi:** ${m.league}\n   • **Hali:** ${m.status === 'LIVE' ? '🔴 LIVE' : m.statusText}`;
  });
  return `⚽ **Ratiba ya Mechi za Leo (Tanzania & Kimataifa)**\n\n${lines.join('\n\n')}\n\n**Vyanzo:** FotMob • LiveScore • Azam Sports`;
}

function extractTeamAlias(q: string): string | null {
  const lower = q.toLowerCase();
  if (lower.includes('simba')) return 'simba';
  if (lower.includes('yanga') || lower.includes('young africans')) return 'yanga';
  if (lower.includes('azam')) return 'azam';
  if (lower.includes('singida')) return 'singida';
  if (lower.includes('tabora')) return 'tabora';
  if (lower.includes('dodoma')) return 'dodoma';
  if (lower.includes('coastal')) return 'coastal';
  if (lower.includes('kagera')) return 'kagera';
  if (lower.includes('mashujaa')) return 'mashujaa';
  if (lower.includes('namungo')) return 'namungo';
  if (lower.includes('prisons')) return 'prisons';
  if (lower.includes('kmc')) return 'kmc';
  if (lower.includes('jkt')) return 'jkt';
  if (lower.includes('pamba')) return 'pamba';
  if (lower.includes('kengold')) return 'kengold';
  if (lower.includes('arsenal')) return 'arsenal';
  if (lower.includes('chelsea')) return 'chelsea';
  if (lower.includes('liverpool')) return 'liverpool';
  if (lower.includes('manchester city') || lower.includes('man city')) return 'man city';
  if (lower.includes('manchester united') || lower.includes('man utd') || lower.includes('man u')) return 'man united';
  if (lower.includes('real madrid') || lower.includes('madrid')) return 'real madrid';
  if (lower.includes('barcelona') || lower.includes('barca')) return 'barcelona';
  if (lower.includes('bayern')) return 'bayern';
  if (lower.includes('psg') || lower.includes('paris')) return 'psg';
  return null;
}

export async function findFootballMatch(query: string): Promise<string | null> {
  const q = (query || '').toLowerCase().trim();
  const team = extractTeamAlias(q);

  try {
    const dash = await getSportDashboard();

    const matchTeam = (m: SportMatch, t: string) => {
      const h = m.home.toLowerCase();
      const a = m.away.toLowerCase();
      if (t === 'yanga') return h.includes('yanga') || h.includes('young africans') || a.includes('yanga') || a.includes('young africans');
      if (t === 'man city') return h.includes('manchester city') || h.includes('man city') || a.includes('manchester city') || a.includes('man city');
      if (t === 'man united') return h.includes('manchester united') || h.includes('man utd') || a.includes('manchester united') || a.includes('man utd');
      return h.includes(t) || a.includes(t);
    };

    if (team) {
      // 1. Check today's matches first
      const todayMatch = dash.today.find(m => matchTeam(m, team));
      if (todayMatch) {
        return formatMatchReport(todayMatch, team);
      }

      // 2. Check live matches
      const liveMatch = dash.live.find(m => matchTeam(m, team));
      if (liveMatch) {
        return formatMatchReport(liveMatch, team);
      }

      // 3. If user asked specifically for results / previous match
      const asksForResults = q.includes('matokeo') || q.includes('jana') || q.includes('mchezo uliopita') || q.includes('score');
      if (asksForResults) {
        const prevMatch = dash.previous.find(m => matchTeam(m, team));
        if (prevMatch) return formatMatchReport(prevMatch, team);
      }

      // 4. Check upcoming matches
      const upcomingMatch = dash.upcoming.find(m => matchTeam(m, team));
      if (upcomingMatch) {
        return formatMatchReport(upcomingMatch, team);
      }

      // 5. Fallback to previous match if no upcoming
      const prevMatch = dash.previous.find(m => matchTeam(m, team));
      if (prevMatch) {
        return formatMatchReport(prevMatch, team);
      }
    }

    // If query asks for today's general fixtures
    if (q.includes('mechi za leo') || q.includes('ratiba ya leo') || q.includes('michezo ya leo') || (q.includes('leo') && q.includes('mechi'))) {
      return formatTodayMatchesList(dash.today);
    }

    return null;
  } catch (err) {
    console.error('[SPORT] findFootballMatch error:', err);
    return null;
  }
}
