import React from 'react';

interface TeamStatsWidgetProps {
  totalDistance: number;
}

const TeamStatsWidget: React.FC<TeamStatsWidgetProps> = ({ totalDistance }) => {
  return (
    <div className="bg-gray-800 p-4 rounded-lg my-4">
      <h3 className="text-lg font-semibold text-white mb-2">This Month's Team Stats</h3>
      <div className="text-center">
        <p className="text-gray-400 text-sm">Total Distance</p>
        <p className="text-3xl font-bold text-blue-400">
          {totalDistance.toFixed(2)} <span className="text-xl">km</span>
        </p>
      </div>
    </div>
  );
};

export default TeamStatsWidget; 