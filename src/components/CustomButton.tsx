import { Button } from 'primereact/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

import './CustomButton.css';

interface CustomButtonProps {
    text?: string | null;
    icon?: IconDefinition | null;
    iconPosition?: 'left' | 'right';
    className?: string;
    severity?: "secondary" | "success" | "info" | "warning" | "danger" | "help" | "contrast";
    rounded?: boolean;
}

const CustomButton = ({
    text = null,
    icon = null,
    iconPosition = 'left',
    className = '',
    severity = 'secondary',
    rounded = false
}: CustomButtonProps) => {
    const renderContent = () => {
        if (!text && icon) {
            return <FontAwesomeIcon icon={icon} />;
        }

        return (
            <>
                {iconPosition === 'left' && icon && <FontAwesomeIcon icon={icon} className="mr-2" />}
                {text && <span>{text}</span>}
                {iconPosition === 'right' && icon && <FontAwesomeIcon icon={icon} className="ml-2" />}
            </>
        );
    };

    return (
        <Button 
            className={className}
            rounded={rounded}
            text={text ? true : false}
            severity={severity}
        >
            {renderContent()}
        </Button>
    );
};

export default CustomButton; 