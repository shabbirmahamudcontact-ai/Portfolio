import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  CheckSquare,
  Download,
  FileText,
  Film,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  LogOut,
  RefreshCw,
  Square,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { MediaFile } from '../../types/portfolio';
import {
  clearDriveAccessToken,
  getDriveAccessToken,
  googleDriveSignIn,
  initDriveAuth,
  logoutGoogleDrive,
} from '../../lib/firebase';

interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  thumbnailLink: string;
  webViewLink: string;
  modifiedTime: string;
  isFolder: boolean;
  importable: boolean;
}

interface FolderBreadcrumb {
  id: string;
  name: string;
}

interface GoogleDriveMediaImporterProps {
  onImported: (files: MediaFile[]) => void;
  onToast: (type: 'success' | 'error', text: string) => void;
}

const DEFAULT_FOLDER_URL =
  'https://drive.google.com/drive/folders/18UuRwT_4piU28udO4G3pSaY2IXBcwpxD';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function GoogleDriveMediaImporter({
  onImported,
  onToast,
}: GoogleDriveMediaImporterProps) {
  const [driveUser, setDriveUser] = useState<User | null>(null);
  const [hasToken, setHasToken] = useState<boolean>(() => Boolean(getDriveAccessToken()));
  const [signingIn, setSigningIn] = useState(false);

  const [folderUrl, setFolderUrl] = useState(DEFAULT_FOLDER_URL);
  const [folderStack, setFolderStack] = useState<FolderBreadcrumb[]>([]);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingList, setLoadingList] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [failedThumbIds, setFailedThumbIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = initDriveAuth(
      (user) => {
        setDriveUser(user);
        setHasToken(Boolean(getDriveAccessToken()));
      },
      () => {
        setDriveUser(null);
        setHasToken(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const loadFolder = async (targetUrlOrId: string, pushToStack = false) => {
    const token = getDriveAccessToken();
    if (!token) {
      setHasToken(false);
      setErrorMsg('Please sign in with Google to access Google Drive folders.');
      return;
    }

    setErrorMsg('');
    setLoadingList(true);
    try {
      const res = await fetch('/api/admin/media/drive/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ folderUrl: targetUrlOrId }),
      });

      const data = await res.json();
      if (res.status === 401 && data.authExpired) {
        clearDriveAccessToken();
        setHasToken(false);
        setErrorMsg(data.error || 'Google Drive session expired. Please sign in again.');
        return;
      }

      if (!res.ok) {
        setErrorMsg(data.error || 'Unable to load Google Drive folder.');
        return;
      }

      setFiles(Array.isArray(data.files) ? data.files : []);
      setSelectedIds(new Set());
      setFailedThumbIds(new Set());

      if (data.folder) {
        setFolderStack((prev) =>
          pushToStack ? [...prev, data.folder] : [data.folder]
        );
      }
    } catch {
      setErrorMsg('Network error while reading the Google Drive folder.');
    } finally {
      setLoadingList(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setSigningIn(true);
    try {
      const { user } = await googleDriveSignIn();
      setDriveUser(user);
      setHasToken(true);
      onToast('success', `Connected Google Drive (${user.email || user.displayName || 'Account'}).`);
      if (folderUrl.trim()) {
        await loadFolder(folderUrl.trim(), false);
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Google sign-in popup was closed before completing.');
      } else {
        setErrorMsg(err?.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleDisconnect = async () => {
    await logoutGoogleDrive();
    setDriveUser(null);
    setHasToken(false);
    setFiles([]);
    setFolderStack([]);
    setSelectedIds(new Set());
    setErrorMsg('');
  };

  const handleLoadSubmit = (e: FormEvent) => {
    e.preventDefault();
    void loadFolder(folderUrl.trim(), false);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const importableFiles = files.filter((f) => f.importable);

  const handleSelectAllImportable = () => {
    if (selectedIds.size === importableFiles.length && importableFiles.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(importableFiles.slice(0, 20).map((f) => f.id)));
    }
  };

  const handleImportSelected = async () => {
    const token = getDriveAccessToken();
    if (!token) {
      setHasToken(false);
      setErrorMsg('Please sign in with Google before importing files.');
      return;
    }

    const idsToImport = Array.from(selectedIds);
    if (idsToImport.length === 0) return;

    setImporting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/media/drive/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fileIds: idsToImport }),
      });

      const data = await res.json();
      if (res.status === 401 && data.authExpired) {
        clearDriveAccessToken();
        setHasToken(false);
        setErrorMsg(data.error || 'Google Drive session expired. Please sign in again.');
        if (Array.isArray(data.imported) && data.imported.length > 0) {
          onImported(data.imported);
        }
        return;
      }

      const importedList: MediaFile[] = Array.isArray(data.imported) ? data.imported : [];
      const failedList: Array<{ name: string; error: string }> = Array.isArray(data.failed)
        ? data.failed
        : [];

      if (importedList.length > 0) {
        onImported(importedList);
        setSelectedIds(new Set());
        onToast(
          'success',
          `Imported ${importedList.length} asset${importedList.length === 1 ? '' : 's'} from Google Drive.`
        );
      }

      if (failedList.length > 0) {
        setErrorMsg(
          failedList.map((f) => `${f.name}: ${f.error}`).join(' · ')
        );
      } else if (!res.ok) {
        setErrorMsg(data.error || 'Failed to import selected assets.');
      }
    } catch {
      setErrorMsg('Network error while importing files from Google Drive.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#E0DDD5] rounded-2xl p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E0DDD5] pb-4">
        <div>
          <h3 className="text-sm font-bold text-[#181A18] inline-flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-[#1B5E4A]" />
            Import Assets from Google Drive
          </h3>
          <p className="text-xs text-[#5A5E58] mt-1">
            Connect Google Drive to browse a folder URL and import images, videos, or PDFs directly
            into your Media Library.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {hasToken ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#5A5E58]">
                Connected{driveUser?.email ? `: ${driveUser.email}` : ''}
              </span>
              <button
                type="button"
                onClick={() => void handleDisconnect()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#181A18] bg-[#EFECE6] hover:bg-[#E0DDD5] rounded-lg cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Disconnect
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              disabled={signingIn}
              className="gsi-material-button"
            >
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    style={{ display: 'block' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {signingIn ? 'Connecting...' : 'Sign in with Google'}
                </span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Folder URL Bar */}
      <form onSubmit={handleLoadSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={folderUrl}
          onChange={(e) => setFolderUrl(e.target.value)}
          placeholder="https://drive.google.com/drive/folders/..."
          className="flex-1 px-3.5 py-2 text-sm bg-[#F7F5F0] border border-[#E0DDD5] rounded-lg focus:outline-none focus:border-[#1B5E4A]"
        />
        <button
          type="submit"
          disabled={!hasToken || loadingList || !folderUrl.trim()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#181A18] hover:bg-[#2F332F] disabled:opacity-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
          {loadingList ? 'Loading Folder...' : 'Load Folder'}
        </button>
      </form>

      {errorMsg && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#991B1B]"
        >
          {errorMsg}
        </div>
      )}

      {/* Folder Contents & Selection Toolbar */}
      {hasToken && folderStack.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 text-xs text-[#5A5E58]">
              {folderStack.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const parent = folderStack[folderStack.length - 2];
                    setFolderStack((prev) => prev.slice(0, -2));
                    void loadFolder(parent.id, true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#EFECE6] hover:bg-[#E0DDD5] text-[#181A18] font-semibold rounded-md cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              )}
              <span className="font-semibold text-[#181A18]">
                {folderStack.map((f) => f.name).join(' / ')}
              </span>
              <span aria-hidden="true">·</span>
              <span>{files.length} item(s)</span>
            </div>

            {importableFiles.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllImportable}
                  className="px-3 py-1.5 text-xs font-semibold text-[#181A18] bg-[#EFECE6] hover:bg-[#E0DDD5] rounded-lg cursor-pointer"
                >
                  {selectedIds.size === importableFiles.length
                    ? 'Clear Selection'
                    : `Select Importable (${Math.min(importableFiles.length, 20)})`}
                </button>
                <button
                  type="button"
                  disabled={selectedIds.size === 0 || importing}
                  onClick={() => void handleImportSelected()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#1B5E4A] hover:bg-[#144738] disabled:opacity-50 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  {importing
                    ? 'Importing...'
                    : `Import Selected (${selectedIds.size})`}
                </button>
              </div>
            )}
          </div>

          {files.length === 0 ? (
            <p className="text-xs text-[#5A5E58] py-4">
              This Google Drive folder does not contain any files.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[380px] overflow-y-auto pr-1">
              {files.map((item) => {
                const isSelected = selectedIds.has(item.id);
                const isImage = item.mimeType.startsWith('image/');
                const isVideo = item.mimeType.startsWith('video/');

                if (item.isFolder) {
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void loadFolder(item.id, true)}
                      className="text-left p-3.5 rounded-xl border border-[#E0DDD5] bg-[#F7F5F0] hover:border-[#1B5E4A] transition-colors flex items-center gap-3 cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#FFFFFF] border border-[#E0DDD5] flex items-center justify-center shrink-0 text-[#1B5E4A]">
                        <Folder className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#181A18] truncate">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-[#5A5E58]">Open Subfolder</p>
                      </div>
                    </button>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!item.importable}
                    onClick={() => item.importable && toggleSelection(item.id)}
                    className={`text-left p-3 rounded-xl border transition-colors flex items-start gap-3 ${
                      !item.importable
                        ? 'border-[#E0DDD5] bg-[#F7F5F0]/60 opacity-60 cursor-not-allowed'
                        : isSelected
                          ? 'border-[#1B5E4A] bg-[#ECFDF5]/60 cursor-pointer'
                          : 'border-[#E0DDD5] bg-[#F7F5F0] hover:border-[#1B5E4A]/50 cursor-pointer'
                    }`}
                  >
                    <div className="pt-0.5 shrink-0 text-[#1B5E4A]">
                      {item.importable ? (
                        isSelected ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4 text-[#5A5E58]" />
                        )
                      ) : (
                        <FileText className="w-4 h-4 text-[#5A5E58]" />
                      )}
                    </div>

                    <div className="w-10 h-10 rounded-lg bg-[#FFFFFF] border border-[#E0DDD5] overflow-hidden flex items-center justify-center shrink-0">
                      {item.thumbnailLink && !failedThumbIds.has(item.id) ? (
                        <img
                          src={item.thumbnailLink}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedThumbIds((prev) => new Set(prev).add(item.id))
                          }
                          className="w-full h-full object-cover"
                        />
                      ) : isImage ? (
                        <ImageIcon className="w-4 h-4 text-[#5A5E58]" />
                      ) : isVideo ? (
                        <Film className="w-4 h-4 text-[#5A5E58]" />
                      ) : (
                        <FileText className="w-4 h-4 text-[#5A5E58]" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#181A18] truncate">
                        {item.name}
                      </p>
                      <p className="text-[11px] font-mono-tabular text-[#5A5E58] truncate mt-0.5">
                        {formatBytes(item.size)} ·{' '}
                        {item.importable ? item.mimeType.split('/').pop() : 'Unsupported format'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
