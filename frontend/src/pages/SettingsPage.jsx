import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Loader2, Moon, Sun, Trash2 } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/ToastProvider';
import { useAuth } from '../hooks/useAuth';
import { applyThemeToDom } from '../hooks/useTheme';
import { getErrorMessage } from '../services/api';
import { authService } from '../services/authService';
import { chatService } from '../services/chatService';

export default function SettingsPage() {
  const { user, updateUserState, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [theme, setTheme] = useState(user?.theme_preference || 'dark');
  const [savingTheme, setSavingTheme] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);

  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleThemeSelect = async (nextTheme) => {
    setTheme(nextTheme);
    localStorage.setItem('study_buddy_theme', nextTheme);
    applyThemeToDom(nextTheme);

    setSavingTheme(true);
    try {
      const updated = await authService.updateProfile({ theme_preference: nextTheme });
      updateUserState(updated);
      toast.success(`Switched to ${nextTheme === 'dark' ? 'Dark Navy' : 'Light'} theme.`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save theme preference.'));
    } finally {
      setSavingTheme(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await authService.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success(res.message);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to change password.'));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleClearHistory = async () => {
    setClearingHistory(true);
    try {
      await chatService.clearAllHistory();
      setClearHistoryOpen(false);
      toast.success('All chat history cleared.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to clear chat history.'));
    } finally {
      setClearingHistory(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast.error('Please enter your password to confirm account deletion.');
      return;
    }

    setDeletingAccount(true);
    try {
      await authService.deleteAccount(deletePassword);
      await logout();
      toast.success('Your account has been permanently deleted.');
      navigate('/');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete account.'));
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Customize your workspace appearance, security credentials, and stored study data.
        </p>
      </div>

      {/* Theme Selection */}
      <section className="rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Theme Selection
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Choose between Dark Navy and Crisp Light appearance.
            </p>
          </div>
          {savingTheme && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleThemeSelect('dark')}
            className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
              theme === 'dark'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-200 dark:border-navy-800 hover:border-slate-300 dark:hover:border-navy-700'
            }`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-950 text-blue-400 border border-navy-700">
              <Moon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Dark Navy</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Low-glare navy workspace (Default)
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleThemeSelect('light')}
            className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
              theme === 'light'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-200 dark:border-navy-800 hover:border-slate-300 dark:hover:border-navy-700'
            }`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-amber-500 border border-slate-200">
              <Sun className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Crisp Light</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                High-contrast daylight mode
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* Change Password */}
      <form
        onSubmit={handlePasswordChange}
        className="rounded-2xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 p-6 space-y-4"
      >
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Change Password
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Keep your account secure with a strong password.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label
              htmlFor="curr-pw"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Current Password
            </label>
            <input
              id="curr-pw"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="new-pw"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                New Password
              </label>
              <input
                id="new-pw"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full rounded-xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label
                htmlFor="conf-pw"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Confirm New Password
              </label>
              <input
                id="conf-pw"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={changingPassword}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60"
          >
            {changingPassword ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Update Password
          </button>
        </div>
      </form>

      {/* Data & Account Danger Zone */}
      <section className="rounded-2xl border border-rose-500/25 bg-white dark:bg-navy-900 p-6 space-y-4">
        <h2 className="text-base font-semibold text-rose-600 dark:text-rose-400">
          Data Management &amp; Danger Zone
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-navy-800 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Clear Chat History
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Permanently delete all conversations and messages. Your uploaded PDFs remain intact.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setClearHistoryOpen(true)}
            className="shrink-0 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-300 transition-colors"
          >
            Clear History
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-rose-500/25 bg-rose-500/5 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Delete Account
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Permanently remove your account, uploaded PDFs, ChromaDB vectors, and chat history.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDeletePassword('');
              setDeleteAccountOpen(true);
            }}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Account
          </button>
        </div>
      </section>

      <ConfirmModal
        open={clearHistoryOpen}
        title="Clear all chat history?"
        description="Every saved conversation and AI answer will be permanently deleted. This action cannot be undone."
        confirmLabel="Clear All History"
        loading={clearingHistory}
        onCancel={() => setClearHistoryOpen(false)}
        onConfirm={handleClearHistory}
      />

      <ConfirmModal
        open={deleteAccountOpen}
        title="Delete your account?"
        description="Enter your password to permanently erase your account, documents, vector embeddings, and chat history."
        confirmLabel="Permanently Delete"
        loading={deletingAccount}
        onCancel={() => setDeleteAccountOpen(false)}
        onConfirm={handleDeleteAccount}
      >
        <input
          type="password"
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
          placeholder="Confirm your password"
          className="w-full rounded-xl border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
        />
      </ConfirmModal>
    </div>
  );
}

