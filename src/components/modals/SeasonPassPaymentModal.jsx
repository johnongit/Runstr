import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { QRCodeSVG } from 'qrcode.react';
import seasonPassPaymentService from '../../services/seasonPassPaymentService';
import { useNostr } from '../../hooks/useNostr';

interface Props {
  open: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

const SeasonPassPaymentModal: React.FC<Props> = ({ open, onClose, onPaymentSuccess }) => {
  const { publicKey } = useNostr();
  const [invoice, setInvoice] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'generating' | 'payment' | 'verifying' | 'success'>('generating');

  const seasonDetails = seasonPassPaymentService.getSeasonDetails();
  const participantCount = seasonPassPaymentService.getParticipantCount();

  // Generate invoice when modal opens
  useEffect(() => {
    if (open && publicKey) {
      generateInvoice();
    } else if (!open) {
      // Reset state when modal closes
      setStep('generating');
      setInvoice('');
      setError(null);
    }
  }, [open, publicKey]);

  const generateInvoice = async () => {
    if (!publicKey) {
      setError('No public key available. Please connect your Nostr account.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setStep('generating');

    try {
      const result = await seasonPassPaymentService.generateSeasonPassInvoice(publicKey);
      
      if (result.success && result.invoice) {
        setInvoice(result.invoice);
        setStep('payment');
      } else {
        setError(result.error || 'Failed to generate payment invoice');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate payment invoice');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyInvoice = async () => {
    try {
      await navigator.clipboard.writeText(invoice);
      if (window.Android && window.Android.showToast) {
        window.Android.showToast('Invoice copied to clipboard');
      } else {
        alert('Invoice copied to clipboard');
      }
    } catch {
      alert('Failed to copy invoice');
    }
  };

  const handlePaymentConfirmation = async () => {
    if (!publicKey) {
      setError('No public key available');
      return;
    }

    setIsVerifying(true);
    setError(null);
    setStep('verifying');

    try {
      const result = await seasonPassPaymentService.verifyPaymentAndAddParticipant(publicKey);
      
      if (result.success) {
        setStep('success');
        
        // Show success message
        if (window.Android && window.Android.showToast) {
          window.Android.showToast('Welcome to RUNSTR Season 1! 🎉');
        }
        
        // Call success callback after a brief delay to show success message
        setTimeout(() => {
          onPaymentSuccess();
          onClose();
        }, 2000);
      } else {
        setError(result.error || 'Failed to verify payment');
        setStep('payment');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify payment');
      setStep('payment');
    } finally {
      setIsVerifying(false);
    }
  };

  const deepLinks = [
    { name: 'Zeus', url: `zeusln://lightning?invoice=${invoice}` },
    { name: 'Phoenix', url: `phoenix://invoice?url=${invoice}` },
    { name: 'CoinOS', url: `https://coinos.io/lightning/invoice/${invoice}` },
  ];

  const getModalContent = () => {
    switch (step) {
      case 'generating':
        return (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 border-4 border-text-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-text-secondary">Generating your Season Pass invoice...</p>
          </div>
        );

      case 'payment':
        return (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Season Pass - {seasonDetails.passPrice.toLocaleString()} sats
              </h3>
              <p className="text-sm text-text-secondary mb-1">
                Join {participantCount} other runners in {seasonDetails.title}
              </p>
              <p className="text-xs text-text-muted">
                Feb 1 - May 1, 2025 • Unlimited Distance Competition
              </p>
            </div>

            <div className="flex justify-center">
              <QRCodeSVG value={invoice} size={220} bgColor="#1f2937" fgColor="#fff" />
            </div>

            <div className="space-y-2">
              <p 
                className="break-all text-xs bg-bg-tertiary p-2 rounded-md select-all cursor-pointer border border-border-secondary" 
                onClick={handleCopyInvoice}
              >
                {invoice}
              </p>
              <button 
                onClick={handleCopyInvoice} 
                className="w-full bg-bg-tertiary hover:bg-bg-primary text-text-primary text-sm py-2 rounded-md border border-border-secondary"
              >
                📋 Copy Invoice
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {deepLinks.map(dl => (
                <a 
                  key={dl.name} 
                  href={dl.url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-center text-xs bg-primary text-text-primary hover:bg-primary/80 py-2 rounded-md"
                >
                  {dl.name}
                </a>
              ))}
            </div>

            <button 
              onClick={handlePaymentConfirmation}
              disabled={isVerifying}
              className="w-full bg-text-primary text-bg-primary hover:bg-text-secondary py-3 rounded-md font-semibold disabled:opacity-50"
            >
              {isVerifying ? 'Verifying Payment...' : '✅ I have paid'}
            </button>
          </div>
        );

      case 'verifying':
        return (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 border-4 border-text-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-text-secondary">Verifying your payment...</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-3xl">🎉</span>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">Welcome to Season 1!</h3>
              <p className="text-text-secondary">You're now part of the competition!</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="fixed z-50 inset-0 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <Dialog.Overlay className="fixed inset-0 bg-black/60" />

        <div className="relative bg-bg-secondary text-text-primary p-6 rounded-lg shadow-xl w-full max-w-sm mx-auto space-y-4 z-10 border border-border-secondary">
          <div className="flex justify-between items-center">
            <Dialog.Title className="text-lg font-semibold">
              {step === 'success' ? 'Payment Complete!' : 'RUNSTR Season Pass'}
            </Dialog.Title>
            <button 
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary"
              disabled={step === 'verifying' || step === 'generating'}
            >
              ✕
            </button>
          </div>

          {getModalContent()}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-md">
              {error}
              {step !== 'generating' && (
                <button 
                  onClick={generateInvoice}
                  className="ml-2 underline hover:no-underline"
                >
                  Try again
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
};

export default SeasonPassPaymentModal; 