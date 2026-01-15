"use client"

import * as React from "react"
import { Moon, Sun, Monitor, Laptop } from "lucide-react"
import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ModeToggle() {
  const { setTheme, theme } = useTheme()
  const [isOpen, setIsOpen] = React.useState(false)

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme)
    setIsOpen(false)
  }

  return (
    <div className="relative z-50 flex items-center">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20, width: 0 }}
            animate={{ opacity: 1, x: 0, width: "auto" }}
            exit={{ opacity: 0, x: 10, width: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex items-center gap-1 overflow-hidden mr-2 bg-secondary/80 backdrop-blur-sm p-1 rounded-full border shadow-sm"
          >
            <Button 
                variant="ghost" 
                size="icon" 
                className={cn("h-8 w-8 rounded-full", theme === 'light' && "bg-background shadow-sm")}
                onClick={() => handleThemeChange("light")}
            >
              <Sun className="h-4 w-4" />
            </Button>
            <Button 
                variant="ghost" 
                size="icon" 
                className={cn("h-8 w-8 rounded-full", theme === 'dark' && "bg-background shadow-sm")}
                onClick={() => handleThemeChange("dark")}
            >
              <Moon className="h-4 w-4" />
            </Button>
            <Button 
                variant="ghost" 
                size="icon" 
                className={cn("h-8 w-8 rounded-full", theme === 'system' && "bg-background shadow-sm")}
                onClick={() => handleThemeChange("system")}
            >
              <Laptop className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <Button variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)} className="relative">
        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    </div>
  )
}
