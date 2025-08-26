import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import runDataService, { ACTIVITY_TYPES } from '../services/RunDataService';
import { useSettings } from '../contexts/SettingsContext';
import { NostrContext } from '../contexts/NostrContext';

const AddManualActivity = () => {
  const navigate = useNavigate();
  const { distanceUnit } = useSettings();
  const { publicKey } = useContext(NostrContext);

  const [type, setType] = useState(ACTIVITY_TYPES.RUN);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const dist = parseFloat(distance);
    const dur = parseFloat(duration);
    if (isNaN(dist) || isNaN(dur)) return;

    const distanceMeters = distanceUnit === 'mi' ? dist * 1609.34 : dist * 1000;
    const durationSeconds = dur * 60;

    runDataService.saveRun({
      activityType: type,
      distance: distanceMeters,
      duration: durationSeconds,
      timestamp: new Date(date).getTime(),
      unit: distanceUnit
    }, publicKey);

    navigate('/history');
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="page-title">Add Activity</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Type</label>
          <select value={type} onChange={e => setType(e.target.value)} className="w-full px-3 py-2 bg-bg-secondary border border-border-secondary rounded">
            <option value={ACTIVITY_TYPES.RUN}>Run</option>
            <option value={ACTIVITY_TYPES.WALK}>Walk</option>
            <option value={ACTIVITY_TYPES.CYCLE}>Cycle</option>
          </select>
        </div>
        <div>
          <label className="block mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2 bg-bg-secondary border border-border-secondary rounded" />
        </div>
        <div>
          <label className="block mb-1">Distance ({distanceUnit})</label>
          <input type="number" step="0.01" value={distance} onChange={e => setDistance(e.target.value)} className="w-full px-3 py-2 bg-bg-secondary border border-border-secondary rounded" />
        </div>
        <div>
          <label className="block mb-1">Duration (minutes)</label>
          <input type="number" step="1" value={duration} onChange={e => setDuration(e.target.value)} className="w-full px-3 py-2 bg-bg-secondary border border-border-secondary rounded" />
        </div>
        <button type="submit" className="w-full px-4 py-2 bg-primary text-white rounded">Save</button>
      </form>
    </div>
  );
};

export default AddManualActivity;
