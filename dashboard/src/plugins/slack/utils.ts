export function getInitials(name: string | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-yellow-500',
  'bg-lime-500',
  'bg-green-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-sky-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-purple-500',
  'bg-fuchsia-500',
  'bg-pink-500',
];

export function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash = hash & hash;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function isSlackUserId(id: string | null | undefined): boolean {
  return !!id && id.startsWith('U');
}

export function isSlackChannelId(id: string | null | undefined): boolean {
  return !!id && id.startsWith('C');
}

export function extractUserIds(text: string): string[] {
  const matches = text.matchAll(/<@([A-Z0-9]+)(?:\|[^>]+)?>/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

export function extractUserIdsFromMessages(
  messages: Array<{ text?: string; user?: string }>
): string[] {
  const ids = new Set<string>();
  for (const msg of messages) {
    if (msg.text) {
      for (const id of extractUserIds(msg.text)) {
        ids.add(id);
      }
    }
    if (msg.user) {
      ids.add(msg.user);
    }
  }
  return [...ids];
}
