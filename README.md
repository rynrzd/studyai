# Study AI+ — Plateforme IA éducative 🎓

## 🚀 Lancer le projet

```bash
npm install
cp .env.example .env
# Édite .env et mets ta clé OpenAI
npm run dev
# → http://localhost:3001
```

## 💰 Plans

| Plan | Prix | Fonctionnalités |
|---|---|---|
| 🆓 Gratuit | 0€ | 20 questions/jour, toutes matières, XP basique, streak |
| 💎 Study AI+ | **6,99€/mois** | Illimité + mode examen + plan IA + analyse erreurs + badges exclusifs |
| 👨‍👩‍👧 Famille | **9,99€/mois** | 4 enfants inclus + dashboard parent + contrôle IA. +2,80€/enfant suppl. |

## 🎮 Gamification (Duolingo-style)

- **XP** : message = +10, quiz = +20, leçon = +30
- **Streak** : 3 jours = +20 XP bonus, 7 jours = +50, 30 jours = badge spécial
- **Niveaux** : 1 (débutant) → 10 (bon élève) → 20 (expert)
- **Badges** : Premier pas, Quizmaster, En feu, Champion, Parfait, Régulier

## 🔑 Clé API

Va sur https://platform.openai.com/api-keys → copie ta clé → colle dans `.env`

## 🏷️ Codes promo

| Code | Réduction |
|---|---|
| `STUDYAI` | -50% |
| `RENTREE` | -30% |
| `BAC2025` | -25% |

## 📁 Structure

```
src/
├── App.jsx              ← routeur
├── main.jsx             ← entrée + AppProvider
├── data/constants.js    ← matières, classes, badges, prix
├── context/AppContext   ← état global + streak logic
├── services/
│   ├── ai.js            ← OpenAI GPT-4o
│   └── auth.js          ← localStorage
├── components/SharedUI  ← composants réutilisables
└── pages/
    ├── Landing.jsx
    ├── Auth.jsx
    ├── Chat.jsx         ← chat + paywall + streak
    └── Pricing.jsx      ← Pricing/Payment/Settings
```

---
*Study AI+ · Pour apprendre, pas pour tricher 😊*
