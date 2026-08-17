(() => {
  'use strict';

  const PROFILE_KEY = 'cargo_and_colt_profile';
  const LEADERBOARD_KEY = 'cargo_and_colt_survival';
  const PENDING_SCORE_KEY = 'cargo_and_colt_pending_challenge_score';

  const localLoad = (key) => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (_) {
      return null;
    }
  };

  const localSave = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      // Local storage can be unavailable in private browser contexts.
    }
  };

  const hub = () => window.HubGame;

  const submitPendingScore = async () => {
    const pending = Number(localLoad(PENDING_SCORE_KEY) || 0);
    if (pending <= 0 || !hub() || typeof hub().submitScore !== 'function') {
      return false;
    }
    try {
      await hub().submitScore(LEADERBOARD_KEY, pending);
      localSave(PENDING_SCORE_KEY, 0);
      return true;
    } catch (_) {
      return false;
    }
  };

  window.CargoAndColtHub = {
    async loadProfile() {
      const fallback = localLoad(PROFILE_KEY);
      if (!hub() || typeof hub().load !== 'function') {
        return { ready: false, value: fallback };
      }
      try {
        const remote = await hub().load(PROFILE_KEY);
        if (remote) {
          localSave(PROFILE_KEY, remote);
          return { ready: true, value: remote };
        }
        return { ready: true, value: fallback };
      } catch (_) {
        return { ready: false, value: fallback };
      }
    },

    async saveProfile(profile) {
      localSave(PROFILE_KEY, profile);
      if (!hub() || typeof hub().save !== 'function') {
        return false;
      }
      try {
        await hub().save(PROFILE_KEY, profile);
        return true;
      } catch (_) {
        return false;
      }
    },

    async submitChallengeScore(score) {
      const nextScore = Math.max(0, Number(score) || 0);
      const pending = Number(localLoad(PENDING_SCORE_KEY) || 0);
      if (nextScore > pending) {
        localSave(PENDING_SCORE_KEY, nextScore);
      }
      return submitPendingScore();
    },

    async getChallengeLeaderboard(limit) {
      await submitPendingScore();
      if (!hub() || typeof hub().getLeaderboard !== 'function') {
        return { available: false, rows: [] };
      }
      try {
        const rows = await hub().getLeaderboard(LEADERBOARD_KEY, Math.max(1, Number(limit) || 100));
        return { available: true, rows: Array.isArray(rows) ? rows : [] };
      } catch (_) {
        return { available: false, rows: [] };
      }
    },
  };
})();
