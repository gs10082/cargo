(() => {
  'use strict';

  const PROFILE_KEY = 'cargo_and_colt_profile';
  const CHALLENGE_KEY = 'cargo_and_colt_survival';
  const CHALLENGE_BEST_KEY = 'cargo_and_colt_survival_best';

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

  const getHub = () => window.HubGame || null;

  const waitForHubMethod = async (method, timeoutMs = 6000) => {
    const startedAt = Date.now();
    do {
      const hub = getHub();
      if (typeof hub?.[method] === 'function') return hub;
      await new Promise((resolve) => window.setTimeout(resolve, 200));
    } while (Date.now() - startedAt < timeoutMs);
    const hub = getHub();
    return typeof hub?.[method] === 'function' ? hub : null;
  };

  window.CargoAndColtHub = {
    async loadProfile() {
      const fallback = readLocal(PROFILE_KEY);
      const hub = await waitForHubMethod('load');
      if (!hub) return { ready: false, value: fallback };
      try {
        const remote = await hub.load(PROFILE_KEY);
        const value = remote || fallback;
        if (remote) writeLocal(PROFILE_KEY, remote);
        return { ready: true, value };
      } catch (_) {
        return { ready: false, value: fallback };
      }
    },

    async saveProfile(profile) {
      writeLocal(PROFILE_KEY, profile);
      const hub = await waitForHubMethod('save');
      if (!hub) return false;
      try {
        await hub.save(PROFILE_KEY, profile);
        return true;
      } catch (_) {
        return false;
      }
    },

    async submitChallengeScore(score) {
      const value = Math.max(0, Number(score) || 0);
      const savedBest = Number(readLocal(`${CHALLENGE_KEY}_best`) || 0);
      const hub = await waitForHubMethod('submitScore');
      if (!hub) return false;
      const bestScore = Math.max(value, savedBest);
      try {
        // A failed best-score read must never prevent the actual leaderboard submission.
        let remoteBest = 0;
        if (typeof hub.load === 'function') {
          try {
            remoteBest = Number(await hub.load(CHALLENGE_BEST_KEY) || 0);
          } catch (_) {
            remoteBest = 0;
          }
        }
        writeLocal(`${CHALLENGE_KEY}_best`, bestScore);
        if (bestScore <= remoteBest) return true;
        await hub.submitScore(CHALLENGE_KEY, bestScore);
        if (typeof hub.save === 'function') {
          // This auxiliary save must not invalidate a successfully submitted score.
          try {
            await hub.save(CHALLENGE_BEST_KEY, bestScore);
          } catch (_) {
            // The leaderboard submission already completed.
          }
        }
        return true;
      } catch (_) {
        return false;
      }
    },

    async getChallengeLeaderboard(limit) {
      const hub = await waitForHubMethod('getLeaderboard');
      if (!hub) {
        const hasHub = !!getHub();
        return {
          available: false,
          rows: [],
          retry: true,
          reason: hasHub ? 'HubGame.getLeaderboard API를 찾지 못했습니다.' : 'HubGame이 문서 페이지에 주입되지 않았습니다.',
        };
      }
      try {
        const rows = await hub.getLeaderboard(CHALLENGE_KEY, Math.max(1, Number(limit) || 10));
        return { available: true, rows: Array.isArray(rows) ? rows : [], retry: false, reason: '' };
      } catch (error) {
        // The leaderboard endpoint can be injected after the profile store is ready.
        const detail = error instanceof Error ? error.message : String(error || '알 수 없는 서버 오류');
        return { available: false, rows: [], retry: true, reason: `랭킹 서버 요청 실패: ${detail}` };
      }
    },
  };
})();
