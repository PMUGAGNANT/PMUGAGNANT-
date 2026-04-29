import { redirect } from "next/navigation";

export default function SignupPage() {
  redirect("/login?mode=signup&redirect=%2Fdashboard");
}
