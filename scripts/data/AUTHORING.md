# NEXUS RELAY dataset v2 — authoring guide

The game: a mystery subject is described by 5 clues that arrive one at a
time, **vague → obvious**. From clue 1 the player sees 4 answer cards (the
answer + 3 distractors that the game picks automatically from the SAME
category, preferring the same `sub` and a similar year). Earlier correct
answers score more. After a correct answer, a bonus asks "Which of these is
connected to <answer>?" using the subject's `links`.

## File

`public/data/v2/subjects/<category>.json`:

```json
{
  "category": "landmarks",
  "subjects": [
    {
      "id": "eiffel-tower",
      "name": "Eiffel Tower",
      "aliases": ["Tour Eiffel"],
      "category": "landmarks",
      "sub": "Tower",
      "year": 1889,
      "region": "Europe",
      "difficulty": 1,
      "clues": [
        "This iron lattice structure was meant to stand for only twenty years.",
        "It was built as the entrance arch to the 1889 World's Fair.",
        "Its engineer's company also built the inner frame of the Statue of Liberty.",
        "It is repainted about every seven years, using some 60 tonnes of paint.",
        "The tallest landmark on the Champ de Mars in the French capital."
      ],
      "links": [
        { "name": "Paris", "rel": "stands in" },
        { "name": "Statue of Liberty", "rel": "shares an engineer with" }
      ],
      "fact": "It grows about 15 cm taller in summer heat."
    }
  ]
}
```

## Field rules

- `id`: slug of `name` (lowercase, a-z0-9, words joined by `-`; accents dropped; apostrophes removed: "McDonald's" -> "mcdonalds"). Must be unique across the WHOLE dataset.
- `name`: the common English name. `aliases`: other accepted spellings / full names (can be `[]`). Not nicknames.
- `sub`: subcategory, Title Case, singular, REUSED: each `sub` should have at least 4 subjects so distractors look alike ("Actor", "Actress", "Footballer", "Painting", "City", "Country"...).
- `year`: integer anchor or `null`. People = birth year. Films/albums/books/games = release/publication year. Buildings = completion year. Events = start year. Companies/brands = founding year. Inventions = invention year. Countries, cities, animals, foods, natural wonders = `null` (unless a clear anchor exists). BCE = negative.
- `region`: one of `Europe`, `North America`, `Latin America`, `Africa`, `Middle East`, `South Asia`, `East Asia`, `Southeast Asia`, `Oceania`, `Global`, `Space`.
- `difficulty`: 1 = almost everyone knows it, 2 = most people, 3 = keen trivia players. Aim for ~50% 1, ~35% 2, ~15% 3. Everything must still be WELL KNOWN: no obscure subjects.
- `clues`: exactly 5 strings, each 20-150 characters, ordered vague → obvious.
  - Clue 1: true and specific, but would not on its own decide between similar subjects.
  - Clue 5: a near-giveaway, still without the name.
  - By clue 5 only ONE subject in the world should fit.
  - NEVER include the answer's name, any alias, or any identifying word of them or its obvious roots: no "Italian" for Italy, no "Parisian" for Paris, no "Beatle" for The Beatles, no surname for a person. The validator enforces this strictly (it also matches word prefixes, so "Indi…" words are blocked for India, and so on). Rephrase if it complains.
  - Generic words in the name (bridge, tower, river, war, great, king, city, ...) may appear, but never the full name phrase.
  - Write friendly, plain English. No jargon.
- `links`: 1-3 REAL connections `{ "name": "...", "rel": "..." }`, read as "<subject> <rel> <link>", e.g. "Lionel Messi" `plays for` "Argentina". Prefer well-known names that are likely subjects elsewhere in the dataset (countries, cities, famous people, films), written in their common name ("United States", "Paris", "Titanic").
- `fact`: optional one-liner (<= 200 chars) shown after the reveal.

## Correctness

Facts must be correct. If you are not sure of a fact, do not use it; if you are not sure about a subject, leave it out. Avoid facts that change over time (current records, "is the reigning champion", "most followers") unless dated ("by 2020 …"). Avoid controversial or sensitive framing; keep it family-friendly.

## Category boundaries (to avoid duplicates)

| Category id | What belongs |
|---|---|
| `stars` | Actors, actresses, film directors, comedians, TV hosts (people only) |
| `music` | Singers, musicians, rappers, composers (classical too), bands (people/groups only; no songs/albums as subjects) |
| `sport` | Athletes (at least 35) + sports, board games and big tournaments/clubs (Chess, Olympic Games, FIFA World Cup, Real Madrid ...) |
| `minds` | Scientists, inventors, mathematicians, philosophers, doctors, thinkers (Galileo, Einstein, Hawking, Socrates, Confucius ...) |
| `history` | Leaders, rulers, royals, activists, explorers on Earth (at least 30 people) + historic events (wars, revolutions, RMS Titanic, Moon landing is NOT here) |
| `places` | Countries and cities only |
| `landmarks` | Buildings, monuments, bridges, statues + natural wonders (mountains, rivers, waterfalls, deserts, reefs, canyons) |
| `screen` | Films, TV series, animated films, video games, screen characters (Mickey Mouse, Darth Vader ...) |
| `nature` | Animals, dinosaurs, plants, natural phenomena (Aurora, Tornado ...) |
| `food` | Dishes, drinks, fruits/ingredients, food & drink brands (Coca-Cola, McDonald's ...) |
| `tech` | Inventions, gadgets, vehicles, companies and non-food brands, apps/websites |
| `arts` | Paintings, sculptures, painters/sculptors, writers/poets, books, book characters, myths & legends (Zeus, King Arthur ...) |
| `space` | Planets, moons, stars, galaxies, comets, space missions, spacecraft, telescopes, astronauts, space agencies |

Leonardo da Vinci and Michelangelo go in `arts`; Galileo and Copernicus go in `minds`; Neil Armstrong goes in `space`; the Titanic film is "Titanic" (`screen`) while the ship is "RMS Titanic" (`history`).

## Reuse

The old hand-written starter corpus is at `legacy/pipeline/src/dataset_starter.py` (110 entities, high-quality facts). Reuse the entries that fit your categories, rewriting their clues into the vague → obvious format.

## Validate

```powershell
$env:Path='W:\tools\node-v22.23.5-win-x64;'+$env:Path
cd W:\repos_x\Nexus-Relay\Nexus-Relay-main
node scripts/data/build-v2.mjs --only <category>
```

It must report 0 errors. Try to avoid warnings too.
