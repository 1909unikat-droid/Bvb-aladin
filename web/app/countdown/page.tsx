import type { Metadata } from "next";
import { CountdownClient } from "./CountdownClient";

export const metadata: Metadata = {
  title: "Timer | BVB Hub",
  description: "Countdowns zu Transferfenster, Saisonstart, Deadline Day und mehr.",
};

export default function CountdownPage() {
  return <CountdownClient />;
}
