import { Button } from "primereact/button";
import { useState } from "react";

interface QRCodeProps {
  onNext: () => void;
  onBack: () => void;
}

interface DeviceInfo {
  name: string;
  serialNumber: string;
}

const QRCode = ({ onNext }: QRCodeProps) => {
  const [scanned, setScanned] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);

  const handleScan = () => {
    // Simulate scan success - replace with actual scan logic
    setScanned(true);
    setDeviceInfo({
      name: "JoME Device",
      serialNumber: "JM-2024-0001"
    });
  };

  return (
    <div className="qr-step text-center">
      <div className="flex flex-column align-items-center gap-4">
        <h1 className="text-2xl font-bold">Scan QR Code</h1>
        <p className="text-gray-600">
          Scan the QR code on your device to connect
        </p>
        
        {/* QR Scanner Frame */}
        <div className="qr-scanner-container">
          <div className="qr-scanner-frame">
            <div className="corner-tl"></div>
            <div className="corner-tr"></div>
            <div className="corner-bl"></div>
            <div className="corner-br"></div>
            {!scanned && (
              <Button 
                label="Scan Now" 
                className="scan-button"
                onClick={handleScan}
              />
            )}
          </div>
        </div>

        {/* Device Info Section */}
        {scanned && deviceInfo && (
          <div className="device-info">
            <div className="info-row">
              <span className="info-label">Device:</span>
              <span className="info-value">{deviceInfo.name}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Serial:</span>
              <span className="info-value">{deviceInfo.serialNumber}</span>
            </div>
          </div>
        )}

        <Button 
          label="Next" 
          icon="pi pi-arrow-right" 
          iconPos="right"
          onClick={onNext}
          className="w-full"
          disabled={!scanned}
        />
      </div>
    </div>
  );
};

export default QRCode; 