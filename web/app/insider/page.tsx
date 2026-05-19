import { FilteredPage } from "@/components/FilteredPage";
export const revalidate = 60;
export const metadata = { title: "Insider" };
export default function Page() {
  return (
    <FilteredPage
      eyebrow="Tier 1"
      title="Insider"
      description="Romano, Plettenberg, Berger, Ornstein & Co. — die echten Quellen."
      filter={{ tier: 1 }}
      emptyTitle="Insider schweigen"
    />
  );
}
