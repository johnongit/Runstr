import React from 'react';
import { Dialog } from '@headlessui/react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PrizePoolModal: React.FC<Props> = ({ open, onClose }) => {
  const prizeBreakdown = [
    {
      mode: 'Running',
      icon: '🏃‍♂️',
      prizes: [
        { place: '1st', amount: '30,000', color: 'text-amber-400' },
        { place: '2nd', amount: '20,000', color: 'text-gray-300' },
        { place: '3rd', amount: '15,000', color: 'text-orange-400' },
        { place: 'Hon.', amount: '5,000', color: 'text-blue-400' }
      ]
    },
    {
      mode: 'Walking',
      icon: '🚶‍♂️',
      prizes: [
        { place: '1st', amount: '30,000', color: 'text-amber-400' },
        { place: '2nd', amount: '20,000', color: 'text-gray-300' },
        { place: '3rd', amount: '15,000', color: 'text-orange-400' },
        { place: 'Hon.', amount: '5,000', color: 'text-blue-400' }
      ]
    },
    {
      mode: 'Cycling',
      icon: '🚴‍♂️',
      prizes: [
        { place: '1st', amount: '30,000', color: 'text-amber-400' },
        { place: '2nd', amount: '20,000', color: 'text-gray-300' },
        { place: '3rd', amount: '15,000', color: 'text-orange-400' },
        { place: 'Hon.', amount: '5,000', color: 'text-blue-400' }
      ]
    }
  ];

  const totalPrizePool = 200000; // 200k sats

  return (
    <Dialog open={open} onClose={onClose} className="fixed z-50 inset-0 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <Dialog.Overlay className="fixed inset-0 bg-black/60" />

        <div className="relative bg-bg-secondary text-text-primary p-6 rounded-lg shadow-xl w-full max-w-md mx-auto space-y-6 z-10 border border-border-secondary">
          <div className="flex justify-between items-center">
            <Dialog.Title className="text-xl font-bold">
              🏆 RUNSTR Season 1 Prize Pool
            </Dialog.Title>
            <button 
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary"
            >
              ✕
            </button>
          </div>

          {/* Total Prize Pool */}
          <div className="text-center bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-4">
            <div className="text-3xl font-bold text-amber-400 mb-1">
              {totalPrizePool.toLocaleString()}
            </div>
            <div className="text-amber-300 font-semibold">TOTAL SATS</div>
            <div className="text-xs text-text-secondary mt-2">
              Distributed across all activity modes
            </div>
          </div>

          {/* Competition Rules */}
          <div className="bg-bg-tertiary rounded-lg p-4 border border-border-secondary">
            <h3 className="font-semibold text-text-primary mb-2">📋 Competition Rules</h3>
            <ul className="text-sm text-text-secondary space-y-1">
              <li>• <strong>Duration:</strong> February 1 - May 1, 2025 (3 months)</li>
              <li>• <strong>Goal:</strong> Log the most distance in your activity mode</li>
              <li>• <strong>Entry:</strong> Purchase Season Pass (10,000 sats)</li>
              <li>• <strong>Verification:</strong> All activities logged via RUNSTR app</li>
            </ul>
          </div>

          {/* Prize Breakdown */}
          <div className="space-y-4">
            <h3 className="font-semibold text-text-primary">💰 Prize Breakdown</h3>
            
            {prizeBreakdown.map((activity) => (
              <div key={activity.mode} className="bg-bg-tertiary rounded-lg p-4 border border-border-secondary">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{activity.icon}</span>
                  <span className="font-semibold text-text-primary">{activity.mode}</span>
                </div>
                
                <div className="grid grid-cols-4 gap-3">
                  {activity.prizes.map((prize) => (
                    <div key={prize.place} className="text-center">
                      <div className={`font-semibold ${prize.color} text-sm`}>
                        {prize.place}
                      </div>
                      <div className="text-xs text-text-secondary">
                        {prize.amount}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Additional Info */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <div className="text-sm text-blue-400">
              <strong>💡 Pro Tip:</strong> Honorable mention prizes are awarded to participants who show exceptional improvement or consistency, as determined by the RUNSTR team.
            </div>
          </div>

          {/* Close Button */}
          <button 
            onClick={onClose}
            className="w-full bg-primary text-text-primary hover:bg-primary/80 py-3 rounded-md font-semibold transition-colors"
          >
            Got it! 🚀
          </button>
        </div>
      </div>
    </Dialog>
  );
};

export default PrizePoolModal; 