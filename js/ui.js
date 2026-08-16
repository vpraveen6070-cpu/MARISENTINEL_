/**
 * MARISENTINEL — Vanilla JS UI Utilities, Layout & Toaster
 */

window.MS_UI = (function () {
  const TOAST_DURATION = 1800; // Fast auto-dismiss

  /* ---------------- Navigation Definitions ---------------- */
  const NAV_CONFIG = {
    administrator: [
      { id: "overview", label: "Dashboard", icon: "📊" },
      { id: "users", label: "User Management", icon: "👥" },
      { id: "zones", label: "Security Zones", icon: "🛡️" },
      { id: "sources", label: "Data Sources", icon: "📡" },
      { id: "vessels", label: "Vessel Data", icon: "🚢" },
      { id: "rules", label: "Threat Rules", icon: "⚙️" },
      { id: "audit", label: "Audit Logs", icon: "📜" },
      { id: "profile", label: "My Profile", icon: "👤" }
    ],
    command: [
      { id: "overview", label: "Command Center", icon: "🧭" },
      { id: "map", label: "Live Maritime Map", icon: "🗺️" },
      { id: "alerts", label: "Alerts & Threats", icon: "⚠️" },
      { id: "vessels", label: "Vessel Fleet", icon: "🚢" },
      { id: "incidents", label: "Incident Response", icon: "🚨" },
      { id: "analytics", label: "Analytics & Trends", icon: "📈" },
      { id: "profile", label: "My Profile", icon: "👤" }
    ],
    field: [
      { id: "overview", label: "My Dashboard", icon: "📋" },
      { id: "missions", label: "Active Missions", icon: "🎯" },
      { id: "map", label: "Mission Map", icon: "🗺️" },
      { id: "reports", label: "Submit Evidence", icon: "📸" },
      { id: "profile", label: "My Profile", icon: "👤" }
    ]
  };

  /* ---------------- Toast Notification System (with Swipe) ---------------- */
  function showToast(message, type = "success") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "toast-card";
    toast.innerHTML = `
      <div class="toast-content">
        <span>${type === "error" ? "❌" : "✔️"}</span>
        <span>${message}</span>
      </div>
      <button class="toast-close" aria-label="Dismiss">&times;</button>
    `;

    container.appendChild(toast);

    // Swipe dismiss logic
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    function handleStart(e) {
      isDragging = true;
      startX = e.type.includes("touch") ? e.touches[0].clientX : e.clientX;
    }

    function handleMove(e) {
      if (!isDragging) return;
      currentX = e.type.includes("touch") ? e.touches[0].clientX : e.clientX;
      const diff = currentX - startX;
      if (diff > 0) {
        toast.style.transform = `translateX(${diff}px)`;
        toast.style.opacity = `${Math.max(0.2, 1 - diff / 200)}`;
      }
    }

    function handleEnd() {
      if (!isDragging) return;
      isDragging = false;
      const diff = currentX - startX;
      if (diff > 80) {
        dismiss();
      } else {
        toast.style.transform = "translateX(0)";
        toast.style.opacity = "1";
      }
    }

    function dismiss() {
      toast.style.transform = "translateX(100%)";
      toast.style.opacity = "0";
      setTimeout(() => {
        if (toast.parentElement) toast.remove();
      }, 200);
    }

    toast.addEventListener("mousedown", handleStart);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);

    toast.addEventListener("touchstart", handleStart, { passive: true });
    toast.addEventListener("touchmove", handleMove, { passive: true });
    toast.addEventListener("touchend", handleEnd);

    toast.querySelector(".toast-close").addEventListener("click", (e) => {
      e.stopPropagation();
      dismiss();
    });

    // Auto dismiss
    setTimeout(dismiss, TOAST_DURATION);
  }

  /* ---------------- Tactical Audio Synthesizer ---------------- */
  let audioCtx = null;
  function playNotificationChime(severity = "info") {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!audioCtx) audioCtx = new AudioContext();
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      const freq = severity === "critical" ? 880 : severity === "high" ? 660 : 523.25;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.4, audioCtx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      // Audio autostart policy or unsupported, silent fallback
    }
  }

  /* ---------------- Notification Dropdown Renderer ---------------- */
  let currentNotifFilter = "all";

  function renderNotificationDropdownContent(filter = "all") {
    currentNotifFilter = filter;
    const s = window.msStore.getState();
    const allNotifs = s.notifications || [];
    const unreadCount = allNotifs.filter((n) => !n.read).length;

    let filtered = allNotifs;
    if (filter === "threat") {
      filtered = allNotifs.filter((n) => n.type === "threat");
    } else if (filter === "mission") {
      filtered = allNotifs.filter((n) => n.type === "mission");
    } else if (filter === "system") {
      filtered = allNotifs.filter((n) => n.type === "system" || n.type === "operational");
    }

    return `
      <div class="notification-dropdown-header">
        <div style="display:flex; align-items:center; gap:8px;">
          <strong style="font-size:13px; color:var(--text-main);">Tactical Notifications</strong>
          ${unreadCount > 0 ? `<span class="badge badge-critical" style="font-size:10px;">${unreadCount} Unread</span>` : `<span class="badge badge-ok" style="font-size:10px;">All Read</span>`}
        </div>
        ${
          unreadCount > 0
            ? `<button class="btn btn-secondary btn-sm" style="padding:2px 6px; font-size:10.5px;" onclick="window.msStore.markAllNotificationsRead();">Mark all read</button>`
            : ""
        }
      </div>

      <div class="notification-filter-tabs">
        <button class="notif-tab-btn ${filter === 'all' ? 'active' : ''}" data-notif-filter="all">All (${allNotifs.length})</button>
        <button class="notif-tab-btn ${filter === 'threat' ? 'active' : ''}" data-notif-filter="threat">🚨 Threats</button>
        <button class="notif-tab-btn ${filter === 'mission' ? 'active' : ''}" data-notif-filter="mission">🎯 Missions</button>
        <button class="notif-tab-btn ${filter === 'system' ? 'active' : ''}" data-notif-filter="system">📡 System</button>
      </div>

      <div class="notification-list">
        ${
          filtered.length === 0
            ? `
            <div style="padding:32px 16px; text-align:center; color:var(--text-muted); font-size:12px;">
              <span>📭</span>
              <p style="margin-top:6px;">No notifications in this category.</p>
            </div>
          `
            : filtered
                .map((n) => {
                  const icon =
                    n.type === "threat"
                      ? "🚨"
                      : n.type === "mission"
                      ? "🎯"
                      : n.type === "system"
                      ? "📡"
                      : "⚡";
                  return `
            <div class="notification-item ${n.read ? '' : 'unread'}" data-notif-id="${n.id}" onclick="window.msStore.markNotificationRead('${n.id}');">
              <div class="notification-item-icon">${icon}</div>
              <div class="notification-item-content">
                <div class="notification-item-title">
                  <span>${n.title}</span>
                  <span style="font-size:10px; font-weight:400; color:var(--text-muted);">${timeAgo(n.ts)}</span>
                </div>
                <div class="notification-item-desc">${n.message}</div>
                <div class="notification-item-actions">
                  ${
                    n.vesselId
                      ? `<button class="btn btn-primary btn-sm" style="padding:2px 6px; font-size:10px;" onclick="event.stopPropagation(); window.msStore.markNotificationRead('${n.id}'); window.openThreatDossier('${n.vesselId}');">Inspect Dossier</button>`
                      : ""
                  }
                  ${
                    n.incidentId
                      ? `<button class="btn btn-secondary btn-sm" style="padding:2px 6px; font-size:10px;" onclick="event.stopPropagation(); window.msStore.markNotificationRead('${n.id}'); if(window.renderTab){ window.renderTab('incidents'); }">View Incident</button>`
                      : ""
                  }
                </div>
              </div>
            </div>
          `;
                })
                .join("")
        }
      </div>

      <div class="notification-dropdown-footer">
        <span style="font-size:10px; color:var(--text-muted);">Real-time C2 Telemetry Channel</span>
        <button class="btn btn-secondary btn-sm" style="padding:2px 6px; font-size:10px;" onclick="window.msStore.clearNotifications();">Clear All</button>
      </div>
    `;
  }

  /* ---------------- AppShell Component Builder ---------------- */
  function renderAppShell(role, activeTab, onTabChange) {
    const s = window.msStore.getState();
    const session = s.session || { name: role === "administrator" ? "Dr. Arvind Rao" : role === "command" ? "Cdr. Rajesh Menon" : "Lt. Manoj Barua", role };

    const navItems = NAV_CONFIG[role] || [];
    const isCollapsed = localStorage.getItem("ms_sidebar_collapsed") === "true";
    const unreadCount = (s.notifications || []).filter((n) => !n.read).length;

    const sidebarHtml = `
      <aside id="app-sidebar" class="app-sidebar ${isCollapsed ? "collapsed" : ""}">
        <div class="sidebar-header">
          <div class="brand-logo">
            <span class="brand-icon">⚓</span>
            <span class="brand-text">MARISENTINEL</span>
          </div>
          <button id="sidebar-collapse-btn" class="sidebar-toggle-btn" title="Collapse sidebar">
            ←
          </button>
        </div>

        <nav class="sidebar-nav">
          ${navItems
            .map(
              (item) => `
            <a href="#${item.id}" class="nav-link ${item.id === activeTab ? "active" : ""}" data-tab="${item.id}">
              <span>${item.icon}</span>
              <span>${item.label}</span>
            </a>
          `
            )
            .join("")}
        </nav>

        <div class="sidebar-footer">
          <div class="flex items-center gap-2" style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:11px;color:var(--text-muted);">Region: <strong>Bay of Bengal</strong></span>
          </div>
          <button id="logout-btn" class="btn btn-secondary btn-sm" style="width:100%;">
            Log out
          </button>
        </div>
      </aside>
    `;

    const headerHtml = `
      <header class="app-header">
        <div class="header-left">
          <button id="sidebar-expand-btn" class="sidebar-toggle-btn" title="Toggle sidebar">
            ${isCollapsed ? "→" : "←"}
          </button>
          <span class="badge badge-neutral" style="font-size:11px;">
            Bay of Bengal · Coastal Security Grid
          </span>
        </div>

        <div class="header-right">
          <div class="badge badge-neutral" id="live-indicator-badge" style="cursor:pointer;padding:4px 10px;">
            <span class="ms-live-dot"></span>
            <span id="live-status-text" style="font-weight:600;margin-left:4px;">${s.simRunning ? "LIVE MONITORING" : "SIMULATION PAUSED"}</span>
            <button id="toggle-sim-btn" style="margin-left:6px;font-size:11px;padding:2px 4px;cursor:pointer;">
              ${s.simRunning ? "⏸" : "▶"}
            </button>
            <span class="mono" id="live-tick-count" style="margin-left:4px;color:var(--text-muted);">#${s.tick || 260}</span>
          </div>

          <!-- Tactical Notification Bell & Hub -->
          <div class="notification-bell-wrapper">
            <button id="notif-bell-btn" class="notification-bell-btn" title="Tactical Notifications (${unreadCount} unread)" aria-label="Notifications">
              <span style="font-size:16px;">🔔</span>
              <span id="notif-badge-count" class="notification-badge ${unreadCount > 0 ? 'has-unread' : ''}">${unreadCount}</span>
            </button>

            <div id="notif-dropdown-panel" class="notification-dropdown">
              ${renderNotificationDropdownContent("all")}
            </div>
          </div>

          <div class="user-profile-badge" style="display:flex;align-items:center;gap:8px;padding:4px 10px;border-radius:var(--radius-md);border:1px solid var(--border-color);background:var(--bg-card);cursor:pointer;" title="View profile">
            <div style="width:24px;height:24px;border-radius:50%;background:rgba(15,23,42,0.1);display:grid;place-items:center;font-size:10px;font-weight:700;color:var(--primary);">
              ${session.name.slice(0, 2).toUpperCase()}
            </div>
            <div style="line-height:1.2;">
              <span style="font-size:12px;font-weight:600;display:block;">${session.name}</span>
              <span style="font-size:10px;color:var(--text-muted);display:block;text-transform:capitalize;">${session.role}</span>
            </div>
          </div>
        </div>
      </header>
    `;

    return { sidebarHtml, headerHtml };
  }

  /* ---------------- Attach Layout Listeners ---------------- */
  function attachLayoutEvents(onTabChange) {
    const sidebar = document.getElementById("app-sidebar");
    const collapseBtn = document.getElementById("sidebar-collapse-btn");
    const expandBtn = document.getElementById("sidebar-expand-btn");

    function toggleSidebar() {
      if (!sidebar) return;
      const isNowCollapsed = !sidebar.classList.contains("collapsed");
      sidebar.classList.toggle("collapsed", isNowCollapsed);
      localStorage.setItem("ms_sidebar_collapsed", isNowCollapsed ? "true" : "false");
      if (expandBtn) expandBtn.textContent = isNowCollapsed ? "→" : "←";
      
      // Dispatch resize events during and after animation
      [50, 150, 300].forEach((delay) => {
        setTimeout(() => window.dispatchEvent(new Event("resize")), delay);
      });
    }

    if (collapseBtn) collapseBtn.addEventListener("click", toggleSidebar);
    if (expandBtn) expandBtn.addEventListener("click", toggleSidebar);

    // Tab Links
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const tab = link.getAttribute("data-tab");
        document.querySelectorAll(".nav-link").forEach((l) => l.classList.remove("active"));
        link.classList.add("active");
        if (onTabChange) onTabChange(tab);
      });
    });

    // Profile Badge Click
    const profileBadge = document.querySelector(".user-profile-badge");
    if (profileBadge) {
      profileBadge.addEventListener("click", () => {
        document.querySelectorAll(".nav-link").forEach((l) => l.classList.remove("active"));
        const profileLink = document.querySelector('.nav-link[data-tab="profile"]');
        if (profileLink) profileLink.classList.add("active");
        if (onTabChange) onTabChange("profile");
      });
    }

    // Notification Bell & Dropdown Listeners
    const notifBellBtn = document.getElementById("notif-bell-btn");
    const notifDropdown = document.getElementById("notif-dropdown-panel");

    if (notifBellBtn && notifDropdown) {
      notifBellBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = notifDropdown.classList.contains("open");
        if (!isOpen) {
          notifDropdown.innerHTML = renderNotificationDropdownContent(currentNotifFilter);
          attachNotifFilterListeners();
          notifDropdown.classList.add("open");
        } else {
          notifDropdown.classList.remove("open");
        }
      });

      document.addEventListener("click", (e) => {
        if (notifDropdown.classList.contains("open") && !notifDropdown.contains(e.target) && !notifBellBtn.contains(e.target)) {
          notifDropdown.classList.remove("open");
        }
      });
    }

    function attachNotifFilterListeners() {
      if (!notifDropdown) return;
      notifDropdown.querySelectorAll(".notif-tab-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const filter = btn.getAttribute("data-notif-filter");
          notifDropdown.innerHTML = renderNotificationDropdownContent(filter);
          attachNotifFilterListeners();
        });
      });
    }

    // Sim Toggle
    const simBtn = document.getElementById("toggle-sim-btn");
    if (simBtn) {
      simBtn.addEventListener("click", () => {
        window.msStore.toggleSimulation();
      });
    }

    // Logout
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        window.msStore.logout();
      });
    }

    // Sync state on ticks & notification changes
    window.msStore.subscribe((s) => {
      const liveText = document.getElementById("live-status-text");
      const liveTick = document.getElementById("live-tick-count");
      const simBtnEl = document.getElementById("toggle-sim-btn");
      if (liveText) liveText.textContent = s.simRunning ? "LIVE MONITORING" : "SIMULATION PAUSED";
      if (liveTick) liveTick.textContent = `#${s.tick || 260}`;
      if (simBtnEl) simBtnEl.textContent = s.simRunning ? "⏸" : "▶";

      // Sync notification badge
      const unreadCount = (s.notifications || []).filter((n) => !n.read).length;
      const notifBadge = document.getElementById("notif-badge-count");
      if (notifBadge) {
        notifBadge.textContent = unreadCount;
        if (unreadCount > 0) {
          notifBadge.classList.add("has-unread");
        } else {
          notifBadge.classList.remove("has-unread");
        }
      }

      // If dropdown is open, re-render its list
      if (notifDropdown && notifDropdown.classList.contains("open")) {
        notifDropdown.innerHTML = renderNotificationDropdownContent(currentNotifFilter);
        attachNotifFilterListeners();
      }
    });
  }

  /* ---------------- Formatting Helpers ---------------- */
  function timeAgo(iso) {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.round(diff / 60000);
    if (Math.abs(m) < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  }

  function fmtTime(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  function getBadgeClass(status) {
    const s = (status || "").toLowerCase();
    if (["critical", "high risk", "failed"].includes(s)) return "badge-critical";
    if (["high", "restricted", "new", "in progress"].includes(s)) return "badge-danger";
    if (["medium", "warn", "monitoring", "investigating", "on-mission"].includes(s)) return "badge-warn";
    if (["active", "connected", "completed", "resolved", "available"].includes(s)) return "badge-ok";
    return "badge-neutral";
  }

  /* ---------------- Profile Section Template ---------------- */
  function getProfileHtml(role) {
    const s = window.msStore.getState();
    const defaultNames = {
      administrator: { name: "Dr. Arvind Rao", username: "admin", region: "Visakhapatnam HQ", title: "Chief Platform Architect", clearance: "Level 5 · Supreme Administrator" },
      command: { name: "Cdr. Rajesh Menon", username: "command", region: "Eastern Naval Command", title: "Tactical Watch Commander", clearance: "Level 4 · Naval Strategic Command" },
      field: { name: "Lt. Manoj Barua", username: "field", region: "Visakhapatnam Interceptor Squadron", title: "Lead Interception Officer (IC-114)", clearance: "Level 3 · Field Operational" }
    };
    const defaultInfo = defaultNames[role] || defaultNames.command;
    const session = s.session || { name: defaultInfo.name, role };
    const userObj = s.users.find(u => u.username.toLowerCase() === (session.username || role).toLowerCase()) || defaultInfo;

    return `
      <div class="section-header">
        <div>
          <h1 class="section-title">Operator Profile & Security</h1>
          <p class="section-subtitle">Manage tactical identity, access credentials, notification channels, and operational status.</p>
        </div>
        <span class="badge badge-primary">
          ${userObj.clearance || defaultInfo.clearance}
        </span>
      </div>

      <div class="grid-3" style="grid-template-columns: 1fr 2fr; margin-bottom: 24px;">
        <!-- Left: Profile Summary Card -->
        <div class="panel">
          <div class="panel-body" style="text-align: center; padding: 24px 16px;">
            <div style="width: 72px; height: 72px; border-radius: 50%; background: rgba(15,23,42,0.1); border: 2px solid var(--primary); margin: 0 auto 14px; display: grid; place-items: center; font-size: 24px; font-weight: 800; color: var(--primary);">
              ${(session.name || userObj.name).slice(0, 2).toUpperCase()}
            </div>
            <h2 style="font-size: 18px; font-weight: 700; color: var(--text-main);">${session.name || userObj.name}</h2>
            <span class="badge badge-primary" style="margin-top: 4px; text-transform: uppercase;">${role}</span>
            <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">${userObj.title || defaultInfo.title}</p>
            
            <div style="margin-top: 20px; text-align: left; border-top: 1px solid var(--border-color); padding-top: 14px;">
              <div class="keyval-row"><span class="keyval-key">Operator ID</span><span class="keyval-val mono">${userObj.id || 'USR-OP-408'}</span></div>
              <div class="keyval-row"><span class="keyval-key">Sector / Base</span><span class="keyval-val">${userObj.region || defaultInfo.region}</span></div>
              <div class="keyval-row"><span class="keyval-key">Session Active</span><span class="keyval-val badge badge-ok">Online</span></div>
              <div class="keyval-row"><span class="keyval-key">Auth Type</span><span class="keyval-val">Biometric + 2FA</span></div>
            </div>
          </div>
        </div>

        <!-- Right: Edit Profile & Contact Settings -->
        <div class="panel">
          <div class="panel-header">
            <h2>Personal Information &amp; Preferences</h2>
          </div>
          <div class="panel-body">
            <form id="profile-edit-form" onsubmit="event.preventDefault(); window.MS_UI.showToast('Profile changes saved successfully.');">
              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Full Name</label>
                  <input type="text" class="input-field" value="${session.name || userObj.name}" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Callsign / Designation</label>
                  <input type="text" class="input-field" value="${userObj.title || defaultInfo.title}">
                </div>
              </div>

              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Official Communications Email</label>
                  <input type="email" class="input-field" value="${(userObj.username || role)}@marisentinel.gov.in" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Secure Satellite Comms Line</label>
                  <input type="text" class="input-field" value="+91 (891) 285-4421">
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Emergency Broadcast Preferences</label>
                <div style="display:flex; flex-direction:column; gap:8px; margin-top:6px; font-size:12px;">
                  <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <input type="checkbox" checked> SMS priority chimes for Level 5 Critical naval zone intrusions
                  </label>
                  <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <input type="checkbox" checked> INCOIS squall and severe maritime weather bulletins
                  </label>
                  <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <input type="checkbox" checked> Encrypted satellite tasking synchronization
                  </label>
                </div>
              </div>

              <div style="margin-top: 20px; text-align: right;">
                <button type="submit" class="btn btn-primary">Save Profile Updates</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Bottom Security & Password Panel -->
      <div class="grid-2">
        <div class="panel">
          <div class="panel-header">
            <h2>Authentication &amp; Password</h2>
          </div>
          <div class="panel-body">
            <form onsubmit="event.preventDefault(); window.MS_UI.showToast('Password updated securely.'); this.reset();">
              <div class="form-group">
                <label class="form-label">Current Password</label>
                <input type="password" class="input-field" placeholder="••••••••" required>
              </div>
              <div class="form-group">
                <label class="form-label">New Password</label>
                <input type="password" class="input-field" placeholder="Minimum 8 characters" required>
              </div>
              <div class="form-group">
                <label class="form-label">Confirm New Password</label>
                <input type="password" class="input-field" placeholder="Repeat new password" required>
              </div>
              <div style="text-align: right; margin-top: 14px;">
                <button type="submit" class="btn btn-secondary">Update Password</button>
              </div>
            </form>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <h2>Recent Security Access Events</h2>
          </div>
          <div class="panel-body" style="max-height: 250px; overflow-y: auto;">
            <div style="padding: 8px 0; border-bottom: 1px solid var(--border-color);">
              <div style="display:flex; justify-content:space-between;">
                <strong style="font-size:12px;">Successful Login (Console Node 01)</strong>
                <span style="font-size:10px; color:var(--text-muted);">Just now</span>
              </div>
              <span style="font-size:10px; color:var(--text-muted);">IP: 10.17.73.178 · Browser session active</span>
            </div>
            <div style="padding: 8px 0; border-bottom: 1px solid var(--border-color);">
              <div style="display:flex; justify-content:space-between;">
                <strong style="font-size:12px;">Hardware Security Key Verified</strong>
                <span style="font-size:10px; color:var(--text-muted);">2h ago</span>
              </div>
              <span style="font-size:10px; color:var(--text-muted);">FIDO2 / YubiKey token auth confirmed</span>
            </div>
            <div style="padding: 8px 0;">
              <div style="display:flex; justify-content:space-between;">
                <strong style="font-size:12px;">Role Authorization Check Passed</strong>
                <span style="font-size:10px; color:var(--text-muted);">Yesterday</span>
              </div>
              <span style="font-size:10px; color:var(--text-muted);">Eastern Naval Command clearance validated</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return {
    showToast,
    renderAppShell,
    attachLayoutEvents,
    getProfileHtml,
    playNotificationChime,
    renderNotificationDropdownContent,
    timeAgo,
    fmtTime,
    getBadgeClass
  };
})();
