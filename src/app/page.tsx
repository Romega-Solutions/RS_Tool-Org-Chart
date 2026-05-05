import { redirect } from "next/navigation";
import { appPath } from "@/lib/paths";

export default function Home() {
  redirect(appPath("/chart"));
}
