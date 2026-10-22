import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Rota | Başvuru Takip", description: "Kariyerindeki bir sonraki adımı takip et." };
export default function RootLayout({ children }: {children: React.ReactNode}) { return <html lang="tr"><body>{children}</body></html>; }
