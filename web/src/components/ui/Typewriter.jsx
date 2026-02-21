import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

/**
 * Typewriter component for creating a typing animation effect.
 * 
 * @param {string[]} words - Array of words to rotate through.
 * @param {string} className - Additional CSS classes.
 * @param {number} period - Time in ms to wait after completing a word (default 2000).
 */
const Typewriter = ({ words, className = "", period = 2000 }) => {
    const [index, setIndex] = useState(0);
    const [subIndex, setSubIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [blink, setBlink] = useState(true);

    // Blinking cursor logic
    useEffect(() => {
        const timeout2 = setTimeout(() => {
            setBlink((prev) => !prev);
        }, 500);
        return () => clearTimeout(timeout2);
    }, [blink]);

    // Typing logic
    useEffect(() => {
        if (index === words.length) return;

        if (subIndex === words[index].length + 1 && !isDeleting) {
            const timeout = setTimeout(() => {
                setIsDeleting(true);
            }, period);
            return () => clearTimeout(timeout);
        }

        if (subIndex === 0 && isDeleting) {
            setIsDeleting(false);
            setIndex((prev) => (prev + 1) % words.length);
            return;
        }

        const timeout = setTimeout(() => {
            setSubIndex((prev) => prev + (isDeleting ? -1 : 1));
        }, isDeleting ? 70 : 130);

        return () => clearTimeout(timeout);
    }, [subIndex, index, isDeleting, words, period]);

    return (
        <span className={className}>
            {`${words[index].substring(0, subIndex)}`}
            <motion.span
                animate={{ opacity: blink ? 1 : 0 }}
                transition={{ duration: 0.1 }}
                className="inline-block w-[3px] h-[0.9em] bg-blue-500 ml-1 align-middle"
            />
        </span>
    );
};

export default Typewriter;
