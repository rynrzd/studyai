// ─── src/data/constants.js ────────────────────────────────────────────────────
// Toutes les constantes de l'application

// ── Codes promo (validation finale côté serveur via Stripe) ──────────────────
// Ces codes sont affichés à l'utilisateur à titre informatif.
// La remise réelle est appliquée par Stripe via les coupons configurés en dashboard.
export const PROMO_CODES = { STUDYAI: 50, RENTREE: 30, BAC2025: 25 };

// ── Classes scolaires ─────────────────────────────────────────────────────────
export const CLASSES = [
  { v: "6e",        l: "6ème",       age: 11 },
  { v: "5e",        l: "5ème",       age: 12 },
  { v: "4e",        l: "4ème",       age: 13 },
  { v: "3e",        l: "3ème",       age: 14 },
  { v: "2nde",      l: "2nde",       age: 15 },
  { v: "1ere",      l: "1ère",       age: 16 },
  { v: "terminale", l: "Terminale",  age: 17 },
  { v: "superieur", l: "Supérieur",  age: 18 },
  { v: "prof",      l: "👨‍🏫 Professeur", age: 99 },
];

// ── Matières ──────────────────────────────────────────────────────────────────
export const SUBJECTS = [
  { id: "maths",    label: "Maths",       icon: "📐", color: "#6366f1" },
  { id: "francais", label: "Français",    icon: "📖", color: "#ec4899" },
  { id: "histoire", label: "Histoire",    icon: "🏛️", color: "#f59e0b" },
  { id: "sciences", label: "Sciences",    icon: "🔬", color: "#10b981" },
  { id: "anglais",  label: "Anglais",     icon: "🌍", color: "#3b82f6" },
  { id: "philo",    label: "Philosophie", icon: "💭", color: "#8b5cf6" },
  { id: "bac",      label: "Révision Bac",icon: "🎓", color: "#ef4444" },
  { id: "general",  label: "Général",     icon: "💬", color: "#64748b" },
];

// ── Modes de chat ─────────────────────────────────────────────────────────────
export const CHAT_MODES = [
  { id: "cours",    label: "📚 Cours",     desc: "Résumé + fiche + quiz" },
  { id: "quiz",     label: "🎯 Quiz",      desc: "Entraîne-toi" },
  { id: "simplifie",label: "🔄 Simplifier",desc: "Encore plus simple" },
  { id: "fiche",    label: "📌 Fiche",     desc: "Fiche rapide" },
];

// ── Mots interdits pour les noms ─────────────────────────────────────────────
export const BAD_WORDS = ["merde","putain","connard","con ","salope","enfoiré","bite","couille"];

// ── Gamification ─────────────────────────────────────────────────────────────
export const XP_REWARDS = {
  message:   10,
  quiz_good: 20,
  quiz_done: 50,
  fiche:     15,
  photo:     25,
  daily:     30,
};

export const LEVEL_THRESHOLDS = [0,100,250,500,900,1500,2500,4000,6000,9000,13000];

export const BADGES = [
  { id:"first_msg",   icon:"💬", label:"Premier pas",      desc:"Premier message envoyé",      xp:0    },
  { id:"quiz_5",      icon:"🎯", label:"Quizmaster",        desc:"5 quiz complétés",            xp:100  },
  { id:"streak_3",    icon:"🔥", label:"En feu",            desc:"3 jours consécutifs",         xp:150  },
  { id:"notes_all",   icon:"📊", label:"Analyste",          desc:"Notes dans toutes les matières",xp:200},
  { id:"flashcard_10",icon:"🃏", label:"Mémoriseur",        desc:"10 flashcards complétées",    xp:120  },
  { id:"exam_passed", icon:"🏆", label:"Champion",          desc:"Mode examen réussi",          xp:300  },
  { id:"perfect_quiz",icon:"⭐", label:"Perfectionniste",   desc:"Quiz parfait 5/5",            xp:200  },
  { id:"week_active", icon:"📅", label:"Régulier",          desc:"Actif 7 jours de suite",      xp:500  },
];

// ── Questions aléatoires ──────────────────────────────────────────────────────
export const RANDOM_QUESTIONS = {
  college: [
    { q:"C'est quoi la photosynthèse ?",                  sub:"svt"      },
    { q:"Comment calculer l'aire d'un triangle ?",        sub:"maths"    },
    { q:"C'est quoi la Révolution française ?",           sub:"hg"       },
    { q:"Comment identifier un complément d'objet ?",     sub:"francais" },
    { q:"C'est quoi un atome ?",                          sub:"physique" },
    { q:"Comment calculer un pourcentage ?",              sub:"maths"    },
    { q:"C'est quoi le Moyen Âge ?",                      sub:"hg"       },
    { q:"Explique-moi les fractions",                     sub:"maths"    },
  ],
  lycee: [
    { q:"Explique la dérivée d'une fonction",             sub:"maths"    },
    { q:"C'est quoi la Première Guerre mondiale ?",       sub:"hg"       },
    { q:"Comment analyser un texte littéraire ?",         sub:"francais" },
    { q:"Explique la loi d'Ohm",                          sub:"physique" },
    { q:"C'est quoi l'ADN ?",                             sub:"svt"      },
    { q:"Comment résoudre une équation du 2nd degré ?",   sub:"maths"    },
    { q:"C'est quoi la mondialisation ?",                 sub:"hg"       },
    { q:"Comment conjuguer le subjonctif ?",              sub:"francais" },
  ],
  terminale: [
    { q:"Méthodologie de la dissertation philosophique",  sub:"philo"    },
    { q:"Explique le théorème des valeurs intermédiaires",sub:"maths"    },
    { q:"Comment préparer le grand oral du bac ?",        sub:"bac"      },
    { q:"La conscience selon Descartes",                  sub:"philo"    },
    { q:"Explique la structure de l'ADN",                 sub:"svt"      },
    { q:"Les grandes dates de la Guerre froide",          sub:"hg"       },
    { q:"Comment réussir la dissertation de français ?",  sub:"francais" },
    { q:"Explique les suites numériques",                 sub:"maths"    },
  ],
};

// ── Flashcards par matière ────────────────────────────────────────────────────
export const FLASHCARDS_DB = {
  maths: [
    { front:"Théorème de Pythagore",     back:"Dans un triangle rectangle : a² + b² = c²\n(c = hypoténuse)" },
    { front:"Dérivée de x²",             back:"f'(x) = 2x" },
    { front:"Dérivée de sin(x)",         back:"f'(x) = cos(x)" },
    { front:"Formule de la discriminante",back:"Δ = b² - 4ac\nSi Δ>0 : 2 solutions\nSi Δ=0 : 1 solution\nSi Δ<0 : 0 solution réelle" },
    { front:"Périmètre d'un cercle",     back:"P = 2πr" },
    { front:"Aire d'un disque",          back:"A = πr²" },
  ],
  francais: [
    { front:"Métaphore",                 back:"Comparaison sans outil comparatif\nEx: «La vie est un long fleuve tranquille»" },
    { front:"Anaphore",                  back:"Répétition d'un mot en début de phrase\nEx: «Rome, l'unique objet de mon ressentiment ! Rome...»" },
    { front:"Hyperbole",                 back:"Exagération pour produire un effet\nEx: «Je t'ai dit mille fois de ranger ta chambre»" },
    { front:"Antithèse",                 back:"Opposition de deux idées\nEx: «Je vis, je meurs ; je me brûle et me noie»" },
    { front:"Chiasme",                   back:"Structure croisée A-B / B-A\nEx: «Il faut manger pour vivre et non vivre pour manger»" },
  ],
  hg: [
    { front:"1789",                      back:"Révolution française — Prise de la Bastille le 14 juillet" },
    { front:"1914-1918",                 back:"Première Guerre mondiale" },
    { front:"1939-1945",                 back:"Seconde Guerre mondiale" },
    { front:"1958",                      back:"Naissance de la Ve République (de Gaulle)" },
    { front:"1989",                      back:"Chute du mur de Berlin — Fin de la Guerre froide" },
  ],
  svt: [
    { front:"Photosynthèse",             back:"6CO₂ + 6H₂O + lumière → C₆H₁₂O₆ + 6O₂\nSe déroule dans les chloroplastes" },
    { front:"Structure d'une cellule",   back:"Membrane, cytoplasme, noyau (ADN), mitochondries\nCellule animale ≠ végétale (chloroplastes, vacuole, paroi)" },
    { front:"L'ADN",                     back:"Acide DésoxyriboNucléique\nDouble hélice, 4 bases : A-T-G-C\nPorte l'information génétique" },
    { front:"La mitose",                 back:"Division cellulaire identique (2 cellules filles)\nProphase → Métaphase → Anaphase → Télophase" },
    { front:"Biodiversité",              back:"Diversité des espèces, des gènes et des écosystèmes\nMenacée par : déforestation, pollution, changement climatique" },
  ],
  physique: [
    { front:"Loi d'Ohm",                 back:"U = R × I\nU = tension (V), R = résistance (Ω), I = intensité (A)" },
    { front:"Formule de l'eau",          back:"H₂O — 2 hydrogènes + 1 oxygène\nLiaison covalente polaire" },
    { front:"Vitesse de la lumière",     back:"c ≈ 3 × 10⁸ m/s dans le vide\nc = λ × f (λ=longueur d'onde, f=fréquence)" },
    { front:"Structure d'un atome",      back:"Noyau (protons + neutrons) + électrons en orbite\nNuméro atomique Z = nombre de protons" },
    { front:"Les états de la matière",   back:"Solide → Liquide (fusion) → Gaz (vaporisation)\nSolide ← Liquide (solidification) ← Gaz (condensation)" },
  ],
  sciences: [
    { front:"Formule de l'eau",          back:"H₂O — 2 hydrogènes + 1 oxygène" },
    { front:"Photosynthèse",             back:"6CO₂ + 6H₂O + lumière → C₆H₁₂O₆ + 6O₂" },
    { front:"Loi d'Ohm",                 back:"U = R × I\nU = tension (V), R = résistance (Ω), I = intensité (A)" },
    { front:"Vitesse de la lumière",     back:"c ≈ 3 × 10⁸ m/s dans le vide" },
    { front:"Structure d'un atome",      back:"Noyau (protons + neutrons) + électrons en orbite" },
  ],
  anglais: [
    { front:"Present Perfect",     back:"Have/has + past participle\nEx: I have eaten · She has gone\nUsage: action passée liée au présent" },
    { front:"Past Simple",         back:"Regular: verb + -ed\nIrregular: go→went, see→saw, eat→ate\nUsage: action terminée dans le passé" },
    { front:"Conditional",         back:"Would + infinitive\nEx: I would go if I could\nType 2 (irréel): If + past → would + inf." },
    { front:"Passive Voice",       back:"To be + past participle\nEx: The book was written by Hugo\nSujet reçoit l'action" },
    { front:"Reported Speech",     back:"Direct → Indirect : reculer les temps\n'I am happy' → He said he was happy\n'I went' → He said he had gone" },
  ],
  philo: [
    { front:"Le Cogito (Descartes)",         back:"«Je pense donc je suis» (Cogito ergo sum)\nPreuve de l'existence par la seule pensée" },
    { front:"Impératif catégorique (Kant)",  back:"Agis comme si la maxime de ton action\ndevait devenir une loi universelle\nMorale absolue, inconditionnelle" },
    { front:"La maïeutique (Socrate)",       back:"Art de faire «accoucher» les esprits\npar le questionnement et le dialogue\n«Je sais que je ne sais rien»" },
    { front:"L'utilitarisme (Mill/Bentham)", back:"Une action est juste si elle maximise\nle bonheur du plus grand nombre\nMorale des conséquences" },
    { front:"La dialectique (Hegel)",        back:"Thèse → Antithèse → Synthèse\nMouvement de la pensée vers la vérité\nContradictons moteurs du progrès" },
  ],
};

// ── Défis du jour ─────────────────────────────────────────────────────────────
export const DAILY_CHALLENGES = [
  { q:"Explique le théorème de Pythagore avec un exemple chiffré concret",      sub:"maths",    xp:30 },
  { q:"Explique la photosynthèse étape par étape, en français simple",          sub:"sciences", xp:30 },
  { q:"Quelles sont les 3 causes principales de la 1ère Guerre mondiale ?",     sub:"histoire", xp:30 },
  { q:"Identifie et explique 3 figures de style dans un court texte littéraire",sub:"francais", xp:30 },
  { q:"Explique la différence entre le Present Perfect et le Past Simple",       sub:"anglais",  xp:30 },
  { q:"La liberté est-elle compatible avec les lois ? Donne 2 arguments.",      sub:"philo",    xp:30 },
  { q:"Résume la construction européenne depuis 1945 en 5 étapes clés",         sub:"histoire", xp:30 },
  { q:"Explique la loi d'Ohm avec un exemple de circuit électrique simple",     sub:"sciences", xp:30 },
];

// ── Brevet — sections ─────────────────────────────────────────────────────────
export const BREVET_SECTIONS = [
  { id:"maths",    icon:"📐", label:"Maths",         color:"#6366f1",
    fiches:["Calcul littéral et équations","Géométrie et Pythagore","Probabilités","Fonctions"],
    exercices:["Résoudre : 3x+5=20","Calculer l'hypoténuse (3,4)","Périmètre d'un cercle r=5"],
  },
  { id:"francais", icon:"📖", label:"Français",      color:"#ec4899",
    fiches:["Propositions subordonnées","Figures de style","Méthode de rédaction","Analyse de texte"],
    exercices:["Identifier les figures de style","Rédiger une introduction","Analyser un paragraphe argumentatif"],
  },
  { id:"hg",       icon:"🏛️", label:"Histoire-Géo",  color:"#f59e0b",
    fiches:["1ère et 2ème Guerre mondiale","La décolonisation","Construction européenne","Ve République"],
    exercices:["Frise chronologique WWII","Causes de la décolonisation","Institutions de la Ve République"],
  },
  { id:"svt",      icon:"🌿", label:"SVT",            color:"#10b981",
    fiches:["La cellule et le vivant","Génétique et ADN","Écosystèmes et biodiversité","Corps humain"],
    exercices:["Schéma cellule végétale","Expliquer la photosynthèse","Identifier les organites"],
  },
  { id:"physique", icon:"⚗️", label:"Physique-Chimie",color:"#06b6d4",
    fiches:["Électricité : lois et circuits","Lumière et optique","Atomes et molécules","États de la matière"],
    exercices:["Schéma circuit électrique","Calculer avec la loi d'Ohm","Nommer les changements d'état"],
  },
];
