import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Cpu,
  Database,
  FileSearch,
  FileText,
  Layers,
  Lock,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import LogoMark from '../components/LogoMark';
import { useAuth } from '../hooks/useAuth';

const FEATURES = [
  {
    icon: UploadCloud,
    title: 'Instant PDF Ingestion',
    description:
      'Drag and drop lecture slides, textbook chapters, and syllabus PDFs. PyMuPDF extracts clean page-indexed text automatically.',
  },
  {
    icon: BrainCircuit,
    title: 'Semantic Vector Retrieval',
    description:
      'Notes are split into overlapping chunks and embedded with all-MiniLM-L6-v2 inside ChromaDB for accurate semantic matching.',
  },
  {
    icon: ShieldCheck,
    title: 'Zero-Hallucination Grounding',
    description:
      'Every answer is strictly grounded in your uploaded material. If your notes do not cover a topic, Study Buddy tells you honestly.',
  },
  {
    icon: FileSearch,
    title: 'Page-Level Citations',
    description:
      'Verify every explanation with inline source document names, page numbers, similarity scores, and retrieved excerpts.',
  },
  {
    icon: Layers,
    title: 'Multi-PDF Knowledge Scope',
    description:
      'Query a single lecture handout or synthesize answers across multiple course PDFs inside one conversation.',
  },
  {
    icon: Lock,
    title: 'Private Study Vault',
    description:
      'JWT authentication and strict user-scoped vector filtering ensure nobody else can access your notes or chat history.',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Upload Course PDFs',
    description: 'Upload lecture notes, study guides, or research papers directly from your dashboard.',
  },
  {
    step: '02',
    title: 'Extract & Embed',
    description: 'PyMuPDF extracts text page-by-page while Sentence Transformers encodes chunks into ChromaDB.',
  },
  {
    step: '03',
    title: 'Ask Anything',
    description: 'Select one or more PDFs and ask conceptual questions, summaries, or exam prep prompts.',
  },
  {
    step: '04',
    title: 'Learn With Citations',
    description: 'Google Gemini synthesizes clear explanations with exact page references from your notes.',
  },
];

const RAG_PIPELINE_NODES = [
  { label: 'PDF Notes', detail: 'Uploaded Document' },
  { label: 'PyMuPDF', detail: 'Page Text Extraction' },
  { label: 'Chunker', detail: 'Overlapping Segments' },
  { label: 'MiniLM-L6-v2', detail: '384-d Embeddings' },
  { label: 'ChromaDB', detail: 'Vector Similarity Search' },
  { label: 'Gemini API', detail: 'Grounded Answer + Citations' },
];

const TECH_STACK = [
  { name: 'React & Vite', role: 'Responsive SPA Frontend', icon: Sparkles },
  { name: 'Tailwind CSS', role: 'Clean SaaS Interface', icon: Layers },
  { name: 'FastAPI & Python', role: 'High-Speed REST Backend', icon: Cpu },
  { name: 'PyMuPDF', role: 'Accurate PDF Parsing', icon: FileText },
  { name: 'Sentence Transformers', role: 'all-MiniLM-L6-v2 Embeddings', icon: BrainCircuit },
  { name: 'ChromaDB', role: 'Persistent Vector Store', icon: Database },
  { name: 'Google Gemini API', role: 'Context-Grounded Reasoning', icon: MessageSquareText },
  { name: 'SQLite / PostgreSQL', role: 'Users, Docs & Chat Metadata', icon: BookOpen },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-slate-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-navy-800/80 bg-white/85 dark:bg-navy-950/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          <Link to="/">
            <LogoMark />
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-400">
            <a href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              How It Works
            </a>
            <a href="#rag-workflow" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              RAG Architecture
            </a>
            <a href="#tech-stack" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Tech Stack
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors"
              >
                Open Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors"
                >
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-200 dark:border-navy-800/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/10 px-3.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              Retrieval-Augmented Generation for College Students
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.12]">
              Your Personal AI Study Companion
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-400 leading-relaxed">
              Upload your college notes. Ask anything. Learn smarter.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Link
                to={isAuthenticated ? '/dashboard' : '/register'}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-subtle transition-all"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#rag-workflow"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-900 hover:bg-slate-50 dark:hover:bg-navy-800 px-6 py-3.5 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors"
              >
                Explore RAG Pipeline
              </a>
            </div>
          </div>

          {/* Product Architecture Preview Card */}
          <div className="mt-16 mx-auto max-w-5xl rounded-2xl border border-slate-200 dark:border-navy-700/80 bg-white dark:bg-navy-900 shadow-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-navy-800 px-5 py-3 bg-slate-50 dark:bg-navy-950/70">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400/50" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400/50" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400/50" />
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                Study Buddy AI Workspace
              </span>
              <span className="text-xs text-purple-500 font-medium">ChromaDB + Gemini</span>
            </div>
            <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-navy-800">
              <div className="p-6 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">
                  Knowledge Scope
                </p>
                <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-3 text-xs space-y-1">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    CS401_Neural_Networks.pdf
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">42 pages • 118 chunks indexed</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-navy-800 p-3 text-xs space-y-1">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Ch3_Backpropagation.pdf
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">19 pages • 54 chunks indexed</p>
                </div>
              </div>
              <div className="md:col-span-2 p-6 space-y-4">
                <div className="ml-auto max-w-md rounded-xl bg-blue-600 px-4 py-2.5 text-sm text-white">
                  Explain backpropagation and how gradients flow through hidden layers.
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/60 p-4 space-y-3">
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    Backpropagation computes the gradient of the loss function with respect to each
                    weight using the chain rule, propagating error signals backward from the output
                    layer to earlier hidden layers [Ch3_Backpropagation.pdf, p. 4].
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="rounded-md border border-purple-500/25 bg-purple-500/10 px-2 py-0.5 text-xs text-purple-600 dark:text-purple-300">
                      Ch3_Backpropagation.pdf • Page 4
                    </span>
                    <span className="rounded-md border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-600 dark:text-blue-300">
                      CS401_Neural_Networks.pdf • Page 17
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 border-b border-slate-200 dark:border-navy-800/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">
              Built for Serious Studying
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Everything you need to master dense course material
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Turn sprawling lecture slides and textbooks into a fast, searchable, citation-backed Q&amp;A companion.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 hover:border-blue-500/40 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
                  {title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 border-b border-slate-200 dark:border-navy-800/80 bg-white dark:bg-navy-900/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-500">
              How It Works
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              From raw PDF to exam-ready answers in seconds
            </h2>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((item) => (
              <div
                key={item.step}
                className="rounded-2xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-900 p-6"
              >
                <span className="font-mono text-xs font-semibold text-blue-500">
                  STEP {item.step}
                </span>
                <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RAG Workflow Explanation */}
      <section id="rag-workflow" className="py-20 border-b border-slate-200 dark:border-navy-800/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">
              RAG Architecture
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              How Retrieval-Augmented Generation keeps answers accurate
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
              Instead of guessing from generic training weights, Study Buddy AI converts your PDFs into
              dense vector embeddings, retrieves the top matching passages for every question, and instructs
              Gemini to reason strictly over those verified excerpts.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {RAG_PIPELINE_NODES.map((node, index) => (
              <div
                key={node.label}
                className="relative rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-4"
              >
                <span className="font-mono text-[11px] text-purple-500 font-semibold">
                  0{index + 1}
                </span>
                <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                  {node.label}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {node.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section id="tech-stack" className="py-20 border-b border-slate-200 dark:border-navy-800/80 bg-white dark:bg-navy-900/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">
              Technology Stack
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Modern full-stack AI engineering
            </h2>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TECH_STACK.map(({ name, role, icon: Icon }) => (
              <div
                key={name}
                className="flex items-start gap-3.5 rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-900 p-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500 border border-purple-500/20">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-slate-50 dark:bg-navy-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <LogoMark size="sm" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Study Buddy AI • RAG-Based College Notes Assistant
          </p>
          <div className="flex items-center gap-5 text-xs text-slate-500 dark:text-slate-400">
            <Link to="/login" className="hover:text-slate-900 dark:hover:text-white">
              Login
            </Link>
            <Link to="/register" className="hover:text-slate-900 dark:hover:text-white">
              Create Account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

