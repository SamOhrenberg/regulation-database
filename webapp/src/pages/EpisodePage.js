import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

// Constants for your GitHub repository
const REPO_OWNER = process.env.REACT_APP_GITHUB_REPO_OWNER;
const REPO_NAME = process.env.REACT_APP_GITHUB_REPO_NAME;
const METADATA_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/transcriptions/metadata.json`;

/**
 * Parses raw transcript text into a structured array.
 * @param {string} text - The raw text content of the transcript file.
 * @returns {Array<Object>} An array of transcript line objects.
 */
const parseTranscript = (text) => {
    const lines = text.split(/\r?\n/);
    const transcript = [];
    const regex = /\[(\d{2}:\d{2}\.\d{3}) --> \d{2}:\d{2}\.\d{3}\]\s*(.*)/;

    for (const line of lines) {
        const match = line.match(regex);
        if (match) {
            const [_, startTime, textContent] = match;
            const timeParts = startTime.split(':').map(parseFloat);
            const startSeconds = Math.floor(timeParts[0] * 60 + timeParts[1]);

            transcript.push({
                startTime,
                startSeconds,
                text: textContent,
            });
        }
    }
    return transcript;
};


function EpisodePage() {
    // The 'id' here corresponds to the ':id' in our App.js route
    const { id } = useParams();
    const [episode, setEpisode] = useState(null);
    const [transcript, setTranscript] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchEpisodeData = async () => {
            setLoading(true);
            setError(null);
            try {
                // 1. Fetch the main metadata file
                const metaResponse = await fetch(METADATA_URL);
                if (!metaResponse.ok) throw new Error('Failed to fetch metadata.json');
                const metadata = await metaResponse.json();

                // 2. Find the correct episode in the metadata
                // The URL param 'id' is the sanitized filename
                // We need to decode it to match the path in metadata.json
                const decodedId = decodeURIComponent(id);
                let foundEpisode = null;

                // Search through all shows in the metadata
                for (const show in metadata) {
                    const episodeMeta = metadata[show].find(ep =>
                        ep.transcript_path.includes(decodedId)
                    );
                    if (episodeMeta) {
                        foundEpisode = episodeMeta;
                        break;
                    }
                }

                if (!foundEpisode) throw new Error(`Episode "${decodedId}" not found.`);
                setEpisode(foundEpisode);

                // 3. Fetch the specific transcript file for that episode
                const transcriptUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${foundEpisode.transcript_path}`;
                const transcriptResponse = await fetch(transcriptUrl);
                if (!transcriptResponse.ok) throw new Error('Failed to fetch transcript file.');
                const transcriptText = await transcriptResponse.text();

                // 4. Parse the transcript and update state
                setTranscript(parseTranscript(transcriptText));

            } catch (err) {
                setError(err.message);
                console.error("Error fetching episode data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchEpisodeData();
    }, [id]);


    if (loading) {
        return <div className="status-message">Loading episode...</div>;
    }

    if (error) {
        return <div className="status-message">Error: {error}</div>;
    }

    return (
        <div className="episode-page">
            <div className="episode-header">
                {episode.thumbnail && <img src={episode.thumbnail} alt={episode.title} className="episode-thumbnail" />}
                <div className="episode-meta">
                    <h1 className="episode-title">{episode.title}</h1>
                    <p className="episode-details">
                        <strong>Show:</strong> {episode.show} | <strong>Uploaded:</strong> {episode.upload_date} | <strong>Duration:</strong> {episode.duration_string}
                    </p>
                    <a href={episode.url} target="_blank" rel="noopener noreferrer" className="youtube-link">Watch on YouTube</a>
                </div>
            </div>

            <div className="transcript-container">
                {transcript.map((line, index) => (
                    <div key={index} className="transcript-line">
                        <a
                            href={`${episode.url}&t=${line.startSeconds}s`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="timestamp-link"
                            title={`Go to ${line.startTime.split('.')[0]} in video`}
                        >
                            [{line.startTime.split('.')[0]}]
                        </a>
                        <p className="transcript-text">{line.text}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default EpisodePage;