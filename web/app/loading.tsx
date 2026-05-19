export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 space-y-6">
      <div className="h-40 rounded-2xl shimmer" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-44 rounded-xl shimmer" />
        ))}
      </div>
    </div>
  );
}
