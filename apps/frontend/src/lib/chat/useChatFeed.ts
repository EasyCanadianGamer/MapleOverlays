import { useEffect, useRef, useState } from 'react';
import { connectChat } from './connection';
import { shouldShow, type FilterConfig } from './filters';
import type { ChatMessage } from './irc';

export interface FeedOptions {
  maxMessages: number;
  lifetimeSeconds: number;
  fadeSeconds: number;
  filters: FilterConfig;
}
export interface FeedMessage extends ChatMessage {
  key: number;
  leaving: boolean;
}

// Live chat for one channel, with filtering, a size cap, optional expiry and
// removal of deleted or banned messages. Option changes apply to new messages
// without reconnecting. An empty channel name does nothing.
export function useChatFeed(channel: string, options: FeedOptions): FeedMessage[] {
  const [messages, setMessages] = useState<FeedMessage[]>([]);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const nextKey = useRef(0);

  useEffect(() => {
    if (!channel) return;
    setMessages([]);
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
      timers.add(t);
    };

    const disconnect = connectChat(channel, (event) => {
      if (event.kind === 'clearmsg') {
        setMessages(prev => prev.filter(m => m.id !== event.targetMsgId));
        return;
      }
      if (event.kind === 'clearchat') {
        setMessages(prev => (event.targetLogin ? prev.filter(m => m.login !== event.targetLogin) : []));
        return;
      }

      const o = optionsRef.current;
      if (!shouldShow(event, o.filters)) return;

      const key = nextKey.current++;
      setMessages(prev => [...prev, { ...event, key, leaving: false }].slice(-Math.max(o.maxMessages, 1)));

      if (o.lifetimeSeconds > 0) {
        later(() => setMessages(prev => prev.map(m => (m.key === key ? { ...m, leaving: true } : m))), o.lifetimeSeconds * 1000);
        later(() => setMessages(prev => prev.filter(m => m.key !== key)), (o.lifetimeSeconds + o.fadeSeconds) * 1000);
      }
    });

    return () => {
      disconnect();
      timers.forEach(clearTimeout);
    };
  }, [channel]);

  return messages;
}
