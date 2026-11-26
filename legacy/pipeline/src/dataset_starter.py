# -*- coding: utf-8 -*-
"""
NEXUS RELAY — Starter Dataset (Phase 1)
========================================
Hand-authored seed corpus: 110 real entities, 9-10 per domain across all 12
blueprint domains. Every entity carries the full Phase-1 field set:

  name, sub (subtitle), year (signed astronomical year; BCE negative),
  lat / lon (None => CONCEPTUAL / NON-SPATIAL per Blueprint Stage 3),
  dom (1-12), subdom (sub-domain id inside the domain),
  notability (uint16 0-65535, Blueprint Stage 2 composite scale),
  cluster (graph cluster id), alt (autocomplete aliases),
  clues {alpha, beta, gamma, delta, epsilon} — written to Blueprint Stage 5
  rules: no clue may contain the entity's name or its lexical roots
  (enforced by tests/test_clue_leakage.py),
  edges [(target_name, REL_TYPE)] — curated outgoing graph edges.
  The Stage 4 bridge guarantee (min outgoing edges + full connectivity)
  is applied by stage6_pack_binary.py.

The full production corpus (250,000 entities / 1.5M edges) is produced by
the Stage 1-6 Wikidata pipeline; this starter set is the playable seed.
"""

# Cluster ids
CL = {
    "space_race": 1, "computing": 2, "ancient_med": 3, "east_asia": 4,
    "age_of_sail": 5, "world_wars": 6, "golden_cinema": 7, "music_legends": 8,
    "natural_world": 9, "art_masters": 10, "philosophy": 11, "modern_sport": 12,
    "deep_space": 13, "everyday": 14, "europe_old": 15, "americas": 16,
}

E = []  # entity list


def ent(name, sub, year, lat, lon, dom, subdom, notability, cluster, alt,
        alpha, beta, gamma, delta, epsilon, edges):
    E.append({
        "name": name, "sub": sub, "year": year, "lat": lat, "lon": lon,
        "dom": dom, "subdom": subdom, "notability": notability,
        "cluster": cluster, "alt": alt,
        "clues": {"alpha": alpha, "beta": beta, "gamma": gamma,
                  "delta": delta, "epsilon": epsilon},
        "edges": edges,
    })


# ---------------------------------------------------------------- DOM 1: HISTORY
ent("Battle of Hastings", "Battle (1066)", 1066, 50.91, 0.49, 1, 1, 26000,
    CL["europe_old"], ["hastings", "1066 battle"],
    "A single autumn day in 1066 rewrote a kingdom's language forever.",
    "A ridge near a south-coast town in Sussex, England.",
    "Armed conflict that decided a royal succession.",
    "Won by a Norman duke who crossed the Channel with an invasion fleet.",
    "The losing king took an arrow in the eye, legend insists.",
    [("Founding of Rome", "SHARED_ERA_WORLD"), ("Signing of the Magna Carta", "SAME_ISLAND_HISTORY")])

ent("Founding of Rome", "Legendary City Founding", -753, 41.90, 12.50, 1, 3, 30000,
    CL["ancient_med"], ["rome founded", "romulus"],
    "Twin brothers, a she-wolf, and a date 753 years before the common era.",
    "Seven hills beside a river in the Italian peninsula.",
    "The birth of a city that became an empire.",
    "Its first king shares his name with the city itself.",
    "Celebrated every April as the city's birthday.",
    [("Julius Caesar", "FUTURE_OF_THE_CITY"), ("The Odyssey", "SHARED_ANCIENT_WORLD")])

ent("Julius Caesar", "Roman General & Dictator", -100, 41.90, 12.50, 1, 2, 58000,
    CL["ancient_med"], ["caesar", "gaius julius caesar"],
    "Born a century before the common era began.",
    "Rose to power in the capital of a Mediterranean republic.",
    "Military commander turned ruler of a republic.",
    "Crossed a small river in 49 BCE to start a civil war.",
    "Stabbed 23 times on the Ides of March.",
    [("Founding of Rome", "RULED_THE_CITY"), ("Great Pyramid of Giza", "CONQUERED_ITS_LAND")])

ent("Signing of the Magna Carta", "Charter of Liberties (1215)", 1215, 51.44, -0.57, 1, 3, 34000,
    CL["europe_old"], ["magna carta", "great charter"],
    "Sealed in a meadow in the summer of 1215.",
    "A water-meadow on the Thames, west of London.",
    "A legal document limiting royal power.",
    "Barons forced a cornered king to accept it.",
    "Clause 39 still echoes in modern habeas corpus law.",
    [("Battle of Hastings", "SAME_ISLAND_HISTORY"), ("French Revolution", "INSPIRED_LIMITS_ON_KINGS")])

ent("Fall of Constantinople", "Siege & Conquest (1453)", 1453, 41.01, 28.98, 1, 1, 36000,
    CL["ancient_med"], ["constantinople 1453", "fall of byzantium"],
    "Ended an empire of more than a thousand years in May 1453.",
    "A walled city where Europe meets Asia across a strait.",
    "The final siege of a medieval empire.",
    "A 21-year-old sultan brought giant cannons against the walls.",
    "Ships were hauled overland into the harbour to bypass a chain.",
    [("Julius Caesar", "SHARED_EMPIRE_LINEAGE"), ("The Tale of Genji", "SHARED_CENTURY_WORLD")])

ent("French Revolution", "Revolution (1789-1799)", 1789, 48.85, 2.37, 1, 3, 52000,
    CL["europe_old"], ["storming of the bastille", "1789 revolution"],
    "Ignited in July 1789 with the storming of a fortress-prison.",
    "The capital of a European kingdom on the Seine.",
    "An upheaval that toppled a monarchy.",
    "Its slogan promised liberty, equality, fraternity.",
    "It gave the world the metric system and a famous blade.",
    [("Signing of the Magna Carta", "SHARED_LIMITING_KINGS"), ("Battle of Hastings", "SHARED_CHANNEL_HISTORY")])

ent("Assassination of Franz Ferdinand", "Assassination (1914)", 1914, 43.86, 18.41, 1, 1, 38000,
    CL["world_wars"], ["sarajevo assassination", "archduke franz ferdinand"],
    "A June morning in 1914 lit the fuse of a world war.",
    "A Balkan capital on the Miljacka river.",
    "The killing of a royal heir that triggered alliances.",
    "The gunman was a 19-year-old Bosnian Serb student.",
    "The driver took a wrong turn, stopping beside the assassin.",
    [("D-Day Landings", "WAR_IT_IGNITED"), ("Atomic Bombing of Hiroshima", "WAR_IT_IGNITED")])

ent("D-Day Landings", "Amphibious Invasion (1944)", 1944, 49.38, -1.17, 1, 1, 48000,
    CL["world_wars"], ["normandy landings", "operation overlord", "d-day"],
    "The largest seaborne invasion ever, launched 6 June 1944.",
    "Five beaches on the northern coast of France.",
    "An amphibious assault opening a second front.",
    "Preceded by dummy paratroopers and a phantom army of inflatables.",
    "156,000 troops landed on the first day.",
    [("Atomic Bombing of Hiroshima", "SAME_WAR"), ("Assassination of Franz Ferdinand", "WAR_FROM_ITS_SPARK")])

ent("Atomic Bombing of Hiroshima", "Atomic Bombing (1945)", 1945, 34.39, 132.45, 1, 1, 50000,
    CL["world_wars"], ["hiroshima", "little boy bombing"],
    "A single bomb at 8:15 a.m. on 6 August 1945.",
    "A port city on a river delta in western Honshu, Japan.",
    "The first wartime use of a nuclear weapon.",
    "The bomber was named after the pilot's mother.",
    "A domed exhibition hall survived at the hypocentre and still stands.",
    [("D-Day Landings", "SAME_WAR"), ("Penicillin", "SHARED_DECADE_SCIENCE")])

ent("Fall of the Berlin Wall", "Historic Breach (1989)", 1989, 52.52, 13.40, 1, 3, 46000,
    CL["europe_old"], ["berlin wall falls", "november 9 1989"],
    "Crowds breached it on the night of 9 November 1989.",
    "A divided city deep inside East Germany.",
    "The symbolic end of the Cold War division of Europe.",
    "A spokesman's mistaken press statement opened the gates early.",
    "It had stood for 28 years, splitting families and a city.",
    [("French Revolution", "SHARED_EUROPEAN_UPHEAVAL"), ("World Wide Web", "SHARED_YEAR_1989")])

# ---------------------------------------------------------------- DOM 2: GEOGRAPHY & LANDMARKS
ent("Mount Everest", "Highest Mountain on Earth", 1953, 27.99, 86.93, 2, 1, 56000,
    CL["natural_world"], ["everest", "sagarmatha", "chomolungma"],
    "First stood upon in 1953, though surveyed as the world's highest decades earlier.",
    "The high Himalaya, on the border of Nepal and Tibet.",
    "The tallest peak above sea level on the planet.",
    "A New Zealander and a Sherpa reached the top together.",
    "Its height grows a few millimetres every year.",
    [("Lake Baikal", "SHARED_CONTINENT_EXTREMES"), ("Grand Canyon", "SHARED_NATURAL_WONDER")])

ent("Eiffel Tower", "Iron Lattice Tower", 1889, 48.86, 2.29, 2, 2, 60000,
    CL["europe_old"], ["tour eiffel", "iron lady of paris"],
    "Raised for a world's fair celebrating a revolution's centenary, 1889.",
    "The Champ de Mars in the French capital.",
    "An iron landmark and engineering emblem.",
    "Its designer also framed a famous copper statue across the Atlantic.",
    "It was nearly scrapped in 1909, saved by its radio antennas.",
    [("French Revolution", "CENTENARY_OF"), ("Statue of Liberty", "SAME_ENGINEER")])

ent("Great Wall of China", "Fortification System", -700, 40.43, 116.57, 2, 2, 58000,
    CL["east_asia"], ["great wall", "wanli changcheng"],
    "First sections rose in the 7th century BCE; unified a century later.",
    "It snakes across the northern frontier of an East Asian empire.",
    "The longest fortification ever built.",
    "Sticky rice was mixed into its mortar in later dynasties.",
    "All its branches together stretch over 21,000 kilometres.",
    [("Confucius", "SHARED_CIVILISATION"), ("Taj Mahal", "SHARED_ASIAN_ICON")])

ent("Sahara", "Largest Hot Desert", -5500, 23.42, 12.60, 2, 1, 44000,
    CL["natural_world"], ["sahara desert"],
    "It dried into desert roughly 7,000 years ago as monsoons retreated.",
    "It covers most of North Africa, from the Atlantic to the Red Sea.",
    "The largest hot desert on Earth.",
    "It was green savanna with lakes within human memory of the land.",
    "Roughly the size of the United States.",
    [("Amazon River", "SHARED_CONTINENT_SCALE"), ("Anubis", "SHARED_REGION")])

ent("Amazon River", "River System", 1542, -3.12, -60.02, 2, 1, 48000,
    CL["americas"], ["amazon", "rio amazonas"],
    "First descended by Europeans in 1542, who reported warrior women.",
    "It drains a continent's northern half into the Atlantic.",
    "The waterway carrying more water than any other on Earth.",
    "Named after a Greek myth of female warriors.",
    "It pours a fifth of all the world's flowing fresh water into the ocean.",
    [("Sahara", "SHARED_CONTINENT_SCALE"), ("Monarch Butterfly", "SHARED_CONTINENT")])

ent("Grand Canyon", "River Canyon", 1540, 36.10, -112.11, 2, 1, 46000,
    CL["americas"], ["grand canyon arizona"],
    "First seen by Europeans in 1540; carved over millions of years.",
    "A gorge in the Arizona desert of the American Southwest.",
    "A gorge exposing two billion years of rock.",
    "Its river still cuts downward through the plateau.",
    "Deep enough to stack four Empire State Buildings.",
    [("Mount Everest", "SHARED_NATURAL_WONDER"), ("General Sherman Tree", "SHARED_NATIONAL_PARKS")])

ent("Great Pyramid of Giza", "Ancient Pyramid", -2560, 29.98, 31.13, 2, 2, 54000,
    CL["ancient_med"], ["pyramid of khufu", "great pyramid"],
    "Completed around 2560 BCE after some twenty years of labour.",
    "A plateau on the west bank of the Nile, outside Cairo.",
    "The oldest of the Seven Wonders, and the only one surviving.",
    "Built for a pharaoh of the Fourth Dynasty.",
    "It was the tallest human structure for over 3,800 years.",
    [("Anubis", "SHARED_CIVILISATION"), ("Founding of Rome", "SHARED_ANCIENT_WORLD")])

ent("Statue of Liberty", "Colossal Statue", 1886, 40.69, -74.04, 2, 2, 56000,
    CL["americas"], ["lady liberty", "liberty enlightening the world"],
    "Dedicated in 1886, a gift shipped across the Atlantic in 350 pieces.",
    "An island at the entrance to New York Harbor.",
    "A copper colossus symbolising freedom.",
    "Its iron skeleton was engineered by the Eiffel Tower's designer.",
    "The copper skin is only as thick as two pennies together.",
    [("Eiffel Tower", "SAME_ENGINEER"), ("French Revolution", "GIFT_OF_ITS_HEIRS")])

ent("Lake Baikal", "Deepest Lake on Earth", 1643, 53.56, 108.16, 2, 1, 32000,
    CL["natural_world"], ["baikal", "deepest lake"],
    "First reached by Russian explorers in 1643; the basin itself is some 25 million years old.",
    "A crescent rift basin in Siberia.",
    "The deepest and oldest body of fresh water on the planet.",
    "Holds a fifth of the world's fresh surface water.",
    "Home to the world's only exclusively freshwater seal.",
    [("Mount Everest", "SHARED_CONTINENT_EXTREMES"), ("Axolotl", "SHARED_FRESHWATER")])

# ---------------------------------------------------------------- DOM 3: SCIENCE & TECHNOLOGY
ent("Apollo 11", "Crewed Lunar Landing Mission (1969)", 1969, 28.57, -80.65, 3, 1, 62000,
    CL["space_race"], ["apollo xi", "moon landing 1969", "first moon landing"],
    "Launched in July of 1969, four days before its famous landing.",
    "Lifted off from a Florida cape; touched down on a flat lunar sea.",
    "A crewed spaceflight mission of the Space Race.",
    "Commanded by the man who took the first step.",
    "First crewed lunar landing in history.",
    [("Neil Armstrong", "COMMANDED_BY"), ("Saturn V", "LAUNCH_VEHICLE"), ("NASA", "OPERATING_AGENCY")])

ent("Saturn V", "Super Heavy-Lift Rocket", 1967, 28.57, -80.65, 3, 1, 42000,
    CL["space_race"], ["saturn five", "saturn rocket"],
    "First flew in November 1967, uncrewed, and worked perfectly.",
    "Launched from the same Florida cape as the missions it carried.",
    "The most powerful rocket ever flown successfully.",
    "Designed under a German-born rocket engineer in Alabama.",
    "Taller than the Statue of Liberty, and still unmatched in lift.",
    [("Apollo 11", "CARRIED_TO_THE_MOON"), ("NASA", "OPERATED_BY")])

ent("NASA", "Space Agency", 1958, 38.88, -77.02, 3, 2, 58000,
    CL["space_race"], ["national aeronautics and space administration"],
    "Founded in 1958, in direct answer to a rival's orbiting beep.",
    "Headquartered in the capital of the United States.",
    "A civilian government space agency.",
    "Created months after the first artificial satellite shocked the West.",
    "Its insignia is nicknamed the meatball.",
    [("Apollo 11", "RAN_THE_MISSION"), ("Hubble Space Telescope", "OPERATES")])

ent("Neil Armstrong", "Astronaut (1930-2012)", 1930, 40.57, -84.19, 3, 3, 56000,
    CL["space_race"], ["armstrong astronaut", "first man on the moon"],
    "Born in Ohio in 1930; a naval aviator before he was an astronaut.",
    "A small town in Ohio, in the American Midwest.",
    "A test pilot and astronaut.",
    "Flew combat missions in Korea before joining the space program.",
    "His first step onto another world was watched by 600 million people.",
    [("Apollo 11", "COMMANDED"), ("Saturn V", "RODE_TO_ORBIT")])

ent("World Wide Web", "Information System", 1989, 46.23, 6.05, 3, 4, 60000,
    CL["computing"], ["www", "the web", "web invention"],
    "Proposed in March 1989 in a memo its boss called vague but exciting.",
    "A physics laboratory on the French-Swiss border.",
    "The hyperlinked information system that rides the internet.",
    "Invented by a British scientist who gave it away free.",
    "Its first website explained what a website was.",
    [("ENIAC", "SHARED_COMPUTING_LINEAGE"), ("Fall of the Berlin Wall", "SHARED_YEAR_1989")])

ent("ENIAC", "Early General-Purpose Computer", 1945, 39.95, -75.19, 3, 4, 34000,
    CL["computing"], ["electronic numerical integrator and computer"],
    "Unveiled in 1945 after secret wartime work on artillery tables.",
    "A university engineering school in Philadelphia.",
    "One of the first general-purpose electronic computers.",
    "Its first programmers were six women mathematicians.",
    "It filled a room with 18,000 vacuum tubes and weighed 30 tons.",
    [("Turing Machine", "SHARED_COMPUTING_LINEAGE"), ("World Wide Web", "SHARED_COMPUTING_LINEAGE")])

ent("Turing Machine", "Model of Computation", 1936, 52.20, 0.12, 3, 4, 30000,
    CL["computing"], ["turing machine concept", "halting problem machine"],
    "Described in a 1936 paper by a 23-year-old Cambridge fellow.",
    "Conceived in Cambridge, England; it exists only on paper.",
    "An abstract model defining what computation means.",
    "Its inventor later broke wartime codes and founded computer science.",
    "It reads and writes symbols on an infinite tape.",
    [("ENIAC", "INSPIRED_REAL_MACHINES"), ("Pythagorean Theorem", "SHARED_ABSTRACT_IDEAS")])

ent("Pythagorean Theorem", "Geometric Theorem", -530, None, None, 3, 5, 48000,
    CL["ancient_med"], ["pythagoras theorem", "a squared plus b squared"],
    "Taught by a Greek brotherhood around 530 BCE, likely known earlier in Babylon.",
    "CONCEPTUAL / NON-SPATIAL: a relation between sides, true everywhere.",
    "The fundamental rule of right-triangle geometry.",
    "Its namesake led a secretive cult that worshipped numbers.",
    "Hundreds of distinct proofs of it exist, including one by a US president.",
    [("Turing Machine", "SHARED_ABSTRACT_IDEAS"), ("Plato", "SHARED_GREEK_THOUGHT")])

ent("Penicillin", "Antibiotic Discovery", 1928, 51.52, -0.18, 3, 6, 50000,
    CL["europe_old"], ["penicillin discovery", "fleming mould"],
    "Noticed in September 1928 in a cluttered London laboratory.",
    "A hospital laboratory in Paddington, London.",
    "The first widely used antibiotic medicine.",
    "A stray mould spore drifted in through an open window.",
    "It turned once-fatal infections into routine cures.",
    [("Atomic Bombing of Hiroshima", "SHARED_DECADE_SCIENCE"), ("DNA Double Helix", "SHARED_BRITISH_SCIENCE")])

ent("Special Relativity", "Physics Theory (1905)", 1905, 46.95, 7.44, 3, 5, 52000,
    CL["europe_old"], ["theory of relativity", "einstein 1905", "e equals mc squared"],
    "Published in 1905, the miracle year of a Bern patent clerk.",
    "Written in Bern, Switzerland, between patent applications.",
    "A theory unifying space, time, and the speed of light.",
    "Its author was 26 and working outside academia.",
    "It made mass and energy two names for one thing.",
    [("Pythagorean Theorem", "SHARED_ABSTRACT_IDEAS"), ("Sagittarius A*", "PREDICTED_ITS_OBJECTS")])

# ---------------------------------------------------------------- DOM 4: CINEMA & TELEVISION
ent("Star Wars", "Space Opera Film (1977)", 1977, 34.09, -118.32, 4, 1, 60000,
    CL["golden_cinema"], ["star wars a new hope", "star wars episode iv"],
    "Premiered in May 1977 to lines around the block.",
    "Filmed between Tunisian deserts and London sound stages.",
    "A space-opera feature film that rebuilt an industry.",
    "Its creator mortgaged everything on a film studios expected to flop.",
    "It rescued a toy company and invented the modern blockbuster summer.",
    [("Steven Spielberg", "SHARED_BLOCKBUSTER_ERA"), ("Titanic", "SHARED_BOX_OFFICE_TITANS")])

ent("The Godfather", "Crime Film (1972)", 1972, 40.73, -73.99, 4, 1, 54000,
    CL["golden_cinema"], ["godfather film", "corleone film"],
    "Released in 1972; its studio tried to fire its young director weekly.",
    "Shot on the streets and estates of New York.",
    "A crime saga about a family business.",
    "Real mob figures reportedly advised on set authenticity.",
    "Famous for an offer nobody could refuse.",
    [("Citizen Kane", "SHARED_GREATEST_FILM_DEBATE"), ("Alfred Hitchcock", "SHARED_AUTEUR_ERA")])

ent("Citizen Kane", "Drama Film (1941)", 1941, 34.09, -118.32, 4, 1, 44000,
    CL["golden_cinema"], ["citizen kane film", "rosebud film"],
    "Premiered in 1941, made by a 25-year-old first-time director.",
    "Hollywood sound stages, standing in for a newspaper empire.",
    "A drama long voted the greatest film ever made.",
    "A newspaper tycoon tried to have it destroyed before release.",
    "Its mystery hangs on a single dying word: a childhood sled.",
    [("The Godfather", "SHARED_GREATEST_FILM_DEBATE"), ("Charlie Chaplin", "SHARED_EARLY_AUTEURS")])

ent("Charlie Chaplin", "Actor & Filmmaker (1889-1977)", 1889, 51.48, -0.10, 4, 2, 52000,
    CL["golden_cinema"], ["chaplin", "the tramp"],
    "Born in London in 1889 to music-hall performers.",
    "A workhouse childhood in Victorian London.",
    "A silent-film comedian and director.",
    "His most famous character wore a bowler hat and a toothbrush moustache.",
    "He composed the song 'Smile' for one of his own films.",
    [("Citizen Kane", "SHARED_EARLY_AUTEURS"), ("Alfred Hitchcock", "SHARED_LONDON_ORIGINS")])

ent("Alfred Hitchcock", "Film Director (1899-1980)", 1899, 51.56, -0.01, 4, 2, 52000,
    CL["golden_cinema"], ["hitchcock", "master of suspense"],
    "Born in London's East End in 1899, above his father's grocery.",
    "Leytonstone, London; later the master of Hollywood suspense.",
    "A director synonymous with cinematic suspense.",
    "He made wordless cameos in nearly all of his own films.",
    "He shot a shower scene with 77 camera setups and chocolate syrup for blood.",
    [("Charlie Chaplin", "SHARED_LONDON_ORIGINS"), ("Steven Spielberg", "SHARED_SUSPENSE_LINEAGE")])

ent("Titanic", "Romance Disaster Film (1997)", 1997, 34.09, -118.32, 4, 1, 58000,
    CL["golden_cinema"], ["titanic movie", "james cameron titanic"],
    "Released in December 1997 after a budget that doubled mid-production.",
    "A replica ship built on the Mexican coast, sunk on cue.",
    "A romance set aboard a doomed ocean liner.",
    "Its director dove to the real wreck a dozen times for research.",
    "It held the all-time box office record for twelve years.",
    [("Star Wars", "SHARED_BOX_OFFICE_TITANS"), ("Steven Spielberg", "SHARED_BLOCKBUSTER_ERA")])

ent("Steven Spielberg", "Film Director (b. 1946)", 1946, 39.10, -84.51, 4, 2, 58000,
    CL["golden_cinema"], ["spielberg"],
    "Born in Cincinnati in 1946; directing TV episodes by his early twenties.",
    "An Ohio birthplace; a career made in Hollywood.",
    "The most commercially successful director in film history.",
    "He shot his breakthrough shark film mostly with a broken mechanical shark.",
    "He finished a law degree at 55, decades after dropping out.",
    [("Star Wars", "SHARED_BLOCKBUSTER_ERA"), ("Alfred Hitchcock", "SHARED_SUSPENSE_LINEAGE")])

ent("BBC Television Service", "Television Broadcaster", 1936, 51.59, -0.13, 4, 3, 26000,
    CL["europe_old"], ["bbc tv launch", "first television service"],
    "Began regular broadcasts on 2 November 1936.",
    "A Victorian palace on a north London hill.",
    "The world's first regular broadcaster of moving pictures.",
    "It shut down in 1939 for the war, mid-cartoon.",
    "Early cameras needed studio lights so hot that makeup melted.",
    [("Citizen Kane", "SHARED_1930S_MEDIA"), ("World Wide Web", "SHARED_BRITISH_MEDIA")])

ent("Bollywood", "Film Industry", 1913, 19.07, 72.87, 4, 4, 46000,
    CL["east_asia"], ["bollywood industry", "hindi cinema"],
    "Its first feature film premiered in 1913 in Bombay.",
    "The studios and streets of Mumbai, India.",
    "The world's most prolific film industry by output.",
    "Its nickname merges its home city with a famous American rival.",
    "Song-and-dance sequences can halt the plot for celebration.",
    [("Star Wars", "SHARED_GLOBAL_CINEMA"), ("Taj Mahal", "SHARED_COUNTRY_ICONS")])

# ---------------------------------------------------------------- DOM 5: BIOLOGY & NATURE
ent("Giant Panda", "Bear Species", 1869, 30.60, 103.90, 5, 1, 52000,
    CL["natural_world"], ["panda", "ailuropoda melanoleuca"],
    "Introduced to science in 1869 from a French missionary's specimen.",
    "Bamboo forests in the mountains of Sichuan, China.",
    "A bamboo-eating bear species.",
    "It has a sixth pseudo-thumb for gripping bamboo stems.",
    "Ninety-nine percent of its diet is a plant it barely digests.",
    [("Great Wall of China", "SHARED_COUNTRY"), ("Axolotl", "SHARED_CONSERVATION_ICONS")])

ent("Blue Whale", "Largest Animal on Earth", 1758, -54.42, -36.59, 5, 1, 50000,
    CL["natural_world"], ["balaenoptera musculus", "largest animal"],
    "Formally described by Linnaeus in 1758, though whalers knew it long before.",
    "Feeds in cold Southern Ocean waters near South Georgia.",
    "The largest animal known to have ever existed.",
    "Its heart alone can weigh as much as a small car.",
    "Its tongue weighs as much as an elephant.",
    [("Tyrannosaurus rex", "SHARED_GIANTS"), ("Monarch Butterfly", "SHARED_MIGRANTS")])

ent("Galapagos Tortoise", "Giant Tortoise Species", 1835, -0.74, -90.31, 5, 1, 36000,
    CL["natural_world"], ["galapagos giant tortoise"],
    "Made famous by a naturalist's visit in 1835.",
    "Volcanic islands straddling the equator, west of Ecuador.",
    "The largest living giant among shelled reptiles.",
    "Sailors stacked them alive in ship holds as fresh meat.",
    "Some individuals live well past 150 years.",
    [("DNA Double Helix", "SHARED_EVOLUTION_STORY"), ("Amazon River", "SHARED_CONTINENT")])

ent("DNA Double Helix", "Molecular Structure", 1953, 52.20, 0.12, 5, 2, 56000,
    CL["computing"], ["double helix", "dna structure"],
    "Published in April 1953 in a one-page paper.",
    "Cambridge, England, and a rival laboratory in London.",
    "The structure of the molecule of heredity.",
    "Built partly on an X-ray image its makers called Photo 51.",
    "Two of its discoverers saw the key photograph without its author's knowledge.",
    [("Penicillin", "SHARED_BRITISH_SCIENCE"), ("Turing Machine", "SHARED_CAMBRIDGE")])

ent("General Sherman Tree", "Giant Sequoia Tree", 1879, 36.58, -118.75, 5, 3, 34000,
    CL["americas"], ["general sherman", "largest tree"],
    "Named in 1879 after a Civil War commander.",
    "A sequoia grove in California's Sierra Nevada.",
    "The largest known living single-stem organism by volume.",
    "It still adds the bulk of a respectably sized conifer every year.",
    "Its trunk could hold 150,000 basketballs by volume.",
    [("Grand Canyon", "SHARED_NATIONAL_PARKS"), ("Blue Whale", "SHARED_LARGEST_LIVING")])

ent("Monarch Butterfly", "Migratory Butterfly", 1975, 19.60, -100.20, 5, 1, 38000,
    CL["americas"], ["monarch migration", "danaus plexippus"],
    "Its wintering grounds were a mystery to science until 1975.",
    "Oyamel fir forests in the mountains of central Mexico.",
    "An orange-and-black migrant famous for its multi-generational migration.",
    "No single individual makes the whole round trip.",
    "Millions cluster on the same few mountain ridges each winter.",
    [("Blue Whale", "SHARED_MIGRANTS"), ("Amazon River", "SHARED_CONTINENT")])

ent("Tyrannosaurus rex", "Theropod Dinosaur", -68000000, 47.00, -106.00, 5, 4, 58000,
    CL["natural_world"], ["t rex", "tyrannosaurus", "king of dinosaurs"],
    "Vanished 66 million years ago, at the end of an era of reptiles.",
    "Floodplains of what is now Montana, in Hell Creek rock.",
    "The most famous predatory dinosaur.",
    "Its bite was the strongest of any land animal ever measured.",
    "The most complete skeleton of its kind sold for over 30 million dollars.",
    [("Blue Whale", "SHARED_GIANTS"), ("Galapagos Tortoise", "SHARED_REPTILE_LINEAGE")])

ent("Axolotl", "Neotenic Salamander", 1798, 19.28, -99.10, 5, 1, 40000,
    CL["americas"], ["axolotl salamander", "mexican walking fish"],
    "Described by science in 1798 from specimens of a Mexican lake.",
    "The canals of Xochimilco, in Mexico City.",
    "A salamander that never grows up.",
    "It can regrow its heart, limbs, and parts of its brain.",
    "Named for an Aztec god who transformed to escape sacrifice.",
    [("Giant Panda", "SHARED_CONSERVATION_ICONS"), ("Lake Baikal", "SHARED_FRESHWATER")])

ent("Rafflesia", "Corpse Flower Plant", 1818, -0.50, 101.50, 5, 3, 26000,
    CL["natural_world"], ["corpse flower", "rafflesia arnoldii"],
    "Documented by a colonial expedition in Sumatra in 1818.",
    "Rainforests of Sumatra and Borneo.",
    "The plant bearing the largest single flower in the world.",
    "It has no stem, no leaves, and no roots of its own.",
    "It smells of rotting meat to summon pollinating flies.",
    [("General Sherman Tree", "SHARED_GIANT_PLANTS"), ("Monarch Butterfly", "SHARED_POLLEN_WORLD")])

# ---------------------------------------------------------------- DOM 6: MUSIC & AUDIO
ent("Ludwig van Beethoven", "Composer (1770-1827)", 1770, 50.74, 7.10, 6, 1, 58000,
    CL["music_legends"], ["beethoven"],
    "Born in Bonn in 1770; performed for royalty as a child.",
    "A city on the Rhine, in western Germany.",
    "A composer who bridged the classical and romantic eras.",
    "He composed his greatest works while almost totally deaf.",
    "He sawed the legs off his piano to feel its vibrations through the floor.",
    [("Wolfgang Amadeus Mozart", "SHARED_TRADITION"), ("Vincent van Gogh", "SHARED_SUFFERING_GENIUS")])

ent("Wolfgang Amadeus Mozart", "Composer (1756-1791)", 1756, 47.81, 13.04, 6, 1, 58000,
    CL["music_legends"], ["mozart", "amadeus"],
    "Born in Salzburg in 1756; touring Europe's courts by age six.",
    "An Austrian city beneath a fortress, on the Salzach river.",
    "A child-prodigy composer of the classical era.",
    "He wrote over 600 works and died at 35.",
    "He could write out a complex piece after hearing it once.",
    [("Ludwig van Beethoven", "SHARED_TRADITION"), ("Jane Austen", "SHARED_CENTURY")])

ent("The Beatles", "Rock Band", 1960, 53.41, -2.99, 6, 2, 62000,
    CL["music_legends"], ["beatles", "fab four"],
    "Formed in 1960; conquered America four years later.",
    "A port city in the northwest of England.",
    "The best-selling music act of all time.",
    "Their drummer was replaced weeks before their first hit.",
    "They stopped touring because screaming fans drowned out the music.",
    [("Elvis Presley", "SHARED_ROCK_PIONEERS"), ("Bob Dylan", "SHARED_1960S_ICONS")])

ent("Phonograph", "Sound Recording Invention", 1877, 40.54, -74.36, 6, 3, 42000,
    CL["everyday"], ["first phonograph", "edison phonograph"],
    "First demonstrated in December 1877 with a nursery rhyme.",
    "An invention laboratory in Menlo Park, New Jersey.",
    "The first machine to record and replay sound.",
    "Its inventor shouted into it and heard his own voice return.",
    "The first recording ever made was 'Mary Had a Little Lamb'.",
    [("MP3 Format", "SHARED_AUDIO_LINEAGE"), ("World Wide Web", "SHARED_MEDIA_REVOLUTIONS")])

ent("Jazz", "Music Genre", 1917, 29.95, -90.07, 6, 4, 48000,
    CL["americas"], ["jazz music", "jazz origins"],
    "Its first records were cut in 1917, in a New York studio.",
    "Born in the dance halls of New Orleans.",
    "An improvisational music genre blending African and European roots.",
    "A river city's funeral parades helped shape its sound.",
    "Its musicians 'trade fours' — four bars each, in conversation.",
    [("Hip Hop", "SHARED_AMERICAN_GENRES"), ("Elvis Presley", "SHARED_AMERICAN_SOUND")])

ent("Elvis Presley", "Singer (1935-1977)", 1935, 34.66, -88.71, 6, 2, 58000,
    CL["music_legends"], ["elvis", "king of rock and roll"],
    "Born in a two-room house in Tupelo, Mississippi, in 1935.",
    "A small town in Mississippi; fame found him in Memphis.",
    "The singer called the King of Rock and Roll.",
    "His first record was a birthday gift for his mother.",
    "He never performed outside North America.",
    [("The Beatles", "SHARED_ROCK_PIONEERS"), ("Muhammad Ali", "SHARED_ERA_ICONS")])

ent("MP3 Format", "Audio Compression Format", 1993, 49.59, 11.00, 6, 3, 44000,
    CL["computing"], ["mp3", "mpeg audio layer iii"],
    "Standardised in 1993 after a decade of psychoacoustic research.",
    "An institute in Erlangen, Germany.",
    "The compression standard that put music on the internet.",
    "It deletes sounds the human ear barely notices.",
    "Its test song was an a cappella track played thousands of times.",
    [("Phonograph", "SHARED_AUDIO_LINEAGE"), ("World Wide Web", "SHARED_DIGITAL_ERA")])

ent("Bob Dylan", "Singer-Songwriter (b. 1941)", 1941, 46.79, -92.10, 6, 2, 54000,
    CL["music_legends"], ["dylan", "bob dylan"],
    "Born in Duluth, Minnesota, in 1941; reinvented himself in New York at 19.",
    "A port town on Lake Superior, in the American North.",
    "A songwriter who won literature's highest prize.",
    "He outraged folk purists by plugging in an electric guitar in 1965.",
    "The only songwriter to win the Nobel Prize in Literature.",
    [("The Beatles", "SHARED_1960S_ICONS"), ("William Shakespeare", "SHARED_NOBEL_DEBATE")])

ent("Hip Hop", "Music & Culture Movement", 1973, 40.88, -73.86, 6, 4, 52000,
    CL["americas"], ["hip hop origins", "hip-hop culture"],
    "Born at a birthday party in the Bronx on 11 August 1973.",
    "A recreation room at 1520 Sedgwick Avenue, New York.",
    "A cultural movement of DJs, MCs, breakers, and writers.",
    "Its founding DJ looped drum breaks between two turntables.",
    "It grew from block parties into the world's dominant pop culture.",
    [("Jazz", "SHARED_AMERICAN_GENRES"), ("Super Mario Bros.", "SHARED_ERA_CULTURE")])

# ---------------------------------------------------------------- DOM 7: LITERATURE & PRINT
ent("William Shakespeare", "Playwright & Poet (1564-1616)", 1564, 52.19, -1.71, 7, 1, 62000,
    CL["europe_old"], ["shakespeare", "the bard"],
    "Baptised in 1564 in a Warwickshire market town.",
    "Stratford-upon-Avon, in the English Midlands.",
    "The most influential playwright in the English language.",
    "His company built a famous round theatre on the Thames.",
    "He coined or popularised over 1,700 English words.",
    [("Charles Dickens", "SHARED_ENGLISH_LETTERS"), ("Bob Dylan", "SHARED_NOBEL_DEBATE")])

ent("Don Quixote", "Novel (1605)", 1605, 40.42, -3.70, 7, 2, 46000,
    CL["europe_old"], ["don quixote novel", "cervantes novel"],
    "Published in Madrid in 1605; its sequel followed ten years on.",
    "La Mancha, in the heart of Spain.",
    "Often called the first modern novel.",
    "Its author lost the use of a hand fighting at sea.",
    "Its hero famously charges at windmills he mistakes for giants.",
    [("The Odyssey", "SHARED_EPIC_LINEAGE"), ("One Hundred Years of Solitude", "SHARED_LANGUAGE_LINEAGE")])

ent("The Odyssey", "Epic Poem", -725, 38.42, 20.72, 7, 2, 54000,
    CL["ancient_med"], ["odyssey", "homer epic"],
    "Composed around the 8th century BCE, sung long before it was written.",
    "Anchored on a small Ionian island, Ithaca.",
    "An epic poem of a hero's ten-year voyage home.",
    "Its blind poet may have been a tradition rather than one man.",
    "Its hero's homecoming is delayed by gods, monsters, and the sea.",
    [("Don Quixote", "SHARED_EPIC_LINEAGE"), ("Founding of Rome", "SHARED_ANCIENT_WORLD")])

ent("Gutenberg Printing Press", "Printing Technology", 1440, 50.00, 8.27, 7, 3, 48000,
    CL["europe_old"], ["gutenberg press", "movable type press"],
    "Working by about 1440 in a Rhine city workshop.",
    "Mainz, on the Rhine in Germany.",
    "The movable-type machine that flooded Europe with books.",
    "Its inventor was a goldsmith who borrowed heavily to build it.",
    "Within fifty years, presses had printed more books than all previous scribes.",
    [("Paper", "SHARED_PRINT_LINEAGE"), ("World Wide Web", "SHARED_INFORMATION_REVOLUTIONS")])

ent("Jane Austen", "Novelist (1775-1817)", 1775, 51.24, -1.22, 7, 1, 50000,
    CL["europe_old"], ["austen", "pride and prejudice author"],
    "Born in a Hampshire rectory in 1775, seventh of eight children.",
    "Steventon, a village in Hampshire, England.",
    "A novelist of manners, money, and marriage.",
    "She published anonymously in her lifetime: 'By a Lady'.",
    "She wrote her sharpest novels on a tiny round table.",
    [("Charles Dickens", "SHARED_ENGLISH_LETTERS"), ("Frankenstein", "SHARED_ERA_WOMEN_WRITERS")])

ent("One Hundred Years of Solitude", "Novel (1967)", 1967, -34.60, -58.38, 7, 2, 42000,
    CL["americas"], ["cien años de soledad", "garcia marquez novel"],
    "Published in Buenos Aires in 1967 after its author pawned his belongings.",
    "A fictional town in Colombia; printed first in Argentina.",
    "The defining novel of magical realism.",
    "Its author wrote it in a rented room, smoking and refusing visitors.",
    "Six generations of one family share a handful of repeating names.",
    [("Don Quixote", "SHARED_LANGUAGE_LINEAGE"), ("Frankenstein", "SHARED_FICTION_LINEAGE")])

ent("The Tale of Genji", "Novel (c. 1008)", 1008, 35.01, 135.77, 7, 2, 36000,
    CL["east_asia"], ["genji monogatari", "tale of genji"],
    "Written around 1008 by a lady-in-waiting at an imperial court.",
    "The imperial capital of Heian, now Kyoto, Japan.",
    "Often called the world's first novel.",
    "Its author wrote it in a script then considered women's writing.",
    "It runs to over a thousand pages in modern translation.",
    [("Fall of Constantinople", "SHARED_CENTURY_WORLD"), ("Kimono", "SHARED_COURT_CULTURE")])

ent("Frankenstein", "Novel (1818)", 1818, 46.20, 6.14, 7, 2, 52000,
    CL["europe_old"], ["frankenstein novel", "mary shelley novel"],
    "Published anonymously in 1818; its author was twenty years old.",
    "Conceived at a villa on Lake Geneva during a year without summer.",
    "A gothic novel that invented science fiction.",
    "It began as a ghost-story contest among poets on a stormy night.",
    "Its 'monster' is never given a name.",
    [("Jane Austen", "SHARED_ERA_WOMEN_WRITERS"), ("One Hundred Years of Solitude", "SHARED_FICTION_LINEAGE")])

ent("Charles Dickens", "Novelist (1812-1870)", 1812, 50.80, -1.09, 7, 1, 54000,
    CL["europe_old"], ["dickens", "a christmas carol author"],
    "Born in Portsmouth in 1812; sent to a boot-blacking factory at twelve.",
    "A naval port on England's south coast.",
    "The defining novelist of Victorian England.",
    "Crowds in New York mobbed ships carrying his next instalments.",
    "He performed his own works on stage until it ruined his health.",
    [("William Shakespeare", "SHARED_ENGLISH_LETTERS"), ("Jane Austen", "SHARED_ENGLISH_LETTERS")])

# ---------------------------------------------------------------- DOM 8: SPORTS & GAMES
ent("First Modern Olympic Games", "Sporting Event (1896)", 1896, 37.97, 23.72, 8, 1, 48000,
    CL["modern_sport"], ["athens 1896 olympics", "first olympics modern"],
    "Held in April 1896, reviving a festival dormant for 1,500 years.",
    "A marble stadium in Athens, Greece.",
    "The revival edition of an ancient Greek festival of sport.",
    "Winners received silver medals and olive branches.",
    "The marathon was invented for it, from a legend of a runner-messenger.",
    [("Marathon (Race)", "INVENTED_THE_RACE"), ("Aristotle", "SHARED_GREEK_WORLD")])

ent("First FIFA World Cup", "Football Tournament (1930)", 1930, -34.90, -56.16, 8, 1, 46000,
    CL["modern_sport"], ["1930 world cup", "first world cup uruguay"],
    "Played in July 1930; only thirteen teams made the journey.",
    "Montevideo, the capital of Uruguay.",
    "The inaugural edition of football's global championship.",
    "Four European teams crossed the Atlantic together by ship.",
    "The host nation won it, beating its river-plate rival in the final.",
    [("First Modern Olympic Games", "SHARED_GLOBAL_SPORT"), ("Muhammad Ali", "SHARED_SPORTING_CENTURY")])

ent("Chess", "Board Game", 600, 25.32, 82.99, 8, 2, 54000,
    CL["east_asia"], ["chess origins", "chaturanga"],
    "Emerged in northern India around the 6th century CE.",
    "Born in the Gupta-era courts of northern India.",
    "The world's most studied strategy board game.",
    "Its ancestor's pieces mirrored an army: elephants, chariots, cavalry.",
    "The queen only became its strongest piece in the 15th century.",
    [("Go (Board Game)", "SHARED_ANCIENT_GAMES"), ("Concept of Zero", "SHARED_CIVILISATION_GIFTS")])

ent("Muhammad Ali", "Boxer (1942-2016)", 1942, 38.25, -85.76, 8, 3, 58000,
    CL["modern_sport"], ["ali", "cassius clay", "the greatest boxer"],
    "Born in Louisville, Kentucky, in 1942.",
    "A river city in Kentucky, in the American South.",
    "A heavyweight boxer and global cultural figure.",
    "He took up boxing after his bicycle was stolen at age twelve.",
    "He lit the Olympic flame in 1996, hands trembling.",
    [("Elvis Presley", "SHARED_ERA_ICONS"), ("Usain Bolt", "SHARED_SPORTING_GREATS")])

ent("Pong", "Video Game (1972)", 1972, 37.38, -122.08, 8, 4, 40000,
    CL["computing"], ["pong arcade", "atari pong"],
    "Installed in a California bar in November 1972.",
    "Sunnyvale, in what became Silicon Valley.",
    "The first commercially successful video game.",
    "Its prototype broke down because the coin box overflowed.",
    "Two paddles, one square ball, endless arguments.",
    [("Super Mario Bros.", "SHARED_VIDEO_GAME_LINEAGE"), ("ENIAC", "SHARED_COMPUTING_LINEAGE")])

ent("Usain Bolt", "Sprinter (b. 1986)", 1986, 18.40, -77.38, 8, 3, 54000,
    CL["modern_sport"], ["bolt", "fastest man alive"],
    "Born in rural Jamaica in 1986, a cricket and football player first.",
    "Sherwood Content, a small town in Jamaica's hills.",
    "The fastest sprinter ever timed.",
    "He won an Olympic final with an untied shoelace.",
    "He holds world records at 100m, 200m, and the relay.",
    [("Muhammad Ali", "SHARED_SPORTING_GREATS"), ("Marathon (Race)", "SHARED_RUNNING")])

ent("Marathon (Race)", "Long-Distance Race", -490, 38.15, 23.96, 8, 1, 44000,
    CL["ancient_med"], ["marathon origin", "pheidippides"],
    "Rooted in a run made in 490 BCE after a famous battle.",
    "A plain and town northeast of Athens, Greece.",
    "The long-distance road event of 42.195 kilometres.",
    "Its legend: a messenger ran from a battlefield, announced victory, and died.",
    "Its modern distance was fixed by a royal viewing box in 1908.",
    [("First Modern Olympic Games", "RACE_IT_INSPIRED"), ("Usain Bolt", "SHARED_RUNNING")])

ent("Super Mario Bros.", "Video Game (1985)", 1985, 35.01, 135.77, 8, 4, 56000,
    CL["east_asia"], ["mario 1985", "super mario bros nes"],
    "Released in Japan in September 1985 for a home console.",
    "Designed in Kyoto, Japan.",
    "The best-known platform video game ever made.",
    "Its hero began as a carpenter in an earlier arcade game.",
    "Its first level is designed to teach the game without words.",
    [("Pong", "SHARED_VIDEO_GAME_LINEAGE"), ("Hip Hop", "SHARED_ERA_CULTURE")])

ent("Go (Board Game)", "Abstract Strategy Game", -2300, 34.75, 113.62, 8, 2, 42000,
    CL["east_asia"], ["go game", "weiqi", "baduk"],
    "Legend places its invention over 4,000 years ago in ancient China.",
    "The courts of ancient China, along the Yellow River.",
    "The oldest contest of strategy still played in its original form.",
    "It has more possible positions than atoms in the observable universe.",
    "A computer only mastered it in 2016, decades after chess fell.",
    [("Chess", "SHARED_ANCIENT_GAMES"), ("Confucius", "SHARED_CIVILISATION")])

# ---------------------------------------------------------------- DOM 9: ART & ARCHITECTURE
ent("Mona Lisa", "Renaissance Portrait", 1503, 43.77, 11.25, 9, 1, 62000,
    CL["art_masters"], ["mona lisa painting", "la gioconda"],
    "Begun in Florence in 1503 and carried by its painter for years.",
    "Painted in Florence, Italy; now behind glass in Paris.",
    "The most famous portrait painting in the world.",
    "Its sitter was the wife of a Florentine silk merchant.",
    "It became world-famous only after being stolen in 1911.",
    [("Michelangelo", "SHARED_RENAISSANCE"), ("Sistine Chapel Ceiling", "SHARED_RENAISSANCE")])

ent("Vincent van Gogh", "Painter (1853-1890)", 1853, 51.47, 4.67, 9, 2, 60000,
    CL["art_masters"], ["van gogh", "starry night painter"],
    "Born in a Dutch village parsonage in 1853.",
    "Zundert, a village in the southern Netherlands.",
    "A post-impressionist painter unrecognised in his lifetime.",
    "He sold almost nothing while alive and depended on his brother.",
    "He painted his most famous night sky from an asylum window.",
    [("Ludwig van Beethoven", "SHARED_SUFFERING_GENIUS"), ("The Great Wave off Kanagawa", "SHARED_ERA_MASTERS")])

ent("Taj Mahal", "Mausoleum", 1632, 27.17, 78.04, 9, 3, 58000,
    CL["east_asia"], ["taj mahal agra"],
    "Commissioned in 1632 and built over two decades.",
    "The bank of the Yamuna river at Agra, India.",
    "A white-marble mausoleum, jewel of Mughal architecture.",
    "An emperor built it for his favourite wife, who died in childbirth.",
    "Its marble changes colour with the light, pink at dawn, gold by moonlight.",
    [("Great Wall of China", "SHARED_ASIAN_ICON"), ("Bollywood", "SHARED_COUNTRY_ICONS")])

ent("Sistine Chapel Ceiling", "Fresco Cycle", 1508, 41.90, 12.45, 9, 1, 54000,
    CL["art_masters"], ["sistine ceiling", "michelangelo ceiling"],
    "Painted between 1508 and 1512, lying on a scaffold of his own design.",
    "Inside the Vatican palace, Rome, where conclaves elect popes.",
    "The most famous fresco cycle of the Renaissance.",
    "Its painter considered himself a sculptor and took the job unwillingly.",
    "Two fingertips nearly touching became art's most copied image.",
    [("Michelangelo", "PAINTED_BY"), ("Mona Lisa", "SHARED_RENAISSANCE")])

ent("Pablo Picasso", "Artist (1881-1973)", 1881, 36.72, -4.42, 9, 2, 58000,
    CL["art_masters"], ["picasso", "cubism founder"],
    "Born in Málaga, Spain, in 1881; his first word was reportedly 'pencil'.",
    "A port city in Andalusia, southern Spain.",
    "A co-founder of cubism and the most prolific major artist.",
    "He could draw academically like a master before his teens.",
    "His anti-war mural of a bombed Basque town became a universal symbol.",
    [("Vincent van Gogh", "SHARED_MODERN_MASTERS"), ("Bauhaus", "SHARED_MODERNISM")])

ent("Sydney Opera House", "Performing Arts Centre", 1973, -33.86, 151.21, 9, 3, 52000,
    CL["modern_sport"], ["opera house sydney"],
    "Opened in 1973, fourteen years after construction began.",
    "A headland in a famous Australian harbour.",
    "An expressionist landmark of sail-like shells.",
    "Its architect resigned mid-build and never saw it finished.",
    "Every shell is cut from the surface of a single sphere.",
    [("Statue of Liberty", "SHARED_HARBOUR_ICONS"), ("Bauhaus", "SHARED_MODERN_ARCHITECTURE")])

ent("The Great Wave off Kanagawa", "Woodblock Print (c. 1831)", 1831, 35.68, 139.69, 9, 1, 48000,
    CL["east_asia"], ["great wave", "hokusai wave"],
    "Published around 1831 as part of a series of thirty-six views.",
    "Printed in Edo, now Tokyo, Japan.",
    "The most famous Japanese woodblock print.",
    "Its blue came from a newly imported pigment, Prussian blue.",
    "The sacred mountain in the distance is dwarfed by the claw of water framing it.",
    [("Vincent van Gogh", "SHARED_ERA_MASTERS"), ("The Tale of Genji", "SHARED_CULTURE")])

ent("Michelangelo", "Artist & Sculptor (1475-1564)", 1475, 43.65, 11.98, 9, 2, 58000,
    CL["art_masters"], ["michelangelo buonaroti", "david sculptor"],
    "Born in 1475 in a Tuscan hill town of stonecutters.",
    "Caprese, in the hills of Tuscany, Italy.",
    "The sculptor-painter who defined the High Renaissance.",
    "He carved his most famous giant from a rejected block of marble.",
    "He signed only one work: across the sash of a Madonna.",
    [("Sistine Chapel Ceiling", "PAINTED"), ("Mona Lisa", "SHARED_RENAISSANCE")])

ent("Bauhaus", "Art & Design School", 1919, 50.97, 11.32, 9, 4, 40000,
    CL["europe_old"], ["bauhaus school", "bauhaus movement"],
    "Founded in Weimar in 1919, in a defeated and rebuilding Germany.",
    "Weimar, then Dessau, in Germany.",
    "The school that fused craft, art, and industrial design.",
    "Political pressure forced it to close in 1933 after fourteen years.",
    "Its teachers included Kandinsky and Klee.",
    [("Pablo Picasso", "SHARED_MODERNISM"), ("Sydney Opera House", "SHARED_MODERN_ARCHITECTURE")])

# ---------------------------------------------------------------- DOM 10: MYTHOLOGY & PHILOSOPHY
ent("Zeus", "Mythological Deity", -800, 40.08, 22.36, 10, 1, 54000,
    CL["ancient_med"], ["zeus god", "king of olympus"],
    "Sung into form by the 8th century BCE in Greek epic.",
    "His throne sits on the highest mountain of Greece.",
    "The sky and thunder god who rules a pantheon.",
    "He overthrew his own father, who had swallowed his siblings.",
    "His weapon, the lightning bolt, was forged by one-eyed giants.",
    [("Thor", "SHARED_THUNDER_GODS"), ("The Odyssey", "SHARED_PANTHEON")])

ent("Socrates", "Philosopher (c. 470-399 BCE)", -469, 37.98, 23.73, 10, 2, 52000,
    CL["philosophy"], ["socrates philosopher"],
    "Born near Athens around 470 BCE; executed by its vote in 399.",
    "The agora of Athens, Greece.",
    "The founder of Western philosophy's questioning method.",
    "He wrote nothing; everything known comes from his students.",
    "Condemned to death, he drank hemlock and discussed the soul to the end.",
    [("Plato", "TEACHER_OF"), ("Aristotle", "SHARED_SCHOOL_LINEAGE")])

ent("Plato", "Philosopher (c. 428-348 BCE)", -427, 37.98, 23.73, 10, 2, 52000,
    CL["philosophy"], ["plato philosopher", "the republic author"],
    "Born in Athens around 428 BCE into an aristocratic family.",
    "Athens, where he founded a famous grove school.",
    "A philosopher of ideal forms and the ideal state.",
    "His school, the Academy, ran for nearly 900 years.",
    "He wrote in dialogues, always through his teacher's voice.",
    [("Socrates", "STUDENT_OF"), ("Aristotle", "TEACHER_OF")])

ent("Aristotle", "Philosopher (384-322 BCE)", -384, 40.59, 23.79, 10, 2, 54000,
    CL["philosophy"], ["aristotle philosopher"],
    "Born in Stagira in 384 BCE; studied in Athens for twenty years.",
    "A coastal town in northern Greece, Chalcidice.",
    "The philosopher who systematised logic, biology, and ethics.",
    "He tutored a young prince who became a world conqueror.",
    "He classified over 500 animal species by dissection and report.",
    [("Plato", "STUDENT_OF"), ("First Modern Olympic Games", "SHARED_GREEK_WORLD")])

ent("Confucius", "Philosopher (551-479 BCE)", -551, 35.59, 116.99, 10, 2, 54000,
    CL["philosophy"], ["confucius", "kongzi", "master kong"],
    "Born in 551 BCE in a small state of a fragmenting China.",
    "Qufu, in the state of Lu, now Shandong, China.",
    "The teacher whose ethics shaped East Asia for two millennia.",
    "He spent fourteen years wandering between courts seeking employment.",
    "His sayings were compiled by disciples after his death.",
    [("Great Wall of China", "SHARED_CIVILISATION"), ("Go (Board Game)", "SHARED_CIVILISATION"), ("Sun Tzu", "SHARED_SPRING_AUTUMN_ERA")])

ent("Sun Tzu", "Military Strategist", -500, 31.30, 120.58, 10, 3, 44000,
    CL["philosophy"], ["sun tzu", "art of war author"],
    "Traditionally placed around 500 BCE, serving a southern kingdom.",
    "The state of Wu, near modern Suzhou, China.",
    "The attributed author of the most famous treatise on strategy.",
    "Legend says he trained the king's concubines as a demonstration unit.",
    "His book's core advice: subdue the enemy without fighting.",
    [("Confucius", "SHARED_SPRING_AUTUMN_ERA"), ("Chess", "SHARED_STRATEGY_WORLD")])

ent("Thor", "Mythological Deity", 1220, 64.15, -21.94, 10, 1, 52000,
    CL["europe_old"], ["thor god", "norse thunder god"],
    "His surviving tales were written down in Iceland around 1220.",
    "His stories were preserved in Iceland, at the North Atlantic's edge.",
    "The Norse god of thunder and protector of mankind.",
    "His hammer's handle is short because a fly bit the smith mid-forge.",
    "He is fated to kill a world-serpent and walk nine steps before falling.",
    [("Zeus", "SHARED_THUNDER_GODS"), ("Dragons (Mythical)", "SHARED_MYTHIC_FOES")])

ent("Anubis", "Mythological Deity", -3000, 29.98, 31.13, 10, 1, 42000,
    CL["ancient_med"], ["anubis god", "jackal god"],
    "Worshipped from Egypt's earliest dynasties, before 3000 BCE.",
    "The necropolises of the Nile valley, Egypt.",
    "The jackal-headed god of mummification and the dead.",
    "He weighed the hearts of the dead against a feather.",
    "Priests wore his mask while preparing the royal dead.",
    [("Great Pyramid of Giza", "SHARED_CIVILISATION"), ("Sahara", "SHARED_REGION")])

ent("Dragons (Mythical)", "Mythical Creature", -2000, None, None, 10, 1, 48000,
    CL["philosophy"], ["dragons", "dragon mythology"],
    "Carved and told of for at least four thousand years, on every continent.",
    "CONCEPTUAL / NON-SPATIAL: they nest in the myths of every culture.",
    "The universal creature of human storytelling, found in every culture's tales.",
    "Guardians of gold in the West; bringers of rain in the East.",
    "No culture that imagined them ever produced a bone.",
    [("Thor", "SHARED_MYTHIC_FOES"), ("Zeus", "SHARED_MYTHIC_WORLD")])

# ---------------------------------------------------------------- DOM 11: SPACE & ASTRONOMY
ent("Halley's Comet", "Periodic Comet", 1758, None, None, 11, 1, 48000,
    CL["deep_space"], ["halley comet", "1p halley"],
    "Its 1758 return was predicted decades ahead, a triumph of gravitation.",
    "CONCEPTUAL / NON-SPATIAL: an icy visitor on a 76-year orbit.",
    "The most famous periodic visitor to the inner solar system.",
    "It was recorded by Chinese astronomers as early as 240 BCE.",
    "A famous English astronomer saw it, computed it, and never lived to see it return.",
    [("Orion Constellation", "SHARED_NIGHT_SKY"), ("Special Relativity", "SHARED_GRAVITY_STORY")])

ent("Andromeda Galaxy", "Spiral Galaxy", 964, None, None, 11, 2, 46000,
    CL["deep_space"], ["andromeda", "m31 galaxy"],
    "First recorded in 964 by a Persian astronomer as a 'little cloud'.",
    "CONCEPTUAL / NON-SPATIAL: 2.5 million light-years from Earth.",
    "The nearest large spiral star-city to our own.",
    "It is approaching us and will merge with our own in billions of years.",
    "It holds roughly a trillion stars, more than our own.",
    [("Milky Way Galaxy", "FUTURE_COLLISION_PARTNER"), ("Pillars of Creation", "SHARED_DEEP_IMAGERY")])

ent("Milky Way Galaxy", "Our Home Galaxy", 1610, None, None, 11, 2, 56000,
    CL["deep_space"], ["milky way", "our galaxy"],
    "In 1610 a telescope first resolved its glow into countless stars.",
    "CONCEPTUAL / NON-SPATIAL: we observe it from inside.",
    "The barred spiral star system containing our solar system.",
    "Its name comes from a Greek myth of spilled milk.",
    "We have never seen it from outside; every full image is an illustration.",
    [("Andromeda Galaxy", "NEIGHBOUR_GALAXY"), ("Sagittarius A*", "HOSTS_AT_ITS_CENTRE")])

ent("Sagittarius A*", "Supermassive Black Hole", 2022, None, None, 11, 3, 44000,
    CL["deep_space"], ["sagittarius a star", "milky way black hole"],
    "Its first direct image was released in May 2022.",
    "CONCEPTUAL / NON-SPATIAL: at the centre of our galaxy, 27,000 light-years away.",
    "The supermassive black hole anchoring our galaxy.",
    "It weighs four million times the mass of the Sun.",
    "Stars near it whip around at a measurable fraction of light speed.",
    [("Milky Way Galaxy", "SITS_AT_CENTRE_OF"), ("Special Relativity", "CONFIRMS_PREDICTIONS_OF")])

ent("Kepler-186f", "Exoplanet", 2014, None, None, 11, 4, 24000,
    CL["deep_space"], ["kepler 186f", "earth cousin planet"],
    "Announced in April 2014 from a retired space telescope's data.",
    "CONCEPTUAL / NON-SPATIAL: about 580 light-years away, in Cygnus.",
    "The first Earth-size planet found in another star's habitable zone.",
    "Its sun is a red dwarf, so its noon sky would glow like our sunset.",
    "A radio signal from Earth would take 580 years to reach it.",
    [("Hubble Space Telescope", "SHARED_SPACE_OBSERVING"), ("Orion Constellation", "SHARED_CONSTELLATION_SKY")])

ent("Orion Constellation", "Constellation", -1500, None, None, 11, 5, 44000,
    CL["deep_space"], ["orion", "the hunter constellation"],
    "Named for a hunter of Greek myth, mapped since Babylonian star lists.",
    "CONCEPTUAL / NON-SPATIAL: a pattern of stars straddling the celestial equator.",
    "The most recognisable star pattern in the night sky.",
    "Three stars in a row form its famous belt.",
    "Ancient Egyptians aligned pyramid shafts toward its stars.",
    [("Halley's Comet", "SHARED_NIGHT_SKY"), ("Kepler-186f", "SHARED_CONSTELLATION_SKY")])

ent("Hubble Space Telescope", "Space Observatory", 1990, 28.57, -80.65, 11, 6, 52000,
    CL["space_race"], ["hubble telescope", "hst"],
    "Launched in April 1990; its mirror was flawed by a hair's width.",
    "Lifted into orbit from the Florida cape.",
    "The most productive orbiting observatory ever flown.",
    "Astronauts repaired its vision with orbiting surgery in 1993.",
    "It has taken over 1.6 million observations from above the atmosphere.",
    [("NASA", "OPERATED_BY"), ("Pillars of Creation", "PHOTOGRAPHED")])

ent("Pillars of Creation", "Star-Forming Nebula", 1995, None, None, 11, 7, 38000,
    CL["deep_space"], ["pillars of creation nebula", "eagle nebula pillars"],
    "Photographed in April 1995, becoming astronomy's most famous image.",
    "CONCEPTUAL / NON-SPATIAL: towers of gas 6,500 light-years away.",
    "Columns of cold gas where new stars are being born.",
    "They may already be destroyed; the light of their end has not reached us.",
    "Each column is several light-years tall.",
    [("Hubble Space Telescope", "PHOTOGRAPHED_BY"), ("Andromeda Galaxy", "SHARED_DEEP_IMAGERY")])

ent("Betelgeuse", "Red Supergiant Star", 1836, None, None, 11, 8, 42000,
    CL["deep_space"], ["betelgeuse star", "orion shoulder star"],
    "Its pulsing brightness was first charted in the 1830s.",
    "CONCEPTUAL / NON-SPATIAL: the shoulder of a mythical hunter.",
    "A red supergiant star nearing the end of its life.",
    "It suddenly dimmed in 2019, sparking supernova watch worldwide.",
    "Placed at our Sun's position, it would swallow Jupiter's orbit.",
    [("Orion Constellation", "SHOULDER_OF"), ("Halley's Comet", "SHARED_NIGHT_SKY")])

# ---------------------------------------------------------------- DOM 12: CULTURAL INVENTIONS
ent("Cuneiform Writing", "Writing System", -3400, 32.54, 44.42, 12, 1, 40000,
    CL["ancient_med"], ["cuneiform", "first writing"],
    "Pressed into clay in Mesopotamia around 3400 BCE.",
    "The city of Uruk, in what is now Iraq.",
    "The earliest known system for recording language.",
    "It began as accountants' tokens for grain, beer, and livestock.",
    "Its wedge marks were made with a cut reed stylus.",
    [("Paper", "SHARED_RECORD_LINEAGE"), ("Concept of Zero", "SHARED_ANCIENT_SYSTEMS")])

ent("Paper", "Writing Material", 105, 34.62, 112.45, 12, 1, 46000,
    CL["east_asia"], ["paper invention", "cai lun paper"],
    "Its refined process was reported to an emperor in 105 CE.",
    "Luoyang, capital of Han-dynasty China.",
    "The plant-fibre sheet that carried civilisation's records.",
    "Its improver was a court eunuch working with bark, rags, and nets.",
    "The secret travelled west along trade routes for six centuries.",
    [("Gutenberg Printing Press", "SHARED_PRINT_LINEAGE"), ("Cuneiform Writing", "SHARED_RECORD_LINEAGE")])

ent("Coffee", "Beverage & Crop", 850, 9.03, 38.74, 12, 2, 54000,
    CL["everyday"], ["coffee origins", "coffee plant"],
    "Legend gives it to a 9th-century goatherd who noticed dancing goats.",
    "The highlands of Ethiopia, in the Horn of Africa.",
    "The world's most traded tropical beverage crop.",
    "Sufi monks used it to stay awake through night prayers.",
    "It was banned at times in Mecca, Cairo, and Constantinople.",
    [("Pizza", "SHARED_TABLE_CULTURE"), ("Chocolate", "SHARED_COLONIAL_CROPS")])

ent("Pizza", "Food", 1889, 40.85, 14.27, 12, 2, 56000,
    CL["everyday"], ["pizza naples", "pizza margherita"],
    "A queen's namesake version was created in Naples in 1889.",
    "The port city of Naples, Italy.",
    "The world's most popular flatbread dish.",
    "Its royal version wears the colours of a national flag.",
    "Americans eat roughly 13 kilograms of it per person each year.",
    [("Coffee", "SHARED_TABLE_CULTURE"), ("Eiffel Tower", "SHARED_1889")])

ent("Chopsticks", "Eating Utensils", -1200, 34.75, 113.62, 12, 3, 38000,
    CL["east_asia"], ["chopsticks history", "kuaizi"],
    "In use in China by the Shang dynasty, over 3,000 years ago.",
    "The courts and kitchens of ancient China.",
    "The paired-stick utensils feeding a third of humanity.",
    "They likely began as long cooking tools, not eating tools.",
    "A great philosopher advised knives off the table, favouring them.",
    [("Confucius", "SHARED_CULTURE"), ("Paper", "SHARED_CIVILISATION_GIFTS")])

ent("Denim Jeans", "Garment", 1873, 37.77, -122.42, 12, 4, 50000,
    CL["everyday"], ["jeans", "levis jeans", "blue jeans"],
    "Patented in 1873 by a tailor and a dry-goods merchant.",
    "San Francisco, during the long tail of a gold rush.",
    "The riveted work trousers that became a global uniform.",
    "The rivets were added because miners' pockets kept tearing.",
    "The fabric's name traces to a French city, the design to a port in Italy.",
    [("Statue of Liberty", "SHARED_AMERICAN_ICONS"), ("Hip Hop", "SHARED_UNIFORM_OF")])

ent("Kimono", "Traditional Garment", 794, 35.01, 135.77, 12, 4, 36000,
    CL["east_asia"], ["kimono garment"],
    "Took its classic form in the Heian period, from 794 CE.",
    "The imperial capital of Heian, now Kyoto, Japan.",
    "The formal wrapped garment of Japan.",
    "Court ladies layered up to twelve of them in colour harmonies.",
    "It is always wrapped left over right; the reverse is for the dead.",
    [("The Tale of Genji", "SHARED_COURT_CULTURE"), ("Chopsticks", "SHARED_CULTURE")])

ent("Chocolate", "Food & Crop", 1500, 14.90, -92.27, 12, 2, 52000,
    CL["americas"], ["chocolate history", "cacao"],
    "Cultivated and drunk in Mesoamerica for millennia before 1500.",
    "The Soconusco coast of what is now Chiapas, Mexico.",
    "The beloved food made from cacao beans.",
    "For most of its history it was a bitter, spiced drink, not a sweet bar.",
    "Its beans were used as currency in the Aztec empire.",
    [("Coffee", "SHARED_COLONIAL_CROPS"), ("Amazon River", "SHARED_CONTINENT")])

ent("Concept of Zero", "Mathematical Concept", 628, 25.01, 72.25, 12, 5, 42000,
    CL["east_asia"], ["zero invention", "invention of zero"],
    "Given full rules as a number in an Indian text of 628 CE.",
    "Formalised in India, in the region of modern Rajasthan.",
    "The idea of nothing as a number in its own right.",
    "Babylon had a placeholder; India made it a number you can compute with.",
    "Without it, no calculus, no computers, no binary code.",
    [("Chess", "SHARED_CIVILISATION_GIFTS"), ("Cuneiform Writing", "SHARED_ANCIENT_SYSTEMS"), ("Turing Machine", "SHARED_FOUNDATIONS")])
