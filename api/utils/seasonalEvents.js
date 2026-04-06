/**
 * Seasonal Events Utility for Backend
 * 
 * Replicates logic from web/src/hooks/useSeasonalTheme.js but for Node.js usage.
 * Used to determine if today is a festival or special event for sending greetings.
 */

export function* getActiveThemes(dateInput = new Date()) {
    const today = new Date(dateInput);
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-11
    const day = today.getDate();

    // Helper: Check date range within current month
    const isRange = (startDay, endDay, targetMonth) => {
        return month === targetMonth && day >= startDay && day <= endDay;
    };

    // Helper: Check date range across months
    const isDateBetween = (startMonth, startDay, endMonth, endDay) => {
        if (startMonth === endMonth) {
            return month === startMonth && day >= startDay && day <= endDay;
        }
        if (month === startMonth) return day >= startDay;
        if (month === endMonth) return day <= endDay;
        if (month > startMonth && month < endMonth) return true;
        return false;
    };

    // --- 1. Fixed Date Festivals (World & National) ---

    // New Year (Dec 30 - Jan 5)
    // Email only on Jan 1st
    if (isDateBetween(11, 30, 0, 5)) {
        const displayYear = month === 11 ? year + 1 : year;
        yield {
            id: 'newyear',
            name: 'New Year',
            icon: '🎉',
            secondaryIcon: '🎆',
            greeting: `Happy New Year ${displayYear}!`,
            description: `Wishing you a prosperous New Year ${displayYear}! May this year bring you joy, success, and your dream home.`,
            logoDecoration: 'party-hat',
            shouldSendEmail: (month === 0 && day === 1)
        };
    }

    // National Youth Day (Jan 12)
    if (month === 0 && day === 12) {
        yield {
            id: 'youthday',
            name: 'National Youth Day',
            icon: '💪',
            secondaryIcon: '✨',
            greeting: 'Arise, Awake, and Stop Not!',
            description: 'Celebrating the energy and potential of youth on Swami Vivekananda\'s birth anniversary.',
            logoDecoration: 'torch',
            shouldSendEmail: true
        };
    }

    // Republic Day India (Jan 24-26)
    // Email only on Jan 26th
    if (month === 0 && day >= 24 && day <= 26) {
        yield {
            id: 'republic',
            name: 'Republic Day',
            icon: '🇮🇳',
            secondaryIcon: '🫡',
            greeting: 'Happy Republic Day!',
            description: 'Celebrating the spirit of India. Jai Hind!',
            logoDecoration: 'flag',
            shouldSendEmail: (day === 26)
        };
    }

    // National Science Day (Feb 28)
    if (month === 1 && day === 28) {
        yield {
            id: 'scienceday',
            name: 'National Science Day',
            icon: '🔬',
            secondaryIcon: '⚛️',
            greeting: 'Celebrating Science & Innovation!',
            description: 'Honoring the discovery of the Raman Effect and the spirit of scientific inquiry.',
            logoDecoration: 'atom',
            shouldSendEmail: true
        };
    }

    // Valentine's Week (Feb 10 - 14)
    // Email only on Valentine's Day (Feb 14)
    if (month === 1 && day >= 10 && day <= 14) {
        yield {
            id: 'valentine',
            name: 'Valentine\'s Day',
            icon: '❤️',
            secondaryIcon: '💘',
            greeting: 'Happy Valentine\'s Day!',
            description: 'Spreading love and happiness. May you find a home you fall in love with!',
            logoDecoration: 'heart',
            shouldSendEmail: (day === 14)
        };
    }

    // St. Patrick's Day (Mar 17)
    if (month === 2 && day === 17) {
        yield {
            id: 'stpatrick',
            name: 'St. Patrick\'s Day',
            icon: '☘️',
            secondaryIcon: '🍺',
            greeting: 'Happy St. Patrick\'s Day!',
            description: 'Wishing you the luck of the Irish today!',
            logoDecoration: 'clover',
            shouldSendEmail: true
        };
    }

    // World Health Day (Apr 7)
    if (month === 3 && day === 7) {
        yield {
            id: 'healthday',
            name: 'World Health Day',
            icon: '⚕️',
            secondaryIcon: '🍎',
            greeting: 'Health is Wealth!',
            description: 'Prioritizing health and well-being for everyone.',
            logoDecoration: 'cross',
            shouldSendEmail: true
        };
    }

    // Earth Day (Apr 22)
    if (month === 3 && day === 22) {
        yield {
            id: 'earthday',
            name: 'Earth Day',
            icon: '🌍',
            secondaryIcon: '🌱',
            greeting: 'Happy Earth Day!',
            description: 'Let\'s pledge to protect our planet and build sustainable communities.',
            logoDecoration: 'leaf',
            shouldSendEmail: true
        };
    }

    // International Workers' Day (May 1)
    if (month === 4 && day === 1) {
        yield {
            id: 'mayday',
            name: 'Workers\' Day',
            icon: '🛠️',
            secondaryIcon: '👷',
            greeting: 'Honoring Hard Work!',
            description: 'Celebrating the contributions of workers everywhere.',
            logoDecoration: 'hammer',
            shouldSendEmail: true
        };
    }

    // World Environment Day (Jun 5)
    if (month === 5 && day === 5) {
        yield {
            id: 'environmentday',
            name: 'World Environment Day',
            icon: '🌿',
            secondaryIcon: '♻️',
            greeting: 'Protect Our Planet!',
            description: 'Time for Nature. Let\'s nurture the environment for a better tomorrow.',
            logoDecoration: 'leaf',
            shouldSendEmail: true
        };
    }

    // Independence Day India (Aug 15)
    if (month === 7 && day === 15) {
        yield {
            id: 'independence',
            name: 'Independence Day',
            icon: '🇮🇳',
            secondaryIcon: '🎆',
            greeting: 'Happy Independence Day!',
            description: 'Freedom, Liberty, and Unity. Wishing you a proud Independence Day.',
            logoDecoration: 'flag',
            shouldSendEmail: true
        };
    }

    // Engineer's Day India (Sep 15)
    if (month === 8 && day === 15) {
        yield {
            id: 'engineersday',
            name: 'Engineer\'s Day',
            icon: '⚙️',
            secondaryIcon: '📐',
            greeting: 'Happy Engineer\'s Day!',
            description: 'Saluting the architects of our modern world.',
            logoDecoration: 'gear',
            shouldSendEmail: true
        };
    }

    // World Habitat Day & Architecture Day (1st Monday of Oct - approx Oct 1-7)
    if (month === 9 && day >= 1 && day <= 7) {
        const isMonday = new Date(year, 9, day).getDay() === 1;
        if (isMonday || day === 4) {
            yield {
                id: 'architecture',
                name: 'Architecture Week',
                icon: '🏛️',
                secondaryIcon: '🏗️',
                greeting: 'Building the Future!',
                description: 'Celebrating architecture and the power of design to transform lives.',
                logoDecoration: 'building',
                shouldSendEmail: true
            };
        }
    }

    // Gandhi Jayanti (Oct 2)
    if (month === 9 && day === 2) {
        yield {
            id: 'gandhijayanti',
            name: 'Gandhi Jayanti',
            icon: '👓',
            secondaryIcon: '🕊️',
            greeting: 'Remembering Bapu',
            description: 'Be the change you wish to see in the world.',
            logoDecoration: 'glasses',
            shouldSendEmail: true
        };
    }

    // World Space Week (Oct 4-10)
    // Email on first day Oct 4
    if (month === 9 && day >= 4 && day <= 10) {
        yield {
            id: 'spaceweek',
            name: 'World Space Week',
            icon: '🚀',
            secondaryIcon: '🌌',
            greeting: 'Exploring the Universe!',
            description: 'Celebrating science and technology, and their contribution to the betterment of the human condition.',
            logoDecoration: 'rocket',
            shouldSendEmail: (day === 4)
        };
    }

    // Halloween (Oct 31)
    if (month === 9 && day === 31) {
        yield {
            id: 'halloween',
            name: 'Halloween',
            icon: '🎃',
            secondaryIcon: '👻',
            greeting: 'Happy Halloween!',
            description: 'Trick or Treat! Have a spooktacular day!',
            logoDecoration: 'pumpkin',
            shouldSendEmail: true
        };
    }

    // Thanksgiving USA (Approximate)
    if ((year === 2025 && month === 10 && day === 27) || (year === 2026 && month === 10 && day === 26)) {
        yield {
            id: 'thanksgiving',
            name: 'Thanksgiving',
            icon: '🦃',
            secondaryIcon: '🍂',
            greeting: 'Happy Thanksgiving!',
            description: 'Giving thanks for blessings, family, and home.',
            logoDecoration: 'turkey',
            shouldSendEmail: true
        };
    }

    // Christmas (Dec 20-29)
    // Email on Dec 25
    if (month === 11 && day >= 20 && day <= 29) {
        yield {
            id: 'christmas',
            name: 'Christmas',
            icon: '🎅',
            secondaryIcon: '🎄',
            greeting: 'Merry Christmas!',
            description: 'Wishing you peace, joy, and love this Christmas season.',
            logoDecoration: 'santa-hat',
            shouldSendEmail: (day === 25)
        };
    }

    // Pongal / Sankranti (Jan 13-17)
    // Email on Jan 14 (typical main day)
    if (month === 0 && day >= 13 && day <= 17) {
        yield {
            id: 'sankranti',
            name: 'Sankranti',
            icon: '🪁',
            secondaryIcon: '🌾',
            greeting: 'Happy Makar Sankranti / Pongal!',
            description: 'Harvesting happiness and prosperity. Happy festivities!',
            logoDecoration: 'kite',
            shouldSendEmail: (day === 14)
        };
    }


    // --- 2. Variable Date Festivals (Hardcoded for 2025 & 2026) ---
    // Note: Month is 0-indexed (Jan=0, Feb=1, etc.)
    const festivals = [
        // 2025
        { id: 'cny', year: 2025, month: 0, day: 29, window: 3, name: 'Chinese New Year', icon: '🐉', sec: '🧧', greet: 'Gong Xi Fa Cai!', desc: 'Wishing you wealth and prosperity in the Year of the Snake! 🐍', deco: 'dragon' },
        { id: 'shivaratri', year: 2025, month: 1, day: 26, window: 1, name: 'Maha Shivaratri', icon: '🕉️', sec: '🔱', greet: 'Har Har Mahadev!', desc: 'May Lord Shiva bless you with strength and wisdom.', deco: 'trident' },
        { id: 'holi', year: 2025, month: 2, day: 14, window: 1, name: 'Holi', icon: '🎨', sec: '🌈', greet: 'Happy Holi!', desc: 'Splash of colors, joy, and happiness! Have a vibrant Holi.', deco: 'colors' },
        { id: 'ugadi', year: 2025, month: 2, day: 30, window: 1, name: 'Ugadi', icon: '🥭', sec: '🌿', greet: 'Happy Ugadi!', desc: 'New beginnings and new hopes. Happy New Year!', deco: 'mango' },
        { id: 'eidfitr', year: 2025, month: 2, day: 31, window: 2, name: 'Eid al-Fitr', icon: '🌙', sec: '🤲', greet: 'Eid Mubarak!', desc: 'May this Eid bring joy and peace to your heart and home.', deco: 'moon' },
        { id: 'ramnavami', year: 2025, month: 3, day: 6, window: 1, name: 'Sri Rama Navami', icon: '🏹', sec: '🚩', greet: 'Jai Shri Ram!', desc: 'Celebrating the birth of Lord Rama. May righteousness prevail.', deco: 'bow' },
        { id: 'hanuman', year: 2025, month: 3, day: 12, window: 1, name: 'Hanuman Jayanti', icon: '🙏', sec: '💪', greet: 'Jai Bajrangbali!', desc: 'Strength, devotion, and courage. Happy Hanuman Jayanti!', deco: 'mace' },
        { id: 'goodfriday', year: 2025, month: 3, day: 18, window: 0, name: 'Good Friday', icon: '✝️', sec: '🕯️', greet: 'Blessed Good Friday', desc: 'Remembering the sacrifice and love. Have a blessed day.', deco: 'cross' },
        { id: 'easter', year: 2025, month: 3, day: 20, window: 1, name: 'Easter', icon: '🥚', sec: '🐰', greet: 'Happy Easter!', desc: 'New life and new hope. Happy Easter!', deco: 'egg' },
        { id: 'eidadha', year: 2025, month: 5, day: 7, window: 2, name: 'Eid al-Adha', icon: '🕌', sec: '🐑', greet: 'Eid Mubarak!', desc: 'Wishing you a blessed Eid al-Adha filled with sacrifice and faith.', deco: 'lantern' },
        { id: 'rathyatra', year: 2025, month: 5, day: 27, window: 1, name: 'Rath Yatra', icon: '🎡', sec: '🚩', greet: 'Jai Jagannath!', desc: 'May the divine chariot bring you good fortune.', deco: 'chariot' },
        { id: 'muharram', year: 2025, month: 6, day: 26, window: 1, name: 'Islamic New Year', icon: '☪️', sec: '📅', greet: 'Blessed Muharram', desc: 'Reflecting on the New Year with faith and hope.', deco: 'moon' },
        { id: 'rakhi', year: 2025, month: 7, day: 9, window: 1, name: 'Raksha Bandhan', icon: '🧵', sec: '✨', greet: 'Happy Raksha Bandhan!', desc: 'Celebrating the bond of love and protection.', deco: 'rakhi' },
        { id: 'janmashtami', year: 2025, month: 7, day: 16, window: 1, name: 'Janmashtami', icon: '🪈', sec: '🦚', greet: 'Happy Janmashtami!', desc: 'Celebrating the birth of Lord Krishna with joy.', deco: 'flute' },
        { id: 'ganesh', year: 2025, month: 7, day: 27, window: 5, name: 'Ganesh Chaturthi', icon: '🐘', sec: '🕉️', greet: 'Happy Ganesh Chaturthi!', desc: 'Ganpati Bappa Morya! May obstacles be removed from your path.', deco: 'modak' },
        { id: 'milad', year: 2025, month: 8, day: 5, window: 1, name: 'Milad un-Nabi', icon: '🕌', sec: '💚', greet: 'Eid Milad un-Nabi Mubarak!', desc: 'Celebrating the life and teachings of the Prophet.', deco: 'lantern' },
        { id: 'onam', year: 2025, month: 8, day: 5, window: 2, name: 'Onam', icon: '⛵', sec: '🌺', greet: 'Happy Onam!', desc: 'Harvest festival greetings from God\'s own country.', deco: 'flower' },
        { id: 'navaratri', year: 2025, month: 8, day: 22, window: 9, name: 'Navaratri', icon: '🔱', sec: '💃', greet: 'Happy Navaratri!', desc: 'Nine nights of devotion and celebration.', deco: 'trident' },
        { id: 'dussehra', year: 2025, month: 9, day: 2, window: 1, name: 'Dussehra', icon: '🏹', sec: '🌼', greet: 'Happy Dussehra!', desc: 'Victory of good over evil. Happy Dasara!', deco: 'bow' },
        { id: 'diwali', year: 2025, month: 9, day: 20, window: 3, name: 'Diwali', icon: '🪔', sec: '✨', greet: 'Happy Diwali!', desc: 'May the festival of lights brighten your life and home.', deco: 'diya' },
        { id: 'chhath', year: 2025, month: 9, day: 27, window: 3, name: 'Chhath Puja', icon: '🌅', sec: '🕉️', greet: 'Happy Chhath Puja!', desc: 'Wishing you a blessed Chhath Puja filled with faith and devotion.', deco: 'sun' },
        { id: 'lohri', year: 2025, month: 0, day: 13, window: 0, name: 'Lohri', icon: '🔥', sec: '🥜', greet: 'Happy Lohri!', desc: 'May the warmth of the bonfire fill your heart with joy.', deco: 'bonfire' },
        { id: 'basant', year: 2025, month: 1, day: 2, window: 0, name: 'Basant Panchami', icon: '🪁', sec: '🌼', greet: 'Happy Basant Panchami!', desc: 'Celebrating the arrival of spring and goddess Saraswati.', deco: 'kite' },
        { id: 'gudipadwa', year: 2025, month: 2, day: 30, window: 1, name: 'Gudi Padwa', icon: '🪁', sec: '🎋', greet: 'Happy Gudi Padwa!', desc: 'New beginnings and success to you. Happy Nav Varsh!', deco: 'gudi' },

        // 2026
        { id: 'cny', year: 2026, month: 1, day: 17, window: 3, name: 'Chinese New Year', icon: '🐉', sec: '🧧', greet: 'Gong Xi Fa Cai!', desc: 'Wishing you wealth and prosperity in the Year of the Horse! 🐎', deco: 'dragon' },
        { id: 'shivaratri', year: 2026, month: 1, day: 15, window: 1, name: 'Maha Shivaratri', icon: '🕉️', sec: '🔱', greet: 'Har Har Mahadev!', desc: 'May Lord Shiva bless you with strength and wisdom.', deco: 'trident' },
        { id: 'holi', year: 2026, month: 2, day: 4, window: 1, name: 'Holi', icon: '🎨', sec: '🌈', greet: 'Happy Holi!', desc: 'Splash of colors, joy, and happiness! Have a vibrant Holi.', deco: 'colors' },
        { id: 'ugadi', year: 2026, month: 2, day: 19, window: 1, name: 'Ugadi', icon: '🥭', sec: '🌿', greet: 'Happy Ugadi!', desc: 'New beginnings and new hopes. Happy New Year!', deco: 'mango' },
        { id: 'eidfitr', year: 2026, month: 2, day: 20, window: 2, name: 'Eid al-Fitr', icon: '🌙', sec: '🤲', greet: 'Eid Mubarak!', desc: 'May this Eid bring joy and peace to your heart and home.', deco: 'moon' },
        { id: 'ramnavami', year: 2026, month: 2, day: 27, window: 0, name: 'Sri Rama Navami', icon: '🏹', sec: '🚩', greet: 'Jai Shri Ram!', desc: 'Celebrating the birth of Lord Rama. May righteousness prevail.', deco: 'bow' },
        { id: 'hanuman', year: 2026, month: 3, day: 2, window: 1, name: 'Hanuman Jayanti', icon: '🙏', sec: '💪', greet: 'Jai Bajrangbali!', desc: 'Strength, devotion, and courage. Happy Hanuman Jayanti!', deco: 'mace' },
        { id: 'goodfriday', year: 2026, month: 3, day: 3, window: 0, name: 'Good Friday', icon: '✝️', sec: '🕯️', greet: 'Blessed Good Friday', desc: 'Remembering the sacrifice and love. Have a blessed day.', deco: 'cross' },
        { id: 'easter', year: 2026, month: 3, day: 5, window: 0, name: 'Easter', icon: '🥚', sec: '🐰', greet: 'Happy Easter!', desc: 'New life and new hope. Happy Easter!', deco: 'egg' },
        { id: 'eidadha', year: 2026, month: 4, day: 27, window: 2, name: 'Eid al-Adha', icon: '🕌', sec: '🐑', greet: 'Eid Mubarak!', desc: 'Wishing you a blessed Eid al-Adha filled with sacrifice and faith.', deco: 'lantern' },
        { id: 'rathyatra', year: 2026, month: 6, day: 16, window: 1, name: 'Rath Yatra', icon: '🎡', sec: '🚩', greet: 'Jai Jagannath!', desc: 'May the divine chariot bring you good fortune.', deco: 'chariot' },
        { id: 'muharram', year: 2026, month: 6, day: 16, window: 1, name: 'Islamic New Year', icon: '☪️', sec: '📅', greet: 'Blessed Muharram', desc: 'Reflecting on the New Year with faith and hope.', deco: 'moon' },
        { id: 'rakhi', year: 2026, month: 7, day: 28, window: 1, name: 'Raksha Bandhan', icon: '🧵', sec: '✨', greet: 'Happy Raksha Bandhan!', desc: 'Celebrating the bond of love and protection.', deco: 'rakhi' },
        { id: 'janmashtami', year: 2026, month: 8, day: 1, window: 1, name: 'Janmashtami', icon: '🪈', sec: '🦚', greet: 'Happy Janmashtami!', desc: 'Celebrating the birth of Lord Krishna with joy.', deco: 'flute' },
        { id: 'ganesh', year: 2026, month: 8, day: 14, window: 5, name: 'Ganesh Chaturthi', icon: '🐘', sec: '🕉️', greet: 'Happy Ganesh Chaturthi!', desc: 'Ganpati Bappa Morya! May obstacles be removed from your path.', deco: 'modak' },
        { id: 'onam', year: 2026, month: 7, day: 26, window: 2, name: 'Onam', icon: '⛵', sec: '🌺', greet: 'Happy Onam!', desc: 'Harvest festival greetings from God\'s own country.', deco: 'flower' },
        { id: 'navaratri', year: 2026, month: 9, day: 11, window: 9, name: 'Navaratri', icon: '🔱', sec: '💃', greet: 'Happy Navaratri!', desc: 'Nine nights of devotion and celebration.', deco: 'trident' },
        { id: 'dussehra', year: 2026, month: 9, day: 20, window: 1, name: 'Dussehra', icon: '🏹', sec: '🌼', greet: 'Happy Dussehra!', desc: 'Victory of good over evil. Happy Dasara!', deco: 'bow' },
        { id: 'karwachauth', year: 2026, month: 9, day: 29, window: 0, name: 'Karwa Chauth', icon: '🌕', sec: '🥣', greet: 'Happy Karwa Chauth!', desc: 'Celebrating the bond of love and marriage.', deco: 'moon' },
        { id: 'diwali', year: 2026, month: 10, day: 8, window: 3, name: 'Diwali', icon: '🪔', sec: '✨', greet: 'Happy Diwali!', desc: 'May the festival of lights brighten your life and home.', deco: 'diya' },
        { id: 'lohri', year: 2026, month: 0, day: 13, window: 0, name: 'Lohri', icon: '🔥', sec: '🥜', greet: 'Happy Lohri!', desc: 'May the warmth of the bonfire fill your heart with joy.', deco: 'bonfire' },
        { id: 'basant', year: 2026, month: 0, day: 23, window: 0, name: 'Basant Panchami', icon: '🪁', sec: '🌼', greet: 'Happy Basant Panchami!', desc: 'Celebrating the arrival of spring and goddess Saraswati.', deco: 'kite' },
        { id: 'chhath', year: 2026, month: 10, day: 13, window: 3, name: 'Chhath Puja', icon: '🌅', sec: '🕉️', greet: 'Happy Chhath Puja!', desc: 'Wishing you a blessed Chhath Puja filled with faith and devotion.', deco: 'sun' },
        { id: 'gudipadwa', year: 2026, month: 2, day: 19, window: 1, name: 'Gudi Padwa', icon: '🪁', sec: '🎋', greet: 'Happy Gudi Padwa!', desc: 'New beginnings and success to you. Happy Nav Varsh!', deco: 'gudi' },
        { id: 'mahavir', year: 2026, month: 2, day: 31, window: 0, name: 'Mahavir Jayanti', icon: '🕉️', sec: '🙏', greet: 'Happy Mahavir Jayanti', desc: 'Celebrating peace and non-violence.', deco: 'peace' },
        { id: 'buddha', year: 2026, month: 4, day: 31, window: 0, name: 'Buddha Purnima', icon: '🏵️', sec: '🧘', greet: 'Happy Buddha Purnima', desc: 'Enlightenment and peace to all.', deco: 'lotus' },
        { id: 'gurunanak', year: 2026, month: 10, day: 24, window: 0, name: 'Guru Nanak Jayanti', icon: 'ੴ', sec: '🕯️', greet: 'Happy Gurpurab!', desc: 'Spreading the light of oneness and service.', deco: 'khanda' },

        //2027
    ];

    for (const f of festivals) {
        if (f.year === year) {
            if (month === f.month && day >= f.day && day <= f.day + f.window) {
                yield {
                    id: f.id,
                    name: f.name,
                    icon: f.icon,
                    secondaryIcon: f.sec,
                    greeting: f.greet,
                    description: f.desc,
                    logoDecoration: f.deco,
                    shouldSendEmail: (month === f.month && day === f.day)
                };
            }
        }
    }
}

// Internal helper to get all themes marked for email sending today
export const getSeasonalThemesForEmail = (dateInput = new Date()) => {
    return Array.from(getActiveThemes(dateInput)).filter(t => t && t.shouldSendEmail);
};

export const getSeasonalTheme = (dateInput = new Date()) => {
    // Array.from(getActiveThemes) evaluates the generator to get all matches
    const themes = Array.from(getActiveThemes(dateInput)).filter(Boolean);
    if (themes.length === 0) return null;

    // Priority 1: Exact day match where email sending is designated
    const exact = themes.find(t => t.shouldSendEmail);
    if (exact) return exact;

    // Fallback: Just return the first active theme found
    return themes[0];
};
