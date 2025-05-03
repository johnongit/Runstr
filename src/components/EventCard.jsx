import { useNavigate } from 'react-router-dom';
import { isUserRegisteredForEvent } from '../services/EventService';

const EventCard = ({ event }) => {
  const navigate = useNavigate();
  const isRegistered = isUserRegisteredForEvent(event.id);
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  const handleClick = () => {
    navigate(`/event/${event.id}`);
  };
  
  return (
    <div 
      className="border rounded-lg p-4 mb-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleClick}
    >
      <div className="flex items-center mb-2">
        {event.hostClub?.avatar && (
          <img 
            src={event.hostClub.avatar} 
            alt={event.hostClub.name || 'Event host'} 
            className="h-8 w-8 rounded-full mr-2"
          />
        )}
        <h3 className="text-lg font-semibold">{event.title}</h3>
        {isRegistered && (
          <span className="ml-auto bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
            Registered
          </span>
        )}
      </div>
      
      <div className="text-sm text-gray-600 mb-2">
        <div>
          <span className="font-medium">When:</span> {formatDate(event.startDate)}
          {formatDate(event.startDate) !== formatDate(event.endDate) && 
            ` - ${formatDate(event.endDate)}`}
        </div>
        <div>
          <span className="font-medium">Status:</span> {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
        </div>
        <div>
          <span className="font-medium">Entry Fee:</span> {event.entryFee.toLocaleString()} sats
        </div>
        {event.prizePool > 0 && (
          <div>
            <span className="font-medium">Prize Pool:</span> {event.prizePool.toLocaleString()} sats
          </div>
        )}
      </div>
      
      <div className="text-sm">{event.description.substring(0, 100)}...</div>
    </div>
  );
};

export default EventCard; 