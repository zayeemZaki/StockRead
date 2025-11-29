import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { GlobalSearch } from "@/components/global-search";
import { OnboardingTutorial } from "@/components/features";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Stock Read App",
  description: "Developed by Zayeem Zaki",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased max-w-full overflow-x-hidden`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <GlobalSearch />
          <OnboardingTutorial />
          <Toaster theme="dark" position="bottom-right" />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
