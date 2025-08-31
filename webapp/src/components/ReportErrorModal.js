    
import React, { useState, useEffect } from 'react';

function ReportErrorModal({ episodeTitle, repoUrl, initialIncorrectText = '', initialTimestamp = '', onClose }) {

  const [timestamp, setTimestamp] = useState('');
  const [incorrectText, setIncorrectText] = useState(initialIncorrectText);
  const [correctText, setCorrectText] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setIncorrectText(initialIncorrectText);
  }, [initialIncorrectText]);

  useEffect(() => {
    setTimestamp(initialTimestamp);
  }, [initialTimestamp]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();

    // 1. Construct the issue title
    const issueTitle = `Correction for ${episodeTitle}`;

    // 2. Construct the issue body based on your template
    const issueBody = `
---

**1. Episode Name**
${episodeTitle}

**2. Approximate Timestamp or Context**
${timestamp || '(Not provided)'}

**3. The Incorrect Text**
\`\`\`
${incorrectText || '(Not provided)'}
\`\`\`

**4. The Correct Text**
\`\`\`
${correctText || '(Not provided)'}
\`\`\`

**Additional Notes (Optional)**
${notes || '(None)'}
    `;

    // 3. Encode everything for the URL
    const encodedTitle = encodeURIComponent(issueTitle);
    const encodedBody = encodeURIComponent(issueBody.trim());
    const labels = 'transcription'; // As defined in your template

    // 4. Create the final URL
    const finalUrl = `${repoUrl}/issues/new?title=${encodedTitle}&body=${encodedBody}&labels=${labels}`;
    
    // 5. Open the URL in a new tab and close the modal
    window.open(finalUrl, '_blank', 'noopener,noreferrer');
    onClose();
  };
  
  // Prevent scrolling on the body when the modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);


  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <button className="modal-close-button" onClick={onClose}>&times;</button>
        <h2>Report Transcription Error</h2>
        <p><strong>Episode:</strong> {episodeTitle}</p>
        <form onSubmit={handleSubmit} className="error-report-form">
          <label>
            Approximate Timestamp or Context
            <input 
              type="text" 
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              placeholder="e.g., Around 25:30"
            />
          </label>
          <label>
            The Incorrect Text
            <textarea 
              rows="4"
              value={incorrectText}
              onChange={(e) => setIncorrectText(e.target.value)}
              placeholder="Copy and paste the incorrect line(s) here"
              required
            />
          </label>
          <label>
            The Correct Text
            <textarea 
              rows="4"
              value={correctText}
              onChange={(e) => setCorrectText(e.target.value)}
              placeholder="Provide the corrected version of the text"
              required
            />
          </label>
           <label>
            Additional Notes (Optional)
            <textarea 
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything else we should know?"
            />
          </label>
          <button type="submit" className="submit-issue-button">Create Issue on GitHub</button>
        </form>
      </div>
    </div>
  );
}

export default ReportErrorModal;

  