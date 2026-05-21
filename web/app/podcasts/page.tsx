import { FilteredPage } from "@/components/FilteredPage";
export const revalidate = 60;
export const metadata = { title: "Podcasts" };
export default function Page() {
  return (
    <FilteredPage
      eyebrow="Audio"
      title="Podcasts"
      description="Offizieller BVB-Podcast, Ruhr Nachrichten, vonne Süd & mehr."
      filter={{ kind: "podcast", extraSourceIds: ["yt_poehlerz"] }}
    />
  );
}
