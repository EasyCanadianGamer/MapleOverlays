import { useState, useEffect, useRef } from 'react';
import { connectTwitchChat, type TwitchChatMessage } from './twitchChat';
import type { ChatWidgetConfig } from './customOverlayWidgets';

let nextMsgId = 0;

function ChatWidgetView({ config }: { config: ChatWidgetConfig }) {
  const [messages, setMessages] = useState<(TwitchChatMessage & { id: number })[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    if (!config.channel.trim()) return;
    const disconnect = connectTwitchChat(config.channel, msg => {
      setMessages(prev => [...prev.slice(-49), { ...msg, id: nextMsgId++ }]);
    });
    return disconnect;
  }, [config.channel]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  return (
    <div
      ref={listRef}
      style={{
        width: '100%', height: '100%', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: 10, boxSizing: 'border-box',
        background: `rgba(10,7,5,${config.bgOpacity / 100})`,
        fontFamily: `${config.font}, sans-serif`,
        fontSize: config.fontSize,
        color: config.textColor,
      }}
    >
      {!config.channel.trim() && (
        <div style={{ opacity: 0.4, fontSize: 11, fontFamily: 'monospace' }}>no channel set</div>
      )}
      {messages.map(msg => (
        <div key={msg.id} style={{ wordBreak: 'break-word' }}>
          <span style={{ color: config.usernameColor || msg.color, fontWeight: 700 }}>{msg.user}</span>
          {': '}
          <span>{msg.text}</span>
        </div>
      ))}
    </div>
  );
}

export function renderChatWidget(config: ChatWidgetConfig) {
  return <ChatWidgetView config={config} />;
}
