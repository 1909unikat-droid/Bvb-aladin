export const metadata = { title: "Datenschutz" };
export default function Page() {
  return (
    <article className="prose prose-invert mx-auto max-w-3xl px-4 pt-8">
      <h1>Datenschutz</h1>
      <p className="text-neutral-400">
        Diese Seite verzichtet auf Tracking, Cookies und Drittanbieter-Analytics. Externe
        Links zu Nachrichten-Quellen, YouTube, Podigee usw. öffnen in einem neuen Tab und
        werden von den jeweiligen Anbietern eigenverantwortlich ausgeliefert.
      </p>
      <p className="text-neutral-500 mt-4">
        Der Newsfeed wird aus dem öffentlichen Endpoint <code className="text-bvb-yellow">bvb-aladin.vercel.app/data/news.json</code>{" "}
        bezogen.
      </p>
    </article>
  );
}
