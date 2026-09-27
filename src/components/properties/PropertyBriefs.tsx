import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Loader2, Megaphone, Camera, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Brief {
  id: string;
  body: string;
  photo_paths: string[] | null;
  created_at: string;
  consumed_at: string | null;
  consumed_by_member: string | null;
  resolved_at: string | null;
  photo_urls?: string[];
}

// F2: ops briefs for a property — a note + photos that pin to the next clean, so the
// cleaner sees "how the hot tub should look / where the coffee pods live" etc.
export function PropertyBriefs({ listingId }: { listingId: string }) {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await (supabase.from as any)("property_briefs")
      .select("id, body, photo_paths, created_at, consumed_at, consumed_by_member, resolved_at")
      .eq("listing_id", listingId)
      .order("created_at", { ascending: false })
      .limit(30);
    const rows = (data ?? []) as Brief[];
    for (const b of rows) {
      const urls: string[] = [];
      for (const p of (b.photo_paths ?? [])) {
        const { data: s } = await supabase.storage.from("clean-issue-photos").createSignedUrl(p, 3600);
        if (s?.signedUrl) urls.push(s.signedUrl);
      }
      b.photo_urls = urls;
    }
    setBriefs(rows);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [listingId]);

  const submit = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const paths: string[] = [];
      for (const f of files) {
        const path = `briefs/${listingId}/${crypto.randomUUID()}`;
        const { error } = await supabase.storage.from("clean-issue-photos").upload(path, f, { contentType: f.type || "image/jpeg" });
        if (error) throw error;
        paths.push(path);
      }
      const { error: insErr } = await (supabase.from as any)("property_briefs").insert({
        listing_id: listingId, created_by: auth?.user?.id ?? null, body: body.trim(), photo_paths: paths,
      });
      if (insErr) throw insErr;
      setBody(""); setFiles([]);
      toast.success("Brief added — the cleaner will see it on the next clean");
      await load();
    } catch (e: any) {
      toast.error(`Couldn't add brief: ${e?.message ?? "try again"}`);
    } finally {
      setSaving(false);
    }
  };

  const resolve = async (id: string) => {
    await (supabase.from as any)("property_briefs").update({ resolved_at: new Date().toISOString() }).eq("id", id);
    setBriefs((prev) => prev.map((b) => (b.id === id ? { ...b, resolved_at: new Date().toISOString() } : b)));
  };

  const open = briefs.filter((b) => !b.resolved_at);
  const resolved = briefs.filter((b) => b.resolved_at);

  return (
    <div className="glass-card rounded-xl border border-border/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Megaphone className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Briefs for cleaners</h3>
        {open.length > 0 && <span className="text-xs text-amber-600">{open.length} open</span>}
      </div>

      <div className="space-y-2 mb-4">
        <textarea
          value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="e.g. Hot tub should be filled to the line and cover clipped shut — see photo. Coffee pods in the top drawer."
          className="w-full text-sm rounded-md border border-border/40 bg-background p-2 min-h-[64px]"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-border/50 inline-flex items-center gap-1.5 cursor-pointer hover:bg-secondary">
            <Camera className="h-3.5 w-3.5" /> Add photos
            <input type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          </label>
          {files.length > 0 && <span className="text-xs text-muted-foreground">{files.length} photo{files.length === 1 ? "" : "s"} attached</span>}
          <button onClick={submit} disabled={saving || !body.trim()}
            className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50 inline-flex items-center gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Megaphone className="h-3.5 w-3.5" />} Send to next clean
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-4 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {open.map((b) => (
            <div key={b.id} className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] text-foreground/90 whitespace-pre-wrap flex-1">{b.body}</p>
                <button onClick={() => resolve(b.id)} title="Resolve"
                  className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><X className="h-3 w-3" /> Resolve</button>
              </div>
              {b.photo_urls && b.photo_urls.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {b.photo_urls.map((u, i) => (
                    <a key={i} href={u} target="_blank" rel="noopener noreferrer"><img src={u} className="h-16 w-16 rounded object-cover border border-border/30" /></a>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {format(parseISO(b.created_at), "d MMM HH:mm")}
                {b.consumed_at ? <span className="text-emerald-600 ml-2 inline-flex items-center gap-1"><Check className="h-3 w-3" /> Understood{b.consumed_by_member ? ` — ${b.consumed_by_member}` : ""}</span> : <span className="ml-2">· awaiting cleaner</span>}
              </p>
            </div>
          ))}
          {open.length === 0 && <p className="text-xs text-muted-foreground/60">No open briefs.</p>}
          {resolved.length > 0 && (
            <details className="mt-1">
              <summary className="text-[11px] text-muted-foreground cursor-pointer">History ({resolved.length})</summary>
              <div className="space-y-1.5 mt-2">
                {resolved.map((b) => (
                  <div key={b.id} className="text-[12px] text-muted-foreground border-l-2 border-border/40 pl-2">
                    <span className="whitespace-pre-wrap">{b.body}</span>
                    <span className="opacity-60"> · {format(parseISO(b.created_at), "d MMM")}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
