import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const emptyEvent = { name: "", city: "", event_date: "", type: "", notes: "", address: "" };
const emptySuggestion = { ...emptyEvent, suggested_by: "" };

function mapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || "Danmark")}`;
}

function sortByName(items) {
  return [...items].sort((a, b) => String(a.name).localeCompare(String(b.name), "da-DK", { sensitivity: "base" }));
}

function sortNewest(items) {
  return [...items].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

function getErrorMessage(error) {
  return error?.message || error?.details || String(error || "Ukendt fejl");
}

function safeFileName(name = "pant-tip.jpg") {
  return name
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-");
}

function photoPath(file) {
  const random = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `tips/${Date.now()}-${random}-${safeFileName(file?.name)}`;
}

function addRatings(events, ratings) {
  return events.map((event) => {
    const eventRatings = ratings.filter((rating) => rating.event_id === event.id);
    const votes = eventRatings.length;
    const rating = votes
      ? Math.round(eventRatings.reduce((sum, item) => sum + Number(item.rating || 0), 0) / votes)
      : 0;
    return { ...event, rating, votes };
  });
}

function Stars({ value }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= Number(value || 0) ? "text-orange-300" : "text-zinc-600"}>★</span>
      ))}
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={`rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6 ${className}`}>{children}</div>;
}

function Button({ children, className = "", ...props }) {
  return <button className={`rounded-2xl font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props}>{children}</button>;
}

function Input(props) {
  return <input className="w-full rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-3 text-zinc-100 outline-none ring-orange-400/40 placeholder:text-zinc-600 focus:border-orange-300/40 focus:ring-4" {...props} />;
}

function TextArea(props) {
  return <textarea className="w-full rounded-2xl border border-white/10 bg-zinc-950/70 px-4 py-3 text-zinc-100 outline-none ring-orange-400/40 placeholder:text-zinc-600 focus:border-orange-300/40 focus:ring-4" {...props} />;
}

export default function FlaskemanRadarApp() {
  const [events, setEvents] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [tips, setTips] = useState([]);
  const [eventSuggestions, setEventSuggestions] = useState([]);
  const [sentTips, setSentTips] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [tip, setTip] = useState({ name: "", location: "", message: "", photo: null });
  const [suggestion, setSuggestion] = useState(emptySuggestion);
  const [newEvent, setNewEvent] = useState(emptyEvent);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const displayedEvents = useMemo(() => {
    const withRatings = addRatings(events, ratings);
    const q = query.trim().toLowerCase();
    const filtered = q
      ? withRatings.filter((event) => [event.name, event.city, event.type, event.notes].filter(Boolean).join(" ").toLowerCase().includes(q))
      : withRatings;
    return sortByName(filtered);
  }, [events, ratings, query]);

  useEffect(() => {
    init();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) checkAdmin(currentUser.id);
      else {
        setIsAdmin(false);
        setTips([]);
        setEventSuggestions([]);
      }
      loadPublicData();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function init() {
    await loadPublicData();
    const { data } = await supabase.auth.getSession();
    const currentUser = data.session?.user || null;
    setUser(currentUser);
    if (currentUser) await checkAdmin(currentUser.id);
  }

  async function loadPublicData() {
    setLoading(true);
    try {
      const { data: eventData, error: eventError } = await supabase.from("events").select("*").order("name");
      if (eventError) throw eventError;
      const { data: ratingData, error: ratingError } = await supabase.from("ratings").select("id,event_id,rating,created_at");
      if (ratingError) throw ratingError;
      setEvents(eventData || []);
      setRatings(ratingData || []);
    } catch (error) {
      setStatus(`Kunne ikke hente data: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function checkAdmin(userId) {
    try {
      const { data, error } = await supabase.from("admins").select("id").eq("id", userId).maybeSingle();
      if (error) throw error;
      const admin = Boolean(data);
      setIsAdmin(admin);
      if (admin) await loadAdminData();
    } catch (error) {
      setIsAdmin(false);
      setStatus(`Admin-status kunne ikke tjekkes: ${getErrorMessage(error)}`);
    }
  }

  async function loadAdminData() {
    const { data: tipData, error: tipError } = await supabase.from("tips").select("*").order("created_at", { ascending: false });
    if (tipError) throw tipError;
    const { data: suggestedEvents, error: eventError } = await supabase.from("events").select("*").eq("approved", false).order("created_at", { ascending: false });
    if (eventError) throw eventError;
    setTips(sortNewest(tipData || []));
    setEventSuggestions(sortNewest(suggestedEvents || []));
  }

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: adminEmail.trim(), password: adminPassword });
      if (error) throw error;
      setUser(data.user);
      setAdminPassword("");
      await checkAdmin(data.user.id);
      await loadPublicData();
      setStatus("Du er logget ind 🧡");
    } catch (error) {
      setStatus(`Login fejlede: ${getErrorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    setTips([]);
    setEventSuggestions([]);
    await loadPublicData();
    setStatus("Du er logget ud.");
  }

  async function rateEvent(eventId, rating) {
    setBusy(true);
    try {
      const { data, error } = await supabase.from("ratings").insert({ event_id: eventId, rating }).select("*").single();
      if (error) throw error;
      setRatings((current) => [data, ...current]);
      setStatus("Tak for ratingen 🧡");
    } catch (error) {
      setStatus(`Ratingen kunne ikke gemmes: ${getErrorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function submitTip(event) {
    event.preventDefault();
    if (!tip.location.trim() && !tip.message.trim()) {
      setStatus("Skriv lokation eller besked først 🧡");
      return;
    }
    setBusy(true);
    try {
      let photo_url = null;
      if (tip.photo) {
        const path = photoPath(tip.photo);
        const { error } = await supabase.storage.from("tip-photos").upload(path, tip.photo, { contentType: tip.photo.type || "image/jpeg" });
        if (error) throw error;
        photo_url = supabase.storage.from("tip-photos").getPublicUrl(path).data.publicUrl;
      }
      const payload = {
        name: tip.name.trim() || "Anonym følger",
        location: tip.location.trim() || "Ukendt lokation",
        message: tip.message.trim() || "Ingen besked",
        photo_url,
        approved: false
      };
      const { data, error } = await supabase.from("tips").insert(payload).select("*").single();
      if (error) throw error;
      setSentTips((current) => [data, ...current]);
      setTip({ name: "", location: "", message: "", photo: null });
      if (isAdmin) await loadAdminData();
      setStatus("Tak! Tippet er sendt til godkendelse 🧡");
    } catch (error) {
      setStatus(`Tippet kunne ikke sendes: ${getErrorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function submitSuggestedEvent(event) {
    event.preventDefault();
    if (!suggestion.name.trim()) {
      setStatus("Eventforslaget skal have et navn 🧡");
      return;
    }
    setBusy(true);
    try {
      const suggestedBy = suggestion.suggested_by.trim();
      const notes = suggestion.notes.trim();
      const payload = {
        name: suggestion.name.trim(),
        city: suggestion.city.trim() || null,
        event_date: suggestion.event_date.trim() || null,
        type: suggestion.type.trim() || "Foreslået event",
        notes: notes ? `${notes}${suggestedBy ? `\n\nForeslået af: ${suggestedBy}` : ""}` : suggestedBy ? `Foreslået af: ${suggestedBy}` : "Foreslået af en følger.",
        address: suggestion.address.trim() || suggestion.city.trim() || null,
        approved: false
      };
      const { error } = await supabase.from("events").insert(payload);
      if (error) throw error;
      setSuggestion(emptySuggestion);
      setShowSuggest(false);
      if (isAdmin) await loadAdminData();
      setStatus("Tak! Eventforslaget er sendt til godkendelse 🧡");
    } catch (error) {
      setStatus(`Eventforslaget kunne ikke sendes: ${getErrorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function createEvent(event) {
    event.preventDefault();
    if (!newEvent.name.trim()) {
      setStatus("Eventet skal have et navn 🧡");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.from("events").insert({ ...newEvent, approved: true }).select("*").single();
      if (error) throw error;
      setEvents((current) => [...current, data]);
      setNewEvent(emptyEvent);
      setStatus("Eventet er oprettet ✅");
    } catch (error) {
      setStatus(`Eventet kunne ikke oprettes: ${getErrorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function approveTip(id) {
    setBusy(true);
    try {
      const { error } = await supabase.from("tips").update({ approved: true }).eq("id", id);
      if (error) throw error;
      await loadAdminData();
      setStatus("Tippet er godkendt ✅");
    } catch (error) {
      setStatus(`Tippet kunne ikke godkendes: ${getErrorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteTip(id) {
    setBusy(true);
    try {
      const { error } = await supabase.from("tips").delete().eq("id", id);
      if (error) throw error;
      await loadAdminData();
      setStatus("Tippet er slettet 🗑️");
    } catch (error) {
      setStatus(`Tippet kunne ikke slettes: ${getErrorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function approveEvent(id) {
    setBusy(true);
    try {
      const { error } = await supabase.from("events").update({ approved: true }).eq("id", id);
      if (error) throw error;
      await loadAdminData();
      await loadPublicData();
      setStatus("Eventforslaget er godkendt ✅");
    } catch (error) {
      setStatus(`Eventforslaget kunne ikke godkendes: ${getErrorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteEvent(id) {
    setBusy(true);
    try {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
      await loadAdminData();
      await loadPublicData();
      setStatus("Eventet er slettet 🗑️");
    } catch (error) {
      setStatus(`Eventet kunne ikke slettes: ${getErrorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07070a] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-1/2 top-[-12rem] h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute bottom-[-10rem] right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-900/95 via-zinc-950/90 to-orange-950/60 p-6 shadow-2xl shadow-orange-950/30 sm:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-400/10 px-4 py-2 text-sm font-bold text-orange-100">♻️ Flaskeman Radar</div>
              <h1 className="max-w-3xl text-4xl font-black tracking-[-0.04em] text-white sm:text-6xl">Find de bedste pant-events i Danmark</h1>
              <p className="mt-4 max-w-2xl text-lg leading-7 text-zinc-300">Følgere kan tippe om events, rate pant-potentiale og sende lokationer, hvor Flaskeman kan hente pant og lave godt live-content.</p>
            </div>
            <div className="rounded-[1.5rem] border border-orange-300/20 bg-zinc-950/70 p-5 text-center">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">Events</p>
              <p className="text-6xl font-black text-orange-300">{events.length}</p>
            </div>
          </div>
        </header>

        {status && <div className="mb-6 rounded-2xl border border-orange-300/30 bg-orange-400/10 px-4 py-3 text-sm font-semibold text-orange-100">{status}</div>}

        <section className="mb-6 grid gap-3 md:grid-cols-[1fr_auto]">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Søg efter event, by eller type..." />
          <Button type="button" onClick={() => setShowSuggest((value) => !value)} className="bg-gradient-to-r from-orange-300 to-amber-400 px-6 py-4 text-zinc-950">＋ Foreslå event</Button>
        </section>

        {showSuggest && (
          <Card className="mb-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-white">Foreslå et event</h2>
                <p className="mt-1 text-sm text-zinc-400">Forslaget vises først efter admin-godkendelse.</p>
              </div>
              <button onClick={() => setShowSuggest(false)} className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm font-bold">Luk</button>
            </div>
            <form onSubmit={submitSuggestedEvent} className="grid gap-3 md:grid-cols-2">
              <Input value={suggestion.name} onChange={(event) => setSuggestion({ ...suggestion, name: event.target.value })} placeholder="Eventnavn" />
              <Input value={suggestion.city} onChange={(event) => setSuggestion({ ...suggestion, city: event.target.value })} placeholder="By" />
              <Input value={suggestion.event_date} onChange={(event) => setSuggestion({ ...suggestion, event_date: event.target.value })} placeholder="Dato" />
              <Input value={suggestion.type} onChange={(event) => setSuggestion({ ...suggestion, type: event.target.value })} placeholder="Type" />
              <Input value={suggestion.address} onChange={(event) => setSuggestion({ ...suggestion, address: event.target.value })} placeholder="Adresse / Google Maps" />
              <Input value={suggestion.suggested_by} onChange={(event) => setSuggestion({ ...suggestion, suggested_by: event.target.value })} placeholder="Dit navn / TikTok-navn" />
              <TextArea value={suggestion.notes} onChange={(event) => setSuggestion({ ...suggestion, notes: event.target.value })} placeholder="Hvorfor er der pant at komme efter?" rows={4} />
              <Button type="submit" disabled={busy} className="bg-gradient-to-r from-orange-300 to-amber-400 px-6 py-4 text-zinc-950 md:col-span-2">{busy ? "Sender..." : "Send eventforslag"}</Button>
            </form>
          </Card>
        )}

        <main className="grid gap-6 lg:grid-cols-[1.45fr_0.85fr]">
          <section className="space-y-4">
            {loading ? <Card>Henter events...</Card> : displayedEvents.length === 0 ? <Card>Ingen events matcher søgningen.</Card> : displayedEvents.map((event) => (
              <Card key={event.id} className="transition hover:-translate-y-1 hover:border-orange-300/30">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-3xl font-black text-white">{event.name}</h2>
                    <div className="mt-3 flex flex-wrap gap-2 text-sm text-zinc-300">
                      <span className="rounded-full border border-white/10 bg-zinc-950/60 px-3 py-1">{event.city || "Ukendt by"}</span>
                      <span className="rounded-full border border-white/10 bg-zinc-950/60 px-3 py-1">{event.event_date || "Dato kommer"}</span>
                      <span className="rounded-full border border-white/10 bg-zinc-950/60 px-3 py-1">{event.type || "Event"}</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-orange-300/20 bg-orange-400/10 p-3">
                    <Stars value={event.rating} />
                    <p className="mt-1 text-xs text-zinc-400">{event.votes} ratings</p>
                  </div>
                </div>
                <p className="mt-5 whitespace-pre-line leading-7 text-zinc-300">{event.notes}</p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <a href={mapsUrl(event.address)} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 bg-zinc-950/50 px-4 py-3 text-center text-sm font-bold hover:text-orange-100">📍 Åbn i Google Maps ↗</a>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-400">Rate pant:</span>
                    {[1, 2, 3, 4, 5].map((rating) => <button key={rating} disabled={busy} onClick={() => rateEvent(event.id, rating)} className="rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm font-black hover:bg-orange-400 hover:text-zinc-950">{rating}</button>)}
                  </div>
                </div>
              </Card>
            ))}
          </section>

          <aside className="space-y-4">
            <Card>
              <h2 className="mb-2 text-2xl font-black text-white">Send pant-tip</h2>
              <p className="mb-5 text-sm text-zinc-400">Har du flasker, dåser eller et hotspot? Send lokation og evt. billede.</p>
              <form onSubmit={submitTip} className="space-y-3">
                <Input value={tip.name} onChange={(event) => setTip({ ...tip, name: event.target.value })} placeholder="Dit navn / TikTok-navn" />
                <Input value={tip.location} onChange={(event) => setTip({ ...tip, location: event.target.value })} placeholder="Adresse eller lokation" />
                <TextArea value={tip.message} onChange={(event) => setTip({ ...tip, message: event.target.value })} placeholder="Beskriv hvad der kan hentes..." rows={4} />
                <label className="flex cursor-pointer justify-center rounded-2xl border border-dashed border-orange-300/30 bg-orange-400/5 px-4 py-4 text-sm font-bold hover:bg-orange-400/10">
                  📷 Upload foto
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => setTip({ ...tip, photo: event.target.files?.[0] || null })} />
                </label>
                {tip.photo && <p className="text-xs text-orange-200">Valgt foto: {tip.photo.name}</p>}
                <Button type="submit" disabled={busy} className="w-full bg-gradient-to-r from-orange-300 to-amber-400 py-4 text-zinc-950">{busy ? "Sender..." : "Send tip"}</Button>
              </form>
            </Card>

            {sentTips.length > 0 && (
              <Card>
                <h3 className="text-xl font-black">Senest indsendt</h3>
                <div className="mt-3 space-y-3">
                  {sentTips.map((item) => <div key={item.id} className="rounded-2xl border border-white/10 bg-zinc-950/70 p-3 text-sm"><strong>{item.location}</strong><p>{item.message}</p>{item.photo_url && <a href={item.photo_url} target="_blank" rel="noreferrer" className="text-orange-200 underline">Se foto</a>}</div>)}
                </div>
              </Card>
            )}

            <Card className="border-orange-300/20 bg-orange-400/10">
              <h3 className="text-xl font-black">Admin</h3>
              {!user ? (
                <form onSubmit={login} className="mt-4 space-y-3">
                  <Input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} placeholder="Admin email" />
                  <Input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} placeholder="Password" />
                  <Button type="submit" disabled={busy} className="w-full bg-gradient-to-r from-orange-300 to-amber-400 py-4 text-zinc-950">Log ind som admin</Button>
                </form>
              ) : (
                <div className="mt-4 space-y-3">
                  <p className="text-sm">Logget ind som {user.email}</p>
                  <p className="text-sm font-bold">Status: {isAdmin ? "Administrator ✅" : "Ikke administrator endnu"}</p>
                  <Button type="button" onClick={logout} className="w-full border border-white/10 bg-zinc-950/70 py-3">Log ud</Button>
                </div>
              )}
            </Card>
          </aside>
        </main>

        {isAdmin && (
          <section className="mt-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <Card>
              <h2 className="text-2xl font-black text-white">Opret event</h2>
              <form onSubmit={createEvent} className="mt-5 space-y-3">
                <Input value={newEvent.name} onChange={(event) => setNewEvent({ ...newEvent, name: event.target.value })} placeholder="Eventnavn" />
                <Input value={newEvent.city} onChange={(event) => setNewEvent({ ...newEvent, city: event.target.value })} placeholder="By" />
                <Input value={newEvent.event_date} onChange={(event) => setNewEvent({ ...newEvent, event_date: event.target.value })} placeholder="Dato" />
                <Input value={newEvent.type} onChange={(event) => setNewEvent({ ...newEvent, type: event.target.value })} placeholder="Type" />
                <Input value={newEvent.address} onChange={(event) => setNewEvent({ ...newEvent, address: event.target.value })} placeholder="Adresse" />
                <TextArea value={newEvent.notes} onChange={(event) => setNewEvent({ ...newEvent, notes: event.target.value })} placeholder="Beskrivelse" rows={4} />
                <Button disabled={busy} className="w-full bg-gradient-to-r from-orange-300 to-amber-400 py-4 text-zinc-950">Opret event</Button>
              </form>
            </Card>

            <Card>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white">Admin-godkendelse</h2>
                  <p className="text-sm text-zinc-400">Godkend eventforslag og pant-tips.</p>
                </div>
                <Button onClick={loadAdminData} disabled={busy} className="border border-white/10 bg-zinc-950/70 px-4 py-3">Opdater</Button>
              </div>

              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="mb-3 text-lg font-black text-white">Eventforslag</h3>
                  {eventSuggestions.length === 0 ? <p className="text-sm text-zinc-400">Ingen eventforslag afventer.</p> : eventSuggestions.map((item) => (
                    <div key={item.id} className="mb-3 rounded-2xl border border-white/10 bg-zinc-950/70 p-4 text-sm">
                      <strong className="text-white">{item.name}</strong>
                      <p className="mt-1 text-zinc-300">{item.city || "Ukendt by"} · {item.event_date || "Dato mangler"}</p>
                      <p className="mt-2 whitespace-pre-line text-zinc-400">{item.notes}</p>
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => approveEvent(item.id)} disabled={busy} className="rounded-xl bg-emerald-400 px-3 py-2 font-black text-zinc-950">Godkend</button>
                        <button onClick={() => deleteEvent(item.id)} disabled={busy} className="rounded-xl bg-red-400 px-3 py-2 font-black text-zinc-950">Slet</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <h3 className="mb-3 text-lg font-black text-white">Pant-tips</h3>
                  {tips.length === 0 ? <p className="text-sm text-zinc-400">Ingen tips endnu.</p> : tips.map((item) => (
                    <div key={item.id} className="mb-3 rounded-2xl border border-white/10 bg-zinc-950/70 p-4 text-sm">
                      <strong className="text-white">{item.location}</strong>
                      <p className="mt-1 text-zinc-300">{item.message}</p>
                      <p className="mt-2 text-xs text-zinc-500">Fra: {item.name || "Anonym"}</p>
                      {item.photo_url && <a href={item.photo_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-orange-200 underline">Se foto</a>}
                      <p className="mt-2 text-xs text-zinc-500">Status: {item.approved ? "Godkendt" : "Afventer"}</p>
                      <div className="mt-3 flex gap-2">
                        {!item.approved && <button onClick={() => approveTip(item.id)} disabled={busy} className="rounded-xl bg-emerald-400 px-3 py-2 font-black text-zinc-950">Godkend</button>}
                        <button onClick={() => deleteTip(item.id)} disabled={busy} className="rounded-xl bg-red-400 px-3 py-2 font-black text-zinc-950">Slet</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
}