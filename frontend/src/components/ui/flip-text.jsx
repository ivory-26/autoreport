"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export function FlipText({
  children,
  className,
  duration = 0.5,
  delay = 0,
}) {
  return (
    <div className={cn("overflow-hidden", className)}>
      <motion.div
        initial="initial"
        animate="animate"
        className="flex flex-wrap justify-center"
      >
        {children.split("").map((char, i) => (
          <motion.span
            key={i}
            variants={{
              initial: { opacity: 0, rotateX: -90, y: 10 },
              animate: { opacity: 1, rotateX: 0, y: 0 },
            }}
            transition={{
              duration: duration,
              delay: delay + i * 0.05,
              type: "spring",
              damping: 12,
              stiffness: 100
            }}
            className="inline-block origin-bottom"
          >
            {char === " " ? "\u00A0" : char}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
}
