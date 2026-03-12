import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Database, Upload, Trash2, Loader2, AlertTriangle, Clock, RotateCcw, Lock, ShieldCheck, ArrowDownToLine, ArchiveRestore, Flame, FileArchive, CalendarDays, X } from "lucide-react";

interface BackupLog {
  id: string;
  action: string;
  file_name: string;
  file_size: number | null;
  created_by_email: string | null;
  created_at: string;
}

interface BackupFile {
  name: string;
  created_at: string;
  updated_at: string;
  metadata: { size?: number; contentLength?: number; mimetype?: string };
}

const DatabaseTools = () => {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatingFull, setCreatingFull] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  // Schedule state
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState("02:00");
  const [scheduleLabel, setScheduleLabel] = useState("");
  const [scheduledJobs, setScheduledJobs] = useState<{ jobid: number; jobname: string; schedule: string; active: boolean }[]>([]);
  const [scheduledLogs, setScheduledLogs] = useState<BackupLog[]>([]);

  // Password confirmation state
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [pendingAction, setPendingAction] = useState<{ type: "backup" | "full_backup" | "restore" | "full_restore" | "upload_restore" | "upload_full_restore" | "cleanup" | "schedule_backup"; payload?: any } | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Restore confirm state
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [confirmFullRestore, setConfirmFullRestore] = useState<string | null>(null);
  const [confirmUploadRestore, setConfirmUploadRestore] = useState<any>(null);
  const [confirmUploadFullRestore, setConfirmUploadFullRestore] = useState(false);
  const [uploadedZipFile, setUploadedZipFile] = useState<File | null>(null);
  const [confirmCleanup, setConfirmCleanup] = useState(false);

  const callBackupFn = async (body: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const res = await supabase.functions.invoke("db-backup", { body });
    if (res.error) throw new Error(res.error.message);
    return res.data;
  };

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const data = await callBackupFn({ action: "list" });
      setBackups(data.files || []);
      setLogs(data.logs || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBackups(); }, []);

  const requestPasswordConfirmation = (actionType: typeof pendingAction extends null ? never : NonNullable<typeof pendingAction>["type"], payload?: any) => {
    setPendingAction({ type: actionType, payload });
    setPassword("");
    setPasswordError("");
    setPasswordDialog(true);
  };

  const getPasswordDialogLabel = () => {
    switch (pendingAction?.type) {
      case "backup": return "create a backup";
      case "full_backup": return "create a full ZIP backup";
      case "cleanup": return "clean the database";
      case "full_restore": return "restore the full site from ZIP";
      case "schedule_backup": return "schedule an automatic backup";
      default: return "restore the database";
    }
  };

  const verifyPasswordAndExecute = async () => {
    if (!password.trim()) { setPasswordError("Please enter your password"); return; }
    setVerifying(true);
    setPasswordError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Unable to verify identity");
      const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
      if (error) { setPasswordError("Incorrect password. Please try again."); setVerifying(false); return; }
      setPasswordDialog(false);
      setPassword("");

      if (pendingAction?.type === "backup") await executeCreateBackup();
      else if (pendingAction?.type === "full_backup") await executeFullBackup();
      else if (pendingAction?.type === "restore") await executeRestore(pendingAction.payload);
      else if (pendingAction?.type === "full_restore") await executeFullRestore(pendingAction.payload);
      else if (pendingAction?.type === "upload_restore") await executeUploadRestore();
      else if (pendingAction?.type === "upload_full_restore") await executeUploadFullRestore();
      else if (pendingAction?.type === "cleanup") await executeCleanup();
      else if (pendingAction?.type === "schedule_backup") await executeScheduleBackup();
    } catch (e: any) {
      setPasswordError(e.message);
    } finally {
      setVerifying(false);
    }
  };

  const executeCreateBackup = async () => {
    setCreating(true);
    try {
      const data = await callBackupFn({ action: "backup" });
      toast({ title: "Backup created", description: `File: ${data.file_name} (${formatSize(data.size)})` });
      fetchBackups();
    } catch (e: any) {
      toast({ title: "Backup failed", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const executeFullBackup = async () => {
    setCreatingFull(true);
    try {
      const data = await callBackupFn({ action: "full_backup" });
      toast({ title: "Full ZIP backup created", description: `${data.file_name} (${formatSize(data.size)}) — ${data.total_files} files included` });
      // Auto-download the ZIP
      await downloadBackup(data.file_name);
      fetchBackups();
    } catch (e: any) {
      toast({ title: "Full backup failed", description: e.message, variant: "destructive" });
    } finally {
      setCreatingFull(false);
    }
  };

  const executeFullRestore = async (fileName: string) => {
    setRestoring(true);
    setConfirmFullRestore(null);
    try {
      const data = await callBackupFn({ action: "full_restore", file_name: fileName });
      toast({ title: "Full site restored", description: `Database + ${data.restored_files} storage files restored.` });
      fetchBackups();
    } catch (e: any) {
      toast({ title: "Full restore failed", description: e.message, variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  };

  const executeUploadFullRestore = async () => {
    if (!uploadedZipFile) return;
    setRestoring(true);
    setConfirmUploadFullRestore(false);
    try {
      // Upload the ZIP file to db-backups first
      const tempName = `upload-restore-${Date.now()}.zip`;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const arrayBuffer = await uploadedZipFile.arrayBuffer();
      const { error: upErr } = await supabase.storage.from("db-backups").upload(tempName, new Uint8Array(arrayBuffer), { contentType: "application/zip", upsert: false });
      if (upErr) throw new Error("Failed to upload ZIP: " + upErr.message);

      // Now call full_restore with that file
      const data = await callBackupFn({ action: "full_restore", file_name: tempName });
      toast({ title: "Full site restored from uploaded ZIP", description: `Database + ${data.restored_files} storage files restored.` });
      fetchBackups();
    } catch (e: any) {
      toast({ title: "Full restore failed", description: e.message, variant: "destructive" });
    } finally {
      setRestoring(false);
      setUploadedZipFile(null);
    }
  };

  const downloadBackup = async (fileName: string) => {
    setDownloading(fileName);
    try {
      const data = await callBackupFn({ action: "download_url", file_name: fileName });
      const response = await fetch(data.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Download complete", description: fileName });
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const deleteBackup = async (fileName: string) => {
    if (!confirm("Delete this backup?")) return;
    try {
      await callBackupFn({ action: "delete", file_name: fileName });
      toast({ title: "Backup deleted" });
      fetchBackups();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const executeRestore = async (fileName: string) => {
    setRestoring(true);
    setConfirmRestore(null);
    try {
      await callBackupFn({ action: "restore", file_name: fileName });
      toast({ title: "Database restored", description: `Restored from ${fileName}` });
      fetchBackups();
    } catch (e: any) {
      toast({ title: "Restore failed", description: e.message, variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  };

  const handleUploadRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      setConfirmUploadRestore(data);
    } catch {
      toast({ title: "Invalid file", description: "Please upload a valid JSON backup file", variant: "destructive" });
    }
    e.target.value = "";
  };

  const handleUploadZipRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".zip")) {
      toast({ title: "Invalid file", description: "Please upload a .zip backup file", variant: "destructive" });
      e.target.value = "";
      return;
    }
    setUploadedZipFile(file);
    setConfirmUploadFullRestore(true);
    e.target.value = "";
  };

  const executeUploadRestore = async () => {
    if (!confirmUploadRestore) return;
    setRestoring(true);
    setConfirmUploadRestore(null);
    try {
      await callBackupFn({ action: "restore", data: confirmUploadRestore });
      toast({ title: "Database restored from uploaded file" });
      fetchBackups();
    } catch (e: any) {
      toast({ title: "Restore failed", description: e.message, variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  };

  const executeCleanup = async () => {
    setCleaning(true);
    setConfirmCleanup(false);
    try {
      const res = await supabase.functions.invoke("db-cleanup", {});
      if (res.error) throw new Error(res.error.message);
      const data = res.data;
      const failed = data.results?.filter((r: any) => r.status === "failed") || [];
      if (failed.length > 0) {
        toast({ title: "Cleanup completed with errors", description: `${data.results.length - failed.length} tables cleared, ${failed.length} failed`, variant: "destructive" });
      } else {
        toast({ title: "Database cleaned", description: data.message });
      }
      fetchBackups();
    } catch (e: any) {
      toast({ title: "Cleanup failed", description: e.message, variant: "destructive" });
    } finally {
      setCleaning(false);
    }
  };

  const formatSize = (bytes: number | null | undefined) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isBusy = creating || creatingFull || restoring || cleaning;

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="flex items-start gap-3 bg-muted/50 rounded-lg p-4 border border-border">
        <ShieldCheck className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Automatic daily backups enabled</p>
          <p>A snapshot is automatically created every day at 2:00 AM. All backup and restore actions require password confirmation for security.</p>
        </div>
      </div>

      {/* Quick Snapshot Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => requestPasswordConfirmation("backup")} disabled={isBusy}>
          {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
          {creating ? "Creating..." : "DB Snapshot"}
        </Button>
        <div className="relative">
          <Button variant="outline" disabled={isBusy}>
            <Upload className="w-4 h-4 mr-2" /> Restore JSON
          </Button>
          <input type="file" accept=".json" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleUploadRestore} disabled={isBusy} />
        </div>
        <Button variant="outline" onClick={fetchBackups} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
        </Button>
      </div>

      {/* Full Site Backup Card */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-primary">
            <FileArchive className="w-4 h-4" /> Full Site Backup (ZIP)
          </CardTitle>
          <CardDescription>
            Creates a ZIP file containing <strong>all database data + all uploaded images/files</strong>. Use this to fully restore your site anytime, even on a new server.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => requestPasswordConfirmation("full_backup")} disabled={isBusy} className="gap-2">
            {creatingFull ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4" />}
            {creatingFull ? "Creating ZIP... (this may take a while)" : "Create & Download Full Backup"}
          </Button>
          <div className="relative">
            <Button variant="outline" disabled={isBusy} className="gap-2">
              <Upload className="w-4 h-4" /> Restore from ZIP
            </Button>
            <input type="file" accept=".zip" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleUploadZipRestore} disabled={isBusy} />
          </div>
        </CardContent>
      </Card>

      {/* Database Cleanup */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <Flame className="w-4 h-4" /> Database Cleanup
          </CardTitle>
          <CardDescription>
            Wipe all data (products, orders, categories, deals, coupons, etc.) while keeping user accounts and roles intact. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setConfirmCleanup(true)} disabled={isBusy} className="gap-2">
            {cleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
            {cleaning ? "Cleaning..." : "Full Database Cleanup"}
          </Button>
        </CardContent>
      </Card>

      {restoring && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 border border-border">
          <Loader2 className="w-4 h-4 animate-spin" />
          Restoring... This may take several minutes for full backups.
        </div>
      )}

      {/* Backup List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Snapshots & Backups</CardTitle>
          <CardDescription>Available database snapshots and full ZIP backups</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : backups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No snapshots yet. Create one to get started.</p>
          ) : (
            <div className="space-y-2">
              {backups.filter(b => b.name.endsWith('.json') || b.name.endsWith('.zip')).map((b) => {
                const log = logs.find(l => l.file_name === b.name && (l.action === "backup" || l.action === "full_backup"));
                const isAutomatic = b.name.includes("scheduled");
                const isZip = b.name.endsWith('.zip');
                return (
                  <div key={b.name} className="flex items-center justify-between bg-muted/30 rounded-lg p-3 border border-border">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {isZip ? <FileArchive className="w-4 h-4 text-primary shrink-0" /> : <Database className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                        <p className="text-sm font-medium text-foreground truncate">{b.name}</p>
                        {isAutomatic && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/10 text-secondary font-medium">Auto</span>}
                        {isZip && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Full</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 ml-6">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(b.created_at).toLocaleString()}</span>
                        <span>{formatSize(log?.file_size ?? b.metadata?.size ?? b.metadata?.contentLength)}</span>
                        {log?.created_by_email && <span>by {log.created_by_email}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      <Button variant="ghost" size="icon" onClick={() => downloadBackup(b.name)} title="Download" disabled={downloading === b.name} className="hover:bg-secondary/10 hover:text-secondary">
                        {downloading === b.name ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                        if (isZip) setConfirmFullRestore(b.name);
                        else setConfirmRestore(b.name);
                      }} title="Restore" disabled={restoring} className="hover:bg-accent/10 hover:text-accent-foreground">
                        <ArchiveRestore className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteBackup(b.name)} title="Delete" className="hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity Log</CardTitle>
          <CardDescription>Backup, restore, and cleanup history</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
          ) : (
            <div className="space-y-1.5">
              {logs.slice(0, 20).map((l) => (
                <div key={l.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-border last:border-0">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                    l.action.includes("backup") ? "bg-secondary/10 text-secondary" : 
                    l.action === "cleanup" ? "bg-destructive/10 text-destructive" : 
                    "bg-accent/10 text-accent-foreground"
                  }`}>
                    {l.action.replace("_", " ")}
                  </span>
                  <span className="text-muted-foreground truncate flex-1">{l.file_name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{l.created_by_email || "system"}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{new Date(l.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password Confirmation Dialog */}
      <Dialog open={passwordDialog} onOpenChange={(open) => { if (!open) { setPasswordDialog(false); setPendingAction(null); setPassword(""); setPasswordError(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-primary" /> Confirm Your Identity</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Enter your admin password to {getPasswordDialogLabel()}.</p>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordError(""); }}
              onKeyDown={(e) => e.key === "Enter" && verifyPasswordAndExecute()}
              placeholder="Enter your password"
              autoFocus
            />
            {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPasswordDialog(false); setPendingAction(null); setPassword(""); setPasswordError(""); }}>Cancel</Button>
            <Button onClick={verifyPasswordAndExecute} disabled={verifying} variant={pendingAction?.type === "cleanup" ? "destructive" : "default"}>
              {verifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Restore Dialog (JSON) */}
      <Dialog open={!!confirmRestore} onOpenChange={() => setConfirmRestore(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> Confirm Restore</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Restoring will <strong>overwrite all current data</strong> with the snapshot data. This action cannot be undone.</p>
          <p className="text-sm font-medium mt-2">File: {confirmRestore}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRestore(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (confirmRestore) { setConfirmRestore(null); requestPasswordConfirmation("restore", confirmRestore); } }}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Full Restore Dialog (ZIP) */}
      <Dialog open={!!confirmFullRestore} onOpenChange={() => setConfirmFullRestore(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> Full Site Restore</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will <strong>overwrite ALL data and ALL uploaded files</strong> (images, etc.) with the backup. This action cannot be undone.</p>
          <p className="text-sm font-medium mt-2">File: {confirmFullRestore}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmFullRestore(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (confirmFullRestore) { setConfirmFullRestore(null); requestPasswordConfirmation("full_restore", confirmFullRestore); } }}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Upload Restore Dialog (JSON) */}
      <Dialog open={!!confirmUploadRestore} onOpenChange={() => setConfirmUploadRestore(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> Confirm Restore from File</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Restoring will <strong>overwrite all current data</strong> with the uploaded file data. This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmUploadRestore(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => requestPasswordConfirmation("upload_restore")}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Upload Full Restore Dialog (ZIP) */}
      <Dialog open={confirmUploadFullRestore} onOpenChange={(open) => { if (!open) { setConfirmUploadFullRestore(false); setUploadedZipFile(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> Full Site Restore from ZIP</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will <strong>overwrite ALL data and ALL uploaded files</strong> with the contents of:
          </p>
          <p className="text-sm font-medium">{uploadedZipFile?.name} ({formatSize(uploadedZipFile?.size)})</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmUploadFullRestore(false); setUploadedZipFile(null); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => { setConfirmUploadFullRestore(false); requestPasswordConfirmation("upload_full_restore"); }}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Cleanup Dialog */}
      <Dialog open={confirmCleanup} onOpenChange={setConfirmCleanup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Flame className="w-5 h-5 text-destructive" /> Full Database Cleanup</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">This will <strong className="text-destructive">permanently delete ALL data</strong> including:</p>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>All products, categories, and combo packs</li>
              <li>All orders and order history</li>
              <li>All coupons, deals, and promotions</li>
              <li>All banners, pages, and site settings</li>
              <li>All reviews, wishlists, contacts</li>
              <li>All SMS logs and templates</li>
            </ul>
            <p className="text-sm font-medium text-foreground">✅ User accounts and roles will be preserved.</p>
            <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3 font-medium">⚠️ This action cannot be undone. Create a backup first!</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCleanup(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { setConfirmCleanup(false); requestPasswordConfirmation("cleanup"); }}>
              <Flame className="w-4 h-4 mr-2" /> Proceed with Cleanup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DatabaseTools;
