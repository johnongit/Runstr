// src/services/EventService.js
const EVENT_STORAGE_KEY = 'events';
const EVENT_REGISTRATION_KEY = 'eventRegistrations';

// Hard-coded May 10 - June 10 5K event
const runstrEvent = {
  id: "event_001",
  title: "RUNSTR 5K Race",
  description: "Join our official 5K race event with leaderboard and prizes!",
  rules: "Complete a 5k run between May 10th and June 10th to compete for prizes. Winners will be displayed on the leaderboard.",
  startDate: "2024-05-10T00:00:00Z", // Start date: May 10th
  endDate: "2024-06-10T23:59:59Z", // End date: June 10th
  entryFee: 5000, // in sats
  prizePool: 0, // increases with registrations
  prizeDistribution: [0.6, 0.3, 0.1], // 60% to 1st, 30% to 2nd, 10% to 3rd
  hostClub: {
    id: "runstr_club",
    name: "RUNSTR"
    // No avatar field
  },
  participants: [], // array of participant pubkeys
  runs: [], // array of qualifying run data
  status: "upcoming" // Always set to upcoming by default
};

// Next upcoming event (10K) removed

export const initializeEvents = () => {
  const existingEvents = JSON.parse(localStorage.getItem(EVENT_STORAGE_KEY) || '[]');
  let updated = false;
  
  // Check if our event exists
  const eventIndex = existingEvents.findIndex(e => e.id === runstrEvent.id);
  if (eventIndex !== -1) {
    // Keep existing participants and runs, but update everything else
    const existingParticipants = existingEvents[eventIndex].participants || [];
    const existingRuns = existingEvents[eventIndex].runs || [];
    const existingPrizePool = existingEvents[eventIndex].prizePool || 0;
    
    // Create updated event with existing participants/runs data
    existingEvents[eventIndex] = {
      ...runstrEvent,
      participants: existingParticipants,
      runs: existingRuns,
      prizePool: existingPrizePool
    };
    
    updated = true;
  } else {
    // Add our event if it doesn't exist
    existingEvents.push(runstrEvent);
    updated = true;
  }
  
  // Remove any other events - we only want the 5K event
  if (existingEvents.length > 1) {
    const filteredEvents = existingEvents.filter(e => e.id === runstrEvent.id);
    if (filteredEvents.length !== existingEvents.length) {
      updated = true;
    }
    localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(filteredEvents));
  } else if (updated) {
    localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(existingEvents));
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
    
    // Special case: our 5K event should be upcoming until the day of the event
    if (event.id === "event_001" && event.title === "RUNSTR 5K Race") {
      // If the event is scheduled on May 4th, maintain it as upcoming
      const may4thEvent = startDate.getDate() === 4 && startDate.getMonth() === 4; // May is month 4 (0-indexed)
      
      if (may4thEvent) {
        if (event.status !== "upcoming") {
          event.status = "upcoming";
          updated = true;
          console.log('Fixed 5K event status to upcoming');
        }
        return; // Skip normal status update for this event
      }
    }
    
    // Normal status update based on date (for other events)
    let newStatus = event.status;
    
    if (now > endDate) {
      newStatus = 'completed';
    } else if (now >= startDate && now <= endDate) {
      newStatus = 'active';
    } else {
      newStatus = 'upcoming';
    }
    
    if (event.status !== newStatus) {
      console.log(`Updating event ${event.id} status from ${event.status} to ${newStatus}`);
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
  
  // Get all events regardless of status - fixes infinite recursion
  if (events.length === 0) {
    // Only initialize if there are no events at all
    console.log('No events found, initializing');
    initializeEvents();
    return JSON.parse(localStorage.getItem(EVENT_STORAGE_KEY) || '[]');
  }
  
  // Filter for active or upcoming events
  const activeOrUpcoming = events.filter(event => 
    event.status === 'active' || event.status === 'upcoming'
  );
  
  console.log('All events:', events);
  console.log('Active/upcoming events:', activeOrUpcoming);
  
  // If no active/upcoming events but we have events, force the first one to be upcoming
  if (activeOrUpcoming.length === 0 && events.length > 0) {
    console.log('No active events found, forcing first event to be upcoming');
    events[0].status = 'upcoming';
    localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(events));
    return [events[0]];
  }
  
  return activeOrUpcoming;
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

export function getEventLeaderboard(eventId) {
  const event = getEventById(eventId);
  
  if (!event) {
    return [];
  }
  
  // Get real participants who have registered
  const participants = event.participants || [];
  
  // If no participants, return empty array
  if (participants.length === 0) {
    return [];
  }
  
  // Return actual participant data if available, otherwise return empty array
  // In a real app, this would pull from actual tracked runs during the event
  return event.runs.length > 0 ? event.runs.sort((a, b) => a.time - b.time) : [];
} 