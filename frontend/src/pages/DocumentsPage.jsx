import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  LayoutGrid,
  List,
  Loader2,
  MessageSquareText,
  Search,
  Trash2,
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/ToastProvider';
import UploadDropzone from '../components/UploadDropzone';
import { getErrorMessage } from '../services/api';
import { documentService } from '../services/documentService';
import { formatBytes, formatDate } from '../services/formatters';

export default function DocumentsPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [docToDelete, setDocToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadDocuments = useCallback(async (searchTerm = '') => {
    try {
      const params = searchTerm.trim() ? { search: searchTerm.trim() } : {};
      const data = await documentService.getDocuments(params);
      setDocuments(data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to fetch your documents.'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDocuments(search);
    }, 200);
    return () => clearTimeout(timer);
  }, [search, loadDocuments]);

  const handleUploaded = (doc) => {
    if (doc) {
      toast.success(`"${doc.filename}" is ready for questions.`);
    }
    loadDocuments(search);
  };

  const confirmDelete = async () => {
    if (!docToDelete) return;
    setDeleting(true);
    try {
      await documentService.deleteDocument(docToDelete.id);
      toast.success(`Deleted "${docToDelete.filename}".`);
      setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      setDocToDelete(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete document.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            My Documents
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Upload college PDF notes, inspect chunk indexing status, and launch targeted Q&amp;A.
          </p>
        </div>
      </div>

      {/* Upload Dropzone Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-5 sm:p-6">
        <UploadDropzone onUploaded={handleUploaded} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search uploaded PDFs..."
            className="w-full rounded-xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-900 pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-slate-500 dark:text-slate-400 mr-2">
            {documents.length} {documents.length === 1 ? 'document' : 'documents'}
          </span>
          <div className="inline-flex rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-1">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`rounded-lg p-1.5 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded-lg p-1.5 transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Documents Display */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-900/50 p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
            {search ? 'No matching PDFs found' : 'Your study vault is empty'}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {search
              ? 'Try clearing your search query.'
              : 'Drop a PDF above to extract text and generate ChromaDB embeddings.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-5 hover:border-blue-500/40 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500">
                    <FileText className="h-5 w-5" />
                  </div>
                  <StatusBadge status={doc.status} />
                </div>

                <h3
                  className="mt-4 font-semibold text-sm text-slate-900 dark:text-white line-clamp-2"
                  title={doc.filename}
                >
                  {doc.filename}
                </h3>

                <dl className="mt-3 grid grid-cols-2 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider opacity-75">Size</dt>
                    <dd className="font-medium text-slate-700 dark:text-slate-300">
                      {formatBytes(doc.file_size)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider opacity-75">Uploaded</dt>
                    <dd className="font-medium text-slate-700 dark:text-slate-300">
                      {formatDate(doc.created_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider opacity-75">Chunks</dt>
                    <dd className="font-medium text-slate-700 dark:text-slate-300">
                      {doc.chunk_count}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider opacity-75">Pages</dt>
                    <dd className="font-medium text-slate-700 dark:text-slate-300">
                      {doc.page_count}
                    </dd>
                  </div>
                </dl>

                {doc.status === 'failed' && doc.error_message && (
                  <p className="mt-3 rounded-lg bg-rose-500/10 border border-rose-500/20 px-2.5 py-2 text-xs text-rose-600 dark:text-rose-300">
                    {doc.error_message}
                  </p>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-slate-200 dark:border-navy-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={doc.status !== 'processed'}
                  onClick={() => navigate(`/chat?doc=${doc.id}`)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-navy-800 disabled:text-slate-400 px-3 py-2 text-xs font-medium text-white transition-colors"
                >
                  <MessageSquareText className="h-3.5 w-3.5" />
                  Ask Questions
                </button>
                <button
                  type="button"
                  onClick={() => setDocToDelete(doc)}
                  className="rounded-xl border border-slate-200 dark:border-navy-700 p-2 text-slate-500 hover:text-rose-500 hover:border-rose-500/30 hover:bg-rose-500/10 transition-colors"
                  aria-label={`Delete ${doc.filename}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 overflow-hidden divide-y divide-slate-200 dark:divide-navy-800">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-slate-50/70 dark:hover:bg-navy-800/40 transition-colors"
            >
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {doc.filename}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {formatBytes(doc.file_size)} • {doc.page_count} pages • {doc.chunk_count} chunks •{' '}
                    {formatDate(doc.created_at)}
                  </p>
                  {doc.status === 'failed' && doc.error_message && (
                    <p className="mt-1 text-xs text-rose-500">{doc.error_message}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                <StatusBadge status={doc.status} />
                <button
                  type="button"
                  disabled={doc.status !== 'processed'}
                  onClick={() => navigate(`/chat?doc=${doc.id}`)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-navy-800 disabled:text-slate-400 px-3 py-1.5 text-xs font-medium text-white transition-colors"
                >
                  <MessageSquareText className="h-3.5 w-3.5" />
                  Ask Questions
                </button>
                <button
                  type="button"
                  onClick={() => setDocToDelete(doc)}
                  className="rounded-lg border border-slate-200 dark:border-navy-700 p-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                  aria-label={`Delete ${doc.filename}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={Boolean(docToDelete)}
        title="Delete PDF document?"
        description={`"${docToDelete?.filename}" and all of its ${docToDelete?.chunk_count || 0} vector embeddings in ChromaDB will be permanently removed.`}
        confirmLabel="Delete Document"
        loading={deleting}
        onCancel={() => setDocToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

