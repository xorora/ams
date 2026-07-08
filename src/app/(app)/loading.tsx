export default function AppLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded-md bg-muted/70" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 animate-pulse rounded-xl bg-muted/60" />
        <div className="h-40 animate-pulse rounded-xl bg-muted/60" />
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-muted/50" />
    </div>
  );
}
