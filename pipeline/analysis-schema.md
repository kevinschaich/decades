# Song analysis schema

One Claude pass per song produces one record in `analysis.json`. It covers every view (the decade story, theme
river, song galaxy, vocabulary and fingerprints) and is meant to feed future views too, so it records more than
any one chart needs. It never contains lyric text or quotes, only judgements and paraphrase.

Every score is a number in the stated range. Use the whole range. A field that doesn't apply is `null`, not a guess.

```json
{
  "id": "1965-001",
  "lyricsUsable": true,
  "lyricsIssue": null,
  "summary": "A plain paraphrase of what the song is about, at most 20 words, quoting nothing.",
  "themes": { "love_romance": 0.8, "heartbreak": 0.3 },
  "primaryTheme": "love_romance",
  "mood": {
    "valence": 0.4,
    "energy": 0.7,
    "primaryEmotion": "joy",
    "secondaryEmotion": "longing"
  },
  "perspective": {
    "narrator": "first",
    "addressee": "lover",
    "narratorGender": "unspecified"
  },
  "narrative": {
    "storytelling": 0.2,
    "arc": "flat",
    "timeFrame": "present"
  },
  "style": {
    "hookCentric": 0.8,
    "conversational": 0.5,
    "imagery": 0.3,
    "slang": 0.2,
    "complexity": 0.3,
    "humor": 0.1,
    "aggression": 0.0,
    "vulnerability": 0.6
  },
  "explicitness": 0,
  "explicitTopics": [],
  "languages": ["en"],
  "nonEnglishShare": 0.0,
  "references": {
    "places": [],
    "brands": [],
    "technology": [],
    "people": [],
    "eras": []
  },
  "eraSignal": 0.3,
  "confidence": 0.9
}
```

## Fields

- **lyricsUsable / lyricsIssue:** `false` with an issue (`instrumental`, `wrong_song`, `truncated`, `not_lyrics`,
  `empty`) if the lyrics can't be judged. Everything else is then `null`.
- **summary:** a paraphrase, at most 20 words, with no quotes and no lyric fragments.
- **themes:** a weight from 0 to 1 for each theme that's present (leave out the absent ones). These keys only:
  `love_romance`, `heartbreak`, `desire_sex`, `longing`, `partying`, `dancing`, `money_wealth`, `fame_status`,
  `bragging`, `rebellion`, `freedom_escape`, `nostalgia`, `loneliness`, `empowerment`, `friendship`, `family`,
  `faith_spirituality`, `social_politics`, `violence_crime`, `drugs_alcohol`, `cars_travel`, `hometown_place`,
  `nature_seasons`, `youth_school`, `technology_media`, `self_reflection`, `mental_health`, `celebration_joy`,
  `war_conflict`, `work_struggle`.
- **primaryTheme:** the highest-weighted theme key.
- **mood.valence:** −1 (despairing) to 1 (euphoric). **mood.energy:** 0 (still) to 1 (frantic), judged from the
  words, since there's no audio.
- **mood.primaryEmotion / secondaryEmotion:** one of `joy`, `love`, `desire`, `longing`, `sadness`, `anger`,
  `defiance`, `confidence`, `fear`, `nostalgia`, `hope`, `calm`, `playfulness`, `bitterness`, `awe`.
- **perspective.narrator:** `first`, `second`, `third` or `mixed`. **addressee:** `lover`, `ex`, `crush`, `crowd`,
  `listener`, `self`, `friend`, `family`, `god`, `rival`, `society` or `unspecified`. **narratorGender:** `male`,
  `female` or `unspecified`, only when the lyrics themselves make it clear.
- **narrative.storytelling:** 0 (pure mood or hook) to 1 (a full story with events). **arc:** `rise`, `fall`,
  `redemption`, `cycle` or `flat`. **timeFrame:** `past`, `present`, `future` or `mixed`.
- **style:** each 0 to 1. `hookCentric`: built around a repeated hook. `conversational`: talks like speech.
  `imagery`: concrete pictures and metaphor. `slang`: era or community slang. `complexity`: vocabulary and
  syntax. `humor`, `aggression`, `vulnerability`: how much of each.
- **explicitness:** 0 clean, 1 mild innuendo or language, 2 strong language or clear sexual or drug content,
  3 graphic. **explicitTopics:** any of `profanity`, `sexual`, `drugs`, `violence`.
- **languages / nonEnglishShare:** ISO 639-1 codes, and the share of lyrics not in English (0 to 1).
- **references:** proper nouns and dated things that are named: places, brands, technology (a phone, a radio,
  social media), people (artists, celebrities, historical figures) and eras (a decade or event). Names only.
- **eraSignal:** 0 (timeless) to 1 (could only come from its year).
- **confidence:** how sure the whole record is, 0 to 1.

Derived locally, not by Claude: word counts, lexical diversity, repetition, rhyme density and pronoun counts
(`metrics.json`), and the galaxy layout (a projection of each song's theme, mood and style vector).
