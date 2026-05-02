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
model: "claude-3-sonnet-20240229",
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

const data = await response.json();

if (!response.ok) {
console.error(data);
return res.status(500).json({ error: "Erreur IA", details: data });
}

return res.status(200).json({
reply: data?.content?.[0]?.text || "Pas de réponse"
});

} catch (err) {
console.error(err);
return res.status(500).json({ error: "Erreur serveur" });
}
}
