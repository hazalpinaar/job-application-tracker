import AccountRecovery from "@/components/account-recovery";
export const metadata = {
  title: "E-posta doğrulama | Rota",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default function Page() {
  return <AccountRecovery mode="verify" />;
}
