import React from 'react';
import { Dialog } from '@headlessui/react';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  open: boolean;
  invoice: string;
  amount: number;
  onClose: () => void;
  onPaid: () => void;
  paymentError?: string | null;
}

const PaymentModal: React.FC<Props> = ({ open, invoice, amount, onClose, onPaid, paymentError }) => {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(invoice);
      alert('Invoice copied to clipboard');
    } catch {
      alert('Failed to copy');
    }
  };

  const deepLinks = [
    { name: 'Zeus', url: `zeusln://lightning?invoice=${invoice}` },
    { name: 'CoinOS', url: `https://coinos.io/lightning/invoice/${invoice}` },
    { name: 'Cash App', url: `cash://ln?invoice=${invoice}` },
  ];

  return (
    <Dialog open={open} onClose={onClose} className="fixed z-50 inset-0 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <Dialog.Overlay className="fixed inset-0 bg-black/60" />

        <div className="relative bg-gray-800 text-white p-6 rounded-lg shadow-xl w-full max-w-sm mx-auto space-y-4 z-10">
          <Dialog.Title className="text-lg font-semibold text-center">Pay {amount.toLocaleString()} sats</Dialog.Title>

          <div className="flex justify-center">
            <QRCodeSVG value={invoice} size={220} bgColor="#1f2937" fgColor="#fff" />
          </div>

          <p className="break-all text-xs bg-gray-900 p-2 rounded-md select-all cursor-pointer" onClick={handleCopy}>{invoice}</p>
          <button onClick={handleCopy} className="w-full bg-gray-700 hover:bg-gray-600 text-sm py-1 rounded-md">Copy Invoice</button>

          <div className="grid grid-cols-3 gap-2 mt-2">
            {deepLinks.map(dl => (
              <a key={dl.name} href={dl.url} target="_blank" rel="noreferrer" className="text-center text-xs bg-blue-600 hover:bg-blue-500 py-1 rounded-md">
                {dl.name}
              </a>
            ))}
          </div>

          {paymentError && <p className="text-red-400 text-xs text-center mt-2">{paymentError}</p>}

          <button onClick={onPaid} className="w-full bg-green-600 hover:bg-green-500 mt-4 py-2 rounded-md">I have paid</button>
        </div>
      </div>
    </Dialog>
  );
};

export default PaymentModal; 