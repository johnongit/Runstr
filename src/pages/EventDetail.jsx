import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { 
  getEventById, 
  isUserRegisteredForEvent, 
  registerForEvent
} from '../services/EventService';
import EventLeaderboard from '../components/EventLeaderboard';

const EventDetail = ({ profiles = new Map(), userPublicKey = null }) => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  
  useEffect(() => {
    const loadEvent = () => {
      const eventData = getEventById(eventId);
      if (!eventData) {
        navigate('/events');
        return;
      }
      
      setEvent(eventData);
      setIsRegistered(isUserRegisteredForEvent(eventId));
      setIsLoading(false);
    };
    
    loadEvent();
  }, [eventId, navigate]);
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  const handleRegister = () => {
    if (!userPublicKey) {
      alert('Please log in with your Nostr key in Settings to register.');
      return;
    }
    
    // Show payment modal
    setShowPaymentModal(true);
  };
  
  const handlePaymentSuccess = () => {
    registerForEvent(eventId, userPublicKey);
    setIsRegistered(true);
    setShowPaymentModal(false);
    alert('Successfully registered for the event!');
  };
  
  if (isLoading) {
    return (
      <div className="event-detail-container p-4">
        <p>Loading event details...</p>
      </div>
    );
  }
  
  if (!event) {
    return (
      <div className="event-detail-container p-4">
        <p>Event not found.</p>
      </div>
    );
  }
  
  return (
    <div className="event-detail-container p-4">
      <div className="mb-4">
        <button 
          onClick={() => navigate(-1)}
          className="text-indigo-600"
        >
          ← Back
        </button>
      </div>
      
      <div className="event-header mb-6">
        <div className="flex items-center mb-2">
          {event.hostClub?.avatar && (
            <img 
              src={event.hostClub.avatar} 
              alt={event.hostClub.name || 'Event host'} 
              className="h-10 w-10 rounded-full mr-3"
            />
          )}
          <h1 className="text-2xl font-bold">{event.title}</h1>
        </div>
        
        <div className="text-sm text-gray-600 mb-2">
          Hosted by {event.hostClub?.name || 'RUNSTR'}
        </div>
        
        <div className="status-badge">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            event.status === 'active' 
              ? 'bg-green-100 text-green-800' 
              : event.status === 'upcoming' 
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-800'
          }`}>
            {event.status.toUpperCase()}
          </span>
        </div>
      </div>
      
      {!isRegistered && event.status !== 'completed' && (
        <div className="event-registration mb-4">
          <button
            onClick={handleRegister}
            disabled={event.status === 'completed'}
            className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition-colors"
          >
            Register for {event.entryFee.toLocaleString()} sats
          </button>
        </div>
      )}
      
      {isRegistered && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="font-medium text-green-800">You&apos;re registered for this event!</div>
          {event.status === 'upcoming' && (
            <div className="text-sm text-green-700">
              The event will begin on {formatDate(event.startDate)}. Be ready to run!
            </div>
          )}
          {event.status === 'active' && (
            <div className="text-sm text-green-700">
              This event is active! Go for a run to participate.
            </div>
          )}
        </div>
      )}
      
      {/* Tab Navigation */}
      <div className="tabs-container mb-4">
        <div className="flex border-b border-gray-200">
          <button
            className={`py-2 px-4 font-medium text-sm ${
              activeTab === 'details'
                ? 'border-b-2 border-indigo-500 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('details')}
          >
            Event Details
          </button>
          <button
            className={`py-2 px-4 font-medium text-sm ${
              activeTab === 'leaderboard'
                ? 'border-b-2 border-indigo-500 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('leaderboard')}
          >
            Leaderboard
          </button>
          <button
            className={`py-2 px-4 font-medium text-sm ${
              activeTab === 'rules'
                ? 'border-b-2 border-indigo-500 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('rules')}
          >
            Rules
          </button>
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'details' && (
          <div className="event-details mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h2 className="text-lg font-semibold mb-2">Event Details</h2>
                <div className="bg-gray-50 p-4 rounded-md">
                  <div className="mb-2">
                    <span className="font-medium">Event:</span> 5K Race
                  </div>
                  <div className="mb-2">
                    <span className="font-medium">Date:</span> {formatDate(event.startDate)}
                    {formatDate(event.startDate) !== formatDate(event.endDate) && 
                      ` - ${formatDate(event.endDate)}`}
                  </div>
                  
                  <div className="mb-2">
                    <span className="font-medium">Entry Fee:</span> {event.entryFee.toLocaleString()} sats
                  </div>
                  
                  {event.prizePool > 0 && (
                    <div className="mb-2">
                      <span className="font-medium">Prize Pool:</span> {event.prizePool.toLocaleString()} sats
                    </div>
                  )}
                  
                  <div className="mb-2">
                    <span className="font-medium">Prizes:</span> 1st: {Math.round(event.prizePool * event.prizeDistribution[0]).toLocaleString()} sats, 
                    2nd: {Math.round(event.prizePool * event.prizeDistribution[1]).toLocaleString()} sats, 
                    3rd: {Math.round(event.prizePool * event.prizeDistribution[2]).toLocaleString()} sats
                  </div>
                  
                  <div className="mb-2">
                    <span className="font-medium">Participants:</span> {event.participants.length}
                  </div>
                </div>
              </div>
              
              <div>
                <h2 className="text-lg font-semibold mb-2">How It Works</h2>
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="mb-2">{event.description}</p>
                  <p>Complete a 5K run (3.1 miles) on the specified date to compete for prizes. Your time will be automatically recorded and displayed on the leaderboard.</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'leaderboard' && (
          <div className="event-leaderboard mb-6">
            <h2 className="text-lg font-semibold mb-2">Event Leaderboard</h2>
            <p className="text-sm text-gray-500 mb-4">
              The fastest runners will be displayed here. Complete a 5K run during the event to appear on the leaderboard.
            </p>
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <EventLeaderboard eventId={eventId} userProfiles={profiles} />
            </div>
          </div>
        )}
        
        {activeTab === 'rules' && (
          <div className="event-rules mb-6">
            <h2 className="text-lg font-semibold mb-2">Event Rules</h2>
            <div className="bg-gray-50 p-4 rounded-md">
              <ol className="list-decimal pl-4 space-y-2">
                <li>To participate, you must register for the event before it ends.</li>
                <li>The race distance is exactly 5 kilometers (3.1 miles).</li>
                <li>Your run must be completed within the event time window (May 4th, 2024).</li>
                <li>The run must be tracked using the RUNSTR app.</li>
                <li>Winners will be determined by the fastest completion time.</li>
                <li>All decisions by the event organizers are final.</li>
                <li>Prize distribution: 1st place (60%), 2nd place (30%), 3rd place (10%).</li>
              </ol>
              <div className="mt-4 text-sm text-gray-500">
                Additional details: {event.rules}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Payment Required</h3>
            <p className="mb-4">
              Registration fee: {event.entryFee.toLocaleString()} sats
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 border rounded-md mr-2"
              >
                Cancel
              </button>
              <button
                onClick={handlePaymentSuccess}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md"
              >
                Simulate Payment
              </button>
            </div>
            <div className="mt-4 text-sm text-gray-500">
              Note: This is a test implementation with simulated payments.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

EventDetail.propTypes = {
  profiles: PropTypes.instanceOf(Map),
  userPublicKey: PropTypes.string
};

EventDetail.defaultProps = {
  profiles: new Map(),
  userPublicKey: null
};

export default EventDetail; 