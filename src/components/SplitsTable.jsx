import PropTypes from 'prop-types';
import { formatDuration, formatPace } from '../utils/formatters';
import { useEffect, useState } from 'react';

const SplitsTable = ({ splits, distanceUnit = 'km' }) => {
  const [visibleColumns, setVisibleColumns] = useState({
    distance: true,
    time: true,
    pace: true
  });

  // Responsive column management based on screen size
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 360) { // Very small screens
        setVisibleColumns({
          distance: true,
          time: true,
          pace: false
        });
      } else { // Larger screens
        setVisibleColumns({
          distance: true,
          time: true,
          pace: true
        });
      }
    };

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!splits || splits.length === 0) {
    return null;
  }

  // Determine the type of splits we have
  // RunTracker splits have km, time, pace
  // runCalculations splits have pace, duration, distance
  const isRunTrackerSplits = 'km' in splits[0] && 'time' in splits[0];

  return (
    <div className="w-full">
      <div className="overflow-x-auto max-w-full pb-2">
        <table className="min-w-full bg-gray-800 rounded-lg">
          <thead>
            <tr className="bg-gray-700">
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[50px]">
                Split
              </th>
              {visibleColumns.distance && (
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[70px]">
                  Distance
                </th>
              )}
              {visibleColumns.time && (
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[70px]">
                  Time
                </th>
              )}
              {visibleColumns.pace && (
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[70px]">
                  Pace
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {splits.map((split, index) => {
              let splitTime;
              let paceMinutes;
              
              if (isRunTrackerSplits) {
                // Calculate individual split time rather than using cumulative time
                const prevSplitTime = index > 0 ? splits[index - 1].time : 0;
                splitTime = split.time - prevSplitTime;
                
                // Use the pre-calculated pace from the split object (it's in seconds/meter)
                // Convert s/m to min/km or min/mi for formatPace function
                if (split.pace && split.pace > 0) { // Ensure split.pace is valid
                  const metersPerUnit = distanceUnit === 'km' ? 1000 : 1609.344;
                  paceMinutes = (split.pace * metersPerUnit) / 60;
                } else {
                  // Fallback if split.pace is not valid, though this shouldn't happen with RunTracker.js logic
                  paceMinutes = splitTime > 0 ? (splitTime / 60) : 0; 
                }
              } else {
                // For splits from runCalculations
                splitTime = split.duration; // duration is already in seconds
                paceMinutes = split.pace; // Already in minutes per unit
              }
              
              return (
                <tr key={index} className="hover:bg-gray-700">
                  <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-200">
                    {index + 1}
                  </td>
                  {visibleColumns.distance && (
                    <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-200">
                      {distanceUnit === 'km' ? '1 km' : '1 mi'}
                    </td>
                  )}
                  {visibleColumns.time && (
                    <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-200">
                      {formatDuration(splitTime)}
                    </td>
                  )}
                  {visibleColumns.pace && (
                    <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-200">
                      {formatPace(paceMinutes, distanceUnit)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

SplitsTable.propTypes = {
  splits: PropTypes.arrayOf(
    PropTypes.shape({
      // Allow both types of split data
      time: PropTypes.number,
      pace: PropTypes.number,
      km: PropTypes.number,
      duration: PropTypes.number,
      distance: PropTypes.number
    })
  ),
  distanceUnit: PropTypes.oneOf(['km', 'mi'])
};

SplitsTable.defaultProps = {
  splits: [],
  distanceUnit: 'km'
};

export default SplitsTable; 