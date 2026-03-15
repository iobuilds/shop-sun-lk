import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, RefreshCw, Mail, MailOpen, ArrowLeft, Search,
  AlertCircle, Inbox, Trash2,
} from "lucide-react";

interface Email {
  uid: number;
  seq: number;
  subject: string;
  from: string;
  fromEmail: string;
  to: string;
  date: string;
  isRead: boolean;
  size: number;
}

interface EmailDetail extends Email {
  body: string;
  isHtml: boolean;
}

export default function EmailInboxViewer() {
  const queryClient = useQueryClient();
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);
  const [loadingBody, setLoadingBody] = useState(false);
  const [search, setSearch] = useState("");
  const [readUids, setReadUids] = useState<Set<number>>(new Set());

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-inbox"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-inbox", {
        body: {},
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to fetch inbox");
      return data as { emails: Email[]; total: number; unseen: number };
    },
    staleTime: 60_000,
    retry: false,
  });

  const openEmail = async (email: Email) => {
    setLoadingBody(true);
    setSelectedEmail({ ...email, body: "", isHtml: false });
    try {
      const { data, error } = await supabase.functions.invoke("fetch-inbox", {
        body: { action: "body", uid: String(email.uid) },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed");
      setSelectedEmail({ ...email, ...data.email, isRead: true });
      setReadUids((s) => new Set([...s, email.uid]));
    } catch (e: any) {
      toast({ title: "Failed to load email", description: e.message, variant: "destructive" });
      setSelectedEmail(null);
    } finally {
      setLoadingBody(false);
    }
  };

  const filteredEmails = (data?.emails || []).filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.subject.toLowerCase().includes(q) || e.from.toLowerCase().includes(q);
  });

  const unreadCount = (data?.emails || []).filter((e) => !e.isRead && !readUids.has(e.uid)).length;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
            <Inbox className="w-5 h-5" />
            Inbox
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">info@nanocircuit.lk</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Badge className="bg-blue-600 hover:bg-blue-600 gap-1">
              <Mail className="w-3 h-3" />
              {unreadCount} unread
            </Badge>
          )}
          {data && (
            <Badge variant="outline" className="text-muted-foreground">
              {data.total} total
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              queryClient.removeQueries({ queryKey: ["admin-inbox"] });
              refetch();
            }}
            disabled={isFetching}
          >
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 mb-4">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Could not connect to mailbox</p>
            <p className="text-xs text-muted-foreground mt-0.5">{(error as Error).message}</p>
            <p className="text-xs text-muted-foreground mt-1">Check SMTP_HOST, SMTP_FROM_EMAIL and SMTP_PASSWORD secrets. IMAP must be enabled on your mail server (port 993).</p>
          </div>
        </div>
      )}

      {/* Email detail view */}
      {selectedEmail ? (
        <div className="border border-border rounded-xl overflow-hidden">
          {/* Detail toolbar */}
          <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 h-8"
              onClick={() => setSelectedEmail(null)}
            >
              <ArrowLeft className="w-4 h-4" /> Back to Inbox
            </Button>
          </div>

          {/* Email header */}
          <div className="px-6 py-4 border-b border-border bg-muted/10">
            <h3 className="text-lg font-semibold text-foreground mb-3">
              {selectedEmail.subject || "(no subject)"}
            </h3>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">From: </span>
                <span className="font-medium">{selectedEmail.from}</span>
              </div>
              <div>
                <span className="text-muted-foreground">To: </span>
                <span>{selectedEmail.to || "info@nanocircuit.lk"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Date: </span>
                <span>{new Date(selectedEmail.date).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Email body */}
          <div className="px-6 py-4 min-h-[300px]">
            {loadingBody ? (
              <div className="flex items-center gap-2 py-12 text-muted-foreground justify-center">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading email…</span>
              </div>
            ) : selectedEmail.isHtml ? (
              <iframe
                srcDoc={selectedEmail.body}
                title="Email body"
                className="w-full min-h-[400px] border-0 rounded"
                sandbox="allow-same-origin"
              />
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-foreground leading-relaxed font-sans">
                {selectedEmail.body}
              </pre>
            )}
          </div>
        </div>
      ) : (
        /* Email list view */
        <>
          {/* Search */}
          {!isLoading && !error && (
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by sender or subject…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Connecting to mailbox…</p>
            </div>
          ) : !error && filteredEmails.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-xl">
              <Inbox className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{search ? "No matching emails" : "Inbox is empty"}</p>
            </div>
          ) : !error ? (
            <div className="border border-border rounded-xl overflow-hidden divide-y divide-border/60">
              {filteredEmails.map((email) => {
                const isUnread = !email.isRead && !readUids.has(email.uid);
                return (
                  <button
                    key={email.uid}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors flex items-center gap-3 ${
                      isUnread ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
                    }`}
                    onClick={() => openEmail(email)}
                  >
                    <div className="shrink-0">
                      {isUnread ? (
                        <Mail className="w-4 h-4 text-blue-600" />
                      ) : (
                        <MailOpen className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm truncate ${isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}>
                          {email.from || "Unknown"}
                        </span>
                        {isUnread && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />}
                      </div>
                      <p className={`text-sm truncate mt-0.5 ${isUnread ? "text-foreground" : "text-muted-foreground"}`}>
                        {email.subject || "(no subject)"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(email.date)}
                      </span>
                      {email.size > 0 && (
                        <span className="text-xs text-muted-foreground/60">
                          {formatSize(email.size)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
