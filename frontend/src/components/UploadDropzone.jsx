import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileUp, Loader2, UploadCloud } from 'lucide-react';
import { documentService } from '../services/documentService';
import { getErrorMessage } from '../services/api';
import { formatBytes } from '../services/formatters';

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export default function UploadDropzone({ onUploaded }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const validateFile = (file) => {
    if (!file) return 'No file selected.';
    const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
    const isPdfMime =
      !file.type ||
      file.type === 'application/pdf' ||
      file.type === 'application/x-pdf' ||
      file.type === 'application/octet-stream';
    if (!isPdfExt || !isPdfMime) {
      return 'Invalid file type. Only PDF documents (.pdf) are supported.';
    }
    if (file.size === 0) {
      return 'The selected PDF file is empty (0 bytes).';
    }
    if (file.size > MAX_FILE_BYTES) {
      return `File is too large (${formatBytes(file.size)}). Maximum allowed size is 25 MB.`;
    }
    return '';
  };

  const handleFile = async (file) => {
    setErrorMsg('');
    setSuccessMsg('');

    const validationError = validateFile(file);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setSelectedName(file.name);
    setUploading(true);
    setProgress(0);
    setStageLabel('Uploading PDF...');

    try {
      const doc = await documentService.uploadDocument(file, (pct) => {
        setProgress(pct);
        if (pct >= 100) {
          setStageLabel('Extracting text, chunking & indexing vectors...');
        }
      });

      setProgress(100);
      setStageLabel('');
      setSuccessMsg(
        `Indexed "${doc.filename}" (${doc.page_count} pages, ${doc.chunk_count} chunks).`
      );
      if (onUploaded) {
        onUploaded(doc);
      }
    } catch (err) {
      setErrorMsg(getErrorMessage(err, 'Failed to process PDF document.'));
      // Notify parent so failed document status also refreshes if created
      if (onUploaded) {
        onUploaded(null);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (uploading) return;
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`group relative cursor-pointer rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-all ${
          dragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-slate-300 dark:border-navy-700 hover:border-blue-500/70 bg-slate-50/70 dark:bg-navy-950/60'
        } ${uploading ? 'cursor-wait opacity-90' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500 group-hover:scale-105 transition-transform">
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <UploadCloud className="h-6 w-6" />
          )}
        </div>

        <h3 className="mt-3.5 text-sm font-semibold text-slate-900 dark:text-white">
          {uploading ? `Processing ${selectedName}` : 'Drag & drop your college notes PDF here'}
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {uploading
            ? stageLabel
            : 'Or click to browse files from your device • PDF only • Max 25 MB'}
        </p>

        {!uploading && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-medium text-white transition-colors"
          >
            <FileUp className="h-3.5 w-3.5" />
            Browse PDF File
          </button>
        )}

        {uploading && (
          <div className="mt-5 mx-auto max-w-md space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{progress < 100 ? 'Uploading' : 'Generating embeddings'}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-navy-800">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}
    </div>
  );
}

