import { useState } from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faCalendarAlt, faLeaf, faUser } from '@fortawesome/free-solid-svg-icons';
// Import the components
import Home from './components/Home';
import Zones from './components/Zones';
import Profile from './components/Profile';
import Schedule from './components/Schedule';
import "./dashboard.css"; // Ensure you have a CSS file for styling

const DashboardPage = () => {
    const [selectedMenu, setSelectedMenu] = useState("Home"); // State to track selected menu

    // Function to render the correct component based on selection
    const renderContent = () => {
        switch (selectedMenu) {
            case "Home":
                return <Home />;
            case "Schedule":
                return <Schedule />;
            case "Zones":
                return <Zones />;
            case "Profile":
                return <Profile />;
            default:
                return <Home />;
        }
    };

    return (
        <div className="dashboard-container">
            <div className="content">
                {renderContent()}
            </div>
            <div className="navbar">
                {/* Updated menu items with icons */}
                <ul>
                    <li 
                        className={selectedMenu === "Home" ? "selected" : ""} 
                        onClick={() => setSelectedMenu("Home")}
                    >
                        <FontAwesomeIcon icon={faHome} />
                        <span>Home</span>
                    </li>
                    <li 
                        className={selectedMenu === "Schedule" ? "selected" : ""} 
                        onClick={() => setSelectedMenu("Schedule")}
                    >
                        <FontAwesomeIcon icon={faCalendarAlt} />
                        <span>Schedule</span>
                    </li>
                    <li 
                        className={selectedMenu === "Zones" ? "selected" : ""} 
                        onClick={() => setSelectedMenu("Zones")}
                    >
                        <FontAwesomeIcon icon={faLeaf} />
                        <span>Zones</span>
                    </li>
                    <li 
                        className={selectedMenu === "Profile" ? "selected" : ""} 
                        onClick={() => setSelectedMenu("Profile")}
                    >
                        <FontAwesomeIcon icon={faUser} />
                        <span>Profile</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}

export default DashboardPage;