// app/trends/components/Skeleton.tsx
export default function Skeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-xl border border-black/10 bg-indigo-50/60 dark:border-white/10 dark:bg-brand-900/50"
        />
      ))}
    </div>
  );
}
