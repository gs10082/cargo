(() => {
  'use strict';

  const PROFILE_KEY = 'cargo_and_colt_profile';
  const CHALLENGE_KEY = 'cargo_and_colt_survival';

  const readLocal = (key) => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  };

  const writeLocal = (key, value) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      // Private browsing or quota failures must not interrupt the game.
    }
  };

  const canLoad = () => typeof window.HubGame?.load === 'function';
  const canSave = () => typeof window.HubGame?.save === 'function';

  const waitForHubLoad = async () => {
    for (const delay of [0, 150, 350, 750]) {
      if (canLoad()) return true;
      if (delay > 0) await new Promise((resolve) => window.setTimeout(resolve, delay));
    }
    return canLoad();
  };

  window.CargoAndColtHub = {
    async loadProfile() {
      const fallback = readLocal(PROFILE_KEY);
      if (!await waitForHubLoad()) return { ready: false, value: fallback };
      try {
        const remote = await window.HubGame.load(PROFILE_KEY);
        const value = remote || fallback;
        if (remote) writeLocal(PROFILE_KEY, remote);
        return { ready: true, value };
      } catch (_) {
        return { ready: false, value: fallback };
      }
    },

    async saveProfile(profile) {
      writeLocal(PROFILE_KEY, profile);
      if (!canSave()) return false;
      try {
        await window.HubGame.save(PROFILE_KEY, profile);
        return true;
      } catch (_) {
        return false;
      }
    },

    async submitChallengeScore(score) {
      const value = Math.max(0, Number(score) || 0);
      const savedBest = Number(readLocal(`${CHALLENGE_KEY}_best`) || 0);
      if (value <= savedBest) return false;
      writeLocal(`${CHALLENGE_KEY}_best`, value);
      if (typeof window.HubGame?.submitScore !== 'function') return false;
      try {
        await window.HubGame.submitScore(CHALLENGE_KEY, value);
        return true;
      } catch (_) {
        return false;
      }
    },

    async getChallengeLeaderboard(limit) {
      if (typeof window.HubGame?.getLeaderboard !== 'function') {
        return { available: false, rows: [] };
      }
      try {
        const rows = await window.HubGame.getLeaderboard(CHALLENGE_KEY, Math.max(1, Number(limit) || 10));
        return { available: true, rows: Array.isArray(rows) ? rows : [] };
      } catch (_) {
        return { available: false, rows: [] };
      }
    },
  };
})();
