import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import type { Session } from "@supabase/supabase-js";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  message: z.string().trim().min(1, "Message is required").max(2000),
});

const ContactForm = () => {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        supabase.from("profiles").select("*").eq("user_id", session.user.id).maybeSingle().then(({ data }) => {
          if (data) {
            setProfile(data);
            setForm(f => ({
              ...f,
              name: data.full_name || session.user.user_metadata?.full_name || "",
              email: session.user.email || "",
            }));
          }
        });
      }
    });
  }, []);

  const isLoggedIn = !!session?.user;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = contactSchema.safeParse(form);
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    setSubmitting(true);
    try {
      // If logged in, create a conversation + first message
      if (isLoggedIn && session?.user) {
        const { data: convo, error: convoError } = await supabase
          .from("conversations" as any)
          .insert({ user_id: session.user.id, subject: result.data.subject })
          .select()
          .single();
        if (convoError) throw convoError;

        const { error: msgError } = await supabase
          .from("conversation_messages" as any)
          .insert({
            conversation_id: (convo as any).id,
            sender_id: session.user.id,
            sender_type: "user",
            message: result.data.message,
          });
        if (msgError) throw msgError;
      } else {
        // Guest: use old contact_messages table
        const { error } = await supabase.from("contact_messages").insert([{
          name: result.data.name,
          email: result.data.email,
          subject: result.data.subject,
          message: result.data.message,
        }]);
        if (error) throw error;
      }
      
      setSubmitted(true);
      toast.success("Message sent successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-12 h-12 text-secondary mx-auto mb-4" />
        <h3 className="text-lg font-bold font-display text-foreground mb-2">Message Sent!</h3>
        <p className="text-muted-foreground">
          {isLoggedIn ? "You can view replies in your Messages inbox." : "We'll get back to you as soon as possible."}
        </p>
        <Button variant="outline" className="mt-4" onClick={() => { setSubmitted(false); setForm({ name: form.name, email: form.email, subject: "", message: "" }); }}>
          Send Another Message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isLoggedIn && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" required maxLength={100} />
          </div>
          <div>
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" required maxLength={255} />
          </div>
        </div>
      )}
      {isLoggedIn && (
        <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-secondary shrink-0" />
          Sending as <span className="font-medium text-foreground">{form.name || session?.user?.email}</span>
        </div>
      )}
      <div>
        <Label>Subject *</Label>
        <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="How can we help?" required maxLength={200} />
      </div>
      <div>
        <Label>Message *</Label>
        <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tell us more..." rows={5} required maxLength={2000} />
      </div>
      <Button type="submit" disabled={submitting} className="gap-2">
        {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : <><Send className="w-4 h-4" /> Send Message</>}
      </Button>
    </form>
  );
};

export default ContactForm;
