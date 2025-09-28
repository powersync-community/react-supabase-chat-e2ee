function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

function hslFromHash(hash: number): { h: number; s: number; l: number } {
  const h = hash % 360;
  const s = 55 + (hash % 30);
  const l = 50;
  return { h, s, l };
}

function IdenticonSvg({ seed, size }: { seed: string; size: number }) {
  const hash = djb2Hash(seed || 'fallback');
  const { h, s, l } = hslFromHash(hash);
  const color = `hsl(${h}, ${s}%, ${l}%)`;
  const bg = '#f3f4f6';
  const cells = 5;
  const cell = Math.floor(size / cells);
  const padding = Math.max(0, Math.floor((size - cell * cells) / 2));

  const bits: boolean[] = [];
  let n = hash;
  for (let i = 0; i < 15; i += 1) {
    bits.push((n & 1) === 1);
    n = (n >>> 1) ^ ((n & 1) * 0x45d9f3b);
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="img"
    >
      <rect x={0} y={0} width={size} height={size} fill={bg} rx={Math.floor(size / 6)} />
      {Array.from({ length: cells }).map((_, y) =>
        Array.from({ length: cells }).map((__, x) => {
          const mirrorIndex = x < 3 ? x : 4 - x;
          const idx = y * 3 + mirrorIndex;
          if (!bits[idx]) return null;
          return (
            <rect
              key={`${x}-${y}`}
              x={padding + x * cell}
              y={padding + y * cell}
              width={cell}
              height={cell}
              fill={color}
              rx={Math.max(1, Math.floor(cell / 6))}
            />
          );
        }),
      )}
    </svg>
  );
}

export type AvatarProps = {
  userId: string;
  size?: number;
  className?: string;
  children?: never;
};

export function Avatar({ userId, size = 40, className }: AvatarProps) {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full overflow-hidden bg-transparent shadow-sm select-none ${
        className ?? ''
      }`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <IdenticonSvg seed={userId} size={size} />
    </div>
  );
}

export function AvatarWithLabel({
  userId,
  label,
}: {
  userId: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar userId={userId} size={36} />
      <div className="flex flex-col">
        <span className="font-medium text-sm text-slate-900 dark:text-slate-100">
          {label}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
          {userId}
        </span>
      </div>
    </div>
  );
}
