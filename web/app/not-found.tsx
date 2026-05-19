import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-3xl px-4 pt-20 pb-12 text-center">
      <div className="text-bvb-yellow font-black text-7xl sm:text-9xl tracking-tighter" style={{ fontFamily: "var(--font-display)" }}>
        404
      </div>
      <h1 className="mt-2 text-2xl font-bold">Diese Seite kennt nichtmal Watzke.</h1>
      <p className="mt-2 text-neutral-400">Weiter zur Startseite — da gibt’s News.</p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center px-5 py-2.5 rounded-full bg-bvb-yellow text-black font-bold hover:scale-105 transition-transform"
      >
        Zur Startseite
      </Link>
    </section>
  );
}
