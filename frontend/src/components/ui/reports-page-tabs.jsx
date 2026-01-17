'use client';

/**
 * ReportsPageTabs - Premium animated tab navigation component
 * 
 * Design inspired by Raul Dronca (https://x.com/raul_dronca)
 * Implementation based on Wes Bos's CodePen (https://codepen.io/wesbos/pen/OPXpJvK)
 * 
 * ---
 * The MIT License (MIT)
 * Copyright (c) 2026 Wes Bos
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef(({ className, children, ...props }, ref) => {
  const [activeRect, setActiveRect] = React.useState(null);
  const [hoverRect, setHoverRect] = React.useState(null);
  const containerRef = React.useRef(null);

  const updateActiveRect = React.useCallback(() => {
    if (!containerRef.current) return;
    const activeTab = containerRef.current.querySelector('[data-state="active"]');
    if (activeTab) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();
      setActiveRect({
        left: tabRect.left - containerRect.left,
        top: tabRect.top - containerRect.top,
        width: tabRect.width,
        height: tabRect.height,
      });
    }
  }, []);

  React.useEffect(() => {
    updateActiveRect();
    const observer = new MutationObserver(updateActiveRect);
    if (containerRef.current) {
      observer.observe(containerRef.current, {
        attributes: true,
        subtree: true,
        attributeFilter: ['data-state'],
      });
    }
    window.addEventListener('resize', updateActiveRect);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateActiveRect);
    };
  }, [updateActiveRect]);

  const handleMouseEnter = (e) => {
    const target = e.target.closest('[role="tab"]');
    if (target && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const tabRect = target.getBoundingClientRect();
      setHoverRect({
        left: tabRect.left - containerRect.left,
        top: tabRect.top - containerRect.top,
        width: tabRect.width,
        height: tabRect.height,
      });
    }
  };

  const handleMouseLeave = () => {
    setHoverRect(null);
  };

  return (
    <div className="relative w-fit mx-auto">

      <TabsPrimitive.List
        ref={(node) => {
          containerRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'relative inline-flex items-center p-1.5 rounded-full',
          'bg-gradient-to-b from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-950',
          'border border-zinc-200 dark:border-zinc-800',
          'shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05)] dark:shadow-[inset_2px_2px_8px_rgba(0,0,0,0.4)]',
          className
        )}
        {...props}
      >
        {/* Hover bubble (background) */}
        {hoverRect && (
          <motion.div
            className="absolute rounded-full bg-blue-500/10 dark:bg-blue-400/10 border border-blue-500/20 dark:border-blue-400/20 shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
            initial={false}
            animate={{
              left: hoverRect.left,
              top: hoverRect.top,
              width: hoverRect.width,
              height: hoverRect.height,
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{ zIndex: 1 }}
          />
        )}

        {/* Active bubble (foreground) */}
        {activeRect && (
          <motion.div
            className="absolute rounded-full bg-gradient-to-b from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 shadow-[0_2px_8px_rgba(37,99,235,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)]"
            initial={false}
            animate={{
              left: activeRect.left,
              top: activeRect.top,
              width: activeRect.width,
              height: activeRect.height,
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{ zIndex: 2 }}
          />
        )}

        {children}
      </TabsPrimitive.List>
    </div>
  );
});
TabsList.displayName = 'SpeedRunTabsList';

const TabsTrigger = React.forwardRef(({ className, children, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'relative z-10 inline-flex items-center justify-center gap-2',
      'px-5 py-2.5 rounded-full',
      'text-sm font-medium whitespace-nowrap',
      'text-zinc-600 dark:text-zinc-400',
      'transition-all duration-300',
      'data-[state=active]:text-white dark:data-[state=active]:text-white',
      'data-[state=active]:shadow-sm',
      'hover:text-blue-600 dark:hover:text-blue-400',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      className
    )}
    {...props}
  >
    {children}
  </TabsPrimitive.Trigger>
));
TabsTrigger.displayName = 'SpeedRunTabsTrigger';

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = 'SpeedRunTabsContent';

export {
  Tabs as ReportsPageTabs,
  TabsList as ReportsPageTabsList,
  TabsTrigger as ReportsPageTabsTrigger,
  TabsContent as ReportsPageTabsContent,
};
