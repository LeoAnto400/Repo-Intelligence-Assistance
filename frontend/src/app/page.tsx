'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Sparkles,
  ArrowRight,
  Terminal,
  Cpu,
  Layers,
  GitBranch,
  Search,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRepoStore } from '@/features/repo-metadata/store/useRepoStore';
import { RepositoryDashboard } from '@/features/repo-metadata/components/RepositoryDashboard';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  glowColor: string;
}

function FeatureCard({ title, description, icon: Icon, glowColor }: FeatureCardProps) {
  return (
    <div className="relative group rounded-xl border border-zinc-800/60 bg-zinc-900/20 p-6 backdrop-blur-md transition-all duration-300 hover:border-zinc-700/80 hover:bg-zinc-900/40 text-left overflow-hidden">
      {/* Dynamic Hover Glow */}
      <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-2xl pointer-events-none ${glowColor}`} />
      
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover:text-indigo-400 group-hover:border-indigo-500/30 transition-all duration-300">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-semibold text-zinc-100 group-hover:text-white transition-colors text-sm">{title}</h3>
      <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}

import { useIngestStore } from '@/features/ingestion/store/useIngestStore';
import { appendLogLines, getErrorMessage } from '@/lib/runtime-safety';

export default function Home() {
  const [repoUrl, setRepoUrl] = useState('');
  const [error, setError] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const completionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { ingestRepo } = useIngestStore();
  const { fetchContext, repository } = useRepoStore();

  useEffect(() => {
    void fetchContext();
  }, [fetchContext]);
  useEffect(() => () => {
    if (completionTimeout.current) clearTimeout(completionTimeout.current);
  }, []);

  const exampleRepos = [
    { name: 'FastAPI', url: 'https://github.com/fastapi/fastapi' },
    { name: 'ChromaDB', url: 'https://github.com/chroma-core/chroma' },
    { name: 'LangGraph', url: 'https://github.com/langchain-ai/langgraph' },
  ];

  const simSteps = [
    { label: 'Connecting to GitHub repository API...', progress: 15 },
    { label: 'Cloning workspace files and source paths...', progress: 35 },
    { label: 'Executing chunking and document parser...', progress: 60 },
    { label: 'Generating code embeddings via Gemini APIs...', progress: 80 },
    { label: 'Running LangGraph orchestrator synchronization...', progress: 95 },
    { label: 'Indexing complete! Initializing environment...', progress: 100 }
  ];

  const validateUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname !== 'github.com') return 'Only GitHub repository links are supported.';
      const paths = parsed.pathname.split('/').filter(Boolean);
      if (paths.length < 2) return 'Invalid GitHub path. Format: github.com/owner/repo';
      return '';
    } catch {
      return 'Please enter a valid URL (e.g. https://github.com/owner/repo).';
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = repoUrl.trim();
    if (!cleanUrl) {
      setError('Please provide a repository URL.');
      return;
    }
    const validationError = validateUrl(cleanUrl);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setIsSimulating(true);
    setSimStep(0);
    setProgress(0);
    setSimLogs(appendLogLines([], 'INFO:   Initializing repo ingest sequence', 'INFO:   Validating source repo URL structures'));

    try {
      // Trigger actual backend ingestion call
      await ingestRepo(cleanUrl);

      // On success, snap to 100% and show success log
      setProgress(100);
      setSimStep(5);
      setSimLogs(prev => appendLogLines(
        prev,
        'INFO:   Indexing complete. Resolving schema interfaces...',
        'SUCCESS: Ingestion workflow pipeline fully resolved'
      ));

      // Wait 1 second to show completion state, then fetch active workspace details
      completionTimeout.current = setTimeout(async () => {
        setIsSimulating(false);
        await fetchContext();
      }, 1000);
    } catch (err: unknown) {
      setIsSimulating(false);
      setError(getErrorMessage(err, 'Failed to ingest repository. Please check backend connection.'));
    }
  };

  // Ingestion simulation UI logger/progress simulator (bound to active network loader)
  useEffect(() => {
    if (!isSimulating) return;

    setProgress(10);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 40) return prev + Math.floor(Math.random() * 8) + 4;
        if (prev < 70) return prev + Math.floor(Math.random() * 4) + 1;
        if (prev < 90) return prev + 1; // Slow down near 90%
        return prev;
      });
    }, 400);

    const logsList = [
      'INFO:   Connecting to GitHub repository API...',
      'INFO:   Git clone started. Downloading workspace contents...',
      'DEBUG:  Parsing codebase imports and local modules...',
      'DEBUG:  Chunker active. Generating layout blocks...',
      'INFO:   Batching embedding vectors for code indexing...',
      'INFO:   Generating ChromaDB vector collections...'
    ];

    let logIdx = 0;
    const logInterval = setInterval(() => {
      if (logIdx < logsList.length) {
        setSimLogs((prev) => appendLogLines(prev, logsList[logIdx]));
        setSimStep((prev) => Math.min(prev + 1, 4));
        logIdx++;
      }
    }, 1200);

    return () => {
      clearInterval(progressInterval);
      clearInterval(logInterval);
    };
  }, [isSimulating]);

  if (repository) {
    return <RepositoryDashboard />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center px-4 relative overflow-hidden">
      
      {/* Background Ornaments */}
      <div className="absolute top-[-10%] left-[20%] h-[500px] w-[500px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[10%] h-[400px] w-[400px] rounded-full bg-emerald-500/5 blur-[100px] pointer-events-none" />

      {/* Main Landing View */}
      <div className="max-w-4xl mx-auto w-full text-center py-16 md:py-24 space-y-16">
        
        {/* Hero Section */}
        <div className="space-y-6 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Agentic Codebase Search</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-zinc-50 to-zinc-400 bg-clip-text text-transparent leading-[1.15]">
            Understand Any GitHub Codebase in Seconds
          </h1>
          
          <p className="text-sm md:text-base text-zinc-400 leading-relaxed">
            Ingest and index public/private repositories. Chat with specialized AI agents powered by FastAPI, ChromaDB, and Gemini to map structural imports, locate features, and write adjustments.
          </p>
        </div>

        {/* Input Ingest Section */}
        <div className="max-w-xl mx-auto space-y-4">
          <form onSubmit={handleAnalyze} className="relative flex items-center p-1.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl focus-within:border-zinc-700/80 focus-within:ring-1 focus-within:ring-zinc-700/50 transition-all">
            <Search className="absolute left-4 h-4.5 w-4.5 text-zinc-500" />
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="Paste GitHub repository URL..."
              disabled={isSimulating}
              className="flex-1 bg-transparent py-2 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none disabled:opacity-50"
            />
            <Button
              type="submit"
              disabled={isSimulating}
              className="bg-zinc-50 hover:bg-zinc-200 text-zinc-950 font-medium text-xs rounded-lg px-4 h-9 shadow transition-all shrink-0 gap-1"
            >
              Analyze Repo
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </form>

          {/* Errors */}
          {error && (
            <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-rose-500 text-left px-2">
              {error}
            </motion.p>
          )}

          {/* Example Repos */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500 mr-1">Examples:</span>
            {exampleRepos.map((repo) => (
              <button
                key={repo.name}
                onClick={() => {
                  if (!isSimulating) {
                    setRepoUrl(repo.url);
                    setError('');
                  }
                }}
                disabled={isSimulating}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-zinc-900 border border-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-750 transition-colors disabled:opacity-50"
              >
                <GitBranch className="h-3 w-3 text-zinc-500" />
                {repo.name}
              </button>
            ))}
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid gap-6 md:grid-cols-3 pt-6">
          <FeatureCard
            title="RetrievalAgent"
            description="Performs semantic parsing on vector code chunks using ChromaDB collections to resolve dependencies and import scopes."
            icon={Layers}
            glowColor="bg-indigo-500"
          />
          <FeatureCard
            title="AnalysisAgent"
            description="Leverages Gemini Pro to parse structures, explain logic paths, synthesise context, and propose optimizations."
            icon={Brain}
            glowColor="bg-emerald-500"
          />
          <FeatureCard
            title="Multi-Agent Orchestrator"
            description="Coordinates state flow using LangGraph execution loops to route prompts, retrieve context, and generate chat output."
            icon={Cpu}
            glowColor="bg-pink-500"
          />
        </div>

      </div>

      {/* Analysis Ingestion Simulation Screen */}
      <AnimatePresence>
        {isSimulating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-950/95 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <div className="max-w-2xl w-full bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl flex flex-col text-left">
              
              {/* Head */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800/40">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Terminal className="h-5 w-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-100">Indexing Codebase</h3>
                    <p className="text-xs text-zinc-400 truncate max-w-[280px] sm:max-w-md">{repoUrl}</p>
                  </div>
                </div>
                <div className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20">
                  {progress}%
                </div>
              </div>

              {/* Progress Slider */}
              <div className="w-full bg-zinc-850 h-1.5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.2 }}
                  className="bg-indigo-500 h-full rounded-full"
                />
              </div>

              {/* Simulation Steps */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Analysis Status</h4>
                <div className="grid gap-2 text-xs">
                  {simSteps.map((step, idx) => {
                    const isDone = progress >= step.progress;
                    const isCurrent = simStep === idx;
                    return (
                      <div
                        key={step.label}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                          isDone 
                            ? 'bg-zinc-950/20 border-zinc-800/40 text-zinc-300' 
                            : isCurrent 
                              ? 'bg-indigo-500/5 border-indigo-500/20 text-indigo-200' 
                              : 'border-transparent text-zinc-650'
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                        ) : isCurrent ? (
                          <Sparkles className="h-4 w-4 shrink-0 text-indigo-400 animate-spin" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border border-zinc-800 shrink-0" />
                        )}
                        <span className={isCurrent ? "font-medium" : ""}>{step.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Terminal Logs Output */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">System Output Logs</h4>
                <div className="h-32 bg-zinc-950 border border-zinc-850 rounded-lg p-3 font-mono text-[10px] text-zinc-400 space-y-1.5 overflow-y-auto select-none">
                  {simLogs.filter((log): log is string => typeof log === 'string' && log.length > 0).map((log, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="text-zinc-600">[{index + 1}]</span>
                      <span className={
                        log.startsWith('SUCCESS') 
                          ? 'text-emerald-400' 
                          : log.startsWith('DEBUG') 
                            ? 'text-indigo-400/80' 
                            : 'text-zinc-300'
                      }>
                        {log}
                      </span>
                    </div>
                  ))}
                  <div className="h-1" />
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}






