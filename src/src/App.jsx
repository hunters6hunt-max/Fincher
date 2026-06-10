import { useState, useEffect, useRef, useCallback } from "react";

// ─── Storage ──────────────────────────────────────────────────────────────────
const S = {
  async get(k) { try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; } catch { return null; } },
  async set(k, v) { try { await window.storage.set(k, JSON.stringify(v)); } catch {} },
  async list(prefix) { try { const r = await window.storage.list(prefix); return r ? r.keys : []; } catch { return []; } },
  async del(k) { try { await window.storage.delete(k); } catch {} },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 11);
const now = () => new Date().toISOString();
const fmt = iso => { const d = new Date(iso); return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); };
const secKey = () => "FK-" + Array.from(crypto.getRandomValues(new Uint8Array(14))).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();

const isDeadHour = () => {
  const h = new Date().getHours();
  return (h >= 0 && h < 1) || (h >= 3 && h < 5);
};

const getNextDeadHour = () => {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();
  let target = new Date(now);
  if (h >= 5) { target.setHours(24, 0, 0, 0); }
  else if (h >= 1 && h < 3) { target.setHours(3, 0, 0, 0); }
  else { return 0; }
  return Math.floor((target - now) / 1000);
};

const ADMIN_PATH = "fincher-core-gate-x7z9";
const ADMIN_PIN_DEFAULT = "F1nch3r@Admin2024";

// ─── AI Psychologist responses ────────────────────────────────────────────────
const AI_RESPONSES = [
  "I hear you. That takes real courage to share. How long have you been carrying this?",
  "Thank you for trusting this space with something so personal. You're not alone in feeling this way.",
  "That sounds incredibly heavy. What does it feel like when those thoughts come up?",
  "I want you to know — what you're feeling is valid. Can you tell me more about what's been happening?",
  "It sounds like you've been trying so hard. What does support look like for you right now?",
  "Sometimes the hardest things to say out loud are the ones we need to most. I'm here. Keep going.",
  "You're showing real strength by opening up. What would feel like a small relief right now?",
  "I understand. Nights can make everything feel more intense. What's weighing on you most tonight?",
  "That's a really honest thing to share. How are you taking care of yourself through this?",
  "You reached out, and that matters more than you know. What do you need from this space tonight?",
];

const getAIResponse = (memory) => {
  const idx = Math.floor(Math.random() * AI_RESPONSES.length);
  return AI_RESPONSES[idx];
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("feed");
  const [alias, setAlias] = useState(null);
  const [isDark, setIsDark] = useState(true);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deadActive, setDeadActive] = useState(isDeadHour());
  const [showAdmin, setShowAdmin] = useState(false);
  const [dmData, setDmData] = useState(null);
  const [aboutContent, setAboutContent] = useState(null);

  useEffect(() => {
    document.documentElement.classList.toggle("theme-light", !isDark);
    document.body.style.background = isDark ? "#0d0d0f" : "#f5f1eb";
  }, [isDark]);

  useEffect(() => {
    (async () => {
      const savedAlias = await S.get("user:alias");
      if (savedAlias) setAlias(savedAlias);
      const about = await S.get("cms:about");
      if (about) setAboutContent(about);
      else {
        const def = {
          mission: "Fincher is a space where thoughts live for 24 hours and disappear forever. No names. No profiles. Just raw, honest human expression.",
          guidelines: "Be human. Be kind. No hate speech, no explicit content, no personal information. This is a 12+ platform. Violations are removed instantly.",
          privacy: "Every post is permanently deleted after 24 hours. No tracking. No profiles. Your data doesn't exist here longer than it needs to.",
          deadHour: "Dead Hour is a sacred window — 12am to 1am and 3am to 5am. The platform shifts. The feed slows. People share what they can't say in daylight. Confessions, fears, gratitude. A space for the 3am feeling.",
        };
        await S.set("cms:about", def);
        setAboutContent(def);
      }
      await refreshPosts();
      setLoading(false);
    })();
    const t = setInterval(() => { setDeadActive(isDeadHour()); refreshPosts(); }, 30000);
    return () => clearInterval(t);
  }, []);

  const refreshPosts = async () => {
    const keys = await S.list("post:");
    const items = await Promise.all(keys.map(k => S.get(k)));
    const now24 = Date.now() - 24 * 60 * 60 * 1000;
    const valid = items.filter(p => p && new Date(p.ts).getTime() > now24);
    const expired = items.filter(p => p && new Date(p.ts).getTime() <= now24);
    for (const p of expired) await S.del(p.id);
    setPosts(valid.sort((a, b) => new Date(b.ts) - new Date(a.ts)));
  };

  // Check for admin path in hash
  useEffect(() => {
    const checkPath = () => {
      if (window.location.hash === `#${ADMIN_PATH}`) setShowAdmin(true);
    };
    checkPath();
    window.addEventListener("hashchange", checkPath);
    return () => window.removeEventListener("hashchange", checkPath);
  }, []);

  if (showAdmin) return <AdminSite setShowAdmin={setShowAdmin} posts={posts} refreshPosts={refreshPosts} aboutContent={aboutContent} setAboutContent={setAboutContent} />;
  if (loading) return <Splash />;

  return (
    <div className={deadActive ? "dead-mode" : ""} style={{ minHeight: "100vh", position: "relative" }}>
      {deadActive && <div className="dead-overlay" />}
      <Nav alias={alias} page={page} setPage={setPage} isDark={isDark} setIsDark={setIsDark} deadActive={deadActive} />
      <div style={{ position: "relative", zIndex: 1 }}>
        {page === "feed" && <Feed alias={alias} setAlias={setAlias} posts={posts} refreshPosts={refreshPosts} deadActive={deadActive} setPage={setPage} setDmData={setDmData} />}
        {page === "about" && <AboutPage content={aboutContent} setPage={setPage} />}
        {page === "dead" && <DeadHourPage alias={alias} setAlias={setAlias} setPage={setPage} />}
        {page === "dm" && <PrivateChat alias={alias} dmData={dmData} setPage={setPage} />}
        {page === "inbox" && <Inbox alias={alias} setPage={setPage} setDmData={setDmData} />}
      </div>
      <Footer setPage={setPage} />
    </div>
  );
}

// ─── Splash ───────────────────────────────────────────────────────────────────
function Splash() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 12, background: "var(--bg)" }}>
      <div className="serif gradient-text" style={{ fontSize: 44, letterSpacing: 4, fontWeight: 300 }}>fincher</div>
      <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: 2 }}>LOADING</div>
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ alias, page, setPage, isDark, setIsDark, deadActive }) {
  return (
    <nav className="nav">
      <div onClick={() => setPage("feed")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
        <span className="serif gradient-text" style={{ fontSize: 26, letterSpacing: 2, fontWeight: 400 }}>fincher</span>
        {deadActive && <span className="tag tag-dead" style={{ fontSize: 10 }}>☽ dead hour</span>}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--muted)" }}>
          <span className={`status-dot ${deadActive ? "dead" : "green"}`} />
          <span className="mono" style={{ fontSize: 10 }}>live</span>
        </span>
        {alias && (
          <button onClick={() => setPage("inbox")} className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }}>📬 Inbox</button>
        )}
        <button onClick={() => setIsDark(!isDark)} style={{ background: isDark ? "#2a2a32" : "#ebe4d8", border: `1px solid ${isDark ? "#3a3a44" : "#ddd5c5"}`, borderRadius: 20, padding: "6px 12px", fontSize: 13, color: isDark ? "#f2ede4" : "#1c1814", display: "flex", alignItems: "center", gap: 6, fontWeight: 500, cursor: "pointer" }}>
          {isDark ? "☀️" : "🌙"} <span style={{ fontSize: 11 }}>{isDark ? "Light" : "Dark"}</span>
        </button>
      </div>
    </nav>
  );
}

// ─── Feed ─────────────────────────────────────────────────────────────────────
function Feed({ alias, setAlias, posts, refreshPosts, deadActive, setPage, setDmData }) {
  const [showModal, setShowModal] = useState(false);
  const [showAlias, setShowAlias] = useState(false);

  const feedPosts = deadActive ? posts.filter(p => p.isDead) : posts.filter(p => !p.isDead);
  const allPosts = posts;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 100px" }}>
      {/* Dead Hour Banner */}
      {deadActive ? (
        <DeadBanner setPage={setPage} />
      ) : (
        <DeadCountdown setPage={setPage} />
      )}

      {/* Posts */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
        {allPosts.length === 0 && (
          <div className="card fade-up" style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
            <div className="serif" style={{ fontSize: 20, color: "var(--text2)", marginBottom: 8 }}>The feed is empty</div>
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>be the first to speak</div>
          </div>
        )}
        {allPosts.map((p, i) => (
          <PostCard key={p.id} post={p} alias={alias} refreshPosts={refreshPosts} deadActive={deadActive} setPage={setPage} setDmData={setDmData} idx={i} />
        ))}
      </div>

      {/* FAB */}
      <button className={`fab ${deadActive ? "dead-mode" : ""}`} onClick={() => { if (!alias) { setShowAlias(true); } else { setShowModal(true); } }}>
        +
      </button>

      {showModal && <PostModal alias={alias} deadActive={deadActive} onClose={() => setShowModal(false)} refreshPosts={refreshPosts} />}
      {showAlias && <AliasModal onClose={() => setShowAlias(false)} setAlias={setAlias} onDone={() => { setShowAlias(false); setShowModal(true); }} />}
    </div>
  );
}

// ─── Dead Countdown ───────────────────────────────────────────────────────────
function DeadCountdown({ setPage }) {
  const [secs, setSecs] = useState(getNextDeadHour());
  useEffect(() => {
    const t = setInterval(() => setSecs(getNextDeadHour()), 1000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return (
    <div className="card fade-up" style={{ marginBottom: 24, textAlign: "center", padding: "28px 20px", background: "var(--surface)", borderColor: "rgba(123,108,246,0.15)" }}>
      <div className="serif dead-gradient-text" style={{ fontSize: 13, letterSpacing: 3, marginBottom: 16, textTransform: "uppercase" }}>Dead Hour begins in</div>
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}>
        {[{ v: h, l: "HRS" }, { v: m, l: "MIN" }, { v: s, l: "SEC" }].map(({ v, l }) => (
          <div key={l} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px", minWidth: 60, textAlign: "center" }}>
            <div className="mono" style={{ fontSize: 24, fontWeight: 500, color: "var(--dead)", lineHeight: 1 }}>{String(v).padStart(2, "0")}</div>
            <div className="mono" style={{ fontSize: 9, color: "var(--muted)", marginTop: 4, letterSpacing: 1 }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>Sessions: 12am–1am · 3am–5am</div>
      <button onClick={() => setPage("dead")} className="btn-ghost" style={{ marginTop: 14, fontSize: 12, padding: "7px 16px" }}>Learn about Dead Hour →</button>
    </div>
  );
}

// ─── Dead Banner ──────────────────────────────────────────────────────────────
function DeadBanner({ setPage }) {
  return (
    <div className="card fade-up" style={{ marginBottom: 24, textAlign: "center", padding: "28px 20px", borderColor: "rgba(123,108,246,0.3)", background: "linear-gradient(135deg, rgba(123,108,246,0.06), rgba(123,108,246,0.02))", animation: "deadPulse 3s ease-in-out infinite" }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>☽</div>
      <div className="serif dead-gradient-text" style={{ fontSize: 28, marginBottom: 6 }}>Dead Hour is Live</div>
      <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14, fontStyle: "italic", lineHeight: 1.6 }}>The world is quiet. This is your space.<br />Say what you can't say in daylight.</div>
      <button onClick={() => setPage("dead")} className="btn-dead" style={{ fontSize: 12, padding: "8px 18px" }}>Enter Dead Hour →</button>
    </div>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────
function PostCard({ post, alias, refreshPosts, deadActive, setPage, setDmData, idx }) {
  const [reacting, setReacting] = useState(null);
  const reactions = ["❤️", "😂", "🫂", "⭐"];
  const reactionAnims = ["reacting-heart", "reacting-laugh", "reacting-hug", "reacting-star"];

  const react = async (emoji, animClass) => {
    setReacting(animClass);
    const key = alias || "anon";
    const current = post.reactions || {};
    const emojiData = current[emoji] || { count: 0, users: [] };
    if (emojiData.users.includes(key)) {
      emojiData.users = emojiData.users.filter(u => u !== key);
      emojiData.count = Math.max(0, emojiData.count - 1);
    } else {
      emojiData.users.push(key);
      emojiData.count += 1;
    }
    const updated = { ...post, reactions: { ...current, [emoji]: emojiData } };
    await S.set(post.id, updated);
    await refreshPosts();
    setTimeout(() => setReacting(null), 500);
  };

  const requestDM = async () => {
    if (!alias) { alert("Set an alias first to request a private chat."); return; }
    const req = { id: uid(), from: alias, to: "unknown", ts: now(), status: "pending", postRef: post.id };
    await S.set("dmreq:" + req.id, req);
    const adminReqs = (await S.get("admin:dmrequests")) || [];
    await S.set("admin:dmrequests", [...adminReqs, req]);
    alert("Private chat request sent! Check your inbox for the link once approved.");
  };

  const isExpired = (Date.now() - new Date(post.ts).getTime()) > 23 * 60 * 60 * 1000;
  const timeLeft = Math.max(0, Math.floor((new Date(post.ts).getTime() + 24 * 60 * 60 * 1000 - Date.now()) / 60000));

  return (
    <div className="post-card fade-up" style={{ animationDelay: `${idx * 0.05}s` }}>
      <div style={{ padding: "16px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span className={`tag ${post.isDead ? "tag-dead" : "tag-anon"}`}>
            {post.isDead ? "☽ confession" : "◈ anonymous"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {timeLeft < 60 && <span className="mono" style={{ fontSize: 10, color: "var(--danger)" }}>⏱ {timeLeft}m left</span>}
            <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{fmt(post.ts)}</span>
          </div>
        </div>
        {post.text && (
          <p style={{ fontSize: post.text.length > 100 ? 14 : 16, lineHeight: 1.75, color: "var(--text)", marginBottom: 12, fontWeight: 300 }}>{post.text}</p>
        )}
        {post.media && post.media.type.startsWith("image") && (
          <img src={post.media.dataUrl} alt="" style={{ width: "100%", borderRadius: 10, marginBottom: 12, display: "block" }} loading="lazy" />
        )}
        {post.media && post.media.type.startsWith("video") && (
          <video src={post.media.dataUrl} controls style={{ width: "100%", borderRadius: 10, marginBottom: 12 }} />
        )}
        {post.media && post.media.type.startsWith("audio") && (
          <AudioPlayer src={post.media.dataUrl} />
        )}
      </div>
      {/* Reactions */}
      <div style={{ padding: "12px 20px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {reactions.map((emoji, i) => {
          const count = (post.reactions?.[emoji]?.count) || 0;
          const isActive = alias && post.reactions?.[emoji]?.users?.includes(alias);
          return (
            <button key={emoji} onClick={() => react(emoji, reactionAnims[i])}
              className={`reaction-btn ${isActive ? "active" : ""} ${reacting === reactionAnims[i] ? reacting : ""}`}>
              {emoji} {count > 0 && <span>{count}</span>}
            </button>
          );
        })}
        <button onClick={requestDM} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--muted)", fontSize: 12, padding: "4px 8px", borderRadius: 6, cursor: "pointer" }}>
          💬 Chat
        </button>
      </div>
    </div>
  );
}

// ─── Audio Player ─────────────────────────────────────────────────────────────
function AudioPlayer({ src }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);
  const bars = Array.from({ length: 28 }, (_, i) => Math.sin(i * 0.4) * 0.5 + Math.random() * 0.5);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  return (
    <div className="audio-player" style={{ marginBottom: 12 }}>
      <audio ref={audioRef} src={src} onTimeUpdate={e => setProgress(e.target.currentTime / e.target.duration)} onLoadedMetadata={e => setDuration(e.target.duration)} onEnded={() => { setPlaying(false); setProgress(0); }} />
      <button onClick={toggle} style={{ background: "var(--accent)", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, flexShrink: 0 }}>
        {playing ? "⏸" : "▶"}
      </button>
      <div style={{ flex: 1 }}>
        <div className="waveform" style={{ marginBottom: 4 }}>
          {bars.map((h, i) => (
            <div key={i} className="waveform-bar" style={{ height: `${Math.max(4, h * 28)}px`, opacity: i / bars.length < progress ? 1 : 0.3 }} />
          ))}
        </div>
        <div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{Math.floor(duration)}s · voice note</div>
      </div>
    </div>
  );
}

// ─── Post Modal ───────────────────────────────────────────────────────────────
function PostModal({ alias, deadActive, onClose, refreshPosts }) {
  const [tab, setTab] = useState("text");
  const [text, setText] = useState("");
  const [media, setMedia] = useState(null);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recordTime, setRecordTime] = useState(0);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef();
  const mediaRecorderRef = useRef(null);
  const recordTimerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = e => chunks.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordTime(0);
      recordTimerRef.current = setInterval(() => {
        setRecordTime(t => {
          if (t >= 14) { stopRecording(); return 15; }
          return t + 1;
        });
      }, 1000);
    } catch { alert("Microphone access denied."); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    clearInterval(recordTimerRef.current);
    setRecording(false);
  };

  const handleFile = e => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => setMedia({ type: f.type, dataUrl: ev.target.result });
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (tab === "text" && !text.trim()) return;
    if (tab === "image" && !media) return;
    if (tab === "audio" && !audioUrl) return;
    setPosting(true);
    let mediaObj = null;
    if (tab === "image" && media) mediaObj = media;
    if (tab === "audio" && audioUrl) {
      const reader = new FileReader();
      const dataUrl = await new Promise(res => {
        reader.onload = e => res(e.target.result);
        reader.readAsDataURL(audioBlob);
      });
      mediaObj = { type: "audio/webm", dataUrl };
    }
    const id = "post:" + uid();
    const post = { id, ts: now(), alias: alias || "anon", text: tab === "text" ? text.trim() : "", media: mediaObj, reactions: {}, isDead: deadActive, reports: 0 };
    await S.set(id, post);
    const adminLog = (await S.get("admin:allposts")) || [];
    await S.set("admin:allposts", [...adminLog, { ...post, savedAt: now() }]);
    await refreshPosts();
    setPosting(false);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <div className="serif" style={{ fontSize: 22, marginBottom: 4, color: deadActive ? "var(--dead)" : "var(--accent)" }}>
          {deadActive ? "☽ Confess" : "Share something"}
        </div>
        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>{deadActive ? "This disappears at dawn." : "Gone in 24 hours. No trace."}</div>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--surface2)", borderRadius: 10, padding: 4 }}>
          {[["text", "✍️ Write"], ["image", "🖼 Image"], ["audio", "🎙 Voice"]].map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: tab === t ? (deadActive ? "var(--dead)" : "var(--accent)") : "transparent", color: tab === t ? "#fff" : "var(--muted)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
        {tab === "text" && (
          <textarea rows={4} placeholder={deadActive ? "What weighs on you tonight..." : "What's on your mind..."} value={text} onChange={e => setText(e.target.value)} style={{ resize: "none", fontSize: 15, lineHeight: 1.7, marginBottom: 16 }} />
        )}
        {tab === "image" && (
          <div style={{ marginBottom: 16 }}>
            <input type="file" ref={fileRef} accept="image/*,video/*" onChange={handleFile} style={{ display: "none" }} />
            {media ? (
              <div style={{ position: "relative" }}>
                <img src={media.dataUrl} alt="" style={{ width: "100%", borderRadius: 10, maxHeight: 200, objectFit: "cover" }} />
                <button onClick={() => setMedia(null)} style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,.6)", color: "#fff", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer" }}>✕</button>
              </div>
            ) : (
              <button onClick={() => fileRef.current.click()} style={{ width: "100%", padding: "32px", background: "var(--surface2)", border: "2px dashed var(--border)", borderRadius: 12, color: "var(--muted)", fontSize: 13, cursor: "pointer" }}>
                Tap to select image or video
              </button>
            )}
          </div>
        )}
        {tab === "audio" && (
          <div style={{ marginBottom: 16 }}>
            {!audioUrl ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                {recording ? (
                  <div>
                    <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(224,82,82,0.15)", border: "2px solid var(--danger)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", animation: "pulse 1s infinite" }}>
                      <span style={{ width: 20, height: 20, background: "var(--danger)", borderRadius: "50%" }} />
                    </div>
                    <div className="mono" style={{ fontSize: 13, color: "var(--danger)", marginBottom: 12 }}>{recordTime}s / 15s</div>
                    <button onClick={stopRecording} className="btn-ghost" style={{ fontSize: 12 }}>Stop Recording</button>
                  </div>
                ) : (
                  <div>
                    <button onClick={startRecording} style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--accent-light)", border: "2px solid var(--accent)", cursor: "pointer", fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>🎙</button>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>Max 15 seconds</div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                <audio src={audioUrl} controls style={{ flex: 1 }} />
                <button onClick={() => { setAudioUrl(null); setAudioBlob(null); }} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 18 }}>✕</button>
              </div>
            )}
          </div>
        )}
        <button onClick={submit} disabled={posting} className={deadActive ? "btn-dead" : "btn-accent"} style={{ width: "100%", marginBottom: 14 }}>
          {posting ? "Posting..." : deadActive ? "☽ Release it" : "Post Anonymously"}
        </button>
        <div className="trust-banner">
          No user tracking. No database profiles. Your post permanently vanishes from the earth in 24 hours.
        </div>
      </div>
    </div>
  );
}

// ─── Alias Modal ──────────────────────────────────────────────────────────────
function AliasModal({ onClose, setAlias, onDone }) {
  const [val, setVal] = useState("");
  const [psychName, setPsychName] = useState("");
  const [err, setErr] = useState("");
  const [save, setSave] = useState(false);

  const submit = async () => {
    setErr("");
    if (val.trim().length < 2) { setErr("Alias must be at least 2 characters."); return; }
    if (val.trim().length > 24) { setErr("Alias must be under 24 characters."); return; }
    const existing = await S.get("alias:" + val.trim().toLowerCase());
    if (existing) { setErr("This alias is already taken. Try another."); return; }
    await S.set("alias:" + val.trim().toLowerCase(), { taken: true, ts: now() });
    const isPsych = psychName.trim().length > 0;
    const userData = { alias: val.trim(), secKey: secKey(), joinedAt: now(), isPsych, psychName: psychName.trim() };
    await S.set("user:alias", userData);
    const allAliases = (await S.get("admin:aliases")) || [];
    await S.set("admin:aliases", [...allAliases, userData]);
    if (isPsych) {
      const psychList = (await S.get("admin:psychologists")) || [];
      await S.set("admin:psychologists", [...psychList, userData]);
    }
    setAlias(userData);
    if (save) localStorage.setItem("fincher_alias", JSON.stringify(userData));
    onDone();
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <div className="serif" style={{ fontSize: 24, marginBottom: 6 }}>Choose your alias</div>
        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 6, lineHeight: 1.6 }}>
          ⚠️ Use an alias — do not use your real name. Letters, numbers and symbols allowed.
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 18, fontFamily: "'DM Mono', monospace" }}>
          Your alias cannot be changed once set.
        </div>
        <input placeholder="e.g. ghost_77 or st@rfish" value={val} onChange={e => setVal(e.target.value)} style={{ marginBottom: 16 }} onKeyDown={e => e.key === "Enter" && submit()} />

        {/* Psychologist field */}
        <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 4 }}>Are you a psychologist?</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>If yes, enter your professional name below. Leave blank if not.</div>
          <input placeholder="e.g. Dr. Sarah M. (optional)" value={psychName} onChange={e => setPsychName(e.target.value)} style={{ fontSize: 13 }} />
        </div>

        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, cursor: "pointer" }} onClick={() => setSave(!save)}>
          <div style={{ width: 18, height: 18, borderRadius: 4, border: "1px solid var(--border)", background: save ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff" }}>{save ? "✓" : ""}</div>
          <span style={{ fontSize: 13, color: "var(--text2)" }}>Remember my alias on this device</span>
        </div>
        <button onClick={submit} className="btn-accent" style={{ width: "100%" }}>Set Alias & Continue</button>
      </div>
    </div>
  );
}

// ─── Dead Hour Page ───────────────────────────────────────────────────────────
function DeadHourPage({ alias, setAlias, setPage }) {
  const [showPsych, setShowPsych] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [psychOnline, setPsychOnline] = useState(false);
  const [ambientPlaying, setAmbientPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const messagesEndRef = useRef(null);
  const channelKey = "psych:chat:" + (alias?.alias || "anon");

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadData = async () => {
    const psychStatus = await S.get("admin:psychOnline");
    setPsychOnline(!!psychStatus);
    const msgs = (await S.get(channelKey)) || [];
    setMessages(msgs);
    if (msgs.length > 0 && msgs[msgs.length - 1].role === "psych") setWaiting(false);
  };

  const saveMemory = async (msgs) => {
    await S.set(channelKey, msgs);
    const allMemories = (await S.get("admin:psychmemories")) || {};
    allMemories[alias?.alias || "anon"] = msgs;
    await S.set("admin:psychmemories", allMemories);
    // Notify psychologist panel
    const inbox = (await S.get("psych:inbox")) || [];
    await S.set("psych:inbox", [...inbox.filter(i => i.user !== (alias?.alias || "anon")), { user: alias?.alias || "anon", lastMsg: msgs[msgs.length - 1]?.text, ts: now(), channelKey }]);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { id: uid(), role: "user", text: input.trim(), ts: now(), from: alias?.alias || "anon" };
    const current = (await S.get(channelKey)) || [];
    const newMsgs = [...current, userMsg];
    await saveMemory(newMsgs);
    setMessages(newMsgs);
    setInput("");
    setWaiting(true);
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 80px" }}>
      {/* Ambient control */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={toggleAmbient} style={{ background: "var(--dead-light)", border: "1px solid rgba(123,108,246,0.2)", borderRadius: 8, padding: "6px 12px", color: "var(--dead)", fontSize: 12, cursor: "pointer" }}>
          {ambientPlaying ? "🔇 Mute ambient" : "🎵 Ambient sound"}
        </button>
      </div>

      {/* Header */}
      <div className="card fade-up" style={{ textAlign: "center", padding: "36px 24px", marginBottom: 24, borderColor: "rgba(123,108,246,0.3)", background: "linear-gradient(160deg, rgba(123,108,246,0.08), transparent)" }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>☽</div>
        <div className="serif dead-gradient-text" style={{ fontSize: 36, marginBottom: 8, fontWeight: 300 }}>Dead Hour</div>
        <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.8, maxWidth: 380, margin: "0 auto 20px" }}>
          A sacred space for the thoughts you carry alone. Confess. Release. Be heard — without a face, without a name.
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <span className="tag tag-dead">12am – 1am</span>
          <span className="tag tag-dead">3am – 5am</span>
        </div>
      </div>

      {/* About Dead Hour */}
      <div className="card fade-up" style={{ marginBottom: 24, padding: "20px 24px" }}>
        <div className="serif" style={{ fontSize: 20, marginBottom: 12, color: "var(--dead)" }}>What is Dead Hour?</div>
        <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.8 }}>
          Dead Hour is when Fincher shifts. The feed slows. The noise fades. What remains is a space for the rawest, most honest parts of yourself — the ones that only emerge when the world is asleep. Post confessions. Share what weighs on you. You are completely anonymous. Everything disappears at dawn.
        </div>
      </div>

      {/* Psychologist */}
      <div className="card fade-up" style={{ marginBottom: 24, borderColor: "rgba(123,108,246,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div className="serif" style={{ fontSize: 18, color: "var(--text)" }}>Need someone to talk to?</div>
            <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 4 }}>Request a confidential session. You stay anonymous.</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: psychOnline && !aiMode ? "var(--green)" : "var(--dead)", justifyContent: "flex-end" }}>
              <span className={`status-dot ${psychOnline && !aiMode ? "green" : "dead"}`} />
              <span className="mono">{psychOnline && !aiMode ? "Online" : "AI Support"}</span>
            </div>
          </div>
        </div>
        <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "var(--muted)", marginBottom: 14, fontStyle: "italic", lineHeight: 1.6 }}>
          ⚠️ Support is available via text only. No voice notes, images or videos. This is a listening space, not a crisis line. For emergencies, contact local services.
        </div>
        <button onClick={() => setShowPsych(true)} className="btn-dead" style={{ width: "100%", fontSize: 13 }}>
          ☽ Begin Session
        </button>
      </div>

      {/* Chat Session */}
      {showPsych && (
        <div className="card fade-up" style={{ borderColor: "rgba(123,108,246,0.25)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div className="serif" style={{ fontSize: 18, color: "var(--dead)" }}>Your Session</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--muted)" }}>
              <span className="status-dot dead" />
              <span className="mono">encrypted · anonymous</span>
            </div>
          </div>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", padding: "20px 0", color: "var(--muted)", fontSize: 13, fontStyle: "italic" }}>
              This space is yours. Say anything.
            </div>
          )}
          <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 16, paddingRight: 4 }}>
            {messages.map(m => (
              <div key={m.id} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div className={`chat-bubble ${m.role === "user" ? "mine" : "psych"}`}>
                  {m.role === "psych" && <div style={{ fontSize: 10, color: "var(--dead)", marginBottom: 4, fontWeight: 600 }}>Support</div>}
                  {m.text}
                  <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: "right" }}>{fmt(m.ts)}</div>
                </div>
              </div>
            ))}
            {waiting && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div className="chat-bubble psych" style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>
                  Support will respond shortly...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="Type here..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} style={{ flex: 1 }} />
            <button onClick={sendMessage} className="btn-dead" style={{ padding: "10px 16px" }}>↑</button>
          </div>
        </div>
      )}

      <button onClick={() => setPage("feed")} className="btn-ghost" style={{ width: "100%", marginTop: 16 }}>← Back to Feed</button>
    </div>
  );
}

// ─── Inbox ────────────────────────────────────────────────────────────────────
function Inbox({ alias, setPage, setDmData }) {
  const [requests, setRequests] = useState([]);
  const [myLinks, setMyLinks] = useState([]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    const allReqs = await S.list("dmlink:");
    const links = await Promise.all(allReqs.map(k => S.get(k)));
    const mine = links.filter(l => l && (l.from === alias?.alias || l.to === alias?.alias) && !l.used);
    setMyLinks(mine);
  };

  const acceptLink = async (link) => {
    const updated = { ...link, accepted: true };
    await S.set("dmlink:" + link.id, updated);
    setDmData(updated);
    setPage("dm");
  };

  return (
    <div style={{ maxWidth: 540, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <button onClick={() => setPage("feed")} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 20, cursor: "pointer" }}>←</button>
        <div className="serif" style={{ fontSize: 26 }}>Inbox</div>
      </div>
      {myLinks.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📬</div>
          <div style={{ color: "var(--text2)", fontSize: 14 }}>No messages yet.</div>
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>Private chat requests will appear here once approved.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {myLinks.map(link => (
            <div key={link.id} className="card fade-up">
              <div style={{ fontSize: 14, color: "var(--text)", marginBottom: 8 }}>
                Private chat with <strong>{link.from === alias?.alias ? link.to : link.from}</strong>
              </div>
              <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
                Session: {link.duration}min · expires after use · {fmt(link.ts)}
              </div>
              <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--muted)", marginBottom: 12, fontStyle: "italic" }}>
                Do you accept to enter a private chat with "{link.from === alias?.alias ? link.to : link.from}"?
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => acceptLink(link)} className="btn-accent" style={{ flex: 1, padding: "9px 0" }}>Accept</button>
                <button onClick={() => S.del("dmlink:" + link.id)} className="btn-ghost" style={{ flex: 1, padding: "9px 0" }}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Private Chat ─────────────────────────────────────────────────────────────
function PrivateChat({ alias, dmData, setPage }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(60 * 60);
  const [ended, setEnded] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const messagesEndRef = useRef(null);
  const channelKey = dmData ? [dmData.from, dmData.to].sort().join(":") : "none";
  const partner = dmData ? (dmData.from === alias?.alias ? dmData.to : dmData.from) : "Unknown";

  useEffect(() => {
    const startTime = dmData?.startTime ? new Date(dmData.startTime).getTime() : Date.now();
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    setTimeLeft(Math.max(0, 3600 - elapsed));
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(t); setEnded(true); endChat(); return 0; }
        return prev - 1;
      });
    }, 1000);
    loadMessages();
    const msgT = setInterval(loadMessages, 2000);
    return () => { clearInterval(t); clearInterval(msgT); };
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const loadMessages = async () => {
    const data = (await S.get("dmchat:" + channelKey)) || [];
    setMessages(data);
  };

  const send = async () => {
    if (!input.trim() || ended) return;
    const m = { id: uid(), from: alias?.alias, text: input.trim(), ts: now(), type: "text" };
    const updated = [...messages, m];
    await S.set("dmchat:" + channelKey, updated);
    const adminSaved = (await S.get("admin:savedchats")) || [];
    await S.set("admin:savedchats", [...adminSaved, { channel: channelKey, message: m, savedAt: now() }]);
    setMessages(updated);
    setInput("");
  };

  const endChat = async () => {
    await S.del("dmchat:" + channelKey);
    if (dmData) await S.set("dmlink:" + dmData.id, { ...dmData, used: true, endedAt: now() });
  };

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const isLastMinute = timeLeft <= 60;

  if (ended) return (
    <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 16px", textAlign: "center" }}>
      <div className="card fade-up">
        <div style={{ fontSize: 36, marginBottom: 12 }}>✦</div>
        <div className="serif" style={{ fontSize: 26, marginBottom: 8 }}>Session Ended</div>
        <div style={{ fontSize: 14, color: "var(--text2)", marginBottom: 20, lineHeight: 1.6 }}>This conversation has been permanently deleted. No trace remains.</div>
        <button onClick={() => setPage("feed")} className="btn-accent" style={{ width: "100%" }}>Back to Feed</button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 540, margin: "0 auto", padding: "20px 16px", height: "calc(100vh - 58px)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
        <button onClick={() => setPage("feed")} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 20, cursor: "pointer" }}>←</button>
        <div style={{ flex: 1 }}>
          <div className="serif" style={{ fontSize: 18 }}>Private: {partner}</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>one-time · auto-deletes · anonymous</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="mono" style={{ fontSize: 14, color: isLastMinute ? "var(--danger)" : "var(--accent)", fontWeight: 500 }}>
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </div>
          {isLastMinute && <div style={{ fontSize: 10, color: "var(--danger)" }}>ending soon</div>}
        </div>
      </div>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingBottom: 8 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: 32, fontStyle: "italic" }}>
            Channel open. 1 hour. Then it's gone forever.
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.from === alias?.alias ? "flex-end" : "flex-start" }}>
            <div className={`chat-bubble ${m.from === alias?.alias ? "mine" : "theirs"}`}>
              {m.text}
              <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: "right" }}>{fmt(m.ts)}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      {/* Input */}
      <div style={{ display: "flex", gap: 8, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <input placeholder="Message..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} style={{ flex: 1 }} disabled={ended} />
        <button onClick={send} className="btn-accent" style={{ padding: "10px 16px" }} disabled={ended}>↑</button>
      </div>
    </div>
  );
}

// ─── About Page ───────────────────────────────────────────────────────────────
function AboutPage({ content, setPage }) {
  const c = content || {};
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 16px 80px" }}>
      <button onClick={() => setPage("feed")} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, cursor: "pointer", marginBottom: 24, display: "flex", alignItems: "center", gap: 6 }}>← Back</button>
      <div className="serif gradient-text" style={{ fontSize: 48, marginBottom: 4, fontWeight: 300 }}>fincher</div>
      <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 40, letterSpacing: 2 }}>ABOUT</div>
      {[
        { title: "The Mission", body: c.mission, icon: "✦" },
        { title: "Community Guidelines", body: c.guidelines, icon: "◈" },
        { title: "Data & Privacy", body: c.privacy, icon: "⬡" },
        { title: "Dead Hour", body: c.deadHour, icon: "☽" },
      ].map(({ title, body, icon }) => (
        <div key={title} className="card fade-up" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ color: "var(--accent)", fontSize: 18 }}>{icon}</span>
            <div className="serif" style={{ fontSize: 20 }}>{title}</div>
          </div>
          <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.8 }}>{body}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer({ setPage }) {
  return (
    <footer className="footer">
      <a onClick={() => setPage("feed")}>Feed</a>
      <a onClick={() => setPage("dead")}>Dead Hour</a>
      <a onClick={() => setPage("about")}>About</a>
      <span style={{ color: "var(--muted)" }}>·</span>
      <span className="mono" style={{ fontSize: 10 }}>fincher © 2024</span>
    </footer>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN SITE
// ═══════════════════════════════════════════════════════════════════════════════
function AdminSite({ setShowAdmin, posts, refreshPosts, aboutContent, setAboutContent }) {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [adminPin, setAdminPin] = useState(ADMIN_PIN_DEFAULT);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    S.get("admin:pin").then(p => { if (p) setAdminPin(p); });
  }, []);

  const auth = () => {
    if (pin === adminPin) setAuthed(true);
    else { setErr("Incorrect PIN. Access denied."); setTimeout(() => { window.location.hash = ""; setShowAdmin(false); }, 2000); }
  };

  if (!authed) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#000", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 360, background: "#0d0d0f", border: "1px solid #1a1a1a", borderRadius: 16, padding: 32 }}>
        <div className="mono" style={{ fontSize: 10, color: "#333", marginBottom: 20, letterSpacing: 2 }}>FINCHER CORE GATE</div>
        <div className="serif" style={{ fontSize: 28, color: "#c9a96e", marginBottom: 4 }}>Administrator</div>
        <div style={{ fontSize: 12, color: "#444", marginBottom: 24 }}>Secure access only.</div>
        <input type="password" placeholder="Master security key" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === "Enter" && auth()} style={{ marginBottom: 14, background: "#111", borderColor: "#222", color: "#e8e4dc" }} />
        {err && <div style={{ color: "#e05252", fontSize: 12, marginBottom: 12 }}>{err}</div>}
        <button onClick={auth} style={{ width: "100%", padding: "11px", background: "#c9a96e", border: "none", borderRadius: 10, color: "#000", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Enter</button>
      </div>
    </div>
  );

  const tabs = [
    { id: "overview", label: "Overview", icon: "◈" },
    { id: "posts", label: "Live Posts", icon: "⬡" },
    { id: "users", label: "Users", icon: "✦" },
    { id: "saved", label: "Saved", icon: "🗃" },
    { id: "deadhour", label: "Dead Hour", icon: "☽" },
    { id: "dms", label: "DM Requests", icon: "💬" },
    { id: "about", label: "Edit About", icon: "✏️" },
    { id: "customize", label: "Customize", icon: "🎨" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#080809", color: "#e8e4dc", display: "flex" }}>
      {/* Sidebar */}
      <div className="admin-sidebar" style={{ background: "#0d0d0f", borderColor: "#1a1a1e" }}>
        <div style={{ padding: "0 20px 20px", borderBottom: "1px solid #1a1a1e", marginBottom: 16 }}>
          <div className="serif" style={{ fontSize: 20, color: "#c9a96e", letterSpacing: 2 }}>fincher</div>
          <div className="mono" style={{ fontSize: 9, color: "#333", letterSpacing: 2, marginTop: 2 }}>ADMIN CORE</div>
        </div>
        <div style={{ flex: 1, padding: "0 10px" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "none", background: tab === t.id ? "rgba(201,169,110,0.12)" : "transparent", color: tab === t.id ? "#c9a96e" : "#5a5660", fontSize: 13, textAlign: "left", cursor: "pointer", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
        <div style={{ padding: "16px 20px", borderTop: "1px solid #1a1a1e" }}>
          <button onClick={() => { window.location.hash = ""; setShowAdmin(false); }} style={{ width: "100%", padding: "8px", background: "transparent", border: "1px solid #1a1a1e", borderRadius: 8, color: "#444", fontSize: 12, cursor: "pointer" }}>← Exit</button>
        </div>
      </div>
      {/* Main */}
      <div className="admin-main">
        {tab === "overview" && <AdminOverview posts={posts} />}
        {tab === "posts" && <AdminPosts posts={posts} refreshPosts={refreshPosts} />}
        {tab === "users" && <AdminUsers />}
        {tab === "saved" && <AdminSaved />}
        {tab === "deadhour" && <AdminDeadHour />}
        {tab === "dms" && <AdminDMs />}
        {tab === "about" && <AdminAbout content={aboutContent} setAboutContent={setAboutContent} />}
        {tab === "customize" && <AdminCustomize />}
        {tab === "settings" && <AdminSettings adminPin={adminPin} setAdminPin={setAdminPin} />}
      </div>
    </div>
  );
}

function AdminOverview({ posts }) {
  const [aliases, setAliases] = useState([]);
  const [savedChats, setSavedChats] = useState([]);
  const [allPosts, setAllPosts] = useState([]);

  const load = async () => {
    S.get("admin:aliases").then(a => setAliases(a || []));
    S.get("admin:savedchats").then(c => setSavedChats(c || []));
    S.get("admin:allposts").then(p => setAllPosts(p || []));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);
  const stats = [
    { label: "Live Posts", value: posts.length, icon: "⬡" },
    { label: "Registered Users", value: aliases.length, icon: "✦" },
    { label: "Saved Messages", value: savedChats.length, icon: "🗃" },
    { label: "All Posts Ever", value: allPosts.length, icon: "◈" },
  ];
  return (
    <div>
      <div className="serif" style={{ fontSize: 32, color: "#c9a96e", marginBottom: 4 }}>Control Center</div>
      <div className="mono" style={{ fontSize: 11, color: "#333", marginBottom: 28, letterSpacing: 1 }}>FINCHER OPERATIONAL OVERVIEW</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 28 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: "#0d0d0f", border: "1px solid #1a1a1e", borderRadius: 12, padding: "20px 18px" }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
            <div className="mono" style={{ fontSize: 28, color: "#c9a96e", fontWeight: 500, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#5a5660", marginTop: 6 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#0d0d0f", border: "1px solid #1a1a1e", borderRadius: 12, padding: 20 }}>
        <div className="mono" style={{ fontSize: 11, color: "#333", marginBottom: 12, letterSpacing: 1 }}>RECENT ACTIVITY LOG</div>
        {posts.slice(0, 8).map(p => (
          <div key={p.id} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid #111", fontSize: 12 }}>
            <span className="mono" style={{ color: "#333", minWidth: 100 }}>{fmt(p.ts)}</span>
            <span style={{ color: "#c9a96e" }}>{p.alias}</span>
            <span style={{ color: "#5a5660", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.text || "[media]"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminPosts({ posts, refreshPosts }) {
  const killPost = async (id) => {
    if (!confirm("Permanently delete this post?")) return;
    await S.del(id);
    await refreshPosts();
  };
  return (
    <div>
      <div className="serif" style={{ fontSize: 28, color: "#c9a96e", marginBottom: 20 }}>Live Posts</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {posts.map(p => (
          <div key={p.id} style={{ background: "#0d0d0f", border: "1px solid #1a1a1e", borderRadius: 10, padding: "14px 18px", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span className="mono" style={{ fontSize: 10, color: "#c9a96e" }}>{p.alias}</span>
                <span className="mono" style={{ fontSize: 10, color: "#333" }}>{fmt(p.ts)}</span>
                {p.isDead && <span style={{ fontSize: 10, color: "#7b6cf6", background: "rgba(123,108,246,0.1)", padding: "1px 8px", borderRadius: 10 }}>dead hour</span>}
              </div>
              <div style={{ fontSize: 13, color: "#a09890" }}>{p.text || "[media post]"}</div>
              <div style={{ fontSize: 11, color: "#333", marginTop: 4 }}>
                Reports: {p.reports || 0} · Reactions: {Object.values(p.reactions || {}).reduce((a, v) => a + (v.count || 0), 0)}
              </div>
            </div>
            <button onClick={() => killPost(p.id)} style={{ background: "rgba(224,82,82,0.1)", border: "1px solid rgba(224,82,82,0.2)", color: "#e05252", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>⊗ Kill</button>
          </div>
        ))}
        {posts.length === 0 && <div style={{ color: "#333", textAlign: "center", padding: 30, fontSize: 13 }}>No active posts.</div>}
      </div>
    </div>
  );
}

function AdminUsers() {
  const [aliases, setAliases] = useState([]);
  useEffect(() => { S.get("admin:aliases").then(a => setAliases(a || [])); }, []);
  return (
    <div>
      <div className="serif" style={{ fontSize: 28, color: "#c9a96e", marginBottom: 20 }}>Registered Users</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {aliases.map((u, i) => (
          <div key={i} style={{ background: "#0d0d0f", border: "1px solid #1a1a1e", borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: "#e8e4dc", fontWeight: 500 }}>{u.alias}</span>
              <span className="mono" style={{ fontSize: 10, color: "#333" }}>{fmt(u.joinedAt)}</span>
            </div>
            <div className="mono" style={{ fontSize: 10, color: "#5a5660" }}>key: {u.secKey}</div>
          </div>
        ))}
        {aliases.length === 0 && <div style={{ color: "#333", textAlign: "center", padding: 30, fontSize: 13 }}>No users yet.</div>}
      </div>
    </div>
  );
}

function AdminSaved() {
  const [saved, setSaved] = useState([]);
  const [psychMem, setPsychMem] = useState({});
  const [allPosts, setAllPosts] = useState([]);
  const [tab, setTab] = useState("messages");
  useEffect(() => {
    S.get("admin:savedchats").then(c => setSaved(c || []));
    S.get("admin:psychmemories").then(m => setPsychMem(m || {}));
    S.get("admin:allposts").then(p => setAllPosts(p || []));
  }, []);
  return (
    <div>
      <div className="serif" style={{ fontSize: 28, color: "#c9a96e", marginBottom: 20 }}>Saved Data</div>
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {[["messages", "DM Messages"], ["psych", "Psych Sessions"], ["posts", "All Posts Ever"]].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: tab === t ? "#c9a96e" : "#111", color: tab === t ? "#000" : "#5a5660", fontSize: 12, cursor: "pointer" }}>{l}</button>
        ))}
      </div>
      {tab === "messages" && saved.map((m, i) => (
        <div key={i} style={{ background: "#0d0d0f", border: "1px solid #1a1a1e", borderRadius: 8, padding: "10px 14px", marginBottom: 8, fontSize: 12 }}>
          <span style={{ color: "#c9a96e" }}>{m.message.from}</span>
          <span style={{ color: "#333", margin: "0 8px" }}>→</span>
          <span style={{ color: "#a09890" }}>{m.message.text}</span>
          <span className="mono" style={{ float: "right", fontSize: 10, color: "#333" }}>{fmt(m.savedAt)}</span>
        </div>
      ))}
      {tab === "psych" && Object.entries(psychMem).map(([alias, msgs]) => (
        <div key={alias} style={{ background: "#0d0d0f", border: "1px solid #1a1a1e", borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <div style={{ color: "#c9a96e", fontSize: 13, marginBottom: 10 }}>Session: {alias}</div>
          {msgs.map((m, i) => (
            <div key={i} style={{ fontSize: 12, color: m.role === "user" ? "#a09890" : "#7b6cf6", marginBottom: 6, paddingLeft: m.role === "psych" ? 12 : 0 }}>
              <span style={{ opacity: 0.5, marginRight: 6 }}>{m.role === "user" ? "User" : "Support"}:</span>{m.text}
            </div>
          ))}
        </div>
      ))}
      {tab === "posts" && allPosts.map((p, i) => (
        <div key={i} style={{ background: "#0d0d0f", border: "1px solid #1a1a1e", borderRadius: 8, padding: "10px 14px", marginBottom: 8, fontSize: 12 }}>
          <span className="mono" style={{ color: "#c9a96e", fontSize: 10 }}>{p.alias}</span>
          <span style={{ color: "#333", margin: "0 8px" }}>·</span>
          <span style={{ color: "#a09890" }}>{p.text || "[media]"}</span>
          <span className="mono" style={{ float: "right", fontSize: 10, color: "#333" }}>{fmt(p.ts)}</span>
        </div>
      ))}
    </div>
  );
}

function AdminDeadHour() {
  const [psychOnline, setPsychOnline] = useState(false);
  const [inbox, setInbox] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [chatMsgs, setChatMsgs] = useState([]);
  const [reply, setReply] = useState("");
  const [psychName, setPsychName] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    S.get("admin:psychOnline").then(v => setPsychOnline(!!v));
    S.get("admin:psychName").then(n => setPsychName(n || "Support"));
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (activeChat) loadChat(activeChat.channelKey);
  }, [activeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  const load = async () => {
    const i = (await S.get("psych:inbox")) || [];
    setInbox(i);
    if (activeChat) loadChat(activeChat.channelKey);
  };

  const loadChat = async (key) => {
    const msgs = (await S.get(key)) || [];
    setChatMsgs(msgs);
  };

  const togglePsych = async () => {
    const v = !psychOnline;
    setPsychOnline(v);
    await S.set("admin:psychOnline", v);
  };

  const sendReply = async () => {
    if (!reply.trim() || !activeChat) return;
    const msg = { id: uid(), role: "psych", text: reply.trim(), ts: now(), from: psychName };
    const current = (await S.get(activeChat.channelKey)) || [];
    const updated = [...current, msg];
    await S.set(activeChat.channelKey, updated);
    const allMemories = (await S.get("admin:psychmemories")) || {};
    allMemories[activeChat.user] = updated;
    await S.set("admin:psychmemories", allMemories);
    setChatMsgs(updated);
    setReply("");
  };

  return (
    <div>
      <div className="serif" style={{ fontSize: 28, color: "#c9a96e", marginBottom: 20 }}>Dead Hour — Psychologist Panel</div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ background: "#0d0d0f", border: "1px solid #1a1a1e", borderRadius: 12, padding: 18, flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, color: "#e8e4dc", marginBottom: 8 }}>Your Status</div>
          <button onClick={togglePsych} style={{ background: psychOnline ? "rgba(78,203,141,0.15)" : "#111", border: `1px solid ${psychOnline ? "#4ecb8d" : "#1a1a1e"}`, color: psychOnline ? "#4ecb8d" : "#5a5660", borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: "pointer", width: "100%" }}>
            {psychOnline ? "🟢 Online — Taking Sessions" : "⚫ Offline"}
          </button>
        </div>
        <div style={{ background: "#0d0d0f", border: "1px solid #1a1a1e", borderRadius: 12, padding: 18, flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, color: "#e8e4dc", marginBottom: 8 }}>Display Name</div>
          <input value={psychName} onChange={e => setPsychName(e.target.value)} onBlur={() => S.set("admin:psychName", psychName)} placeholder="Dr. Name" style={{ background: "#111", borderColor: "#222", color: "#e8e4dc", fontSize: 13 }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 14, minHeight: 400 }}>
        {/* Inbox list */}
        <div style={{ background: "#0d0d0f", border: "1px solid #1a1a1e", borderRadius: 12, overflow: "hidden" }}>
          <div className="mono" style={{ fontSize: 10, color: "#333", padding: "12px 14px", borderBottom: "1px solid #1a1a1e", letterSpacing: 1 }}>ACTIVE SESSIONS</div>
          {inbox.length === 0 && <div style={{ padding: 16, fontSize: 12, color: "#333", textAlign: "center" }}>No sessions yet.</div>}
          {inbox.map((item, i) => (
            <div key={i} onClick={() => { setActiveChat(item); loadChat(item.channelKey); }} style={{ padding: "12px 14px", borderBottom: "1px solid #111", cursor: "pointer", background: activeChat?.user === item.user ? "rgba(201,169,110,0.08)" : "transparent" }}>
              <div style={{ color: activeChat?.user === item.user ? "#c9a96e" : "#e8e4dc", fontSize: 13, marginBottom: 3 }}>{item.user}</div>
              <div style={{ color: "#5a5660", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.lastMsg}</div>
            </div>
          ))}
        </div>
        {/* Chat window */}
        <div style={{ background: "#0d0d0f", border: "1px solid #1a1a1e", borderRadius: 12, display: "flex", flexDirection: "column" }}>
          {!activeChat ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 13, fontStyle: "italic" }}>Select a session to respond</div>
          ) : (
            <>
              <div className="mono" style={{ fontSize: 10, color: "#333", padding: "12px 16px", borderBottom: "1px solid #1a1a1e", letterSpacing: 1 }}>SESSION: {activeChat.user}</div>
              <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10, maxHeight: 320 }}>
                {chatMsgs.map(m => (
                  <div key={m.id} style={{ display: "flex", justifyContent: m.role === "psych" ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "75%", padding: "9px 13px", borderRadius: 12, background: m.role === "psych" ? "#c9a96e" : "#1a1a1e", color: m.role === "psych" ? "#000" : "#e8e4dc", fontSize: 13, lineHeight: 1.5 }}>
                      {m.text}
                      <div style={{ fontSize: 10, opacity: 0.5, marginTop: 3, textAlign: "right" }}>{fmt(m.ts)}</div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div style={{ padding: "12px 16px", borderTop: "1px solid #1a1a1e", display: "flex", gap: 8 }}>
                <input value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => e.key === "Enter" && sendReply()} placeholder="Type your reply..." style={{ flex: 1, background: "#111", borderColor: "#222", color: "#e8e4dc", fontSize: 13 }} />
                <button onClick={sendReply} style={{ background: "#c9a96e", border: "none", borderRadius: 8, padding: "10px 16px", color: "#000", fontWeight: 600, cursor: "pointer" }}>Send</button>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16, background: "#0d0d0f", border: "1px solid rgba(123,108,246,0.2)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 12, color: "#7b6cf6", marginBottom: 6 }}>Dead Hour Schedule</div>
        <div style={{ fontSize: 12, color: "#5a5660" }}>Session 1: 12:00am – 1:00am · Session 2: 3:00am – 5:00am (user local time)</div>
      </div>
    </div>
  );
}

function AdminDMs() {
  const [requests, setRequests] = useState([]);
  useEffect(() => { S.get("admin:dmrequests").then(r => setRequests(r || [])); }, []);
  const approve = async (req) => {
    const link = { id: uid(), from: req.from, to: "user2", ts: now(), duration: 60, used: false, startTime: now() };
    await S.set("dmlink:" + link.id, link);
    const updated = requests.map(r => r.id === req.id ? { ...r, status: "approved" } : r);
    await S.set("admin:dmrequests", updated);
    setRequests(updated);
    alert(`Link created! Both users will see it in their inbox.`);
  };
  return (
    <div>
      <div className="serif" style={{ fontSize: 28, color: "#c9a96e", marginBottom: 20 }}>DM Requests</div>
      {requests.length === 0 && <div style={{ color: "#333", fontSize: 13, padding: 20 }}>No pending requests.</div>}
      {requests.map((r, i) => (
        <div key={i} style={{ background: "#0d0d0f", border: "1px solid #1a1a1e", borderRadius: 10, padding: 16, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: "#c9a96e", fontSize: 13 }}>{r.from} → requests private chat</span>
            <span className="mono" style={{ fontSize: 10, color: "#333" }}>{fmt(r.ts)}</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {r.status !== "approved" ? (
              <button onClick={() => approve(r)} style={{ background: "rgba(78,203,141,0.15)", border: "1px solid rgba(78,203,141,0.2)", color: "#4ecb8d", borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer" }}>
                ✓ Approve & Send Link
              </button>
            ) : (
              <span style={{ color: "#4ecb8d", fontSize: 12 }}>✓ Approved</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminAbout({ content, setAboutContent }) {
  const [form, setForm] = useState(content || {});
  const [saved, setSaved] = useState(false);
  const save = async () => {
    await S.set("cms:about", form);
    setAboutContent(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  return (
    <div>
      <div className="serif" style={{ fontSize: 28, color: "#c9a96e", marginBottom: 20 }}>Edit About Page</div>
      {[["mission", "Mission"], ["guidelines", "Community Guidelines"], ["privacy", "Data & Privacy"], ["deadHour", "Dead Hour"]].map(([key, label]) => (
        <div key={key} style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: "#5a5660", display: "block", marginBottom: 6, letterSpacing: 0.5 }}>{label.toUpperCase()}</label>
          <textarea rows={4} value={form[key] || ""} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={{ background: "#0d0d0f", borderColor: "#1a1a1e", color: "#e8e4dc", resize: "vertical", fontSize: 13, lineHeight: 1.7 }} />
        </div>
      ))}
      <button onClick={save} style={{ background: saved ? "#4ecb8d" : "#c9a96e", border: "none", borderRadius: 10, padding: "11px 24px", color: "#000", fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "background 0.3s" }}>
        {saved ? "✓ Saved!" : "Save & Publish"}
      </button>
    </div>
  );
}

function AdminCustomize() {
  const [colors, setColors] = useState({ accent: "#c9a96e", dead: "#7b6cf6", bg: "#0d0d0f" });
  const [saved, setSaved] = useState(false);
  const save = async () => {
    await S.set("admin:customColors", colors);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  return (
    <div>
      <div className="serif" style={{ fontSize: 28, color: "#c9a96e", marginBottom: 8 }}>Customize Site</div>
      <div style={{ fontSize: 13, color: "#5a5660", marginBottom: 24 }}>Changes apply to the main site. Full control over colors and branding.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 400 }}>
        {[["accent", "Accent Color"], ["dead", "Dead Hour Color"], ["bg", "Background Color"]].map(([key, label]) => (
          <div key={key} style={{ background: "#0d0d0f", border: "1px solid #1a1a1e", borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <input type="color" value={colors[key]} onChange={e => setColors(c => ({ ...c, [key]: e.target.value }))} style={{ width: 44, height: 44, border: "none", background: "none", cursor: "pointer", padding: 0, borderRadius: 8 }} />
            <div>
              <div style={{ fontSize: 14, color: "#e8e4dc", marginBottom: 2 }}>{label}</div>
              <div className="mono" style={{ fontSize: 11, color: "#5a5660" }}>{colors[key]}</div>
            </div>
          </div>
        ))}
        <button onClick={save} style={{ background: saved ? "#4ecb8d" : "#c9a96e", border: "none", borderRadius: 10, padding: "11px", color: "#000", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
          {saved ? "✓ Applied!" : "Apply Changes"}
        </button>
      </div>
    </div>
  );
}

function AdminSettings({ adminPin, setAdminPin }) {
  const [newPin, setNewPin] = useState("");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const changePin = async () => {
    if (newPin.length < 6) { setErr("PIN must be at least 6 characters."); return; }
    await S.set("admin:pin", newPin);
    setAdminPin(newPin);
    setNewPin(""); setSaved(true); setErr("");
    setTimeout(() => setSaved(false), 2000);
  };
  return (
    <div>
      <div className="serif" style={{ fontSize: 28, color: "#c9a96e", marginBottom: 20 }}>Settings</div>
      <div style={{ background: "#0d0d0f", border: "1px solid #1a1a1e", borderRadius: 12, padding: 24, maxWidth: 400 }}>
        <div style={{ fontSize: 15, color: "#e8e4dc", marginBottom: 6 }}>Change Admin PIN</div>
        <div style={{ fontSize: 12, color: "#5a5660", marginBottom: 16 }}>Current PIN is hidden for security. Enter a new one to replace it.</div>
        <input type="password" placeholder="New PIN (min 6 chars)" value={newPin} onChange={e => setNewPin(e.target.value)} style={{ marginBottom: 12, background: "#111", borderColor: "#222", color: "#e8e4dc" }} />
        {err && <div style={{ color: "#e05252", fontSize: 12, marginBottom: 10 }}>{err}</div>}
        <button onClick={changePin} style={{ background: saved ? "#4ecb8d" : "#c9a96e", border: "none", borderRadius: 10, padding: "10px 20px", color: "#000", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          {saved ? "✓ Updated!" : "Update PIN"}
        </button>
      </div>
      <div style={{ marginTop: 24, background: "#0d0d0f", border: "1px solid rgba(224,82,82,0.2)", borderRadius: 12, padding: 20, maxWidth: 400 }}>
        <div style={{ fontSize: 13, color: "#e05252", marginBottom: 8 }}>Admin Access URL</div>
        <div className="mono" style={{ fontSize: 11, color: "#5a5660", lineHeight: 1.7 }}>
          Access your admin panel by going to:<br />
          <span style={{ color: "#c9a96e" }}>yoursite.netlify.app/#{ADMIN_PATH}</span>
        </div>
      </div>
    </div>
  );
}
