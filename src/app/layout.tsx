import type { Metadata } from 'next'
import { Fraunces, Archivo, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  axes: ['SOFT', 'WONK', 'opsz'],
})

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-jb',
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
      <body
        className={`${fraunces.variable} ${archivo.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
