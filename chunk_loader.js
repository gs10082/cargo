/*
 * Keeps Godot export artifacts below static-host file limits.
 * The browser rebuilds each original binary before Godot initializes it.
 */
(function () {
	const nativeFetch = window.fetch.bind(window);
	const splitFiles = {
		[new URL("index.wasm", document.baseURI).href]: ["index.wasm.part1", "index.wasm.part2"],
		[new URL("index.pck", document.baseURI).href]: ["index.pck.part1", "index.pck.part2"],
	};

	window.fetch = async function (input, init) {
		const requestUrl = new URL(input instanceof Request ? input.url : input, document.baseURI).href;
		const chunks = splitFiles[requestUrl];
		if (!chunks) {
			return nativeFetch(input, init);
		}

		const responses = await Promise.all(chunks.map((chunk) => nativeFetch(chunk, init)));
		if (responses.some((response) => !response.ok)) {
			throw new Error("Failed to load a split game file.");
		}

		const parts = await Promise.all(responses.map((response) => response.arrayBuffer()));
		const size = parts.reduce((total, part) => total + part.byteLength, 0);
		const binary = new Uint8Array(size);
		let offset = 0;
		parts.forEach((part) => {
			binary.set(new Uint8Array(part), offset);
			offset += part.byteLength;
		});

		return new Response(binary, {
			status: 200,
			headers: {
				"Content-Type": requestUrl.endsWith(".wasm") ? "application/wasm" : "application/octet-stream",
				"Content-Length": String(size),
			},
		});
	};
}());
