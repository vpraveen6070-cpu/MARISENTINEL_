
/**
 * MARISENTINEL — Dynamic Centralized Data Architecture & Loader
 * Asynchronously loads modular datasets from /data/*.json
 */

(function () {
  const BASE_URL = "/data";

  const MS_DATA = {
    baseUrl: BASE_URL,
    _cache: {},

    /**
     * Clean dataset name from path or filename
     * e.g., "vessels", "/data/vessels.json", "vessels.json" -> "vessels"
     */
    _normalizeKey(keyOrPath) {
      if (!keyOrPath) return "";
      return keyOrPath
        .replace(/^\/?data\//, "")
        .replace(/\.json$/, "")
        .trim();
    },

    /**
     * Dynamically fetch a modular dataset from /data/<name>.json
     * @param {string} datasetName - e.g. "vessels", "anomalies", "zones"
     * @param {boolean} [forceRefresh=false]
     */
    async load(datasetName, forceRefresh = false) {
      const key = this._normalizeKey(datasetName);
      if (!key) throw new Error("Dataset name is required");

      if (!forceRefresh && this._cache[key]) {
        return this._cache[key];
      }

      const url = `${this.baseUrl}/${key}.json`;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load dataset '${key}' from ${url} [HTTP ${response.status}: ${response.statusText}]`);
        }
        const data = await response.json();
        this._cache[key] = data;
        return data;
      } catch (err) {
        console.error(`[MS_DATA] Error fetching dataset '${key}':`, err);
        throw err;
      }
    },

    // Individual dataset accessors
    async loadVessels() {
      return this.load("vessels");
    },
    async loadZones() {
      return this.load("zones");
    },
    async loadAlerts() {
      return this.load("alerts");
    },
    async loadIncidents() {
      return this.load("incidents");
    },
    async loadAnomalies() {
      try {
        return await this.load("anomalies");
      } catch {
        return await this.load("threat-rules");
      }
    },
    async loadThreatRules() {
      return this.loadAnomalies();
    },
    async loadWeather() {
      return this.load("weather");
    },
    async loadUsers() {
      return this.load("users");
    },
    async loadSources() {
      return this.load("sources");
    },
    async loadAudit() {
      return this.load("audit");
    },
    async loadNotifications() {
      return this.load("notifications");
    },
    async loadRadarStations() {
      return this.load("radar-stations");
    },
    async loadBoundaries() {
      return this.load("maritime-boundaries");
    },

    /**
     * Concurrently load all core application datasets
     * and initialize window.MS_SEED for backwards compatibility.
     */
    async loadAll() {
      try {
        const [
          vessels,
          zones,
          alerts,
          incidents,
          users,
          sources,
          weather,
          audit,
          threatRules,
          notifications,
          radarStations,
          maritimeBoundaries
        ] = await Promise.all([
          this.loadVessels().catch((e) => { console.warn("Vessels load fallback:", e); return []; }),
          this.loadZones().catch((e) => { console.warn("Zones load fallback:", e); return []; }),
          this.loadAlerts().catch((e) => { console.warn("Alerts load fallback:", e); return []; }),
          this.loadIncidents().catch((e) => { console.warn("Incidents load fallback:", e); return []; }),
          this.loadUsers().catch((e) => { console.warn("Users load fallback:", e); return []; }),
          this.loadSources().catch((e) => { console.warn("Sources load fallback:", e); return []; }),
          this.loadWeather().catch((e) => {
            console.warn("Weather load fallback:", e);
            return {
              windKts: 18,
              windDir: "NE",
              waveM: 2.1,
              visibilityKm: 8.5,
              seaState: "Moderate (Sea State 4)",
              advisory: "Squall warning active for North-East quadrant.",
              updatedAt: new Date().toISOString()
            };
          }),
          this.loadAudit().catch((e) => { console.warn("Audit load fallback:", e); return []; }),
          this.loadThreatRules().catch((e) => { console.warn("Threat rules load fallback:", e); return []; }),
          this.loadNotifications().catch((e) => { console.warn("Notifications load fallback:", e); return []; }),
          this.loadRadarStations().catch((e) => { console.warn("Radar stations load fallback:", e); return []; }),
          this.loadBoundaries().catch((e) => { console.warn("Boundaries load fallback:", e); return null; })
        ]);

        const aggregated = {
          vessels,
          zones,
          alerts,
          incidents,
          users,
          sources,
          weather,
          audit,
          threatRules,
          notifications,
          radarStations,
          maritimeBoundaries
        };

        window.MS_SEED = aggregated;
        return aggregated;
      } catch (err) {
        console.error("[MS_DATA] loadAll failed:", err);
        throw err;
      }
    }
  };

  /**
   * Global dynamic loader function matching project requirement
   * e.g. const vessels = await loadData('vessels.json');
   */
  async function loadData(filenameOrKey) {
    return MS_DATA.load(filenameOrKey);
  }

  // Initial placeholder state so synchronous accesses don't throw undefined errors
  window.MS_SEED = window.MS_SEED || {
    vessels: [],
    zones: [],
    alerts: [],
    incidents: [],
    users: [],
    sources: [],
    weather: {},
    audit: [],
    threatRules: [],
    notifications: []
  };

  window.MS_DATA = MS_DATA;
  window.loadData = loadData;
})();
