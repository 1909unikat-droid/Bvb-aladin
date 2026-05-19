import { FilteredPage } from "@/components/FilteredPage";
export const revalidate = 60;
export const metadata = { title: "Videos" };
export default function Page() {
  return (
    <FilteredPage
      eyebrow="YouTube"
      title="Videos"
      description="BVB-Channels, Borussen.TV, Ruhr Nachrichten BVB — kuratiert."
      filter={{ kind: "youtube" }}
    />
  );
}
