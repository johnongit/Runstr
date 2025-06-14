import PropTypes from 'prop-types';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';

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
    <Card className="mb-4 bg-surface border-border">
      <CardContent className="p-6">
        {/* Header Section */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col">
            <h3 className="text-lg font-semibold text-text-primary mb-1">
              {run.title}
            </h3>
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="flex-shrink-0"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span>{run.date}</span>
            </div>
          </div>
        </div>

        {/* Metrics Section */}
        <div className="grid grid-cols-1 gap-3 mt-4">
          {/* Distance Metric */}
          <div className="bg-surface-elevated border border-border rounded-lg p-3 flex items-center">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-success/10 text-success mr-3 flex-shrink-0">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-text-tertiary">Distance</span>
              <span className="text-sm font-semibold text-text-primary">
                {displayDistance(run.distance, distanceUnit)}
              </span>
            </div>
          </div>

          {/* Duration Metric */}
          <div className="bg-surface-elevated border border-border rounded-lg p-3 flex items-center">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-info/10 text-info mr-3 flex-shrink-0">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-text-tertiary">Duration</span>
              <span className="text-sm font-semibold text-text-primary">
                {formatTime(run.duration)}
              </span>
            </div>
          </div>

          {/* Pace/Speed Metric */}
          <div className="bg-surface-elevated border border-border rounded-lg p-3 flex items-center">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-warning/10 text-warning mr-3 flex-shrink-0">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-text-tertiary">
                {run.mainMetricLabel || 'Pace'}
              </span>
              <span className="text-sm font-semibold text-text-primary">
                {run.mainMetricValue || '0.00'} {run.mainMetricUnit || (run.activityType === 'run' ? `min/${distanceUnit}` : run.activityType === 'cycle' ? (distanceUnit === 'km' ? 'km/h' : 'mph') : 'steps')}
              </span>
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border">
          <Button 
            variant="secondary"
            size="md"
            onClick={() => onShare(run)}
            className="w-full justify-start"
            leftIcon={
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                <polyline points="16 6 12 2 8 6"></polyline>
                <line x1="12" y1="2" x2="12" y2="15"></line>
              </svg>
            }
          >
            Post to Nostr
          </Button>
          
          <Button 
            variant="secondary"
            size="md"
            onClick={() => onSave(run)}
            disabled={isSaving || isWorkoutSaved}
            loading={isSaving}
            className="w-full justify-start text-success border-success hover:bg-success hover:text-background"
            leftIcon={
              !isSaving ? (
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
              ) : null
            }
          >
            {isSaving ? 'Saving...' : isWorkoutSaved ? 'Record Saved' : 'Save Workout Record'}
          </Button>
          
          <Button 
            variant="secondary"
            size="md"
            onClick={() => onDelete(run)}
            disabled={isDeleting}
            loading={isDeleting}
            className="w-full justify-start text-error border-error hover:bg-error hover:text-background"
            leftIcon={
              !isDeleting ? (
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                </svg>
              ) : null
            }
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </CardContent>
    </Card>
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