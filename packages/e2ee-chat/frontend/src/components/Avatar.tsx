
function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function hueFromString(input: string): number {
  return hashString(input) % 360;
}

function initialsFromId(id: string): string {
  const cleaned = id.replace(/[^a-z0-9]/gi, '');
  if (cleaned.length === 0) return '??';
  if (cleaned.length === 1) return cleaned[0]!.toUpperCase();
  return `${cleaned[0]!.toUpperCase()}${cleaned[cleaned.length - 1]!.toUpperCase()}`;
}

export type AvatarProps = {
  userId: string;
  size?: number;
  className?: string;
  children?: never;
};

export function Avatar({ userId, size = 40, className }: AvatarProps) {
  const hue = hueFromString(userId);
  const bg = `hsla(${hue}, 80%, 70%, 1)`;
  const text = `hsla(${(hue + 200) % 360}, 40%, 25%, 1)`;
  const initials = initialsFromId(userId);

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full font-semibold select-none shadow-sm ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        background: bg,
        color: text,
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export function AvatarWithLabel({ userId, label }: { userId: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar userId={userId} size={36} />
      <div className="flex flex-col">
        <span className="font-medium text-sm text-slate-900 dark:text-slate-100">{label}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{userId}</span>
      </div>
    </div>
  );
}
