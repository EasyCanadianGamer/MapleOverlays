export interface FilterConfig {
  hideCommands: boolean;
  hiddenUsers: string;
  blockedWords: string;
}

export function splitList(csv: string): string[] {
  return csv.split(/[,\n]/).map(s => s.trim().toLowerCase()).filter(Boolean);
}

export function shouldShow(msg: { login: string; text: string }, cfg: FilterConfig): boolean {
  if (cfg.hideCommands && msg.text.trimStart().startsWith('!')) return false;
  if (splitList(cfg.hiddenUsers).includes(msg.login.toLowerCase())) return false;
  const lower = msg.text.toLowerCase();
  return !splitList(cfg.blockedWords).some(word => lower.includes(word));
}
