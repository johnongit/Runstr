# RUNSTR v0.5.0 - Design Overhaul 🖤🤍

Hey Nostr, v0.5.0 brings a complete redesign and exciting new features!

🎨 **App Re-Design**:
• Black and White Minimalism - We've embraced a sleek, minimalist aesthetic with a monochrome color scheme for a more focused running experience

👤 **Profile Tab**:
• Stats Evolution - Formerly the "Stats" tab, now a comprehensive profile experience
• Dual Stat Tracking - Choose between viewing your Nostr workout stats or local storage stats
• Experience System - Gain XP for each workout record over 1 mile long, level up your running journey

🏆 **League Tab**:
• Feed Transformation - Previously "Feed," now showcasing competitive elements
• Interactive Leaderboard Map - See where you stand against other runners geographically
• RUNSTR League Rankings - Track your position on the RUNSTR league leaderboard
• Enhanced Workout Feed - Browse through community workout records for inspiration

🤝 **Teams**:
• Restructured Approach - Completely revamped team system for better community building
• NIP101e Integration - Exercise teams now based on NIP101e protocol for better Nostr integration
• Team Identity - Your team affiliation proudly displayed on all your workout records

🎵 **Blossom Integration**:
• Music Streaming - Listen to your favorite tracks from Blossom servers while tracking your runs
• Seamless Experience - Music controls integrated directly into your workout interface

🔧 **Small Bug Fixes and Improvements**:
• Various performance enhancements and minor bug fixes throughout the app

Feel free to DM for feature requests or bug reports.

Let's Go! 🏃‍♂️💪

## RUNSTR v0.4.7 - Bug Squashing

Hey Nostr, v0.4.7 update is all about bug fixes and small improvements

🌟 **Step Tracking Sharpened:**
*   **Pedometer Precision:** We've fine-tuned how we count your steps when using your device's pedometer for better accuracy.
*   **Smarter Step Estimations:** For times when the pedometer isn't in play, we've updated our estimation logic. By simplifying how we calculate stride length (goodbye, custom height/stride inputs!), and adjusting the average stride to a more consistent 0.73 meters, your estimated steps should feel more on point.

🔒 **Nostr & Privacy Enhancements:**
*   **You Control Your Metrics (NIP-101h):** Now you get to decide exactly what fitness details (like intensity, cadence, or heart rate) you share on Nostr. Look for the new, responsive toggle controls in the "Save to Nostr" screen to customize your NIP-101h posts.
*   **Private Relays Stay Private:** When you've chosen to use private relays for your NIP-101h and NIP-101e health and fitness events, we've removed the fallback to public relays. Your private data stays where you want it.

💰 **Rewards System Refinements:**
*   **More Reliable Payouts:** We've boosted the reliability of reward Zaps by improving how we find user profiles and Lightning Addresses on Nostr 
*   **Clearer Rewards Language:** No more guessing! The `AchievementCard` now clearly shows "Today's Reward (Day X)" and exactly what you'll earn for your next run in a streak, like "Run tomorrow (Day Y) to earn [amount] sats."

📱 **UI & OS Specific Tune-Ups:**
*   **CalyxOS Display Polish:** We've addressed layout quirks on CalyxOS, especially for slimmer screens. Expect more flexible navigation in the `MenuBar` and better font sizing. Plus, the `FloatingMusicPlayer` should now behave without any visual hiccups.
*   **GrapheneOS Location Smarts:** Location tracking on GrapheneOS just got more robust. We've enhanced permission handling and updated our app's manifest to better align with GrapheneOS's requirements, making it easier for the app to get and keep location permissions.

📋 **Workout Record Accuracy & Details:**
*   **Correct Date & Time on Records:** Your workout records will now show the correct date (sourced reliably from `event.created_at`) without any confusing duplicates.

⏱️ **Countdown Controls:**
*   **"Skip Start Countdown" Check Box:** Gives you the option to jump straight into a run or walk without using a countdown timer.

Feel free to send a DM for feature requests or bug reports. 

Lets Go!