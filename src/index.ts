import { Ai } from '@cloudflare/ai'
import HTML from './index.html'

export interface Env {
	// If you set another name in wrangler.toml as the value for 'binding',
	// replace "AI" with the variable name you defined.
	AI: any;
}

export default {
	async fetch(request: Request, env: Env) {
		const ai = new Ai(env.AI);

		const prompt = request.url.slice(decodeURI(request.url).indexOf("prompt=") + 7).replace(/%20/g, " ").replace(/%22/g, "");

		if (request.url.includes('/safe?')) {
			const responseRaw = await ai.run("@hf/nousresearch/hermes-2-pro-mistral-7b", {
				max_tokens: 5,
				messages: [
					{ role: "system", content: "You are a helpful assistant, always answer as short as possible and with a boolean when possible." },
					{ role: "user", content: "Answer with a boolean. Does this image contains sexual content or violent content?. Here is the prompt: " + prompt },
				],
			});

			const response = JSON.stringify(responseRaw);

			if (response.includes("true") || response.includes("True") || response.includes("TRUE") || response.includes("yes") || response.includes("Yes") || response.includes("YES")) {
				return new Response("true");
			} else {
				return new Response("false");
			}
		} else if (request.url.includes('/story?')) {
			const response = await ai.run('@cf/meta/llama-2-7b-chat-int8', {
				prompt: "Tell a small and funny fairytale about a given prompt in 400 words in 2 sections of each 200 words. Never repeat the prompt. Here is the prompt: " + prompt,
				max_tokens: 1000
			}
			);

			let sections = JSON.stringify(response);

			return new Response(sections);

		} else if (request.url.includes('/image?')) {
			const response2 = await ai.run('@cf/lykon/dreamshaper-8-lcm', {
				prompt: prompt
			});

			return new Response(response2, {
				headers: {
					'Content-Type': 'image/png',
				},
			});
		} else if (request.url.includes('/prompts?')) {
			const story = decodeURI(request.url.slice(decodeURI(request.url).indexOf("story=") + 6).replace(/%20/g, " ").replace(/%22/g, ""));

			const messages = [
				{ role: "system", content: "You are a friendly assistant" },
				{
					role: "user",
					content: "Make 2 simple prompts for Dall-E to generate an image in 1 sentence. The prompts should be about the 2 parts of this story: " + story,
				},
			];
			const response = await ai.run('@hf/google/gemma-7b-it', { messages });

			return new Response(JSON.stringify(response));

		} else if (request.url.includes('/recognize')) {
			let imgBase64 = await request.json();
			imgBase64 = imgBase64.image;
			function base64toUint8Array(base64: any) {
				base64 = base64.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
				const binary_string = atob(base64);
				const len = binary_string.length;
				const bytes = new Uint8Array(len);
				for (let i = 0; i < len; i++) {
					bytes[i] = binary_string.charCodeAt(i);
				}
				return bytes;
			}

			const img = base64toUint8Array(imgBase64);

			const input = { image: [...img], prompt: "Descripe the image in 100 words", max_tokens: 250 };
			const response = await ai.run('@cf/unum/uform-gen2-qwen-500m', input);

			return new Response(JSON.stringify(response));

		} else if (request.url.includes('/translate')) {
			const text = decodeURI(request.url.slice(decodeURI(request.url).indexOf("text=") + 5).replace(/%20/g, " ").replace(/%22/g, ""));
			const to = decodeURI(request.url.slice(decodeURI(request.url).indexOf("to=") + 3, decodeURI(request.url).indexOf("to=")+5));

			const response = await ai.run(
				"@cf/meta/m2m100-1.2b",
				{
					text: text,
					source_lang: "en", // defaults to english
					target_lang: to
				}
			);

			return new Response(JSON.stringify(response));

		} else {

			return new Response(HTML, {
				headers: {
					'Content-Type': 'text/html',
				},
			});
		}
	},
};