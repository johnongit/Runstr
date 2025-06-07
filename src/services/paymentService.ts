// @ts-nocheck
import { requestProvider } from 'webln';
import { zap } from '../lib/lightning.js';

const RUNSTR_LIGHTNING_ADDRESS = 'thewildhustle@coinos.io';
const RUNSTR_PUBKEY = 'b84f32a24d2b174a4b5952458b191244365b635f5835617266138988514589a5';

/**
 * Handles the payment flow for a user joining a team.
 * @param {number} amount - The amount in satoshis to pay.
 * @param {string} teamName - The name of the team being joined for the comment.
 * @returns {Promise<boolean>} - True if payment was successful, false otherwise.
 */
export const handleTeamJoinPayment = async (amount: number, teamName: string): Promise<boolean> => {
  try {
    const webln = await requestProvider();
    if (!webln) {
      alert('WebLN provider (like Alby) not found. Please install a browser extension.');
      return false;
    }

    const comment = `Joining team: ${teamName}`;
    // The zap function expects amount in millisats
    await zap(RUNSTR_LIGHTNING_ADDRESS, amount * 1000, comment, RUNSTR_PUBKEY);
    
    // Here we assume the zap was successful if it doesn't throw an error.
    // A more robust implementation would wait for and verify the zap receipt (kind 9735).
    return true;
  } catch (error: any) {
    console.error('Team join payment failed:', error);
    alert(`Payment failed: ${error.message}`);
    return false;
  }
}; 