import { useState, useCallback } from 'react';
import { auditImage, loadModel } from '../utils/imageAuditor';
import { toast } from 'react-toastify';

/**
 * Hook to audit images in listing forms
 */
export const useImageAuditor = () => {
    const [isAuditing, setIsAuditing] = useState({}); // Tracking auditing status per index/type
    const [auditResults, setAuditResults] = useState({});

    const performAudit = useCallback(async (file, index, type = 'main') => {
        const key = `${type}_${index}`;
        setIsAuditing(prev => ({ ...prev, [key]: true }));

        try {
            await loadModel();
            const reader = new FileReader();

            await new Promise((resolve, reject) => {
                reader.onload = async (e) => {
                    const img = new Image();
                    img.src = e.target.result;
                    img.onload = async () => {
                        try {
                            const result = await auditImage(img);

                            if (!result) {
                                throw new Error("AI returned null result");
                            }

                            setAuditResults(prev => ({
                                ...prev,
                                [key]: result
                            }));
                            toast.success(`AI Audit successful for ${type} image ${index + 1}!`, {
                                position: "bottom-right",
                                autoClose: 3000,
                                icon: '🧠'
                            });
                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    };
                    img.onerror = () => reject(new Error('Failed to load local image'));
                };
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsDataURL(file);
            });
        } catch (error) {
            console.error('Audit Hook Error:', error);
            toast.error(`AI Audit failed for ${type} image ${index + 1}.`);
        } finally {
            setIsAuditing(prev => ({ ...prev, [key]: false }));
        }
    }, []);

    const auditByUrl = useCallback(async (url, index, type = 'main') => {
        if (!url) return;
        const key = `${type}_${index}`;
        setIsAuditing(prev => ({ ...prev, [key]: true }));

        try {
            await loadModel();
            const img = new Image();

            // Crucial: anonymous enables CORS if the server allows it
            img.crossOrigin = "anonymous";
            img.src = url;

            await new Promise((resolve, reject) => {
                img.onload = async () => {
                    try {
                        const result = await auditImage(img);

                        if (!result) {
                            throw new Error("AI Analysis returned no results (null)");
                        }

                        setAuditResults(prev => ({
                            ...prev,
                            [key]: result
                        }));
                        toast.success(`AI Analysis complete for ${type} image ${index + 1}!`, {
                            position: "bottom-right",
                            autoClose: 3000,
                            icon: '🧠'
                        });
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                };
                img.onerror = () => {
                    // This error usually triggers if CORS is blocked
                    reject(new Error('CORS_ERROR_OR_NOT_FOUND'));
                };
            });
        } catch (error) {
            console.error('URL Audit Error:', error);
            if (error.message === 'CORS_ERROR_OR_NOT_FOUND') {
                toast.warning(
                    "This website (e.g. NoBroker/WordPress) blocks AI from accessing its images directly due to security policies. Try downloading the image and uploading the file instead for full AI analysis!",
                    { position: "top-right", autoClose: 8000 }
                );
            } else {
                toast.error("AI could not analyze this URL.");
            }
        } finally {
            setIsAuditing(prev => ({ ...prev, [key]: false }));
        }
    }, []);

    const clearAudit = (index, type = 'main') => {
        const key = `${type}_${index}`;
        setAuditResults(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    return {
        performAudit,
        auditByUrl,
        auditResults,
        setAuditResults,
        isAuditing,
        clearAudit
    };
};
