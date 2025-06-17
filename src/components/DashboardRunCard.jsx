import PropTypes from 'prop-types';

export function DashboardRunCard({ 
  run, 
  formatTime, 
  displayDistance, 
  distanceUnit, 
  onShare, 
  onSave, 
  onDelete,
  isSaving,
  isWorkoutSaved,
  isDeleting
}) {
  return (
    <div className="bg-bg-secondary rounded-xl overflow-hidden mb-4 shadow-lg border border-border-secondary">
      <div className="p-4 flex flex-col gap-3">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <h3 className="text-lg font-semibold text-text-primary mb-1">{run.title}</h3>
            <div className="text-sm text-text-secondary flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span>{run.date}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 mt-2">
          <div className="bg-bg-primary/50 rounded-lg p-2.5 flex items-center border border-border-secondary">
            <div className="flex items-center justify-center mr-2.5 w-8 h-8 rounded-lg bg-success/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success">
                <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-text-muted">Distance</span>
              <span className="text-sm font-semibold text-text-primary">{displayDistance(run.distance, distanceUnit)}</span>
            </div>
          </div>

          <div className="bg-bg-primary/50 rounded-lg p-2.5 flex items-center border border-border-secondary">
            <div className="flex items-center justify-center mr-2.5 w-8 h-8 rounded-lg bg-secondary/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-secondary">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-text-muted">Duration</span>
              <span className="text-sm font-semibold text-text-primary">{formatTime(run.duration)}</span>
            </div>
          </div>

          <div className="bg-bg-primary/50 rounded-lg p-2.5 flex items-center border border-border-secondary">
            <div className="flex items-center justify-center mr-2.5 w-8 h-8 rounded-lg bg-warning/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
                <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-text-muted">{run.mainMetricLabel || 'Pace'}</span>
              <span className="text-sm font-semibold text-text-primary">
                {run.mainMetricValue || '0.00'} {run.mainMetricUnit || (run.activityType === 'run' ? `min/${distanceUnit}` : run.activityType === 'cycle' ? (distanceUnit === 'km' ? 'km/h' : 'mph') : 'steps')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-border-secondary">
          <button 
            className="flex items-center justify-start p-2 px-4 text-sm font-medium rounded-lg bg-bg-tertiary text-primary border border-border-secondary hover:bg-primary/10 transition-colors duration-normal"
            onClick={() => onShare(run)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
              <polyline points="16 6 12 2 8 6"></polyline>
              <line x1="12" y1="2" x2="12" y2="15"></line>
            </svg>
            Post to Nostr
          </button>
          
          <button 
            className="flex items-center justify-start p-2 px-4 text-sm font-medium rounded-lg bg-bg-tertiary text-success border border-border-secondary hover:bg-success/10 transition-colors duration-normal disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => onSave(run)}
            disabled={isSaving || isWorkoutSaved}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            {isSaving ? 'Saving...' : isWorkoutSaved ? 'Record Saved' : 'Save Workout Record'}
          </button>
          
          <button 
            className="flex items-center justify-start p-2 px-4 text-sm font-medium rounded-lg bg-bg-tertiary text-error border border-border-secondary hover:bg-error/10 transition-colors duration-normal disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => onDelete(run)}
            disabled={isDeleting}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

DashboardRunCard.propTypes = {
  run: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string,
    date: PropTypes.string.isRequired,
    distance: PropTypes.number.isRequired,
    duration: PropTypes.number.isRequired,
    activityType: PropTypes.string,
    estimatedTotalSteps: PropTypes.number,
    averageSpeed: PropTypes.shape({ value: PropTypes.string, unit: PropTypes.string }),
    mainMetricLabel: PropTypes.string,
    mainMetricValue: PropTypes.string,
    mainMetricUnit: PropTypes.string,
  }).isRequired,
  formatTime: PropTypes.func.isRequired,
  displayDistance: PropTypes.func.isRequired,
  distanceUnit: PropTypes.string.isRequired,
  onShare: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  isSaving: PropTypes.bool,
  isWorkoutSaved: PropTypes.bool,
  isDeleting: PropTypes.bool
};

DashboardRunCard.defaultProps = {
  isSaving: false,
  isWorkoutSaved: false,
  isDeleting: false
};

export default DashboardRunCard; 