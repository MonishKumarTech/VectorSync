import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'VectorSync | Unified Workflow Engine',
  description: 'Multi-Partner Workflow & Project Tracking Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased overflow-y-scroll selection:bg-amber-500 selection:text-slate-950">
        <AuthProvider>
          <main className="w-full min-h-screen flex flex-col items-center">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}