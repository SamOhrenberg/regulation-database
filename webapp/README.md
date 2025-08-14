# Regulation Podcast Search (Webapp)

This is the React-based frontend application for the **Regulation Database**. It provides a clean, fast, and responsive user interface for searching through all available podcast transcriptions.

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app). For the full project overview, including the data pipeline and contribution guidelines, please see the [main README file](../../readme.md).

## Tech Stack

-   **Framework:** React
-   **Build Tool:** Create React App
-   **Deployment:** GitHub Pages via GitHub Actions

## How It Works

This is a fully static web application with no traditional backend.

1.  On load, the app makes an API call to the GitHub repository to get a list of all files in the `/transcriptions` directory.
2.  When a user performs a search, the app fetches the raw text content of each transcription file directly from GitHub (`file.download_url`).
3.  The search is performed client-side, in the user's browser, allowing for a fast and lightweight experience.
4.  Results are displayed with highlighted keywords and contextual snippets.

## Available Scripts

In the `webapp` directory, you can run the following commands:

### `npm start`

Runs the app in development mode.
Open [http://localhost:3000](http://localhost:3000) to view it in your browser. The page will automatically reload when you make edits.

### `npm run build`

Builds the app for production to the `build` folder. It correctly bundles React in production mode and optimizes the build for the best performance.

### `npm run deploy`

This command first runs `npm run build` and then deploys the contents of the `build` folder to the `gh-pages` branch on GitHub, making it live on GitHub Pages. Note that this is handled automatically by the GitHub Action workflow.

### `npm test`

Launches the test runner in interactive watch mode.

---

## Deployment

Deployment is automated via a GitHub Actions workflow defined in [`.github/workflows/deploy-to-gh-pages.yml`](../../.github/workflows/deploy-to-gh-pages.yml).

Any push to the `main` branch will automatically trigger this workflow, which will:
1.  Install dependencies.
2.  Build the production version of the app (`npm run build`).
3.  Deploy the `webapp/build` directory to the `gh-pages` branch.

The site is configured to be served from this `gh-pages` branch.

## Contributing

Contributions to the webapp are welcome! Please refer to the **[main project's contributing guidelines](../../readme.md#🤝-contributing)** for details on how to submit issues and pull requests.