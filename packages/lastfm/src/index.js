const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';

async function getNowPlaying(username) {
  const url = new URL(LASTFM_BASE);
  url.searchParams.set('method', 'user.getrecenttracks');
  url.searchParams.set('user', username);
  url.searchParams.set('api_key', process.env.LASTFM_API_KEY);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');

  let res;
  try {
    res = await fetch(url.toString());
  } catch {
    const err = new Error('Last.fm API unavailable');
    err.status = 502;
    throw err;
  }

  const data = await res.json();

  if (data.error) {
    const err = new Error(data.error === 6 ? 'User not found' : 'Last.fm API unavailable');
    err.status = data.error === 6 ? 404 : 502;
    throw err;
  }

  const track = data.recenttracks?.track?.[0];
  if (track && track['@attr']?.nowplaying === 'true') {
    const name = track.name;
    const artist = track.artist['#text'];
    return `Now playing: ${name} by ${artist}`;
  }

  return 'Not currently playing anything';
}

module.exports = { getNowPlaying };
