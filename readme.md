# Regulation Database

![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![Built with](https://img.shields.io/badge/Built%20with-React-61DAFB.svg)

This whole thing started because Geoff Ramsey was looking for a community-run way to search through episode transcripts. So, here it is: a fully transcribed and searchable database for the **Regulation Podcast**.

### **[➡️ Search the Database Here ⬅️](https://www.regulatabase.com)**

## 🎙️ About the Podcast

If you're here, you probably already know. The **Regulation Podcast** is a lighthearted comedy show with Andrew, Nick, Eric, Geoff, and Gavin—a long-time group of friends—who embrace absurdity and do whatever they can to make each other laugh.

This project is an open-source tool for all the listeners, built by the community.

## 🗂️ So, What's in the Box?

This repo is a "monorepo," which is just a fancy way of saying it holds a few connected projects in one place. Here's a quick look under the hood:

-   `📂 /transcriptions` — This is the treasure chest. All the raw `.txt` transcriptions live here, along with a `metadata.json` file that keeps track of everything. This is the raw data that powers the whole project.
-   `🤖 /yt-transcriber` — The brains of the operation. This is a modern Node.js script that automatically finds new episodes on YouTube and RSS feeds, transcribes them, and commits them to the repo.
-   `🖥️ /webapp` — The star of the show. A clean, fast React app that gives you a slick interface for searching through all the transcripts.

---

## 🚀 The Search Webapp

The webapp is a simple, static React site that lets anyone easily find moments and quotes across all transcribed episodes. It gets automatically deployed to GitHub Pages every time the `main` branch is updated, so it's always current.

### ✨ Features

-   **Keyword Search:** Instantly search all transcripts for words or phrases.
-   **Contextual Results:** See snippets of the conversation around your search term so you actually know what's going on.
-   **Direct Links:** Each result links straight to the full transcription file on GitHub if you want to read more.
-   **Responsive UI:** A clean, dark-themed interface that works great on desktop and mobile.

> For the nitty-gritty on setup and development for the app, check out the [`webapp/README.md`](webapp/README.md).

---

## ⚙️ The Automation Pipeline

The `yt-transcriber/` script is the engine that keeps the database up to date. It's a powerful Node.js tool designed to be configurable and adaptable for other projects, too. It automates the whole pipeline: fetching new content, transcribing audio with local AI, generating metadata, and committing the new files back to the repository.

If you want to run it yourself, contribute to it, or just see how it works under the hood, all the technical details are in its own dedicated README.

> ➡️ **For detailed setup and usage instructions, see the [`yt-transcriber/README.md`](yt-transcriber/README.md).**

---

## 🛠️ How It All Works

The whole project follows a simple, robust, and automated flow that doesn't require a dedicated server. It's pretty slick:

`[YouTube/RSS]` → `[Node.js Script]` → `[faster-whisper]` → `[Git Commit & Push]` → `[GitHub Action]` → `[GitHub Pages]`

1.  The Node.js script checks the YouTube channels and RSS feeds for new content.
2.  For each new item, it downloads the audio.
3.  The audio is passed to the `faster-whisper` model for transcription.
4.  The new `.txt` file and updated metadata are saved to the `/transcriptions` directory.
5.  The script automatically commits the new files and pushes them to the `main` branch.
6.  A GitHub Action workflow kicks off, building the React webapp.
7.  The newly built static site is deployed to GitHub Pages, making the latest transcriptions instantly searchable.

---

## 🙏 Contributing

Want to pitch in? Awesome. Contributions are what make open-source projects like this work. Not all of them involve writing code.

#### Reporting Bugs or Requesting Features

If you find a bug in the webapp or have an idea for a new feature, please **[open an issue](https://github.com/SamOhrenberg/regulation-database/issues)**. Issues are for concrete, actionable items that have a clear "done" state.

#### Have a Question or Idea? Use Discussions!

We've also got the **[Discussions tab](https://github.com/SamOhrenberg/regulation-database/discussions)** enabled for more open-ended conversations. It's the perfect place for things that aren't quite a bug report or a formal feature request.

Here's a quick guide on when to use which:

-   **Use an Issue if:** You've found a bug, something is broken, or you have a well-defined feature you want to see added. (e.g., "The search button doesn't work on mobile," or "Add a button to copy results to the clipboard.")
-   **Use a Discussion if:** You have a general question, want to brainstorm a big new idea, want to share something you've built based on this project, or just want to chat with other contributors. (e.g., "How does the transcriber script handle de-duplication?" or "What if we added a timeline view?").

Don't worry about getting it perfect. If you open an issue that's better suited for a discussion, we can always convert it.

#### Fixing Transcription Errors

Automated transcription isn't perfect. If you find an error in a transcript, you've got two options:
1.  **The Easy Way:** **[Open an issue](https://github.com/SamOhrenberg/regulation-database/issues)**. Just include the episode name, the incorrect text, and what it should be.
2.  **The Pro Way:** Fork the repository, fix the error in the `.txt` file inside the `/transcriptions` folder, and submit a **Pull Request**.

#### Code Contributions

If you want to improve the webapp or the transcriber script, feel free to fork the repo, create a new branch for your feature or fix, and submit a Pull Request.

## 📜 License

This project is licensed under the MIT License. See the `LICENSE` file for details.
