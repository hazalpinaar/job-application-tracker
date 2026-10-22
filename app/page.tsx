import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import Dashboard from "@/components/dashboard";
export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <Dashboard
      user={{ name: user.name, email: user.email, emailVerified: user.emailVerified }}
    />
  );
}
