'use client'

import { ThemeProvider } from 'next-themes'

export default function Theme({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  )
}
 

// Add the props below to force a default theme (light or dark).
// Leave ThemeProvider unconfigured to respect the user's system theme.

//       attribute="class"
//       defaultTheme="light"
//       enableSystem={false}