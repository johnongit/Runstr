import { X } from 'lucide-react';

const PrizePoolModal = ({ open, onClose }) => {
  if (!open) return null;

  const activityModes = [
    { name: 'Running', icon: '🏃' },
    { name: 'Walking', icon: '🚶' },
    { name: 'Cycling', icon: '🚴' }
  ];

  const prizeStructure = [
    { place: '1st Place', amount: '30,000', badge: '🥇 1st Place Badge' },
    { place: '2nd Place', amount: '20,000', badge: '🥈 2nd Place Badge' },
    { place: '3rd Place', amount: '15,000', badge: '🥉 3rd Place Badge' },
    { place: 'Honorable Mention', amount: '5,000', badge: '🎖️ Honorable Mention Badge' }
  ];

  const fundAllocation = [
    { description: 'OpenSats Donation (per participant)', amount: '2,000', icon: '💝' },
    { description: 'App Development', amount: '7,000', icon: '🔧' },
    { description: 'Prize Pool Addition', amount: '1,000', icon: '💰' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-secondary rounded-lg border border-border-secondary max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-border-secondary bg-bg-tertiary">
          <div>
            <h2 className="text-xl font-bold text-text-primary">RUNSTR Season 1 Prize Pool</h2>
            <p className="text-text-secondary text-sm">200,000 sats total distribution</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-bg-primary rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Prize Breakdown Section */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              🏆 Prize Breakdown by Activity Mode
            </h3>
            
            {/* Activity Modes */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {activityModes.map((mode) => (
                <div key={mode.name} className="text-center p-3 bg-bg-tertiary rounded-lg border border-border-secondary">
                  <div className="text-2xl mb-1">{mode.icon}</div>
                  <div className="text-sm font-medium text-text-primary">{mode.name}</div>
                </div>
              ))}
            </div>

            {/* Prize Structure */}
            <div className="space-y-3">
              {prizeStructure.map((prize) => (
                <div key={prize.place} className="flex items-center justify-between p-4 bg-bg-tertiary rounded-lg border border-border-secondary">
                  <div className="flex items-center gap-3">
                    <div className="font-medium text-text-primary">{prize.place}</div>
                    <div className="text-text-secondary text-sm">{prize.badge}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-text-primary">{prize.amount} sats</div>
                    <div className="text-xs text-text-secondary">per activity mode</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Prize Pool */}
            <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/30">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-text-primary">Total Prize Pool</div>
                <div className="font-bold text-xl text-primary">210,000 sats</div>
              </div>
              <div className="text-xs text-text-secondary mt-1">70,000 sats × 3 activity modes</div>
            </div>
          </div>

          {/* Fund Allocation Section */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              💰 Fund Allocation per Season Pass
            </h3>
            <div className="space-y-3">
              {fundAllocation.map((allocation, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-bg-tertiary rounded-lg border border-border-secondary">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{allocation.icon}</span>
                    <span className="font-medium text-text-primary">{allocation.description}</span>
                  </div>
                  <div className="font-bold text-text-primary">{allocation.amount} sats</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-text-secondary">
              * From each 10,000 sat Season Pass purchase
            </div>
          </div>

          {/* Rules Section */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              📋 Competition Rules
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-bg-tertiary rounded-lg border border-border-secondary">
                <span className="text-xl">🎫</span>
                <div>
                  <div className="font-medium text-text-primary">Season Pass Required</div>
                  <div className="text-sm text-text-secondary">You must purchase a Season Pass to participate in the competition</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 bg-bg-tertiary rounded-lg border border-border-secondary">
                <span className="text-xl">📱</span>
                <div>
                  <div className="font-medium text-text-primary">Save to Nostr</div>
                  <div className="text-sm text-text-secondary">Your activities only count if you save your runs to Nostr</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                <span className="text-xl">⚠️</span>
                <div>
                  <div className="font-medium text-red-400">Anti-Cheat Policy</div>
                  <div className="text-sm text-red-300">Signs of cheating will result in immediate disqualification from the tournament</div>
                </div>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <div className="pt-4 border-t border-border-secondary">
            <button
              onClick={onClose}
              className="w-full py-3 bg-primary text-text-primary font-semibold rounded-lg hover:bg-primary/80 transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrizePoolModal; 