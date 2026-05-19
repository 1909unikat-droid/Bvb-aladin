import { FilteredPage } from "@/components/FilteredPage";
export const revalidate = 60;
export const metadata = { title: "Offiziell" };
export default function Page() {
  return (
    <FilteredPage
      eyebrow="Borussia"
      title="Offiziell"
      description="Mitteilungen vom Verein selbst — @BVB und bvb.de."
      filter={{ category: "official" }}
    />
  );
}
