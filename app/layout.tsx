import type { Metadata } from 'next'
import { Bai_Jamjuree } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const baiJamjuree = Bai_Jamjuree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bai',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'LeadFrog — Lead Intelligence Platform',
  description: 'Scrape Google Maps leads, manage contacts, and grow your business with LeadFrog.',
  icons: { icon: '/logo.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={baiJamjuree.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('lf-theme')||'dark';if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}` }} />
      </head>
      <body style={{ fontFamily: 'var(--font-bai), sans-serif' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
