import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { FileText, Zap, GitBranch, Clock, ArrowRight } from 'lucide-react';

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      {/* Hero Section */}
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-center gap-2 text-primary">
          <FileText className="h-12 w-12" />
        </div>
        
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Zero-Click Documentation
        </h1>
        
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          <span className="font-semibold text-foreground">AutoReport</span> eliminates documentation debt by autonomously writing your project report in the background. 
          Just code — your report writes itself.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          {session ? (
            <Link href="/dashboard">
              <Button size="lg" className="gap-2 text-lg px-8">
                Go to Dashboard
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          ) : (
            <Link href="/api/auth/signin">
              <Button size="lg" className="gap-2 text-lg px-8">
                Get Started with GitHub
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20 max-w-4xl">
        <div className="flex flex-col items-center space-y-3 p-6 rounded-lg border bg-card">
          <div className="p-3 rounded-full bg-primary/10">
            <GitBranch className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold text-lg">Git-Driven</h3>
          <p className="text-sm text-muted-foreground text-center">
            Push code, and the report updates automatically. No manual input required.
          </p>
        </div>

        <div className="flex flex-col items-center space-y-3 p-6 rounded-lg border bg-card">
          <div className="p-3 rounded-full bg-primary/10">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold text-lg">AI-Powered</h3>
          <p className="text-sm text-muted-foreground text-center">
            Smart routing places content in the right section using semantic analysis.
          </p>
        </div>

        <div className="flex flex-col items-center space-y-3 p-6 rounded-lg border bg-card">
          <div className="p-3 rounded-full bg-primary/10">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold text-lg">Real-Time</h3>
          <p className="text-sm text-muted-foreground text-center">
            See your report grow live. New additions are highlighted for easy review.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="mt-20 max-w-2xl text-left">
        <h2 className="text-2xl font-bold text-center mb-8">How It Works</h2>
        <ol className="space-y-4">
          <li className="flex gap-4 items-start">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">1</span>
            <div>
              <p className="font-medium">Connect your GitHub repository</p>
              <p className="text-sm text-muted-foreground">Link your project and choose a report template (IEEE, Agile, Custom)</p>
            </div>
          </li>
          <li className="flex gap-4 items-start">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">2</span>
            <div>
              <p className="font-medium">Code as usual</p>
              <p className="text-sm text-muted-foreground">Push commits to your repository — that's all you need to do</p>
            </div>
          </li>
          <li className="flex gap-4 items-start">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">3</span>
            <div>
              <p className="font-medium">Report writes itself</p>
              <p className="text-sm text-muted-foreground">AI analyzes each commit and updates the relevant sections automatically</p>
            </div>
          </li>
        </ol>
      </div>
    </div>
  );
}
