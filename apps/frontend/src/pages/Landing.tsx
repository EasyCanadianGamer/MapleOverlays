import { Link } from 'react-router-dom';
import MapleMark from '../components/ui/MapleMark';

function GhChip() {
  return (
    <a
      href="https://github.com/EasyCanadianGamer/MapleOverlays"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        height: 38,
        padding: '0 14px',
        borderRadius: 12,
        background: 'var(--bg-2)',
        border: '1px solid var(--border-2)',
        color: 'var(--ink-1)',
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        fontWeight: 500,
        textDecoration: 'none',
        transition: 'border-color var(--dur-1) var(--ease-out), background var(--dur-1) var(--ease-out)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border-3)';
        (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-3)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border-2)';
        (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-2)';
      }}
    >
      <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
      </svg>
      <span>Open source</span>
      <strong style={{ color: 'var(--ink-0)' }}>★ Star</strong>
    </a>
  );
}

function NavBtn({ children, href, primary = false }: { children: string; href: string; primary?: boolean }) {
  const style: React.CSSProperties = primary
    ? {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 44,
        padding: '0 20px',
        borderRadius: 12,
        fontFamily: 'var(--font-body)',
        fontWeight: 600,
        fontSize: 15,
        cursor: 'pointer',
        border: '1px solid transparent',
        background: 'var(--maple-500)',
        color: '#fff',
        textDecoration: 'none',
        boxShadow: '0 1px 0 rgba(255,255,255,.18) inset, 0 8px 22px -8px rgba(172,7,71,.6)',
        transition: 'transform var(--dur-1) var(--ease-out), background var(--dur-1) var(--ease-out)',
      }
    : {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 44,
        padding: '0 20px',
        borderRadius: 12,
        fontFamily: 'var(--font-body)',
        fontWeight: 600,
        fontSize: 15,
        cursor: 'pointer',
        border: '1px solid var(--border-2)',
        background: 'var(--bg-3)',
        color: 'var(--ink-0)',
        textDecoration: 'none',
      };

  return href.startsWith('/') ? (
    <Link to={href} style={style}>{children}</Link>
  ) : (
    <a href={href} style={style}>{children}</a>
  );
}

interface FeatureCardProps {
  icon: string;
  title: string;
  desc: string;
  color: string;
}

function FeatureCard({ icon, title, desc, color }: FeatureCardProps) {
  return (
    <div
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border-1)',
        borderRadius: 16,
        padding: 28,
        boxShadow: 'var(--shadow-2)',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: `${color}1f`,
          border: `1px solid ${color}44`,
          display: 'grid',
          placeItems: 'center',
          marginBottom: 16,
        }}
      >
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          {icon === 'image' && <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></>}
          {icon === 'bot' && <><rect x="3" y="11" width="18" height="11" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></>}
          {icon === 'terminal' && <><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></>}
        </svg>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: 'var(--ink-0)', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}

interface TierCardProps {
  name: string;
  price: string;
  desc: string;
  color: string;
  cta: string;
  ctaHref: string;
  features: string[];
  highlight?: boolean;
}

function TierCard({ name, desc, color, cta, ctaHref, features, highlight }: TierCardProps) {
  return (
    <div
      style={{
        background: 'var(--bg-2)',
        border: highlight ? `1px solid ${color}55` : '1px solid var(--border-1)',
        borderRadius: 16,
        padding: 28,
        boxShadow: highlight ? `0 0 0 1px ${color}22, var(--shadow-2)` : 'var(--shadow-2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <div>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color,
          }}
        >
          {name}
        </span>
        {/* price hidden until finalized */}
        <div style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 4 }}>{desc}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {features.map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--ink-1)' }}>
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 5,
                background: `${color}22`,
                border: `1px solid ${color}44`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            {f}
          </div>
        ))}
      </div>
      {(ctaHref.startsWith('http') || ctaHref.startsWith('//')) ? (
        <a
          href={ctaHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            textAlign: 'center' as const,
            padding: '12px 20px',
            borderRadius: 12,
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 15,
            textDecoration: 'none',
            background: highlight ? color : 'var(--bg-3)',
            color: highlight ? '#fff' : 'var(--ink-0)',
            border: highlight ? '1px solid transparent' : '1px solid var(--border-2)',
            marginTop: 'auto',
          }}
        >
          {cta}
        </a>
      ) : (
        <Link
          to={ctaHref}
          style={{
            display: 'block',
            textAlign: 'center' as const,
            padding: '12px 20px',
            borderRadius: 12,
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 15,
            textDecoration: 'none',
            background: highlight ? color : 'var(--bg-3)',
            color: highlight ? '#fff' : 'var(--ink-0)',
            border: highlight ? '1px solid transparent' : '1px solid var(--border-2)',
            marginTop: 'auto',
          }}
        >
          {cta}
        </Link>
      )}
    </div>
  );
}

export default function Landing() {
  return (
    <div
      style={{
        background: 'var(--bg-0)',
        minHeight: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Ambient background */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(1150px 640px at 50% -12%, rgba(255,176,74,0.10), transparent 60%)',
        }}
      />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          backgroundImage: 'url(/pattern-leaves.svg)',
          backgroundSize: '240px 240px',
          opacity: 0.04,
        }}
      />

      {/* Nav */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          background: 'color-mix(in oklab, var(--bg-0) 78%, transparent)',
          borderBottom: '1px solid var(--border-1)',
        }}
      >
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', gap: 28, height: 68 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
            <MapleMark size={28} />
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 21,
                letterSpacing: '-0.02em',
                color: 'var(--ink-0)',
              }}
            >
              MapleOverlays
            </span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 26, marginLeft: 12 }}>
            {['Overlays', 'Bot', 'Commands'].map(label => (
              <Link
                key={label}
                to="/dashboard"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--ink-2)',
                  textDecoration: 'none',
                  transition: 'color var(--dur-1) var(--ease-out)',
                }}
              >
                {label}
              </Link>
            ))}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
            <GhChip />
            <NavBtn href="/dashboard" primary>Get started</NavBtn>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          position: 'relative',
          padding: '88px 0 76px',
          zIndex: 1,
        }}
      >
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.08fr 0.92fr', gap: 56, alignItems: 'center' }}>
            {/* Left */}
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 9,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--maple-200)',
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--maple-300)' }} />
                Open source streamer tools
              </div>

              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 'clamp(52px, 6.4vw, 84px)',
                  lineHeight: 0.98,
                  letterSpacing: '-0.035em',
                  marginTop: 20,
                  color: 'var(--ink-0)',
                }}
              >
                Plug in.<br />
                <span style={{ color: 'var(--maple-300)' }}>Go live.</span>
              </h1>

              <p
                style={{
                  fontSize: 19,
                  lineHeight: 1.5,
                  color: 'var(--ink-1)',
                  maxWidth: '30em',
                  marginTop: 22,
                }}
              >
                Overlays, a bot, and custom commands. <strong style={{ color: 'var(--ink-0)' }}>That's it.</strong> No sponsorship upsells, no AI growth coaching, no lock-in.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 34, flexWrap: 'wrap' }}>
                <Link
                  to="/dashboard"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 9,
                    height: 52,
                    padding: '0 28px',
                    borderRadius: 14,
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    fontSize: 16,
                    cursor: 'pointer',
                    border: '1px solid transparent',
                    background: 'var(--maple-500)',
                    color: '#fff',
                    textDecoration: 'none',
                    boxShadow: 'var(--shadow-pop)',
                  }}
                >
                  Start free
                </Link>
                <a
                  href="https://github.com/EasyCanadianGamer/MapleOverlays"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 52,
                    padding: '0 24px',
                    borderRadius: 14,
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    fontSize: 16,
                    cursor: 'pointer',
                    border: '1px solid var(--border-2)',
                    background: 'var(--bg-3)',
                    color: 'var(--ink-0)',
                    textDecoration: 'none',
                  }}
                >
                  Self-host
                </a>
              </div>

              <div
                style={{
                  marginTop: 20,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  color: 'var(--ink-3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <span>Start free. Self-host whenever you're ready.</span>
                <span style={{ width: 4, height: 4, borderRadius: 999, background: 'var(--ink-4)' }} />
                <span>No card required.</span>
              </div>
            </div>

            {/* Right — product peek */}
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  background: 'var(--bg-1)',
                  border: '1px solid var(--border-2)',
                  borderRadius: 16,
                  boxShadow: 'var(--shadow-3)',
                  overflow: 'hidden',
                }}
              >
                {/* Browser bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--border-1)',
                    background: 'var(--bg-2)',
                  }}
                >
                  <span style={{ width: 11, height: 11, borderRadius: 999, background: '#FF5F57' }} />
                  <span style={{ width: 11, height: 11, borderRadius: 999, background: '#FEBC2E' }} />
                  <span style={{ width: 11, height: 11, borderRadius: 999, background: '#28C840' }} />
                  <div
                    style={{
                      marginLeft: 10,
                      flex: 1,
                      height: 26,
                      borderRadius: 999,
                      background: 'var(--bg-0)',
                      border: '1px solid var(--border-1)',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 12px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: 'var(--ink-3)',
                    }}
                  >
                    🔒 maple.gg/dashboard
                  </div>
                </div>

                {/* Dashboard preview */}
                <div style={{ display: 'flex', height: 280 }}>
                  {/* Mini sidebar */}
                  <div
                    style={{
                      width: 56,
                      background: 'var(--bg-1)',
                      borderRight: '1px solid var(--border-1)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '16px 0',
                      gap: 16,
                    }}
                  >
                    <MapleMark size={22} />
                    {['var(--maple-400)', 'var(--ink-4)', 'var(--ink-4)', 'var(--ink-4)'].map((c, i) => (
                      <div key={i} style={{ width: 28, height: 6, borderRadius: 3, background: c }} />
                    ))}
                  </div>
                  {/* Content area */}
                  <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {['Viewers', 'Followers', 'Subs', 'Chat'].map((label, i) => (
                        <div
                          key={label}
                          style={{
                            background: 'var(--bg-2)',
                            border: '1px solid var(--border-1)',
                            borderRadius: 8,
                            padding: '8px 10px',
                          }}
                        >
                          <div style={{ fontSize: 9, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.1em' }}>{label}</div>
                          <div style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 700, color: i === 0 ? 'var(--maple-200)' : 'var(--ink-0)', marginTop: 2 }}>
                            {['1.2k', '14.8k', '312', '12.8k'][i]}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {[['#C12F5D', 'Overlays'], ['#4ED4B5', 'Bot'], ['#5BA8FF', 'Settings']].map(([color, label]) => (
                        <div
                          key={label}
                          style={{
                            background: 'var(--bg-2)',
                            border: '1px solid var(--border-1)',
                            borderRadius: 8,
                            padding: '10px 12px',
                          }}
                        >
                          <div style={{ width: 24, height: 24, borderRadius: 6, background: `${color}22`, display: 'grid', placeItems: 'center', marginBottom: 6 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-0)' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    {/* Live indicator */}
                    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: '#FF3B5C',
                          color: '#fff',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '.12em',
                        }}
                      >
                        <span className="live-dot" style={{ width: 6, height: 6 }} />
                        LIVE
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>1,284 viewers</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ position: 'relative', zIndex: 1, padding: '80px 0' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--maple-300)',
                marginBottom: 12,
              }}
            >
              Everything you need
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 'clamp(32px, 4vw, 48px)',
                letterSpacing: '-0.02em',
                color: 'var(--ink-0)',
                margin: 0,
              }}
            >
              Overlays, a bot, and custom commands. That's it.
            </h2>
            <p style={{ fontSize: 18, color: 'var(--ink-2)', marginTop: 16, maxWidth: '38em', margin: '16px auto 0' }}>
              Stream tools that get out of your way.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            <FeatureCard
              icon="image"
              color="#C12F5D"
              title="Overlays"
              desc="Browser sources that load in 80ms. Drop a URL into OBS. Follow alerts, sub celebrations, chat ticker, BRB screens."
            />
            <FeatureCard
              icon="bot"
              color="#4ED4B5"
              title="Bot"
              desc="mapleOverlays bot joins your channel. Commands, auto-mod, !song, !uptime, !lurk. You set the rules."
            />
            <FeatureCard
              icon="terminal"
              color="#5BA8FF"
              title="Commands"
              desc="Add a command, set a cooldown, save. Custom responses, viewer-triggered events, no UI maze required."
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ position: 'relative', zIndex: 1, padding: '80px 0' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 'clamp(28px, 3.5vw, 42px)',
                letterSpacing: '-0.02em',
                color: 'var(--ink-0)',
                margin: 0,
              }}
            >
              Start free. Self-host whenever you're ready.
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            <TierCard
              name="Free"
              price="$0"
              desc="Hosted by us. No credit card."
              color="var(--tier-free)"
              cta="Get started"
              ctaHref="/dashboard"
              features={['Overlays', 'Twitch bot', 'Custom commands', 'Up to 5 essential overlays + 2 custom overlays']}
            />
            <TierCard
              name="Premium"
              price="$6/mo"
              desc="Everything unlocked, hosted by us."
              color="var(--tier-premium)"
              cta="Go Premium"
              ctaHref="/dashboard"
              features={['Everything in Free', 'Unlimited overlays', 'Priority alerts', 'Custom domain' ]}
              highlight
            />
            <TierCard
              name="Self-Hosted"
              price="Free"
              desc="Run the whole stack on your own box."
              color="var(--tier-self)"
              cta="docker compose up"
              ctaHref="https://github.com/EasyCanadianGamer/MapleOverlays"
              features={['All features, no limits', 'Your data, your server', 'Community support', 'Full source access']}
            />
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '80px 0',
          borderTop: '1px solid var(--border-1)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 32px' }}>
          <MapleMark size={48} style={{ marginBottom: 24 }} />
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 'clamp(36px, 5vw, 56px)',
              letterSpacing: '-0.03em',
              color: 'var(--ink-0)',
              margin: '0 0 16px',
            }}
          >
            Plug in. Go live.
          </h2>
          <p style={{ fontSize: 18, color: 'var(--ink-2)', marginBottom: 32 }}>
            No popups. No sponsors. Just your stream.
          </p>
          <Link
            to="/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 56,
              padding: '0 32px',
              borderRadius: 14,
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: 17,
              textDecoration: 'none',
              background: 'var(--maple-500)',
              color: '#fff',
              boxShadow: 'var(--shadow-pop)',
            }}
          >
            Start for free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-1)',
          padding: '28px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: 1120,
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapleMark size={18} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-3)' }}>
            MapleOverlays — open source
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-4)' }}>
          MIT License
        </div>
      </footer>
    </div>
  );
}
