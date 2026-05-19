import { FilteredPage } from "@/components/FilteredPage";
export const revalidate = 60;
export const metadata = { title: "Hintergrund" };
export default function Page() {
  return (
    <FilteredPage
      eyebrow="Analyse"
      title="Hintergrund"
      description="Analysen, Interviews, Porträts und Kolumnen rund um den BVB."
      filter={{ category: "background" }}
    />
  );
}
