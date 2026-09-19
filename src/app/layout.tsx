import type { Metadata } from 'next'
import { Bricolage_Grotesque, Geist } from 'next/font/google'
import './globals.css'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
})

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
})

export const metadata: Metadata = {
  title: 'Finanzas · Build Day Medellín',
  description: 'Ingresos, gastos en efectivo, Bancolombia por Gmail y chat con IA.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${bricolage.variable} ${geist.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
