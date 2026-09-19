/**
 * MARISENTINEL — Rule Engine (Explanation & Fallback)
 * Facade entrypoint forwarding to js/services/ruleEngine.js
 */

(function () {
  if (typeof window !== "undefined" && window.MS_RULE_ENGINE) {
    window.ruleEngine = window.MS_RULE_ENGINE;
  }
})();
