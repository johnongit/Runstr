import { useState, useEffect } from 'react';
import { signInWithNostr, publishToNostr } from '../utils/nostr';

export const RunHistory = () => {
  const [runHistory, setRunHistory] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [additionalContent, setAdditionalContent] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    const loadRunHistory = () => {
      const storedRuns = localStorage.getItem('runHistory');
      if (storedRuns) {
        setRunHistory(JSON.parse(storedRuns));
      }
    };
    loadRunHistory();
  }, []);

  const handlePostToNostr = (run) => {
    setSelectedRun(run);
    setShowModal(true);
  };

  const handlePostSubmit = async () => {
    if (!window.nostr) {
      signInWithNostr();
      return;
    }

    setIsPosting(true);

    const content = `
🏃‍♂️ Run Completed!
⏱️ Duration: ${formatTime(selectedRun.duration)}
📏 Distance: ${selectedRun.distance.toFixed(2)} km
⚡️ Pace: ${selectedRun.duration > 0 ? ((selectedRun.duration / 60) / selectedRun.distance).toFixed(2) : '0'} min/km

${additionalContent}

#Runstr #Running
`;

    const event = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['t', 'Runstr'], ['t', 'Running']],
      content: content,
    };

    try {
      await publishToNostr(event);
      setShowModal(false);
      setAdditionalContent('');
      alert('Successfully posted to Nostr!');
    } catch (error) {
      alert('Failed to post to Nostr. Please try again.');
      console.error('Error posting to Nostr:', error);
    } finally {
      setIsPosting(false);
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="run-history">
      <h2>Run History</h2>
      {runHistory.length === 0 ? (
        <p>No runs recorded yet</p>
      ) : (
        <ul className="history-list">
          {runHistory.map((run) => (
            <li key={run.id} className="history-item">
              <div className="run-date">{run.date}</div>
              <div className="run-details">
                <span>Duration: {formatTime(run.duration)}</span>
                <span>Distance: {run.distance.toFixed(2)} km</span>
                <span>Pace: {run.duration > 0 ? ((run.duration / 60) / run.distance).toFixed(2) : '0'} min/km</span>
              </div>
              <button onClick={() => handlePostToNostr(run)}>Share to Nostr</button>
            </li>
          ))}
        </ul>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Post Run to Nostr</h3>
            <textarea
              value={additionalContent}
              onChange={(e) => setAdditionalContent(e.target.value)}
              placeholder="Add any additional comments or hashtags..."
              rows={4}
              disabled={isPosting}
            />
            <div className="modal-buttons">
              <button 
                onClick={handlePostSubmit} 
                disabled={isPosting}
              >
                {isPosting ? 'Posting...' : 'Post'}
              </button>
              <button 
                onClick={() => setShowModal(false)}
                disabled={isPosting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 