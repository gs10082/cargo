/*
 * Keeps the Godot WebAssembly runtime below static-host file limits.
 * The browser rebuilds the original binary before Godot initializes it.
 */
(function () {
	const nativeFetch = window.fetch.bind(window);
	const wasmUrl = new URL("index.wasm", document.baseURI).href;
	const chunks = ["index.wasm.part1", "index.wasm.part2"];

	window.fetch = async function (input, init) {
		const requestUrl = new URL(input instanceof Request ? input.url : input, document.baseURI).href;
		if (requestUrl !== wasmUrl) {
			return nativeFetch(input, init);
		}

		const responses = await Promise.all(chunks.map((chunk) => nativeFetch(chunk, init)));
		if (responses.some((response) => !response.ok)) {
			throw new Error("Failed to load the WebAssembly runtime chunks.");
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
				"Content-Type": "application/wasm",
				"Content-Length": String(size),
			},
		});
	};
}());
