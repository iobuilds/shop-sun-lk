import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  Database, Upload, Trash2, Loader2, RotateCcw, ArrowDownToLine,
  FileJson, CheckCircle2, AlertTriangle, FolderOpen, Folder,
  Image, FileText, File, Plus, RefreshCw, Lock, Eye, Download, ChevronRight, Home,
} from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────
const formatSize = (bytes?: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const fileIcon = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "")) return <Image className="w-4 h-4 text-primary shrink-0" />;
  if (["json", "txt", "md", "csv"].includes(ext || "")) return <FileText className="w-4 h-4 text-accent-foreground shrink-0" />;
  return <File className="w-4 h-4 text-muted-foreground shrink-0" />;
};

const callBackup = async (body: any) => {
  const res = await supabase.functions.invoke("db-backup", { body });
  if (res.error) throw new Error(res.error.message);
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
};

const callRestore = async (body: any) => {
  const res = await supabase.functions.invoke("db-restore", { body });
  if (res.error) throw new Error(res.error.message);
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
};

// ─────────────────────────────────────────────────────────────────────────────

interface BackupFile {
  name: string;
  created_at: string;
  metadata: { size?: number; contentType?: string };
}

interface BucketFile {
  id?: string;
  name: string;
  updated_at?: string;
  metadata?: { size?: number; mimetype?: string };
}

interface Bucket {
  id: string;
  name: string;
  public: boolean;
  created_at: string;
}

// ── Password gate ─────────────────────────────────────────────────────────────
const PasswordGate = ({
  open, onClose, onConfirm, label,
}: { open: boolean; onClose: () => void; onConfirm: () => void; label: string }) => {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [verifying, setVerifying] = useState(false);

  const verify = async () => {
    if (!pw.trim()) { setErr("Password is required"); return; }
    setVerifying(true); setErr("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { setErr("Session expired"); setVerifying(false); return; }
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: pw });
    setVerifying(false);
    if (error) { setErr("Incorrect password"); return; }
    setPw(""); onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setPw(""); setErr(""); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock className="w-4 h-4" /> Confirm: {label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label>Admin Password</Label>
          <Input type="password" value={pw} onChange={e => { setPw(e.target.value); setErr(""); }}
            onKeyDown={e => e.key === "Enter" && verify()} placeholder="Enter your password" autoFocus />
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setPw(""); setErr(""); onClose(); }}>Cancel</Button>
          <Button onClick={verify} disabled={verifying}>
            {verifying && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DB SNAPSHOTS TAB
// ─────────────────────────────────────────────────────────────────────────────
const DbSnapshotsTab = () => {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");

  // Gate state
  const [pwGate, setPwGate] = useState<{ open: boolean; label: string; action: () => void }>({ open: false, label: "", action: () => {} });
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Upload restore
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadedData, setUploadedData] = useState<any>(null);
  const [uploadFileName, setUploadFileName] = useState("");

  const gate = (label: string, action: () => void) => setPwGate({ open: true, label, action });
  const closeGate = () => setPwGate(g => ({ ...g, open: false }));

  const load = async () => {
    setLoading(true);
    try {
      const d = await callBackup({ action: "list" });
      setBackups(d.files || []);
      setLogs(d.logs || []);
    } catch (e: any) {
      toast({ title: "Error loading backups", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const createSnapshot = async () => {
    setCreating(true);
    setProgress(10); setProgressLabel("Reading database tables...");
    try {
      setProgress(40); setProgressLabel("Compressing JSON...");
      const d = await callBackup({ action: "backup" });
      setProgress(100); setProgressLabel("Done!");
      toast({ title: "Snapshot created", description: `${d.file_name} (${formatSize(d.size)})` });
      load();
    } catch (e: any) {
      toast({ title: "Snapshot failed", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
      setTimeout(() => { setProgress(0); setProgressLabel(""); }, 1500);
    }
  };

  const downloadSnapshot = async (fileName: string) => {
    setDownloading(fileName);
    try {
      const urlData = await callRestore({ action: "download_url", file_name: fileName });
      if (!urlData?.url) throw new Error("No URL returned");
      const resp = await fetch(urlData.url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      toast({ title: "Downloaded", description: fileName });
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    } finally { setDownloading(null); }
  };

  const restoreSnapshot = async (fileName: string) => {
    setRestoring(fileName); setConfirmRestore(null);
    setProgress(10); setProgressLabel("Downloading snapshot...");
    try {
      setProgress(40); setProgressLabel("Restoring tables...");
      const d = await callRestore({ action: "restore", file_name: fileName });
      setProgress(100); setProgressLabel("Done!");
      toast({ title: "Database restored", description: `${d.rows_restored ?? 0} rows restored from ${fileName}` });
      load();
    } catch (e: any) {
      toast({ title: "Restore failed", description: e.message, variant: "destructive" });
    } finally {
      setRestoring(null);
      setTimeout(() => { setProgress(0); setProgressLabel(""); }, 1500);
    }
  };

  const deleteSnapshot = async (fileName: string) => {
    setDeleting(fileName); setConfirmDelete(null);
    try {
      await callBackup({ action: "delete", file_name: fileName });
      toast({ title: "Snapshot deleted" });
      load();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally { setDeleting(null); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      setUploadedData(data); setUploadFileName(file.name);
    } catch {
      toast({ title: "Invalid file", description: "Must be a valid JSON snapshot", variant: "destructive" });
    }
    e.target.value = "";
  };

  const restoreFromUpload = async () => {
    if (!uploadedData) return;
    setRestoring("upload"); setUploadedData(null);
    setProgress(10); setProgressLabel("Restoring from uploaded file...");
    try {
      setProgress(50); setProgressLabel("Inserting rows...");
      const d = await callRestore({ action: "restore", data: uploadedData });
      setProgress(100); setProgressLabel("Done!");
      toast({ title: "Restored from file", description: `${d.rows_restored ?? 0} rows restored` });
      load();
    } catch (e: any) {
      toast({ title: "Restore failed", description: e.message, variant: "destructive" });
    } finally {
      setRestoring(null);
      setTimeout(() => { setProgress(0); setProgressLabel(""); }, 1500);
    }
  };

  const jsonBackups = backups.filter(b => b.name.endsWith(".json"));

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      {progress > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground font-medium">{progressLabel}</span>
            <span className="text-muted-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Actions row */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => gate("create a database snapshot", createSnapshot)} disabled={creating}>
          {creating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Database className="w-4 h-4 mr-1.5" />}
          Create Snapshot
        </Button>

        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={!!restoring}>
          <Upload className="w-4 h-4 mr-1.5" /> Upload & Restore JSON
        </Button>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileUpload} />

        <Button variant="ghost" size="icon" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>

      {/* Upload restore confirm */}
      {uploadedData && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Ready to restore: <span className="font-mono">{uploadFileName}</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">This will overwrite existing database data. This cannot be undone.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setUploadedData(null)}>Cancel</Button>
            <Button size="sm" variant="destructive" onClick={() => gate("restore from uploaded file", restoreFromUpload)}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Restore Now
            </Button>
          </div>
        </div>
      )}

      {/* Snapshot list */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-muted/30 px-4 py-3 flex items-center gap-2 border-b border-border">
          <FileJson className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Saved Snapshots</span>
          <Badge variant="secondary" className="ml-auto">{jsonBackups.length}</Badge>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : jsonBackups.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">No snapshots yet. Create one above.</div>
        ) : (
          <div className="divide-y divide-border">
            {jsonBackups.map(b => {
              const isRestoring = restoring === b.name;
              const isDownloading = downloading === b.name;
              const isDeleting = deleting === b.name;
              return (
                <div key={b.name} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                  <FileJson className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate font-mono">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(b.created_at).toLocaleString()} · {formatSize(b.metadata?.size)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => downloadSnapshot(b.name)} disabled={isDownloading || isRestoring}>
                      {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowDownToLine className="w-3.5 h-3.5" />}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmRestore(b.name)} disabled={isRestoring || !!restoring}>
                      {isRestoring ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RotateCcw className="w-3.5 h-3.5 mr-1" />}
                      Restore
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(b.name)} disabled={isDeleting}>
                      {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 text-destructive" />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent logs */}
      {logs.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-muted/30 px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-foreground">Recent Activity</span>
          </div>
          <div className="divide-y divide-border max-h-48 overflow-y-auto">
            {logs.slice(0, 20).map((l: any) => (
              <div key={l.id} className="flex items-start gap-3 px-4 py-2.5 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-secondary shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium capitalize text-foreground">{l.action?.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground ml-1 font-mono">{l.file_name}</span>
                  {l.note && <p className="text-muted-foreground mt-0.5">{l.note}</p>}
                </div>
                <span className="text-muted-foreground shrink-0">{new Date(l.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Restore confirm */}
      <AlertDialog open={!!confirmRestore} onOpenChange={v => !v && setConfirmRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="w-5 h-5" /> Restore Database?</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>overwrite all current data</strong> with the contents of <span className="font-mono">{confirmRestore}</span>. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => gate("restore database", () => restoreSnapshot(confirmRestore!))}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={v => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Snapshot?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete <span className="font-mono">{confirmDelete}</span>.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteSnapshot(confirmDelete!)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PasswordGate open={pwGate.open} onClose={closeGate} label={pwGate.label} onConfirm={() => { closeGate(); pwGate.action(); }} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE BUCKETS TAB
// ─────────────────────────────────────────────────────────────────────────────
const StorageBucketsTab = () => {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loadingBuckets, setLoadingBuckets] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [files, setFiles] = useState<BucketFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Create bucket dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newBucketName, setNewBucketName] = useState("");
  const [newBucketPublic, setNewBucketPublic] = useState(false);
  const [creating, setCreating] = useState(false);

  const [confirmDeleteFile, setConfirmDeleteFile] = useState<string | null>(null);

  const uploadRef = useRef<HTMLInputElement>(null);

  const loadBuckets = async () => {
    setLoadingBuckets(true);
    try {
      const d = await callBackup({ action: "storage_list_buckets" });
      setBuckets(d.buckets || []);
    } catch (e: any) {
      toast({ title: "Error loading buckets", description: e.message, variant: "destructive" });
    } finally { setLoadingBuckets(false); }
  };

  const loadFiles = async (bucket: Bucket, path = "") => {
    setLoadingFiles(true);
    try {
      const d = await callBackup({ action: "storage_list_files", bucket_name: bucket.name, path });
      setFiles(d.files || []);
      setCurrentPath(path);
    } catch (e: any) {
      toast({ title: "Error loading files", description: e.message, variant: "destructive" });
    } finally { setLoadingFiles(false); }
  };

  useEffect(() => { loadBuckets(); }, []);

  const openBucket = (bucket: Bucket) => {
    setSelectedBucket(bucket);
    setCurrentPath("");
    loadFiles(bucket, "");
  };

  const navigateFolder = (folderName: string) => {
    if (!selectedBucket) return;
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    loadFiles(selectedBucket, newPath);
  };

  const navigateUp = () => {
    if (!selectedBucket) return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    loadFiles(selectedBucket, parts.join("/"));
  };

  const downloadFile = async (fileName: string) => {
    if (!selectedBucket) return;
    const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
    setDownloading(filePath);
    try {
      let url: string;
      if (selectedBucket.public) {
        const d = await callBackup({ action: "storage_public_url", bucket_name: selectedBucket.name, file_path: filePath });
        url = d.url;
      } else {
        const d = await callBackup({ action: "storage_download_url", bucket_name: selectedBucket.name, file_path: filePath });
        url = d.url;
      }
      const a = document.createElement("a"); a.href = url; a.download = fileName; a.target = "_blank";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast({ title: "Download started", description: fileName });
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    } finally { setDownloading(null); }
  };

  const previewFile = async (fileName: string) => {
    if (!selectedBucket) return;
    const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
    try {
      let url: string;
      if (selectedBucket.public) {
        const d = await callBackup({ action: "storage_public_url", bucket_name: selectedBucket.name, file_path: filePath });
        url = d.url;
      } else {
        const d = await callBackup({ action: "storage_download_url", bucket_name: selectedBucket.name, file_path: filePath });
        url = d.url;
      }
      window.open(url, "_blank");
    } catch (e: any) {
      toast({ title: "Preview failed", description: e.message, variant: "destructive" });
    }
  };

  const deleteFile = async (fileName: string) => {
    if (!selectedBucket) return;
    const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
    setDeleting(filePath); setConfirmDeleteFile(null);
    try {
      await callBackup({ action: "storage_delete_files", bucket_name: selectedBucket.name, file_paths: [filePath] });
      toast({ title: "File deleted" });
      loadFiles(selectedBucket, currentPath);
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally { setDeleting(null); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !selectedBucket) return;
    setUploading(true);
    try {
      const ab = await file.arrayBuffer();
      const bytes = new Uint8Array(ab);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary);
      const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
      await callBackup({
        action: "storage_upload_file",
        bucket_name: selectedBucket.name,
        file_path: filePath,
        content_base64: b64,
        content_type: file.type || "application/octet-stream",
      });
      toast({ title: "File uploaded", description: file.name });
      loadFiles(selectedBucket, currentPath);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally { setUploading(false); e.target.value = ""; }
  };

  const createBucket = async () => {
    if (!newBucketName.trim()) return;
    setCreating(true);
    try {
      await callBackup({ action: "storage_create_bucket", bucket_name: newBucketName.trim().toLowerCase().replace(/\s+/g, "-"), is_public: newBucketPublic });
      toast({ title: "Bucket created", description: newBucketName });
      setCreateOpen(false); setNewBucketName(""); setNewBucketPublic(false);
      loadBuckets();
    } catch (e: any) {
      toast({ title: "Create failed", description: e.message, variant: "destructive" });
    } finally { setCreating(false); }
  };

  // Path breadcrumb
  const pathParts = currentPath.split("/").filter(Boolean);

  return (
    <div className="space-y-4">
      {!selectedBucket ? (
        // ── Bucket list ──
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Storage Buckets</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={loadBuckets} disabled={loadingBuckets}>
                {loadingBuckets ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" /> New Bucket
              </Button>
            </div>
          </div>

          {loadingBuckets ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : buckets.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">No storage buckets found.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {buckets.map(b => (
                <button key={b.id} onClick={() => openBucket(b)}
                  className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/30 transition-all text-left group">
                  <Folder className="w-8 h-8 text-primary group-hover:scale-110 transition-transform shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{b.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant={b.public ? "secondary" : "outline"} className="text-xs">
                        {b.public ? "Public" : "Private"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        // ── File browser ──
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => { setSelectedBucket(null); setFiles([]); }}>
              <Home className="w-3.5 h-3.5 mr-1" /> Buckets
            </Button>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            <Button variant="ghost" size="sm" onClick={() => loadFiles(selectedBucket, "")}>
              <Folder className="w-3.5 h-3.5 mr-1 text-primary" /> {selectedBucket.name}
            </Button>
            {pathParts.map((part, i) => (
              <span key={i} className="flex items-center gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                <Button variant="ghost" size="sm" onClick={() => loadFiles(selectedBucket, pathParts.slice(0, i + 1).join("/"))}>
                  {part}
                </Button>
              </span>
            ))}

            <div className="ml-auto flex gap-2">
              {currentPath && (
                <Button variant="outline" size="sm" onClick={navigateUp}>↑ Up</Button>
              )}
              <Button variant="outline" size="sm" onClick={() => uploadRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                Upload File
              </Button>
              <input ref={uploadRef} type="file" className="hidden" onChange={handleUpload} />
              <Button variant="ghost" size="icon" onClick={() => loadFiles(selectedBucket, currentPath)} disabled={loadingFiles}>
                {loadingFiles ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Bucket info bar */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
            <Folder className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium text-foreground">{selectedBucket.name}</span>
            <Badge variant={selectedBucket.public ? "secondary" : "outline"} className="text-xs">
              {selectedBucket.public ? "Public" : <span className="flex items-center gap-1"><Lock className="w-3 h-3" />Private</span>}
            </Badge>
            <span className="ml-auto">{files.length} items</span>
          </div>

          {/* Files table */}
          <div className="rounded-lg border border-border overflow-hidden">
            {loadingFiles ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : files.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">This folder is empty.</div>
            ) : (
              <div className="divide-y divide-border">
                {files.map(f => {
                  const isFolder = !f.id;
                  const fullPath = currentPath ? `${currentPath}/${f.name}` : f.name;
                  const isDeleting_ = deleting === fullPath;
                  const isDownloading_ = downloading === fullPath;
                  return (
                    <div key={f.name} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                      {isFolder
                        ? <FolderOpen className="w-4 h-4 text-primary shrink-0" />
                        : fileIcon(f.name)
                      }
                      <div className="flex-1 min-w-0">
                        <button className={`text-sm font-medium text-left truncate w-full ${isFolder ? "text-primary hover:underline" : "text-foreground"}`}
                          onClick={() => isFolder ? navigateFolder(f.name) : undefined}>
                          {f.name}
                        </button>
                        <p className="text-xs text-muted-foreground">
                          {!isFolder && (
                            <>{formatSize(f.metadata?.size)}{f.updated_at ? ` · ${new Date(f.updated_at).toLocaleString()}` : ""}</>
                          )}
                          {isFolder && "Folder"}
                        </p>
                      </div>
                      {!isFolder && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="sm" variant="ghost" title="Preview" onClick={() => previewFile(f.name)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" title="Download" onClick={() => downloadFile(f.name)} disabled={isDownloading_}>
                            {isDownloading_ ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          </Button>
                          <Button size="sm" variant="ghost" title="Delete" onClick={() => setConfirmDeleteFile(fullPath)} disabled={isDeleting_}>
                            {isDeleting_ ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 text-destructive" />}
                          </Button>
                        </div>
                      )}
                      {isFolder && (
                        <Button size="sm" variant="ghost" onClick={() => navigateFolder(f.name)}>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create bucket dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create New Bucket</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Bucket Name</Label>
              <Input className="mt-1" placeholder="my-bucket" value={newBucketName}
                onChange={e => setNewBucketName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                onKeyDown={e => e.key === "Enter" && createBucket()} />
              <p className="text-xs text-muted-foreground mt-1">Lowercase letters, numbers, and hyphens only.</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Public Bucket</Label>
                <p className="text-xs text-muted-foreground">Files accessible without authentication</p>
              </div>
              <Switch checked={newBucketPublic} onCheckedChange={setNewBucketPublic} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createBucket} disabled={creating || !newBucketName.trim()}>
              {creating && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete file confirm */}
      <AlertDialog open={!!confirmDeleteFile} onOpenChange={v => !v && setConfirmDeleteFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File?</AlertDialogTitle>
            <AlertDialogDescription>Permanently delete <span className="font-mono">{confirmDeleteFile?.split("/").pop()}</span>? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={() => { const name = confirmDeleteFile!.split("/").pop()!; deleteFile(name); }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const DatabaseTools = () => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground">Database & Storage</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Manage database snapshots and storage bucket files</p>
      </div>

      <Tabs defaultValue="snapshots">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="snapshots" className="flex items-center gap-1.5">
            <Database className="w-4 h-4" /> DB Snapshots
          </TabsTrigger>
          <TabsTrigger value="storage" className="flex items-center gap-1.5">
            <Folder className="w-4 h-4" /> Storage Buckets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="snapshots" className="mt-4">
          <DbSnapshotsTab />
        </TabsContent>

        <TabsContent value="storage" className="mt-4">
          <StorageBucketsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DatabaseTools;
