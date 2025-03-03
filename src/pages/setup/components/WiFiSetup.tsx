import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { useState } from "react";
import { Password } from "primereact/password";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWifi } from "@fortawesome/free-solid-svg-icons";
import { ProgressSpinner } from "primereact/progressspinner";

interface WiFiSetupProps {
  onNext: () => void;
  onBack: () => void;
}

interface WiFiNetwork {
  name: string;
  strength: "high" | "medium" | "low" | "none";
}

const WiFiSetup = ({ onNext, onBack }: WiFiSetupProps) => {
  const defaultNetwork: WiFiNetwork = {
    name: "Select your network",
    strength: "none",
  };
  const [selectedNetwork, setSelectedNetwork] =
    useState<WiFiNetwork>(defaultNetwork);
  const [password, setPassword] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const networks: WiFiNetwork[] = [
    defaultNetwork,
    { name: "Home_WiFi_2.4G", strength: "high" },
    { name: "TP-Link_5G", strength: "high" },
    { name: "NETGEAR68", strength: "medium" },
    { name: "AndroidAP_1234", strength: "medium" },
    { name: "Guest_Network", strength: "low" },
  ];

  const getSignalIcon = (strength: WiFiNetwork["strength"]) => {
    switch (strength) {
      case "high":
        return <FontAwesomeIcon icon={faWifi} className="signal-icon high" />;
      case "medium":
        return <FontAwesomeIcon icon={faWifi} className="signal-icon medium" />;
      case "low":
        return <FontAwesomeIcon icon={faWifi} className="signal-icon low" />;
      default:
        return null;
    }
  };

  const networkTemplate = (network: WiFiNetwork) => {
    if (network.strength === "none") {
      return (
        <div className="wifi-network-item default-option">{network.name}</div>
      );
    }
    return (
      <div className="wifi-network-item">
        <span>{network.name}</span>
        {getSignalIcon(network.strength)}
      </div>
    );
  };

  const handleConnect = async () => {
    if (isConnected) {
      onNext();
      return;
    }

    setIsConnecting(true);
    // Simulate connection attempt
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setIsConnected(true);
    } catch (error) {
      // Handle error
    } finally {
      setIsConnecting(false);
    }
  };

  const isRealNetwork = (network: WiFiNetwork) => {
    return network.strength !== "none";
  };

  const getButtonContent = () => {
    if (isConnecting) {
      return (
        <div className="flex flex-column align-items-center gap-2">
          <ProgressSpinner
            style={{ width: "30px", height: "30px" }}
            strokeWidth="4"
            fill="var(--surface-ground)"
            animationDuration=".5s"
          />
          <span>Connecting...</span>
        </div>
      );
    }
    return isConnected ? "Next" : "Connect";
  };

  return (
    <div className="wifi-step text-center">
      <div className="flex flex-column align-items-center gap-4">
        <h1 className="text-2xl font-bold">WiFi Setup</h1>
        <p className="text-gray-600">Select your WiFi network</p>

        <div className="wifi-form w-full">
          <div className="field mb-4">
            <label htmlFor="wifi" className="block text-left mb-2">
              WiFi Network
            </label>
            <Dropdown
              id="wifi"
              value={selectedNetwork}
              onChange={(e) => {
                setSelectedNetwork(e.value);
                setIsConnected(false);
              }}
              options={networks}
              optionLabel="name"
              emptyMessage="No networks found"
              className="w-full"
              itemTemplate={networkTemplate}
              valueTemplate={(network: WiFiNetwork) => network.name}
              disabled={isConnecting}
            />
          </div>

          {isRealNetwork(selectedNetwork) && (
            <div className="field mb-4">
              <label htmlFor="password" className="block text-left mb-2">
                Password
              </label>
              <Password
                id="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setIsConnected(false);
                }}
                className="w-full"
                placeholder="Enter WiFi password"
                toggleMask
                feedback={false}
                disabled={isConnecting}
              />
            </div>
          )}

          <Button
            label={isConnecting ? "" : isConnected ? "Next" : "Connect"}
            className="w-full connection-button"
            onClick={handleConnect}
            disabled={
              !isRealNetwork(selectedNetwork) || (!isConnected && !password)
            }
            severity={isConnected ? "success" : "secondary"}
            icon={isConnected ? "pi pi-arrow-right" : undefined}
            iconPos="right"
          >
            {isConnecting && getButtonContent()}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WiFiSetup;
