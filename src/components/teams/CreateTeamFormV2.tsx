import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNostr } from '../../hooks/useNostr';
import { useAuth } from '../../hooks/useAuth';
import { payLnurl, getInvoiceFromLnAddress } from '../../utils/lnurlPay';
import { RefreshCw } from "lucide-react";
import {
  TeamData,
  prepareNip101eTeamEventTemplate,
  getTeamUUID,
  getTeamCaptain,
  prepareTeamSubscriptionReceiptEvent
} from '../../services/nostr/NostrTeamsService';
import { createAndPublishEvent } from '../../utils/nostr';

// This is a new, simplified form component built from scratch
// It uses the same robust createAndPublishEvent helper as other working parts of the app.

const CreateTeamFormV2: React.FC = () => {
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [teamImage, setTeamImage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { publicKey, connectSigner } = useNostr() as any;
  const { wallet } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    let finalPubkey = publicKey;
    if (!finalPubkey) {
      const signerResult = await connectSigner();
      finalPubkey = signerResult?.pubkey || null;
      if (!finalPubkey) {
        setError('A signer is required to create a team.');
        setIsLoading(false);
        return;
      }
    }

    if (!teamName.trim()) {
      setError('Team name is required.');
      setIsLoading(false);
      return;
    }

    // Ensure wallet connected and process captain subscription payment (10k sats)
    if (!wallet) {
      setError('Please connect a wallet in Settings first.');
      setIsLoading(false);
      return;
    }

    try {
      if (wallet.kind === 'nwc') {
        const invoice = await getInvoiceFromLnAddress('runstr@geyser.fund', 10000);
        await wallet.payInvoice(invoice);
      } else {
        await payLnurl({
          lightning: 'runstr@geyser.fund',
          amount: 10000,
          wallet,
          comment: 'Runstr captain subscription',
        });
      }
    } catch (e: any) {
      setError(e?.message || 'Payment failed');
      setIsLoading(false);
      return;
    }

    const teamData: TeamData = {
      name: teamName,
      description: teamDescription,
      isPublic,
      image: teamImage.trim() || undefined,
    };

    const teamEventTemplate = prepareNip101eTeamEventTemplate(teamData, finalPubkey);

    if (!teamEventTemplate) {
      setError('Failed to prepare the team event.');
      setIsLoading(false);
      return;
    }

    try {
      const result: any = await createAndPublishEvent(teamEventTemplate, null);
      
      if (result && result.success) {
        const newTeamUUID = getTeamUUID(result);
        const captainPk = getTeamCaptain(result);
        if (newTeamUUID && captainPk) {
          // Publish subscription receipt event
          const aIdentifier = `33404:${captainPk}:${newTeamUUID}`;
          const receiptTemplate = prepareTeamSubscriptionReceiptEvent(aIdentifier, captainPk, 10000);
          if (receiptTemplate) {
            await createAndPublishEvent(receiptTemplate, null);
          }
          navigate(`/teams/${captainPk}/${newTeamUUID}`);
        } else {
          console.error('V2 Form: Failed to get UUID/captain from published event.');
          navigate('/teams');
        }
      } else {
        setError(result?.error || 'Failed to publish the team event. Please try again.');
      }
    } catch (err: any) {
      console.error('CreateTeamFormV2 publish error:', err);
      setError(err.message || 'An unknown error occurred during publishing.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto bg-gray-800 text-white rounded-lg shadow-lg mt-5">
      <h2 className="text-2xl font-bold mb-6 text-center">Create New Team</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="teamName" className="block text-sm font-medium text-gray-300 mb-1">
            Team Name
          </label>
          <input
            type="text"
            id="teamName"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="teamDescription" className="block text-sm font-medium text-gray-300 mb-1">
            Team Description
          </label>
          <textarea
            id="teamDescription"
            value={teamDescription}
            onChange={(e) => setTeamDescription(e.target.value)}
            rows={3}
            className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500"
          ></textarea>
        </div>

        <div className="mb-4">
          <label htmlFor="teamImage" className="block text-sm font-medium text-gray-300 mb-1">
            Team Image URL (Optional)
          </label>
          <input
            type="url"
            id="teamImage"
            value={teamImage}
            onChange={(e) => setTeamImage(e.target.value)}
            className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-blue-500 focus:border-blue-500"
            placeholder="https://example.com/image.png"
          />
        </div>

        <div className="mb-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-500 rounded bg-gray-700 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-300">Publicly visible team</span>
          </label>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-700/50 text-red-200 border border-red-600 rounded-md">
            <p>{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Creating Team...
            </div>
          ) : (
            'Create Team'
          )}
        </button>
      </form>
    </div>
  );
};

export default CreateTeamFormV2; 