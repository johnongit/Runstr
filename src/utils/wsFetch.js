import { v4 as uuidv4 } from 'uuid';

/**
 * Fetches Nostr events directly via WebSocket.
 * @param {object} filter - The Nostr filter object.
 * @param {string[]} relayUrls - An array of relay WebSocket URLs.
 * @param {number} [timeoutMs=5000] - Timeout in milliseconds for each relay connection and EOSE.
 * @param {number} [eventLimit=0] - Max number of events to fetch before closing (0 for no limit until EOSE/timeout).
 * @returns {Promise<Array<object>>} A promise that resolves with an array of unique event objects.
 */
export const fetchEventsViaWebSocket = (filter, relayUrls, timeoutMs = 5000, eventLimit = 0) => {
    return new Promise((resolve) => {
        const allEvents = new Map();
        let relaysCompleted = 0;
        const numRelays = relayUrls.length;

        if (numRelays === 0) {
            console.warn('[wsFetch] No relay URLs provided.');
            resolve([]);
            return;
        }

        const subId = `wsfetch-${uuidv4().slice(0, 8)}`;

        relayUrls.forEach(url => {
            let ws;
            let KeventCount = 0;
            let timer;

            const cleanup = () => {
                clearTimeout(timer);
                if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
                    try {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify(['CLOSE', subId]));
                        }
                        ws.close();
                        // console.debug(`[wsFetch] WebSocket closed for ${url} (subId: ${subId})`);
                    } catch (err) {
                        // err is intentionally unused in this specific catch block as we just ensure cleanup.
                        // console.error(`[wsFetch] Error closing WebSocket for ${url}:`, err);
                    }
                }
                relaysCompleted++;
                if (relaysCompleted === numRelays) {
                    resolve(Array.from(allEvents.values()));
                }
            };

            timer = setTimeout(() => {
                // console.warn(`[wsFetch] Timeout for ${url} (subId: ${subId}) after ${timeoutMs}ms.`);
                cleanup();
            }, timeoutMs);

            try {
                // console.debug(`[wsFetch] Attempting to connect to ${url} (subId: ${subId})`);
                ws = new WebSocket(url);
            } catch (error) {
                console.error(`[wsFetch] Error creating WebSocket for ${url}:`, error);
                cleanup();
                return;
            }
            
            ws.onopen = () => {
                // console.debug(`[wsFetch] Connected to ${url}, sending REQ for subId: ${subId}`);
                try {
                    ws.send(JSON.stringify(['REQ', subId, filter]));
                } catch (error) {
                    console.error(`[wsFetch] Error sending REQ to ${url}:`, error);
                    cleanup();
                }
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    const [type, receivedSubId, ...data] = message;

                    if (receivedSubId !== subId) return; // Message for a different subscription

                    if (type === 'EVENT') {
                        const eventObject = data[0];
                        if (eventObject && eventObject.id && !allEvents.has(eventObject.id)) {
                            allEvents.set(eventObject.id, eventObject);
                            KeventCount++;
                            // console.debug(`[wsFetch] Received EVENT from ${url} (subId: ${subId}):`, eventObject.id, 'Total for relay:', KeventCount);
                        }
                         if (eventLimit > 0 && KeventCount >= eventLimit) {
                            // console.debug(`[wsFetch] Event limit (${eventLimit}) reached for ${url} (subId: ${subId}).`);
                            cleanup();
                        }
                    } else if (type === 'EOSE') {
                        // console.debug(`[wsFetch] Received EOSE from ${url} (subId: ${subId})`);
                        cleanup();
                    } else if (type === 'NOTICE') {
                        console.warn(`[wsFetch] Received NOTICE from ${url} (subId: ${subId}):`, data[0]);
                    }
                } catch (error) {
                    console.error(`[wsFetch] Error processing message from ${url} (subId: ${subId}):`, event.data, error);
                }
            };

            ws.onerror = (error) => {
                console.error(`[wsFetch] WebSocket error for ${url} (subId: ${subId}):`, error.message || 'Unknown WebSocket error');
                cleanup();
            };

            ws.onclose = () => { // Linter fix: removed unused 'event' parameter
                // The 'event' object for onclose is not used in this handler.
                // console.debug(`[wsFetch] WebSocket connection closed for ${url} (subId: ${subId}).`);
                cleanup(); // Ensure cleanup happens on close, even if unexpected
            };
        });
    });
}; 