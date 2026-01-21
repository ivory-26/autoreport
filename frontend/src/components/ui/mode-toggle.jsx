"use client"

import * as React from "react"
import { Moon, Sun, Monitor, Laptop } from "lucide-react"
import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ModeToggle() {
  const { setTheme, theme, resolvedTheme } = useTheme()
  const [isOpen, setIsOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme)
    setIsOpen(false)
  }

  // Optimized variants - focusing on opacity and scale which perform better than width
  // We use the 'layout' prop on the motion component for smooth width transitions
  const containerVariants = {
    hidden: {
      opacity: 0,
      scale: 0.95,
      filter: "blur(10px)",
      transition: { duration: 0.2 }
    },
    visible: {
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        type: "spring",
        stiffness: 350,
        damping: 25,
        mass: 1,
        staggerChildren: 0.03
      }
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      filter: "blur(5px)",
      transition: { duration: 0.15 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 }
  }

  // Prevent hydration mismatch by defining effective theme only after mount
  const effectiveTheme = mounted ? resolvedTheme : 'light'

  return (
    <div className="relative z-50 flex items-center">
      <AnimatePresence mode="popLayout">
        {isOpen && (
          <motion.div
            layout
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex items-center p-1 mr-2 bg-secondary/80 backdrop-blur-md rounded-full border shadow-sm overflow-hidden"
          >
            {[
              { id: 'light', icon: Sun, label: 'Light' },
              { id: 'dark', icon: Moon, label: 'Dark' },
              { id: 'system', icon: Laptop, label: 'System' }
            ].map(({ id, icon: Icon, label }) => (
              <motion.div key={id} variants={itemVariants} className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative z-10 h-8 w-8 rounded-full hover:bg-transparent bg-transparent text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => handleThemeChange(id)}
                  title={label}
                >
                  {theme === id && (
                    <motion.div
                      layoutId="active-theme"
                      className="absolute inset-0 bg-background rounded-full shadow-sm"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30
                      }}
                    />
                  )}
                  <div className="relative z-10 flex items-center justify-center">
                    <Icon className={cn("h-4 w-4", theme === id ? "text-foreground" : "")} />
                  </div>
                </Button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative h-9 w-9 rounded-full overflow-hidden transition-colors duration-300",
          isOpen ? "bg-secondary" : "hover:bg-secondary/50"
        )}
      >
        <div className="relative flex items-center justify-center w-full h-full">
          <motion.div
            initial={false}
            animate={{
              y: effectiveTheme === 'dark' ? -30 : 0,
              opacity: effectiveTheme === 'dark' ? 0 : 1,
              scale: effectiveTheme === 'dark' ? 0.5 : 1
            }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute flex items-center justify-center"
          >
            <Sun className="h-[1.2rem] w-[1.2rem]" />
          </motion.div>
          <motion.div
            initial={false}
            animate={{
              y: effectiveTheme === 'dark' ? 0 : 30,
              opacity: effectiveTheme === 'dark' ? 1 : 0,
              scale: effectiveTheme === 'dark' ? 1 : 0.5
            }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute flex items-center justify-center"
          >
            <Moon className="h-[1.2rem] w-[1.2rem]" />
          </motion.div>
        </div>
        <span className="sr-only">Toggle theme</span>
      </Button>
    </div >
  )
}
