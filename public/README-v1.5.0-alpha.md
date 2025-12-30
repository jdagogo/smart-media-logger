# Smart Media Logger v1.5.0-alpha

**Release Date:** December 29, 2024
**Status:** Development
**Port:** 3006

---

## What's New in v1.5.0-alpha

### Soundtrack Player
- **70/30 split modal** - Video player on left, track list on right
- **YouTube playlist integration** - Automatically finds movie soundtracks
- **Save songs to My Stuff** - Heart individual tracks
- **Toggleable hearts** - Save and unsave songs
- **Embedded players** - Music plays directly in My Stuff tab

### My Stuff Improvements
- **Remove logged items** - Can now delete items from collection
- **Collapsible info sections** - Two-level expansion for music items
- **Better hover effects** - Blue highlight, scale, shadow on hover

---

## Critical Issues (NOT FIXED)

These problems existed before v1.5.0 and remain unfixed:

### Metadata Flow Problems
- **Metadata disappears between states** - Data entered in logging doesn't carry through to final item
- **Props don't flow correctly** - Complex prop drilling between page.tsx and RightPaneTabs causes data loss
- **State resets unexpectedly** - Completing a log sometimes loses user-entered data

### Entity Recognition Failure
- **Fails to recognize most names** - Actors, directors, musicians rarely highlighted correctly
- **Fuzzy matching is weak** - Even with fuzzy matching, recognition rate is very low
- **No real NER** - Uses basic keyword matching, not proper named entity recognition

### Date Handling Bugs
- **Wrong year displays** - Dates sometimes show incorrect year
- **Day parsing issues** - Specific days can be wrong
- **Inconsistent formats** - Different parts of app expect different date formats

### Data Persistence
- **All data lost on refresh** - Nothing persists to database
- **Prisma schema exists but unused** - Database is set up but not connected
- **localStorage partially implemented** - Some data saves, most doesn't

### AI Integration Missing
- **No Claude API** - Despite being "Smart Media Logger", there's no AI
- **Hardcoded questions** - Questions are static, not generated intelligently
- **No discovery moments** - Feature promised but not implemented
- **No personalized recommendations** - Recs tab is placeholder

### Voice Input
- **Words get dropped** - Web Speech API loses words silently
- **Fails without warning** - Sometimes just stops working

### Other
- **Duplicate entries** - Completing logs sometimes creates duplicates

---

## New Issues in v1.5.0-alpha

These are problems introduced or exposed by the soundtrack feature:

### Music/Soundtrack Problems
- **Wrong year on saved songs** - Music saves with current year (2024), not song's release year
- **MediaCard shows "Album #0"** - Incorrect display for music items
- **No proper music data model** - Uses "director" field for artist (hack)
- **Artist parsing unreliable** - YouTube title parsing is hit or miss
- **Wrong playlist sometimes** - Search can return incorrect soundtrack

### Structural Issues
- **savedMusicTracks separate from loggedItems** - Two separate state systems that should be unified
- **No unified media type handling** - Music was bolted on as afterthought
- **Soundtrack button hard to find** - Small, easy to miss on movie cards

---

## Technical Debt

- Complex prop drilling causes data loss between components
- savedMusicTracks and loggedItems should be unified
- Need proper database persistence (Prisma exists but unused)
- Music type needs proper data model, not field repurposing
- State management is fragile and error-prone

---

## Honest Assessment

**v1.5.0 adds features but does NOT fix fundamental problems.**

The soundtrack player is a nice addition, but the app still has critical issues:
- Metadata doesn't flow correctly
- Entity recognition barely works
- Nothing persists to database
- There's no actual AI despite the name "Smart Media Logger"

The core architecture needs work before adding more features.

---

## Setup

```bash
cd /Users/j.d.heilprin/smart-media-logger
npm install
npm run dev
```

Open http://localhost:3006

---

## Links

- [Version Control Page](http://localhost:3006/smart-media-logger-versions.html)
- [GitHub Repository](https://github.com/jdagogo/smart-media-logger)
- [Main README](https://github.com/jdagogo/smart-media-logger#readme)
