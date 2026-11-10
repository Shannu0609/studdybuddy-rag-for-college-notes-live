import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eraser,
  FileText,
  Loader2,
  MessageSquarePlus,
  SendHorizontal,
  Sparkles,
  Upload,
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import MarkdownMessage from '../components/MarkdownMessage';
import { useToast } from '../components/ToastProvider';
import { getErrorMessage } from '../services/api';
import { chatService } from '../services/chatService';
import { documentService } from '../services/documentService';

const EXAMPLE_QUESTIONS = [
  'Explain the perceptron algorithm.',
  'What is deep learning?',
  'Explain backpropagation.',
  'Summarize this chapter.',
  'Give important exam questions from this PDF.',
];

export default function ChatPage() {
  const { conversationId: routeConvId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [selectedDocIds, setSelectedDocIds] = useState([]);

  const [conversationId, setConversationId] = useState(routeConvId || null);
  const [conversationTitle, setConversationTitle] = useState('New Study Session');
  const [messages, setMessages] = useState([]);
  const [loadingConv, setLoadingConv] = useState(false);

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [expandedSources, setExpandedSources] = useState({});
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const justCreatedConvIdRef = useRef(null);

  // Load user's processed PDFs for knowledge source selection
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const docs = await documentService.getDocuments({ status: 'processed' });
        if (!active) return;
        setDocuments(docs);

        const preselected = searchParams.get('doc');
        if (preselected && docs.some((d) => d.id === preselected)) {
          setSelectedDocIds([preselected]);
        }
      } catch (err) {
        if (active) toast.error(getErrorMessage(err, 'Failed to load PDF sources.'));
      } finally {
        if (active) setDocsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [searchParams, toast]);

  // Load existing conversation if route has conversationId
  useEffect(() => {
    if (!routeConvId) {
      setConversationId(null);
      setConversationTitle('New Study Session');
      setMessages([]);
      return;
    }

    if (justCreatedConvIdRef.current === routeConvId) {
      justCreatedConvIdRef.current = null;
      return;
    }

    let active = true;
    setLoadingConv(true);
    (async () => {
      try {
        const detail = await chatService.getConversation(routeConvId);
        if (!active) return;
        setConversationId(detail.id);
        setConversationTitle(detail.title);
        setMessages(detail.messages || []);
        if (Array.isArray(detail.selected_document_ids) && detail.selected_document_ids.length > 0) {
          setSelectedDocIds(detail.selected_document_ids);
        }
      } catch (err) {
        if (active) {
          toast.error(getErrorMessage(err, 'Could not load conversation.'));
          navigate('/chat', { replace: true });
        }
      } finally {
        if (active) setLoadingConv(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [routeConvId, navigate, toast]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, asking]);

  const toggleDocument = (docId) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleCopy = async (msgId, content) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      toast.error('Clipboard permission denied.');
    }
  };

  const submitQuestion = useCallback(
    async (textToAsk) => {
      const cleaned = (textToAsk ?? question).trim();
      if (!cleaned || asking) return;

      if (documents.length === 0) {
        toast.info('Please upload at least one PDF document first.');
        return;
      }

      const optimisticUserMsg = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: cleaned,
        sources: [],
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticUserMsg]);
      setQuestion('');
      setAsking(true);

      try {
        const res = await chatService.askQuestion({
          question: cleaned,
          conversationId,
          documentIds: selectedDocIds,
        });

        setConversationId(res.conversation_id);
        setConversationTitle(res.conversation_title);
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== optimisticUserMsg.id),
          res.user_message,
          res.assistant_message,
        ]);

        if (!routeConvId && res.conversation_id) {
          justCreatedConvIdRef.current = res.conversation_id;
          navigate(`/chat/${res.conversation_id}`, { replace: true });
        }
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
        setQuestion(cleaned);
        toast.error(getErrorMessage(err, 'Failed to generate answer.'));
      } finally {
        setAsking(false);
      }
    },
    [asking, conversationId, documents.length, navigate, question, routeConvId, selectedDocIds, toast]
  );

  const handleNewConversation = () => {
    setConversationId(null);
    setConversationTitle('New Study Session');
    setMessages([]);
    setQuestion('');
    navigate('/chat');
    textareaRef.current?.focus();
  };

  const handleClearConversation = async () => {
    if (!conversationId) {
      setMessages([]);
      setClearModalOpen(false);
      return;
    }

    setClearing(true);
    try {
      await chatService.clearConversation(conversationId);
      setMessages([]);
      setConversationTitle('New Conversation');
      setClearModalOpen(false);
      toast.success('Conversation cleared.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to clear conversation.'));
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-[calc(100vh-7.5rem)] lg:h-[calc(100vh-4.5rem)]">
      {/* Knowledge Source Selector Panel */}
      <aside className="lg:w-72 shrink-0 rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-4 flex flex-col max-h-60 lg:max-h-full">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-navy-800">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Knowledge Sources
            </h2>
          </div>
          {selectedDocIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedDocIds([])}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Use All
            </button>
          )}
        </div>

        <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">
          {selectedDocIds.length === 0
            ? `Searching all ${documents.length} processed PDF${documents.length === 1 ? '' : 's'}`
            : `Scoped to ${selectedDocIds.length} selected PDF${selectedDocIds.length === 1 ? '' : 's'}`}
        </p>

        <div className="mt-3 flex-1 overflow-y-auto space-y-1.5 pr-1">
          {docsLoading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-navy-700 p-4 text-center">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                No indexed PDFs yet.
              </p>
              <Link
                to="/documents"
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-medium text-white"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload PDFs
              </Link>
            </div>
          ) : (
            documents.map((doc) => {
              const checked = selectedDocIds.includes(doc.id);
              return (
                <label
                  key={doc.id}
                  className={`flex items-start gap-2.5 rounded-xl border p-2.5 cursor-pointer transition-colors ${
                    checked
                      ? 'border-blue-500/40 bg-blue-500/10'
                      : 'border-slate-200 dark:border-navy-800 hover:bg-slate-50 dark:hover:bg-navy-800/60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDocument(doc.id)}
                    className="mt-0.5 rounded border-slate-300 dark:border-navy-700 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-900 dark:text-white">
                      {doc.filename}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {doc.page_count}p • {doc.chunk_count} chunks
                    </p>
                  </div>
                </label>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Conversational Panel */}
      <section className="flex-1 min-w-0 rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 flex flex-col overflow-hidden">
        {/* Chat Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-navy-800 px-4 sm:px-6 py-3.5">
          <div className="min-w-0 flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {conversationTitle}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Answers strictly grounded in your uploaded notes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNewConversation}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-navy-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            >
              <MessageSquarePlus className="h-3.5 w-3.5 text-blue-500" />
              New Chat
            </button>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setClearModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-navy-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
              >
                <Eraser className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loadingConv ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto py-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-500">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                Ask anything about your study notes
              </h2>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                Study Buddy retrieves matching chunks from ChromaDB and generates cited answers
                using Gemini.
              </p>

              <div className="mt-6 w-full space-y-2 text-left">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1">
                  Example Questions
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {EXAMPLE_QUESTIONS.map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => {
                        if (documents.length === 0) {
                          setQuestion(sample);
                          toast.info('Upload a PDF first to ask questions against your notes.');
                        } else {
                          submitQuestion(sample);
                        }
                      }}
                      className="rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50/70 dark:bg-navy-950/60 hover:border-blue-500/40 px-3.5 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 text-left transition-colors"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              const sourcesOpen = Boolean(expandedSources[msg.id]);
              const hasSources = Array.isArray(msg.sources) && msg.sources.length > 0;

              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] sm:max-w-[80%] rounded-2xl px-4 py-3.5 ${
                      isUser
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 dark:border-navy-800 bg-slate-50/80 dark:bg-navy-950/70'
                    }`}
                  >
                    {isUser ? (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    ) : (
                      <div>
                        <MarkdownMessage content={msg.content} />

                        <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-navy-800 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {hasSources && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedSources((prev) => ({
                                    ...prev,
                                    [msg.id]: !prev[msg.id],
                                  }))
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-purple-500/25 bg-purple-500/10 px-2.5 py-1 text-[11px] font-medium text-purple-600 dark:text-purple-300 hover:bg-purple-500/20 transition-colors"
                              >
                                <FileText className="h-3 w-3" />
                                {msg.sources.length} Source{msg.sources.length === 1 ? '' : 's'}
                                {sourcesOpen ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </button>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-navy-800 transition-colors"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-500" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                Copy answer
                              </>
                            )}
                          </button>
                        </div>

                        {hasSources && sourcesOpen && (
                          <div className="mt-3 space-y-2">
                            {msg.sources.map((src, idx) => (
                              <div
                                key={`${src.document_id}-${src.chunk_index}-${idx}`}
                                className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-3 text-xs"
                              >
                                <div className="flex items-center justify-between gap-2 font-medium text-slate-900 dark:text-white">
                                  <span className="truncate">
                                    {src.document_name} • Page {src.page_number}
                                  </span>
                                  <span className="shrink-0 font-mono text-[11px] text-blue-500">
                                    {Math.round((src.similarity_score || 0) * 100)}% match
                                  </span>
                                </div>
                                <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                                  &ldquo;{src.snippet}&rdquo;
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Typing / Loading Indicator */}
          {asking && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/70 px-4 py-3 flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 rounded-full bg-purple-500 animate-bounce" />
                </div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Searching notes &amp; generating cited answer...
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitQuestion();
          }}
          className="border-t border-slate-200 dark:border-navy-800 p-3 sm:p-4 bg-slate-50/70 dark:bg-navy-950/50"
        >
          <div className="flex items-end gap-2.5 rounded-xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-900 px-3.5 py-2.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
            <textarea
              ref={textareaRef}
              rows={1}
              value={question}
              disabled={asking}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitQuestion();
                }
              }}
              placeholder={
                documents.length === 0
                  ? 'Upload a PDF document first to start asking questions...'
                  : 'Ask a question about your notes (Enter to send, Shift+Enter for new line)...'
              }
              className="flex-1 resize-none bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none max-h-36"
            />
            <button
              type="submit"
              disabled={asking || !question.trim()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-navy-800 disabled:text-slate-400 text-white transition-colors"
              aria-label="Send question"
            >
              {asking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SendHorizontal className="h-4 w-4" />
              )}
            </button>
          </div>
        </form>
      </section>

      <ConfirmModal
        open={clearModalOpen}
        title="Clear this conversation?"
        description="All messages in the current chat thread will be cleared."
        confirmLabel="Clear Conversation"
        loading={clearing}
        onCancel={() => setClearModalOpen(false)}
        onConfirm={handleClearConversation}
      />
    </div>
  );
}

