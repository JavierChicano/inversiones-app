export default function ProgressionChartSkeleton() {
  return (
    <div className="h-85 w-full rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3 w-28 rounded bg-zinc-800" />
        <div className="h-3 w-20 rounded bg-zinc-800" />
      </div>

      <div className="mt-6 flex h-62.5 items-end gap-2">
        <div className="h-[35%] w-1/12 rounded-t bg-zinc-800/80" />
        <div className="h-[45%] w-1/12 rounded-t bg-zinc-800/80" />
        <div className="h-[32%] w-1/12 rounded-t bg-zinc-800/80" />
        <div className="h-[58%] w-1/12 rounded-t bg-zinc-800/80" />
        <div className="h-[48%] w-1/12 rounded-t bg-zinc-800/80" />
        <div className="h-[66%] w-1/12 rounded-t bg-zinc-800/80" />
        <div className="h-[54%] w-1/12 rounded-t bg-zinc-800/80" />
        <div className="h-[72%] w-1/12 rounded-t bg-zinc-800/80" />
        <div className="h-[60%] w-1/12 rounded-t bg-zinc-800/80" />
        <div className="h-[78%] w-1/12 rounded-t bg-zinc-800/80" />
        <div className="h-[68%] w-1/12 rounded-t bg-zinc-800/80" />
        <div className="h-[82%] w-1/12 rounded-t bg-zinc-800/80" />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 w-16 rounded bg-zinc-800" />
        <div className="h-2 w-12 rounded bg-zinc-800" />
        <div className="h-2 w-20 rounded bg-zinc-800" />
      </div>
    </div>
  );
}
