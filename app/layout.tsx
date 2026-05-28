import "./globals.css";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "./_components/Providers";
import { Shell } from "./_components/Shell";

const inter = Inter({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "700", "900"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500", "700"] });

export const metadata = {
  title: "intern.pilot",
  description: "Personal job-application tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
