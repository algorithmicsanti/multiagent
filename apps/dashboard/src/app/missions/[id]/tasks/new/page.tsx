import { notFound } from "next/navigation";
import { resolveServerApiUrl } from "../../../../lib/api-url";
import { NewTaskForm } from "./task-form";

const API_URL = resolveServerApiUrl();

async function getMission(id: string) {
  const res = await fetch(`${API_URL}/api/v1/missions/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

async function getActors() {
  const res = await fetch(`${API_URL}/api/v1/actors`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export default async function NewTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [mission, actors] = await Promise.all([getMission(id), getActors()]);

  if (!mission) notFound();

  return <NewTaskForm mission={mission} actors={actors} />;
}
