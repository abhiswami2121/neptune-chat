// Redirect to main wiki page with search handling
import { redirect } from "next/navigation";

export default function WikiSearchPage() {
  redirect("/wiki");
}
