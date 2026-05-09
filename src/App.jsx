import React, { useMemo, useState } from "react";

const initialEvents = [
  {
    id: 1,
    name: "Aalborg Karneval",
    city: "Aalborg",
    date: "24. maj 2026",
    type: "Gadefest / karneval",
    rating: 5,
    votes: 42,
    notes: "Meget høj chance for pant efter optog, parker og festzoner.",
    address: "Kildeparken, Aalborg"
  },
  {
    id: 2,
    name: "Distortion",
    city: "København",
    date: "3.–7. juni 2026",
    type: "Gadefest / musik",
    rating: 5,
    votes: 88,
    notes: "Ekstremt meget pant i områder med mange unge og street parties.",
    address: "København"
  },
  {
    id: 3,
    name: "Grøn Koncert",
    city: "Flere byer",
    date: "Sommer 2026",
    type: "Koncertturné",
    rating: 4,
    votes: 31,
    notes: "Godt potentiale udenfor pladsen og ved adgangsveje.",
    address: "Danmark"
  },
  {
    id: 4,
    name: "Jelling Musikfestival",
    city: "Jelling",
    date: "Maj 2026",
    type: "Festival",
    rating: 4,
    votes: 19,
    notes: "Campingområder kan være interessante efter store aftener.",
    address: "Mølvangvej, Jelling"
  },
  {
    id: 5,
    name: "Roskilde Festival",
    city: "Roskilde",
    date: "27. juni–4. juli 2026",
    type: "Festival",
    rating: 5,
    votes: 156,
    notes: "Legendarisk pant-potentiale. Camping, indgange og stationen er oplagte content-zoner.",
    address: "Darupvej 19, Roskilde"
  },
  {
    id: 6,
    name: "Smukfest",
    city: "Skanderborg",
    date: "August 2026",
    type: "Festival",
    rating: 4,
    votes: 27,
    notes: "God mulighed omkring camping og byens transportpunkter.",
    address: "Dyrehaven, Skanderborg"
  }
];

function mapsUrl(address) {
  const safeAddress = address && address.trim() ? address : "Danmark";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(safeAddress)}`;
}

function sortEventsAlphabetically(events) {
  return [...events].sort((a, b) => String(a.name).localeCompare(String(b.name), "da"));
}

function filterEvents(events, query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const sortedEvents = sortEventsAlphabetically(events);

  if (!normalizedQuery) return sortedEvents;

  return sortedEvents.filter((event) => {
    const haystack = [event.name, event.city, event.type, event.notes]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

function calculateNewRating(currentRating, currentVotes, newRating) {
  const safeCurrentRating = Number(currentRating) || 0;
  const safeCurrentVotes = Number(currentVotes) || 0;
  const safeNewRating = Math.min(5, Math.max(1, Number(newRating) || 1));
  const votes = safeCurrentVotes + 1;
  const total = safeCurrentRating * safeCurrentVotes + safeNewRating;

  return {
    rating: Math.round(total / votes),
    votes
  };
}

function runSmokeTests() {
  const sorted = sortEventsAlphabetically([
    { name: "Roskilde Festival" },
    { name: "Aalborg Karneval" },
    { name: "Distortion" }
  ]);

  console.assert(sorted[0].name === "Aalborg Karneval", "Events should be sorted alphabetically");
  console.assert(filterEvents(initialEvents, "roskilde").length === 1, "Search should find Roskilde Festival");
  console.assert(filterEvents(initialEvents, "").length === initialEvents.length, "Empty search should return all events");
  console.assert(mapsUrl("Darupvej 19, Roskilde").includes("Darupvej%2019%2C%20Roskilde"), "Google Maps URL should encode addresses");
  console.assert(mapsUrl("").includes("Danmark"), "Empty map address should fall back to Denmark");

  const updated = calculateNewRating(4, 9, 5);
  console.assert(updated.rating === 4 && updated.votes === 10, "Rating should update without breaking vote count");

  const clamped = calculateNewRating(5, 1, 99);
  console.assert(clamped.rating === 5 && clamped.votes === 2, "Rating should clamp values above 5");
}

runSmokeTests();

function Stars({ value }) {
  const safeValue = Math.min(5, Math.max(0, Number(value) || 0));

  return (
    <div className="flex items-center gap-1" aria-label={`${safeValue} ud af 5 stjerner`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= safeValue ? "text-orange-300" : "text-zinc-600"}>
          ★
        </span>
      ))}
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={`rounded-3xl border shadow-xl ${className}`}>{children}</div>;
}

function AppButton({ children, className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-2xl font-bold transition hover:opacity-90 active:scale-[0.99] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default function FlaskemanRadarApp() {
  const [events, setEvents] = useState(initialEvents);
  const [query, setQuery] = useState("");
  const [tip, setTip] = useState({ name: "", location: "", message: "", photo: null });
  const [sentTips, setSentTips] = useState([]);
  const [statusMessage, setStatusMessage] = useState("");

  const filteredEvents = useMemo(() => filterEvents(events, query), [events, query]);

  function rateEvent(id, rating) {
    setEvents((currentEvents) =>
      currentEvents.map((event) => {
        if (event.id !== id) return event;
        return { ...event, ...calculateNewRating(event.rating, event.votes, rating) };
      })
    );

    setStatusMessage("Tak for ratingen! Flaskeman-radaren er opdateret 🧡");
  }

  function submitTip(event) {
    event.preventDefault();

    const hasLocation = tip.location.trim().length > 0;
    const hasMessage = tip.message.trim().length > 0;

    if (!hasLocation && !hasMessage) {
      setStatusMessage("Skriv en lokation eller en kort besked, så Flaskeman ved hvor han skal kigge 🧡");
      return;
    }

    setSentTips((currentTips) => [
      {
        id: Date.now(),
        name: tip.name.trim() || "Anonym følger",
        location: tip.location.trim() || "Ukendt lokation",
        message: tip.message.trim() || "Ingen besked",
        photoName: tip.photo?.name || "Intet foto"
      },
      ...currentTips
    ]);

    setTip({ name: "", location: "", message: "", photo: null });
    setStatusMessage("Tak! Tippet er gemt i prototypen 🧡");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 overflow-hidden rounded-3xl border border-orange-400/20 bg-gradient-to-br from-zinc-900 via-zinc-900 to-orange-950/40 p-6 shadow-2xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-orange-400/10 px-3 py-1 text-sm text-orange-200">
                <span aria-hidden="true">♻️</span>
                <span>Flaskeman Radar</span>
              </div>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
                Find de bedste pant-events i Danmark
              </h1>
              <p className="mt-3 max-w-2xl text-zinc-300">
                Følgere kan tippe om events, rate pant-potentiale og sende lokationer, hvor Flaskeman kan hente pant og lave godt live-content.
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-950/60 p-5 text-center shadow-inner">
              <p className="text-sm text-zinc-400">Events på radaren</p>
              <p className="text-5xl font-black text-orange-300">{events.length}</p>
            </div>
          </div>
        </header>

        {statusMessage && (
          <div className="mb-6 rounded-2xl border border-orange-400/30 bg-orange-400/10 px-4 py-3 text-orange-100">
            {statusMessage}
          </div>
        )}

        <section className="mb-6 grid gap-4 md:grid-cols-[1fr_auto]">
          <label className="relative block">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">🔎</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Søg efter event, by eller type..."
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-12 py-4 text-zinc-100 outline-none ring-orange-400/40 placeholder:text-zinc-500 focus:ring-4"
            />
          </label>

          <AppButton
            type="button"
            onClick={() => setStatusMessage("I en rigtig version åbner denne knap en formular til nye events.")}
            className="bg-orange-400 px-6 py-4 text-zinc-950"
          >
            <span className="mr-2">＋</span>
            Foreslå event
          </AppButton>
        </section>

        <main className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <section className="space-y-4">
            {filteredEvents.length === 0 ? (
              <Card className="border-zinc-800 bg-zinc-900/80 p-6 text-zinc-300">
                Ingen events matcher din søgning endnu.
              </Card>
            ) : (
              filteredEvents.map((event) => (
                <Card key={event.id} className="overflow-hidden border-zinc-800 bg-zinc-900/80 text-zinc-100">
                  <div className="p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="text-2xl font-black">{event.name}</h2>
                        <div className="mt-2 flex flex-wrap gap-2 text-sm text-zinc-300">
                          <span className="rounded-full bg-zinc-800 px-3 py-1">{event.city}</span>
                          <span className="rounded-full bg-zinc-800 px-3 py-1">{event.date}</span>
                          <span className="rounded-full bg-zinc-800 px-3 py-1">{event.type}</span>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-orange-400/10 p-3 text-orange-200">
                        <Stars value={event.rating} />
                        <p className="mt-1 text-xs text-zinc-400">{event.votes} tips</p>
                      </div>
                    </div>

                    <p className="mt-4 text-zinc-300">{event.notes}</p>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <a
                        href={mapsUrl(event.address)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 px-4 py-3 text-sm text-zinc-100 hover:border-orange-300 hover:text-orange-200"
                      >
                        <span aria-hidden="true">📍</span>
                        Åbn i Google Maps
                        <span aria-hidden="true">↗</span>
                      </a>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-zinc-400">Rate pant:</span>
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => rateEvent(event.id, rating)}
                            className="rounded-lg bg-zinc-800 px-2 py-1 text-sm hover:bg-orange-400 hover:text-zinc-950"
                            aria-label={`Giv ${event.name} ${rating} ud af 5 i pant-rating`}
                          >
                            {rating}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </section>

          <aside className="space-y-4">
            <Card className="border-zinc-800 bg-zinc-900/80 text-zinc-100">
              <div className="p-5">
                <h2 className="mb-2 text-2xl font-black">Send pant-tip</h2>
                <p className="mb-5 text-sm text-zinc-400">
                  Har du flasker, dåser eller et hotspot? Send lokation og evt. billede.
                </p>

                <form onSubmit={submitTip} className="space-y-3">
                  <input
                    value={tip.name}
                    onChange={(event) => setTip({ ...tip, name: event.target.value })}
                    placeholder="Dit navn / TikTok-navn"
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:ring-4 focus:ring-orange-400/40"
                  />

                  <input
                    value={tip.location}
                    onChange={(event) => setTip({ ...tip, location: event.target.value })}
                    placeholder="Adresse eller lokation"
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:ring-4 focus:ring-orange-400/40"
                  />

                  <textarea
                    value={tip.message}
                    onChange={(event) => setTip({ ...tip, message: event.target.value })}
                    placeholder="Beskriv hvad der kan hentes..."
                    rows={4}
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 outline-none focus:ring-4 focus:ring-orange-400/40"
                  />

                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 px-4 py-4 text-sm text-zinc-300 hover:border-orange-300 hover:text-orange-200">
                    <span aria-hidden="true">📷</span>
                    Upload foto
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => setTip({ ...tip, photo: event.target.files?.[0] || null })}
                    />
                  </label>

                  {tip.photo && <p className="text-xs text-orange-200">Valgt foto: {tip.photo.name}</p>}

                  <AppButton type="submit" className="w-full bg-orange-400 py-4 text-zinc-950">
                    <span className="mr-2">➤</span>
                    Send tip
                  </AppButton>
                </form>
              </div>
            </Card>

            {sentTips.length > 0 && (
              <Card className="border-zinc-800 bg-zinc-900/80 text-zinc-100">
                <div className="p-5">
                  <h3 className="text-xl font-black">Indsendte tips</h3>
                  <div className="mt-3 space-y-3">
                    {sentTips.map((sentTip) => (
                      <div key={sentTip.id} className="rounded-2xl bg-zinc-950 p-3 text-sm text-zinc-300">
                        <p className="font-bold text-zinc-100">{sentTip.location}</p>
                        <p>{sentTip.message}</p>
                        <p className="mt-1 text-xs text-zinc-500">Fra: {sentTip.name}</p>
                        <p className="text-xs text-zinc-500">Foto: {sentTip.photoName}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            <Card className="border-orange-400/20 bg-orange-400/10 text-orange-100">
              <div className="p-5">
                <h3 className="text-xl font-black">Næste smarte funktioner</h3>
                <p className="mt-2 text-sm text-orange-100/80">
                  Login, moderator-godkendelse, live-kort, pushbeskeder og en “Flaskeman kommer måske forbi”-knap.
                </p>
              </div>
            </Card>
          </aside>
        </main>
      </div>
    </div>
  );
}
