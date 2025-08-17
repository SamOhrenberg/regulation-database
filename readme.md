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

-   `📂 /transcriptions` — This is the treasure chest. All the raw `.txt` transcriptions live here, along with a `metadata.json` file that keeps track of everything.
-   `🤖 /yt-transcriber` — The brains of the operation. This is a modern Node.js script that automatically finds new episodes, transcribes them, and commits them to the repo.
-   `🖥️ /webapp` — The star of the show. A clean, fast React app that gives you a slick interface for searching through all the transcripts.

For a deeper dive into the project's architecture, data, and long-term vision, **[check out the official Wiki](https://github.com/SamOhrenberg/regulation-database/wiki)**.

---
## 🚀 The Search Webapp
(...rest of the webapp section is unchanged...)

---
## ⚙️ The Automation Pipeline

The `yt-transcriber/` script is the engine that keeps the database up to date. It automates the entire process of finding and transcribing new content.

If you want to run the script yourself or contribute to it, you'll need to set up a few dependencies. We've put together a full, step-by-step guide on the project Wiki.

> ➡️ **For the complete setup guide, see the [Guide: Running the Transcriber Script](https://github.com/SamOhrenberg/regulation-database/wiki/Guide:-Running-the-Transcriber-Script) on the Wiki.**

---
## 🙏 Contributing
(...rest of the contributing section is unchanged...)
