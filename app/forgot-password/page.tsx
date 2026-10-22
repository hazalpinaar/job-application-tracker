import AccountRecovery from "@/components/account-recovery";
export const metadata = {
  title: "Şifremi unuttum | Rota",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AccountRecovery mode="forgot" />;
}
