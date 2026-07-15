import { createFileRoute } from "@tanstack/react-router";
import NutriaChat from "@/components/NutriaChat";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "NutrIA – AI Nutrition Assistant" },
      { name: "description", content: "Science-based nutrition answers powered by PubMed research and AI." },
    ],
  }),
});

function Index() {
  return <NutriaChat />;
}
