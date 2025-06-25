import PropTypes from 'prop-types';
import React from 'react';
import { Button } from './ui/button';
import { LoadingButton } from './ui/LoadingSpinner';
import appToast from '../utils/toast';

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
            <h3 className="component-heading mb-1">{run.title}</h3>
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
          <div className="flex space-x-2">
            <LoadingButton
              onClick={onShare}
              isLoading={false}
              loadingText="Sharing..."
              className="flex-1 bg-bg-primary hover:bg-bg-tertiary text-text-primary font-medium py-2 px-4 rounded-lg border border-border-primary transition-colors"
            >
              Share
            </LoadingButton>
            
            <LoadingButton
              onClick={onSave}
              isLoading={isSaving}
              loadingText="Saving..."
              disabled={isWorkoutSaved}
              className={`flex-1 font-medium py-2 px-4 rounded-lg border transition-colors ${
                isWorkoutSaved 
                  ? 'bg-success text-white border-success cursor-not-allowed' 
                  : 'bg-bg-primary hover:bg-bg-tertiary text-text-primary border-border-primary'
              }`}
            >
              {isWorkoutSaved ? 'Saved ✓' : 'Save'}
            </LoadingButton>
            
            <LoadingButton
              onClick={onDelete}
              isLoading={isDeleting}
              loadingText="Deleting..."
              className="px-3 py-2 bg-bg-primary hover:bg-bg-tertiary text-text-primary rounded-lg border border-border-primary transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </LoadingButton>
          </div>
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