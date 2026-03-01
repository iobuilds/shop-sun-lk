import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Database, Download, Upload, Trash2, Loader2, AlertTriangle, Clock, FileDown, RotateCcw } from "lucide-react";

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
  metadata: { size?: number };
}

const DatabaseTools = () => {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [confirmUploadRestore, setConfirmUploadRestore] = useState<any>(null);

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

  const createBackup = async () => {
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

  const downloadBackup = async (fileName: string) => {
    try {
      const data = await callBackupFn({ action: "download_url", file_name: fileName });
      window.open(data.url, "_blank");
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
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

  const restoreFromBackup = async (fileName: string) => {
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

  const formatSize = (bytes: number | null | undefined) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={createBackup} disabled={creating || restoring}>
          {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
          {creating ? "Creating Snapshot..." : "Create Snapshot"}
        </Button>
        <div className="relative">
          <Button variant="outline" disabled={restoring}>
            <Upload className="w-4 h-4 mr-2" /> Restore from File
          </Button>
          <input
            type="file"
            accept=".json"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={handleUploadRestore}
            disabled={restoring}
          />
        </div>
        <Button variant="outline" onClick={fetchBackups} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
        </Button>
      </div>

      {restoring && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 border border-border">
          <Loader2 className="w-4 h-4 animate-spin" />
          Restoring database... This may take a moment.
        </div>
      )}

      {/* Backup List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Snapshots</CardTitle>
          <CardDescription>Available database snapshots</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : backups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No snapshots yet. Create one to get started.</p>
          ) : (
            <div className="space-y-2">
              {backups.filter(b => b.name.endsWith('.json')).map((b) => {
                const log = logs.find(l => l.file_name === b.name && l.action === "backup");
                return (
                  <div key={b.name} className="flex items-center justify-between bg-muted/30 rounded-lg p-3 border border-border">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{b.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(b.created_at).toLocaleString()}</span>
                        {log?.file_size && <span>{formatSize(log.file_size)}</span>}
                        {log?.created_by_email && <span>by {log.created_by_email}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      <Button variant="ghost" size="icon" onClick={() => downloadBackup(b.name)} title="Download">
                        <FileDown className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirmRestore(b.name)} title="Restore" disabled={restoring}>
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteBackup(b.name)} title="Delete">
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
          <CardDescription>Backup and restore history</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
          ) : (
            <div className="space-y-1.5">
              {logs.slice(0, 20).map((l) => (
                <div key={l.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-border last:border-0">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${l.action === "backup" ? "bg-secondary/10 text-secondary" : "bg-accent/10 text-accent-foreground"}`}>
                    {l.action}
                  </span>
                  <span className="text-muted-foreground truncate flex-1">{l.file_name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{l.created_by_email || "—"}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{new Date(l.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Restore Dialog */}
      <Dialog open={!!confirmRestore} onOpenChange={() => setConfirmRestore(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> Confirm Restore</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Restoring will <strong>overwrite all current data</strong> with the snapshot data. This action cannot be undone.
          </p>
          <p className="text-sm font-medium mt-2">File: {confirmRestore}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRestore(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmRestore && restoreFromBackup(confirmRestore)}>
              Yes, Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Upload Restore Dialog */}
      <Dialog open={!!confirmUploadRestore} onOpenChange={() => setConfirmUploadRestore(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> Confirm Restore from File</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Restoring will <strong>overwrite all current data</strong> with the uploaded file data. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmUploadRestore(null)}>Cancel</Button>
            <Button variant="destructive" onClick={executeUploadRestore}>
              Yes, Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DatabaseTools;
