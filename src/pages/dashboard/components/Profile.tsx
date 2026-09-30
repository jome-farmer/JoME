import { useNavigate } from 'react-router-dom';
import { Button } from 'primereact/button';
import './Profile.css';

const Profile = () => {
    const navigate = useNavigate();

    const handleAddDevice = () => {
        navigate('/setup');
    };

    return (
        <div className="profile-container">
            {/* Profile Header */}
            <div className="profile-header">
                <h2 className="profile-title">Profile</h2>
                <Button 
                    icon={
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    }
                    className="settings-button"
                />
            </div>

            {/* User Info */}
            <div className="user-info">
                <svg className="user-avatar" viewBox="0 0 100 100" fill="none" stroke="black" strokeWidth="2">
                    <path d="M30 40 Q50 40 70 40" strokeLinecap="round"/> {/* Eyebrows */}
                    <path d="M35 50 Q35 48 35 46" strokeLinecap="round"/> {/* Left eye */}
                    <path d="M65 50 Q65 48 65 46" strokeLinecap="round"/> {/* Right eye */}
                    <path d="M40 70 Q50 75 60 70" strokeLinecap="round"/> {/* Smile */}
                    <path d="M25 30 Q30 20 40 25 Q45 15 55 25 Q65 20 75 30 L70 60 Q50 80 30 60 Z" fill="none"/> {/* Face outline */}
                </svg>
                <div>
                    <h3 className="user-name">John Smith</h3>
                    <p className="user-email">john.smith@example.com</p>
                </div>
            </div>

            {/* Devices Section */}
            <h3 className="devices-title">My Devices</h3>
            
            <div className="devices-scroll-container">
                <div className="devices-list">
                    {/* Home Controller Card */}
                    <div className="device-card">
                        <div className="device-header">
                            <div className="device-info">
                                <div className="device-icon">
                                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4>Home Controller</h4>
                                    <p>Connected</p>
                                </div>
                            </div>
                            <span className="status-badge active">Active</span>
                        </div>
                        <div className="device-details">
                            <div className="details-labels">
                                <p>Active Zones</p>
                                <p>Next Schedule</p>
                            </div>
                            <div className="details-values">
                                <p>4/16</p>
                                <p>Today, 6:00 PM</p>
                            </div>
                        </div>
                    </div>

                    {/* Backyard Controller Card */}
                    <div className="device-card inactive">
                        <div className="device-header">
                            <div className="device-info">
                                <div className="device-icon">
                                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4>Backyard Controller</h4>
                                    <p>Last seen 2h ago</p>
                                </div>
                            </div>
                            <span className="status-badge">Inactive</span>
                        </div>
                        <div className="device-details">
                            <div className="details-labels">
                                <p>Active Zones</p>
                                <p>Next Schedule</p>
                            </div>
                            <div className="details-values">
                                <p>2/16</p>
                                <p>Tomorrow, 7:00 AM</p>
                            </div>
                        </div>
                    </div>

                    {/* Add New Device Button */}
                    <button 
                        className="add-device-button"
                        onClick={handleAddDevice}
                    >
                        + Add New Device
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Profile;