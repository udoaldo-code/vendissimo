import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/Sidebar'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Vendissimo KH Dashboard',
  description: 'Vending Machine Sales Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-[#faf5ff]`}>
        <Sidebar />
        <div id="page-content" className="pt-14 md:pt-0 md:ml-56">
          {children}
        </div>
      </body>
    </html>
  )
}
