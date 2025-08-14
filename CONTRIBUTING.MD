    
# Contributing to the Regulation Database

First off, thank you for considering contributing to the Regulation Database! Your help is greatly appreciated. This is a community-driven project, and every contribution, from a simple typo fix to a new feature, makes a big difference.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

There are many ways to contribute, and not all of them involve writing code.

### 🐛 Reporting Bugs

If you find a bug in the webapp or the automation script, please [open a bug report issue](https://github.com/SamOhrenberg/regulation-database/issues/new?assignees=&labels=bug&template=bug_report.md&title=%5BBUG%5D%3A+). A great bug report includes detailed steps to reproduce the issue, what you expected to happen, and what actually happened.

### ✨ Requesting Features

Have an idea for a new feature for the webapp or a suggestion to improve the automation script? We'd love to hear it! Please [open a feature request issue](https://github.com/SamOhrenberg/regulation-database/issues/new?assignees=&labels=enhancement&template=feature_request.md&title=%5BFEATURE%5D%3A+).

### 📝 Correcting Transcriptions

Automated transcription isn't always perfect. If you find an error in a transcript, you can either:
1.  **[Open an issue](https://github.com/SamOhrenberg/regulation-database/issues/new)** detailing the episode, the incorrect text, and the correction.
2.  Submit a Pull Request with the fix yourself (see below).

### 💻 Code Contributions

If you'd like to contribute code, that's fantastic! Here’s how to get started:

**1. Fork the Repository**
   - Click the "Fork" button at the top right of the repository page. This creates your own copy of the project.

**2. Clone Your Fork**
   - Clone your forked repository to your local machine:
     ```sh
     git clone https://github.com/YOUR_USERNAME/regulation-database.git
     cd regulation-database
     ```

**3. Set Up the Webapp Development Environment**
   - The webapp is the primary place for code contributions. To set it up:
     ```sh
     cd webapp
     npm install
     ```
   - You can then start the local development server:
     ```sh
     npm start
     ```
   - This will open the app at `http://localhost:3000`.

**4. Create a New Branch**
   - Create a branch for your changes. Use a descriptive name:
     ```sh
     git checkout -b feature/add-new-search-filter
     # or
     git checkout -b fix/style-issue-on-mobile
     ```

**5. Make Your Changes**
   - Make your desired changes to the codebase.

**6. Commit Your Changes**
   - Commit your changes with a clear and descriptive message:
     ```sh
     git commit -m "feat: Add search filter for episode names"
     ```

**7. Push to Your Fork**
   - Push your branch to your forked repository on GitHub:
     ```sh
     git push origin feature/add-new-search-filter
     ```

**8. Submit a Pull Request**
   - Go to the original repository on GitHub and you'll see a prompt to create a Pull Request from your new branch.
   - Fill out the pull request template with a clear description of your changes and why they are needed.

Thank you again for your contribution!

  
  