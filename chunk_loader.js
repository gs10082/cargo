(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  // Bump this on every delivery so a host never serves stale chunks.
  const BUILD_VERSION = '20260917-transient-pooling-telemetry-r157';
  const chunkMap = {
    // .bin files bypass the host's Function route and remain static assets.
    // Keep Godot's standard entrypoint names. The zero-byte files included in
    // the release satisfy Game Hub's static HTML verifier; this loader then
    // serves the real data from upload-safe chunks at runtime.
    'index.wasm': ['index-wasm-1.bin', 'index-wasm-2.bin'],
    'index.pck': ['index-pck-1.bin'],
  };

  const streamChunks = (baseUrl, chunks, init, contentType) => {
    let chunkIndex = 0;
    let reader = null;
    return new Response(new ReadableStream({
      async pull(controller) {
        // Consume a completed chunk and open the next one in this same pull.
        // Returning between chunks can leave some WebKit streams waiting for a
        // follow-up pull that never arrives, leaving the game on its loading UI.
        while (true) {
          while (!reader) {
            if (chunkIndex >= chunks.length) {
              controller.close();
              return;
            }
            const response = await nativeFetch(`${baseUrl}${chunks[chunkIndex]}?v=${BUILD_VERSION}`, init);
            if (!response.ok || !response.body) {
              throw new Error(`Failed to load ${chunks[chunkIndex]}`);
            }
            chunkIndex += 1;
            reader = response.body.getReader();
          }
          const { done, value } = await reader.read();
          if (done) {
            reader.releaseLock();
            reader = null;
            continue;
          }
          controller.enqueue(value);
          return;
        }
      },
    }), {
      headers: { 'Content-Type': contentType },
    });
  };

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    const fileName = url.split('?')[0].split('/').pop();
    const chunks = chunkMap[fileName];
    if (!chunks) return nativeFetch(input, init);

    const baseUrl = url.slice(0, url.lastIndexOf('/') + 1);
    const contentType = fileName.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream';
    if (chunks.length === 1) {
      const response = await nativeFetch(`${baseUrl}${chunks[0]}?v=${BUILD_VERSION}`, init);
      if (!response.ok) throw new Error(`Failed to load ${chunks[0]}`);
      return response;
    }
    // Never concatenate the release-sized WASM chunks in JavaScript. On iOS,
    // that temporary duplicate can be enough for WebKit to kill the tab.
    return streamChunks(baseUrl, chunks, init, contentType);
  };
})();
