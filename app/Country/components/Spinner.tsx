export default function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex justify-center items-center py-10">
      <div className="flex items-center gap-3 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/[0.06] px-5 py-2.5 shadow-sm">
        <div className="h-4 w-4 animate-spin rounded-full border-t-2 border-b-2 border-indigo-500 dark:border-indigo-400" />
        <span className="text-sm font-medium text-gray-700 dark:text-white/80">{label}</span>
      </div>
    </div>
  );
}
