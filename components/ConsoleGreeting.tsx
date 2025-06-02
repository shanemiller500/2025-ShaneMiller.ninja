'use client'
import { useEffect } from 'react'

export default function ConsoleGreeting() {
  useEffect(() => {
    const style = [
      'font-size: 24px',
      'font-weight: 700',
      'color:rgb(177, 34, 34)',         
    ].join(';')

    console.log('%c╔══════════════════════════════════════════════════════╗', style)
    console.log('%c║      Ah, a wild Dev appears...                       ║', style)
    console.log('%c║      Welcome to the console lounge!                  ║', style)
    console.log('%c║      Sneaking around DevTools looking for secrets?   ║', style)
    console.log('%c║      Want to Escape? Alt-F4, feed the darkness.      ║', style)
    console.log('%c╚══════════════════════════════════════════════════════╝', style)
  }, [])

  return null
}