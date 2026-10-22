import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import LoginForm from "@/components/login-form";
export const metadata = { title: "Giriş yap | Rota" };
export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  return <LoginForm />;
}
