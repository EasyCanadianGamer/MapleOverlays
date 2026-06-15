const express = require('express');
const cors = require('cors');
const { getNowPlaying } = require('@maple/lastfm');
const botRouter = require('./routes/bot');
const { migrate } = require('./migrate');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());


app.get('/nowplaying', async (req, res) => {
  const { user } = req.query;

  if (!user) {
    return res.status(400).type('text/plain').send('Error: Missing required query parameter: user');
  }

  try {
    const result = await getNowPlaying(user);
    res.type('text/plain').send(result);
  } catch (err) {
    res.status(err.status || 502).type('text/plain').send(`Error: ${err.message}`);
  }
});

app.get('/bot/token-helper', (_req, res) => {
  res.type('html').send(`<!doctype html><body><p id="out">No token — complete the OAuth flow first.</p><script>
    var p = new URLSearchParams(location.hash.slice(1));
    var t = p.get('access_token');
    if (t) { var el = document.getElementById('out'); el.textContent = 'BOT_ACCESS_TOKEN=' + t; }
  </script></body>`);
});

app.use(botRouter);

migrate()
  .then(() => app.listen(PORT, () => console.log(`Listening on port ${PORT}`)))
  .catch(err => { console.error('Startup failed:', err); process.exit(1); });
