import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  History,
  Loader2,
  MessageSquarePlus,
  MessageSquareText,
  Search,
  Trash2,
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/ToastProvider';
import { getErrorMessage } from '../services/api';
import { chatService } from '../services/chatService';
import { formatRelativeTime } from '../services/formatters';

export default function HistoryPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [convToDelete, setConvToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadHistory = useCallback(
    async (searchTerm = '') => {
      try {
        const data = await chatService.getHistory(searchTerm);
        setConversations(data);
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to load chat history.'));
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadHistory(search);
    }, 200);
    return () => clearTimeout(timer);
  }, [search, loadHistory]);

  const handleDelete = async () => {
    if (!convToDelete) return;
    setDeleting(true);
    try {
      await chatService.deleteConversation(convToDelete.id);
      setConversations((prev) => prev.filter((c) => c.id !== convToDelete.id));
      setConvToDelete(null);
      toast.success('Conversation deleted.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete conversation.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Chat History
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Search, resume, or organize your previous AI study conversations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/chat')}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors self-start sm:self-auto"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New Conversation
        </button>
      </div>

      {/* Search bar */}
      <div className="relative max-w-lg">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversation titles or messages..."
          className="w-full rounded-xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-900 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-900/50 p-12 text-center">
          <History className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
            {search ? 'No matching conversations' : 'No saved conversations yet'}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {search
              ? 'Try searching with a different keyword.'
              : 'Ask your first question in AI Chat and it will appear here automatically.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-4 sm:p-5 hover:border-blue-500/40 transition-colors"
            >
              <button
                type="button"
                onClick={() => navigate(`/chat/${conv.id}`)}
                className="flex-1 text-left flex items-start gap-3.5 min-w-0"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                  <MessageSquareText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
                      {conv.title}
                    </h3>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                    {conv.last_message || 'Empty conversation'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                    <span>{conv.message_count} messages</span>
                    <span>•</span>
                    <span>Updated {formatRelativeTime(conv.updated_at)}</span>
                  </div>
                </div>
              </button>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => navigate(`/chat/${conv.id}`)}
                  className="rounded-xl border border-slate-200 dark:border-navy-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                >
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => setConvToDelete(conv)}
                  className="rounded-xl border border-slate-200 dark:border-navy-700 p-2 text-slate-500 hover:text-rose-500 hover:border-rose-500/30 hover:bg-rose-500/10 transition-colors"
                  aria-label={`Delete ${conv.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={Boolean(convToDelete)}
        title="Delete conversation?"
        description={`"${convToDelete?.title}" and all its messages will be permanently deleted.`}
        confirmLabel="Delete Conversation"
        loading={deleting}
        onCancel={() => setConvToDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

