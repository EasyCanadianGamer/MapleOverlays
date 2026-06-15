import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import MapleMark from '../components/ui/MapleMark';

const apiUrl = import.meta.env.VITE_API_URL as string;

const BUILTIN_DESCRIPTIONS: Record<string, string> = {
  ping:       'Check if the bot is alive',
  song:       'Currently playing track via Last.fm',
  uptime:     'How long the stream has been live',
  downtime:   'How long the stream has been offline',
  followage:  'How long you\'ve been following the channel',
  accountage: 'How old your Twitch account is',
  watchtime:  'Your total watchtime in this channel',
  tip:        'Link to support the streamer',
  commands:   'Link to this command list',
};

interface CommandRow {
  command: string;
  enabled: boolean;
  response: string | null;
  builtin: boolean;
}

export default function CommandsList() {
  const { login } = useParams<{ login: string }>();
  const [commands, setCommands] = useState<CommandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!login) return;
    fetch(`${apiUrl}/channels/${encodeURIComponent(login)}/commands`)
      .then(async r => {
        if (r.status === 404) { setNotFound(true); return; }
        setCommands(await r.json() as CommandRow[]);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [login]);

  const builtins = commands.filter(c => c.builtin);
  const custom   = commands.filter(c => !c.builtin);

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={shellStyle}>
          <div style={{ color: 'var(--ink-3)', fontSize: 14, textAlign: 'center', padding: '60px 0' }}>Loading…</div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={pageStyle}>
        <div style={shellStyle}>
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
             <MapleMark size={28} />
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: 'var(--ink-0)' }}>Channel not found</div>
            <div style={{ color: 'var(--ink-3)', fontSize: 14, marginTop: 6 }}>/{login} hasn't connected to MapleOverlays yet.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={shellStyle}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <MapleMark size={28} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--maple-300)' }}>MapleOverlays</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink-0)' }}>
            !commands
          </h1>
          <p style={{ margin: '8px 0 0', color: 'var(--ink-2)', fontSize: 15 }}>
            All commands available in <strong style={{ color: 'var(--ink-0)' }}>twitch.tv/{login}</strong>
          </p>
        </div>

        {commands.length === 0 && (
          <div style={{ color: 'var(--ink-3)', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>
            No commands configured yet.
          </div>
        )}

        {/* Built-in commands */}
        {builtins.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>
              Built-in
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {builtins.map(cmd => (
                <CommandRow key={cmd.command} cmd={cmd} />
              ))}
            </div>
          </section>
        )}

        {/* Custom commands */}
        {custom.length > 0 && (
          <section>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>
              Custom
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {custom.map(cmd => (
                <CommandRow key={cmd.command} cmd={cmd} />
              ))}
            </div>
          </section>
        )}

        <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid var(--border-1)', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-3)', fontSize: 12 }}>
          <span>Powered by</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--maple-300)' }}>MapleOverlays</span>
        </div>
      </div>
    </div>
  );
}

function CommandRow({ cmd }: { cmd: { command: string; response: string | null; builtin: boolean } }) {
  const desc = cmd.builtin
    ? BUILTIN_DESCRIPTIONS[cmd.command] ?? ''
    : cmd.response ?? '';

  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 14,
      padding: '10px 14px', borderRadius: 10,
      background: 'var(--bg-1)', border: '1px solid var(--border-1)',
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 13,
        color: 'var(--maple-200)', fontWeight: 700,
        minWidth: 120, flexShrink: 0,
      }}>
        !{cmd.command}
      </span>
      <span style={{ fontSize: 13, color: 'var(--ink-2)', flex: 1 }}>
        {desc}
      </span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--bg-0)',
  display: 'flex',
  justifyContent: 'center',
  padding: '48px 20px',
};

const shellStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 640,
};
