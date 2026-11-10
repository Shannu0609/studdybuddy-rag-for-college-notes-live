import { useEffect, useRef, useState } from 'react';
import { Calendar, Camera, Loader2, Mail, Save, Shield, Trash2, User } from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../services/api';
import { authService } from '../services/authService';
import { dashboardService } from '../services/dashboardService';
import { formatDate, getInitials } from '../services/formatters';

function resizeImageToDataUrl(file, maxDim = 256) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const { user, updateUserState } = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    setFullName(user?.full_name || '');
    setAvatarUrl(user?.avatar_url || '');
  }, [user]);

  useEffect(() => {
    dashboardService
      .getStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file.');
      return;
    }
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setAvatarUrl(dataUrl);
    } catch {
      toast.error('Unable to read image file.');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (fullName.trim().length < 2) {
      toast.error('Full name must be at least 2 characters.');
      return;
    }

    setSaving(true);
    try {
      const updated = await authService.updateProfile({
        full_name: fullName.trim(),
        avatar_url: avatarUrl.trim(),
      });
      updateUserState(updated);
      toast.success('Profile updated successfully.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update profile.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Profile
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Manage your student identity, avatar, and account summary.
        </p>
      </div>

      {/* Profile Form Card */}
      <form
        onSubmit={handleSave}
        className="rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 space-y-6"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={fullName}
              className="h-20 w-20 rounded-2xl object-cover border border-slate-300 dark:border-navy-700"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-600/15 text-xl font-bold text-blue-500">
              {getInitials(fullName || user?.full_name)}
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Profile Picture
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFile}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-navy-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
              >
                <Camera className="h-3.5 w-3.5 text-blue-500" />
                Upload Photo
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-navy-700 px-3 py-2 text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="profile-name"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="profile-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="profile-email"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="profile-email"
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-100 dark:bg-navy-950/50 pl-10 pr-3.5 py-2.5 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      </form>

      {/* Account Information */}
      <div className="rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
          Account Information
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2 text-sm">
          <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50/70 dark:bg-navy-950/60 p-4">
            <dt className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Calendar className="h-3.5 w-3.5 text-blue-500" />
              Member Since
            </dt>
            <dd className="mt-1 font-medium text-slate-900 dark:text-white">
              {formatDate(user?.created_at)}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50/70 dark:bg-navy-950/60 p-4">
            <dt className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Shield className="h-3.5 w-3.5 text-purple-500" />
              Account ID
            </dt>
            <dd className="mt-1 font-mono text-xs text-slate-700 dark:text-slate-300 truncate">
              {user?.id}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50/70 dark:bg-navy-950/60 p-4">
            <dt className="text-xs text-slate-500 dark:text-slate-400">Uploaded PDFs</dt>
            <dd className="mt-1 font-semibold text-slate-900 dark:text-white">
              {stats?.total_documents ?? 0}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50/70 dark:bg-navy-950/60 p-4">
            <dt className="text-xs text-slate-500 dark:text-slate-400">Questions Asked</dt>
            <dd className="mt-1 font-semibold text-slate-900 dark:text-white">
              {stats?.total_questions_asked ?? 0}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

