# Project Roadmap

Alright, here's a look at what's planned for the Regulation Database. The goal is to go beyond just a simple search tool and build this thing into a full-on, IMDB-style hub for all Regulation content. A one-stop-shop, you know?

This is a living document, so it'll change over time. If you see something that looks cool or have a killer idea, feel free to [open an issue](https://github.com/SamOhrenberg/regulation-database/issues) and let's talk about it.

---

## First Things First: The Foundation

*These are the next logical steps to get the site from "works" to "actually good."*

-   [ ] **Actually Filter the Search:** Let's be real, searching right now is a firehose of everything. The #1 priority is adding dropdowns or something to let you filter by Show (`Regulation Podcast`, `F**kface`, `Gameplay`) and Category (`Episode`, `Sausage Talk`, `Draft`). This will make the site about 1000% more usable.
-   [ ] **Give Episodes Their Own Pages:** Right now, everything lives on the homepage. We need to create dedicated pages for each episode, which will give us a place to put the full transcript, metadata, and all the other cool stuff we're planning.
-   [ ] **Make the Results Sortable:** It'd be nice to let people sort the search results by what's most relevant, by episode number (newest or oldest), or even by which episode has the most hits.
-   [ ] **Boost the Search Speed:** Instead of the webapp fetching every single transcript file every time, we can pre-build a search index file during the deployment process. The app would just download that one file, making initial searches way faster. It's a bit more work upfront but a huge performance win.

---

## The "IMDB" Core: Where it Gets Fun

*These are the features that will turn the site into a real content browser instead of just a search bar.*

-   [ ] **Clickable Timestamps:** This is the killer feature. Imagine reading a line in the transcript, clicking a timestamp, and getting zapped right to that exact moment in the YouTube video. The transcriber needs to be updated to generate timestamps, and then the webapp needs to make them interactive. It's a game-changer.
-   [ ] **Visual Timeline:** A new page that lays out all the content on an interactive timeline. You could scroll through the years and see exactly when different episodes, supplementals, and gameplay videos dropped. Would be sick for seeing how things evolved.
-   [ ] **Image Gallery:** Remember that experimental image extraction thing in the transcriber? Let's put it to use. Each episode page could have a gallery of the actual images they show on screen. No more trying to picture what they're talking about.
-   [ ] **Random Episode / "On This Day" Button:** A fun way to discover (or re-discover) content. A button on the homepage that just serves you up a random episode or shows you what was released on this day a few years ago.
-   [ ] **Smarter Search Bar:** Let's give the search bar some brains. Add support for operators like exact phrases (`"pass the beans"`), exclusions (`-geoff`), and OR logic (`andrew OR eric`). For the power users.

---

## The Big Swings: The "Wouldn't It Be Cool If..." List

*Okay, this is the ambitious stuff. The holy grails that would make this the undisputed, definitive resource for the podcast.*

-   [ ] **Speaker Identification (Diarization):** Damn if this wouldn't be amazing. The holy grail. Updating the transcription process to actually figure out *who* is talking (e.g., `Andrew: Pass the beans.`). This is a huge technical hurdle, but it would let you search for quotes from a specific person, which would be incredible.
-   [ ] **Community-Sourced Content:** This is a community project, so let's let the community build it. We could set up a system where people can submit "Funniest Moments," "Key Topics," or "Trivia" for each episode. We could manage it through pull requests—a real open-source effort.
-   [ ] **Automatic Topic Tagging:** This one's a bit wild. We could automatically scan transcripts to identify and tag recurring bits and topics (like "The Gurpler,", "Protected by Falcons"). Then you could click a tag and see every single time it was ever mentioned.
-   [ ] **Cross-Episode Links:** You know how they'll reference a bit from an old episode? We could add links between them. "See also: F**kface [101] where this all started." It would connect the entire lore of the show together.