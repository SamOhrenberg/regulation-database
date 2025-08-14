# Regulation Database

![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![Built with](https://img.shields.io/badge/Built%20with-React-61DAFB.svg)

This repository is an open-source project that provides a fully transcribed and searchable database for the **Regulation Podcast**.

### **[➡️ Search the Database Here ⬅️](https://SamOhrenberg.github.io/regulation-database)**

## 🎙️ About the Podcast

The **Regulation Podcast** is a lighthearted comedy show featuring Andrew, Nick, Eric, Geoff, and Gavin—a long-time group of friends—who embrace absurdity and do whatever they can to make each other laugh.

This project was born out of a request from the podcast's own Geoff Ramsey for a way to search through episode transcripts. As an open-source community project, it aims to be a useful tool for all listeners.

## 📂 Project Structure

This repository is a monorepo containing three core components:

-   `📁 /transcriptions` — Contains all episode transcriptions as raw `.txt` files. This is the raw data source for the project.
-   `📁 /powershell` — Holds the automation script responsible for fetching new episodes, transcribing them, and committing them to the repository.
-   `📁 /webapp` — A modern React application that provides a clean, fast, and user-friendly interface for searching the transcriptions.

---

## 🚀 The Search Webapp

The webapp is a React-based search interface that allows anyone to easily find moments and quotes across all transcribed episodes. It is automatically deployed to GitHub Pages on every push to the `main` branch.

### ✨ Features

-   **Keyword Search:** Instantly search all transcripts for words or phrases.
-   **Contextual Results:** View snippets of the conversation around your search term to understand the context.
-   **Direct Links:** Each result links directly to the full transcription file on GitHub.
-   **Responsive UI:** A clean, dark-themed interface that works beautifully on desktop and mobile devices.

> For detailed setup and development instructions for the webapp, please see the [`webapp/README.md`](webapp/README.md).

---

## 🤖 The Automation Pipeline

The `powershell/fetch-transcribe.ps1` script is the engine that keeps the database up to date. It automates the entire process of retrieving new podcast episodes from their RSS feed, transcribing the audio to text, and adding the new transcriptions to the repository.

### How to Use the Script

This script can be adapted to transcribe any podcast. If you wish to run it yourself or contribute, follow these steps:

#### 1. Requirements

-   Windows PowerShell
-   [**faster-whisper-xxl.exe**](https://github.com/Purfview/whisper-standalone-win): A standalone, high-performance version of OpenAI's Whisper model. The `xxl` version is recommended for its high accuracy. Download the executable and place it in a memorable location.

#### 2. Setup

1.  **Fork the Repository:** Because the script automatically commits and pushes to its own repository, you must first fork this project.

2.  **Set Environment Variable:** The script needs to know where `faster-whisper-xxl.exe` is located. Set the `FASTER_WHISPER_PATH` environment variable in your PowerShell session:
    ```powershell
    $env:FASTER_WHISPER_PATH="C:\path\to\your\faster-whisper-xxl.exe"
    ```

3.  **Allow Script Execution (If Needed):** If you haven't run local PowerShell scripts before, you may need to bypass the execution policy for the current session.
    ```powershell
    Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
    ```

#### 3. Run the Script

Navigate to the `powershell` directory and run the script:

```powershell
# Check for new episodes and transcribe them
.\fetch-transcribe.ps1

# To force re-transcription of episodes that already exist
.\fetch-transcribe.ps1 -ForceRetranscribe
```

---

## ⚙️ How It Works

The project follows a simple, robust, and automated flow:

`[RSS Feed]` → `[PowerShell Script]` → `[faster-whisper]` → `[Git Commit & Push]` → `[GitHub Action]` → `[GitHub Pages]`

1.  The PowerShell script checks the podcast's RSS feed for new episodes.
2.  For each new episode, it downloads the audio file.
3.  The audio is passed to the `faster-whisper` model for transcription.
4.  The resulting `.txt` file is saved to the `/transcriptions` directory.
5.  The script then automatically commits the new file and pushes it to the `main` branch.
6.  A GitHub Action workflow is triggered, which builds the React webapp.
7.  The newly built static site is deployed to GitHub Pages, making the latest transcriptions instantly available for searching.

---

## 🤝 Contributing

Contributions are what make open-source projects thrive, and they are very welcome here!

#### Reporting Bugs or Requesting Features

If you find a bug in the webapp or have an idea for a new feature, please **[open an issue](https://github.com/SamOhrenberg/regulation-database/issues)**.

#### Fixing Transcription Errors

Automated transcription isn't perfect. If you find an error in a transcript, you have two options:
1.  **The Easy Way:** **[Open an issue](https://github.com/SamOhrenberg/regulation-database/issues)**. Please include the episode name, the approximate timestamp or context, and the correction.
2.  **The Pro Way:** Fork the repository, correct the error in the appropriate `.txt` file within the `/transcriptions` folder, and submit a **Pull Request**.

#### Code Contributions

If you'd like to improve the webapp or the PowerShell script, please feel free to fork the repository, create a new branch for your feature or bugfix, and submit a Pull Request.

## 📜 License

This project is licensed under the MIT License. See the `LICENSE` file for details.
