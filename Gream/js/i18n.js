// ═══════════════════════════════════
//  GREAM — i18n.js
//  All translations EN / CZ
// ═══════════════════════════════════

export const T = {
  en: {
    // App
    tagline: "One adventure every day 🌿",
    // Onboarding
    ob_name: "Your name", ob_av: "Choose your avatar",
    ob_age: "How old are you?", ob_start: "Let's go! 🌱",
    ob_placeholder: "Enter your name...",
    // Profiles
    ps_title: "Who's playing?", ps_sub: "Choose your profile",
    ps_add: "+ Add profile", settings: "Settings",
    // Map
    map_new: "New challenge!", map_done: "Done ✅",
    worlds: {
      nature:   "Nature",
      language: "Language",
      logic:    "Logic",
      feelings: "Feelings & Me",
      arts:     "Arts & Music",
      world:    "World & Culture"
    },
    // Challenge
    ch_label: "Today's challenge",
    btn_photo: "Take a photo",
    btn_draw:  "Draw it",
    btn_voice: "Say it out loud",
    btn_write: "Write it down",
    draw_label:  "Draw your proof 🎨",
    draw_done:   "✅ Done!",
    write_label: "Write your answer ✍️",
    write_done:  "✅ Done!",
    write_hint:  "Write at least a few words...",
    bp_title:   "Badge progress",
    step_lbl:   n => `Step ${n}`,
    // Step done
    step_done_title: "Step done!",
    step_done_sub:   (n, t) => `${n} of ${t} steps completed`,
    next_step:  "Next step →",
    come_back:  "Come back tomorrow",
    // Badge earned
    congrats:      "Amazing!",
    badge_earned:  "You earned a new badge!",
    badge_evolved: "Your badge evolved!",
    continue:      "🌿 Back to map",
    // Badges screen
    my_badges:    "My Badges",
    streak_title: "🔥 Streak badges",
    bb_label:     "My badges",
    tasks_done:   n => `${n} tasks done`,
    // Settings
    set_title:    "Settings",
    ss_lang:      "Language",       ss_lang_lbl:    "App language",
    ss_profile:   "Profile",        ss_age:         "Age group",
    ss_data:      "Data",           ss_reset:       "Reset all data",
    ss_name:      "Display name",   ss_avatar:      "Avatar",
    ss_family:    "Family",         ss_family_code: "Your family code",
    ss_family_join:"Join a family", ss_join_placeholder: "Enter family code...",
    ss_join_btn:  "Join",
    // Stats
    stats_title:  "Stats",
    stats_total:  "Total tasks",
    stats_streak: "Best streak",
    stats_worlds: "Worlds explored",
    stats_badges: "Badges earned",
    lb_title:     "Leaderboard",
    lb_empty:     "No data yet — keep going!",
    // Streak days
    streak_days: d => `${d} day${d === 1 ? '' : 's'}`,
    // Step types — label, icon, action (photo/draw/voice/write)
    steps: {
      nature:   [{label:"Observe", icon:"👁️", type:"photo"}, {label:"Draw",    icon:"🎨", type:"draw" }, {label:"Share",   icon:"🗣️", type:"voice"}],
      language: [{label:"Listen",  icon:"👂", type:"voice"}, {label:"Write",   icon:"✍️", type:"write"}, {label:"Speak",   icon:"🗣️", type:"voice"}],
      logic:    [{label:"Find",    icon:"🔍", type:"photo"}, {label:"Think",   icon:"🧠", type:"write"}, {label:"Explain", icon:"🗣️", type:"voice"}],
      feelings: [{label:"Feel",    icon:"💛", type:"voice"}, {label:"Draw",    icon:"🎨", type:"draw" }, {label:"Share",   icon:"✍️", type:"write"}],
      arts:     [{label:"Listen",  icon:"🎵", type:"voice"}, {label:"Create",  icon:"🖌️", type:"draw" }, {label:"Perform", icon:"🎭", type:"voice"}],
      world:    [{label:"Discover",icon:"🔭", type:"photo"}, {label:"Create",  icon:"🍳", type:"draw" }, {label:"Tell",    icon:"🗣️", type:"write"}]
    },
    // Challenges by world and age
    challenges: {
      nature: {
        "4-6": [
          {text:"Go outside and find 3 different leaves. Look at their shapes!", hint:"Every leaf is different — big, small, smooth or bumpy!", action:"photo", check:{type:"exists"}},
          {text:"Draw the 3 leaves you found. Try to show their real shape.", hint:"You can trace them on paper first.", action:"draw", check:{type:"drawing"}},
          {text:"Tell someone at home where you found the leaves and what you noticed.", hint:"Show them your drawing too! 🍃", action:"voice", check:{type:"duration",minMs:1500}}
        ],
        "7-9": [
          {text:"Find a living creature outside — an insect, bird, or worm. Watch it for 1 minute and photograph it.", hint:"Stay still and quiet. Creatures are shy!", action:"photo", check:{type:"exists"}},
          {text:"Draw the creature and write 2 things you observed about it.", hint:"How did it move? What was it doing?", action:"draw", check:{type:"drawing"}},
          {text:"Tell someone what you found. What surprised you most?", hint:"Show your photo and drawing!", action:"voice", check:{type:"duration",minMs:2000}}
        ],
        "10-15": [
          {text:"Find a tree or plant nearby. Photograph it and try to identify its name.", hint:"Plant ID apps, books, or asking someone — all count.", action:"photo", check:{type:"exists"}},
          {text:"Draw its leaves and write 3 facts you discovered about this plant.", hint:"Where it grows, what animals use it, is it rare?", action:"write", check:{type:"min_words",minWords:15}},
          {text:"Explain to someone why this plant is interesting. Teach it!", hint:"You're the expert now!", action:"voice", check:{type:"duration",minMs:3000}}
        ],
        "15+": [
          {text:"Go outside without your phone for 15 minutes. Pay attention to what you usually walk past.", hint:"Slow down. The world has details we miss every day.", action:"photo", check:{type:"exists"}},
          {text:"Draw or write about the most interesting thing you noticed.", hint:"No judgment — just observe and capture.", action:"write", check:{type:"min_words",minWords:20}},
          {text:"Share your observation with someone. What story does this small thing tell?", hint:"Even a crack in a wall has a story.", action:"voice", check:{type:"duration",minMs:4000}}
        ]
      },
      language: {
        "4-6": [
          {text:"Listen carefully — what 3 sounds can you hear right now?", hint:"Wind? Birds? Music? Someone talking?", action:"draw", check:{type:"drawing"}},
          {text:"Draw the 3 sounds as pictures. What does a sound look like?", hint:"There's no wrong answer — be creative!", action:"draw", check:{type:"drawing"}},
          {text:"Make each sound with your voice. Can someone guess what they are?", hint:"This is your sound concert! 🎵", action:"voice", check:{type:"duration",minMs:1500}}
        ],
        "7-9": [
          {text:"Say 'thank you' in 5 different languages. Find them out!", hint:"Ask someone, use a book, or think of movies you've seen.", action:"voice", check:{type:"duration",minMs:2000}},
          {text:"Write all 5 ways to say 'thank you' and draw a flag next to each one.", hint:"Gracias, Merci, Danke, Спасибо, ありがとう...", action:"write", check:{type:"keywords",keywords:["gracias","merci","danke","спасибо","arigato","ありがとう","dzięki","obrigado","shukran","xièxie"],minMatch:3}},
          {text:"Teach these words to someone at home. Can they repeat them all?", hint:"You're the language teacher today!", action:"voice", check:{type:"duration",minMs:2000}}
        ],
        "10-15": [
          {text:"Pick a language you find interesting. Find 5 phrases and learn to say them out loud.", hint:"Focus on pronunciation — record yourself trying.", action:"voice", check:{type:"duration",minMs:3000}},
          {text:"Write the 5 phrases and add a drawing or symbol for each one.", hint:"Visual memory helps — connect the word to an image.", action:"write", check:{type:"min_words",minWords:10}},
          {text:"Perform your phrases for someone. Try your best accent!", hint:"Laughing while learning actually helps.", action:"voice", check:{type:"duration",minMs:3000}}
        ],
        "15+": [
          {text:"Find a song, poem, or quote in a language you don't speak. Listen to it.", hint:"What emotions does it carry even without understanding?", action:"voice", check:{type:"duration",minMs:2000}},
          {text:"Write down what you think it means — just from the sound and feeling.", hint:"Trust your intuition. Language is music too.", action:"write", check:{type:"min_words",minWords:20}},
          {text:"Find the real translation. What surprised you? Share your reaction.", hint:"Notice the gap between feeling and meaning.", action:"write", check:{type:"min_words",minWords:20}}
        ]
      },
      logic: {
        "4-6": [
          {text:"Find 5 things at home of different sizes. Line them up from smallest to biggest!", hint:"Can you find something smaller than your thumbnail?", action:"photo", check:{type:"exists"}},
          {text:"Draw the 5 things in a line with their sizes labeled.", hint:"Try to draw them to scale — bigger things drawn bigger.", action:"draw", check:{type:"drawing"}},
          {text:"Explain your logic: how did you decide the order?", hint:"Was anything tricky to compare?", action:"voice", check:{type:"duration",minMs:1500}}
        ],
        "7-9": [
          {text:"Count all the windows in your home. How many are on each wall?", hint:"Take it step by step — one room at a time.", action:"write", check:{type:"number",answer:null}},
          {text:"Draw a simple map of your home showing all the windows.", hint:"Use a bird's eye view — looking down from above.", action:"draw", check:{type:"drawing"}},
          {text:"Explain to someone: what was the hardest part to figure out?", hint:"Talking through logic helps you understand it better.", action:"voice", check:{type:"duration",minMs:2000}}
        ],
        "10-15": [
          {text:"Pick an object at home and estimate how many would fit in your room. Then calculate it.", hint:"Measure the object and the room, then do the math.", action:"write", check:{type:"number",answer:null}},
          {text:"Draw your calculation — show the object, the room, and your working out.", hint:"Diagrams make math much clearer!", action:"draw", check:{type:"drawing"}},
          {text:"Explain your method to someone. Could they have done it differently?", hint:"There's often more than one right way to solve a problem.", action:"voice", check:{type:"duration",minMs:3000}}
        ],
        "15+": [
          {text:"Find a real problem in your daily life and think of 3 different solutions.", hint:"No problem is too small to solve creatively.", action:"write", check:{type:"min_words",minWords:20}},
          {text:"Write out the pros and cons of each solution.", hint:"Try to be fair — every solution has tradeoffs.", action:"write", check:{type:"min_words",minWords:25}},
          {text:"Share your analysis. Which solution would you actually use and why?", hint:"Decision-making is a skill you can train.", action:"voice", check:{type:"duration",minMs:4000}}
        ]
      },
      feelings: {
        "4-6": [
          {text:"How do you feel right now? Find a quiet spot and sit with that feeling for 1 minute.", hint:"Just notice it. You don't have to change anything.", action:"voice", check:{type:"duration",minMs:1000}},
          {text:"Draw your feeling as a color, shape, or weather. What does it look like?", hint:"Happy = yellow and round. Sad = blue and heavy. You decide!", action:"draw", check:{type:"drawing"}},
          {text:"Tell someone about your feeling. Today I felt __ because __.", hint:"Naming feelings makes them smaller and easier to handle.", action:"voice", check:{type:"duration",minMs:1500}}
        ],
        "7-9": [
          {text:"When were you last brave? Think of a moment you were scared but did it anyway.", hint:"Big or small — bravery counts either way.", action:"voice", check:{type:"duration",minMs:2000}},
          {text:"Draw or write about that brave moment.", hint:"Show what you were feeling AND what you did.", action:"write", check:{type:"min_words",minWords:10}},
          {text:"Tell someone about your brave moment. How did it feel afterwards?", hint:"Being brave is a superpower you already have.", action:"voice", check:{type:"duration",minMs:2000}}
        ],
        "10-15": [
          {text:"Think about a time you helped someone. How did it feel?", hint:"Helping others often helps us feel better too.", action:"write", check:{type:"min_words",minWords:10}},
          {text:"Write about that moment — what happened, how you helped, how you felt.", hint:"Be specific — the details matter.", action:"write", check:{type:"min_words",minWords:20}},
          {text:"Share your story. Would you do it again? What would you do differently?", hint:"Reflecting on kindness makes it grow.", action:"voice", check:{type:"duration",minMs:3000}}
        ],
        "15+": [
          {text:"Sit quietly for 3 minutes and just notice what you're feeling right now.", hint:"No judgment. No fixing. Just observing.", action:"voice", check:{type:"duration",minMs:2000}},
          {text:"Write 3 things that are going well right now — even on a hard day.", hint:"Gratitude changes perspective.", action:"write", check:{type:"min_words",minWords:15}},
          {text:"Share one of those things with someone. Or write about why it matters to you.", hint:"Connection is one of the best things we can offer each other.", action:"write", check:{type:"min_words",minWords:20}}
        ]
      },
      arts: {
        "4-6": [
          {text:"Go outside or open a window. Find 3 different sounds in the world around you.", hint:"Nature, people, machines — all music if you listen right.", action:"voice", check:{type:"duration",minMs:1000}},
          {text:"Create something inspired by those sounds — a drawing, a rhythm, or a pattern.", hint:"There's no wrong way to turn sound into art!", action:"draw", check:{type:"drawing"}},
          {text:"Share your creation. Explain the sounds that inspired it.", hint:"You just made art from nothing. That's real.", action:"voice", check:{type:"duration",minMs:1500}}
        ],
        "7-9": [
          {text:"Look around you — find something beautiful that most people ignore.", hint:"A shadow, a texture, a color combination — anything works.", action:"photo", check:{type:"exists"}},
          {text:"Draw, photograph, or recreate what you found.", hint:"Try to capture WHY it's beautiful to you.", action:"draw", check:{type:"drawing"}},
          {text:"Show your work and explain: why is this beautiful?", hint:"Art is about seeing, not just making.", action:"voice", check:{type:"duration",minMs:2000}}
        ],
        "10-15": [
          {text:"Pick a feeling you've had recently. What song, color, or texture does it remind you of?", hint:"Emotions and art are deeply connected.", action:"write", check:{type:"min_words",minWords:10}},
          {text:"Create something that expresses that feeling — any medium you like.", hint:"Drawing, writing, music, movement — all valid.", action:"draw", check:{type:"drawing"}},
          {text:"Share your creation. What did making it feel like?", hint:"The process matters as much as the result.", action:"voice", check:{type:"duration",minMs:3000}}
        ],
        "15+": [
          {text:"Find a piece of art — music, painting, poem, film — that moves you. Why?", hint:"Doesn't have to be 'important' art. Just something that hits you.", action:"write", check:{type:"min_words",minWords:15}},
          {text:"Write about it — what does it make you feel, think, remember?", hint:"There are no wrong answers in personal response to art.", action:"write", check:{type:"min_words",minWords:25}},
          {text:"Share it with someone and explain why it matters to you.", hint:"Sharing art you love is an act of intimacy.", action:"voice", check:{type:"duration",minMs:4000}}
        ]
      },
      world: {
        "4-6": [
          {text:"Cook or bake something simple with a grown-up today.", hint:"A sandwich, a cake, some cookies — anything counts!", action:"photo", check:{type:"exists"}},
          {text:"Draw what you made together.", hint:"Show all the ingredients and the finished thing!", action:"draw", check:{type:"drawing"}},
          {text:"Tell someone: what was your job in the cooking? What was the best part?", hint:"You're a chef!", action:"voice", check:{type:"duration",minMs:1500}}
        ],
        "7-9": [
          {text:"Pick a country you've never visited. Find one surprising fact about it.", hint:"Something about food, nature, traditions, or language.", action:"write", check:{type:"min_words",minWords:5}},
          {text:"Draw its flag, a famous place, or a traditional food from that country.", hint:"Make it colorful and detailed!", action:"draw", check:{type:"drawing"}},
          {text:"Tell someone your fact. Would you ever want to visit?", hint:"Curiosity about the world is how travelers are made.", action:"voice", check:{type:"duration",minMs:2000}}
        ],
        "10-15": [
          {text:"Interview someone older than you about their childhood.", hint:"Grandparents, parents, neighbours — anyone works!", action:"voice", check:{type:"duration",minMs:3000}},
          {text:"Write down the most interesting thing they told you.", hint:"Try to capture their exact words if you can.", action:"write", check:{type:"min_words",minWords:20}},
          {text:"Share the story. What surprised you most about their life?", hint:"Every person is a library of experiences.", action:"voice", check:{type:"duration",minMs:3000}}
        ],
        "15+": [
          {text:"Make something with your hands today — cook, fix, build, create — without instructions.", hint:"The best skills come from doing, not watching.", action:"photo", check:{type:"exists"}},
          {text:"Document what you made — photo, drawing, or written description.", hint:"Capture the process, not just the result.", action:"write", check:{type:"min_words",minWords:20}},
          {text:"Share what you learned. What would you do differently next time?", hint:"Every attempt teaches something.", action:"voice", check:{type:"duration",minMs:4000}}
        ]
      }
    },
    // Badge levels per world (7 levels: 0,10,20,30,40,50,100)
    badgeLevels: {
      nature:   [{e:"🌰",n:"Seed",lvl:0},{e:"🌱",n:"Sprout",lvl:1},{e:"🌿",n:"Explorer",lvl:2},{e:"🌳",n:"Nature Keeper",lvl:3},{e:"🦋",n:"Naturalist",lvl:4},{e:"🌍",n:"Guardian",lvl:5},{e:"🧙",n:"Nature Sage",lvl:6}],
      language: [{e:"📖",n:"Reader",lvl:0},{e:"✏️",n:"Writer",lvl:1},{e:"🗣️",n:"Speaker",lvl:2},{e:"📝",n:"Word Master",lvl:3},{e:"🌍",n:"Linguist",lvl:4},{e:"🎭",n:"Storyteller",lvl:5},{e:"👑",n:"Language Legend",lvl:6}],
      logic:    [{e:"🔢",n:"Counter",lvl:0},{e:"🧩",n:"Puzzler",lvl:1},{e:"🔍",n:"Detective",lvl:2},{e:"📐",n:"Mathematician",lvl:3},{e:"⚙️",n:"Engineer",lvl:4},{e:"🧠",n:"Genius",lvl:5},{e:"👑",n:"Logic Master",lvl:6}],
      feelings: [{e:"💭",n:"Dreamer",lvl:0},{e:"💛",n:"Feeler",lvl:1},{e:"🤝",n:"Friend",lvl:2},{e:"🧘",n:"Calm Mind",lvl:3},{e:"🦸",n:"Brave Heart",lvl:4},{e:"🌈",n:"Empath",lvl:5},{e:"👑",n:"Wise Soul",lvl:6}],
      arts:     [{e:"✏️",n:"Doodler",lvl:0},{e:"🎨",n:"Artist",lvl:1},{e:"🎵",n:"Musician",lvl:2},{e:"🖌️",n:"Creator",lvl:3},{e:"🎭",n:"Performer",lvl:4},{e:"💎",n:"Visionary",lvl:5},{e:"👑",n:"Art Legend",lvl:6}],
      world:    [{e:"🗺️",n:"Curious One",lvl:0},{e:"🧭",n:"Explorer",lvl:1},{e:"🍎",n:"Chef",lvl:2},{e:"📸",n:"Journalist",lvl:3},{e:"🏛️",n:"Culture Keeper",lvl:4},{e:"🌏",n:"World Citizen",lvl:5},{e:"👑",n:"Global Legend",lvl:6}]
    },
    // Task thresholds for badge levels
    badgeThresholds: [0, 10, 20, 30, 40, 50, 100],
    // Streak badges
    streakBadges: [
      {days:3,  e:"🌿", desc:"3 days in a row"},
      {days:7,  e:"🌟", desc:"7 days — 1 week!"},
      {days:14, e:"🔥", desc:"14 days — 2 weeks!"},
      {days:30, e:"🏆", desc:"30 days — 1 month!"},
      {days:60, e:"💎", desc:"60 days — 2 months!"},
      {days:100,e:"👑", desc:"100 days — legend!"}
    ],
    // Profile titles based on total tasks
    profileTitles: [
      {min:0,   title:""},
      {min:10,  title:"Adventurer"},
      {min:30,  title:"Explorer"},
      {min:60,  title:"Pathfinder"},
      {min:100, title:"Champion"},
      {min:200, title:"Legend"},
      {min:365, title:"Sage"}
    ]
  },

  // ─── CZECH ───
  cs: {
    tagline: "Každý den jedno dobrodružství 🌿",
    ob_name: "Tvoje jméno", ob_av: "Vyber si avatara",
    ob_age: "Kolik ti je let?", ob_start: "Jdeme na to! 🌱",
    ob_placeholder: "Zadej své jméno...",
    ps_title: "Kdo hraje?", ps_sub: "Vyber svůj profil",
    ps_add: "+ Přidat profil", settings: "Nastavení",
    map_new: "Nová výzva!", map_done: "Splněno ✅",
    worlds: {
      nature:   "Příroda",
      language: "Jazyk",
      logic:    "Logika",
      feelings: "Pocity a já",
      arts:     "Umění & hudba",
      world:    "Svět & kultura"
    },
    ch_label: "Dnešní výzva",
    btn_photo: "Vyfotit důkaz",
    btn_draw:  "Nakreslit",
    btn_voice: "Říct nahlas",
    btn_write: "Napsat odpověď",
    draw_label:  "Nakresli svůj důkaz 🎨",
    draw_done:   "✅ Hotovo!",
    write_label: "Napiš svou odpověď ✍️",
    write_done:  "✅ Hotovo!",
    write_hint:  "Napiš alespoň pár slov...",
    bp_title:   "Postup k odznaku",
    step_lbl:   n => `Krok ${n}`,
    step_done_title: "Krok splněn!",
    step_done_sub:   (n, t) => `${n} ze ${t} kroků splněno`,
    next_step:  "Další krok →",
    come_back:  "Vrátit se zítra",
    congrats:      "Výborně!",
    badge_earned:  "Získal/a jsi nový odznak!",
    badge_evolved: "Tvůj odznak se proměnil!",
    continue:      "🌿 Zpět do světa",
    my_badges:    "Moje odznaky",
    streak_title: "🔥 Streak odznaky",
    bb_label:     "Moje odznaky",
    tasks_done:   n => `${n} úkolů splněno`,
    set_title:    "Nastavení",
    ss_lang:      "Jazyk",           ss_lang_lbl:    "Jazyk aplikace",
    ss_profile:   "Profil",          ss_age:         "Věková skupina",
    ss_data:      "Data",            ss_reset:       "Smazat vše",
    ss_name:      "Zobrazené jméno", ss_avatar:      "Avatar",
    ss_family:    "Rodina",          ss_family_code: "Váš rodinný kód",
    ss_family_join:"Připojit se k rodině", ss_join_placeholder: "Zadej rodinný kód...",
    ss_join_btn:  "Připojit",
    stats_title:  "Statistiky",
    stats_total:  "Celkem úkolů",
    stats_streak: "Nejdelší série",
    stats_worlds: "Světů prozkoumáno",
    stats_badges: "Odznaků získáno",
    lb_title:     "Žebříček",
    lb_empty:     "Zatím žádná data — pokračuj!",
    streak_days: d => `${d} ${d===1?'den':d<5?'dny':'dní'}`,
    steps: {
      nature:   [{label:"Pozoruj",   icon:"👁️",type:"photo"},{label:"Nakresli",icon:"🎨",type:"draw" },{label:"Sdílej",   icon:"🗣️",type:"voice"}],
      language: [{label:"Poslouchej",icon:"👂",type:"voice"},{label:"Napiš",   icon:"✍️",type:"write"},{label:"Řekni",    icon:"🗣️",type:"voice"}],
      logic:    [{label:"Najdi",     icon:"🔍",type:"photo"},{label:"Přemýšlej",icon:"🧠",type:"write"},{label:"Vysvětli",icon:"🗣️",type:"voice"}],
      feelings: [{label:"Pocit",     icon:"💛",type:"voice"},{label:"Nakresli",icon:"🎨",type:"draw" },{label:"Sdílej",   icon:"✍️",type:"write"}],
      arts:     [{label:"Poslouchej",icon:"🎵",type:"voice"},{label:"Vytvoř",  icon:"🖌️",type:"draw" },{label:"Ukaž",     icon:"🎭",type:"voice"}],
      world:    [{label:"Objev",     icon:"🔭",type:"photo"},{label:"Vytvoř",  icon:"🍳",type:"draw" },{label:"Vyprávěj", icon:"🗣️",type:"write"}]
    },
    challenges: {
      nature: {
        "4-6": [
          {text:"Jdi ven a najdi 3 různé listy. Podívej se na jejich tvary!", hint:"Každý list je jiný — velký, malý, hladký nebo vrásčitý!", action:"photo", check:{type:"exists"}},
          {text:"Nakresli 3 listy které jsi našel/la. Zkus zachytit jejich opravdový tvar.", hint:"Můžeš je nejdřív obtáhnout na papíře.", action:"draw", check:{type:"drawing"}},
          {text:"Řekni někomu doma kde jsi listy našel/la a co sis všiml/la.", hint:"Ukaž jim i svůj obrázek!", action:"voice", check:{type:"duration",minMs:1500}}
        ],
        "7-9": [
          {text:"Najdi venku živého tvora — hmyz, ptáka nebo žížalu. Pozoruj ho 1 minutu a vyfotič.", hint:"Buď potichu a klidně. Tvorové jsou plaší!", action:"photo", check:{type:"exists"}},
          {text:"Nakresli tvora a napiš 2 věci které jsi o něm zjistil/a.", hint:"Jak se pohyboval? Co dělal?", action:"draw", check:{type:"drawing"}},
          {text:"Řekni někomu co jsi našel/la. Co tě nejvíc překvapilo?", hint:"Ukaž fotku i obrázek!", action:"voice", check:{type:"duration",minMs:2000}}
        ],
        "10-15": [
          {text:"Najdi strom nebo rostlinu poblíž. Vyfotič ji a zkus zjistit její název.", hint:"Aplikace na rostliny, knihy nebo zeptej se — vše platí.", action:"photo", check:{type:"exists"}},
          {text:"Nakresli listy a zapiš 3 věci které jsi o rostlině zjistil/a.", hint:"Kde roste, jaká zvířata ji využívají, je vzácná?", action:"write", check:{type:"min_words",minWords:15}},
          {text:"Vysvětli někomu proč je tato rostlina zajímavá. Uč ho!", hint:"Teď jsi ty odborník!", action:"voice", check:{type:"duration",minMs:3000}}
        ],
        "15+": [
          {text:"Jdi ven bez telefonu na 15 minut. Věnuj pozornost tomu co obvykle přecházíš.", hint:"Zpomal. Svět má detaily které každý den míjíme.", action:"photo", check:{type:"exists"}},
          {text:"Nakresli nebo zapiš o nejzajímavější věci které sis všiml/a.", hint:"Bez hodnocení — jen pozoruj a zachyť.", action:"write", check:{type:"min_words",minWords:20}},
          {text:"Sdílej své pozorování s někým. Jaký příběh tato malá věc vypráví?", hint:"I prasklina ve zdi má svůj příběh.", action:"voice", check:{type:"duration",minMs:4000}}
        ]
      },
      language: {
        "4-6": [
          {text:"Poslouchej pozorně — jaké 3 zvuky teď slyšíš?", hint:"Vítr? Ptáci? Hudba? Někdo mluví?", action:"draw", check:{type:"drawing"}},
          {text:"Nakresli tyto 3 zvuky jako obrázky. Jak vypadá zvuk?", hint:"Žádná špatná odpověď neexistuje — buď kreativní!", action:"draw", check:{type:"drawing"}},
          {text:"Zahraj každý zvuk hlasem nebo tělem. Uhádne někdo co to je?", hint:"Tohle je tvůj zvukový koncert!", action:"voice", check:{type:"duration",minMs:1500}}
        ],
        "7-9": [
          {text:"Řekni 'děkuji' v 5 různých jazycích. Zjisti jak to zní!", hint:"Zeptej se, použij knihu nebo si vzpomeň z filmů.", action:"voice", check:{type:"duration",minMs:2000}},
          {text:"Napiš všech 5 způsobů jak říct 'děkuji' a nakresli vlajku vedle každého.", hint:"Gracias, Merci, Danke, Спасибо, ありがとう...", action:"write", check:{type:"keywords",keywords:["gracias","merci","danke","спасибо","arigato","děkuji","dzięki","obrigado","shukran"],minMatch:3}},
          {text:"Nauč tato slova někoho doma. Zopakuje je všechna?", hint:"Dnes jsi ty jazykový učitel!", action:"voice", check:{type:"duration",minMs:2000}}
        ],
        "10-15": [
          {text:"Vyber jazyk který tě zajímá. Najdi 5 frází a nauč se je říct nahlas.", hint:"Soustřeď se na výslovnost — nahraj sebe jak zkouší.", action:"voice", check:{type:"duration",minMs:3000}},
          {text:"Napiš 5 frází a přidej kresbu nebo symbol ke každé z nich.", hint:"Vizuální paměť pomáhá — spoj slovo s obrazem.", action:"write", check:{type:"min_words",minWords:10}},
          {text:"Předveď fráze někomu. Zkus co nejlepší přízvuk!", hint:"Smát se při učení vlastně pomáhá.", action:"voice", check:{type:"duration",minMs:3000}}
        ],
        "15+": [
          {text:"Najdi píseň, báseň nebo citát v jazyce který neovládáš. Poslechni si ho.", hint:"Jaké emoce nese i bez porozumění?", action:"voice", check:{type:"duration",minMs:2000}},
          {text:"Zapiš co si myslíš že to znamená — jen ze zvuku a pocitu.", hint:"Důvěřuj intuici. Jazyk je také hudba.", action:"write", check:{type:"min_words",minWords:20}},
          {text:"Najdi skutečný překlad. Co tě překvapilo? Sdílej svou reakci.", hint:"Všimni si rozdílu mezi pocitem a významem.", action:"write", check:{type:"min_words",minWords:20}}
        ]
      },
      logic: {
        "4-6": [
          {text:"Najdi doma 5 věcí různé velikosti. Seřaď od nejmenší po největší!", hint:"Najdeš něco menšího než nehet?", action:"photo", check:{type:"exists"}},
          {text:"Nakresli 5 věcí v řadě s popiskami jejich velikostí.", hint:"Zkus je nakreslit v poměru — větší věci nakresli větší.", action:"draw", check:{type:"drawing"}},
          {text:"Vysvětli svou logiku: jak jsi rozhodl/a o pořadí?", hint:"Bylo něco těžké porovnat?", action:"voice", check:{type:"duration",minMs:1500}}
        ],
        "7-9": [
          {text:"Spočítej všechna okna v bytě. Kolik jich je na každé straně?", hint:"Místnost po místnosti.", action:"write", check:{type:"number",answer:null}},
          {text:"Nakresli jednoduchý plán bytu se všemi okny.", hint:"Pohled shora — jako ptáček.", action:"draw", check:{type:"drawing"}},
          {text:"Vysvětli někomu: co bylo nejtěžší zjistit?", hint:"Mluvit o logice pomáhá ji pochopit lépe.", action:"voice", check:{type:"duration",minMs:2000}}
        ],
        "10-15": [
          {text:"Vyber si předmět a odhadni kolik kusů by se vešlo do tvého pokoje. Pak to spočítej.", hint:"Změř předmět i pokoj, pak počítej.", action:"write", check:{type:"number",answer:null}},
          {text:"Nakresli svůj výpočet — předmět, pokoj a postup.", hint:"Diagramy dělají matematiku mnohem jasnější!", action:"draw", check:{type:"drawing"}},
          {text:"Vysvětli svou metodu někomu. Šlo by to udělat jinak?", hint:"Problém má často víc správných řešení.", action:"voice", check:{type:"duration",minMs:3000}}
        ],
        "15+": [
          {text:"Najdi skutečný problém ve svém životě a vymysli 3 různá řešení.", hint:"Žádný problém není příliš malý.", action:"write", check:{type:"min_words",minWords:20}},
          {text:"Zapiš výhody a nevýhody každého řešení.", hint:"Buď spravedlivý — každé řešení má kompromisy.", action:"write", check:{type:"min_words",minWords:25}},
          {text:"Sdílej svou analýzu. Které řešení bys opravdu použil/a a proč?", hint:"Rozhodování je dovednost kterou lze trénovat.", action:"voice", check:{type:"duration",minMs:4000}}
        ]
      },
      feelings: {
        "4-6": [
          {text:"Jak se teď cítíš? Najdi klidné místo a chvíli jen seď s tímto pocitem.", hint:"Jen si ho všimni. Nemusíš nic měnit.", action:"voice", check:{type:"duration",minMs:1000}},
          {text:"Nakresli svůj pocit jako barvu, tvar nebo počasí. Jak vypadá?", hint:"Radost = žlutá a kulatá. Smutek = modrý a těžký. Ty rozhoduješ!", action:"draw", check:{type:"drawing"}},
          {text:"Řekni někomu o svém pocitu. Dnes jsem cítil/a __ protože __.", hint:"Pojmenování pocitů je zmenšuje a usnadňuje zvládání.", action:"voice", check:{type:"duration",minMs:1500}}
        ],
        "7-9": [
          {text:"Kdy jsi byl/a naposledy odvážný/á? Vzpomeň si na moment kdy jsi měl/a strach ale udělal/a jsi to přesto.", hint:"Malá odvaha je také odvaha.", action:"voice", check:{type:"duration",minMs:2000}},
          {text:"Nakresli nebo napiš o tom odvážném momentu.", hint:"Ukaž co jsi cítil/a i co jsi udělal/a.", action:"write", check:{type:"min_words",minWords:10}},
          {text:"Řekni někomu o svém odvážném momentu. Jak ses cítil/a potom?", hint:"Odvaha je superschopnost kterou už máš.", action:"voice", check:{type:"duration",minMs:2000}}
        ],
        "10-15": [
          {text:"Vzpomeň si na situaci kdy jsi někomu pomohl/a. Jak ses cítil/a?", hint:"Pomáhat druhým pomáhá i nám.", action:"write", check:{type:"min_words",minWords:10}},
          {text:"Napiš o tom momentu — co se stalo, jak jsi pomohl/a, jak ses cítil/a.", hint:"Buď konkrétní — detaily jsou důležité.", action:"write", check:{type:"min_words",minWords:20}},
          {text:"Sdílej svůj příběh. Udělal/a bys to znovu? Co bys udělal/a jinak?", hint:"Přemýšlet o laskavosti ji pomáhá růst.", action:"voice", check:{type:"duration",minMs:3000}}
        ],
        "15+": [
          {text:"Seď tiše 3 minuty a jen si všímej co teď cítíš.", hint:"Bez hodnocení. Bez opravování. Jen pozorování.", action:"voice", check:{type:"duration",minMs:2000}},
          {text:"Zapiš 3 věci které jsou právě teď v pořádku — i kdyby byl den těžký.", hint:"Vděčnost mění perspektivu.", action:"write", check:{type:"min_words",minWords:15}},
          {text:"Sdílej jednu z těch věcí s někým. Nebo napiš proč na tobě záleží.", hint:"Propojení je jedna z nejlepších věcí které si můžeme nabídnout.", action:"write", check:{type:"min_words",minWords:20}}
        ]
      },
      arts: {
        "4-6": [
          {text:"Jdi ven nebo otevři okno. Najdi 3 různé zvuky ve světě kolem tebe.", hint:"Příroda, lidé, stroje — všechno je hudba, když správně posloucháš.", action:"voice", check:{type:"duration",minMs:1000}},
          {text:"Vytvoř něco inspirované těmito zvuky — kresbu, rytmus nebo vzor.", hint:"Neexistuje špatný způsob jak přetavit zvuk v umění!", action:"draw", check:{type:"drawing"}},
          {text:"Sdílej svou tvorbu. Vysvětli zvuky které tě inspirovaly.", hint:"Právě jsi vytvořil/a umění z ničeho. To je skutečné.", action:"voice", check:{type:"duration",minMs:1500}}
        ],
        "7-9": [
          {text:"Podívej se kolem sebe — najdi něco krásného co většina lidí přehlíží.", hint:"Stín, textura, kombinace barev — cokoliv funguje.", action:"photo", check:{type:"exists"}},
          {text:"Nakresli, vyfotič nebo znovu vytvoř co jsi našel/la.", hint:"Zkus zachytit PROČ je to pro tebe krásné.", action:"draw", check:{type:"drawing"}},
          {text:"Ukaž svou práci a vysvětli: proč je to krásné?", hint:"Umění je o vidění, nejen o tvoření.", action:"voice", check:{type:"duration",minMs:2000}}
        ],
        "10-15": [
          {text:"Vyber pocit který jsi nedávno zažil/a. Jaká píseň, barva nebo textura ti ho připomíná?", hint:"Emoce a umění jsou hluboce propojeny.", action:"write", check:{type:"min_words",minWords:10}},
          {text:"Vytvoř něco co vyjadřuje tento pocit — jakýkoliv médium které chceš.", hint:"Kresba, psaní, hudba, pohyb — vše je platné.", action:"draw", check:{type:"drawing"}},
          {text:"Sdílej svou tvorbu. Jak se cítilo dělat ji?", hint:"Proces je stejně důležitý jako výsledek.", action:"voice", check:{type:"duration",minMs:3000}}
        ],
        "15+": [
          {text:"Najdi umělecké dílo — hudbu, obraz, báseň, film — které tě zasáhne. Proč?", hint:"Nemusí to být 'důležité' umění. Prostě něco co tě chytne.", action:"write", check:{type:"min_words",minWords:15}},
          {text:"Napiš o tom — co cítíš, přemýšlíš, vzpomínáš?", hint:"V osobní reakci na umění neexistují špatné odpovědi.", action:"write", check:{type:"min_words",minWords:25}},
          {text:"Sdílej to s někým a vysvětli proč ti na tom záleží.", hint:"Sdílení umění které miluješ je akt intimity.", action:"voice", check:{type:"duration",minMs:4000}}
        ]
      },
      world: {
        "4-6": [
          {text:"Uvař nebo upeč dnes s někým dospělým něco jednoduchého.", hint:"Sendvič, koláč, sušenky — cokoliv!", action:"photo", check:{type:"exists"}},
          {text:"Nakresli co jste spolu vytvořili.", hint:"Ukaž všechny ingredience i hotovou věc!", action:"draw", check:{type:"drawing"}},
          {text:"Řekni někomu: jaká byla tvoje práce při vaření? Co bylo nejlepší?", hint:"Jsi šéfkuchař!", action:"voice", check:{type:"duration",minMs:1500}}
        ],
        "7-9": [
          {text:"Vyber zemi ve které jsi nikdy nebyl/a. Najdi o ní jeden překvapující fakt.", hint:"Něco o jídle, přírodě, tradici nebo jazyce.", action:"write", check:{type:"min_words",minWords:5}},
          {text:"Nakresli vlajku, slavné místo nebo tradiční jídlo z té země.", hint:"Udělej to barevné a detailní!", action:"draw", check:{type:"drawing"}},
          {text:"Řekni někomu svůj fakt. Chtěl/a bys tuto zemi navštívit?", hint:"Zvědavost na svět je základ každého cestovatele.", action:"voice", check:{type:"duration",minMs:2000}}
        ],
        "10-15": [
          {text:"Udělej rozhovor s někým starším o jeho dětství.", hint:"Prarodiče, rodiče, sousedi — kdokoliv.", action:"voice", check:{type:"duration",minMs:3000}},
          {text:"Zapiš nejzajímavější věc co ti řekl/a.", hint:"Zkus zachytit jeho přesná slova.", action:"write", check:{type:"min_words",minWords:20}},
          {text:"Sdílej příběh. Co tě na jeho životě nejvíc překvapilo?", hint:"Každý člověk je knihovna zkušeností.", action:"voice", check:{type:"duration",minMs:3000}}
        ],
        "15+": [
          {text:"Udělej dnes něco rukama — uvař, oprav, postav, vytvoř — bez návodu.", hint:"Nejlepší dovednosti se rodí praxí, ne sledováním.", action:"photo", check:{type:"exists"}},
          {text:"Zdokumentuj co jsi udělal/a — fotka, kresba nebo popis.", hint:"Zachyť proces, nejen výsledek.", action:"write", check:{type:"min_words",minWords:20}},
          {text:"Sdílej co ses naučil/a. Co bys udělal/a příště jinak?", hint:"Každý pokus něco učí.", action:"voice", check:{type:"duration",minMs:4000}}
        ]
      }
    },
    badgeLevels: {
      nature:   [{e:"🌰",n:"Semínko",lvl:0},{e:"🌱",n:"Výhonek",lvl:1},{e:"🌿",n:"Průzkumník",lvl:2},{e:"🌳",n:"Strážce přírody",lvl:3},{e:"🦋",n:"Přírodovědec",lvl:4},{e:"🌍",n:"Ochránce",lvl:5},{e:"🧙",n:"Mudrc přírody",lvl:6}],
      language: [{e:"📖",n:"Čtenář",lvl:0},{e:"✏️",n:"Pisatel",lvl:1},{e:"🗣️",n:"Mluvčí",lvl:2},{e:"📝",n:"Mistr slov",lvl:3},{e:"🌍",n:"Lingvista",lvl:4},{e:"🎭",n:"Vypravěč",lvl:5},{e:"👑",n:"Jazyková legenda",lvl:6}],
      logic:    [{e:"🔢",n:"Počítač",lvl:0},{e:"🧩",n:"Hádankář",lvl:1},{e:"🔍",n:"Detektiv",lvl:2},{e:"📐",n:"Matematik",lvl:3},{e:"⚙️",n:"Inženýr",lvl:4},{e:"🧠",n:"Génius",lvl:5},{e:"👑",n:"Mistr logiky",lvl:6}],
      feelings: [{e:"💭",n:"Snílek",lvl:0},{e:"💛",n:"Cítič",lvl:1},{e:"🤝",n:"Kamarád",lvl:2},{e:"🧘",n:"Klidná mysl",lvl:3},{e:"🦸",n:"Odvážné srdce",lvl:4},{e:"🌈",n:"Empatik",lvl:5},{e:"👑",n:"Moudrá duše",lvl:6}],
      arts:     [{e:"✏️",n:"Čmáralka",lvl:0},{e:"🎨",n:"Umělec",lvl:1},{e:"🎵",n:"Muzikant",lvl:2},{e:"🖌️",n:"Tvůrce",lvl:3},{e:"🎭",n:"Performer",lvl:4},{e:"💎",n:"Vizionář",lvl:5},{e:"👑",n:"Umělecká legenda",lvl:6}],
      world:    [{e:"🗺️",n:"Zvídavý",lvl:0},{e:"🧭",n:"Průzkumník",lvl:1},{e:"🍎",n:"Kuchař",lvl:2},{e:"📸",n:"Novinář",lvl:3},{e:"🏛️",n:"Strážce kultury",lvl:4},{e:"🌏",n:"Světoobčan",lvl:5},{e:"👑",n:"Světová legenda",lvl:6}]
    },
    badgeThresholds: [0, 10, 20, 30, 40, 50, 100],
    streakBadges: [
      {days:3,  e:"🌿", desc:"3 dny v řadě"},
      {days:7,  e:"🌟", desc:"7 dní — celý týden!"},
      {days:14, e:"🔥", desc:"14 dní — 2 týdny!"},
      {days:30, e:"🏆", desc:"30 dní — celý měsíc!"},
      {days:60, e:"💎", desc:"60 dní — 2 měsíce!"},
      {days:100,e:"👑", desc:"100 dní — legenda!"}
    ],
    profileTitles: [
      {min:0,   title:""},
      {min:10,  title:"Dobroduh"},
      {min:30,  title:"Průzkumník"},
      {min:60,  title:"Stopař"},
      {min:100, title:"Šampion"},
      {min:200, title:"Legenda"},
      {min:365, title:"Mudrc"}
    ]
  }
};

export function getLang() {
  return localStorage.getItem('gream_lang') || 'en';
}
export function setLang(l) {
  localStorage.setItem('gream_lang', l);
}
export function tr() {
  return T[getLang()] || T.en;
}
