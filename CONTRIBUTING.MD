# Contributing to the Regulation Database

First off, thanks for even thinking about contributing! Your help is a huge deal. This is a community-driven project, and every contribution—from fixing a typo to adding a new feature—makes a big difference.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you're expected to uphold this code. Long story short: be cool to each other.

## How Can I Contribute?

There are a ton of ways to help out, and a lot of them don't involve writing a single line of code.

### 🐛 Reporting Bugs

Find something broken in the webapp or the automation script? Please [open a bug report issue](https://github.com/SamOhrenberg/regulation-database/issues/new?assignees=&labels=bug&template=bug_report.md&title=%5BBUG%5D%3A+). A great bug report includes detailed steps to reproduce the issue, what you expected to happen, and what actually happened. Screenshots are a godsend here.

### ✨ Requesting Features

Got a killer idea for a new feature for the webapp or a suggestion to improve the automation script? We'd love to hear it. Please [open a feature request issue](https://github.com/SamOhrenberg/regulation-database/issues/new?assignees=&labels=enhancement&template=feature_request.md&title=%5BFEATURE%5D%3A+).

### 📝 Correcting Transcriptions

Let's be real, automated transcription isn't always perfect. If you spot an error in a transcript, you can either:

1.  **[Open an issue](https://github.com/SamOhrenberg/regulation-database/issues/new?assignees=&labels=transcription&template=transcription_error.md)** detailing the episode, the incorrect text, and the correction. This is super helpful and much appreciated.
2.  Submit a Pull Request with the fix yourself (see below).

### 💻 Code Contributions

If you'd like to sling some code, that's fantastic! The two main areas for contribution are the React `webapp` and the Node.js `yt-transcriber`.

**1. Fork the Repository**
   - Click the "Fork" button at the top right of the repo page. This makes your own copy of the project that you can mess with.

**2. Clone Your Fork**
   - Clone your forked repo to your local machine:
     ```sh
     git clone https://github.com/YOUR_USERNAME/regulation-database.git
     cd regulation-database
     ```

**3. Set Up Your Development Environment**
   - **For the Webapp:** The webapp is the primary place for code contributions. To get it running:
     ```sh
     cd webapp
     npm install
     npm start
     ```
     This will open the app at `http://localhost:3000` and it'll auto-reload as you make changes.

   - **For the Transcriber Script:** If you're looking to improve the automation pipeline:
     ```sh
     cd yt-transcriber
     npm install
     ```
     You can then run the script with `node index.js`. Check out the main [README.md](../readme.md#%EF%B8%8F-the-automation-pipeline) for details on setting up the required dependencies like `yt-dlp` and `faster-whisper`.

**4. Create a New Branch**
   - Create a branch for your changes. Use a descriptive name—it helps everyone know what you're working on.
     ```sh
     # For a new feature
     git checkout -b feature/add-new-search-filter

     # For a bug fix
     git checkout -b fix/style-issue-on-mobile
     ```

**5. Make Your Changes**
   - Go nuts. Make the changes you want to the codebase.

**6. Commit Your Changes**
   - Commit your changes with a clear and descriptive message. We loosely follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) standard.
     ```sh
     git commit -m "feat: Add search filter for episode names"
     ```

**7. Push to Your Fork**
   - Push your branch up to your forked repository on GitHub:
     ```sh
     git push origin feature/add-new-search-filter
     ```

**8. Submit a Pull Request**
   - Go to the original repository on GitHub. You should see a big green button to create a Pull Request from your new branch.
   - Fill out the PR template with a clear description of your changes and why they're needed.

Thank you again for your contribution! We couldn't do it without you.