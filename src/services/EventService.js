// src/services/EventService.js
const EVENT_STORAGE_KEY = 'events';
const EVENT_REGISTRATION_KEY = 'eventRegistrations';

// Hard-coded first event for testing - Updated to be an active 5K event for May 4th
const initialTestEvent = {
  id: "event_001",
  title: "RUNSTR 5K Race",
  description: "Join our official 5K race event with leaderboard and prizes!",
  rules: "Complete a 5k run on Sunday, May 4th to compete for prizes. Winners will be displayed on the leaderboard.",
  startDate: "2024-05-04T00:00:00Z", 
  endDate: "2024-05-04T23:59:59Z",
  entryFee: 5000, // in sats
  prizePool: 0, // starts at 0, increases with registrations
  prizeDistribution: [0.6, 0.3, 0.1], // 60% to 1st, 30% to 2nd, 10% to 3rd
  hostClub: {
    id: "runstr_club",
    name: "RUNSTR",
    avatar: "/icons/runstr-logo.png" // Assuming this path exists
  },
  participants: [], // array of participant pubkeys
  runs: [], // array of qualifying run data
  status: "active" // Set to active to ensure it shows
};

export const initializeEvents = () => {
  const existingEvents = JSON.parse(localStorage.getItem(EVENT_STORAGE_KEY) || '[]');
  
  // Only add the test event if it doesn't already exist
  if (!existingEvents.some(e => e.id === initialTestEvent.id)) {
    existingEvents.push(initialTestEvent);
    localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(existingEvents));
  } else {
    // Update existing event to ensure it's active
    const eventIndex = existingEvents.findIndex(e => e.id === initialTestEvent.id);
    if (eventIndex !== -1) {
      existingEvents[eventIndex] = {
        ...existingEvents[eventIndex],
        title: initialTestEvent.title,
        description: initialTestEvent.description,
        rules: initialTestEvent.rules,
        status: "active" // Force it to be active
      };
      localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(existingEvents));
    }
  }
  
  // Update event status based on current date
  updateEventStatuses();
};

const updateEventStatuses = () => {
  const events = JSON.parse(localStorage.getItem(EVENT_STORAGE_KEY) || '[]');
  const now = new Date();
  
  let updated = false;
  
  events.forEach(event => {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    
    // Update status based on date
    let newStatus = event.status;
    
    if (now > endDate) {
      newStatus = 'completed';
    } else if (now >= startDate && now <= endDate) {
      newStatus = 'active';
    } else {
      newStatus = 'upcoming';
    }
    
    if (event.status !== newStatus) {
      event.status = newStatus;
      updated = true;
    }
  });
  
  if (updated) {
    localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(events));
  }
};

export const getAllEvents = () => {
  updateEventStatuses();
  return JSON.parse(localStorage.getItem(EVENT_STORAGE_KEY) || '[]');
};

export const getEventById = (eventId) => {
  updateEventStatuses();
  const events = JSON.parse(localStorage.getItem(EVENT_STORAGE_KEY) || '[]');
  return events.find(event => event.id === eventId) || null;
};

export const getActiveEvents = () => {
  updateEventStatuses();
  const events = JSON.parse(localStorage.getItem(EVENT_STORAGE_KEY) || '[]');
  return events.filter(event => event.status === 'active' || event.status === 'upcoming');
};

export const registerForEvent = (eventId, pubkey) => {
  if (!pubkey) return false;
  
  const events = JSON.parse(localStorage.getItem(EVENT_STORAGE_KEY) || '[]');
  const eventIndex = events.findIndex(e => e.id === eventId);
  
  if (eventIndex === -1) return false;
  
  // Check if already registered
  if (events[eventIndex].participants.includes(pubkey)) return true;
  
  // Add to participants
  events[eventIndex].participants.push(pubkey);
  
  // Update prize pool
  events[eventIndex].prizePool += events[eventIndex].entryFee;
  
  localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(events));
  
  // Add to user registrations
  const registrations = JSON.parse(localStorage.getItem(EVENT_REGISTRATION_KEY) || '[]');
  if (!registrations.includes(eventId)) {
    registrations.push(eventId);
    localStorage.setItem(EVENT_REGISTRATION_KEY, JSON.stringify(registrations));
  }
  
  return true;
};

export const getUserRegistrations = () => {
  return JSON.parse(localStorage.getItem(EVENT_REGISTRATION_KEY) || '[]');
};

export const isUserRegisteredForEvent = (eventId) => {
  const registrations = JSON.parse(localStorage.getItem(EVENT_REGISTRATION_KEY) || '[]');
  return registrations.includes(eventId);
};

export const submitRunToEvent = (eventId, run) => {
  const events = JSON.parse(localStorage.getItem(EVENT_STORAGE_KEY) || '[]');
  const eventIndex = events.findIndex(e => e.id === eventId);
  
  if (eventIndex === -1) return false;
  
  // Add run data
  const runWithMetadata = {
    ...run,
    pubkey: run.pubkey || 'unknown', // Use pubkey if available
    submittedAt: new Date().toISOString()
  };
  
  events[eventIndex].runs.push(runWithMetadata);
  localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(events));
  
  return true;
};

export const validateEventRun = (completedRun, pubkey) => {
  const activeEvents = JSON.parse(localStorage.getItem(EVENT_STORAGE_KEY) || '[]')
    .filter(e => e.status === 'active');
  const registrations = JSON.parse(localStorage.getItem(EVENT_REGISTRATION_KEY) || '[]');
  
  // Check if run qualifies for any registered events
  const qualifyingEvents = activeEvents.filter(event => {
    const isRegistered = registrations.includes(event.id);
    const runDate = new Date(completedRun.date);
    const eventStart = new Date(event.startDate);
    const eventEnd = new Date(event.endDate);
    const isWithinDates = runDate >= eventStart && runDate <= eventEnd;
    
    // For 5K events, check if distance is approximately 5K (4500m - 5500m)
    const isValidDistance = completedRun.distance >= 4500 && completedRun.distance <= 5500;
      
    return isRegistered && isWithinDates && isValidDistance;
  });
  
  // Submit qualifying runs to events
  qualifyingEvents.forEach(event => {
    const runWithPubkey = {
      ...completedRun,
      pubkey
    };
    submitRunToEvent(event.id, runWithPubkey);
  });
  
  return qualifyingEvents;
};

export const getEventLeaderboard = (eventId) => {
  const event = getEventById(eventId);
  if (!event) return [];
  
  // Sort runs by duration (fastest first)
  return [...event.runs].sort((a, b) => a.duration - b.duration);
}; 