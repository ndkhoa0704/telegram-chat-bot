function TimeUtil() {
    return {
        /**
         * Converts a date string in DD/MM/YYYY or DD/MM/YYYY HH:mm:ss format to a Date object
         * @param {string} str - The date string to convert
         * @returns {Date} The parsed Date object in UTC
         * @example
         * // returns Date object for "2023-12-25T00:00:00.000Z"
         * strToDate("25/12/2023")
         * 
         * // returns Date object for "2023-12-25T14:30:45.000Z"
         * strToDate("25/12/2023 14:30:45")
         */
        strToDate: str => {
            const parts = str.split(' ');
            if (parts.length > 1) {
                const [d, m, y] = parts[0].split('/');
                const [h, min, s] = parts[1].split(':');
                return new Date(`${y}-${m}-${d}T${h}:${min}:${s}.000Z`);
            }
            const [d, m, y] = str.split('/');
            return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
        },
        getQuarter: (dateStr) => {
            const date = new Date(dateStr);
            const month = date.getMonth() + 1;
            return Math.ceil(month / 3);
        },
        /**
         * Converts a Date object to a formatted date string
         * @param {Date} date - The Date object to convert
         * @param {string} format - The format string (DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD, YYYY-MM-DD)
         * @returns {string} The formatted date string
         * @example
         * // returns "25/12/2023"
         * convertDateToStr(new Date('2023-12-25'), 'DD/MM/YYYY')
         * 
         * // returns "12/25/2023"
         * convertDateToStr(new Date('2023-12-25'), 'MM/DD/YYYY')
         * 
         * // returns "2023/12/25"
         * convertDateToStr(new Date('2023-12-25'), 'YYYY/MM/DD')
         * 
         * // returns "2023-12-25"
         * convertDateToStr(new Date('2023-12-25'), 'YYYY-MM-DD')
         */
        convertDateToStr: (date, format) => {
            if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) {
                return Promise.reject('Invalid date object provided');
            }

            if (!format || typeof format !== 'string') {
                return Promise.reject('Format parameter is required and must be a string');
            }

            // Convert to GMT+7 (Asia/Ho_Chi_Minh)
            // Use toLocaleString to get local time in Asia/Ho_Chi_Minh, then extract components
            const locale = 'en-GB'; // for DD/MM/YYYY order
            const options = {
                timeZone: 'Asia/Ho_Chi_Minh',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            };
            // The result is "dd/mm/yyyy" for en-GB, "mm/dd/yyyy" for en-US, etc.
            const localStr = date.toLocaleDateString(locale, options);
            // localStr: "25/12/2023"
            const [day, month, year] = localStr.split('/');

            switch (format.toUpperCase()) {
                case 'DD/MM/YYYY':
                    return `${day}/${month}/${year}`;
                case 'MM/DD/YYYY':
                    return `${month}/${day}/${year}`;
                case 'YYYY/MM/DD':
                    return `${year}/${month}/${day}`;
                case 'YYYY-MM-DD':
                    return `${year}-${month}-${day}`;
                case 'DD-MM-YYYY':
                    return `${day}-${month}-${year}`;
                case 'YYYYMMDD':
                    return `${year}${month}${day}`;
                default:
                    return Promise.reject(`Unsupported format: ${format}. Supported formats: DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD, YYYY-MM-DD, DD-MM-YYYY`);
            }
        },

        /**
         * Extracts date components from a date string in YYYY-MM-DD format
         * @param {string} dateStr - The date string in YYYY-MM-DD format
         * @returns {Object} Object containing day, month, year, quarter, and week number
         * @example
         * // returns { day: 25, month: 12, year: 2023, quarter: 4, week: 52 }
         * getDateComponents("2023-12-25")
         */
        getDateComponents: (dateStr) => {
            if (!dateStr || typeof dateStr !== 'string') {
                throw new Error('Date string is required and must be a string');
            }

            // Validate YYYY-MM-DD format
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(dateStr)) {
                throw new Error('Date string must be in YYYY-MM-DD format');
            }

            const date = new Date(dateStr);

            // Check if date is valid
            if (Number.isNaN(date.getTime())) {
                throw new Error('Invalid date provided');
            }

            const day = date.getDate();
            const month = date.getMonth() + 1; // getMonth() returns 0-11, so add 1
            const year = date.getFullYear();
            const quarter = Math.ceil(month / 3);

            // Calculate week number (ISO week)
            const firstDayOfYear = new Date(year, 0, 1);
            const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
            const week = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

            return {
                day,
                month,
                year,
                quarter,
                week
            };
        }
    }
}

export default TimeUtil();