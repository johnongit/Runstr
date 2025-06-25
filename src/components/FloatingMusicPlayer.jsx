import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useState, useContext, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NostrContext } from '../contexts/NostrContext';
import WavlakeZap from './WavlakeZap';
import PropTypes from 'prop-types';

export const FloatingMusicPlayer = () => {
  const { 
    currentTrack, 
    isPlaying, 
    togglePlayPause, 
    playNext, 
    playPrevious
  } = useAudioPlayer();
  
  const { defaultZapAmount } = useContext(NostrContext);
  const [expanded, setExpanded] = useState(false);
  const [zapStatus, setZapStatus] = useState({ loading: false, success: false, error: null });
  const navigate = useNavigate();
  
  // For progress tracking (simplified for this implementation)
  const [progress, setProgress] = useState(0);
  const progressInterval = useRef(null);
  
  useEffect(() => {
    // Simulate progress updates when playing
    if (isPlaying) {
      progressInterval.current = setInterval(() => {
        setProgress(prev => (prev >= 100 ? 0 : prev + 0.5));
      }, 1000);
    } else {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    }
    
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [isPlaying]);

  if (!currentTrack) return null;

  // Handle zap success
  const handleZapSuccess = (/* result */) => {
    setZapStatus({
      loading: false,
      success: true,
      error: null
    });
    
    // Hide success message after 3 seconds
    setTimeout(() => {
      setZapStatus(prev => ({
        ...prev,
        success: false
      }));
    }, 3000);
  };

  // Handle zap error
  const handleZapError = (error) => {
    console.error('Floating player zap error:', error);
    setZapStatus({
      loading: false,
      success: false,
      error: error.message || 'Failed to send zap'
    });
    
    // Hide error message after 5 seconds
    setTimeout(() => {
      setZapStatus(prev => ({
        ...prev,
        error: null
      }));
    }, 5000);
  };

  // Custom Progress Bar Component using design system colors
  const ProgressBar = ({ value }) => (
    <div className="relative w-full h-1 bg-bg-tertiary rounded-full cursor-pointer">
      <div 
        className="absolute top-0 left-0 h-full rounded-full"
        style={{ 
          width: `${value}%`,
          background: 'var(--primary)'
        }}
      />
    </div>
  );

  ProgressBar.propTypes = {
    value: PropTypes.number.isRequired
  };
  
  // Format time (simplified as we don't have actual duration)
  const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed z-50 left-1/2 top-4 transform -translate-x-1/2 w-full max-w-md px-2">
      {expanded ? (
        <div className="rounded-xl shadow-lg border border-border-secondary bg-bg-secondary backdrop-blur-md p-4 w-full">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 flex-shrink-0 rounded-xl bg-bg-tertiary overflow-hidden flex items-center justify-center border border-border-secondary">
              {currentTrack.artwork ? (
                <img 
                  src={currentTrack.artwork} 
                  alt="cover art" 
                  className="object-cover w-full h-full" 
                />
              ) : (
                <div className="text-primary text-lg">♪</div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-base text-text-primary truncate">
                {currentTrack.title}
              </div>
              <div className="text-sm text-text-secondary truncate">
                {currentTrack.artist || 'Unknown Artist'}
              </div>
            </div>
            
            <button 
              onClick={() => setExpanded(false)} 
              className="text-text-secondary hover:text-text-primary bg-transparent border-none p-2 rounded-full transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
          
          <div className="mt-4 flex flex-col gap-2">
            <ProgressBar value={progress} />
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>{formatTime(Math.floor(progress * 3))}</span>
              <span>{formatTime(300)}</span>
            </div>
          </div>
          
          <div className="flex justify-center items-center gap-6 mt-3">
            <button 
              onClick={playPrevious} 
              className="music-control-button bg-primary hover:bg-primary-hover text-white w-10 h-10 rounded-lg flex items-center justify-center transition-all shadow-md"
            >
              <span className="unicode-icon text-lg font-bold select-none">⏮</span>
            </button>
            
            <button 
              onClick={togglePlayPause} 
              className="music-control-button bg-primary hover:bg-primary-hover text-white w-12 h-12 rounded-lg flex items-center justify-center transition-all shadow-lg"
            >
              <span className="unicode-icon text-xl font-bold select-none">
                {isPlaying ? '⏸' : '▶'}
              </span>
            </button>
            
            <button 
              onClick={playNext} 
              className="music-control-button bg-primary hover:bg-primary-hover text-white w-10 h-10 rounded-lg flex items-center justify-center transition-all shadow-md"
            >
              <span className="unicode-icon text-lg font-bold select-none">⏭</span>
            </button>
            
            <WavlakeZap
              trackId={currentTrack.id}
              amount={defaultZapAmount}
              buttonClass="bg-primary hover:bg-primary-hover text-white w-10 h-10 rounded-lg flex items-center justify-center transition-all shadow-md"
              buttonText=""
              onSuccess={handleZapSuccess}
              onError={handleZapError}
            />
          </div>
          
          {zapStatus.error && (
            <p className="text-xs text-error mt-3 text-center bg-error-light border border-error rounded-lg p-2">
              {zapStatus.error}
            </p>
          )}
          {zapStatus.success && (
            <p className="text-xs text-success mt-3 text-center bg-success-light border border-success rounded-lg p-2">
              Zap sent! ⚡️
            </p>
          )}
          
          <div className="flex justify-between items-center mt-3">
            <button onClick={() => navigate('/music')} className="text-xs text-primary hover:text-primary-hover transition-colors">
              Go to Music
            </button>
          </div>
        </div>
      ) : (
        <div 
          className="flex items-center bg-bg-secondary backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-border-secondary cursor-pointer"
          onClick={() => setExpanded(true)}
        >
          <button 
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }} 
            className="music-control-button text-text-primary hover:text-primary bg-transparent border-none p-1 rounded-full mr-2 transition-colors flex items-center justify-center w-6 h-6"
          >
            <span className="unicode-icon text-lg font-bold select-none">
              {isPlaying ? '⏸' : '▶'}
            </span>
          </button>
          
          <span className="flex-1 text-sm text-text-primary truncate">
            {currentTrack.title}
          </span>
          
          {!zapStatus.error && (
            <WavlakeZap
              trackId={currentTrack.id}
              amount={defaultZapAmount}
              buttonClass="ml-2 text-text-secondary hover:text-primary bg-transparent border-none p-1 rounded-full transition-colors"
              buttonText=""
              onSuccess={handleZapSuccess}
              onError={handleZapError}
            />
          )}
          
          {zapStatus.error && <span className="ml-2 text-xs text-error">⚡</span>}
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
            }}
            className="ml-1 text-text-secondary hover:text-text-primary bg-transparent border-none p-1 rounded-full transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}; 