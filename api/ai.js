export default async function handler(req, res) {
if (req.method !== "POST") {
return res.status(405).json({ error: "Méthode non autorisée" });
}

const apiKey = process.env.ANTHROPIC_API_KEY;

try {
const response = await fetch("https://api.anthropic.com/v1/messages", {
method: "POST",
headers: {
"Content-Type": "application/json",
"x-api-key": apiKey,
"anthropic-version": "2023-06-01",
},
body: JSON.stringify({
model: "claude-3-haiku-20240307",
max_tokens: 300,
messages: [
{
role: "user",
content: [
{
type: "text",
text: req.body.message || "Salut"
}
]
}
]
}),
});

const text = await response.text();

// 👇 TRÈS IMPORTANT (on voit enfin l'erreur réelle)
if (!response.ok) {
console.error("ANTHROPIC ERROR:", text);
return res.status(500).json({ error: text });
}

const data = JSON.parse(text);

return res.status(200).json({
reply: data?.content?.[0]?.text || "Pas de réponse"
});

} catch (err) {
console.error("SERVER ERROR:", err);
return res.status(500).json({ error: err.message });
}
}
