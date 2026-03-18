import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import JSZip from "jszip";

// ── ZIP raw-scanner helpers ──────────────────────────────────────────────────
// Reads a ZIP's local file entries sequentially (no central directory needed).
// This lets us restore even truncated ZIPs where the EOCD at the end is cut off.

async function decompressDeflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  writer.write(compressed);
  await writer.close();
  const chunks: Uint8Array[] = [];
  let r = await reader.read();
  while (!r.done) { chunks.push(r.value!); r = await reader.read(); }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out;
}

interface ZipLocalEntry { name: string; data: Uint8Array }

async function scanZipLocalEntries(
  buffer: ArrayBuffer,
  filter?: (name: string) => boolean
): Promise<ZipLocalEntry[]> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const entries: ZipLocalEntry[] = [];
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const sig = view.getUint32(offset, true);
    // Local file header signature
    if (sig !== 0x04034b50) break;

    const flags        = view.getUint16(offset + 6,  true);
    const compression  = view.getUint16(offset + 8,  true);
    let compressedSize = view.getUint32(offset + 18, true);
    const fileNameLen  = view.getUint16(offset + 26, true);
    const extraLen     = view.getUint16(offset + 28, true);

    const nameBytes = bytes.slice(offset + 30, offset + 30 + fileNameLen);
    const name      = new TextDecoder("utf-8").decode(nameBytes);
    const dataStart = offset + 30 + fileNameLen + extraLen;

    // If data descriptor flag is set and size is 0, find next signature
    if ((flags & 0x08) && compressedSize === 0) {
      // Scan for next local file header or data descriptor signature
      let scanPos = dataStart;
      while (scanPos + 4 <= bytes.length) {
        const s = view.getUint32(scanPos, true);
        if (s === 0x04034b50 || s === 0x02014b50 || s === 0x06054b50) break;
        if (s === 0x08074b50) { // data descriptor
          compressedSize = scanPos - dataStart;
          break;
        }
        scanPos++;
      }
      if (compressedSize === 0) compressedSize = scanPos - dataStart;
    }

    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) break; // truncated — stop scanning

    if (!name.endsWith("/") && (!filter || filter(name))) {
      const compressed = bytes.slice(dataStart, dataEnd);
      try {
        const data = compression === 0
          ? compressed
          : await decompressDeflateRaw(compressed);
        entries.push({ name, data });
      } catch (_) { /* skip undecompressable entry */ }
    }

    offset = dataEnd;
    // Skip data descriptor if present
    if ((flags & 0x08) && view.getUint32(offset, true) === 0x08074b50) offset += 16;
  }
  return entries;
}
// ────────────────────────────────────────────────────────────────────────────
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Database, Upload, Trash2, Loader2, AlertTriangle, Clock, RotateCcw, Lock,
  ShieldCheck, ArrowDownToLine, ArchiveRestore, Flame, FileArchive, CalendarDays,
  X, Terminal, ChevronDown, ChevronUp, AlertCircle, CheckCircle2,
} from "lucide-react";

interface BackupLog {
  id: string;
  action: string;
  file_name: string;
  file_size: number | null;
  created_by_email: string | null;
  created_at: string;
  note?: string | null;
}

interface BackupFile {
  name: string;
  created_at: string;
  updated_at: string;
  metadata: { size?: number; contentLength?: number; mimetype?: string };
}

interface ProgressState {
  active: boolean;
  label: string;
  step: number;
  totalSteps: number;
  steps: string[];
  currentStepLabel: string;
  isError: boolean;
  errorMessage?: string;
}

interface FnLogEntry {
  event_message: string;
  level: string;
  timestamp: number;
}

const BACKUP_STEPS = [
  "Authenticating...",
  "Reading database tables...",
  "Compressing data...",
  "Uploading to storage...",
  "Finalizing...",
];

const RESTORE_STEPS = [
  "Authenticating...",
  "Downloading backup file...",
  "Clearing existing data...",
  "Restoring tables...",
  "Restoring storage files...",
  "Finalizing...",
];

const UPLOAD_RESTORE_STEPS = [
  "Authenticating...",
  "Getting upload URL...",
  "Uploading ZIP to storage...",
  "Clearing existing data...",
  "Restoring tables...",
  "Restoring storage files...",
  "Finalizing...",
];

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

  // Progress state
  const [progress, setProgress] = useState<ProgressState>({
    active: false, label: "", step: 0, totalSteps: 1, steps: [], currentStepLabel: "", isError: false,
  });
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Function logs panel
  const [fnLogs, setFnLogs] = useState<FnLogEntry[]>([]);
  const [fnLogsOpen, setFnLogsOpen] = useState(false);
  const [loadingFnLogs, setLoadingFnLogs] = useState(false);
  const fnLogsRef = useRef<HTMLDivElement>(null);

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

  // ── Progress helpers ──
  const startProgress = (label: string, steps: string[]) => {
    setProgress({ active: true, label, step: 0, totalSteps: steps.length, steps, currentStepLabel: steps[0], isError: false });
    let i = 0;
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      i++;
      setProgress(p => {
        const next = Math.min(i, steps.length - 2); // stop at second-to-last; final step set manually
        return { ...p, step: next, currentStepLabel: steps[next] };
      });
      if (i >= steps.length - 2) clearInterval(progressIntervalRef.current!);
    }, 1800);
  };

  const finishProgress = (success: boolean, errorMessage?: string) => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setProgress(p => ({
      ...p,
      step: success ? p.totalSteps : p.step,
      currentStepLabel: success ? "Done!" : (errorMessage || "Failed"),
      isError: !success,
      errorMessage,
    }));
    if (success) {
      setTimeout(() => setProgress(pp => ({ ...pp, active: false })), 2000);
    }
    // On error, fetch and show function logs automatically
    if (!success) {
      fetchFnLogs();
      setFnLogsOpen(true);
    }
  };

  const fetchFnLogs = async () => {
    setLoadingFnLogs(true);
    // Safety: always clear loading after 15s max
    const safetyTimer = setTimeout(() => setLoadingFnLogs(false), 15000);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { clearTimeout(safetyTimer); setLoadingFnLogs(false); return; }

      // Primary: try the management API logs (works on Lovable Cloud)
      let gotLogs = false;
      try {
        const res = await supabase.functions.invoke("fetch-logs", {
          body: { log_type: "edge", hours: 2, limit: 60, search: "db-backup" },
        });
        if (res.data?.logs && res.data.logs.length > 0) {
          setFnLogs(res.data.logs);
          gotLogs = true;
        }
      } catch (_) { /* fall through */ }

      // Fallback 1: ask db-backup function itself for its recent activity logs
      if (!gotLogs) {
        try {
          const res2 = await supabase.functions.invoke("db-backup", {
            body: { action: "get_logs" },
          });
          if (res2.data?.logs && res2.data.logs.length > 0) {
            setFnLogs(res2.data.logs);
            gotLogs = true;
          }
        } catch (_) { /* fall through */ }
      }

      // Fallback 2: direct db query
      if (!gotLogs) {
        const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { data: backupLogs } = await supabase
          .from("db_backup_logs")
          .select("*")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(40);

        const combined = (backupLogs || []).map((l: any) => ({
          event_message: `[${(l.action || "").toUpperCase()}] ${l.file_name}${l.note ? " — " + l.note : ""}${l.file_size ? " (" + formatSize(l.file_size) + ")" : ""}`,
          level: "info",
          timestamp: new Date(l.created_at).getTime(),
        }));

        setFnLogs(combined.length > 0 ? combined : [{
          event_message: "No recent backup/restore activity found in the last 2 hours.",
          level: "info",
          timestamp: Date.now(),
        }]);
      }
    } catch (e) {
      console.error("Failed to fetch fn logs:", e);
      setFnLogs([{ event_message: `Failed to load logs: ${(e as Error).message}`, level: "error", timestamp: Date.now() }]);
    } finally {
      clearTimeout(safetyTimer);
      setLoadingFnLogs(false);
    }
  };

  useEffect(() => {
    if (fnLogsOpen && fnLogsRef.current) {
      fnLogsRef.current.scrollTop = fnLogsRef.current.scrollHeight;
    }
  }, [fnLogs, fnLogsOpen]);

  useEffect(() => () => { if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); }, []);

  // ── Core ──
  const RESTORE_ACTIONS = new Set([
    "restore", "full_restore", "restore_storage_batch",
    "log_restore_complete", "get_upload_url", "download_url",
    "clear_storage_bucket",
  ]);

  const callBackupFn = async (body: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    // Route restore actions to the dedicated db-restore function
    const fnName = RESTORE_ACTIONS.has(body.action) ? "db-restore" : "db-backup";
    const res = await supabase.functions.invoke(fnName, { body });
    if (res.error) throw new Error(res.error.message);
    if (res.data?.error) throw new Error(res.data.error);
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

  useEffect(() => { fetchBackups(); fetchScheduled(); }, []);

  const requestPasswordConfirmation = (actionType: NonNullable<typeof pendingAction>["type"], payload?: any) => {
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
    startProgress("Creating DB Snapshot", BACKUP_STEPS);
    try {
      const data = await callBackupFn({ action: "backup" });
      finishProgress(true);
      toast({ title: "Backup created", description: `File: ${data.file_name} (${formatSize(data.size)})` });
      fetchBackups();
    } catch (e: any) {
      finishProgress(false, e.message);
      toast({ title: "Backup failed", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const executeFullBackup = async () => {
    setCreatingFull(true);
    startProgress("Creating Full ZIP Backup", [...BACKUP_STEPS.slice(0, 2), "Downloading all storage files...", "Compressing ZIP...", "Uploading to storage...", "Finalizing..."]);
    try {
      const data = await callBackupFn({ action: "full_backup" });
      finishProgress(true);
      toast({ title: "Full ZIP backup created", description: `${data.file_name} (${formatSize(data.size)}) — ${data.total_files} files included` });
      await downloadBackup(data.file_name);
      fetchBackups();
    } catch (e: any) {
      finishProgress(false, e.message);
      toast({ title: "Full backup failed", description: e.message, variant: "destructive" });
    } finally {
      setCreatingFull(false);
    }
  };

  // Two-phase full restore: Phase 1 = DB tables, Phase 2 = storage files in batches
  const runFullRestoreFromFileName = async (fileName: string) => {
    const STORAGE_BATCH_SIZE = 15;

    // Phase 1: Restore DB tables
    setProgress(p => ({ ...p, step: 1, currentStepLabel: "Restoring database tables..." }));
    const phase1 = await callBackupFn({ action: "full_restore", file_name: fileName });
    const totalStorageFiles: number = phase1.total_storage_files ?? 0;

    if (totalStorageFiles === 0) {
      await callBackupFn({ action: "log_restore_complete", file_name: fileName, restored_files: 0 });
      return { restored_files: 0 };
    }

    // Phase 2: Restore storage files in batches
    let offset = 0;
    let totalRestored = 0;
    let clearFirst = true;
    while (offset < totalStorageFiles) {
      setProgress(p => ({
        ...p,
        step: 3,
        currentStepLabel: `Restoring images… ${Math.min(offset + STORAGE_BATCH_SIZE, totalStorageFiles)}/${totalStorageFiles}`,
      }));
      const batchResult = await callBackupFn({
        action: "restore_storage_batch",
        file_name: fileName,
        offset,
        batch_size: STORAGE_BATCH_SIZE,
        clear_first: clearFirst,
      });
      totalRestored += batchResult.restored ?? 0;
      offset += STORAGE_BATCH_SIZE;
      clearFirst = false;
    }

    // Log completion
    await callBackupFn({
      action: "log_restore_complete",
      file_name: fileName,
      restored_files: totalRestored,
    });

    return { restored_files: totalRestored };
  };

  const executeFullRestore = async (fileName: string) => {
    setRestoring(true);
    setConfirmFullRestore(null);
    startProgress("Restoring Full Site from ZIP", RESTORE_STEPS);
    try {
      const result = await runFullRestoreFromFileName(fileName);
      finishProgress(true);
      toast({ title: "Full site restored", description: `Database + ${result.restored_files} storage files restored.` });
      fetchBackups();
    } catch (e: any) {
      finishProgress(false, e.message);
      toast({ title: "Full restore failed", description: e.message, variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  };

  const executeUploadFullRestore = async () => {
    if (!uploadedZipFile) return;
    setRestoring(true);
    setConfirmUploadFullRestore(false);
    startProgress("Restoring from Uploaded ZIP", UPLOAD_RESTORE_STEPS);
    try {
      // ── Parse the ZIP entirely in the browser to avoid storage upload/download truncation ──
      setProgress(p => ({ ...p, step: 1, currentStepLabel: "Reading ZIP file..." }));
      const arrayBuffer = await uploadedZipFile.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      // ── Phase 1: Restore DB tables from database/tables.json inside the ZIP ──
      setProgress(p => ({ ...p, step: 2, currentStepLabel: "Restoring database tables..." }));
      const tablesFile = zip.file("database/tables.json");
      if (!tablesFile) throw new Error("No database/tables.json found in ZIP. Is this a valid full backup?");
      const tablesJson = await tablesFile.async("string");
      const backupData = JSON.parse(tablesJson);

      const phase1 = await callBackupFn({ action: "restore", data: backupData });
      const dbResult = phase1;

      // ── Phase 2: Restore storage files in batches ──
      const STORAGE_BATCH_SIZE = 15;
      const storageBuckets = ["images"];
      let totalRestored = 0;
      let clearFirst = true;

      for (const bucket of storageBuckets) {
        const prefix = `storage/${bucket}/`;
        const bucketFiles = Object.keys(zip.files).filter(f => f.startsWith(prefix) && !zip.files[f].dir);
        const total = bucketFiles.length;

        for (let offset = 0; offset < total; offset += STORAGE_BATCH_SIZE) {
          const batchPaths = bucketFiles.slice(offset, offset + STORAGE_BATCH_SIZE);
          setProgress(p => ({
            ...p,
            step: 3,
            currentStepLabel: `Restoring images… ${Math.min(offset + STORAGE_BATCH_SIZE, total)}/${total}`,
          }));

          // Upload each file in this batch directly to storage from the browser
          if (offset === 0 && clearFirst) {
            // Clear existing files in bucket by calling edge function
            await callBackupFn({ action: "clear_storage_bucket", bucket });
            clearFirst = false;
          }

          await Promise.all(batchPaths.map(async (zipPath) => {
            const storagePath = zipPath.substring(prefix.length);
            const fileObj = zip.file(zipPath);
            if (!fileObj) return;
            const content = await fileObj.async("uint8array");
            const ext = storagePath.split(".").pop()?.toLowerCase() || "";
            const contentTypes: Record<string, string> = {
              jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
              webp: "image/webp", svg: "image/svg+xml", pdf: "application/pdf",
            };
            const contentType = contentTypes[ext] || "application/octet-stream";
            await supabase.storage.from(bucket).upload(storagePath, content, { contentType, upsert: true });
            totalRestored++;
          }));
        }
      }

      // Log completion
      await callBackupFn({ action: "log_restore_complete", file_name: uploadedZipFile.name, restored_files: totalRestored });

      finishProgress(true);
      toast({
        title: "Full site restored from uploaded ZIP",
        description: `Database restored (${dbResult.rows_restored ?? 0} rows) + ${totalRestored} storage files.`,
      });
      fetchBackups();
    } catch (e: any) {
      finishProgress(false, e.message);
      toast({ title: "Full restore failed", description: e.message, variant: "destructive" });
    } finally {
      setRestoring(false);
      setUploadedZipFile(null);
    }
  };

  const downloadBackup = async (fileName: string) => {
    setDownloading(fileName);
    try {
      // Use supabase.functions.invoke so it works on both Lovable Cloud and self-hosted VPS
      const { data, error } = await supabase.functions.invoke("db-restore", {
        body: { action: "download_url", file_name: fileName },
      });
      if (error) throw new Error(error.message);
      // The response is a binary blob (arraybuffer)
      const blob = data instanceof Blob ? data : new Blob([data]);
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
    startProgress("Restoring Database from Snapshot", RESTORE_STEPS.slice(0, 5));
    try {
      await callBackupFn({ action: "restore", file_name: fileName });
      finishProgress(true);
      toast({ title: "Database restored", description: `Restored from ${fileName}` });
      fetchBackups();
    } catch (e: any) {
      finishProgress(false, e.message);
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
    startProgress("Restoring from JSON File", RESTORE_STEPS.slice(0, 5));
    try {
      await callBackupFn({ action: "restore", data: confirmUploadRestore });
      finishProgress(true);
      toast({ title: "Database restored from uploaded file" });
      fetchBackups();
    } catch (e: any) {
      finishProgress(false, e.message);
      toast({ title: "Restore failed", description: e.message, variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  };

  const executeCleanup = async () => {
    setCleaning(true);
    setConfirmCleanup(false);
    startProgress("Cleaning Database", ["Authenticating...", "Deleting table data...", "Clearing storage files...", "Preserving settings...", "Finalizing..."]);
    try {
      const res = await supabase.functions.invoke("db-cleanup", {});
      if (res.error) throw new Error(res.error.message);
      const data = res.data;
      const failed = data.results?.filter((r: any) => r.status === "failed") || [];
      const storageDeleted = data.storageResults?.reduce((sum: number, r: any) => sum + (r.deleted || 0), 0) || 0;
      finishProgress(true);
      if (failed.length > 0) {
        toast({ title: "Cleanup completed with errors", description: `${data.results.length - failed.length} tables cleared, ${failed.length} failed. ${storageDeleted} storage files deleted.`, variant: "destructive" });
      } else {
        toast({ title: "Database & storage cleaned", description: `${data.message}` });
      }
      fetchBackups();
    } catch (e: any) {
      finishProgress(false, e.message);
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

  const fetchScheduled = async () => {
    try {
      const data = await callBackupFn({ action: "list_scheduled" });
      setScheduledJobs(data.jobs || []);
      setScheduledLogs(data.logs || []);
    } catch { /* non-critical */ }
  };

  const executeScheduleBackup = async () => {
    if (!scheduleDate || !scheduleTime) return;
    setScheduling(true);
    try {
      const [hh, mm] = scheduleTime.split(":").map(Number);
      const dt = new Date(scheduleDate);
      dt.setHours(hh, mm, 0, 0);
      const data = await callBackupFn({ action: "schedule_backup", scheduled_at: dt.toISOString(), label: scheduleLabel });
      toast({ title: "Backup scheduled", description: `Will run on ${format(dt, "PPP 'at' HH:mm")}` });
      setScheduleDate(undefined);
      setScheduleTime("02:00");
      setScheduleLabel("");
      fetchScheduled();
    } catch (e: any) {
      toast({ title: "Schedule failed", description: e.message, variant: "destructive" });
    } finally {
      setScheduling(false);
    }
  };

  const cancelScheduled = async (jobName: string) => {
    try {
      await callBackupFn({ action: "cancel_scheduled", job_name: jobName });
      toast({ title: "Scheduled backup cancelled" });
      fetchScheduled();
    } catch (e: any) {
      toast({ title: "Cancel failed", description: e.message, variant: "destructive" });
    }
  };

  const progressPercent = progress.totalSteps > 0
    ? Math.round((progress.step / progress.totalSteps) * 100)
    : 0;

  const isBusy = creating || creatingFull || restoring || cleaning || scheduling;

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

      {/* ── Progress Bar Panel ── */}
      {progress.active && (
        <Card className={cn(
          "border-2 transition-all",
          progress.isError ? "border-destructive/50 bg-destructive/5" : "border-primary/30 bg-primary/5"
        )}>
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {progress.isError
                  ? <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                  : progressPercent === 100
                    ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    : <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
                <span className="text-sm font-semibold">
                  {progress.isError ? "Operation Failed" : progressPercent === 100 ? progress.label + " — Done!" : progress.label}
                </span>
              </div>
              <span className={cn("text-xs font-mono font-medium", progress.isError ? "text-destructive" : "text-primary")}>
                {progress.isError ? "ERROR" : `${progressPercent}%`}
              </span>
            </div>

            <Progress
              value={progressPercent}
              className={cn("h-2", progress.isError && "[&>div]:bg-destructive")}
            />

            {/* Step breadcrumb */}
            <div className="flex flex-wrap gap-1.5">
              {progress.steps.map((step, i) => {
                const done = i < progress.step;
                const active = i === progress.step && !progress.isError;
                const failed = progress.isError && i === progress.step;
                return (
                  <span key={i} className={cn(
                    "text-[11px] px-2 py-0.5 rounded-full border transition-all",
                    done ? "bg-green-500/10 text-green-600 border-green-500/20" :
                    failed ? "bg-destructive/10 text-destructive border-destructive/20" :
                    active ? "bg-primary/10 text-primary border-primary/30 font-medium" :
                    "bg-muted text-muted-foreground border-border opacity-50"
                  )}>
                    {done ? "✓ " : active ? "▶ " : ""}{step}
                  </span>
                );
              })}
            </div>

            {progress.isError && progress.errorMessage && (
              <p className="text-xs text-destructive font-mono bg-destructive/10 rounded p-2 break-all">
                {progress.errorMessage}
              </p>
            )}

            {progress.isError && (
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-muted-foreground">Check function logs below for details</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => fetchFnLogs()} disabled={loadingFnLogs} className="h-7 text-xs gap-1">
                    {loadingFnLogs ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    Refresh Logs
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setProgress(p => ({ ...p, active: false }))} className="h-7 text-xs">
                    Dismiss
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Edge Function Logs Panel ── */}
      <Card className={cn("border transition-all", fnLogsOpen ? "border-border" : "border-border/50")}>
        <CardHeader className="pb-2 cursor-pointer" onClick={() => {
          setFnLogsOpen(o => !o);
          if (!fnLogsOpen && fnLogs.length === 0) fetchFnLogs();
        }}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4 text-muted-foreground" />
              Function Logs
              <span className="text-xs text-muted-foreground font-normal">(db-backup · last 1 hour)</span>
              {fnLogs.some(l => l.level === "error") && (
                <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-medium">
                  {fnLogs.filter(l => l.level === "error").length} error{fnLogs.filter(l => l.level === "error").length !== 1 ? "s" : ""}
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); fetchFnLogs(); setFnLogsOpen(true); }} disabled={loadingFnLogs}>
                {loadingFnLogs ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                Refresh
              </Button>
              {fnLogsOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </div>
        </CardHeader>
        {fnLogsOpen && (
          <CardContent className="pt-0">
            {loadingFnLogs ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : fnLogs.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <Terminal className="w-6 h-6 mx-auto mb-2 opacity-30" />
                No logs in the last hour. Try refreshing after running an operation.
              </div>
            ) : (
              <div
                ref={fnLogsRef}
                className="font-mono text-[11px] bg-background border border-border rounded-lg p-3 max-h-72 overflow-y-auto space-y-0.5"
              >
                {fnLogs.map((log, i) => {
                  const ts = log.timestamp > 1e12 ? new Date(log.timestamp / 1000) : new Date(log.timestamp);
                  const isErr = log.level === "error" || log.event_message?.toLowerCase().includes("error");
                  const isWarn = log.level === "warning" || log.event_message?.toLowerCase().includes("failed");
                  return (
                    <div key={i} className={cn(
                      "flex gap-2 leading-5 py-0.5 px-1 rounded",
                      isErr ? "bg-destructive/10 text-destructive" :
                      isWarn ? "bg-yellow-500/10 text-yellow-600" :
                      "text-foreground"
                    )}>
                      <span className="text-muted-foreground shrink-0 select-none">
                        {format(ts, "HH:mm:ss")}
                      </span>
                      <span className={cn(
                        "shrink-0 font-bold uppercase text-[10px] mt-0.5",
                        isErr ? "text-destructive" : isWarn ? "text-yellow-600" : "text-muted-foreground"
                      )}>
                        [{isErr ? "ERR" : isWarn ? "WARN" : "LOG"}]
                      </span>
                      <span className="break-all whitespace-pre-wrap">{log.event_message}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>

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
            {creatingFull ? "Creating ZIP..." : "Create & Download Full Backup"}
          </Button>
          <div className="relative">
            <Button variant="outline" disabled={isBusy} className="gap-2">
              <Upload className="w-4 h-4" /> Restore from ZIP
            </Button>
            <input type="file" accept=".zip" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleUploadZipRestore} disabled={isBusy} />
          </div>
        </CardContent>
      </Card>

      {/* Schedule Backup Card */}
      <Card className="border-secondary/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-secondary">
            <CalendarDays className="w-4 h-4" /> Schedule a Backup
          </CardTitle>
          <CardDescription>
            Pick a specific date and time to automatically trigger a database backup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-40 justify-start text-left font-normal", !scheduleDate && "text-muted-foreground")}>
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {scheduleDate ? format(scheduleDate, "PP") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduleDate}
                    onSelect={setScheduleDate}
                    disabled={(d) => d < new Date()}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>Time (24h)</Label>
              <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-32" />
            </div>
            <div className="space-y-1.5 flex-1 min-w-36">
              <Label>Label <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={scheduleLabel} onChange={(e) => setScheduleLabel(e.target.value)} placeholder="e.g. Pre-launch backup" />
            </div>
            <Button
              onClick={() => requestPasswordConfirmation("schedule_backup")}
              disabled={!scheduleDate || !scheduleTime || isBusy}
              className="gap-2"
            >
              {scheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
              Schedule
            </Button>
          </div>

          {scheduledJobs.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Upcoming Scheduled Backups</p>
              {scheduledJobs.map((job) => {
                const log = scheduledLogs.find((l) => l.file_name === job.jobname);
                const parts = log?.note?.split("|") ?? [];
                const scheduledAt = parts[0]?.trim();
                const label = parts[1]?.trim();
                return (
                  <div key={job.jobid} className="flex items-center justify-between bg-secondary/5 rounded-lg px-3 py-2 border border-secondary/20">
                    <div>
                      <p className="text-sm font-medium text-foreground">{label || job.jobname}</p>
                      <p className="text-xs text-muted-foreground">
                        {scheduledAt ? format(new Date(scheduledAt), "PPP 'at' HH:mm") : job.schedule} · cron: {job.schedule}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => cancelScheduled(job.jobname)} className="hover:bg-destructive/10 shrink-0">
                      <X className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
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
              <li>All SMS logs (templates are preserved)</li>
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
