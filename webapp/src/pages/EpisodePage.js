import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

// --- Constants and Helper Functions (no changes here) ---
const REPO_OWNER = process.env.REACT_APP_GITHUB_REPO_OWNER;
const REPO_NAME = process.env.REACT_APP_GITHUB_REPO_NAME;
const GITHUB_RAW_BASE_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/`;
const METADATA_URL = `${GITHUB_RAW_BASE_URL}transcriptions/metadata.json`;

const parseTranscript = (text) => {
  const lines = text.split(/\r?\n/);
  const transcript = [];
  const regex = /\[(\d{2}:\d{2}\.\d{3}) --> \d{2}:\d{2}\.\d{3}\]\s*(.*)/;
  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      const startTime = match[1];
      const textContent = match[2];
      const timeParts = startTime.split(':').map(parseFloat);
      const startSeconds = Math.floor(timeParts[0] * 60 + timeParts[1]);
      transcript.push({ startTime, startSeconds, text: textContent });
    }
  }
  return transcript;
};

const formatDate = (dateString) => {
  if (!dateString || dateString.length !== 8) return dateString;
  try {
    const year = parseInt(dateString.substring(0, 4), 10);
    const month = parseInt(dateString.substring(4, 6), 10) - 1;
    const day = parseInt(dateString.substring(6, 8), 10);
    const date = new Date(year, month, day);
    return date.toLocaleDateString(); 
  } catch (error) {
    console.error("Could not parse date:", dateString, error);
    return dateString;
  }
};


function EpisodePage() {
  const { id } = useParams(); 
  const [episode, setEpisode] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    // ... (The useEffect data fetching logic remains exactly the same)
    const fetchEpisodeData = async () => {
      setLoading(true);
      setError(null);
      setCurrentImageIndex(0); // Reset index on new episode load
      try {
        const metaResponse = await fetch(METADATA_URL);
        if (!metaResponse.ok) throw new Error('Failed to fetch metadata.json');
        const metadata = await metaResponse.json();
        const decodedId = decodeURIComponent(id);
        let foundEpisode = null;
        for (const show in metadata) {
          const episodeMeta = metadata[show].find(ep => ep.transcript_path.includes(decodedId));
          if (episodeMeta) { foundEpisode = episodeMeta; break; }
        }
        if (!foundEpisode) throw new Error(`Episode "${decodedId}" not found.`);
        setEpisode(foundEpisode);
        const transcriptUrl = `${GITHUB_RAW_BASE_URL}${foundEpisode.transcript_path}`;
        const transcriptResponse = await fetch(transcriptUrl);
        if (!transcriptResponse.ok) throw new Error('Failed to fetch transcript file.');
        const transcriptText = await transcriptResponse.text();
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

  if (loading) { return <div className="status-message">Loading episode...</div>; }
  if (error) { return <div className="status-message">Error: {error}</div>; }

  const imageSources = [];
  if (episode && episode.thumbnail) {
    imageSources.push(episode.thumbnail);
  }
  if (episode && episode.images && Array.isArray(episode.images)) {
    episode.images.forEach(imgPath => {
      // Construct the full URL from the relative path
      const fullUrl = `${GITHUB_RAW_BASE_URL}${imgPath.replace('./', 'transcriptions/')}`;
      imageSources.push(fullUrl);
    });
  }

  const handleNextImage = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex + 1) % imageSources.length);
  };
  const handlePrevImage = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex - 1 + imageSources.length) % imageSources.length);
  };

  return (
    <div className="episode-page">
      <div className="episode-header">
        {imageSources.length > 0 && (
          <div className="image-carousel">
            <img 
              src={imageSources[currentImageIndex]} 
              alt={`${episode.title} - image ${currentImageIndex + 1}`} 
              className="episode-thumbnail" 
            />
            {imageSources.length > 1 && (
              <>
                <button onClick={handlePrevImage} className="carousel-button prev">‹</button>
                <button onClick={handleNextImage} className="carousel-button next">›</button>
                <span className="carousel-indicator">{currentImageIndex + 1} / {imageSources.length}</span>
              </>
            )}
          </div>
        )}

        <div className="episode-meta">
          <h1 className="episode-title">{episode.title}</h1>
          <p className="episode-details">
            <strong>Show:</strong> {episode.show} | <strong>Uploaded:</strong> {formatDate(episode.upload_date)} | <strong>Duration:</strong> {episode.duration_string}
          </p>
          <a href={episode.url} target="_blank" rel="noopener noreferrer" className="youtube-link">Watch on YouTube</a>
        </div>
      </div>

      <div className="transcript-container">
        {transcript.map((line, index) => (
          <div key={index} className="transcript-line">
            <a href={`${episode.url}&t=${line.startSeconds}s`} target="_blank" rel="noopener noreferrer" className="timestamp-link" title={`Go to ${line.startTime.split('.')[0]} in video`}>
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