# Regulation Podcast Search (Webapp)

This is the React-based frontend for the **Regulation Database**. It's a clean, fast, and responsive UI for digging through all the podcast transcriptions.

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app), which handles a lot of the heavy lifting for the build process. For the full project overview, including the data pipeline and how to contribute, check out the [main README file](../../readme.md).

## Tech Stack

-   **Framework:** React
-   **Build Tool:** Create React App
-   **Deployment:** GitHub Pages via GitHub Actions

## How It Works

This is a fully static web app—no traditional backend or server costs.

1.  When you load the page, the app hits the GitHub API to get a list of all the files in the `/transcriptions` directory.
2.  When you search for something, the app fetches the raw text content of each transcription file directly from GitHub (`file.download_url`).
3.  All the searching happens right in your browser (client-side). This keeps things fast and lightweight.
4.  Results pop up with your search term highlighted, along with some surrounding text for context.

## ⚙️ Configuration (For Forks)

The app is configured to pull data from the main `SamOhrenberg/regulation-database` repository by default. If you've forked this project and want the webapp to point to your own repository, you'll need to set up a local environment file.

1.  In the `/webapp` directory, copy the `.env.example` file to a new file named `.env.local`.
2.  Open `.env.local` and change the values to match your GitHub username and repository name.

This file is ignored by Git, so your personal settings won't be committed.

## Available Scripts

Once you're in the `webapp` directory, you can run these commands:

### `npm start`

Runs the app in development mode.
Open [http://localhost:3000](http://localhost:3000) to see it in your browser. The page will automatically reload whenever you save a file.

### `npm run build`

Bundles the app for production into the `build` folder. It crunches everything down and optimizes it for the best performance.

### `npm test`

Launches the test runner in interactive watch mode.

---

## Deployment

Deployment is fully automated using a GitHub Actions workflow. You can check out the config file here: [`.github/workflows/deploy-to-gh-pages.yml`](../../.github/workflows/deploy-to-gh-pages.yml).

Any push to the `main` branch will automatically trigger this workflow. The live site is configured to be served from the `gh-pages` branch, so you shouldn't ever need to run `npm run deploy` manually.

## Contributing

Contributions to the webapp are always welcome! Please check out the **[main project's contributing guidelines](../../CONTRIBUTING.md)** for the full rundown on how to submit issues and pull requests.