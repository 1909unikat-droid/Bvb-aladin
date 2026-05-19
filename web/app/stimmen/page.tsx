import { FilteredPage } from "@/components/FilteredPage";
export const revalidate = 60;
export const metadata = { title: "Stimmen" };
export default function Page() {
  return (
    <FilteredPage
      eyebrow="Social"
      title="Stimmen"
      description="X/Twitter und Fan-Channels — direkt vom Puls der Südtribüne."
      filter={{ kind: "x" }}
    />
  );
}
