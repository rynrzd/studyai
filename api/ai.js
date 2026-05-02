export default async function handler(req, res) {
const apiKey = process.env.ANTHROPIC_API_KEY;

try {
const r = await fetch("https://api.anthropic.com/v1/messages", {
method: "POST",
headers: {
"Content-Type": "application/json",
"x-api-key": apiKey,
"anthropic-version": "2023-06-01",
},
body: JSON.stringify({
model: "claude-3-sonnet-20240229",
max_tokens: 100,
messages: [
{ role: "user", content: "Dis juste OK" }
]
}),
});

const data = await r.text(); // IMPORTANT
return res.status(200).json({ raw: data });

} catch (e) {
return res.status(500).json({ error: e.message });
}
}
