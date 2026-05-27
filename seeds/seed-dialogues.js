/**
 * seed-dialogues.js
 * Dialogue data for Lampara (El Filibusterismo)
 * Used by POST /api/quests/import-dialogues endpoint
 */

// ============================================================
// QUEST TITLE & DESCRIPTION UPDATES
// ============================================================
const QUEST_UPDATES = [
  // MQ 1: The Mask of Simoun
  { id: 1, title: 'The Divided Steamer', description: 'Based on El Fili Ch.I-II. Setting: The steamer Tabo on the Pasig River.' },
  { id: 2, title: 'Legends and Land', description: 'Based on El Fili Ch.III-IV. Setting: The steamer Tabo, with the story of Cabesang Tales.' },
  { id: 3, title: 'Christmas Eve in San Diego', description: 'Based on El Fili Ch.V-VI. Setting: San Diego during Christmas Eve.' },
  { id: 4, title: 'The Man Behind the Goggles', description: 'Based on El Fili Ch.VII-VIII. Setting: The forest near Basilio\'s mother\'s grave.' },
  
  // MQ 2: Power and Education
  { id: 6, title: 'Blame and Blood', description: 'Based on El Fili Ch.IX-X. Setting: Cabesang Tales\' story of injustice continues.' },
  { id: 7, title: 'Power and the Student', description: 'Based on El Fili Ch.XI-XII. Setting: Los Baños and the University.' },
  { id: 8, title: 'The Humiliation of Learning', description: 'Based on El Fili Ch.XIII-XIV. Setting: The University physics class and students\' gathering.' },
  { id: 9, title: 'Cowardice and Conspiracy', description: 'Based on El Fili Ch.XV-XVI. Setting: Señor Pasta\'s office and Quiroga\'s house.' },
  
  // MQ 3: The Fuse is Lit
  { id: 11, title: 'The Fair and the Talking Head', description: 'Based on El Fili Ch.XVII-XVIII. Setting: Quiapo Fair and Mr. Leeds\' exhibit.' },
  { id: 12, title: 'The Spark Beneath Manila', description: 'Based on El Fili Ch.XIX-XX. Setting: Manila streets, Placido, and Don Custodio\'s decision.' },
  { id: 13, title: 'Masks at the Theater', description: 'Based on El Fili Ch.XXI-XXII. Setting: Manila theater and social scene.' },
  { id: 14, title: 'Death and Dreams', description: 'Based on El Fili Ch.XXIII-XXIV. Setting: Simoun\'s plot and Maria Clara.' },

  // MQ 4: Collapse and Consequences
  { id: 16, title: 'Laughter Before the Arrests', description: 'Based on El Fili Ch.XXV-XXVI. Setting: The students\' banquet and the pasquinades.' },
  { id: 17, title: 'The Friar and the Fear', description: 'Based on El Fili Ch.XXVII-XXVIII. Setting: Padre Fernandez and the city\'s panic.' },
  { id: 18, title: 'Death Reaches Tiani', description: 'Based on El Fili Ch.XXIX-XXX. Setting: Capitan Tiago\'s death and Juli\'s tragedy.' },
  { id: 19, title: 'The Innocent Sacrifice', description: 'Based on El Fili Ch.XXXI-XXXII. Setting: The aftermath of Juli and the student arrests.' },

  // MQ 5: The Lamp Conspiracy
  { id: 21, title: 'The Final Argument', description: 'Based on El Fili Ch.XXXIII-XXXIV. Setting: Simoun\'s final preparations and the wedding feast.' },
  { id: 22, title: 'The Lamp of Death', description: 'Based on El Fili Ch.XXXV-XXXVI. Setting: The fiesta, the lamp, and Isagani\'s intervention.' },

  // MQ 6: The Fall of Simoun
  { id: 26, title: 'The Mystery and the Fatal Encounter', description: 'Based on El Fili Ch.XXXVII-XXXVIII. Setting: The discovery of the plot and the shootout.' },

  // MQ 7: Final Boss
  { id: 31, title: 'The End of Simoun', description: 'Based on El Fili Ch.XXXIX. Setting: Padre Florentino\'s house by the sea, the final confession.' }
];

// ============================================================
// ALL DIALOGUE DATA
// ============================================================
const DIALOGUES = [

  // ──────────────────────────────────────────────────────────
  // CHAPTER 1: The Divided Steamer → quest_id 1
  // ──────────────────────────────────────────────────────────
  {
    quest_id: 1, sequence_order: 1, npc_name: 'Ben-Zayb',
    npc_text: 'Doña Victorina:\nThis river is unbearable! The steamer moves like a sick animal.\n\nBen-Zayb:\nPerhaps the Pasig requires a brilliant solution. Señor Simoun, surely a man of your experience has an idea?',
    option_a_text: 'The remedy is simple. Cut a straight canal, close the old river, and remove whatever blocks progress.',
    option_b_text: 'The river must be improved, but only with patience and fairness.',
    option_c_text: 'The river is not the sickness. The sickness is the system ruling this country.',
    context_notes: 'Scene 1: The River Problem'
  },
  {
    quest_id: 1, sequence_order: 2, npc_name: 'Don Custodio',
    npc_text: 'Don Custodio:\nBut Señor Simoun, such a canal would cost a fortune. Towns may be destroyed.',
    option_a_text: 'Then destroy them. Progress does not wait for weak hearts.',
    option_b_text: 'Then perhaps the plan should be changed to protect the towns.',
    option_c_text: 'One day, those towns will learn that the powerful only see them as obstacles.',
    context_notes: 'Scene 2: The Cost of Progress'
  },
  {
    quest_id: 1, sequence_order: 3, npc_name: 'Don Custodio',
    npc_text: 'Don Custodio:\nAnd who would pay the workers for such a project?',
    option_a_text: 'Do not pay them. Use prisoners. If there are not enough, force the townspeople to work for the State.',
    option_b_text: 'They should be paid properly. Labor without pay breeds resentment.',
    option_c_text: 'Let the people feel the cruelty clearly. Pain teaches them who their enemies are.',
    context_notes: 'Scene 3: Forced Labor'
  },
  {
    quest_id: 1, sequence_order: 4, npc_name: 'Padre Salvi',
    npc_text: 'Padre Salvi:\nSuch measures may cause unrest. The people may rebel.',
    option_a_text: 'Rebel? These people will not rise as long as authority remains strong.',
    option_b_text: 'Perhaps unrest is natural when people suffer too much.',
    option_c_text: 'Rebellion only sleeps, Padre. A single spark may wake it.',
    context_notes: 'Scene 4: Fear of Rebellion'
  },
  {
    quest_id: 1, sequence_order: 5, npc_name: 'Basilio',
    npc_text: 'Simoun descends to the lower deck and sees Basilio with Isagani.\n\nSimoun:\nDon Basilio, you are going home for vacation?\n\nBasilio:\nYes, Señor Simoun.\n\nSimoun:\nAnd this young man?\n\nBasilio:\nThis is Isagani.\n\nSimoun looks at Isagani carefully.',
    option_a_text: 'I have heard of your province. Poor, they say. A place that does not buy jewels.',
    option_b_text: 'I have heard your province is proud, even if it has little wealth.',
    option_c_text: 'Poor provinces are made poor because power steals from them.',
    context_notes: 'Scene 5: Meeting Basilio and Isagani'
  },
  {
    quest_id: 1, sequence_order: 6, npc_name: 'Isagani',
    npc_text: 'Simoun:\nCome. Drink beer with me.\n\nBasilio:\nThank you, Señor, but we must decline.\n\nSimoun:\nYou do wrong. Beer gives strength. Perhaps this country lacks energy because its people drink too much water.\n\nIsagani:\nWater may seem mild, but it can become steam, ocean, and destruction.',
    option_a_text: 'A clever answer. But tell me, young man, when will your water become steam?',
    option_b_text: 'You speak with courage. Perhaps the youth still has strength after all.',
    option_c_text: 'Soon, perhaps. When the fire beneath this country becomes hot enough.',
    context_notes: 'Scene 6: The Water and Beer Exchange'
  },

  // ──────────────────────────────────────────────────────────
  // CHAPTER 2: Legends and Land → quest_id 2
  // ──────────────────────────────────────────────────────────
  {
    quest_id: 2, sequence_order: 1, npc_name: 'Ben-Zayb',
    npc_text: 'Don Custodio:\nSeñor Simoun, where have you been hiding? You missed the finest part of the journey.\n\nCaptain:\nThe river has many stories, señor. Some places here are remembered because of old legends.\n\nBen-Zayb:\nLegends? That may interest our jeweler. Señor Simoun, do such things amuse you?',
    option_a_text: 'I have seen many rivers and many landscapes. Only those with legends still interest me.',
    option_b_text: 'A river is only water. I have no patience for old stories.',
    option_c_text: 'Legends matter because they hide the crimes of those who rule.',
    context_notes: 'Scene 1: The Legend Question'
  },
  {
    quest_id: 2, sequence_order: 2, npc_name: 'Ben-Zayb',
    npc_text: 'Captain:\nThere is also the cave of Doña Geronima. Padre Florentino can tell it better than I can.\n\nPadre Florentino:\nIt is an old story of a woman who waited, suffered, and was hidden away. Time turned her sorrow into legend.\n\nBen-Zayb:\nA tragic tale. Señor Simoun, what do you think of it?',
    option_a_text: 'A curious tale. People often decorate misery until it sounds like poetry.',
    option_b_text: 'Poor woman. Those with power should have protected her.',
    option_c_text: 'Powerful men bury women, truth, and nations in caves.',
    context_notes: 'Scene 2: Doña Geronima\'s Cave'
  },
  {
    quest_id: 2, sequence_order: 3, npc_name: 'Ben-Zayb',
    npc_text: 'Ben-Zayb:\nCaptain, do you know where that man died? What was his name? Guevara? Navarra? Ibarra?\n\nCaptain:\nIbarra was chased near the lake. They say he jumped from the boat, swam through bullets, and disappeared. That happened thirteen years ago.\n\nPadre Sibyla:\nA fitting end for a filibuster.\n\nBen-Zayb:\nBut Señor Simoun, you are silent. Are you seasick in this little lake?',
    option_a_text: 'Seasick? No. I am merely tired of stories about dead filibusters.',
    option_b_text: 'It is a cruel story, even for a man accused of rebellion.',
    option_c_text: 'Dead? You speak too surely of a man whose body was never found.',
    context_notes: 'Scene 3: The Name of Ibarra'
  },
  {
    quest_id: 2, sequence_order: 4, npc_name: 'Passenger',
    npc_text: 'Passenger:\nHave you heard of Cabesang Tales? He cleared wild land with his own hands. But when the land became useful, the friars claimed it and raised the rent.\n\nDon Custodio:\nA tenant must obey the lawful owners.\n\nPassenger:\nThe rent kept rising. When it reached two hundred pesos, Tales refused to pay.',
    option_a_text: 'If he cannot pay, give the land to someone who can. Sentiment is poor currency.',
    option_b_text: 'A man who cleared the land deserves mercy.',
    option_c_text: 'When justice is denied, a man may take back his land with blood.',
    context_notes: 'Scene 4: Rumors of Cabesang Tales'
  },
  {
    quest_id: 2, sequence_order: 5, npc_name: 'Don Custodio',
    npc_text: 'Passenger:\nCabesang Tales asked the friars to show proof that the land was truly theirs.\n\nPadre Salvi:\nQuestioning authority is dangerous.\n\nDon Custodio:\nSuch men invite trouble upon themselves.',
    option_a_text: 'Dangerous indeed. A man without power should not test those above him.',
    option_b_text: 'Perhaps asking for proof is not rebellion.',
    option_c_text: 'The day peasants ask for proof, the whole rotten order begins to fall.',
    context_notes: 'Scene 5: The Demand for Proof'
  },
  {
    quest_id: 2, sequence_order: 6, npc_name: 'Padre Salvi',
    npc_text: 'Passenger:\nThey say Cabesang Tales was captured by tulisanes while guarding his fields. His daughter Juli and old Tandang Selo must now find money for his ransom.\n\nBen-Zayb:\nDisorder in the provinces again. That could make a fine article.\n\nPadre Salvi:\nThe people must learn obedience, or chaos will spread.',
    option_a_text: 'Then write that weakness invites ruin. Fear keeps the countryside obedient.',
    option_b_text: 'Write that poverty drives people into despair.',
    option_c_text: 'Write that every injustice creates another outlaw.',
    context_notes: 'Scene 6: Tales Is Captured'
  },

  // ──────────────────────────────────────────────────────────
  // CHAPTER 3: Christmas Eve in San Diego → quest_id 3
  // ──────────────────────────────────────────────────────────
  {
    quest_id: 3, sequence_order: 1, npc_name: 'Curate',
    npc_text: 'Inside Capitan Basilio\'s house, food is being prepared for the Christmas feast. Simoun sits confidently with his jewels while the curate, the alferez, and Capitan Basilio speak with him.\n\nCapitan Basilio:\nIt is understood, Señor Simoun. We will go to Tiani to see your jewels.\n\nAlferez:\nI would also go, but I am busy. I need a watch-chain.\n\nCurate:\nAnd I need earrings. First class, of course.',
    option_a_text: 'Then you shall see only the finest. Men of position deserve jewels that show their power.',
    option_b_text: 'Perhaps jewels matter little tonight. The town outside looks poorer than before.',
    option_c_text: 'Gold is useful only when it can buy men and weaken the system from within.',
    context_notes: 'Scene 1: The Feast at Capitan Basilio\'s House'
  },
  {
    quest_id: 3, sequence_order: 2, npc_name: 'Capitan Basilio',
    npc_text: 'Alferez:\nA strong chain would suit me. Something worthy of my rank.\n\nCapitan Basilio:\nDo not worry, Señor Alferez. I can take care of the payment for now.',
    option_a_text: 'A chain for authority must be strong. It should remind others who commands respect.',
    option_b_text: 'I can lower the price. There is no need to burden Capitan Basilio.',
    option_c_text: 'Every chain reminds the people who holds them by the neck.',
    context_notes: 'Scene 2: The Alferez\'s Watch-Chain'
  },
  {
    quest_id: 3, sequence_order: 3, npc_name: 'Capitan Basilio',
    npc_text: 'Curate:\nThe earrings must be beautiful. They are for a lady.\n\nCapitan Basilio:\nOf course, Padre. Do not worry about the account.',
    option_a_text: 'For the Church, only the finest. A gift must shine brighter when it comes from important hands.',
    option_b_text: 'Would it not be better if such money were given to the poor?',
    option_c_text: 'The Church takes from the poor, then calls the payment a holy gift.',
    context_notes: 'Scene 3: The Curate\'s Earrings'
  },
  {
    quest_id: 3, sequence_order: 4, npc_name: 'Alferez',
    npc_text: 'A servant quietly enters and speaks to Capitan Basilio about troubles in the town: workers arrested, carabaos dying, and people becoming poorer.\n\nCapitan Basilio:\nAlways the same complaints. Prisoners, dead animals, failing harvests, rising costs.\n\nAlferez:\nPeople complain too much. Discipline is what they need.',
    option_a_text: 'Property suffers when the people below lack discipline. Fear keeps order better than pity.',
    option_b_text: 'Too much abuse will ruin even the most patient town.',
    option_c_text: 'Every blow from the Civil Guard creates another enemy for the government.',
    context_notes: 'Scene 4: The Suffering Outside'
  },
  {
    quest_id: 3, sequence_order: 5, npc_name: 'Curate',
    npc_text: 'From the street, Basilio sees Simoun inside the house. He is surprised to find the jeweler doing business with the powerful people of San Diego.\n\nCapitan Basilio:\nThat student outside looks like Basilio. He has returned to San Diego for Christmas.\n\nCurate:\nThe medical student? The one connected to Capitan Tiago?',
    option_a_text: 'A useful young man, perhaps. But youth must learn to serve quietly before dreaming too highly.',
    option_b_text: 'He has suffered enough. Let him have peace tonight.',
    option_c_text: 'Suffering students become dangerous when they discover who they truly are.',
    context_notes: 'Scene 5: Basilio Passes Outside'
  },
  {
    quest_id: 3, sequence_order: 6, npc_name: 'Alferez',
    npc_text: 'Capitan Basilio:\nThey say Basilio is close to becoming a doctor. He worked hard for it.\n\nCurate:\nA poor boy rising too far may forget his place.\n\nAlferez:\nAs long as he causes no trouble, let him study.',
    option_a_text: 'Let him chase his quiet future. Quiet men are easier to govern.',
    option_b_text: 'A man who rises through hardship deserves respect.',
    option_c_text: 'A quiet man with buried grief can be sharpened into a weapon.',
    context_notes: 'Scene 6: Basilio\'s Future'
  },

  // ──────────────────────────────────────────────────────────
  // CHAPTER 4: The Man Behind the Goggles → quest_id 4
  // ──────────────────────────────────────────────────────────
  {
    quest_id: 4, sequence_order: 1, npc_name: 'Basilio',
    npc_text: 'In the dark forest, Simoun digs near the old grave. His blue goggles are removed. Basilio steps out from the shadows.\n\nBasilio:\nCan I help you, sir?\n\nSimoun quickly straightens and reaches for his revolver.',
    option_a_text: 'For whom do you take me?',
    option_b_text: 'You should not be here, Basilio. Leave before you regret it.',
    option_c_text: 'So, you have discovered that Simoun is not my true name.',
    context_notes: 'Scene 1: Basilio Discovers Simoun'
  },
  {
    quest_id: 4, sequence_order: 2, npc_name: 'Basilio',
    npc_text: 'Basilio:\nThirteen years ago, in this same place, you helped bury my mother. To me, you are sacred. You are someone the world believes to be dead.\n\nAn uneasy silence follows.',
    option_a_text: 'You hold a secret that can ruin me. For my safety, I should silence you forever. Yet I will let you live.',
    option_b_text: 'If you remember me, then let the past rest. I came only to mourn.',
    option_c_text: 'Yes. I am the man they failed to kill, and I have returned to destroy them all.',
    context_notes: 'Scene 2: The Secret Identity'
  },
  {
    quest_id: 4, sequence_order: 3, npc_name: 'Basilio',
    npc_text: 'Basilio:\nWhy spare me, Señor Simoun? Why trust me with this secret?',
    option_a_text: 'You and I both have debts to settle with society. Your brother was murdered, your mother was driven to madness, and no one paid for it.',
    option_b_text: 'Because revenge will not heal you. Forget what happened and build a peaceful life.',
    option_c_text: 'Because I need men like you when the country begins to burn.',
    context_notes: 'Scene 3: Simoun Tries to Recruit Basilio'
  },
  {
    quest_id: 4, sequence_order: 4, npc_name: 'Basilio',
    npc_text: 'Basilio:\nI do not wish to enter politics. I only want to finish medicine, help the people, and live quietly.',
    option_a_text: 'Then keep your little dream. But when you change your mind, find me at my house in the Escolta.',
    option_b_text: 'That is noble, Basilio. Perhaps quiet service is better than revenge.',
    option_c_text: 'Then you are useless. When the weak perish, do not ask why I did not save you.',
    context_notes: 'Scene 4: Basilio Refuses Revenge'
  },
  {
    quest_id: 4, sequence_order: 5, npc_name: 'Informant',
    npc_text: 'Later, an informant reports to Simoun about Cabesang Tales\' family.\n\nInformant:\nJuli has left her home to enter service. She needs money for her father\'s ransom. Cabesang Tales is still in the hands of the tulisanes.',
    option_a_text: 'Desperation teaches faster than speeches. Watch that family closely.',
    option_b_text: 'Send them money. No daughter should suffer like that.',
    option_c_text: 'Good. Their suffering will become fuel for the uprising.',
    context_notes: 'Scene 5: Report About Juli'
  },
  {
    quest_id: 4, sequence_order: 6, npc_name: 'Informant',
    npc_text: 'Informant:\nOn Christmas morning, Tandang Selo tried to greet his relatives, but no words came out. Grief has made him mute.',
    option_a_text: 'A broken voice can still become a dangerous silence. Continue observing them.',
    option_b_text: 'Tell the town to comfort the old man. He has suffered enough.',
    option_c_text: 'Then give that silence a weapon, and let sorrow speak through blood.',
    context_notes: 'Scene 6: Tandang Selo\'s Silence'
  },

  // ──────────────────────────────────────────────────────────
  // CHAPTER 5: Blame and Blood → quest_id 6
  // ──────────────────────────────────────────────────────────
  {
    quest_id: 6, sequence_order: 1, npc_name: 'Informant',
    npc_text: 'Informant:\nThe town speaks of Cabesang Tales\' tragedy, Señor Simoun. Yet everyone denies responsibility.\n\nInformant:\nThe Civil Guard says they only followed orders. The friar-administrator says he only protected the estate. Sister Penchang says Juli\'s suffering is punishment from heaven.\n\nSimoun remains silent, listening carefully.',
    option_a_text: 'Good. When guilt is divided among many hands, no one fears punishment.',
    option_b_text: 'They should be ashamed. That family deserves justice.',
    option_c_text: 'Let them deny their guilt. One day, the oppressed will make them pay in blood.',
    context_notes: 'Scene 1: Everyone Washes Their Hands'
  },
  {
    quest_id: 6, sequence_order: 2, npc_name: 'Informant',
    npc_text: 'Informant:\nJuli now serves Sister Penchang to raise money for her father\'s ransom.\n\nInformant:\nInstead of comfort, the girl is forced to work, pray, and read religious books.',
    option_a_text: 'Desperation bends people better than chains. Watch her family closely.',
    option_b_text: 'No daughter should suffer for her father\'s misfortune. Help her if possible.',
    option_c_text: 'Every prayer forced upon her will become another reason for revolt.',
    context_notes: 'Scene 2: Juli\'s Servitude'
  },
  {
    quest_id: 6, sequence_order: 3, npc_name: 'Sister Penchang',
    npc_text: 'Capitana Tika:\nSeñor Simoun, your jewels are truly magnificent.\n\nSister Penchang:\nI must see the diamond ring promised for the Virgin of Antipolo.\n\nCabesang Tales watches silently, surrounded by poverty while jewels shine before him.',
    option_a_text: 'Choose carefully. A jewel is not only beauty; it is power held in the palm of the hand.',
    option_b_text: 'Perhaps these jewels are too much for a house filled with sorrow.',
    option_c_text: 'One jewel could save a family, yet the rich wear them while others starve.',
    context_notes: 'Scene 3: The Jewels at Tales\' House'
  },
  {
    quest_id: 6, sequence_order: 4, npc_name: 'Cabesang Tales',
    npc_text: 'Simoun fires his revolver toward a distant palm tree. Cabesang Tales sees its power.\n\nCabesang Tales:\nThe tulisanes have rifles that can reach far.',
    option_a_text: 'This revolver reaches far enough. A steady hand can make one man equal to many.',
    option_b_text: 'Weapons only bring more suffering. It is better not to touch them.',
    option_c_text: 'A weapon in the hand of the oppressed is the first true lesson in justice.',
    context_notes: 'Scene 4: The Revolver'
  },
  {
    quest_id: 6, sequence_order: 5, npc_name: 'Informant',
    npc_text: 'Informant:\nCabesang Tales saw the friar-administrator and the new tenant walking through his fields.\n\nInformant:\nHe said nothing, but his face changed. The land was everything he had left.',
    option_a_text: 'A man who loses land loses fear. Let him decide what price he will pay for it.',
    option_b_text: 'He must calm himself. Anger will only destroy what remains of his family.',
    option_c_text: 'Good. Let his anger ripen. A wounded farmer can become a blade.',
    context_notes: 'Scene 5: Tales\' Rage'
  },
  {
    quest_id: 6, sequence_order: 6, npc_name: 'Servant',
    npc_text: 'Servant:\nSeñor Simoun, the revolver is gone. Cabesang Tales has disappeared.\n\nServant:\nHe left Juli\'s locket in its place.',
    option_a_text: 'A fair exchange. Some men pay with gold. Others pay with what remains of their heart.',
    option_b_text: 'We must report the theft at once.',
    option_c_text: 'At last. The land has given birth to another rebel.',
    context_notes: 'Scene 6: The Missing Revolver'
  },

  // ──────────────────────────────────────────────────────────
  // CHAPTER 6: Power and the Student → quest_id 7
  // ──────────────────────────────────────────────────────────
  {
    quest_id: 7, sequence_order: 1, npc_name: 'Padre Sibyla',
    npc_text: 'Ben-Zayb:\nHis Excellency came to Los Baños for rest, yet papers and petitions still follow him.\n\nPadre Camorra:\nPetitions, petitions! These students want too much.\n\nPadre Sibyla:\nEspecially this request for an academy of Castilian.',
    option_a_text: 'Students ask because they are encouraged to ask. Deny them too quickly, and they will ask louder.',
    option_b_text: 'Perhaps the students only want education. That should not frighten anyone.',
    option_c_text: 'Deny them. Let their disappointment become the spark they need.',
    context_notes: 'Scene 1: The Captain-General\'s Rest'
  },
  {
    quest_id: 7, sequence_order: 2, npc_name: 'Padre Sibyla',
    npc_text: 'High Official:\nThe students\' request is legal. If we reject it without reason, we only create resentment.\n\nPadre Camorra:\nEducation will make them arrogant.\n\nPadre Sibyla:\nKnowledge in the wrong hands becomes danger.',
    option_a_text: 'Then give them a school that still keeps them under control. A gift can also be a chain.',
    option_b_text: 'They should be allowed to learn freely. Ignorance weakens the country.',
    option_c_text: 'The more you fear their minds, the more powerful those minds will become against you.',
    context_notes: 'Scene 2: The Academy Debate'
  },
  {
    quest_id: 7, sequence_order: 3, npc_name: 'Ben-Zayb',
    npc_text: 'Padre Irene:\nThe matter can be passed to Don Custodio. He may study it and make the proper recommendation.\n\nBen-Zayb:\nA wise solution. Don Custodio is famous for projects.',
    option_a_text: 'Excellent. Delay is often more useful than refusal.',
    option_b_text: 'Delay is unfair. The students deserve a direct answer.',
    option_c_text: 'Good. Let them taste hope first. Broken hope makes men easier to push toward violence.',
    context_notes: 'Scene 3: Don Custodio as Arbiter'
  },
  {
    quest_id: 7, sequence_order: 4, npc_name: 'Padre Camorra',
    npc_text: 'High Official:\nYour Excellency, the daughter of Cabesang Tales has come again. She begs for the release of her sick grandfather.\n\nCaptain-General:\nCan no one let me eat in peace?\n\nPadre Camorra:\nI came to support that girl\'s petition.',
    option_a_text: 'Mercy costs little when it is given late. Let the order be signed if it pleases His Excellency.',
    option_b_text: 'She should have been heard sooner. The old man should never have been arrested.',
    option_c_text: 'Release him or not, the damage is done. Families remember what governments forget.',
    context_notes: 'Scene 4: Juli\'s Petition'
  },
  {
    quest_id: 7, sequence_order: 5, npc_name: 'Informant',
    npc_text: 'Informant:\nA student named Placido Penitente is losing patience with the University.\n\nInformant:\nHe walks to class with anger, tired of professors, memorization, and humiliation.',
    option_a_text: 'Students tire easily. Watch him, but do not approach him yet.',
    option_b_text: 'He deserves encouragement. A hardworking student should not be crushed.',
    option_c_text: 'Good. A humiliated student is dry wood waiting for flame.',
    context_notes: 'Scene 5: Placido\'s Frustration'
  },
  {
    quest_id: 7, sequence_order: 6, npc_name: 'Informant',
    npc_text: 'Informant:\nPlacido walks with Juanito Pelaez, a favored student. Juanito survives through charm and tricks.\n\nInformant:\nPlacido seems disgusted by him.',
    option_a_text: 'Every system has pets and victims. The pets are useful; the victims are more interesting.',
    option_b_text: 'Placido should avoid men like Juanito if he wants to remain honorable.',
    option_c_text: 'Let Placido see the unfairness clearly. Hatred grows faster when comparison is near.',
    context_notes: 'Scene 6: Juanito Pelaez'
  },

  // ──────────────────────────────────────────────────────────
  // CHAPTER 7: The Humiliation of Learning → quest_id 8
  // ──────────────────────────────────────────────────────────
  {
    quest_id: 8, sequence_order: 1, npc_name: 'Informant',
    npc_text: 'Informant:\nPadre Millon teaches physics, but the students learn mostly fear.\n\nInformant:\nThey memorize words like machines. Mistakes are punished with mockery.',
    option_a_text: 'A school that teaches fear is still useful. Fear prepares men to obey.',
    option_b_text: 'That is not education. That is abuse disguised as teaching.',
    option_c_text: 'Every insult in that classroom sharpens the knife against the rulers.',
    context_notes: 'Scene 1: The Physics Class Report'
  },
  {
    quest_id: 8, sequence_order: 2, npc_name: 'Informant',
    npc_text: 'Informant:\nPlacido was called by Padre Millon. The professor mocked him, twisted his answers, and accused him of prompting.\n\nInformant:\nThen his absences were read aloud before the class.',
    option_a_text: 'Humiliation is a strong teacher. Some men crawl after it; others bite.',
    option_b_text: 'The professor went too far. No student should be treated like that.',
    option_c_text: 'Good. Let the University create the enemies I will need.',
    context_notes: 'Scene 2: Placido Is Targeted'
  },
  {
    quest_id: 8, sequence_order: 3, npc_name: 'Informant',
    npc_text: 'Informant:\nPlacido finally lost patience. He told the professor he had no right to insult him, then left the class.\n\nInformant:\nThe room was terrified. Such dignity is rarely seen there.',
    option_a_text: 'Then he has courage. Courage, when properly guided, can be made useful.',
    option_b_text: 'He should return and apologize before his future is destroyed.',
    option_c_text: 'He has taken the first step. Soon he may be ready to strike back.',
    context_notes: 'Scene 3: Placido Walks Out'
  },
  {
    quest_id: 8, sequence_order: 4, npc_name: 'Informant',
    npc_text: 'Informant:\nThe students gathered at Makaraig\'s house. Their academy petition has reached Don Custodio.\n\nInformant:\nThey believe there is still hope.',
    option_a_text: 'Hope is useful. Let them hold it a little longer before it is taken away.',
    option_b_text: 'I hope they succeed. Their academy would help the youth.',
    option_c_text: 'When their hope fails, they will finally understand that reform is a trap.',
    context_notes: 'Scene 4: The Students Gather'
  },
  {
    quest_id: 8, sequence_order: 5, npc_name: 'Informant',
    npc_text: 'Informant:\nSome students suggest using Pepay, the dancing girl close to Don Custodio.\n\nInformant:\nJuanito Pelaez says he can help through her.',
    option_a_text: 'Influence often enters through doors that honor refuses to touch.',
    option_b_text: 'They should never use shameful methods for a noble cause.',
    option_c_text: 'Let them see that even education must kneel before corruption.',
    context_notes: 'Scene 5: Pepay\'s Influence'
  },
  {
    quest_id: 8, sequence_order: 6, npc_name: 'Informant',
    npc_text: 'Informant:\nIsagani refuses to use Pepay first. He wants to speak with Señor Pasta through honorable means.\n\nInformant:\nThe others agreed. Isagani will visit the lawyer.',
    option_a_text: 'Let the poet try honor. It is useful for young men to discover its price.',
    option_b_text: 'Isagani is right. Honest methods should be respected.',
    option_c_text: 'The old lawyer will teach him what this country does to honest dreams.',
    context_notes: 'Scene 6: Isagani Chooses Señor Pasta'
  },

  // ──────────────────────────────────────────────────────────
  // CHAPTER 8: Cowardice and Conspiracy → quest_id 9
  // ──────────────────────────────────────────────────────────
  {
    quest_id: 9, sequence_order: 1, npc_name: 'Informant',
    npc_text: 'Informant:\nIsagani visited Señor Pasta. At first, the lawyer welcomed him warmly because he knew Isagani\'s uncle.\n\nInformant:\nBut when Isagani mentioned the academy, friars, the Captain-General, and Don Custodio, Señor Pasta became cautious.',
    option_a_text: 'Caution is the refuge of men who own too much to risk anything.',
    option_b_text: 'Perhaps Señor Pasta only needs time to think before helping them.',
    option_c_text: 'Educated cowards are more useful to tyranny than soldiers.',
    context_notes: 'Scene 1: Isagani Meets Señor Pasta'
  },
  {
    quest_id: 9, sequence_order: 2, npc_name: 'Informant',
    npc_text: 'Informant:\nSeñor Pasta said he loved the country and progress, but he could not compromise himself.\n\nInformant:\nHe spoke of prudence, interests, laws, and delicate positions.',
    option_a_text: 'A man who speaks too much usually means to do nothing.',
    option_b_text: 'He is afraid. We should not judge him too harshly.',
    option_c_text: 'Men like him prove why peaceful reform will never free this country.',
    context_notes: 'Scene 2: Señor Pasta Refuses'
  },
  {
    quest_id: 9, sequence_order: 3, npc_name: 'Quiroga',
    npc_text: 'Quiroga:\nSeñor Simoun, welcome. My house is full tonight. Officials, merchants, and friends all come to honor me.\n\nSimoun looks around at the guests eating, drinking, praising Quiroga, and hiding their own interests.',
    option_a_text: 'Honor? They come because your table is full and your favors may be useful.',
    option_b_text: 'You are fortunate to have so many loyal friends.',
    option_c_text: 'Greed gathers men faster than patriotism ever could.',
    context_notes: 'Scene 3: Quiroga\'s House'
  },
  {
    quest_id: 9, sequence_order: 4, npc_name: 'Quiroga',
    npc_text: 'Quiroga:\nSeñor Simoun, I am ruined. The diamond bracelets were taken by a powerful lady. I cannot pay you everything.\n\nQuiroga:\nHave mercy. Reduce my debt.',
    option_a_text: 'Mercy has a price. If you cannot pay with money, you will pay with service.',
    option_b_text: 'Forget the debt. I know you did not intend to lose them.',
    option_c_text: 'You will pay by helping me arm the storm that is coming.',
    context_notes: 'Scene 4: Quiroga\'s Debt'
  },
  {
    quest_id: 9, sequence_order: 5, npc_name: 'Quiroga',
    npc_text: 'Simoun lowers his voice.\n\nSimoun:\nYou have warehouses, Quiroga. You have space. You have men who ask few questions.\n\nQuiroga:\nWhat do you want from me, Señor Simoun?',
    option_a_text: 'Keep some boxes for me. Say nothing. When the time comes, you will be paid in protection.',
    option_b_text: 'Never mind. It is too dangerous. I will find another way.',
    option_c_text: 'Hide rifles and cartridges. They will be used when Manila begins to burn.',
    context_notes: 'Scene 5: The Rifles'
  },
  {
    quest_id: 9, sequence_order: 6, npc_name: 'Quiroga',
    npc_text: 'Quiroga:\nBut if the boxes are found, I will be blamed!\n\nSimoun:\nOnly if you are foolish.\n\nQuiroga trembles.',
    option_a_text: 'If handled well, fear becomes profit. A search can ruin enemies and enrich friends.',
    option_b_text: 'You are right. This plan may hurt innocent people.',
    option_c_text: 'Let the innocent tremble. Terror will weaken the city before the revolt.',
    context_notes: 'Scene 6: Searches and Fear'
  },

  // ──────────────────────────────────────────────────────────
  // CHAPTER 9: The Fair and the Talking Head → quest_id 11
  // ──────────────────────────────────────────────────────────
  {
    quest_id: 11, sequence_order: 1, npc_name: 'Padre Camorra',
    npc_text: 'Juanito Pelaez:\nSeñor Simoun, the fair is full tonight. Everyone is speaking of Mr. Leeds and his mysterious talking head.\n\nBen-Zayb:\nA talking head? Nonsense. It must be optics, mirrors, or some American trick.\n\nPadre Camorra:\nOr the devil himself.',
    option_a_text: 'If you wish to know whether it is mirrors or devils, then see the famous sphinx yourselves.',
    option_b_text: 'Leave it alone. Such shows are useless and not worth our attention.',
    option_c_text: 'Sometimes the dead speak because the living have buried too many crimes.',
    context_notes: 'Scene 1: The Quiapo Fair'
  },
  {
    quest_id: 11, sequence_order: 2, npc_name: 'Padre Salvi',
    npc_text: 'Ben-Zayb:\nI tell you, it is physics. One mirror here, another there, and the illusion is complete.\n\nPadre Camorra:\nBah! Your science cannot explain everything.\n\nPadre Salvi:\nSuch exhibitions should be watched carefully.',
    option_a_text: 'Then let us examine it. If Ben-Zayb is right, he may write about science. If the padre is right, he may forbid it.',
    option_b_text: 'Science and religion should not quarrel over a fair attraction.',
    option_c_text: 'Science, religion, and government all fear the same thing: a hidden truth becoming visible.',
    context_notes: 'Scene 2: Ben-Zayb\'s Explanation'
  },
  {
    quest_id: 11, sequence_order: 3, npc_name: 'Don Custodio',
    npc_text: 'Padre Salvi:\nI do not like this. A talking head, a dark room, a foreigner, and a crowd hungry for wonders.\n\nDon Custodio:\nStill, if we go privately, no one can say we mixed with the common crowd.',
    option_a_text: 'There is nothing to fear, Padre. It is only a box, unless your conscience gives it a voice.',
    option_b_text: 'If Padre Salvi is uncomfortable, we should respect his feelings and leave.',
    option_c_text: 'Perhaps Padre Salvi fears the head will speak of Santa Clara.',
    context_notes: 'Scene 3: Padre Salvi\'s Uneasiness'
  },
  {
    quest_id: 11, sequence_order: 4, npc_name: 'Padre Camorra',
    npc_text: 'Mr. Leeds:\nLadies and gentlemen, this box came from an ancient tomb. Inside it are ashes and a secret older than memory.\n\nBen-Zayb:\nThe mirrors must be hidden somewhere. I will find them.\n\nPadre Camorra:\nBegin already! This air smells like a corpse.',
    option_a_text: 'Proceed, Mr. Leeds. Curiosity has already paid the entrance fee.',
    option_b_text: 'This is disrespectful. The dead should not be used for entertainment.',
    option_c_text: 'A dead head may give truer testimony than living courts.',
    context_notes: 'Scene 4: Inside Mr. Leeds\' Exhibit'
  },
  {
    quest_id: 11, sequence_order: 5, npc_name: 'Ben-Zayb',
    npc_text: 'The Talking Head:\nI know the crimes hidden beneath robes, prayers, and silence.\n\nPadre Salvi turns pale. His hands tremble.\n\nBen-Zayb:\nImpossible. There must be mirrors!',
    option_a_text: 'An impressive illusion. Manila will gossip about this for days.',
    option_b_text: 'Padre Salvi looks unwell. The show should stop.',
    option_c_text: 'Let the guilty friar hear what the dead remember.',
    context_notes: 'Scene 5: The Talking Head Speaks'
  },
  {
    quest_id: 11, sequence_order: 6, npc_name: 'Ben-Zayb',
    npc_text: 'Don Custodio:\nThis exhibition must be stopped. It disturbs the peace and frightens respectable people.\n\nPadre Camorra:\nYes, forbid it. Such things belong to darkness.\n\nBen-Zayb:\nStill, I am certain it was done with mirrors.',
    option_a_text: 'Then close it. Fear is easier to control when authority gives it a name.',
    option_b_text: 'The public should be free to see it and judge for themselves.',
    option_c_text: 'No, let the fear spread. Panic weakens the Church faster than argument.',
    context_notes: 'Scene 6: After the Show'
  },

  // ──────────────────────────────────────────────────────────
  // CHAPTER 10: The Spark Beneath Manila → quest_id 12
  // ──────────────────────────────────────────────────────────
  {
    quest_id: 12, sequence_order: 1, npc_name: 'Placido Penitente',
    npc_text: 'Placido Penitente:\nSeñor Simoun! Señor Simoun! I need to speak with you.\n\nSimoun stops near his carriage and looks at Placido through his blue goggles.\n\nPlacido Penitente:\nI want to ask a favor. I want to leave this place.',
    option_a_text: 'Why?',
    option_b_text: 'Poor boy. Tell me everything, and I will help you.',
    option_c_text: 'Your anger has finally made you useful.',
    context_notes: 'Scene 1: Placido Calls Simoun'
  },
  {
    quest_id: 12, sequence_order: 2, npc_name: 'Placido Penitente',
    npc_text: 'Placido Penitente:\nI want to go to Hong Kong. I want to live free, become rich, and fight the friars from there.\n\nSimoun watches him quietly.',
    option_a_text: 'Come with me. To Calle Iris.',
    option_b_text: 'I will write you a recommendation, then you may leave in peace.',
    option_c_text: 'Do not run to Hong Kong. Stay here and help burn the system that humiliated you.',
    context_notes: 'Scene 2: Placido Wants Hong Kong'
  },
  {
    quest_id: 12, sequence_order: 3, npc_name: 'Placido Penitente',
    npc_text: 'Placido Penitente:\nI am tired of studying. The University has become a place of insults.\n\nSimoun remains silent for a moment as the carriage moves through the city.',
    option_a_text: 'Speak little. A man who wishes to change his fate must first learn silence.',
    option_b_text: 'You have suffered enough. You should rest before making any decision.',
    option_c_text: 'The revolution needs men who have been humiliated.',
    context_notes: 'Scene 3: Inside the Carriage'
  },
  {
    quest_id: 12, sequence_order: 4, npc_name: 'Informant',
    npc_text: 'Informant:\nSeñor Simoun, Don Custodio\'s decision on the students\' academy has been approved.\n\nInformant:\nThe academy is accepted in name, but it will be placed under a religious corporation or connected to the University.',
    option_a_text: 'A favorable answer that chains them is better than an open refusal.',
    option_b_text: 'That is unfair. The students deserve a school that is truly theirs.',
    option_c_text: 'Good. Broken hope creates better rebels than direct oppression.',
    context_notes: 'Scene 4: Don Custodio\'s Decision'
  },
  {
    quest_id: 12, sequence_order: 5, npc_name: 'Informant',
    npc_text: 'Informant:\nThe students are angry. They say their victory is only an insult.\n\nInformant:\nThey plan to leave the theater and hold a banquet at a pansiteria.',
    option_a_text: 'Let them laugh. Mockery wastes anger better than action.',
    option_b_text: 'They have the right to protest. Their disappointment is justified.',
    option_c_text: 'Let the banquet become the first signal.',
    context_notes: 'Scene 5: The Students\' Reaction'
  },
  {
    quest_id: 12, sequence_order: 6, npc_name: 'Informant',
    npc_text: 'Informant:\nPlacido Penitente is still angry. He may be willing to follow you.',
    option_a_text: 'Keep him near but unsatisfied. Desperation moves faster than command.',
    option_b_text: 'Send him safely to Hong Kong. He deserves freedom.',
    option_c_text: 'Give him weapons tonight. A humiliated student should learn how revenge feels.',
    context_notes: 'Scene 6: Placido\'s Usefulness'
  },

  // ──────────────────────────────────────────────────────────
  // CHAPTER 11: Masks at the Theater → quest_id 13 (partial — 2 scenes)
  // ──────────────────────────────────────────────────────────
  {
    quest_id: 13, sequence_order: 1, npc_name: 'Informant',
    npc_text: 'Informant:\nSeñor Simoun, the theater is full. Everyone is asking who owns the empty box.\n\nInformant:\nA rumor has spread that it belongs to you.',
    option_a_text: 'Let them believe it. An absent man can command more attention than one seated in plain sight.',
    option_b_text: 'Correct the rumor. I want no attention tonight.',
    option_c_text: 'Good. While they stare at an empty box, I prepare the city for blood.',
    context_notes: 'Scene 1: The Empty Theater Box'
  },
  {
    quest_id: 13, sequence_order: 2, npc_name: 'Informant',
    npc_text: 'Informant:\nSome say you were seen with Mr. Jouay. Others say you gave a necklace to one of the actresses.\n\nInformant:\nThe audience is whispering about you.',
    option_a_text: 'A necklace opens doors more quietly than a command.',
    option_b_text: 'It was only admiration. There is no purpose behind it.',
    option_c_text: 'The actress, the palace, and the theater are all useful pieces for tonight.',
    context_notes: 'Scene 2: The Necklace Rumor'
  },
];

// ============================================================
// EXPORTS
// ============================================================
module.exports = { QUEST_UPDATES, DIALOGUES };

