// Enhanced password strength validation utility

export const calculatePasswordStrength = (password) => {
    if (!password) return { score: 0, level: 'very-weak', feedback: [] };
    
    let score = 0;
    const feedback = [];
    
    // Length check
    if (password.length >= 8) {
        score += 1;
    } else {
        feedback.push('At least 8 characters');
    }
    
    if (password.length >= 12) {
        score += 1;
    }
    
    if (password.length >= 16) {
        score += 1;
    }
    
    // Character variety checks
    if (/[a-z]/.test(password)) {
        score += 1;
    } else {
        feedback.push('Lowercase letters');
    }
    
    if (/[A-Z]/.test(password)) {
        score += 1;
    } else {
        feedback.push('Uppercase letters');
    }
    
    if (/[0-9]/.test(password)) {
        score += 1;
    } else {
        feedback.push('Numbers');
    }
    
    if (/[^A-Za-z0-9]/.test(password)) {
        score += 1;
    } else {
        feedback.push('Special characters');
    }
    
    // Additional security checks
    if (!/(.)\1{2,}/.test(password)) { // No repeated characters
        score += 1;
    } else {
        feedback.push('Avoid repeated characters');
    }
    
    if (!/123|abc|qwe|asd|zxc/i.test(password)) { // No common sequences
        score += 1;
    } else {
        feedback.push('Avoid common sequences');
    }
    
    if (!/password|123456|qwerty|admin|login/i.test(password)) { // No common passwords
        score += 1;
    } else {
        feedback.push('Avoid common passwords');
    }
    
    // Determine strength level
    let level;
    if (score <= 3) {
        level = 'very-weak';
    } else if (score <= 5) {
        level = 'weak';
    } else if (score <= 7) {
        level = 'medium';
    } else if (score <= 9) {
        level = 'strong';
    } else {
        level = 'very-strong';
    }
    
    return { score, level, feedback };
};

export const getPasswordStrengthColor = (level) => {
    const colors = {
        'very-weak': 'text-red-600',
        'weak': 'text-red-500',
        'medium': 'text-yellow-500',
        'strong': 'text-green-500',
        'very-strong': 'text-green-600'
    };
    return colors[level] || 'text-gray-500';
};

export const getPasswordStrengthBgColor = (level) => {
    const colors = {
        'very-weak': 'bg-red-100',
        'weak': 'bg-red-50',
        'medium': 'bg-yellow-50',
        'strong': 'bg-green-50',
        'very-strong': 'bg-green-100'
    };
    return colors[level] || 'bg-gray-50';
};

export const getPasswordStrengthText = (level) => {
    const texts = {
        'very-weak': 'Very Weak',
        'weak': 'Weak',
        'medium': 'Medium',
        'strong': 'Strong',
        'very-strong': 'Very Strong'
    };
    return texts[level] || 'Unknown';
};

// Check if password meets minimum requirements
export const meetsMinimumRequirements = (password) => {
    const { score } = calculatePasswordStrength(password);
    return score >= 5; // At least medium strength
};

// Generate password suggestions
export const generatePasswordSuggestions = (password) => {
    const suggestions = [];
    const { feedback } = calculatePasswordStrength(password);
    
    if (feedback.length > 0) {
        suggestions.push(`Add: ${feedback.join(', ')}`);
    }
    
    if (password.length < 12) {
        suggestions.push('Consider using a longer password (12+ characters)');
    }
    
    suggestions.push('Use a unique password for this account');
    suggestions.push('Consider using a password manager');
    
    return suggestions;
};