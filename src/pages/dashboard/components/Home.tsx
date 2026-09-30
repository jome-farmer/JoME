import { Card } from 'primereact/card';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faMicrochip, faDroplet, faClock, faBell, faDownload } from '@fortawesome/free-solid-svg-icons';
import './Home.css';
import CustomButton from '../../../components/CustomButton';

const Home = () => {
    // This would typically come from your application state or API
    const systemInfo = {
        lastChecked: "Today 09:30 AM",
        networkStatus: "Connected",
        activeZones: "4/16",
        nextSchedule: "Today 6:00 PM",
        waterUsage: "250L",
        uptime: "5 days 2 hours"
    };

    return (
        <div className="home-container">
            <div className="top-navbar">
                <h1 className="page-title">System Status</h1>
                <CustomButton icon={faBell} className="notification-btn" severity="secondary" rounded={true} />
            </div>

            <Card className="system-status-card">
                <div className="status-header">
                    <div className="header-content">
                        <h2>System Health</h2>
                        <p className="last-checked">Last checked: {systemInfo.lastChecked}</p>
                    </div>
                    <div className="status-icon-container">
                        <FontAwesomeIcon icon={faCheck} className="status-icon" />
                    </div>
                </div>
                
                <div className="status-details">
                    <div className="status-row">
                        <span className="status-label">Network Status</span>
                        <span className="status-value">{systemInfo.networkStatus}</span>
                    </div>
                    
                    <div className="status-row">
                        <span className="status-label">Active Zones</span>
                        <span className="status-value">{systemInfo.activeZones}</span>
                    </div>
                    
                    <div className="status-row">
                        <span className="status-label">Next Schedule</span>
                        <span className="status-value">{systemInfo.nextSchedule}</span>
                    </div>
                </div>
            </Card>

            <div className="updates-section">
                <div className="updates-header">
                    <h2>System Updates</h2>
                    <CustomButton className="update-now-btn" severity="secondary" rounded={true} text="Update System" icon={faDownload} />
                </div>

                <Card className="update-card">
                    <div className="update-content">
                        <FontAwesomeIcon icon={faMicrochip} className="chip-icon" />
                        <div className="update-info">
                            <h3>BIOS Update Available</h3>
                            <p className="version">Version 2.1.0</p>
                            <p className="description">
                                This update includes important security patches and system stability improvements.
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="status-cards-grid">
                <Card className="status-card">
                    <div className="status-header">
                        <div className="header-content">
                            <h2>Water Usage</h2>
                            <div className="metric-value">
                                <FontAwesomeIcon icon={faDroplet} className="metric-icon" />
                                <span>{systemInfo.waterUsage}</span>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="status-card">
                    <div className="status-header">
                        <div className="header-content">
                            <h2>Uptime</h2>
                            <div className="metric-value">
                                <FontAwesomeIcon icon={faClock} className="metric-icon" />
                                <span>{systemInfo.uptime}</span>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default Home;