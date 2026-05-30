import React, { useState, useEffect } from 'react';
import UrbanSetuSpinner from './UrbanSetuSpinner';
import { FaLeaf, FaUsers, FaShieldAlt, FaSave, FaCalculator, FaInfoCircle } from 'react-icons/fa';

const ESGManagement = ({ esgData, onESGChange, isEditing = false, disabled = false }) => {
    const [saving, setSaving] = useState(false);
    const [saveButtonLoading, setSaveButtonLoading] = useState(false);
    const [esg, setEsg] = useState({
        environmental: {
            energyRating: 'Not Rated',
            carbonFootprint: 0,
            renewableEnergy: false,
            waterEfficiency: 'Not Rated',
            wasteManagement: 'Not Rated',
            greenCertification: 'None',
            solarPanels: false,
            rainwaterHarvesting: false
        },
        social: {
            accessibility: 'Not Rated',
            communityImpact: 0,
            affordableHousing: false,
            localEmployment: 0,
            socialAmenities: [],
            diversityInclusion: 'Not Rated'
        },
        governance: {
            transparency: 'Not Rated',
            ethicalStandards: 'Not Rated',
            compliance: 'Not Rated',
            riskManagement: 'Not Rated',
            stakeholderEngagement: 'Not Rated'
        }
    });

    const [calculatedScore, setCalculatedScore] = useState(0);
    const [calculatedRating, setCalculatedRating] = useState('Not Rated');
    const [showCalculator, setShowCalculator] = useState(false);

    useEffect(() => {
        if (esgData) {
            setEsg(esgData);
            // If esgData already has calculated values, use them
            if (esgData.esgScore !== undefined) {
                setCalculatedScore(esgData.esgScore);
            }
            if (esgData.esgRating !== undefined) {
                setCalculatedRating(esgData.esgRating);
            }
            calculateESGScore(esgData);

            // Ensure parent gets the data with calculated values
            onESGChange(esgData);
        } else {
            // If no esgData provided, calculate score for default empty structure
            calculateESGScore(esg);
        }
    }, [esgData]);

    // Ensure initial calculation happens on component mount
    useEffect(() => {
        calculateESGScore(esg);
    }, []);

    const handleChange = (category, field, value) => {
        setSaving(true);
        const newEsg = {
            ...esg,
            [category]: {
                ...esg[category],
                [field]: value
            }
        };
        setEsg(newEsg);

        // Calculate score and rating
        let score = 0;
        let factors = 0;

        // Environmental factors (40% weight)
        if (newEsg.environmental?.energyRating && newEsg.environmental.energyRating !== 'Not Rated') {
            const energyScore = getEnergyRatingScore(newEsg.environmental.energyRating);
            score += energyScore * 0.4;
            factors += 0.4;
        }

        if (newEsg.environmental?.renewableEnergy) {
            score += 20 * 0.4;
            factors += 0.4;
        }

        if (newEsg.environmental?.greenCertification && newEsg.environmental.greenCertification !== 'None') {
            score += 15 * 0.4;
            factors += 0.4;
        }

        // Social factors (30% weight)
        if (newEsg.social?.communityImpact > 0) {
            score += Math.min(newEsg.social.communityImpact, 20) * 0.3;
            factors += 0.3;
        }

        if (newEsg.social?.affordableHousing) {
            score += 15 * 0.3;
            factors += 0.3;
        }

        if (newEsg.social?.accessibility && newEsg.social.accessibility !== 'Not Rated') {
            const accessibilityScore = getAccessibilityScore(newEsg.social.accessibility);
            score += accessibilityScore * 0.3;
            factors += 0.3;
        }

        // Governance factors (30% weight)
        if (newEsg.governance?.transparency && newEsg.governance.transparency !== 'Not Rated') {
            const transparencyScore = getRatingScore(newEsg.governance.transparency);
            score += transparencyScore * 0.3;
            factors += 0.3;
        }

        if (newEsg.governance?.compliance && newEsg.governance.compliance !== 'Not Rated') {
            const complianceScore = getComplianceScore(newEsg.governance.compliance);
            score += complianceScore * 0.3;
            factors += 0.3;
        }

        const finalScore = factors > 0 ? Math.min(Math.round(score / factors * 5), 100) : 0;
        const finalRating = getESGRating(finalScore);

        setCalculatedScore(finalScore);
        setCalculatedRating(finalRating);

        // Include calculated score and rating inside the esg object
        const esgWithCalculations = {
            ...newEsg,
            esgScore: finalScore,
            esgRating: finalRating,
            lastEsgUpdate: new Date().toISOString()
        };
        onESGChange(esgWithCalculations);

        // Simulate saving delay
        setTimeout(() => {
            setSaving(false);
        }, 500);
    };

    const handleArrayChange = (category, field, value, isAdd) => {
        const currentArray = esg[category][field] || [];
        const newArray = isAdd
            ? [...currentArray, value]
            : currentArray.filter(item => item !== value);

        handleChange(category, field, newArray);
    };

    const calculateESGScore = (esgData) => {
        let score = 0;
        let factors = 0;

        // Environmental factors (40% weight)
        if (esgData.environmental?.energyRating && esgData.environmental.energyRating !== 'Not Rated') {
            const energyScore = getEnergyRatingScore(esgData.environmental.energyRating);
            score += energyScore * 0.4;
            factors += 0.4;
        }

        if (esgData.environmental?.renewableEnergy) {
            score += 20 * 0.4;
            factors += 0.4;
        }

        if (esgData.environmental?.greenCertification && esgData.environmental.greenCertification !== 'None') {
            score += 15 * 0.4;
            factors += 0.4;
        }

        // Social factors (30% weight)
        if (esgData.social?.communityImpact > 0) {
            score += Math.min(esgData.social.communityImpact, 20) * 0.3;
            factors += 0.3;
        }

        if (esgData.social?.affordableHousing) {
            score += 15 * 0.3;
            factors += 0.3;
        }

        if (esgData.social?.accessibility && esgData.social.accessibility !== 'Not Rated') {
            const accessibilityScore = getAccessibilityScore(esgData.social.accessibility);
            score += accessibilityScore * 0.3;
            factors += 0.3;
        }

        // Governance factors (30% weight)
        if (esgData.governance?.transparency && esgData.governance.transparency !== 'Not Rated') {
            const transparencyScore = getRatingScore(esgData.governance.transparency);
            score += transparencyScore * 0.3;
            factors += 0.3;
        }

        if (esgData.governance?.compliance && esgData.governance.compliance !== 'Not Rated') {
            const complianceScore = getComplianceScore(esgData.governance.compliance);
            score += complianceScore * 0.3;
            factors += 0.3;
        }

        const finalScore = factors > 0 ? Math.min(Math.round(score / factors * 5), 100) : 0;
        const finalRating = getESGRating(finalScore);
        setCalculatedScore(finalScore);
        setCalculatedRating(finalRating);

        // Update parent with calculated values
        const esgWithCalculations = {
            ...esgData,
            esgScore: finalScore,
            esgRating: finalRating,
            lastEsgUpdate: new Date().toISOString()
        };
        console.log('ESGManagement: Sending calculated values:', { esgScore: finalScore, esgRating: finalRating });
        onESGChange(esgWithCalculations);
    };

    const getEnergyRatingScore = (rating) => {
        const scores = {
            'A+': 20, 'A': 18, 'B': 15, 'C': 10, 'D': 5, 'E': 2, 'F': 1, 'G': 0
        };
        return scores[rating] || 0;
    };

    const getAccessibilityScore = (accessibility) => {
        const scores = {
            'Fully Accessible': 20, 'Partially Accessible': 10, 'Not Accessible': 0
        };
        return scores[accessibility] || 0;
    };

    const getRatingScore = (rating) => {
        const scores = {
            'Excellent': 20, 'Good': 15, 'Average': 10, 'Poor': 5
        };
        return scores[rating] || 0;
    };

    const getComplianceScore = (compliance) => {
        const scores = {
            'Fully Compliant': 20, 'Mostly Compliant': 15, 'Partially Compliant': 10, 'Non-Compliant': 0
        };
        return scores[compliance] || 0;
    };

    const getESGRating = (score) => {
        if (score >= 90) return 'AAA';
        if (score >= 80) return 'AA';
        if (score >= 70) return 'A';
        if (score >= 60) return 'BBB';
        if (score >= 50) return 'BB';
        if (score >= 40) return 'B';
        if (score >= 30) return 'CCC';
        if (score >= 20) return 'CC';
        if (score >= 10) return 'C';
        return 'Not Rated';
    };

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30';
        if (score >= 60) return 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/30';
        if (score >= 40) return 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/30';
        return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30';
    };

    const socialAmenitiesOptions = [
        'Community Center', 'Playground', 'Gym', 'Swimming Pool', 'Garden',
        'Library', 'Medical Center', 'School', 'Shopping Center', 'Park'
    ];

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-colors">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <FaLeaf className="text-green-500" />
                    <FaUsers className="text-blue-500" />
                    <FaShieldAlt className="text-purple-500" />
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white transition-colors">ESG Management</h3>
                </div>
                <div className="flex items-center gap-2">
                    {saving && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg transition-colors">
                            <UrbanSetuSpinner size="sm" isBright={false} />
                            Saving ESG...
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => setShowCalculator(!showCalculator)}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    >
                        <FaCalculator />
                        {showCalculator ? 'Hide' : 'Show'} Calculator
                    </button>
                </div>
            </div>

            {/* ESG Score Calculator */}
            {showCalculator && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg transition-colors">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-semibold text-gray-800 dark:text-white transition-colors">Calculated ESG Score</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">Based on current inputs</p>
                        </div>
                        <div className="text-right">
                            <div className={`text-2xl font-bold px-3 py-2 rounded-lg transition-colors ${getScoreColor(calculatedScore)}`}>
                                {calculatedScore}/100
                            </div>
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1 transition-colors">
                                Rating: {calculatedRating}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <fieldset disabled={disabled} className="contents">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Environmental Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                        <FaLeaf className="text-green-500" />
                        <h4 className="font-semibold text-gray-800 dark:text-white transition-colors">Environmental</h4>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors">
                            Energy Rating
                        </label>
                        <select
                            value={esg.environmental.energyRating}
                            onChange={(e) => handleChange('environmental', 'energyRating', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                        >
                            <option value="Not Rated">Not Rated</option>
                            <option value="A+">A+</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="D">D</option>
                            <option value="E">E</option>
                            <option value="F">F</option>
                            <option value="G">G</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors">
                            Carbon Footprint (kg CO₂/year)
                        </label>
                        <input
                            type="number"
                            value={esg.environmental.carbonFootprint}
                            onChange={(e) => handleChange('environmental', 'carbonFootprint', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors">
                            Water Efficiency
                        </label>
                        <select
                            value={esg.environmental.waterEfficiency}
                            onChange={(e) => handleChange('environmental', 'waterEfficiency', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                        >
                            <option value="Not Rated">Not Rated</option>
                            <option value="Excellent">Excellent</option>
                            <option value="Good">Good</option>
                            <option value="Average">Average</option>
                            <option value="Poor">Poor</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors">
                            Green Certification
                        </label>
                        <select
                            value={esg.environmental.greenCertification}
                            onChange={(e) => handleChange('environmental', 'greenCertification', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                        >
                            <option value="None">None</option>
                            <option value="LEED">LEED</option>
                            <option value="BREEAM">BREEAM</option>
                            <option value="GRIHA">GRIHA</option>
                            <option value="IGBC">IGBC</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={esg.environmental.renewableEnergy}
                                onChange={(e) => handleChange('environmental', 'renewableEnergy', e.target.checked)}
                                className="mr-2"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300 transition-colors">☀️ Renewable Energy</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={esg.environmental.solarPanels}
                                onChange={(e) => handleChange('environmental', 'solarPanels', e.target.checked)}
                                className="mr-2 accent-green-600 dark:accent-green-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300 transition-colors">🔋 Solar Panels</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={esg.environmental.rainwaterHarvesting}
                                onChange={(e) => handleChange('environmental', 'rainwaterHarvesting', e.target.checked)}
                                className="mr-2 accent-green-600 dark:accent-green-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300 transition-colors">💧 Rainwater Harvesting</span>
                        </label>
                    </div>
                </div>

                {/* Social Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                        <FaUsers className="text-blue-500" />
                        <h4 className="font-semibold text-gray-800 dark:text-white transition-colors">Social</h4>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors">
                            Accessibility
                        </label>
                        <select
                            value={esg.social.accessibility}
                            onChange={(e) => handleChange('social', 'accessibility', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                        >
                            <option value="Not Rated">Not Rated</option>
                            <option value="Fully Accessible">Fully Accessible</option>
                            <option value="Partially Accessible">Partially Accessible</option>
                            <option value="Not Accessible">Not Accessible</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors">
                            Community Impact Score (0-100)
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            value={esg.social.communityImpact}
                            onChange={(e) => handleChange('social', 'communityImpact', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors">
                            Local Employment (jobs created)
                        </label>
                        <input
                            type="number"
                            value={esg.social.localEmployment}
                            onChange={(e) => handleChange('social', 'localEmployment', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors">
                            Social Amenities
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {socialAmenitiesOptions.map((amenity) => (
                                <label key={amenity} className="flex items-center text-sm text-gray-700 dark:text-gray-300 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={esg.social.socialAmenities.includes(amenity)}
                                        onChange={(e) => handleArrayChange('social', 'socialAmenities', amenity, e.target.checked)}
                                        className="mr-2 accent-blue-600 dark:accent-blue-500"
                                    />
                                    {amenity}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={esg.social.affordableHousing}
                                onChange={(e) => handleChange('social', 'affordableHousing', e.target.checked)}
                                className="mr-2 accent-blue-600 dark:accent-blue-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300 transition-colors">🏠 Affordable Housing</span>
                        </label>
                    </div>
                </div>

                {/* Governance Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                        <FaShieldAlt className="text-purple-500" />
                        <h4 className="font-semibold text-gray-800 dark:text-white transition-colors">Governance</h4>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors">
                            Transparency
                        </label>
                        <select
                            value={esg.governance.transparency}
                            onChange={(e) => handleChange('governance', 'transparency', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                        >
                            <option value="Not Rated">Not Rated</option>
                            <option value="Excellent">Excellent</option>
                            <option value="Good">Good</option>
                            <option value="Average">Average</option>
                            <option value="Poor">Poor</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors">
                            Ethical Standards
                        </label>
                        <select
                            value={esg.governance.ethicalStandards}
                            onChange={(e) => handleChange('governance', 'ethicalStandards', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                        >
                            <option value="Not Rated">Not Rated</option>
                            <option value="Excellent">Excellent</option>
                            <option value="Good">Good</option>
                            <option value="Average">Average</option>
                            <option value="Poor">Poor</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors">
                            Compliance
                        </label>
                        <select
                            value={esg.governance.compliance}
                            onChange={(e) => handleChange('governance', 'compliance', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                        >
                            <option value="Not Rated">Not Rated</option>
                            <option value="Fully Compliant">Fully Compliant</option>
                            <option value="Mostly Compliant">Mostly Compliant</option>
                            <option value="Partially Compliant">Partially Compliant</option>
                            <option value="Non-Compliant">Non-Compliant</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors">
                            Risk Management
                        </label>
                        <select
                            value={esg.governance.riskManagement}
                            onChange={(e) => handleChange('governance', 'riskManagement', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                        >
                            <option value="Not Rated">Not Rated</option>
                            <option value="Excellent">Excellent</option>
                            <option value="Good">Good</option>
                            <option value="Average">Average</option>
                            <option value="Poor">Poor</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors">
                            Stakeholder Engagement
                        </label>
                        <select
                            value={esg.governance.stakeholderEngagement}
                            onChange={(e) => handleChange('governance', 'stakeholderEngagement', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                        >
                            <option value="Not Rated">Not Rated</option>
                            <option value="Excellent">Excellent</option>
                            <option value="Good">Good</option>
                            <option value="Average">Average</option>
                            <option value="Poor">Poor</option>
                        </select>
                    </div>
                </div>
            </div>
            </fieldset>

            {/* Save Button */}
            <div className="mt-6 flex justify-end">
                <button
                    type="button"
                    onClick={() => {
                        setSaveButtonLoading(true);
                        const esgWithCalculations = {
                            ...esg,
                            esgScore: calculatedScore,
                            esgRating: calculatedRating,
                            lastEsgUpdate: new Date().toISOString()
                        };
                        console.log('ESGManagement: Save button clicked, sending:', { esgScore: calculatedScore, esgRating: calculatedRating });
                        onESGChange(esgWithCalculations);
                        // Reset loading state after a brief delay to show feedback
                        setTimeout(() => {
                            setSaveButtonLoading(false);
                        }, 500);
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={saveButtonLoading || disabled}
                >
                    {saveButtonLoading ? (
                        <>
                            <UrbanSetuSpinner size="sm" isBright={true} />
                            Saving...
                        </>
                    ) : (
                        <>
                            <FaSave />
                            {disabled ? "Save ESG Data (Disabled - Property Deleted)" : "Save ESG Data"}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default ESGManagement;
