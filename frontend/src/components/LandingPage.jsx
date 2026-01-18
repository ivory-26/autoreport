'use client';

import { motion, useAnimation, useInView } from 'framer-motion';
import { ArrowRight, Github, FileText, Zap, GitBranch, LayoutTemplate, Database, Bot, Terminal, Code2, Sparkles, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState, useRef } from 'react';

const TypewriterText = ({ text, delay = 0 }) => {
    const [displayText, setDisplayText] = useState('');

    useEffect(() => {
        let timeoutId;
        let intervalId;

        const runSequence = () => {
            setDisplayText('');
            let index = 0;

            // Clear any previous interval just in case
            if (intervalId) clearInterval(intervalId);

            intervalId = setInterval(() => {
                if (index <= text.length) {
                    setDisplayText(text.slice(0, index));
                    index++;
                } else {
                    clearInterval(intervalId);
                    timeoutId = setTimeout(runSequence, 2000); // Wait 2s before restarting
                }
            }, 50); // Slightly slower typing for better readability
        };

        // Initial start
        timeoutId = setTimeout(runSequence, delay);

        return () => {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
        };
    }, [text, delay]);

    return <span>{displayText}</span>;
}

const ShimmerText = ({ text }) => {
    return (
        <div className="relative inline-block overflow-hidden">
            <span className="relative z-10 bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">
                {text}
            </span>
        </div>
    );
}

// Custom specialized button component for the landing page
const LandingButton = ({ children, className, variant = "primary", ...props }) => {
    const baseStyles = "relative inline-flex items-center justify-center rounded-xl px-8 py-3 text-sm font-medium transition-all duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-offset-2";

    const variants = {
        primary: "bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 shadow-[0_4px_14px_0_rgba(0,0,0,0.39)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.23)] dark:shadow-[0_4px_14px_0_rgba(255,255,255,0.19)] dark:hover:shadow-[0_6px_20px_rgba(255,255,255,0.23)]",
        outline: "bg-transparent border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 shadow-sm hover:shadow-md"
    };

    return (
        <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
            {children}
        </button>
    );
};

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

export default function LandingPage({ session }) {
    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-purple-500/30">

            {/* Decorative Background Elements */}
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[128px] opacity-20 dark:opacity-40 mix-blend-screen" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[128px] opacity-20 dark:opacity-40 mix-blend-screen" />
            </div>

            {/* Hero Section */}
            <section className="relative pt-24 pb-32 px-6">
                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="max-w-5xl mx-auto text-center space-y-8"
                >
                    <motion.div variants={item} className="flex justify-center h-6">
                        {/* Space keeper */}
                    </motion.div>

                    <motion.div variants={item} className="space-y-6">
                        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-foreground">
                            Documentation <br className="hidden md:block" />
                            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">Debt is Cancelled.</span>
                        </h1>
                        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-light">
                            The <span className="text-foreground font-semibold border-b-2 border-primary/20">Zero-Click</span> report tool that writes itself while you code.
                        </p>
                    </motion.div>

                    <motion.div variants={item} className="flex flex-wrap items-center justify-center gap-6 pt-8">
                        {session ? (
                            <Link href="/dashboard">
                                <LandingButton variant="primary" className="text-lg h-14 px-10">
                                    Go to Dashboard <ArrowRight className="ml-2 h-5 w-5" />
                                </LandingButton>
                            </Link>
                        ) : (
                            <>
                                <Link href="/auth/signup">
                                    <LandingButton variant="primary" className="text-lg h-14 px-10">
                                        Start for free <ArrowRight className="ml-2 h-5 w-5" />
                                    </LandingButton>
                                </Link>
                            </>
                        )}
                    </motion.div>

                    <motion.div variants={item} className="pt-16 flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-700">

                    </motion.div>
                </motion.div>
            </section>

            {/* Bento Grid Section */}
            <section className="px-4 pb-32 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 auto-rows-[minmax(180px,auto)] gap-4 md:gap-6">

                    {/* Feature 1: Live Review (Large Card) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        viewport={{ once: true }}
                        className="col-span-1 md:col-span-6 lg:col-span-8 row-span-2 relative group overflow-hidden rounded-3xl border bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-900/50 dark:to-zinc-950/50 p-1 shadow-sm hover:shadow-md transition-shadow"
                    >
                        <div className="absolute inset-0 bg-grid-zinc-200/50 dark:bg-grid-zinc-800/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] pointer-events-none" />

                        <div className="h-full flex flex-col relative z-10 bg-white/50 dark:bg-zinc-900/50 rounded-[20px] overflow-hidden backdrop-blur-sm border border-black/5 dark:border-white/5">
                            <div className="p-6 md:p-8 flex-none border-b border-zinc-100 dark:border-zinc-800">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
                                            <FileText size={24} />
                                        </div>
                                        <h3 className="text-xl font-bold text-foreground">Live Review Interface</h3>
                                    </div>
                                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 animate-pulse">Live</Badge>
                                </div>
                                <p className="text-muted-foreground text-sm max-w-md">Real-time documentation generation. Watch as your code comments turn into professional reports instantly.</p>
                            </div>

                            <div className="flex-1 bg-zinc-50/50 dark:bg-zinc-950/50 p-6 relative overflow-hidden">
                                {/* Editor Window Simulation */}
                                <div className="w-full h-full max-h-[300px] bg-white dark:bg-zinc-900 rounded-xl border shadow-xl flex flex-col transform group-hover:scale-[1.01] transition-transform duration-500">
                                    <div className="h-10 border-b flex items-center px-4 gap-2 bg-zinc-50 dark:bg-zinc-800/50">
                                        <div className="flex gap-1.5 ">
                                            <div className="w-3 h-3 rounded-full bg-red-400/80" />
                                            <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                                            <div className="w-3 h-3 rounded-full bg-green-400/80" />
                                        </div>
                                        <div className="ml-4 text-[10px] text-muted-foreground font-mono opacity-50">report-draft-v2.md</div>
                                    </div>
                                    <div className="p-6 font-mono text-sm leading-relaxed overflow-hidden relative">
                                        <div className="flex gap-4">
                                            <div className="text-zinc-300 dark:text-zinc-700 select-none text-right w-6 flex-none space-y-1">
                                                <div>1</div><div>2</div><div>3</div><div>4</div>
                                            </div>
                                            <div className="text-foreground/80 space-y-1 w-full">
                                                <div className="text-blue-600 dark:text-blue-400 font-semibold">## Authentication Module Update</div>
                                                <div className="pl-4 border-l-2 border-zinc-200 dark:border-zinc-800">
                                                    <p className="text-zinc-600 dark:text-zinc-400 min-h-[4.5rem]">
                                                        <TypewriterText text="Implemented robust JWT authentication middleware to secure all API endpoints. Added token rotation for enhanced security compliance." delay={500} />
                                                        <motion.span
                                                            animate={{ opacity: [1, 0] }}
                                                            transition={{ repeat: Infinity, duration: 0.8 }}
                                                            className="inline-block w-2 h-4 bg-blue-500 ml-1 align-middle"
                                                        />
                                                    </p>
                                                </div>
                                                <div className="mt-4 flex items-center justify-end gap-2">
                                                    <div className="text-[10px] sm:text-xs text-muted-foreground mr-auto flex items-center gap-1.5 opacity-0 animate-[fadeIn_0.5s_ease-out_2.5s_forwards]">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                        AI Generated
                                                    </div>

                                                    <motion.button
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        className="h-7 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-medium text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                                    >
                                                        Dismiss
                                                    </motion.button>
                                                    <motion.button
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        className="h-7 px-3 rounded-lg bg-blue-600 text-white text-[10px] font-medium shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                                                    >
                                                        <Sparkles size={10} className="fill-current" />
                                                        Regenerate
                                                    </motion.button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Feature 2: Git Driven (Tall vertical card) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        viewport={{ once: true }}
                        className="col-span-1 md:col-span-3 lg:col-span-4 row-span-2 relative overflow-hidden rounded-3xl border bg-white dark:bg-zinc-900 group shadow-lg hover:shadow-xl transition-all"
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 dark:bg-purple-500/20 blur-[100px] rounded-full pointer-events-none" />

                        <div className="h-full flex flex-col relative z-10 p-6 lg:p-8">
                            <div className="absolute top-0 right-0 p-8 text-zinc-100 dark:text-zinc-800 transform rotate-12 translate-x-1/4 -translate-y-1/4 group-hover:rotate-0 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-700">
                                <GitBranch size={180} />
                            </div>

                            <div className="relative z-10 mb-auto">
                                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-6 text-foreground">
                                    <GitBranch size={24} />
                                </div>
                                <h3 className="text-2xl font-bold mb-2 text-foreground">Git-Driven Workflow</h3>
                                <p className="text-muted-foreground leading-relaxed">We listen to your commits. No extra apps to open, no context switching.</p>
                            </div>

                            <div className="mt-8 space-y-3">
                                <div className="flex items-center gap-3 text-sm font-mono text-muted-foreground border bg-secondary/50 p-3 rounded-lg">
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                    <span className="opacity-70">git commit -m &quot;fix: auth&quot;</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm font-mono text-foreground border border-green-500/20 bg-green-500/5 dark:bg-green-500/10 p-3 rounded-lg relative overflow-hidden">
                                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                                    <ShimmerText text="git push origin main" />
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Feature 3: Powerhouse AI (Square Card) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        viewport={{ once: true }}
                        // Changed span to 4 as requested
                        className="col-span-1 md:col-span-3 lg:col-span-4 relative group overflow-hidden rounded-3xl border bg-white dark:bg-zinc-900 p-6 shadow-md hover:shadow-xl transition-all"
                    >
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none" />
                        <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 transform rotate-12 scale-150">
                            <Bot size={100} />
                        </div>

                        <div className="relative z-10 h-full flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-3 bg-zinc-100 dark:bg-zinc-800 text-foreground rounded-2xl backdrop-blur-sm group-hover:scale-110 transition-transform duration-500">
                                        <Bot size={24} />
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold mb-2 text-foreground group-hover:translate-x-1 transition-transform">Powerhouse AI</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                                    Leveraging industry leading open models for deep context analysis.
                                </p>
                            </div>

                            <div className="mt-4 flex gap-2">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border backdrop-blur-sm text-xs font-mono text-foreground">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
                                    GPT-OSS-120B
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border backdrop-blur-sm text-xs font-mono text-foreground">
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.5)]"></div>
                                    Qwen3-32B
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Feature 6: LaTeX Export (Moved & Resized to 3) */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        whileHover={{ boxShadow: "0 0 20px rgba(50, 100, 255, 0.15)" }}
                        transition={{ duration: 0.5, delay: 0.45 }}
                        viewport={{ once: true }}
                        // Changed span to 3
                        className="col-span-1 md:col-span-3 lg:col-span-3 relative group overflow-hidden rounded-3xl border bg-white dark:bg-zinc-900 p-4 transition-all cursor-default flex flex-col items-center justify-center"
                    >
                        <div className="relative z-10 flex flex-col items-center text-center h-full justify-center">
                            <motion.div
                                className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-2 text-foreground shadow-inner"
                            >
                                <span className="font-serif font-bold text-lg italic">TeX</span>
                            </motion.div>
                            <h3 className="text-sm font-bold mb-1">LaTeX</h3>
                            <Badge variant="outline" className="text-[10px] h-5 px-2 bg-primary/5 border-primary/20 text-primary opacity-70">
                                Soon
                            </Badge>
                        </div>
                    </motion.div>

                    {/* Feature 5: Model Selection (Wide Card - Span 5) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.5 }}
                        viewport={{ once: true }}
                        // Changed span to 5
                        className="col-span-1 md:col-span-6 lg:col-span-5 relative group overflow-hidden rounded-3xl border bg-white dark:bg-zinc-900 p-6 hover:shadow-lg transition-all"
                    >
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-2 text-primary">
                                    <Sparkles size={20} className="fill-current" />
                                    <span className="text-sm font-bold tracking-tight text-foreground/80">FUTURE READY</span>
                                </div>
                                <h3 className="text-xl font-bold mb-1">Choose Your Intelligence</h3>
                                <p className="text-sm text-muted-foreground">Select the best model for your specific documentation needs.</p>
                            </div>

                            <div className="space-y-2">
                                {/* Gemini */}
                                <motion.div
                                    whileHover={{ x: 4 }}
                                    className="w-full bg-secondary/30 border border-transparent hover:border-border hover:bg-secondary/80 rounded-lg p-2.5 flex items-center justify-between cursor-pointer transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded bg-blue-500/10 text-blue-500 flex items-center justify-center text-[10px] font-bold">G3</div>
                                        <div>
                                            <div className="text-xs font-medium">Gemini 3.0</div>
                                            <div className="text-[10px] text-muted-foreground">Highest Concurrency</div>
                                        </div>
                                    </div>
                                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-normal opacity-70">Coming Soon</Badge>
                                </motion.div>

                                {/* Claude */}
                                <motion.div
                                    whileHover={{ x: 4 }}
                                    className="w-full bg-secondary/30 border border-transparent hover:border-border hover:bg-secondary/80 rounded-lg p-2.5 flex items-center justify-between cursor-pointer transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded bg-orange-500/10 text-orange-500 flex items-center justify-center text-[10px] font-bold">C4</div>
                                        <div>
                                            <div className="text-xs font-medium">Claude Sonnet 4.0</div>
                                            <div className="text-[10px] text-muted-foreground">Best Reasoning</div>
                                        </div>
                                    </div>
                                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-normal opacity-70">Coming Soon</Badge>
                                </motion.div>

                                {/* GPT */}
                                <motion.div
                                    whileHover={{ x: 4 }}
                                    className="w-full bg-secondary/30 border border-transparent hover:border-border hover:bg-secondary/80 rounded-lg p-2.5 flex items-center justify-between cursor-pointer transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded bg-green-500/10 text-green-500 flex items-center justify-center text-[10px] font-bold">O5</div>
                                        <div>
                                            <div className="text-xs font-medium">ChatGPT 5.2</div>
                                            <div className="text-[10px] text-muted-foreground">Fastest Inference</div>
                                        </div>
                                    </div>
                                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-normal opacity-70">Coming Soon</Badge>
                                </motion.div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Feature 4: Modern Teams (Wide Footer - Span 7) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        viewport={{ once: true }}
                        // Changed span to 7
                        className="col-span-1 md:col-span-3 lg:col-span-7 relative group overflow-hidden rounded-3xl border bg-white dark:bg-zinc-900 p-6 flex flex-row justify-between items-center hover:border-blue-500/50 transition-colors"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="z-10 text-left">
                            <h3 className="text-xl font-bold mb-1">Built for Modern Teams</h3>
                            <p className="text-sm text-muted-foreground">Collaboration is at our core.</p>
                        </div>
                        <div className="flex -space-x-4 z-10">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="w-12 h-12 rounded-full border-4 border-white dark:border-zinc-900 bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-sm font-bold transition-transform hover:-translate-y-2">
                                    U{i}
                                </div>
                            ))}
                            <div className="w-12 h-12 rounded-full border-4 border-white dark:border-zinc-900 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs text-muted-foreground">
                                +42
                            </div>
                        </div>
                    </motion.div>

                    {/* Feature 7: Templates (New, Footer Right - Span 5) */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.6 }}
                        viewport={{ once: true }}
                        // Span 5
                        className="col-span-1 md:col-span-3 lg:col-span-5 relative group overflow-hidden rounded-3xl border bg-white dark:bg-zinc-900 p-6 shadow-sm hover:shadow-md transition-all"
                    >
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-100/20 via-transparent to-transparent dark:from-purple-900/10" />

                        <div className="relative z-10 h-full flex flex-col justify-center">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold">Various Template Support</h3>
                                <FileText className="text-muted-foreground" size={20} />
                            </div>

                            <div className="flex flex-wrap gap-3">
                                {['IEEE', 'ACM', 'APA', 'MLA'].map((fmt) => (
                                    <Badge key={fmt} variant="secondary" className="rounded-full px-4 py-1.5 hover:bg-primary hover:text-primary-foreground transition-colors cursor-default">
                                        {fmt}
                                    </Badge>
                                ))}
                                <Badge variant="outline" className="rounded-full px-4 py-1.5 border-dashed opacity-70">
                                    + Custom
                                </Badge>
                            </div>
                        </div>
                    </motion.div>

                </div>
            </section>
        </div>
    );
}
