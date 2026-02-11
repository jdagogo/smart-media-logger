import { NextRequest, NextResponse } from 'next/server';

/**
 * TV Episode Soundtrack API
 * Fetches song data for specific TV show episodes
 *
 * Sources (in order of preference):
 * 1. Soundtracki.com - scrapable, good episode-level data
 * 2. NME soundtrack articles - fallback for newer shows
 * 3. Web search parsing - last resort
 *
 * Usage: GET /api/tv-soundtrack?show=succession&season=4&episode=10
 *
 * Returns episode-specific songs with:
 * - title, artist, timestamp, scene description
 * - YouTube search links for playback
 */

interface SongEntry {
  position: number;
  title: string;
  artist: string;
  timestamp: string;
  scene: string;
  youtubeSearchUrl: string;
}

interface EpisodeSoundtrack {
  show: string;
  season: number;
  episode: number;
  episodeTitle?: string;
  songs: SongEntry[];
  source: string;
  sourceUrl: string;
  fallbackUsed?: boolean;
}

// Convert show name to Soundtracki URL slug
function toSlug(showName: string): string {
  return showName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-');
}

// Parse timestamp from various formats like "[0:02']", "0:02", "Opening"
function parseTimestamp(raw: string): string {
  if (!raw) return '';
  // Remove brackets and quotes
  return raw.replace(/[\[\]']/g, '').trim();
}

// Generate YouTube search URL for a song
function getYouTubeSearchUrl(title: string, artist: string): string {
  const query = encodeURIComponent(`${artist} ${title} official audio`);
  return `https://www.youtube.com/results?search_query=${query}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const show = searchParams.get('show');
  const season = searchParams.get('season');
  const episode = searchParams.get('episode');

  if (!show) {
    return NextResponse.json(
      { error: 'Missing required parameter: show' },
      { status: 400 }
    );
  }

  const seasonNum = season ? parseInt(season, 10) : null;
  const episodeNum = episode ? parseInt(episode, 10) : null;

  // Try sources in order of preference
  let result = await trySoundtracki(show, seasonNum, episodeNum);

  if (!result) {
    console.log(`[tv-soundtrack] Soundtracki failed, trying NME fallback`);
    result = await tryNMEFallback(show, seasonNum, episodeNum);
  }

  if (!result) {
    console.log(`[tv-soundtrack] NME failed, trying web search fallback`);
    result = await tryWebSearchFallback(show, seasonNum, episodeNum);
  }

  if (result) {
    return NextResponse.json(result);
  }

  return NextResponse.json(
    {
      error: 'No soundtrack data found',
      show,
      season: seasonNum,
      episode: episodeNum,
      triedSources: ['soundtracki.com', 'nme.com', 'web search']
    },
    { status: 404 }
  );
}

// Source 1: Soundtracki.com
async function trySoundtracki(
  show: string,
  season: number | null,
  episode: number | null
): Promise<EpisodeSoundtrack | null> {
  try {
    const slug = toSlug(show);
    const url = season
      ? `https://soundtracki.com/shows/${slug}-season-${season}-soundtrack`
      : `https://soundtracki.com/shows/${slug}-soundtrack`;

    console.log(`[tv-soundtrack] Trying Soundtracki: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      console.log(`[tv-soundtrack] Soundtracki returned ${response.status}`);
      return null;
    }

    const html = await response.text();
    const result = parseEpisodeSoundtrack(html, show, season, episode);

    // Check if we actually got songs
    if ('songs' in result && result.songs.length > 0) {
      return result as EpisodeSoundtrack;
    }
    if ('episodes' in result && result.episodes.some(ep => ep.songs.length > 0)) {
      // Return first episode with songs if no specific episode requested
      return result.episodes.find(ep => ep.songs.length > 0) || null;
    }

    return null;
  } catch (error) {
    console.error('[tv-soundtrack] Soundtracki error:', error);
    return null;
  }
}

// Source 2: NME soundtrack articles
async function tryNMEFallback(
  show: string,
  season: number | null,
  episode: number | null
): Promise<EpisodeSoundtrack | null> {
  try {
    // NME URL pattern: nme.com/news/tv/every-song-on-the-{show}-soundtrack
    const slug = toSlug(show);
    const url = `https://www.nme.com/news/tv/every-song-on-the-${slug}-soundtrack-3906457`;

    console.log(`[tv-soundtrack] Trying NME: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      console.log(`[tv-soundtrack] NME returned ${response.status}`);
      return null;
    }

    const html = await response.text();
    const result = parseNMESoundtrack(html, show, season, episode);

    if (result && result.songs.length > 0) {
      return result;
    }

    return null;
  } catch (error) {
    console.error('[tv-soundtrack] NME error:', error);
    return null;
  }
}

// Source 3: Web search fallback using DuckDuckGo
async function tryWebSearchFallback(
  show: string,
  season: number | null,
  episode: number | null
): Promise<EpisodeSoundtrack | null> {
  try {
    const query = episode
      ? `${show} season ${season || 1} episode ${episode} soundtrack songs list`
      : `${show} soundtrack songs list`;

    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    console.log(`[tv-soundtrack] Trying web search: ${query}`);

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      console.log(`[tv-soundtrack] Web search returned ${response.status}`);
      return null;
    }

    const html = await response.text();
    const result = parseWebSearchResults(html, show, season, episode);

    return result;
  } catch (error) {
    console.error('[tv-soundtrack] Web search error:', error);
    return null;
  }
}

// Parse NME soundtrack articles
function parseNMESoundtrack(
  html: string,
  show: string,
  season: number | null,
  episode: number | null
): EpisodeSoundtrack | null {
  const songs: SongEntry[] = [];

  // First, try to extract just the article content (between <article> tags or main content area)
  let contentHtml = html;
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) {
    contentHtml = articleMatch[1];
  }

  // Remove script and style tags entirely
  contentHtml = contentHtml
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove CSS comments
    .replace(/\{[^}]*\}/g, ' '); // Remove CSS blocks

  // Strip HTML but preserve structure
  const text = contentHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

  // Look for episode section
  let searchText = text;
  if (episode) {
    // Try to find the episode section
    const episodePatterns = [
      new RegExp(`EPISODE\\s*${episode}\\b[^]*?(?=EPISODE\\s*\\d|$)`, 'i'),
      new RegExp(`Episode\\s*${episode}[^]*?(?=Episode\\s*\\d|$)`, 'i'),
    ];

    for (const pattern of episodePatterns) {
      const match = text.match(pattern);
      if (match && match[0].length > 50) {
        searchText = match[0];
        break;
      }
    }
  }

  // Pattern: "Artist – 'Song Title'" - NME uses this exact format
  // Example: Akusmi – 'Cogito'
  const songPatterns = [
    // Primary NME pattern: Artist – 'Title' (with various quote styles)
    /([A-Z][a-zA-Z\s&\.']+?)\s*[–-]\s*['']([^'']+)['']/g,
    // Fallback: Artist – "Title"
    /([A-Z][a-zA-Z\s&\.']+?)\s*[–-]\s*[""]([^""]+)[""]/g,
    // Straight quotes fallback
    /([A-Z][a-zA-Z\s&\.']+?)\s*[–-]\s*'([^']+)'/g,
  ];

  const seenSongs = new Set<string>();
  let position = 1;

  for (const pattern of songPatterns) {
    let match;
    pattern.lastIndex = 0;

    while ((match = pattern.exec(searchText)) !== null) {
      let artist = match[1]?.trim();
      let title = match[2]?.trim();

      // For "by" pattern, swap order
      if (pattern.source.includes('by')) {
        [artist, title] = [title, artist];
      }

      // Aggressive filtering
      if (!artist || !title) continue;
      if (artist.length < 2 || title.length < 2) continue;
      if (artist.length > 40 || title.length > 60) continue;

      // Filter out JavaScript/CSS/HTML artifacts
      const junkPatterns = [
        /function/i, /var\s/, /const\s/, /let\s/, /return/i,
        /\{/, /\}/, /\[/, /\]/, /\(/, /\)/,
        /\.js/, /\.css/, /\.php/, /\.html/,
        /http/, /www\./, /\.com/,
        /episode/i, /season/i, /soundtrack/i,
        /data-/, /class=/, /id=/, /style=/,
        /window\./, /document\./, /querySelector/,
        /addEventListener/, /setTimeout/,
        /margin/, /padding/, /display/, /width/, /height/,
        /^\d+$/, /^[A-Z]+$/, // All numbers or all caps
      ];

      const isJunk = junkPatterns.some(p =>
        p.test(artist) || p.test(title)
      );
      if (isJunk) continue;

      // Must have at least one letter in both
      if (!/[a-zA-Z]/.test(artist) || !/[a-zA-Z]/.test(title)) continue;

      const songKey = `${artist}-${title}`.toLowerCase();
      if (seenSongs.has(songKey)) continue;
      seenSongs.add(songKey);

      songs.push({
        position: position++,
        title,
        artist,
        timestamp: '',
        scene: '',
        youtubeSearchUrl: getYouTubeSearchUrl(title, artist)
      });

      // Limit results
      if (songs.length >= 15) break;
    }
    if (songs.length >= 15) break;
  }

  if (songs.length === 0) return null;

  return {
    show,
    season: season || 1,
    episode: episode || 0,
    episodeTitle: '',
    songs,
    source: 'nme.com',
    sourceUrl: `https://www.nme.com/news/tv/every-song-on-the-${toSlug(show)}-soundtrack`,
    fallbackUsed: true
  };
}

// Parse web search results for song information
function parseWebSearchResults(
  html: string,
  show: string,
  season: number | null,
  episode: number | null
): EpisodeSoundtrack | null {
  const songs: SongEntry[] = [];

  // Extract text from search results
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ');

  // Look for common song listing patterns in search snippets
  // Pattern: "Song Title" by Artist or Artist - "Song Title"
  const patterns = [
    /"([^"]+)"\s*(?:by|–|-)\s*([A-Z][a-zA-Z\s&]+)/g,
    /([A-Z][a-zA-Z\s&]+?)\s*[–-]\s*[""]([^""]+)[""]?/g,
    /([A-Z][a-zA-Z\s&]+?)\s*[–-]\s*([A-Z][a-zA-Z\s']+)/g,
  ];

  const seenSongs = new Set<string>();
  let position = 1;

  for (const pattern of patterns) {
    let match;
    pattern.lastIndex = 0;

    while ((match = pattern.exec(text)) !== null) {
      let title = match[1]?.trim();
      let artist = match[2]?.trim();

      // Swap if needed based on pattern
      if (pattern.source.startsWith('"')) {
        // First pattern has title first
      } else {
        // Other patterns have artist first
        [artist, title] = [title, artist];
      }

      // Filter
      if (!artist || !title) continue;
      if (artist.length < 2 || title.length < 2) continue;
      if (artist.length > 50 || title.length > 80) continue;

      const songKey = `${artist}-${title}`.toLowerCase();
      if (seenSongs.has(songKey)) continue;
      seenSongs.add(songKey);

      songs.push({
        position: position++,
        title,
        artist,
        timestamp: '',
        scene: '',
        youtubeSearchUrl: getYouTubeSearchUrl(title, artist)
      });

      // Limit to avoid noise
      if (songs.length >= 20) break;
    }
    if (songs.length >= 20) break;
  }

  if (songs.length === 0) return null;

  return {
    show,
    season: season || 1,
    episode: episode || 0,
    episodeTitle: '',
    songs,
    source: 'web search',
    sourceUrl: `https://duckduckgo.com/?q=${encodeURIComponent(show + ' soundtrack')}`,
    fallbackUsed: true
  };
}

function parseEpisodeSoundtrack(
  html: string,
  show: string,
  season: number | null,
  episode: number | null
): EpisodeSoundtrack | { episodes: EpisodeSoundtrack[] } {

  // First, strip HTML tags but preserve line breaks
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8242;/g, "'")
    .replace(/\s+/g, ' ');

  const songs: SongEntry[] = [];
  const episodes: EpisodeSoundtrack[] = [];

  // Pattern: "Season 4 Episode 10" or "Succession Season 4 Episode 10"
  const episodeHeaderPattern = /(?:Succession\s+)?Season\s*(\d+)\s*Episode\s*(\d+)/gi;

  // Find all episode markers
  const episodeMarkers: { season: number; episode: number; startIndex: number }[] = [];
  let match;

  while ((match = episodeHeaderPattern.exec(text)) !== null) {
    const epSeason = parseInt(match[1], 10);
    const epNumber = parseInt(match[2], 10);
    // Avoid duplicates
    if (!episodeMarkers.some(m => m.season === epSeason && m.episode === epNumber)) {
      episodeMarkers.push({
        season: epSeason,
        episode: epNumber,
        startIndex: match.index
      });
    }
  }

  // Sort by episode number
  episodeMarkers.sort((a, b) => a.episode - b.episode);

  // Pattern for songs: "1. Song Title – Artist" or "1.Song Title – Artist"
  // Followed optionally by "[timestamp] scene"
  const songLinePattern = /(\d+)\.\s*([^–\-]+?)\s*[–-]\s*([A-Za-z][^[\n\d]*?)(?:\[([^\]]+)\])?\s*([^[\d]*?)(?=\d+\.|$)/g;

  // Simpler pattern to catch individual song entries
  const simpleSongPattern = /(\d+)\.?\s*(.+?)\s*[–-]\s*(Nicholas Britell|[A-Z][a-z]+ [A-Z][a-z]+[^[]*?)(?:\s*\[([^\]]+)\])?\s*([^[]*?)(?=\s*\d+\.|Season|Episode|$)/gi;

  // If looking for a specific episode
  if (episode !== null) {
    const targetEpisode = episodeMarkers.find(
      ep => ep.episode === episode && (season === null || ep.season === season)
    );

    if (targetEpisode) {
      const markerIndex = episodeMarkers.indexOf(targetEpisode);
      const startIdx = targetEpisode.startIndex;
      const endIdx = markerIndex < episodeMarkers.length - 1
        ? episodeMarkers[markerIndex + 1].startIndex
        : text.length;

      const episodeContent = text.substring(startIdx, Math.min(startIdx + 5000, endIdx));

      // Extract songs
      let songMatch;
      const seenSongs = new Set<string>();

      simpleSongPattern.lastIndex = 0;
      while ((songMatch = simpleSongPattern.exec(episodeContent)) !== null) {
        const position = parseInt(songMatch[1], 10);
        const title = songMatch[2]?.trim().replace(/\s+/g, ' ');
        const artist = songMatch[3]?.trim().replace(/\s+/g, ' ');
        const timestamp = parseTimestamp(songMatch[4] || '');
        const scene = songMatch[5]?.trim().replace(/\s+/g, ' ') || '';

        const songKey = `${title}-${artist}`;
        if (title && artist && !seenSongs.has(songKey) && title.length > 2) {
          seenSongs.add(songKey);
          songs.push({
            position,
            title,
            artist,
            timestamp,
            scene,
            youtubeSearchUrl: getYouTubeSearchUrl(title, artist)
          });
        }
      }

      // Sort by position
      songs.sort((a, b) => a.position - b.position);

      return {
        show,
        season: targetEpisode.season,
        episode: targetEpisode.episode,
        episodeTitle: '',
        songs,
        source: 'soundtracki.com',
        sourceUrl: `https://soundtracki.com/shows/${toSlug(show)}-season-${targetEpisode.season}-soundtrack`
      };
    }
  }

  // Return all episodes if no specific one requested
  for (let i = 0; i < episodeMarkers.length; i++) {
    const marker = episodeMarkers[i];
    const startIdx = marker.startIndex;
    const endIdx = i < episodeMarkers.length - 1
      ? episodeMarkers[i + 1].startIndex
      : text.length;

    const episodeContent = text.substring(startIdx, Math.min(startIdx + 5000, endIdx));
    const episodeSongs: SongEntry[] = [];
    const seenSongs = new Set<string>();

    let songMatch;
    simpleSongPattern.lastIndex = 0;

    while ((songMatch = simpleSongPattern.exec(episodeContent)) !== null) {
      const position = parseInt(songMatch[1], 10);
      const title = songMatch[2]?.trim().replace(/\s+/g, ' ');
      const artist = songMatch[3]?.trim().replace(/\s+/g, ' ');

      const songKey = `${title}-${artist}`;
      if (title && artist && !seenSongs.has(songKey) && title.length > 2) {
        seenSongs.add(songKey);
        episodeSongs.push({
          position,
          title,
          artist,
          timestamp: parseTimestamp(songMatch[4] || ''),
          scene: songMatch[5]?.trim().replace(/\s+/g, ' ') || '',
          youtubeSearchUrl: getYouTubeSearchUrl(title, artist)
        });
      }
    }

    episodeSongs.sort((a, b) => a.position - b.position);

    episodes.push({
      show,
      season: marker.season,
      episode: marker.episode,
      episodeTitle: '',
      songs: episodeSongs,
      source: 'soundtracki.com',
      sourceUrl: `https://soundtracki.com/shows/${toSlug(show)}-season-${marker.season}-soundtrack`
    });
  }

  return { episodes };
}
