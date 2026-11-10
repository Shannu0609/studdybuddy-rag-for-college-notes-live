import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Database,
  FileText,
  Layers,
  Loader2,
  MessageSquarePlus,
  MessageSquareText,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import UploadDropzone from '../components/UploadDropzone';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../services/api';
import { dashboardService } from '../services/dashboardService';
import { formatBytes, formatDate, formatRelativeTime } from '../services/formatters';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);

  const loadStats = useCallback(async () => {
    setError('');
    try {
      const data = await dashboardService.getStats();
      setStats(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load dashboard statistics.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const statCards = [
    {
      label: 'Total Uploaded PDFs',
      value: stats?.total_documents ?? 0,
      subtext: `${stats?.processed_documents ?? 0} processed & indexed`,
      icon: FileText,
      accent: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    },
    {
      label: 'Questions Asked',
      value: stats?.total_questions_asked ?? 0,
      subtext: `${stats?.total_conversations ?? 0} conversations`,
      icon: MessageSquareText,
      accent: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    },
    {
      label: 'Knowledge Chunks',
      value: stats?.total_chunks ?? 0,
      subtext: 'Stored in ChromaDB',
      icon: Database,
      accent: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    },
    {
      label: 'Study Sessions',
      value: stats?.total_conversations ?? 0,
      subtext: 'Saved chat threads',
      icon: Layers,
      accent: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome back, {user?.full_name?.split(' ')[0] || 'Scholar'}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Manage your course PDFs and ask context-grounded questions from your notes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-900 hover:bg-slate-50 dark:hover:bg-navy-800 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors"
          >
            <Upload className="h-4 w-4 text-blue-500" />
            Quick Upload PDF
          </button>
          <button
            type="button"
            onClick={() => navigate('/chat')}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            <MessageSquarePlus className="h-4 w-4" />
            Start New Chat
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Stat Cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="h-28 rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-5 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map(({ label, value, subtext, icon: Icon, accent }) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-5 hover:border-blue-500/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {label}
                </p>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${accent}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {value}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtext}</p>
            </div>
          ))}
        </div>
      )}

      {/* Recent Activity Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Documents */}
        <section className="rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Recent Documents
            </h2>
            <Link
              to="/documents"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            </div>
          ) : stats?.recent_documents?.length ? (
            <div className="space-y-3">
              {stats.recent_documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50/60 dark:bg-navy-950/60 p-3.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                        {doc.filename}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatBytes(doc.file_size)} • {doc.chunk_count} chunks • {formatDate(doc.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={doc.status} />
                    {doc.status === 'processed' && (
                      <button
                        type="button"
                        onClick={() => navigate(`/chat?doc=${doc.id}`)}
                        className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
                      >
                        Ask
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-navy-700 p-8 text-center">
              <FileText className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                No documents uploaded yet
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Upload a PDF to extract notes and build your searchable study library.
              </p>
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3.5 py-2 text-xs font-medium text-white"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload First PDF
              </button>
            </div>
          )}
        </section>

        {/* Recent Conversations */}
        <section className="rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Recent Conversations
            </h2>
            <Link
              to="/history"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              View history
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            </div>
          ) : stats?.recent_conversations?.length ? (
            <div className="space-y-3">
              {stats.recent_conversations.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => navigate(`/chat/${conv.id}`)}
                  className="w-full text-left flex items-start justify-between gap-3 rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50/60 dark:bg-navy-950/60 p-3.5 hover:border-blue-500/40 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500 mt-0.5">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                        {conv.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                        {conv.last_message || 'No messages yet'}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatRelativeTime(conv.updated_at)}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {conv.message_count} msgs
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-navy-700 p-8 text-center">
              <MessageSquareText className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                No conversations yet
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Start asking questions about your notes to see your study threads here.
              </p>
              <button
                type="button"
                onClick={() => navigate('/chat')}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3.5 py-2 text-xs font-medium text-white"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
                Ask Study Buddy
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Quick Upload Modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-6 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Upload College Notes (PDF)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Text is extracted via PyMuPDF, chunked, embedded, and stored in ChromaDB.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <UploadDropzone
              onUploaded={() => {
                loadStats();
              }}
            />

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                className="rounded-lg border border-slate-300 dark:border-navy-700 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

