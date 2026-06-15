const STORAGE_KEY = "nlcf-church-data";
const LAST_USER_KEY = "nlcf-church-last-user";
const { useState, useEffect, useCallback, useRef, useMemo } = React;

const THEME = {
  page: "#000000",
  header: "#0b1f3a",
  surface: "#111827",
  surfaceAlt: "#1e293b",
  field: "#0f172a",
  border: "rgba(59,130,246,0.25)",
  borderStrong: "rgba(59,130,246,0.5)",
  text: "#ffffff",
  muted: "rgba(255,255,255,0.7)",
  faint: "rgba(255,255,255,0.45)",
  brass: "#d4a017",
  brassDeep: "#a67c00",
  sage: "#3b82f6",
  wine: "#2563eb",
  slate: "#94a3b8"
};

const initialData = {
  church: {
    id: "root",
    name: "New Life in Christ Fellowship",
    role: "church",
    children: []
  },
  people: {
    root: {
      id: "root",
      name: "New Life in Christ Fellowship",
      role: "church",
      parentId: null,
      children: [],
      contact: "",
      joinedDate: ""
    }
  },
  accounts: {},
  history: [],
  events: []
};

function hashPassword(password) {
  try {
    return window.btoa(unescape(encodeURIComponent(password)));
  } catch (e) {
    return password;
  }
}

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

function getInitials(name) {
  const stopwords = new Set(["in", "and", "of", "the", "a", "an", "for", "with", "by", "on", "at", "to", "into", "from"]);
  const words = (name || "").split(/\s+/).filter(Boolean);
  const filtered = words.filter(word => !stopwords.has(word.toLowerCase()));
  const source = filtered.length > 0 ? filtered : words;
  return source
    .map(word => word[0].toUpperCase())
    .slice(0, Math.min(4, source.length))
    .join("");
}

function ensureAdminAccount(data) {
  const accounts = data.accounts || {};
  return { ...data, accounts };
}

function findAccount(data, username) {
  return data.accounts?.[normalizeUsername(username)] || null;
}

const ROLE_CONFIG = {
  church: { label: "Church", color: THEME.brass, bg: "#28251c", icon: "✝" },
  senior_pastor: { label: "Senior Pastor", color: "#d8cab0", bg: "#2c2a23", icon: "⛪" },
  pastor: { label: "Pastor", color: THEME.sage, bg: "#222a22", icon: "📖" },
  leader: { label: "Cellgroup Leader", color: THEME.wine, bg: "#302423", icon: "🌿" },
  member: { label: "Member", color: THEME.slate, bg: "#24282a", icon: "👤" },
};

const CHILD_ROLE = {
  church: "senior_pastor",
  senior_pastor: "pastor",
  pastor: "leader",
  leader: "member",
  member: null,
};

const CHILD_LABEL = {
  church: "Senior Pastor",
  senior_pastor: "Pastor",
  pastor: "Leader",
  leader: "Cellgroup Member",
  member: "Member",
};

function generateId() {
  return "p_" + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function appendHistory(data, action, target, details) {
  const entry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    action,
    target,
    details
  };
  return { ...data, history: [entry, ...(data.history || [])].slice(0, 100) };
}

function canManageAll(user) {
  const role = user?.accountRole || user?.role;
  return role === "admin" || role === "senior_pastor" || role === "church";
}

function canAddOn(user, person) {
  if (!user) return false;
  return canManageAll(user) || user.id === person.id;
}

function canEditPerson(user, person) {
  if (!user) return false;
  return canManageAll(user) || user.id === person.id;
}

function canDeletePerson(user) {
  const role = user?.accountRole || user?.role;
  return role === "admin" || role === "senior_pastor";
}

async function saveData(data) {
  const json = JSON.stringify(data);
  try {
    if (window.storage && typeof window.storage.set === "function") {
      await window.storage.set(STORAGE_KEY, json);
      return;
    }
  } catch (e) {
    // fallback to localStorage
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, json);
  } catch (e) {
    // silent fallback
  }
}

async function loadData() {
  try {
    if (window.storage && typeof window.storage.get === "function") {
      const result = await window.storage.get(STORAGE_KEY);
      if (result && typeof result === "object") {
        if (result.value) return ensureAdminAccount(JSON.parse(result.value));
        if (result[STORAGE_KEY]) return ensureAdminAccount(JSON.parse(result[STORAGE_KEY]));
      }
    }
  } catch (e) {
    // fallback to localStorage
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return ensureAdminAccount(JSON.parse(raw));
    }
  } catch (e) {
    // silent fallback
  }

  return null;
}

function saveLastLoggedInUser(username) {
  try {
    if (!username) {
      window.localStorage.removeItem(LAST_USER_KEY);
    } else {
      window.localStorage.setItem(LAST_USER_KEY, username);
    }
  } catch (e) {
    // ignore
  }
}

function loadLastLoggedInUser() {
  try {
    return window.localStorage.getItem(LAST_USER_KEY) || "";
  } catch (e) {
    return "";
  }
}

function clearLastLoggedInUser() {
  try {
    window.localStorage.removeItem(LAST_USER_KEY);
  } catch (e) {
    // ignore
  }
}

// ── Modal ──────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(5,5,20,0.82)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem"
    }}>
      <div style={{
        background: THEME.surface,
border: `1px solid ${THEME.borderStrong}`, borderRadius: "16px",
        padding: "2rem",
        maxHeight: "85vh", display: "flex", flexDirection: "column",
        boxShadow: "0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(200,169,106,0.10)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexShrink: 0 }}>
          <h3 style={{ margin: 0, color: THEME.brass, fontFamily: "'Playfair Display',serif", fontSize: "1.2rem" }}>{title}</h3>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "#888", fontSize: "1.4rem",
            cursor: "pointer", lineHeight: 1, padding: "0 4px"
          }}>×</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function LoginPanel({ data, currentAccount, initialMode, rememberedUsername, onLogin, onRegister, onClose }) {
  const accountList = Object.values(data.accounts || {});
  const isFirstAccount = accountList.length === 0;
  const [mode, setMode] = useState(initialMode || (isFirstAccount ? "register" : "login"));
  const [username, setUsername] = useState(rememberedUsername || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [registerRole, setRegisterRole] = useState(isFirstAccount ? "admin" : "member");
  const [rememberMe, setRememberMe] = useState(Boolean(rememberedUsername));
  const [message, setMessage] = useState("");

  const handleLogin = () => {
    setMessage("");
    if (!username.trim() || !password) {
      setMessage("Please enter both username and password.");
      return;
    }
    onLogin(username, password, rememberMe, success => {
      if (!success) {
        setMessage("Invalid username or password.");
      }
    });
  };

  useEffect(() => {
    setRegisterRole(isFirstAccount ? "admin" : "member");
    if (initialMode) {
      setMode(initialMode);
    }
  }, [isFirstAccount, initialMode]);

  const handleRegister = () => {
    setMessage("");
    if (!username.trim() || !password || !displayName.trim()) {
      setMessage("Name, username, and password are required.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    onRegister({ username, password, displayName, role: registerRole }, rememberMe, success => {
      if (!success) {
        setMessage("That username is already taken or admin creation is restricted.");
      }
    });
  };

  const canRegisterAdmin = isFirstAccount || currentAccount?.role === "admin";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(21,22,18,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ width: "100%", maxWidth: 480, background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 18, padding: "2rem", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700, color: THEME.brass, marginBottom: "0.5rem" }}>Account Login / Register</div>
            <div style={{ color: THEME.muted, fontSize: "0.9rem" }}>
              Login with your account or create a new one. The first account must be an admin. After that, only admins can add other admins.
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", fontSize: "1.4rem", cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>

        <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1rem" }}>
          <button
            onClick={() => setMode("login")}
            style={{
              ...btnSecondary,
              flex: 1,
              background: mode === "login" ? "rgba(200,169,106,0.16)" : "transparent",
              borderColor: mode === "login" ? "rgba(200,169,106,0.55)" : "rgba(200,169,106,0.28)"
            }}
          >
            Login
          </button>
          <button
            onClick={() => setMode("register")}
            style={{
              ...btnSecondary,
              flex: 1,
              background: mode === "register" ? "rgba(200,169,106,0.16)" : "transparent",
              borderColor: mode === "register" ? "rgba(200,169,106,0.55)" : "rgba(200,169,106,0.28)"
            }}
          >
            Create Account
          </button>
        </div>

        {mode === "login" ? (
          <>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" style={inputStyle} autoComplete="username" />
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password" style={inputStyle} autoComplete="current-password" />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'rgba(244,239,230,0.76)', fontSize: '0.9rem' }}>
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} style={{ cursor: 'pointer' }} />
              Remember me on this page
            </label>
            <button onClick={handleLogin} style={btnPrimary}>Login</button>
          </>
        ) : (
          <>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Full name" style={inputStyle} />
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" style={inputStyle} />
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password" style={inputStyle} />
            <input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type="password" placeholder="Confirm password" style={inputStyle} />
            <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
              <button
                onClick={() => setRegisterRole("member")}
                disabled={isFirstAccount}
                style={{
                  ...btnSecondary,
                  flex: 1,
                  background: registerRole === "member" ? "rgba(200,169,106,0.16)" : "transparent",
                  borderColor: registerRole === "member" ? "rgba(200,169,106,0.55)" : "rgba(200,169,106,0.28)",
                  opacity: isFirstAccount ? 0.35 : 1,
                  cursor: isFirstAccount ? "not-allowed" : "pointer"
                }}
              >
                Member
              </button>
              <button
                onClick={() => setRegisterRole("admin")}
                disabled={!canRegisterAdmin}
                style={{
                  ...btnSecondary,
                  flex: 1,
                  background: registerRole === "admin" ? "rgba(200,169,106,0.16)" : "transparent",
                  borderColor: registerRole === "admin" ? "rgba(200,169,106,0.55)" : "rgba(200,169,106,0.28)",
                  opacity: canRegisterAdmin ? 1 : 0.35,
                  cursor: canRegisterAdmin ? "pointer" : "not-allowed"
                }}
              >
                Admin
              </button>
            </div>
            <button onClick={handleRegister} style={btnPrimary}>Create account</button>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'rgba(244,239,230,0.76)', fontSize: '0.9rem', marginTop: '0.85rem' }}>
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} style={{ cursor: 'pointer' }} />
              Remember me on this page
            </label>
            {!canRegisterAdmin && (
              <div style={{ color: "rgba(244,239,230,0.62)", fontSize: "0.8rem", marginTop: "0.5rem" }}>
                The first account must be an admin. After that, only admins can add other admins.
              </div>
            )}
          </>
        )}

        {message && <div style={{ marginTop: "1rem", color: "#f3c97b" }}>{message}</div>}
      </div>
    </div>
  );
}

function AccountPanel({ data, currentAccount, onClose, onSave }) {
  const account = data.accounts?.[currentAccount.username];
  const person = data.people?.[currentAccount.personId] || {};
  const [username, setUsername] = useState(account?.username || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState(person.name || "");
  const [contact, setContact] = useState(person.contact || "");
  const [joinedDate, setJoinedDate] = useState(person.joinedDate || "");
  const [message, setMessage] = useState("");

  const handleSave = () => {
    setMessage("");
    if (!username.trim() || !displayName.trim()) {
      setMessage("Username and display name are required.");
      return;
    }
    if (password && password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    onSave({
      oldUsername: account?.username,
      username: normalizeUsername(username),
      password: password || null,
      displayName: displayName.trim(),
      contact: contact.trim(),
      joinedDate: joinedDate || person.joinedDate || new Date().toISOString().slice(0, 10)
    }, success => {
      if (!success) {
        setMessage("Failed to save account. Username may already exist.");
      } else {
        onClose();
      }
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(21,22,18,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ width: "100%", maxWidth: 520, background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 18, padding: "2rem", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700, color: THEME.brass, marginBottom: "0.35rem" }}>My Account</div>
            <div style={{ color: THEME.muted, fontSize: "0.9rem" }}>Edit your username, password, and profile details.</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", fontSize: "1.4rem", cursor: "pointer" }}>×</button>
        </div>
        <div style={{ display: "grid", gap: "1rem" }}>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Display name" style={inputStyle} />
          <input value={contact} onChange={e => setContact(e.target.value)} placeholder="Contact info" style={inputStyle} />
          <input value={joinedDate} onChange={e => setJoinedDate(e.target.value)} type="date" style={inputStyle} />
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" style={inputStyle} autoComplete="username" />
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="New password" style={inputStyle} autoComplete="new-password" />
          <input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type="password" placeholder="Confirm new password" style={inputStyle} autoComplete="new-password" />
          <div style={{ display: "flex", gap: "0.8rem" }}>
            <button onClick={onClose} style={btnSecondary}>Cancel</button>
            <button onClick={handleSave} style={{ ...btnPrimary, flex: 1 }}>Save changes</button>
          </div>
          {message && <div style={{ color: "#f3c97b" }}>{message}</div>}
        </div>
      </div>
    </div>
  );
}

// ── AddPersonForm ──────────────────────────────────────────────────────────
function AddPersonForm({ parentId, parentRole, onAdd, onClose }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [joinedDate, setJoinedDate] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploadError, setUploadError] = useState("");
  const childRole = CHILD_ROLE[parentRole] || "member";
  const cfg = ROLE_CONFIG[childRole];

  const handlePhotoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select a valid image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoUrl(reader.result);
      setUploadError("");
    };
    reader.onerror = () => setUploadError("Unable to read image file.");
    reader.readAsDataURL(file);
  };

  return (
    <Modal title={`Add ${CHILD_LABEL[parentRole]}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{
          padding: "0.5rem 0.8rem", borderRadius: "8px",
          background: cfg.bg, border: `1px solid ${cfg.color}40`,
          color: cfg.color, fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.05em"
        }}>
          Role: {cfg.label}
        </div>
        <input
          placeholder="Full Name *"
          value={name}
          onChange={e => setName(e.target.value)}
          style={inputStyle}
          autoFocus
        />
        <input
          placeholder="Contact (phone / email)"
          value={contact}
          onChange={e => setContact(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="Date Joined"
          type="date"
          value={joinedDate}
          onChange={e => setJoinedDate(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="Photo URL"
          value={photoUrl}
          onChange={e => setPhotoUrl(e.target.value)}
          style={inputStyle}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={{ color: THEME.muted, fontSize: "0.8rem" }}>Upload photo</label>
          <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ color: THEME.text }} />
          {uploadError && <div style={{ color: THEME.wine, fontSize: "0.8rem" }}>{uploadError}</div>}
          {photoUrl && (
            <img src={photoUrl} alt="Preview" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(244,239,230,0.16)" }} />
          )}
        </div>
        <div style={{ display: "flex", gap: "0.8rem", marginTop: "0.5rem" }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button
            onClick={() => name.trim() && onAdd({ name: name.trim(), contact, joinedDate, role: childRole, parentId, photoUrl })}
            style={{ ...btnPrimary, flex: 1 }}
          >
            Add {cfg.label}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── PersonDetail ───────────────────────────────────────────────────────────
function PersonDetail({ person, people, currentUser, onClose, onAddChild, onDelete, onEdit }) {
  const cfg = ROLE_CONFIG[person.role] || ROLE_CONFIG.member;
  const children = (person.children || []).map(id => people[id]).filter(Boolean);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(person.name);
  const [editContact, setEditContact] = useState(person.contact || "");
  const [editDate, setEditDate] = useState(person.joinedDate || "");
  const [editPhotoUrl, setEditPhotoUrl] = useState(person.photoUrl || "");
  const [editUploadError, setEditUploadError] = useState("");
  const editable = canEditPerson(currentUser, person);
  const deletable = canDeletePerson(currentUser) && person.role !== "church";
  const addable = canAddOn(currentUser, person) && Boolean(CHILD_ROLE[person.role]);

  const handleEditPhotoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setEditUploadError("Please select a valid image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEditPhotoUrl(reader.result);
      setEditUploadError("");
    };
    reader.onerror = () => setEditUploadError("Unable to read image file.");
    reader.readAsDataURL(file);
  };

  return (
    <Modal title="Person Details" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{
          padding: "1rem", borderRadius: "12px",
          background: cfg.bg, border: `1px solid ${cfg.color}50`,
          display: "flex", alignItems: "center", gap: "1rem"
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            overflow: "hidden", border: `2px solid ${cfg.color}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: `${cfg.color}20`
          }}>
            {person.photoUrl ? (
              <img
                src={person.photoUrl}
                alt={person.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: "1.3rem", color: cfg.color }}>{getInitials(person.name)}</span>
            )}
          </div>
          <div>
            <div style={{ color: cfg.color, fontWeight: 700, fontSize: "1.1rem" }}>{person.name}</div>
            <div style={{ color: cfg.color + "99", fontSize: "0.8rem" }}>{cfg.label}</div>
          </div>
        </div>

        {editing ? (
          <>
            <input value={editName} onChange={e => setEditName(e.target.value)} style={inputStyle} placeholder="Name" />
            <input value={editContact} onChange={e => setEditContact(e.target.value)} style={inputStyle} placeholder="Contact" />
            <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} style={inputStyle} />
            <input
              value={editPhotoUrl}
              onChange={e => setEditPhotoUrl(e.target.value)}
              placeholder="Photo URL"
              style={inputStyle}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ color: THEME.muted, fontSize: "0.8rem" }}>Upload photo</label>
              <input type="file" accept="image/*" onChange={handleEditPhotoUpload} style={{ color: THEME.text }} />
              {editUploadError && <div style={{ color: THEME.wine, fontSize: "0.8rem" }}>{editUploadError}</div>}
              {editPhotoUrl && (
                <img src={editPhotoUrl} alt="Preview" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(244,239,230,0.16)" }} />
              )}
            </div>
            <div style={{ display: "flex", gap: "0.8rem" }}>
              <button onClick={() => setEditing(false)} style={btnSecondary}>Cancel</button>
              <button onClick={() => { onEdit(person.id, { name: editName, contact: editContact, joinedDate: editDate, photoUrl: editPhotoUrl }); setEditing(false); }} style={{ ...btnPrimary, flex: 1 }}>Save</button>
            </div>
          </>
        ) : (
          <>
            {person.contact && <div style={infoRow}><span style={infoLabel}>Contact</span><span style={infoVal}>{person.contact}</span></div>}
            {person.joinedDate && <div style={infoRow}><span style={infoLabel}>Joined</span><span style={infoVal}>{person.joinedDate}</span></div>}
            <div style={infoRow}>
              <span style={infoLabel}>Direct {CHILD_LABEL[person.role]}s</span>
              <span style={{ ...infoVal, background: `${cfg.color}20`, padding: "2px 10px", borderRadius: 20, color: cfg.color, fontWeight: 700 }}>{children.length}</span>
            </div>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
              {editable && <button onClick={() => setEditing(true)} style={btnSecondary}>✏️ Edit</button>}
              {addable && (
                <button onClick={() => { onClose(); onAddChild(person.id); }} style={{ ...btnPrimary, flex: 1 }}>
                  + Add {CHILD_LABEL[person.role]}
                </button>
              )}
            </div>
            {!editable && (
              <div style={{ color: "rgba(244,239,230,0.58)", fontSize: "0.82rem", marginTop: "0.5rem" }}>
                Viewing details as {currentUser?.name || "Guest"}. Edit access is limited to your own profile or senior pastors.
              </div>
            )}
            {deletable && (
              <button onClick={() => { if (window.confirm(`Remove ${person.name}?`)) onDelete(person.id); }} style={{ ...btnSecondary, color: THEME.wine, borderColor: `${THEME.wine}40`, marginTop: "0.2rem" }}>
                🗑 Remove
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

// ── TreeNode ───────────────────────────────────────────────────────────────
function TreeNode({ id, people, depth = 0, onSelect, onAddChild, currentUser, expandedSet, toggleExpand }) {
  const person = people[id];
  if (!person) return null;
  const cfg = ROLE_CONFIG[person.role] || ROLE_CONFIG.member;
  const children = (person.children || []).map(cid => people[cid]).filter(Boolean);
  const isExpanded = expandedSet.has(id);
  const hasChildren = children.length > 0;
  const canAdd = canAddOn(currentUser, person) && Boolean(CHILD_ROLE[person.role]);

  return (
    <div style={{ marginLeft: depth > 0 ? "1.5rem" : 0, position: "relative" }}>
      {depth > 0 && (
        <div style={{
          position: "absolute", left: "-1rem", top: "1.1rem",
          width: "0.8rem", height: 2,
          background: "linear-gradient(90deg,transparent,rgba(200,169,106,0.18))"
        }} />
      )}
      <div
        style={{
          display: "flex", alignItems: "center", gap: "0.6rem",
          padding: "0.55rem 0.8rem", marginBottom: "0.3rem",
          borderRadius: "10px", cursor: "pointer",
          background: `${cfg.bg}cc`,
          border: `1px solid ${cfg.color}30`,
          transition: "all 0.15s ease",
          position: "relative"
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = cfg.color + "80"; e.currentTarget.style.background = cfg.bg; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = cfg.color + "30"; e.currentTarget.style.background = `${cfg.bg}cc`; }}
      >
        {hasChildren && (
          <button
            onClick={e => { e.stopPropagation(); toggleExpand(id); }}
            style={{
              background: "none", border: "none", color: cfg.color + "99",
              cursor: "pointer", fontSize: "0.7rem", padding: "0 2px", lineHeight: 1,
              transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s"
            }}
          >▶</button>
        )}
        {!hasChildren && <div style={{ width: 16 }} />}

        <div onClick={() => onSelect(id)} style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1, minWidth: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            overflow: "hidden", border: `1.5px solid ${cfg.color}70`,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: `${cfg.color}18`, flexShrink: 0
          }}>
            {person.photoUrl ? (
              <img src={person.photoUrl} alt={person.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: "0.8rem", color: cfg.color }}>{getInitials(person.name)}</span>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ color: "#f0eadf", fontSize: "0.9rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{person.name}</div>
              <div style={{ background: cfg.color, color: '#081024', padding: '3px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>{cfg.label}</div>
            </div>
            <div style={{ color: cfg.color + "aa", fontSize: "0.7rem", marginTop: 2 }}>{children.length > 0 ? `· ${children.length} ${CHILD_LABEL[person.role]}${children.length > 1 ? "s" : ""}` : ""}</div>
          </div>
        </div>

        {canAdd && (
          <button
            onClick={e => { e.stopPropagation(); onAddChild(id); }}
            title={`Add ${CHILD_LABEL[person.role]}`}
            style={{
              background: `${cfg.color}15`, border: `1px solid ${cfg.color}50`,
              borderRadius: "6px", color: cfg.color, cursor: "pointer",
              fontSize: "0.75rem", padding: "3px 8px", flexShrink: 0,
              transition: "all 0.15s"
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `${cfg.color}30`; }}
            onMouseLeave={e => { e.currentTarget.style.background = `${cfg.color}15`; }}
          >+ {CHILD_LABEL[person.role]}</button>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div style={{ borderLeft: `1px solid rgba(200,169,106,0.14)`, marginLeft: "0.9rem" }}>
          {children.map(child => (
            <TreeNode key={child.id} id={child.id} people={people} depth={depth + 1}
              onSelect={onSelect} onAddChild={onAddChild}
              currentUser={currentUser}
              expandedSet={expandedSet} toggleExpand={toggleExpand} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stats Bar ──────────────────────────────────────────────────────────────
function StatsBar({ people, activeRole, onSelectRole }) {
  const counts = Object.values(people).reduce((acc, p) => {
    acc[p.role] = (acc[p.role] || 0) + 1;
    return acc;
  }, {});

  const stats = [
    { role: "all", label: "All" },
    { role: "senior_pastor", label: "Senior Pastors" },
    { role: "pastor", label: "Pastors" },
    { role: "leader", label: "Leaders" },
    { role: "member", label: "Members" },
  ];

  return (
    <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
      {stats.map(s => {
        const cfg = s.role === "all" ? { color: THEME.brass, bg: "rgba(200,169,106,0.14)", border: "rgba(200,169,106,0.28)" } : ROLE_CONFIG[s.role];
        const count = s.role === "all" ? Object.values(people).length : (counts[s.role] || 0);
        const active = activeRole === s.role;
        return (
          <div key={s.role} onClick={() => onSelectRole && onSelectRole(s.role)}
            style={{
              flex: "1 1 auto", minWidth: 80, padding: "0.6rem 0.8rem",
              background: active ? `${cfg.color}40` : `${cfg.bg}dd`,
              border: `1px solid ${active ? cfg.color : cfg.border}`,
              borderRadius: "10px", textAlign: "center", cursor: onSelectRole ? "pointer" : "default",
              boxShadow: active ? `0 0 0 2px ${cfg.color}22` : "none"
            }}>
            <div style={{ fontSize: "1.4rem", color: cfg.color, fontWeight: 800 }}>{count}</div>
            <div style={{ fontSize: "0.65rem", color: cfg.color + "99", marginTop: 2 }}>{s.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Search ─────────────────────────────────────────────────────────────────
function SearchBar({ people, onSelect }) {
  const [q, setQ] = useState("");
  const results = q.trim().length > 1
    ? Object.values(people).filter(p => p.id !== "root" && p.name.toLowerCase().includes(q.toLowerCase()))
    : [];

  return (
    <div style={{ position: "relative", marginBottom: "1rem" }}>
      <input
        value={q} onChange={e => setQ(e.target.value)}
        placeholder="🔍 Search members, pastors, leaders..."
        style={{ ...inputStyle, paddingLeft: "1rem" }}
      />
      {results.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
          background: THEME.surface, border: "1px solid rgba(200,169,106,0.28)",
          borderRadius: "10px", marginTop: 4, overflow: "hidden",
          boxShadow: "0 8px 24px rgba(0,0,0,0.6)"
        }}>
          {results.slice(0, 8).map(p => {
            const cfg = ROLE_CONFIG[p.role] || ROLE_CONFIG.member;
            return (
              <div key={p.id} onClick={() => { onSelect(p.id); setQ(""); }}
                style={{
                  padding: "0.6rem 1rem", cursor: "pointer", display: "flex",
                  alignItems: "center", gap: "0.6rem",
                  borderBottom: "1px solid rgba(244,239,230,0.08)"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(200,169,106,0.08)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <span>{cfg.icon}</span>
                <div>
                  <div style={{ color: "#f0eadf", fontSize: "0.85rem" }}>{p.name}</div>
                  <div style={{ color: cfg.color + "99", fontSize: "0.7rem" }}>{cfg.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilteredPeopleList({ people, role, onSelect }) {
  const list = Object.values(people).filter(p => p.id !== "root");
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.member;
  return (
    <div style={{ marginBottom: "1.5rem", display: "grid", gap: "0.9rem", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
      {list.length === 0 ? (
        <div style={{ padding: "1rem", borderRadius: "14px", border: "1px solid rgba(202,190,166,0.22)", background: "rgba(35,36,31,0.78)", color: "rgba(244,239,230,0.82)" }}>
          No {cfg.label.toLowerCase()} found.
        </div>
      ) : list.map(person => (
        <div key={person.id} onClick={() => onSelect(person.id)}
          style={{
            padding: "1rem", borderRadius: "14px", background: "rgba(244,239,230,0.05)",
            border: `1px solid ${cfg.color}33`, cursor: "pointer", boxShadow: "0 10px 24px rgba(0,0,0,0.18)", transition: "transform 0.15s ease"
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${cfg.color}15`, display: "flex", alignItems: "center", justifyContent: "center", color: cfg.color, fontWeight: 700 }}>{getInitials(person.name)}</div>
            <div>
              <div style={{ color: THEME.text, fontWeight: 700 }}>{person.name}</div>
              <div style={{ color: cfg.color + "cc", fontSize: "0.78rem" }}>{cfg.label}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryPanel({ history }) {
  const [search, setSearch] = useState("");
  if (!history || history.length === 0) {
    return (
      <div style={{ marginBottom: "1rem", padding: "1rem", borderRadius: "14px", background: "rgba(35,36,31,0.86)", border: "1px solid rgba(202,190,166,0.16)", color: "rgba(244,239,230,0.82)" }}>
        No history events yet. Actions like add, edit and delete will appear here for senior pastors.
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  const filteredHistory = query
    ? history.filter(entry => {
        const text = `${entry.action} ${entry.target} ${entry.details || ""}`.toLowerCase();
        return text.includes(query);
      })
    : history;

  return (
    <div style={{ marginBottom: "1.5rem", padding: "1rem", borderRadius: "14px", background: "rgba(35,36,31,0.9)", border: "1px solid rgba(202,190,166,0.22)", maxHeight: 320, overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem", gap: "0.8rem", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, color: THEME.brass }}>Admin History</div>
        <div style={{ fontSize: "0.75rem", color: "rgba(244,239,230,0.58)" }}>{filteredHistory.length} of {history.length} events</div>
      </div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search history..."
        style={{ ...inputStyle, marginBottom: "1rem", width: "100%" }}
      />
      {filteredHistory.length === 0 ? (
        <div style={{ color: "rgba(244,239,230,0.82)", fontSize: "0.9rem", padding: "1rem", borderRadius: "12px", background: "rgba(45,47,40,0.72)", border: "1px solid rgba(202,190,166,0.16)" }}>
          No history matches your search.
        </div>
      ) : filteredHistory.slice(0, 10).map(entry => (
        <div key={entry.id} style={{ marginBottom: "0.8rem", paddingBottom: "0.5rem", borderBottom: "1px solid rgba(244,239,230,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <span style={{ color: "#f0eadf", fontWeight: 600 }}>{entry.action}</span>
            <span style={{ color: "rgba(200,169,106,0.86)", fontSize: "0.75rem" }}>{new Date(entry.timestamp).toLocaleString()}</span>
          </div>
          <div style={{ color: "rgba(244,239,230,0.70)", fontSize: "0.82rem", marginTop: "0.2rem" }}>{entry.target}</div>
          {entry.details && <div style={{ color: "rgba(244,239,230,0.62)", fontSize: "0.75rem", marginTop: "0.35rem" }}>{entry.details}</div>}
        </div>
      ))}
    </div>
  );
}

function formatCountdown(diffMs) {
  if (diffMs <= 0) return "Started";
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function EventForm({ event, onClose, onSave }) {
  const [title, setTitle] = useState(event?.title || "");
  const [dateTime, setDateTime] = useState(event?.dateTime ? event.dateTime.slice(0, 16) : "");
  const [location, setLocation] = useState(event?.location || "");
  const [description, setDescription] = useState(event?.description || "");
  const [imageUrl, setImageUrl] = useState(event?.imageUrl || "");
  const [activitiesText, setActivitiesText] = useState((event?.activities || []).join("\n"));
  const [message, setMessage] = useState("");

  useEffect(() => {
    setTitle(event?.title || "");
    setDateTime(event?.dateTime ? event.dateTime.slice(0, 16) : "");
    setLocation(event?.location || "");
    setDescription(event?.description || "");
    setImageUrl(event?.imageUrl || "");
    setActivitiesText((event?.activities || []).join("\n"));
    setMessage("");
  }, [event]);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!title.trim() || !dateTime) {
      setMessage("Please provide a title and date/time for the event.");
      return;
    }
    onSave({
      id: event?.id,
      title: title.trim(),
      dateTime,
      location: location.trim(),
      description: description.trim(),
      imageUrl: imageUrl.trim(),
      activities: activitiesText.split("\n").map(line => line.trim()).filter(Boolean)
    }, success => {
      if (!success) {
        setMessage("Unable to save event. Please try again.");
      }
    });
  };

  return (
    <Modal title={event?.id ? "Edit Event" : "Add Event"} onClose={onClose}>
      <div style={{ display: "grid", gap: "0.9rem" }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Event title" style={inputStyle} />
        <input value={dateTime} onChange={e => setDateTime(e.target.value)} type="datetime-local" style={inputStyle} />
        <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location" style={inputStyle} />
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Details about the event" style={{ ...inputStyle, minHeight: 100, resize: "vertical" }} />
        <div style={{ display: "grid", gap: "0.6rem" }}>
          <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Image URL" style={inputStyle} />
          <div style={{ display: "flex", gap: "0.8rem", alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ color: "rgba(244,239,230,0.70)", fontSize: "0.9rem" }}>Upload event image</label>
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ color: THEME.text }} />
          </div>
          {imageUrl && <img src={imageUrl} alt="Event preview" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)" }} />}
        </div>
        <textarea value={activitiesText} onChange={e => setActivitiesText(e.target.value)} placeholder="List activities, one per line" style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} />
        <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={handleSubmit} style={{ ...btnPrimary, flex: 1 }}>{event?.id ? "Save event" : "Create event"}</button>
        </div>
        {message && <div style={{ color: "#f3c97b" }}>{message}</div>}
      </div>
    </Modal>
  );
}

function EventDetail({ event, currentUser, onClose, onEdit, onDelete }) {
  const eventDate = event.dateTime ? new Date(event.dateTime) : null;
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const diff = eventDate ? eventDate - now : 0;
  const countdown = eventDate ? formatCountdown(diff) : "Date missing";

  return (
    <Modal title="Event Details" onClose={onClose}>
      <div style={{ display: "grid", gap: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700, color: THEME.text }}>{event.title}</div>
            <div style={{ color: "rgba(244,239,230,0.70)", marginTop: "0.4rem" }}>
              {eventDate ? eventDate.toLocaleString() : "No date set"}
              {event.location ? ` · ${event.location}` : ""}
            </div>
          </div>
          <div style={{ textAlign: "right", minWidth: 160 }}>
            <div style={{ color: THEME.brass, fontWeight: 700, marginBottom: 4 }}>Countdown</div>
            <div style={{ color: diff > 0 ? "#fff" : "#f3c97b", fontSize: "0.95rem" }}>{countdown}</div>
          </div>
        </div>
        {event.imageUrl && (
          <img src={event.imageUrl} alt={event.title} style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)" }} />
        )}
        {event.description && (
          <div style={{ color: "rgba(244,239,230,0.82)", lineHeight: 1.6 }}>{event.description}</div>
        )}
        {(event.activities || []).length > 0 && (
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <div style={{ color: "rgba(200,169,106,0.9)", fontWeight: 700 }}>Activities</div>
            <ul style={{ margin: 0, paddingLeft: "1.2rem", color: THEME.muted, fontSize: "0.92rem", lineHeight: 1.5 }}>
              {event.activities.map((activity, index) => <li key={index}>{activity}</li>)}
            </ul>
          </div>
        )}
        {canManageAll(currentUser) && (
          <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
            <button onClick={() => onEdit(event.id)} style={btnSecondary}>Edit Event</button>
            <button onClick={() => onDelete(event.id)} style={{ ...btnSecondary, color: THEME.wine, borderColor: `${THEME.wine}40` }}>Delete Event</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function EventsPanel({ events = [], currentUser, onAdd, onEdit, onView, onDelete }) {
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const sorted = [...events].sort((a, b) => new Date(a.dateTime || 0) - new Date(b.dateTime || 0));
  const filtered = query.trim()
    ? sorted.filter(ev => {
      const text = `${ev.title} ${ev.location || ""} ${ev.description || ""} ${(ev.activities || []).join(" ")}`.toLowerCase();
      return text.includes(query.trim().toLowerCase());
    })
    : sorted;

  return (
    <div style={{ marginBottom: "1.5rem", padding: "1rem", borderRadius: "14px", background: "rgba(35,36,31,0.92)", border: "1px solid rgba(202,190,166,0.22)", maxHeight: "400px", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.8rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, color: THEME.brass, marginBottom: "0.35rem" }}>Church Events</div>
          <div style={{ color: THEME.muted, fontSize: "0.9rem" }}>Manage upcoming events, countdowns, pictures, details and church activities.</div>
        </div>
        {canManageAll(currentUser) && (
          <button onClick={onAdd} style={{ ...btnPrimary, minWidth: 140 }}>+ Add Event</button>
        )}
      </div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search events, locations, or activities"
        style={{ ...inputStyle, marginBottom: "1rem" }}
      />
      {filtered.length === 0 ? (
        <div style={{ color: "rgba(244,239,230,0.70)", padding: "1rem", borderRadius: "12px", background: "rgba(244,239,230,0.035)", border: "1px solid rgba(244,239,230,0.10)" }}>
          No upcoming events match your search. Use the + Add Event button to create church activities and announcements.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {filtered.map(ev => {
            const eventDate = ev.dateTime ? new Date(ev.dateTime) : null;
            const diff = eventDate ? eventDate - now : 0;
            const countdown = eventDate ? formatCountdown(diff) : "Date missing";
            return (
              <div key={ev.id} onClick={() => onView && onView(ev.id)} style={{ display: "grid", gap: "0.8rem", padding: "1rem", borderRadius: "16px", background: "rgba(45,47,40,0.94)", border: "1px solid rgba(202,190,166,0.22)", cursor: onView ? "pointer" : "default" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.8rem", alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: "1rem", fontWeight: 700, color: THEME.text }}>{ev.title}</div>
                    <div style={{ color: "rgba(244,239,230,0.70)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                      {eventDate ? eventDate.toLocaleString() : "No scheduled date"} · {ev.location || "Location not set"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 120 }}>
                    <div style={{ color: THEME.brass, fontWeight: 700, fontSize: "0.95rem" }}>Countdown</div>
                    <div style={{ color: diff > 0 ? "#fff" : "#f3c97b", fontSize: "0.95rem", marginTop: 4 }}>{countdown}</div>
                  </div>
                </div>
                {ev.imageUrl && <img src={ev.imageUrl} alt={ev.title} style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 14, border: "1px solid rgba(244,239,230,0.10)" }} />}
                {ev.description && <div style={{ color: "rgba(244,239,230,0.76)", fontSize: "0.9rem", lineHeight: 1.6 }}>{ev.description}</div>}
                {(ev.activities || []).length > 0 && (
                  <div style={{ display: "grid", gap: "0.35rem" }}>
                    <div style={{ color: "rgba(200,169,106,0.9)", fontWeight: 700 }}>Activities</div>
                    <ul style={{ margin: 0, paddingLeft: "1.2rem", color: THEME.muted, fontSize: "0.88rem" }}>
                      {ev.activities.map((activity, idx) => <li key={idx}>{activity}</li>)}
                    </ul>
                  </div>
                )}
                {canManageAll(currentUser) && (
                  <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                    <button onClick={e => { e.stopPropagation(); onEdit(ev.id); }} style={btnSecondary}>Edit</button>
                    <button onClick={e => { e.stopPropagation(); onDelete(ev.id); }} style={{ ...btnSecondary, color: THEME.wine, borderColor: `${THEME.wine}40` }}>Delete</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OrgChartPanel({ people, onSelect }) {
  const root = people?.root;
  if (!root) return null;

  const NODE_WIDTH = 200;
  const NODE_HEIGHT = 72;
  const H_GAP = 32;
  const V_GAP = 60;
  const PADDING = 20;

  // Build layout: returns { subtreeWidth, nodes[] } where each node has {id, x, y, person}
  // x/y are the top-left of each node card within the subtree coordinate space.
  const buildLayout = useCallback((personId, depth) => {
    const person = people[personId];
    if (!person) return { subtreeWidth: NODE_WIDTH, nodes: [] };
    const childIds = (person.children || []).filter(id => people[id]);

    if (childIds.length === 0) {
      return {
        subtreeWidth: NODE_WIDTH,
        nodes: [{ id: personId, x: 0, y: depth * (NODE_HEIGHT + V_GAP), person }]
      };
    }

    const childLayouts = childIds.map(cid => buildLayout(cid, depth + 1));

    // Total width needed by all children side by side
    const totalChildWidth = childLayouts.reduce((s, l) => s + l.subtreeWidth, 0)
      + H_GAP * (childLayouts.length - 1);

    // Place children left to right; shift their x by cumulative offset
    let curX = 0;
    const allNodes = [];
    childLayouts.forEach(cl => {
      cl.nodes.forEach(n => allNodes.push({ ...n, x: n.x + curX }));
      curX += cl.subtreeWidth + H_GAP;
    });

    // Parent centered over children
    const parentX = (totalChildWidth - NODE_WIDTH) / 2;
    allNodes.push({ id: personId, x: parentX, y: depth * (NODE_HEIGHT + V_GAP), person });

    return { subtreeWidth: totalChildWidth, nodes: allNodes };
  }, [people]);

  const layout = useMemo(() => buildLayout("root", 0), [buildLayout]);
  const layoutNodes = layout.nodes;

  const nodesById = useMemo(() => {
    const m = {};
    layoutNodes.forEach(n => { m[n.id] = n; });
    return m;
  }, [layoutNodes]);

  // SVG connector lines: elbow-style (parent bottom-center → child top-center)
  const lines = useMemo(() => {
    const result = [];
    layoutNodes.forEach(node => {
      const parentNode = node;
      (parentNode.person.children || []).forEach(childId => {
        const childNode = nodesById[childId];
        if (!childNode) return;
        const color = (ROLE_CONFIG[parentNode.person.role] || ROLE_CONFIG.member).color;
        const x1 = parentNode.x + NODE_WIDTH / 2;
        const y1 = parentNode.y + NODE_HEIGHT;
        const x2 = childNode.x + NODE_WIDTH / 2;
        const y2 = childNode.y;
        const my = (y1 + y2) / 2;
        result.push({ x1, y1, x2, y2, my, color });
      });
    });
    return result;
  }, [layoutNodes, nodesById]);

  const svgW = layout.subtreeWidth + PADDING * 2;
  const maxY = layoutNodes.length ? Math.max(...layoutNodes.map(n => n.y)) : 0;
  const svgH = maxY + NODE_HEIGHT + PADDING * 2;

  // Pan & zoom
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const clampScale = v => Math.max(0.3, Math.min(2.5, v));

  const handleWheel = (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const next = clampScale(scale * (1 + delta));
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setOffset(o => ({
        x: cx - (cx - o.x) * (next / scale),
        y: cy - (cy - o.y) * (next / scale)
      }));
    }
    setScale(next);
  };

  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.style.cursor = "grabbing";
  };
  const handlePointerMove = (e) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
  };
  const handlePointerUp = (e) => {
    dragging.current = false;
    try { e.currentTarget.style.cursor = "grab"; } catch (_) {}
  };

  return (
    <div style={{ marginBottom: "1.5rem", borderRadius: "14px", background: "rgba(35,36,31,0.9)", border: "1px solid rgba(202,190,166,0.22)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 1rem 0.6rem", borderBottom: "1px solid rgba(202,190,166,0.12)" }}>
        <div style={{ fontWeight: 700, color: THEME.brass }}>Organization Chart</div>
        <div style={{ fontSize: "0.72rem", color: "rgba(244,239,230,0.50)" }}>Ctrl+scroll to zoom · drag to pan</div>
      </div>

      {/* Canvas: single SVG holds both wires and foreign-object nodes */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ overflow: "hidden", height: 420, cursor: "grab", touchAction: "none", borderRadius: "0 0 14px 14px" }}
      >
        <svg
          width={svgW}
          height={svgH}
          style={{
            display: "block",
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "0 0",
            overflow: "visible"
          }}
        >
          {/* Connector lines — same coordinate space as foreignObject nodes */}
          <g>
            {lines.map((ln, i) => {
              const d = `M ${ln.x1 + PADDING} ${ln.y1 + PADDING} C ${ln.x1 + PADDING} ${ln.my + PADDING}, ${ln.x2 + PADDING} ${ln.my + PADDING}, ${ln.x2 + PADDING} ${ln.y2 + PADDING}`;
              return (
                <g key={i}>
                  <path d={d} fill="none" stroke={ln.color} strokeWidth={1.8} strokeOpacity={0.55} strokeLinecap="round" />
                  <circle cx={ln.x2 + PADDING} cy={ln.y2 + PADDING} r={3} fill={ln.color} fillOpacity={0.85} />
                </g>
              );
            })}
          </g>

          {/* Nodes as foreignObject so we can use HTML/CSS for cards */}
          {layoutNodes.map(node => {
            const person = node.person;
            const cfg = ROLE_CONFIG[person.role] || ROLE_CONFIG.member;
            return (
              <foreignObject
                key={person.id}
                x={node.x + PADDING}
                y={node.y + PADDING}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                style={{ overflow: "visible" }}
              >
                <div
                  xmlns="http://www.w3.org/1999/xhtml"
                  onClick={() => onSelect(person.id)}
                  style={{
                    width: NODE_WIDTH,
                    height: NODE_HEIGHT,
                    boxSizing: "border-box",
                    padding: "0.55rem 0.75rem",
                    borderRadius: "12px",
                    background: "rgba(8,24,52,0.97)",
                    border: `1.5px solid ${cfg.color}45`,
                    cursor: "pointer",
                    boxShadow: `0 4px 18px rgba(0,0,0,0.35), 0 0 0 0px ${cfg.color}00`,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                    userSelect: "none"
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = cfg.color + "90";
                    e.currentTarget.style.boxShadow = `0 6px 24px rgba(0,0,0,0.45), 0 0 0 2px ${cfg.color}22`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = cfg.color + "45";
                    e.currentTarget.style.boxShadow = "0 4px 18px rgba(0,0,0,0.35)";
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                    overflow: "hidden", border: `1.5px solid ${cfg.color}70`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: `${cfg.color}18`
                  }}>
                    {person.photoUrl
                      ? <img src={person.photoUrl} alt={person.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ color: cfg.color, fontWeight: 700, fontSize: "0.75rem" }}>{getInitials(person.name)}</span>
                    }
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: THEME.text, fontWeight: 700, fontSize: "0.82rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{person.name}</div>
                    <div style={{ marginTop: 3 }}>
                      <span style={{ background: cfg.color + "25", color: cfg.color, fontSize: "0.62rem", fontWeight: 700, padding: "1px 6px", borderRadius: 8, letterSpacing: "0.03em" }}>{cfg.label}</span>
                    </div>
                  </div>
                </div>
              </foreignObject>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
function getBranchPeople(people, rootId) {
  const visible = {};
  const traverse = (pid) => {
    const node = people[pid];
    if (!node || visible[pid]) return;
    visible[pid] = node;
    (node.children || []).forEach(traverse);
  };
  traverse(rootId);
  return visible;
}

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [addingChildOf, setAddingChildOf] = useState(null);
  const [expanded, setExpanded] = useState(new Set(["root"]));
  const [currentAccount, setCurrentAccount] = useState(null);
  const [showLogin, setShowLogin] = useState(true);
  const [loginPanelMode, setLoginPanelMode] = useState(null);
  const [rememberedUsername, setRememberedUsername] = useState("");
  const [showAccount, setShowAccount] = useState(false);
  const [filterRole, setFilterRole] = useState("all");
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [viewEventId, setViewEventId] = useState(null);

  useEffect(() => {
    const remembered = loadLastLoggedInUser();
    setRememberedUsername(remembered);
    loadData().then(saved => {
      let d = saved || initialData;
      if (!d.events) d.events = [];
      // small migration: correct roles for known names
      const roleOverrides = {
        "Venjack Havana": "leader",
        "Jerald Cocon": "member",
      };
      let changed = false;
      // apply explicit overrides
      Object.values(d.people || {}).forEach(p => {
        const want = roleOverrides[p.name];
        if (want && p.role !== want) {
          p.role = want;
          changed = true;
        }
      });
      // ensure child-role mapping recursively: each person's descendants inherit the mapped child role at each level
      const applyRec = (parentId) => {
        const parent = d.people?.[parentId];
        if (!parent) return;
        const mapped = CHILD_ROLE[parent.role];
        (parent.children || []).forEach(cid => {
          const child = d.people?.[cid];
          if (child) {
            if (mapped && child.role !== mapped) {
              child.role = mapped;
              changed = true;
            }
            applyRec(cid);
          }
        });
      };
      // start from root to cover the whole tree
      applyRec('root');
      if (changed) {
        saveData(d);
      }
      setData(d);
      setLoading(false);
    });
  }, []);

  const currentUser = currentAccount && data?.people?.[currentAccount.personId]
    ? { ...data.people[currentAccount.personId], accountRole: currentAccount.role }
    : currentAccount ? { id: "root", name: "Admin", role: "church", accountRole: currentAccount.role } : null;

  const visiblePeople = data && currentUser && !canManageAll(currentUser)
    ? getBranchPeople(data.people, currentUser.id)
    : data ? data.people : {};

  const filteredPeople = filterRole === "all"
    ? visiblePeople
    : Object.fromEntries(Object.entries(visiblePeople).filter(([, person]) => person.role === filterRole));

  const persist = useCallback((newData) => {
    setData(newData);
    saveData(newData);
  }, []);

  const toggleExpand = useCallback((id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const loginUser = useCallback((username, password, remember, callback) => {
    if (!data) {
      callback(false);
      return;
    }
    const account = findAccount(data, username);
    if (!account || hashPassword(password) !== account.passwordHash) {
      callback(false);
      return;
    }
    setCurrentAccount(account);
    if (remember) {
      saveLastLoggedInUser(normalizeUsername(username));
    } else {
      clearLastLoggedInUser();
    }
    setShowLogin(false);
    setSelectedId(account.personId || "root");
    callback(true);
  }, [data]);

  const saveAccountChanges = useCallback((payload, callback) => {
    setData(prev => {
      if (!prev || !currentAccount) {
        callback(false);
        return prev;
      }
      const normalized = normalizeUsername(payload.username);
      const existingAccount = prev.accounts?.[normalized];
      if (existingAccount && normalized !== currentAccount.username) {
        callback(false);
        return prev;
      }

      const newAccounts = { ...prev.accounts };
      delete newAccounts[currentAccount.username];
      newAccounts[normalized] = {
        ...currentAccount,
        username: normalized,
        passwordHash: payload.password ? hashPassword(payload.password) : currentAccount.passwordHash
      };

      const newPeople = { ...prev.people };
      const person = newPeople[currentAccount.personId] ? { ...newPeople[currentAccount.personId] } : null;
      if (person) {
        person.name = payload.displayName;
        person.contact = payload.contact;
        person.joinedDate = payload.joinedDate;
        newPeople[currentAccount.personId] = person;
      }

      const nextData = { ...prev, accounts: newAccounts, people: newPeople };
      saveData(nextData);
      setCurrentAccount(newAccounts[normalized]);
      callback(true);
      return nextData;
    });
  }, [currentAccount]);

  const saveEvent = useCallback((payload, callback) => {
    if (!currentUser || !canManageAll(currentUser)) {
      callback(false);
      return;
    }
    let saved = false;
    setData(prev => {
      const events = Array.isArray(prev.events) ? [...prev.events] : [];
      let nextEvents;
      let actionName;
      if (payload.id) {
        const index = events.findIndex(e => e.id === payload.id);
        if (index === -1) {
          return prev;
        }
        nextEvents = [...events];
        nextEvents[index] = { ...nextEvents[index], ...payload };
        actionName = "Edit Event";
      } else {
        nextEvents = [{ ...payload, id: generateId(), scope: payload.scope || "church" }, ...events];
        actionName = "Add Event";
      }
      const nextData = appendHistory({ ...prev, events: nextEvents }, actionName, payload.title, `${actionName} ${payload.title}`);
      saveData(nextData);
      saved = true;
      return nextData;
    });
    if (saved) {
      setShowEventModal(false);
      setEditingEventId(null);
      callback(true);
    } else {
      callback(false);
    }
  }, [currentUser]);

  const deleteEvent = useCallback((id) => {
    if (!currentUser || !canManageAll(currentUser)) return;
    setData(prev => {
      const events = Array.isArray(prev.events) ? [...prev.events] : [];
      const event = events.find(e => e.id === id);
      if (!event) return prev;
      const nextEvents = events.filter(e => e.id !== id);
      const nextData = appendHistory({ ...prev, events: nextEvents }, "Delete Event", event.title, `Removed event ${event.title}`);
      saveData(nextData);
      return nextData;
    });
  }, [currentUser]);

  const openEventModal = useCallback((id = null) => {
    setEditingEventId(id);
    setShowEventModal(true);
  }, []);

  const closeEventModal = useCallback(() => {
    setEditingEventId(null);
    setShowEventModal(false);
  }, []);

  const openEventView = useCallback((id) => {
    setViewEventId(id);
  }, []);

  const closeEventView = useCallback(() => {
    setViewEventId(null);
  }, []);

  const registerUser = useCallback((payload, remember, callback) => {
    setData(prev => {
      const normalized = normalizeUsername(payload.username);
      if (prev.accounts?.[normalized]) {
        callback(false);
        return prev;
      }
      const passwordHash = hashPassword(payload.password);
      const hasAccounts = prev.accounts && Object.keys(prev.accounts).length > 0;
      let role = payload.role || "member";
      if (!hasAccounts) {
        role = "admin";
      } else if (role === "admin" && currentAccount?.role !== "admin") {
        callback(false);
        return prev;
      }
      const personId = role === "member" ? generateId() : "root";
      const newPeople = { ...prev.people };
      if (role === "member") {
        newPeople[personId] = {
          id: personId,
          name: payload.displayName,
          role: "member",
          parentId: "root",
          children: [],
          contact: "",
          joinedDate: new Date().toISOString().slice(0, 10)
        };
        newPeople.root = { ...newPeople.root, children: [...(newPeople.root.children || []), personId] };
      }
      const newAccount = {
        username: normalized,
        passwordHash,
        role,
        personId
      };
      const newAccounts = {
        ...prev.accounts,
        [normalized]: newAccount
      };
      const nextState = { ...prev, people: newPeople, accounts: newAccounts };
      const newData = appendHistory(nextState, "Register", payload.displayName, `Created ${role} account`);
      const shouldAutoLogin = !currentAccount;
      if (shouldAutoLogin) {
        setCurrentAccount(newAccount);
        setSelectedId(personId);
        setFilterRole("all");
      }
      if (remember) {
        saveLastLoggedInUser(normalizeUsername(payload.username));
      } else {
        clearLastLoggedInUser();
      }
      setShowLogin(false);
      callback(true);
      saveData(newData);
      return newData;
    });
  }, [currentAccount]);

  const logoutUser = useCallback(() => {
    setCurrentAccount(null);
    setShowLogin(true);
    setSelectedId(null);
    setAddingChildOf(null);
    clearLastLoggedInUser();
  }, []);

  const addPerson = useCallback(({ name, contact, joinedDate, role, parentId, photoUrl }) => {
    setData(prev => {
      const parent = prev.people[parentId];
      if (!parent) return prev;
      if (!currentUser || !canAddOn(currentUser, parent)) return prev;
      const id = generateId();
      const newPeople = { ...prev.people };
      newPeople[id] = { id, name, contact, joinedDate, role, parentId, photoUrl, children: [] };
      newPeople[parentId] = { ...newPeople[parentId], children: [...(newPeople[parentId].children || []), id] };
      const newData = appendHistory({ ...prev, people: newPeople }, "Add", name, `Added ${ROLE_CONFIG[role]?.label || role} under ${parent.name}`);
      saveData(newData);
      return newData;
    });
    setExpanded(prev => new Set([...prev, parentId]));
    setAddingChildOf(null);
  }, [currentUser]);

  const deletePerson = useCallback((id) => {
    if (!currentUser || !canDeletePerson(currentUser)) return;
    setData(prev => {
      const newPeople = { ...prev.people };
      const deleteTree = (pid) => {
        const p = newPeople[pid];
        if (!p) return;
        (p.children || []).forEach(deleteTree);
        delete newPeople[pid];
      };
      const person = newPeople[id];
      if (!person) return prev;
      if (person.parentId && newPeople[person.parentId]) {
        newPeople[person.parentId] = {
          ...newPeople[person.parentId],
          children: newPeople[person.parentId].children.filter(c => c !== id)
        };
      }
      deleteTree(id);
      const newData = appendHistory({ ...prev, people: newPeople }, "Delete", person.name, `Deleted ${ROLE_CONFIG[person.role]?.label || person.role}`);
      saveData(newData);
      return newData;
    });
    setSelectedId(null);
  }, [currentUser]);

  const editPerson = useCallback((id, updates) => {
    if (!currentUser || !canEditPerson(currentUser, data.people[id])) return;
    setData(prev => {
      const target = prev.people[id];
      if (!target) return prev;
      const newPeople = { ...prev.people, [id]: { ...target, ...updates } };
      const newData = appendHistory({ ...prev, people: newPeople }, "Edit", target.name, `Updated profile for ${target.name}`);
      saveData(newData);
      return newData;
    });
  }, [currentUser, data]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#151612", color: THEME.text, fontFamily: "serif", fontSize: "1.2rem" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>✝</div>
        Loading...
      </div>
    </div>
  );

  const { people } = data;
  const selectedPerson = selectedId ? people[selectedId] : null;
  const addingParent = addingChildOf ? people[addingChildOf] : null;
  const editingEvent = editingEventId ? (data.events || []).find(ev => ev.id === editingEventId) : null;
  const viewEvent = viewEventId ? (data.events || []).find(ev => ev.id === viewEventId) : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg,#151612 0%,#1f211c 48%,#2b2a23 100%)",
      fontFamily: "'Lora',Georgia,serif",
      color: THEME.text,
      padding: "0"
    }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;900&family=Lora:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        input:focus { outline: none; border-color: rgba(200,169,106,0.62) !important; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(200,169,106,0.35); border-radius: 3px; }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.7); }
      `}</style>

      {/* Header */}
      <div style={{
        background: THEME.header,
        borderBottom: `1px solid ${THEME.border}`,
        padding: "1.2rem 1.5rem",
        display: "flex", alignItems: "center", gap: "1rem",
        boxShadow: "0 2px 20px rgba(0,0,0,0.5)"
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: "50%",
          background: "rgba(200,169,106,0.12)",
          border: "2px solid rgba(200,169,106,0.42)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.2rem", flexShrink: 0
        }}>✝</div>
        <div>
          <div style={{
            fontFamily: "'Playfair Display',serif", fontWeight: 700,
            fontSize: "1.1rem", color: THEME.text, letterSpacing: "0.02em"
          }}>New Life in Christ Fellowship</div>
          <div style={{ fontSize: "0.7rem", color: "rgba(200,169,106,0.68)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Congregation Tracker
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "1rem" }}>
          {currentUser ? (
            <>
              <div style={{ textAlign: "right", lineHeight: 1.35 }}>
                <div style={{ fontSize: "0.9rem", color: THEME.text, fontWeight: 600 }}>{currentAccount?.username || currentUser.name}</div>
                <div style={{ fontSize: "0.9rem", color: THEME.muted }}>{currentAccount?.role === "admin" ? "Admin" : ROLE_CONFIG[currentUser.role]?.label || currentUser.role}</div>
              </div>
              <button onClick={() => setShowAccount(true)} style={headerLinkButton}>My Account</button>
              {currentAccount?.role === "admin" && (
                <button onClick={() => { setShowLogin(true); setLoginPanelMode("register"); }} style={headerLinkButton}>Add account</button>
              )}
              <button onClick={logoutUser} style={headerLinkButton}>Sign out</button>
            </>
          ) : (
            <button onClick={() => { setShowLogin(true); setLoginPanelMode("login"); }} style={{ ...btnPrimary, minWidth: 110 }}>Sign in</button>
          )}
        </div>
      </div>

      <div style={{ padding: "1.5rem", maxWidth: 720, margin: "0 auto" }}>
        <StatsBar people={visiblePeople} activeRole={filterRole} onSelectRole={setFilterRole} />
        <SearchBar people={visiblePeople} onSelect={id => setSelectedId(id)} />
        {filterRole !== "all" && (
          <FilteredPeopleList people={filteredPeople} role={filterRole} onSelect={id => setSelectedId(id)} />
        )}
        {(() => {
          const eventsToShow = currentUser
            ? (data.events || [])
            : (data.events || []).filter(ev => ev.scope === "church" || !ev.scope);
          return (
            <EventsPanel
              events={eventsToShow}
              currentUser={currentUser}
              onAdd={() => openEventModal(null)}
              onEdit={id => openEventModal(id)}
              onView={id => openEventView(id)}
              onDelete={deleteEvent}
            />
          );
        })()}
        
        {filterRole === "all" && currentUser && canManageAll(currentUser) && <OrgChartPanel people={data.people} onSelect={id => setSelectedId(id)} />}
        {filterRole === "all" && currentUser && canManageAll(currentUser) && <HistoryPanel history={data.history} />}

        {currentUser && (
          <>
            <div style={{
              background: "rgba(244,239,230,0.035)", border: `1px solid ${THEME.border}`,
              borderRadius: "14px", padding: "1rem"
            }}>
              <TreeNode
                id={canManageAll(currentUser) ? "root" : (currentUser?.id || "root")}
                people={visiblePeople}
                depth={0}
                onSelect={id => setSelectedId(id)}
                onAddChild={id => setAddingChildOf(id)}
                currentUser={currentUser}
                expandedSet={expanded}
                toggleExpand={toggleExpand}
              />
            </div>

            <div style={{ marginTop: "1rem", color: THEME.faint, fontSize: "0.7rem", textAlign: "center" }}>
              Click ▶ to expand · Click a name to view details · Click + to add
            </div>
          </>
        )}
      </div>

      {showLogin && data && <LoginPanel data={data} currentAccount={currentAccount} initialMode={loginPanelMode} rememberedUsername={rememberedUsername} onLogin={loginUser} onRegister={registerUser} onClose={() => setShowLogin(false)} />}

      {showEventModal && data && (
        <EventForm
          event={editingEvent}
          onClose={closeEventModal}
          onSave={saveEvent}
        />
      )}

      {viewEvent && (
        <EventDetail
          event={viewEvent}
          currentUser={currentUser}
          onClose={closeEventView}
          onEdit={id => { closeEventView(); openEventModal(id); }}
          onDelete={deleteEvent}
        />
      )}

      {showAccount && currentAccount && data && (
        <AccountPanel
          data={data}
          currentAccount={currentAccount}
          onClose={() => setShowAccount(false)}
          onSave={saveAccountChanges}
        />
      )}

      {selectedPerson && (
        <PersonDetail
          person={selectedPerson}
          people={people}
          currentUser={currentUser}
          onClose={() => setSelectedId(null)}
          onAddChild={id => { setSelectedId(null); setAddingChildOf(id); }}
          onDelete={deletePerson}
          onEdit={editPerson}
        />
      )}

      {addingParent && (
        <AddPersonForm
          parentId={addingChildOf}
          parentRole={addingParent.role}
          onAdd={addPerson}
          onClose={() => setAddingChildOf(null)}
        />
      )}
    </div>
  );
}

window.App = App;

// ── Shared Styles ──────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%", padding: "0.65rem 0.8rem",
  background: THEME.field, border: `1px solid ${THEME.borderStrong}`,
  borderRadius: "8px", color: THEME.text, fontSize: "0.9rem",
  fontFamily: "'Lora',serif", transition: "border-color 0.2s"
};
const btnPrimary = {
  padding: "0.65rem 1.2rem", background: "linear-gradient(135deg,#aa884f,#d0b77d)",
  border: "none", borderRadius: "8px", color: "#1b1710",
  fontWeight: 700, cursor: "pointer", fontSize: "0.9rem", fontFamily: "'Lora',serif"
};
const btnSecondary = {
  padding: "0.65rem 1rem", background: "transparent",
  border: `1px solid ${THEME.borderStrong}`, borderRadius: "8px",
  color: "#e6dcc7", cursor: "pointer", fontSize: "0.85rem", fontFamily: "'Lora',serif"
};
const headerLinkButton = {
  padding: "0.25rem 0",
  background: "transparent",
  border: "none",
  color: "#e6dcc7",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontFamily: "'Lora',serif",
  lineHeight: 1.35
};
const infoRow = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0", borderBottom: "1px solid rgba(244,239,230,0.08)" };
const infoLabel = { color: THEME.faint, fontSize: "0.8rem" };
const infoVal = { color: THEME.text, fontSize: "0.85rem" };
