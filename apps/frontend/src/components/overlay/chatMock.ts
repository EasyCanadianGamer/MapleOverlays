import type { ViewMessage } from './ChatView';

// Sample chat for the editor preview. Ids and emote ranges are real: id 25 is Kappa.
export const MOCK_MESSAGES: ViewMessage[] = [
  { key: 1, login: 'maple_fan', displayName: 'Maple_Fan', color: '#FF6B9D', badges: [{ set: 'subscriber', version: '0' }], emotes: [], text: 'this stream is so cozy', isAction: false, leaving: false },
  { key: 2, login: 'mod_marta', displayName: 'Mod_Marta', color: '#2DD4BF', badges: [{ set: 'moderator', version: '1' }], emotes: [], text: 'welcome in everyone!', isAction: false, leaving: false },
  { key: 3, login: 'kappa_kyle', displayName: 'Kappa_Kyle', color: null, badges: [], emotes: [{ id: '25', start: 5, end: 9 }], text: 'nice Kappa play', isAction: false, leaving: false },
  { key: 4, login: 'wave_wendy', displayName: 'Wave_Wendy', color: '#FFB627', badges: [{ set: 'vip', version: '1' }], emotes: [], text: 'waves at chat', isAction: true, leaving: false },
];
