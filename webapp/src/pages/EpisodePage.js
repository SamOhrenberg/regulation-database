import React, { useState, useEffect, useRef  } from 'react';
import { useParams } from 'react-router-dom';
import ReportErrorModal from '../components/ReportErrorModal';

// --- Constants and Helper Functions (no changes here) ---
const REPO_OWNER = process.env.REACT_APP_GITHUB_REPO_OWNER;
const REPO_NAME = process.env.REACT_APP_GITHUB_REPO_NAME;
const GITHUB_RAW_BASE_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/`;
const METADATA_URL = `${GITHUB_RAW_BASE_URL}transcriptions/metadata.json`;
const GITHUB_REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;

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

  const [selectedTimestamp, setSelectedTimestamp] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [popup, setPopup] = useState({ show: false, x: 0, y: 0 });
  const transcriptContainerRef = useRef(null);

  useEffect(() => {
    const fetchEpisodeData = async () => {
      setLoading(true);
      setError(null);
      setCurrentImageIndex(0); 
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

  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      
      if (text && transcriptContainerRef.current?.contains(selection.anchorNode)) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Logic to find the timestamp
        // Start from the element where the selection began
        const startNode = selection.anchorNode;
        // Find the closest parent element that is a '.transcript-line'
        const parentLine = startNode.parentElement.closest('.transcript-line');

        if (parentLine && parentLine.dataset.timestamp) {
          // If we found a line with a timestamp, store it in state
          setSelectedTimestamp(parentLine.dataset.timestamp);
        } else {
          // Otherwise, clear it
          setSelectedTimestamp('');
        }

        setPopup({
          show: true,
          x: rect.left + window.scrollX + rect.width / 2,
          y: rect.bottom + window.scrollY,
        });
        setSelectedText(text);
      } else {
        setPopup({ show: false, x: 0, y: 0 });
      }
    };

    const handleClickOutside = (event) => {
       if (popup.show && !event.target.closest('.selection-popup')) {
           setPopup({ show: false, x: 0, y: 0 });
       }
    }

    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('touchend', handleSelection);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('touchend', handleSelection);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [popup.show]); 


  const openReportModal = (text = '') => {
    setSelectedText(text);
    setIsModalOpen(true);
    setPopup({show: false, x: 0, y: 0});
  };

  const closeReportModal = () => {
    setIsModalOpen(false);
    setSelectedText('');
  }

  if (loading) { return <div className="status-message">Loading episode...</div>; }
  if (error) { return <div className="status-message">Error: {error}</div>; }

  const imageSources = [];
  if (episode && episode.thumbnail) {
    imageSources.push(episode.thumbnail);
  }
  if (episode && episode.images && Array.isArray(episode.images)) {
    episode.images.forEach(imgPath => {
      imageSources.push(imgPath);
    });
  }

  const handleNextImage = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex + 1) % imageSources.length);
  };
  const handlePrevImage = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex - 1 + imageSources.length) % imageSources.length);
  };

  return (
    <>
      <div className="episode-page">
        <div className="episode-header">
          {imageSources.length > 0 && (
            <div className="image-carousel">
              <img 
                src={imageSources[currentImageIndex]} 
                alt={`${episode.title} - ${currentImageIndex + 1}`} 
                className="episode-thumbnail" 
                loading="eager"
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
            <div className="action-buttons-container">
              <a href={episode.url} target="_blank" rel="noopener noreferrer" className="youtube-link">
                Watch on YouTube
              </a>
              <button onClick={() => openReportModal()} className="youtube-link">
                Report Transcription Error
              </button>
            </div>
          </div>
        </div>

        <div className="transcript-container" ref={transcriptContainerRef}>
          {transcript.map((line, index) => (
            <div 
              key={index} 
              className="transcript-line"
              data-timestamp={line.startTime.split('.')[0]} >
              <a href={`${episode.url}&t=${line.startSeconds}s`} target="_blank" rel="noopener noreferrer" className="timestamp-link" title={`Go to ${line.startTime.split('.')[0]} in video`}>
                [{line.startTime.split('.')[0]}]
              </a>
              <p className="transcript-text">{line.text}</p>
            </div>
          ))}
        </div>
      </div>
      
      {popup.show && (
        <div 
          className="selection-popup" 
          style={{ left: `${popup.x}px`, top: `${popup.y}px` }}
          onMouseDown={(e) => e.stopPropagation()} 
          onClick={() => openReportModal(selectedText)}
        >
          Report Transcription Error
        </div>
      )}

      {isModalOpen && (
        <ReportErrorModal 
          episodeTitle={episode.title}
          repoUrl={GITHUB_REPO_URL}
          initialIncorrectText={selectedText}
          onClose={closeReportModal}
          initialTimestamp={selectedTimestamp} 
        />
      )}    
      </>
  );
}

export default EpisodePage;