# Regulation Database

![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![Built with](https://img.shields.io/badge/Built%20with-React-61DAFB.svg)

This whole thing started because Geoff Ramsey was looking for a community-run way to search through episode transcripts. So, here it is: a fully transcribed and searchable database for the **Regulation Podcast**.

### **[➡️ Search the Database Here ⬅️](https://www.regulatabase.com)**

## 🎙️ About the Podcast

If you're here, you probably already know. The **Regulation Podcast** is a lighthearted comedy show with Andrew, Nick, Eric, Geoff, and Gavin—a long-time group of friends—who embrace absurdity and do whatever they can to make each other laugh.

This project is an open-source tool for all the listeners, built by the community.

## 🗂️ The repository

This repo is a monorepo. Here's a quick look under the hood:

-   `📂 /transcriptions` — All the raw `.txt` transcriptions live here, along with a `metadata.json` file that keeps track of everything.
-   `🤖 /yt-transcriber` — The brains of the operation. This is a modern Node.js script that automatically finds new episodes, transcribes them, and commits them to the repo.
-   `🖥️ /webapp` — The ui. A clean, fast React app that gives you a interface for searching through all the transcripts.

For a deeper dive into the project's architecture, data, and long-term vision, **[check out the official Wiki](https://github.com/SamOhrenberg/regulation-database/wiki)**.

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

The `yt-transcriber/` script is the engine that keeps the database up to date. It automates the entire process of finding and transcribing new content.

If you want to run the script yourself or contribute to it, you'll need to set up a few dependencies. We've put together a full, step-by-step guide on the project Wiki.

> ➡️ **For the complete setup guide, see the [Guide: Running the Transcriber Script](https://github.com/SamOhrenberg/regulation-database/wiki/Guide:-Running-the-Transcriber-Script) on the Wiki.**

---

## 🙏 Contributing

Want to pitch in? Awesome. Contributions are what make open-source projects like this work. Not all of them involve writing code.

#### Reporting Bugs or Requesting Features

If you find a bug in the webapp or have an idea for a new feature, please **[open an issue](https://github.com/SamOhrenberg/regulation-database/issues)**. Issues are for concrete, actionable items that have a clear "done" state.

#### Have a Question or Idea? Try out Discussions

We've also got the **[Discussions tab](https://github.com/SamOhrenberg/regulation-database/discussions)** enabled for more open-ended conversations. It's a good place for things that aren't quite a bug report or a formal feature request.

Here's a quick guide on when to use which:

-   **Use an Issue if:** You've found a bug, something is broken, or you have a well-defined feature you want to see added.
-   **Use a Discussion if:** You have a general question, want to brainstorm a big new idea, want to share something you've built based on this project, or just want to chat with other contributors.

#### Fixing Transcription Errors

Automated transcription isn't perfect. If you find an error in a transcript, you've got two options:
1.  **The Easy Way:** **[Open an issue](https://github.com/SamOhrenberg/regulation-database/issues)**. Just include the episode name, the incorrect text, and what it should be.
2.  **The Pro Way:** Fork the repository, fix the error in the `.txt` file inside the `/transcriptions` folder, and submit a **Pull Request**.

#### Code Contributions

If you want to improve the webapp or the transcriber script, feel free to fork the repo, create a new branch for your feature or fix, and submit a Pull Request.

## 📜 License

This project is licensed under the MIT License. See the `LICENSE` file for details.
