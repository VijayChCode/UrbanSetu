import React from 'react';
import { FaPalette, FaFont, FaExpandAlt, FaVolumeUp, FaKeyboard, FaClock, FaArrowDown, FaCog, FaChartBar, FaBug, FaUniversalAccess, FaEye, FaRunning, FaBlind, FaTextHeight } from 'react-icons/fa';

const ChatSettingsModal = ({ isOpen, onClose, settings, updateSetting }) => {
    if (!isOpen) return null;

    const isDarkMode = settings.theme === 'dark' || document.documentElement.classList.contains('dark');

    const getToggleSwitchClasses = (isEnabled) => {
        return `w-12 h-6 rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${isEnabled ? 'bg-blue-600' : 'bg-gray-300'
            }`;
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
            <div className={`${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'} rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] animate-fadeIn`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-5 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <FaCog className="text-blue-500" />
                        Chat Settings
                    </h3>

                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* Appearance Section */}
                    <section>
                        <h4 className={`text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            <FaPalette className="text-xs" /> Appearance
                        </h4>

                        <div className="space-y-5">


                            {/* Theme Color */}
                            <div>
                                <div className="font-medium mb-3">Theme Color</div>
                                <div className="grid grid-cols-5 gap-3">
                                    {['blue', 'green', 'purple', 'orange', 'red', 'indigo', 'teal', 'pink', 'yellow', 'cyan'].map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => updateSetting('themeColor', color)}
                                            className={`w-8 h-8 rounded-full border-2 transition-all duration-200 ${settings.themeColor === color ? 'border-gray-400 scale-110' : 'border-gray-200 hover:scale-105'
                                                }`}
                                            style={{ backgroundColor: color }}
                                            title={color.charAt(0).toUpperCase() + color.slice(1)}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Font Size */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FaFont className="text-gray-400" />
                                    <div>
                                        <div className="font-medium">Font Size</div>
                                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Adjust text size</div>
                                    </div>
                                </div>
                                <div className="flex bg-gray-100 rounded-lg p-1 dark:bg-gray-700">
                                    {['small', 'medium', 'large'].map((size) => (
                                        <button
                                            key={size}
                                            onClick={() => updateSetting('fontSize', size)}
                                            className={`px-3 py-1.5 rounded-md text-sm capitalize transition-all ${settings.fontSize === size
                                                ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-600 dark:text-white'
                                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                                }`}
                                        >
                                            {size}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Message Density */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FaExpandAlt className="text-gray-400" />
                                    <div>
                                        <div className="font-medium">Density</div>
                                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Spacing between messages</div>
                                    </div>
                                </div>
                                <select
                                    value={settings.messageDensity}
                                    onChange={(e) => updateSetting('messageDensity', e.target.value)}
                                    className={`px-3 py-1.5 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 outline-none ${isDarkMode
                                        ? 'bg-gray-700 border-gray-600 text-white'
                                        : 'bg-gray-50 border-gray-300 text-gray-900'
                                        }`}
                                >
                                    <option value="compact">Compact</option>
                                    <option value="comfortable">Comfortable</option>
                                    <option value="spacious">Spacious</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* Behavior Section */}
                    <section>
                        <h4 className={`text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            <FaCog className="text-xs" /> Behavior
                        </h4>

                        <div className="space-y-5">
                            {/* Auto Scroll */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FaArrowDown className="text-gray-400" />
                                    <div>
                                        <div className="font-medium">Auto Scroll</div>
                                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Scroll to new messages</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSetting('autoScroll', !settings.autoScroll)}
                                    className={getToggleSwitchClasses(settings.autoScroll)}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${settings.autoScroll ? 'translate-x-6' : 'translate-x-0.5'} mt-0.5`} />
                                </button>
                            </div>

                            {/* Show Timestamps */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FaClock className="text-gray-400" />
                                    <div>
                                        <div className="font-medium">Timestamps</div>
                                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Show message time</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSetting('showTimestamps', !settings.showTimestamps)}
                                    className={getToggleSwitchClasses(settings.showTimestamps)}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${settings.showTimestamps ? 'translate-x-6' : 'translate-x-0.5'} mt-0.5`} />
                                </button>
                            </div>

                            {/* Enter to Send */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FaKeyboard className="text-gray-400" />
                                    <div>
                                        <div className="font-medium">Enter to Send</div>
                                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Send message on Enter key</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSetting('enterToSend', !settings.enterToSend)}
                                    className={getToggleSwitchClasses(settings.enterToSend)}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${settings.enterToSend ? 'translate-x-6' : 'translate-x-0.5'} mt-0.5`} />
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Sound Section */}
                    <section>
                        <h4 className={`text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            <FaVolumeUp className="text-xs" /> Sound
                        </h4>

                        <div className="space-y-5">
                            {/* Sound Effects */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FaVolumeUp className="text-gray-400" />
                                    <div>
                                        <div className="font-medium">Sound Effects</div>
                                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Play sounds for new messages</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSetting('soundEnabled', !settings.soundEnabled)}
                                    className={getToggleSwitchClasses(settings.soundEnabled)}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${settings.soundEnabled ? 'translate-x-6' : 'translate-x-0.5'} mt-0.5`} />
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Privacy & Data Section */}
                    <section>
                        <h4 className={`text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            <FaChartBar className="text-xs" /> Privacy & Data
                        </h4>

                        <div className="space-y-5">
                            {/* Analytics */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FaChartBar className="text-gray-400" />
                                    <div>
                                        <div className="font-medium">Analytics</div>
                                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Share usage data</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSetting('enableAnalytics', !settings.enableAnalytics)}
                                    className={getToggleSwitchClasses(settings.enableAnalytics)}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${settings.enableAnalytics ? 'translate-x-6' : 'translate-x-0.5'} mt-0.5`} />
                                </button>
                            </div>

                            {/* Error Reporting */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FaBug className="text-gray-400" />
                                    <div>
                                        <div className="font-medium">Error Reporting</div>
                                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Send crash reports</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSetting('enableErrorReporting', !settings.enableErrorReporting)}
                                    className={getToggleSwitchClasses(settings.enableErrorReporting)}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${settings.enableErrorReporting ? 'translate-x-6' : 'translate-x-0.5'} mt-0.5`} />
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Accessibility Section */}
                    <section>
                        <h4 className={`text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            <FaUniversalAccess className="text-xs" /> Accessibility
                        </h4>

                        <div className="space-y-5">
                            {/* High Contrast */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FaEye className="text-gray-400" />
                                    <div>
                                        <div className="font-medium">High Contrast</div>
                                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Increase contrast</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSetting('highContrast', !settings.highContrast)}
                                    className={getToggleSwitchClasses(settings.highContrast)}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${settings.highContrast ? 'translate-x-6' : 'translate-x-0.5'} mt-0.5`} />
                                </button>
                            </div>

                            {/* Reduced Motion */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FaRunning className="text-gray-400" />
                                    <div>
                                        <div className="font-medium">Reduced Motion</div>
                                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Minimize animations</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSetting('reducedMotion', !settings.reducedMotion)}
                                    className={getToggleSwitchClasses(settings.reducedMotion)}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${settings.reducedMotion ? 'translate-x-6' : 'translate-x-0.5'} mt-0.5`} />
                                </button>
                            </div>

                            {/* Screen Reader Support */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FaBlind className="text-gray-400" />
                                    <div>
                                        <div className="font-medium">Screen Reader Support</div>
                                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Optimize for screen readers</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSetting('screenReaderSupport', !settings.screenReaderSupport)}
                                    className={getToggleSwitchClasses(settings.screenReaderSupport)}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${settings.screenReaderSupport ? 'translate-x-6' : 'translate-x-0.5'} mt-0.5`} />
                                </button>
                            </div>

                            {/* Large Text */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FaTextHeight className="text-gray-400" />
                                    <div>
                                        <div className="font-medium">Large Text</div>
                                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Increase text size</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSetting('largeText', !settings.largeText)}
                                    className={getToggleSwitchClasses(settings.largeText)}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${settings.largeText ? 'translate-x-6' : 'translate-x-0.5'} mt-0.5`} />
                                </button>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className={`p-5 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} flex justify-end`}>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatSettingsModal;
